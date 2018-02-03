
const {
  getSessionID,
  getSession,
} = require('./session')
const events = require('../util/events')
const submitChallenge = require('./submitChallenge')
const submitQuery = require('./query').submitQuery
const submitFirstQuery = require('./query').submitFirstQuery
const triggerVerificationGame = require('./triggerVerificationGame')
const submitFinalStepVerification = require('./submitFinalStepVerification')

const queryAfterResponses = async (api, claim, challenger) => {
  const sessionID = await getSessionID(api, claim, challenger)
  const newResponseEvent = api.scryptVerifier.NewResponse({
    sessionId: sessionID, challenger: challenger,
  })

  await new Promise((resolve, reject) => {
    newResponseEvent.watch(async (err, result) => {
      if (err) { return reject(err) }

      await submitQuery(api, claim, sessionID, challenger)
      // check if we are on the final step
      const session = await getSession(api, sessionID)
      const lowStep = session.lowStep
      const highStep = session.highStep
      if (lowStep.add(1).eq(highStep)) {
        // if so: trigger final onchain verification
        await submitFinalStepVerification(api, claim, sessionID, session, challenger)
        await events.tryStopWatching(newResponseEvent, 'NewResponse')
        resolve()
      }
    })
  })
}

module.exports = async (api, claim, challenger) => {
  const verificationGameStartedEvent = api.claimManager.VerificationGameStarted({
    claimID: claim.claimID,
    challenger: challenger,
  })

  const respondWithQueries = new Promise((resolve, reject) => {
    verificationGameStartedEvent.watch(async (err, event) => {
      if (err) { return reject(err) }
      if (event) {
        await queryAfterResponses(api, claim, challenger)
      }
      await events.tryStopWatching(
        verificationGameStartedEvent,
        'VerificationGameStarted'
      )
      resolve()
    })
  })

  await submitChallenge(api, claim, challenger)

  await triggerVerificationGame(api, claim, challenger)

  // submit the first query; do not wait for a responseEvent.
  const sessionID = await getSessionID(api, claim, challenger)
  submitFirstQuery(api, claim, sessionID, challenger)

  await respondWithQueries
}
