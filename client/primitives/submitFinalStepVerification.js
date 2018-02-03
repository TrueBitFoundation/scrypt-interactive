
module.exports = async (api, claim, sessionID, session, challenger) => {
  const lowStep = session.lowStep.toNumber()
  const highStep = session.highStep.toNumber()

  const preState = (await api.getResult(session.input, lowStep)).state
  const postStateAndProof = await api.getResult(session.input, highStep)

  // @TODO: postState needs to be session.highHash; 
  // provide this in the solidity getter

  // const postState = postStateAndProof.state
  const postState = claim.hash

  const proof = postStateAndProof.proof || '0x00'

  await api.scryptVerifier.performStepVerification(
    sessionID,
    claim.claimID,
    preState,
    postState,
    proof,
    api.claimManager.address,
    {from: challenger, gas: 3000000}
  ) 
}
