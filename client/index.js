const promisify = require('es6-promisify')
const fs = require('fs')
const readdir = promisify(fs.readdir, fs)
const getContracts = require('./util/getContracts')

module.exports = async function(web3, _contracts) {

  let contracts = await getContracts(web3)

  // TODO: why are we overwriting these, if just assigned above?
  // because web3 clients not properly configured yet
  contracts.scryptVerifier = _contracts.scryptVerifier
  contracts.claimManager = _contracts.claimManager
  contracts.scryptRunner = _contracts.scryptRunner
  contracts.dogeRelay = _contracts.dogeRelay

  const api = await require('./api')(contracts, web3)
  const challengeClaim = require('./challengeClaim')(web3, api)
  const createClaim = require('./createClaim')(web3, api)

  return {
    api,
    //In case of reboot
    initClaimant: async (cmd) => {
      for (file in await readdir('./claims')) {
        const claimData = JSON.parse(await readFile(`./claims/${file}`))
        createClaim.run(cmd, claimData.claim, claimData)
      }
    },
    createClaim: async (cmd, claim) => {
      return createClaim.run(cmd, claim)
    },
    initChallenges: async (cmd, claim) => {
      for (file in await readdir('./challenges')) {
        const challengeData = JSON.parse(await readFile(`./challenges/${file}`))
        challengeClaim.run(cmd, challengeData)
      }
    },
    monitorClaims: async (cmd, challenger, stopper, autoChallenge = false, autoDeposit = false) => {
      return new Promise(async (resolve, reject) => {
        let inProgressClaims = {}

        try {
          cmd.log('Monitoring for claims...')
          // first, monitor all ClaimCreated events from claimManager
          const claimCreatedEvents = api.claimManager.ClaimCreated()
          claimCreatedEvents.watch(async (error, result) => {

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

            const output = web3.toHex((await contracts.scryptRunner.run.call(claim.plaintext, 2049)[4]))

            if (output != claim.blockHash) {
              cmd.log('Proof of Work: INVALID')

              if (!autoChallenge) {
                // @TODO(shrugs) - prompt for challenge confirmation
                cmd.log('...but not configured to challenge, ignoring.')
                return
              }

              // note that this executes the function and adds the promise to the list
              //   of inProgressClaims, kinda like a lil go func()
              //   (we'll await on these promises down the line)
              // this promise also always resolves positively
              // so that Promise.all works correctly
              if(!(claim.id in inProgressClaims)) {
                inProgressClaims[claim.id] = challengeClaim.run(cmd, claim, challenger, autoDeposit)
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
          // claimCreatedEvents.on('error', (error) => {
          //   claimCreatedEvents.unsubscribe()
          //   reject(error)
          // })

          // wait for an external stop
          await stopper

          // stop watching
          claimCreatedEvents.stopWatching()

          // wait for exisiting claims to finish
          //TODO: inProgressClaims is an object not an array anymore
          //await Promise.all(inProgressClaims)

          // resolve self
          resolve()
        } catch (error) {
          reject(error)
        }
      })
    },
  }
}
