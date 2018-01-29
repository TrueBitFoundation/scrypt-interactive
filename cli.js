require('dotenv').config()

const program = require('commander')
const selfText = require('./client/util/selfText')
const newStopper = require('./client/util/stopper')

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP_PROVIDER))

const operator = process.env.OPERATOR_ADDRESS || web3.eth.defaultAccount || web3.eth.coinbase

// web3.eth.defaultAccount = operator

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

const doThenExit = async (promise) => {
  try {
    await promise
    process.exit(0)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

const main = async () => {
  const cmd = { log: console.log.bind(console) }
  const bridge = await connectToBridge(cmd)

  const { stop, stopper } = newStopper()
  process.on('SIGINT', stop)

  program
    .version('0.0.1')
    .description(selfText)

  program
    .command('status')
    .description('Display the status of the bridge.')
    .action(async function () {
      const status = async () => {
        try {
          const deposited = await bridge.api.getDeposit(operator)

          console.log(`Deposited: ${web3.fromWei(deposited, 'ether')} ETH`)
        } catch (error) {
          console.log(`Unable to connect to bridge: ${error.stack}`)
        }
      }
      await doThenExit(status())
    })

  program
    .command('claim <blockheader> <hash>')
    .description('Claim a blockheader on the DogeRelay')
    .action(async function (blockheader, hash) {
      const claim = {
        claimant: operator,
        serializedBlockHeader: blockheader,
        scryptHash: hash,
      }

      await doThenExit(
        bridge.createClaim(cmd, claim)
      )
    })

  program
    .command('monitor')
    .description('Monitors the Doge-Eth bridge and validates blockheader claims.')
    .option('-c, --challenge', 'Challenge incorrect claims.')
    .option('-d, --deposit', `
      Automaticaly deposit ETH if we haven't deposited enough to challenge.
      Only applies when challenging (--challenge)
    `)
    .action(async function (options) {
      await doThenExit(bridge.monitorClaims(cmd,
        operator,
        stopper,
        !!options.challenge,
        !!options.deposit
      ))
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
