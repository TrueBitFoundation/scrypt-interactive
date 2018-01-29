
module.exports = async (api, claim, stepResponse) => {
  let result = await api.getResult(claim.input, stepResponse.step)
  stepResponse.state = result.state
  stepResponse.proof = result.proof
  stepResponse.stateHash = result.stateHash
  await stepResponse.save()
}
