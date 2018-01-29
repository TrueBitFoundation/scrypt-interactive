
// TODO: this file is not being used.

// module.exports = async (api, claim) => {
//   let challengers = (await api.claimManager.getChallengers(claim.claimID)).toNumber()
//   for (challenger in challengers) {
//     let sessionId = (await api.claimManager.getSession.call(claim.claimID, challenger)).toNumber()
//     if (sessionId > 0) {
//       let lastSteps = await api.scryptVerifier.getLastSteps.call(sessionId)
//       let claimantLastStep = lastSteps[0].toNumber()
//       let challengerLastStep = lastSteps[1].toNumber()
//       if (claimantLastStep < challengerLastStep) {
//         //I think we can get away with only dealing with steps above 0, but needs to be tested
//         let session = await api.getSession(sessionId)
//         let step = session.medStep.toNumber()
//         let results = await api.getResult(session.input, step)
//         claimData.stepResponses[step] = results;
//         // await saveClaimData(claimData)
//         await api.respond(sessionId, step, results.stateHash, {from: claim.claimant})
//       }
//     }
//   }
// }
