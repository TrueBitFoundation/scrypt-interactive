
// @TODO: these have to be refactored when claimManager allows for multiple claims per claimant.
const getSessionID = async (api, claim, challenger) => {
  const sessionId = await api.claimManager.getSession.call(claim.claimID, challenger)
  return sessionId.toNumber()
}

// @TODO: these have to be refactored when claimManager allows for multiple claims per claimant.
const getSession = async (api, sessionID) => {
  const session = await api.getSession(sessionID)
  return session
}

module.exports = {
  getSessionID: getSessionID,
  getSession: getSession
}
