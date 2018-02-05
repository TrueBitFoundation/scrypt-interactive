require('dotenv').config()

const promisify = require('es6-promisify')
const program = require('commander')
const selfText = require('./client/util/selfText')
const newStopper = require('./client/util/stopper')
const commands = require('./client/commands')

const Web3 = require('web3')
const HDWalletProvider = require('truffle-hdwallet-provider')
const provider = process.env.USE_LOCAL_SIGNER === 'true'
  ? new HDWalletProvider(
    process.env.MNEMONIC,
    process.env.WEB3_HTTP_PROVIDER
  )
  : new Web3.providers.HttpProvider(process.env.WEB3_HTTP_PROVIDER)
const web3 = new Web3(provider)

const getDefaultAddress = promisify(web3.eth.getDefaultAddress, web3.eth)
const getCoinbase = promisify(web3.eth.getCoinbase, web3.eth)

// sets up bridge
const connectToBridge = async function (cmd) {
  if (this.bridge) {
    return this.bridge
  }

  cmd.log('Connecting to bridge...')
  this.bridge = await require('./client')(web3)
  cmd.log('Connected!')

  return this.bridge
}

const main = async () => {
  const cmd = { log: console.log.bind(console) }
  const operator = process.env.OPERATOR_ADDRESS || (await getDefaultAddress()) || (await getCoinbase())

  web3.eth.defaultAccount = operator

  const bridge = await connectToBridge(cmd)

  const { stop, stopper } = newStopper()
  process.on('SIGINT', stop)

  program
    .version('0.0.1')
    .description(selfText)

  program
    .command('status [claimId]')
    .description('Display the status of the bridge.')
    .action(async function (claimId) {
      await commands.status(cmd, bridge, operator, claimId)
    })

  program
    .command('deposit <amount>')
    .description('Deposit <amount> into ClaimManager')
    .action(async function (amount) {
      await commands.deposit(cmd, bridge, operator, amount)
    })

  program
    .command('withdraw <amount>')
    .description('Withdraw <amount> from ClaimManager. <amount> can be "all"')
    .action(async function (amount) {
      await commands.withdraw(cmd, bridge, operator, amount)
    })

  program
    .command('resume-claim <proposal-id>')
    .description('Resume defending a blockheader on the DogeRelay')
    .action(async function (proposalID, options) {
      await commands.resumeClaim(cmd, bridge, operator, proposalID)
    })

  program
    .command('claim <blockheader> <hash> <proposal-id>')
    .description('Claim a blockheader on the DogeRelay')
    .action(async function (blockheader, hash, proposalID, options) {
      const claim = {
        claimant: operator,
        input: blockheader,
        hash: hash,
        proposalID: proposalID,
      }

      await commands.claim(cmd, bridge, operator, claim, stopper)
    })

  program
    .command('monitor')
    .description('Monitors the Doge-Eth bridge and validates blockheader claims.')
    .option('-c, --auto-challenge', 'Automatically challenge incorrect claims.')
    .action(async function (options) {
      await commands.monitor(
        cmd,
        bridge,
        operator,
        true,
        stopper
      )
    })

  program.parse(process.argv)
}

process.on('unhandledRejection', (error, p) => {
  console.error('Unhandled Rejection at:', p, 'error:', error)
})

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
