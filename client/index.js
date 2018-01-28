const lc = require('litecore-lib')
const getContracts = require('./util/getContracts')

const db = require('./db/models')
const claimManager = require('./claimManager')

module.exports = async (web3, _contracts = null) => {
  const contracts = _contracts || await (await getContracts(web3)).deployed()

  const api = await require('./api')(contracts, web3)
  const challengeClaim = require('./challengeClaim')(web3, api)

  return {
    api,
    submitClaim: async (cmd, claimData, stopper, autoDeposit = false) => {
      const fn = async () => {
        const claim = await db.Claim.create(claimData)
        await claimManager.submit(cmd, api, claim, autoDeposit)
        await claimManager.defend(cmd, api, claim)
      }
      await Promise.race([
        stopper,
        fn(),
      ])
    },
    monitorClaims: async (cmd, challenger, stopper, autoChallenge = false, autoDeposit = false) => {
      return new Promise(async (resolve, reject) => {
        let inProgressClaims = {}

        try {
          cmd.log('Monitoring for claims...')
          const claimCreatedEvents = api.claimManager.ClaimCreated()
          claimCreatedEvents.watch(async (error, result) => {
            debugger
            if (error) {
              console.log(error)
              throw error
            }

            const claim = {
              id: result.args.claimID.toNumber(),
              claimant: result.args.claimant,
              plaintext: result.args.plaintext,
              blockHash: result.args.blockHash,
              createdAt: result.blockNumber,
            }

            cmd.log(`
              ClaimCreated(
                id: ${claim.id}
                claimant: ${claim.claimant}
                plaintext: ${claim.plaintext}
                blockHash: ${claim.blockHash}
                createdAt: ${claim.createdAt}
              )
            `)

            let scryptHash = lc.crypto.Hash.scrypt(Buffer.from(claim.plaintext, 'hex')).toString('hex')
            if (scryptHash !== claim.blockHash) {
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
                inProgressClaims[claim.id] = challengeClaim
                  .run(cmd, claim, challenger, autoDeposit)
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
          claimCreatedEvents.stopWatching()

          // wait for exisiting claims to finish
          // TODO: inProgressClaims is an object not an array anymore
          // await Promise.all(inProgressClaims)

          // resolve self
          resolve()
        } catch (error) {
          reject(error)
        }
      })
    },
  }
}
