const Resolver = require('truffle-resolver')
const path = require('path')

const offchain = require('./offchain')

const resolver = new Resolver({
  // eslint-disable-next-line camelcase
  working_directory: path.resolve(__dirname, '../../'),
  // eslint-disable-next-line camelcase
  contracts_build_directory: 'build/contracts',
})

module.exports = async (web3) => {
  const getContract = async (name) => {
    const ContractInstance = resolver.require(name)
    ContractInstance.setProvider(web3.currentProvider)
    ContractInstance.defaults({
      from: web3.eth.defaultAccount,
      gas: 5500000,
      // @TODO(shrugs) - whenever truffle stops being garbage software
      //  figure out why it's not estimating the god damn gas for creating
      //  this contract
    })
    return ContractInstance
  }

  const ClaimManager = await getContract('ClaimManager')
  const ScryptVerifier = await getContract('ScryptVerifier')
  const DogeRelay = await getContract('DogeRelay')

  return {
    deployed: async () => {
      return ({
      claimManager: await ClaimManager.at(process.env.CLAIM_MANAGER_ADDRESS),
      scryptVerifier: await ScryptVerifier.at(process.env.SCRYPT_VERIFIER_ADDRESS),
      dogeRelay: await DogeRelay.at(process.env.DOGE_RELAY_ADDRESS),
      scryptRunner: await offchain.scryptRunner(),
    }) },
    deploy: async () => {
      const scryptVerifier = await ScryptVerifier.new()
      const claimManager = await ClaimManager.new(scryptVerifier.address)
      const dogeRelay = await DogeRelay.new(claimManager.address)
      await claimManager.setDogeRelay(dogeRelay.address)
      const scryptRunner = await offchain.scryptRunner()

      return {
        claimManager,
        scryptVerifier,
        dogeRelay,
        scryptRunner,
      }
    },
  }
}
