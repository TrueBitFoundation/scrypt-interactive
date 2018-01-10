
module.exports = async function(claimManager, scryptVerifier, scryptRunner) {
  const api = await require('./api')(claimManager, scryptVerifier, scryptRunner)

  return {
    api,
  }
}