require('dotenv').config()
const vorpal = require('vorpal')()
const asDefault = require('vorpal-as-default')
const Web3 = require('web3')
const selfText = require('./src/utils/selfText')
const setup = require('./src/utils/setup')

// let's monekypatch web3 cause it doesn't play nice with truffle yet
Web3.providers.WebsocketProvider.prototype.sendAsync = Web3.providers.WebsocketProvider.prototype.send

// run the setup function to connect to bridge
const connect = async function (cmd) {
  cmd.log('Connecting to bridge...')
  const res = await setup()
  cmd.log('Connected!')
  return res
}

vorpal
  .command('describe', 'What is the Doge-Eth Bridge and how to you use it?')
  .action(async function (args) {
    this.log(selfText)
  })

vorpal
  .command('status', 'Display the status of the bridge.')
  .action(async function (args) {
    const { api, web3 } = await connect(this)

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
    const { bridge } = await connect(this)

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
