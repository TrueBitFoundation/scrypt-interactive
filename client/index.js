
const bttm = require('./bridge-to-the-moon')

const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"))

//This is being used as a test file for bridge-to-the-moon
//truffle exec client/index.js

module.exports = async function(callback) {
    // perform actions
    const timeout = require('../test/helpers/timeout')
    const dataFormatter = require('../test/helpers/dataFormatter')
    const offchain = require('../test/helpers/offchain')
    
    const ClaimManager = artifacts.require('ClaimManager')
    const ScryptVerifier = artifacts.require('ScryptVerifier')

    const scryptRunner = await offchain.scryptRunner();

    const [
        dogeRelayAddress,
        claimant,
        challenger,
      ] = web3.eth.accounts

    let scryptVerifier = await ScryptVerifier.new()
    let claimManager = await ClaimManager.new(dogeRelayAddress, scryptVerifier.address)

    const bridge = await require('./bridge-to-the-moon')(claimManager, scryptVerifier, scryptRunner)

    
}