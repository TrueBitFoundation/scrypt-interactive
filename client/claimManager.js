
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

claimData = { stepResponses: {} }

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

          if (result) {
            let sessionId = result.args.sessionId.toNumber()
            let session = await api.getSession(sessionId)
            let step = session.medStep.toNumber()
            let highStep = session.highStep.toNumber()
            let lowStep = session.lowStep.toNumber()

            if (session.medHash == '0x0000000000000000000000000000000000000000000000000000000000000000') {
              console.log(`Defending step ${step}`)
              if (step in claimData.stepResponses) {
                let stateHash = claimData.stepResponses[step].stateHash;
                await api.respond(sessionId, step, stateHash, {from: claim.claimant})
              } else {
                let results = await api.getResult(session.input, step)
                claimData.stepResponses[step] = results;
                await saveClaimData(claimData)
                await api.respond(sessionId, step, results.stateHash, {from: claim.claimant})
              }
            } else {
              // Defending final step 0
              console.log(`Defending final step ${lowStep}`)
              let preState, postStateAndProof, postState, proof
              if ('preState' in claimData) {
                preState = claimData.preState
                postStateAndProof = claimData.postStateAndProof
              } else {
                preState = (await api.getResult(session.input, lowStep)).state
                postStateAndProof = await api.getResult(session.input, highStep)
                claimData.preState = preState;
                claimData.postStateAndProof = postStateAndProof;
                await saveClaimData(claimData)
              }
              postState = postStateAndProof.state
              proof = postStateAndProof.proof || '0x00'
              await api.scryptVerifier.performStepVerification(sessionId, claim.claimID, preState, postState, proof, api.claimManager.address, { from: claim.claimant, gas: 3000000 })
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
