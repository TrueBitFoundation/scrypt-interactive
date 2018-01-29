
module.exports = async (api, claim) => {
  // TODO - replace with a call to DogeRelay that forwards to claimmanager
  await api.createClaim(claim.input, claim.hash, claim.claimant, claim.proposalID, { from: claim.claimant })

  // update values in the db
  claim.claimID = (await api.claimManager.claimantClaims(claim.claimant)).toNumber()
  claim.createdAt = (await api.claimManager.createdAt.call(claim.claimID)).toNumber()
  await claim.save()
}
