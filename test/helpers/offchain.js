const path = require('path')
const fs = require('fs')

const deploy = require('./deploy')
const Web3 = require('web3')

const parityProvider = new Web3.providers.HttpProvider('http://localhost:4242')
const parity = new Web3(parityProvider)

const ScryptRunner = artifacts.require('ScryptRunner')
ScryptRunner.setProvider(parityProvider)

var account
var _scryptRunner

async function scryptRunner () {
  // if (!account) {
  //   account = await deploy.setupAccount('0x00a329c0648769a73afac7f9381e08fb43dbea72')
  // }

  // let runnerCode = Buffer.from(fs.readFileSync(path.join(__dirname, '/offchain_evm')))
  // let runnerABI = JSON.parse(fs.readFileSync(path.join(__dirname, '/offchain_abi.json')))

  // if (!_scryptRunner) {
  //   _scryptRunner = await deploy.deployContract(runnerCode, runnerABI, account, 8000000)
  // }

  console.log('start')

  debugger

  parity.personal.unlockAccount('0x00a329c0648769a73afac7f9381e08fb43dbea72', '')

  const thisContract = parity.eth.contract(ScryptRunner.abi).new({
    data: ScryptRunner.bytecode,
    from: '0x00a329c0648769a73afac7f9381e08fb43dbea72',
    gas: 4000000,
  })

  console.log('end')

  return thisContract
}

module.exports = {
  scryptRunner: scryptRunner,
}