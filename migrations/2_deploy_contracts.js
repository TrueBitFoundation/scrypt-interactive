const ClaimManager = artifacts.require('./ClaimManager.sol')
const ScryptVerifier = artifacts.require('./ScryptVerifier.sol')
const ScryptRunner = artifacts.require('./ScryptRunner.sol')
const DogeRelayDummy = artifacts.require('./DogeRelayDummy.sol')

module.exports = async (deployer, network) => {
  await deployer.deploy(ScryptVerifier)

  await deployer.deploy(ClaimManager,
    ScryptVerifier.address
  )

  await deployer.deploy(DogeRelayDummy, ClaimManager.address)

  const claimManager = await ClaimManager.deployed()
  await claimManager.setDogeRelay(DogeRelayDummy.address)

  await deployer.deploy(ScryptRunner)

  console.log(`
SCRYPT_VERIFIER_ADDRESS=${ScryptVerifier.address}
CLAIM_MANAGER_ADDRESS=${ClaimManager.address}
DOGE_RELAY_ADDRESS=${DogeRelayDummy.address}
SCRYPT_RUNNER_ADDRESS=${ScryptRunner.address}
  `)
}
