

const timeout = require('../util/timeout')
const StepResponse = require('../db/models').StepResponse

module.exports = async (api, claim) => { 
  const computeStep = require('./computeStep')
  const claimantConvictedEvent = api.scryptVerifier.ClaimantConvicted({claimant: claim.claimant})
  const queryEvent = api.scryptVerifier.NewQuery({claimant: claim.claimant})

  await Promise.race([ 

    // if claimant loses the verification game
    new Promise((resolve, reject) => {
      claimantConvictedEvent.watch((err, result) => {
        if (err) reject(err)
        if (result) resolve()
      })
    }),

    // resolves when the claim is ready (i.e. the game is over.
    // expected to resolve all times besides losing
    new Promise(async (resolve, reject) => {
      let ready 
      while(!ready) {
        await timeout(10000)
        ready = await api.claimManager.getClaimReady.call(claim.claimID)
      }
      await api.claimManager.checkClaimSuccessful(claim.claimID, {from: claim.claimant})
      resolve()
    }),

    // respond to Query calls by challengers
    // this never resolves.
    new Promise(async (resolve, reject) => {
      let stepResponse;

      queryEvent.watch(async (err, event) => {
        if (err) { return reject(err) }
        if (event) {
          let sessionId = event.args.sessionId.toNumber()
          let session = await api.getSession(sessionId)

          if (session.medHash == '0x0000000000000000000000000000000000000000000000000000000000000000') {
            // medHash being all 0s means: the verification game is in progress.
            console.log(`Defending step ${session.medStep.toNumber()}`)

            await StepResponse.findOrCreate({
              where: {claim_id: claim.id, sessionID: sessionId, step: session.medStep.toNumber()}
            }).then((res) => stepResponse = res[0])

            if (stepResponse.stateHash) {
              // the response has been computed before.
              // therefore: provide the same response.
              await api.respond(stepResponse.sessionID, stepResponse.step, stepResponse.stateHash, {from: claim.claimant})
            } else {
              // the response has never been computed before.
              // therefore: compute it now.
              await computeStep(api, claim, stepResponse)
              await api.respond(stepResponse.sessionID, stepResponse.step, stepResponse.stateHash, {from: claim.claimant})
            }

          } else {
            // medHash not being all 0s means: the verification game is in its final step.
            let lowStepResponse, highStepResponse

            // get results for lowStep
            await StepResponse.findOrCreate({
              where: {claim_id: claim.id, sessionID: sessionId, step: session.lowStep.toNumber()}
            }).then((res) => lowStepResponse = res[0]) 
            if (!lowStepResponse.state) { await computeStep(api, claim, lowStepResponse) }

            // get results for highStep
            await StepResponse.findOrCreate({
              where: {claim_id: claim.id, sessionID: sessionId, step: session.highStep.toNumber()}
            }).then((res) => highStepResponse = res[0])
            if (!highStepResponse.state) { await computeStep(api, claim, highStepResponse) }
            
            // trigger the final-step verification on-chain.
            await api.scryptVerifier.performStepVerification(
              sessionId, 
              claim.claimID, 
              lowStepResponse.state,
              highStepResponse.state,
              highStepResponse.proof,
              api.claimManager.address,
              { from: claim.claimant, gas: 3000000 }
            )

            await timeout(1000)
          }
        }
      })
    })

  ])

  claimantConvictedEvent.stopWatching()
  queryEvent.stopWatching()
  console.log("Finishing claim")
  return
}
