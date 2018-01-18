
const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP_PROVIDER))

const serializedBlockHeader = '030162002adb34dfa6574cf127a781ecb9683ca28f911a59020628c90c72b4a3d9942233a3b905b2388b020085dbd9e03209db4493f5420336d882d0b78b54f728b8f90058f7115a2c83221a00000000'
const testScryptHash = 'ce60a0d4a7c2223a94437d44fe4d33a30489436714d18376f9ebc5e2bd6e5682'

// This is being used as a test file for bridge-to-the-moon client
// truffle exec client/index.js to use

module.exports = async function (callback) {
  // perform actions
  const offchain = require('../test/helpers/offchain')
  const ClaimManager = artifacts.require('ClaimManager')
  const ScryptVerifier = artifacts.require('ScryptVerifier')

  const [
    dogeRelayAddress,
    claimant,
    challenger,
  ] = web3.eth.accounts

  const scryptRunner = await offchain.scryptRunner()
  let scryptVerifier = await ScryptVerifier.new()
  let claimManager = await ClaimManager.new(dogeRelayAddress, scryptVerifier.address)

  const bridge = await require('./bridge-to-the-moon')(claimManager, scryptVerifier, scryptRunner, web3)

  const testClaim = {
    serializedBlockHeader: serializedBlockHeader,
    scryptHash: testScryptHash,
    claimant: claimant,
    dogeRelayAddress: dogeRelayAddress, // this will eventually be taken out when integrated with rsk's code
  }

  // Setup separate bridge processes
  // bridge.initClaimant(console)
  bridge.createClaim(console, testClaim)
  bridge.monitorClaims(console, challenger, true, true)
}
