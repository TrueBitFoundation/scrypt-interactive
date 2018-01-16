const blockheader = require('./util/blockheader')
const fs = require('fs')

module.exports = async function(claimManager, scryptVerifier, scryptRunner, web3, challenger) {
  const api = await require('./api')(claimManager, scryptVerifier, scryptRunner, web3)
  const stateMachines = await require('./state-machines')(web3, api, challenger)

  return {
    api,
    initClaimant: async(cmd) => {
      return new Promise(async (resolve, reject) => {
        let claimFiles = fs.readdirSync('./claims')
        fs.readdirSync('./claims').forEach(file => {
          let claimData = JSON.parse(fs.readFileSync('./claims/'+file))
          stateMachines.createClaim.run(cmd, claimData.claim, claimData)
        })
      })
    },
    createClaim: async (cmd, claim) => {
      return new Promise(async (resolve, reject) => {
        //This should go in the createClaim
         try {
          stateMachines.createClaim.run(cmd, claim)
          resolve()
        } catch(e) {
          reject(e)
        }
    })
  },
  monitorClaims: async (cmd, autoChallenge = false, autoDeposit = false) => {
      return new Promise(async (resolve, reject) => {
        let inProgressClaims = []

        try {
          // first, monitor all ClaimCreated events from claimManager
          const claimCreatedEvents = api.claimManager.ClaimCreated()
          claimCreatedEvents.watch((error, result) => {

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
            
            //not working, is serialized supposed to be plaintext
            //if (!blockheader.validProofOfWork(claim.serialized)) {
            //Replace with scryptRunner???
            if (true) {
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
                stateMachines.challengeClaim.run(cmd, claim, autoDeposit)
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