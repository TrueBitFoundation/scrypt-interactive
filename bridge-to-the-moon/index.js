const Web3 = require('web3');
const fs = require('fs');

const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"))

const addresses = JSON.parse(fs.readFileSync('./contract_addresses.json'));
const ClaimManager = JSON.parse(fs.readFileSync('../build/contracts/ClaimManager.json'))
const ScryptVerifier = JSON.parse(fs.readFileSync('../build/contracts/ScryptVerifier.json'))

let claimManager = web3.eth.contract(ClaimManager.abi).at(addresses.claimManager);
let scryptVerifier = web3.eth.contract(ScryptVerifier.abi).at(addresses.scryptVerifier);

const serializedBlockHeader = '030162002adb34dfa6574cf127a781ecb9683ca28f911a59020628c90c72b4a3d9942233a3b905b2388b020085dbd9e03209db4493f5420336d882d0b78b54f728b8f90058f7115a2c83221a00000000'
const testScryptHash = 'ce60a0d4a7c2223a94437d44fe4d33a30489436714d18376f9ebc5e2bd6e5682'

async function run() {

  await claimManager.makeDeposit({ from: addresses.claimant, value: 1 })
  await claimManager.makeDeposit({ from: addresses.challenger, value: 1 })

  tx = await claimManager.checkScrypt(serializedBlockHeader, testScryptHash, addresses.claimant, { from: addresses.dogeRelay, gas: 200000})

  console.log(tx)

  //log = tx.logs.find(l => l.event === 'ClaimCreated')
  //claimID = log.args.claimID.toNumber()
  //tx = await claimManager.challengeClaim(claimID, { from: challenger })
}

run();