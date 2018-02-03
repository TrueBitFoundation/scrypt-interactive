
module.exports = async (api, claim, challenger) => {
  // Figure out if we are the first challenger
  const currentChallenger = await api.claimManager.getCurrentChallenger.call(claim.claimID)
  const verificationOngoing = await api.claimManager.getVerificationOngoing.call(claim.claimID)

  if (currentChallenger == challenger && !verificationOngoing) {
    await api.claimManager.runNextVerificationGame(claim.claimID, { from: challenger })  
  }
}
