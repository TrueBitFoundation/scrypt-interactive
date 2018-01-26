const promisify = require('es6-promisify')
const fs = require('fs')
const readdir = promisify(fs.readdir, fs)
const lc = require('litecore-lib')
const getContracts = require('./util/getContracts')

module.exports = async function(web3, _contracts) {

  let contracts = await getContracts(web3)

  // TODO: why are we overwriting these, if just assigned above?
  contracts.scryptVerifier = _contracts.scryptVerifier
  contracts.claimManager = _contracts.claimManager
  contracts.scryptRunner = _contracts.scryptRunner

  const api = await require('./api')(contracts, web3)
  const stateMachines = await require('./state-machines')(web3, api)

  return {
    api,
    //In case of reboot
    initClaimant: async (cmd) => {
      fs.readdirSync('./claims').forEach(file => {
        const claimData = JSON.parse(fs.readFileSync('./claims/'+file))
        stateMachines.createClaim.run(cmd, claimData.claim, claimData)
      })
    },
    createClaim: async (cmd, claim) => {
      return stateMachines.createClaim.run(cmd, claim)
    },
    initChallenges: async (cmd, claim) => {
      fs.readdirSync('./challenges').forEach(file => {
        const challengeData = JSON.parse(fs.readFileSync('./challenges/'+file))
        stateMachines.challengeClaim.run(cmd, challengeData)
      })
    },
    monitorClaims: async (cmd, challenger, autoChallenge = false, autoDeposit = false) => {
      return new Promise(async (resolve, reject) => {
        let inProgressClaims = []

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

            let scryptHash = lc.crypto.Hash.scrypt(Buffer(claim.plaintext, 'hex')).toString('hex')
            if (scryptHash != claim.blockHash) {
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
              inProgressClaims.push(
                stateMachines.challengeClaim.run(cmd, claim, challenger, autoDeposit)
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
              )
            } else {
              cmd.log('Proof of Work: Valid')
            }
          })
          // claimCreatedEvents.on('error', (error) => {
          //   claimCreatedEvents.unsubscribe()
          //   reject(error)
          // })

          process.on('SIGINT', function () {
            claimCreatedEvents.stopWatching()
            Promise.all(inProgressClaims).then(resolve)
          })
        } catch (error) {
          reject(error)
        }
      })
    },
  }
}
