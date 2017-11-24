const ClaimManager = artifacts.require('./ClaimManager.sol')
const ScryptVerifier = artifacts.require('./ScryptVerifier.sol')
const ScryptRunner = artifacts.require('./ScryptRunner.sol')

module.exports = function (deployer, network) {
  deployer.deploy(ScryptVerifier)
  deployer.deploy(ClaimManager)
  deployer.deploy(ScryptRunner)
}
