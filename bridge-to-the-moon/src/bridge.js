const blockheader = require('./utils/blockheader')
const ChallengeClaim = require('./challengeClaim')

module.exports = async (web3, contractAddresses) => {
  const api = await require('./api')(web3, contractAddresses)

  const challengeClaim = ChallengeClaim(web3, api)

  return {
    monitor: async (cmd, autoChallenge = false, autoDeposit = false) => {
      return new Promise(async (resolve, reject) => {
        let inProgressClaims = []

        try {
          // first, monitor all ClaimCreated events from claimManager
          const claimCreatedEvents = api.claimManager.contract.events.ClaimCreated()
          claimCreatedEvents.on('data', (event) => {
            const claim = {
              id: event.returnValues.claimID,
              claimant: event.returnValues.claimant,
              plaintext: event.returnValues.plaintext,
              blockHash: event.returnValues.blockHash,
              createdAt: event.blockNumber,
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

            if (!blockheader.validProofOfWork(claim.serialized)) {
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
                challengeClaim.run(cmd, claim, autoDeposit)
                  .then(() => {
                    cmd.log(`Finished Challenging Claim: ${claim.id}`)
                  })
                  .catch((err) => {
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
          claimCreatedEvents.on('error', (error) => {
            claimCreatedEvents.unsubscribe()
            reject(error)
          })

          process.on('SIGINT', function () {
            claimCreatedEvents.unsubscribe()
            Promise.all(inProgressClaims).then(resolve)
          })
        } catch (error) {
          reject(error)
        }
      })
    },
  }
}
