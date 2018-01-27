const ClaimManager = artifacts.require('./ClaimManager.sol')
const ScryptVerifier = artifacts.require('./ScryptVerifier.sol')
const ScryptRunner = artifacts.require('./ScryptRunner.sol')
const DogeRelay = artifacts.require('./DogeRelay.sol')

module.exports = function (deployer, network) {
  deployer.deploy(ScryptVerifier).then(() => {
    deployer.deploy(
      ClaimManager,
      process.env.DOGE_RELAY_ADDRESS,
      ScryptVerifier.address
    ).then(() => {
      deployer.deploy(DogeRelay, ClaimManager.address)
    })

    deployer.deploy(ScryptRunner)
  })
}
