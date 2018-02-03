
const calculateMidpoint = require('../util/math').calculateMidpoint
const getSessionID = require('./session').getSessionID
const getSession = require('./session').getSession
const submitChallenge = require('./submitChallenge')
const submitQuery = require('./query').submitQuery
const submitFirstQuery = require('./query').submitFirstQuery
const triggerVerificationGame = require('./triggerVerificationGame')

const queryAfterResponses = async (api, claim, challenger) => {
  const sessionID = await getSessionID(api, claim, challenger)
  const newResponseEvent = api.scryptVerifier.NewResponse({sessionId: sessionID, challenger: challenger})
  
  newResponseEvent.watch(async (err, result) => {
    if (result) {
      await submitQuery(api, claim, sessionID, challenger, newResponseEvent)
    }
  })
}

module.exports = async (api, claim, challenger) => {
  const verificationGameStartedEvent = api.claimManager.VerificationGameStarted({ claimID: claim.claimID, challenger: challenger })

  verificationGameStartedEvent.watch(async (err, event) => {
    if (event) { 
      await queryAfterResponses(api, claim, challenger) 
      verificationGameStartedEvent.stopWatching()
    }
  })

  await submitChallenge(api, claim, challenger) 

  await triggerVerificationGame(api, claim, challenger)
  
  // submit the first query; do not wait for a responseEvent.
  const sessionID = await getSessionID(api, claim, challenger)
  submitFirstQuery(api, claim, sessionID, challenger)
}
