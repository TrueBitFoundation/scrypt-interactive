const Web3 = require('web3')
const fs = require('fs')
const deploy = require('./deploy')

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_PARITY_PROVIDER))

var account

var _scryptRunner

async function scryptRunner () {
  if (!account) account = await deploy.setupAccount('0x00a329c0648769a73afac7f9381e08fb43dbea72')

  if (!_scryptRunner) _scryptRunner = await deploy.deployContract(runnerCode, runnerABI, 0, account, 4000000, true)

  return _scryptRunner
}

module.exports = {
  scryptRunner: scryptRunner,
}
