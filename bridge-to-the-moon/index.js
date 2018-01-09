const Web3 = require('web3');
const fs = require('fs');
const listeners = require('./src/listeners');

const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"))

const addresses = JSON.parse(fs.readFileSync('./contract_addresses.json'));
const ClaimManager = JSON.parse(fs.readFileSync('../build/contracts/ClaimManager.json'))
const ScryptVerifier = JSON.parse(fs.readFileSync('../build/contracts/ScryptVerifier.json'))

let claimManager = web3.eth.contract(ClaimManager.abi).at(addresses.claimManager);
let scryptVerifier = web3.eth.contract(ScryptVerifier.abi).at(addresses.scryptVerifier);

console.log("Turning on bridge event listeners")
listeners.turnOnListeners(claimManager, scryptVerifier);