
const fs = require('fs')
const path = require('path')
const promisify = require('es6-promisify')

const writeFile = promisify(fs.writeFile, fs)
const mkdirp = promisify(require('mkdirp'))

const BlockEmitter = require('./util/blockemitter')
const waitForEvent = require('./util/waitForEvent')
const timeout = require('./util/timeout')

const claimCachePath = path.resolve(__dirname, '../../cache/claims')

const saveClaimData = async (claimData) => {
  await mkdirp(claimCachePath)
  await writeFile(`${claimCachePath}/${claimData.claimID}.json`, JSON.stringify(claimData))
}

const StepResponse = require('./db/models').StepResponse

computeStep = async (api, claim, stepResponse) => {
  let result = await api.getResult(claim.input, stepResponse.step)
  stepResponse.state = result.state
  stepResponse.proof = result.proof
  stepResponse.stateHash = result.stateHash
  await stepResponse.save()
},

module.exports = (web3, api) => ({
  createClaim: async (claim) => {
    console.log('Creating claim');
    // @TODO - replace with a call to DogeRelay that forwards to claimmanager
    await api.createClaim(claim.input, claim.hash, claim.claimant, claim.proposalID, { from: claim.claimant })

    claim.claimID = (await api.claimManager.claimantClaims(claim.claimant)).toNumber()
    claim.createdAt = (await api.claimManager.createdAt.call(claim.claimID)).toNumber()
    await claim.save()
    // await saveClaimData(claimData)
  },

  defendClaim: async (claim) => {
    const claimantConvictedEvent = api.scryptVerifier.ClaimantConvicted({claimant: claim.claimant})
    const queryEvent = api.scryptVerifier.NewQuery({claimant: claim.claimant})

    await Promise.race([ 

      // if claimant loses the game
      new Promise((resolve, reject) => {
        claimantConvictedEvent.watch((err, result) => {//claimant loses verification game
          if(err) reject(err)
          if(result) resolve()
        })
      }),

      // resolves when the claim is ready (i.e. the game is over.
      // expected to resolve all times besides losing
      new Promise(async (resolve, reject) => {
        let ready 
        while(!ready) {
          await timeout(10000)//wait 10 seconds
          ready = await api.claimManager.getClaimReady.call(claim.claimID)
        }
        //breaks out of loop and finishes claim
        console.log("Finishing claim")
        await api.claimManager.checkClaimSuccessful(claim.claimID, {from: claim.claimant})
        await timeout(1000)
        resolve()
      }),

      // respond to Query calls by challengers
      // this never resolves.
      new Promise(async (resolve, reject) => {
        queryEvent.watch(async (err, result) => {
          if (err) {
            return reject(err)
          }

          let stepResponse;

          if (result) {
            let sessionId = result.args.sessionId.toNumber()
            let session = await api.getSession(sessionId)
            let step = session.medStep.toNumber()
            let highStep = session.highStep.toNumber()
            let lowStep = session.lowStep.toNumber()

            if (session.medHash == '0x0000000000000000000000000000000000000000000000000000000000000000') {
              console.log(`Defending step ${step}`)

              await StepResponse.findOrCreate({
                where: {claim_id: claim.id, sessionID: sessionId, step: step}
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
              // defending the final step
              let lowStepResponse, highStepResponse

              await StepResponse.findOrCreate({
                where: {claim_id: claim.id, sessionID: sessionId, step: lowStep}
              }).then((res) => lowStepResponse = res[0]) 
              if (!lowStepResponse.state) { await computeStep(api, claim, lowStepResponse) }

              await StepResponse.findOrCreate({
                where: {claim_id: claim.id, sessionID: sessionId, step: highStep}
              }).then((res) => highStepResponse = res[0])
              if (!highStepResponse.state) { await computeStep(api, claim, highStepResponse) }
              
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

    // Tidy up claim and kill promise
    claimantConvictedEvent.stopWatching()
    queryEvent.stopWatching()
    console.log("Finishing claim")
  },

  rebootClaim: async (claim) => {
    let challengers = (await api.claimManager.getChallengers(claim.claimID)).toNumber()
    for (challenger in challengers) {
      let sessionId = (await api.claimManager.getSession.call(claim.claimID, challenger)).toNumber()
      if (sessionId > 0) {
        let lastSteps = await api.scryptVerifier.getLastSteps.call(sessionId)
        let claimantLastStep = lastSteps[0].toNumber()
        let challengerLastStep = lastSteps[1].toNumber()
        if (claimantLastStep < challengerLastStep) {
          //I think we can get away with only dealing with steps above 0, but needs to be tested
          let session = await api.getSession(sessionId)
          let step = session.medStep.toNumber()
          let results = await api.getResult(session.input, step)
          claimData.stepResponses[step] = results;
          await saveClaimData(claimData)
          await api.respond(sessionId, step, results.stateHash, {from: claim.claimant})
        }
      }
    }
  }
})
