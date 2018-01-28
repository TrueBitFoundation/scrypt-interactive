require('dotenv').config()

const Web3 = require('web3')
const Resolver = require('truffle-resolver')
const path = require('path')

const PARITY_DEV_ADDRESS = '0x00a329c0648769a73afac7f9381e08fb43dbea72'

const parityProvider = new Web3.providers.HttpProvider(process.env.WEB3_PARITY_PROVIDER)
const parity = new Web3(parityProvider)

const resolver = new Resolver({
  // eslint-disable-next-line camelcase
  working_directory: path.resolve(__dirname, '../../'),
  // eslint-disable-next-line camelcase
  contracts_build_directory: 'build/contracts',
})

const ScryptRunner = resolver.require('ScryptRunner')
ScryptRunner.setProvider(parityProvider)
ScryptRunner.defaults({
  from: PARITY_DEV_ADDRESS,
  gas: 4000000,
})

async function scryptRunner () {
  await parity.personal.unlockAccount(PARITY_DEV_ADDRESS, '')

  const thisContract = parity.eth.contract(ScryptRunner.abi).new({
    data: ScryptRunner.bytecode,
    from: PARITY_DEV_ADDRESS,
    gas: 6000000,
  })

  // this forces the script to wait for the contract to actually be deployed
  // I'm not happy about this being necessary
  await ScryptRunner.new()

  return thisContract
}

module.exports = {
  scryptRunner: scryptRunner,
}
