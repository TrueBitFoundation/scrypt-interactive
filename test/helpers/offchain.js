const Web3 = require('web3')

const parityProvider = new Web3.providers.HttpProvider(process.env.WEB3_PARITY_PROVIDER)
const parity = new Web3(parityProvider)

const ScryptRunner = artifacts.require('ScryptRunner')
ScryptRunner.setProvider(parityProvider)

async function scryptRunner () {
  parity.personal.unlockAccount('0x00a329c0648769a73afac7f9381e08fb43dbea72', '')

  const thisContract = parity.eth.contract(ScryptRunner.abi).new({
    data: ScryptRunner.bytecode,
    from: '0x00a329c0648769a73afac7f9381e08fb43dbea72',
    gas: 4000000,
  })

  return thisContract
}

module.exports = {
  scryptRunner: scryptRunner,
}
