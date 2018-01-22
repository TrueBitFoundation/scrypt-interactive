const ClaimManager = artifacts.require('./ClaimManager.sol')
const ScryptVerifier = artifacts.require('./ScryptVerifier.sol')
const ScryptRunner = artifacts.require('./ScryptRunner.sol')

module.exports = function (deployer, network) {
  deployer.deploy(ScryptVerifier).then(() => {
    deployer.deploy(
      ClaimManager,
      process.env.DOGE_RELAY_ADDRESS,
      ScryptVerifier.address
    )

    deployer.deploy(ScryptRunner)
  })
}
