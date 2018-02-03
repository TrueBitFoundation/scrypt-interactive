const getContracts = require('./util/getContracts')

const db = require('./db/models')
const primitives = require('./primitives')
const events = require('./util/events')

module.exports = async (web3, _contracts = null) => {
  const contracts = _contracts || await (await getContracts(web3)).deployed()
  const api = await require('./api')(contracts, web3)

  return {
    api,
    primitives,
    submitClaim: async (cmd, claimData, stopper) => {
      const fn = async () => {
        const claim = await db.Claim.create(claimData)
        await primitives.submitClaim(cmd, api, claim)
        await primitives.defend(cmd, api, claim)
      }
      await Promise.race([
        stopper,
        fn(),
      ])
    },
    monitorClaims: async (cmd, challenger, stopper, autoChallenge = false) => {
      return new Promise(async (resolve, reject) => {
        try {
          const inProgressClaims = {}

          cmd.log('Monitoring for claims...')
          const claimCreatedEvents = api.claimManager.ClaimCreated()
          claimCreatedEvents.watch(async (error, result) => {
            if (error) {
              console.log(error)
              return reject(error)
            }

            const claim = await db.Claim.create({
              claimID: result.args.claimID.toString(),
              claimant: result.args.claimant,
              input: result.args.plaintext,
              hash: result.args.blockHash,
              claimCreatedAt: result.blockNumber,
            })

            cmd.log(`
              ClaimCreated(
                id: ${claim.claimID}
                claimant: ${claim.claimant}
                plaintext: ${claim.input}
                blockHash: ${claim.hash}
                createdAt: ${claim.claimCreatedAt}
              )
            `)

            const output = web3.toHex((await contracts.scryptRunner.run.call(claim.input, 2049)[4]))

            if (output !== claim.hash) {
              cmd.log('Proof of Work: INVALID')

              if (!autoChallenge) {
                cmd.log('...but not configured to challenge, ignoring.')
                return
              }

              // note that this executes the function and adds the promise to the list
              //   of inProgressClaims, kinda like a lil go func()
              //   (we'll await on these promises down the line)
              // this promise also always resolves positively
              // so that Promise.all works correctly
              if (!(claim.id in inProgressClaims)) {
                inProgressClaims[claim.id] = primitives
                  .challenge(api, claim, challenger)
                  .then(() => {
                    cmd.log(`Finished Challenging Claim: ${claim.id}`)
                  })
                  .catch((err) => {
                    cmd.log('Bridge Error --------------------------')
                    cmd.log(`Finished Challenging Claim: ${claim.id}`)
                    cmd.log(err)
                  })
                  .then(() => {
                    return Promise.resolve()
                  })
              }
            } else {
              cmd.log('Proof of Work: Valid')
            }
          })

          // wait for an external stop
          await stopper

          // stop watching
          await events.tryStopWatching(claimCreatedEvents, 'ClaimCreated')

          // wait for exisiting claims to finish
          // TODO: inProgressClaims is an object not an array anymore
          // await Promise.all(inProgressClaims)
          await Promise.all(Object.values(inProgressClaims))

          // resolve self
          resolve()
        } catch (error) {
          reject(error)
        }
      })
    },
  }
}
