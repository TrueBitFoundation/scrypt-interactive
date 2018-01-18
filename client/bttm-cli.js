require('dotenv').config()
const vorpal = require('vorpal')()
const asDefault = require('vorpal-as-default')
const Web3 = require('web3')
const selfText = require('./bridge-to-the-moon/util/selfText')
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"))

//sets up bridge
const connectToBridge = async function (cmd) {

  //TODO: FIX TO BE RUN WITH PLAIN NODE NOT TRUFFLE
  const offchain = require('../test/helpers/offchain')
  const ClaimManager = artifacts.require('ClaimManager')
  const ScryptVerifier = artifacts.require('ScryptVerifier')

  const [
    dogeRelayAddress,
    claimant,
    challenger,
  ] = web3.eth.accounts

  let scryptVerifier = await ScryptVerifier.new()
  let claimManager = await ClaimManager.new(dogeRelayAddress, scryptVerifier.address)

  //Don't need to change
  cmd.log('Connecting to bridge...')
  const scryptRunner = await offchain.scryptRunner();
  const bridge = await require('./bridge-to-the-moon')(claimManager, scryptVerifier, scryptRunner, web3)
  cmd.log('Connected!')
  return bridge
}

vorpal
  .command('describe', 'What is the Doge-Eth Bridge and how to you use it?')
  .action(async function (args) {
    this.log(selfText)
  })

vorpal
  .command('status', 'Display the status of the bridge.')
  .action(async function (args) {
    const { api, web3 } = await connectToBridge(this)

    try {
      const deposited = await api.getDeposit(web3.eth.defaultAccount)

      this.log(`Deposited: ${web3.fromWei(deposited, 'ether')} ETH`)
    } catch (error) {
      this.log(`Unable to connect to bridge: ${error.stack}`)
    }
  })

vorpal
  .command('monitor', 'Monitors the Doge-Eth bridge and validates blockheader claims.')
  .option('-c, --challenge', 'Challenge incorrect claims.')
  .option('-d, --deposit', `
    Automaticaly deposit ETH if we haven't deposited enough to challenge.
    Only applies when challenging (--challenge)
  `)
  .action(async function (args) {
    const { bridge } = await connectToBridge(this)

    await bridge.monitor(this,
      !!args.options.challenge,
      !!args.options.deposit
    )
  })

vorpal
  .delimiter('bttm$')
  .show()
  .parse(process.argv)
  .use(asDefault, 'describe')

process.on('unhandledRejection', (error, p) => {
  vorpal.log('Unhandled Rejection at:', p, 'error:', error)
})
