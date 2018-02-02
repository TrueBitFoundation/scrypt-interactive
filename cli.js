require('dotenv').config()

const program = require('commander')
const selfText = require('./client/util/selfText')
const newStopper = require('./client/util/stopper')
const makeDeposit = require('./client/claimManager/deposit').makeDeposit

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

const status = async (cmd, bridge) => {
  try {
    const deposited = await bridge.api.getDeposit(operator)
    const balance = await web3.eth.getBalance(operator)
    const minDeposit = await bridge.api.getMinDeposit()

    cmd.log(`I am: ${operator}`)
    cmd.log(`I have: ${web3.fromWei(balance, 'ether')} ETH`)
    cmd.log(`Deposited: ${web3.fromWei(deposited, 'ether')} ETH`)
    cmd.log(`minDeposit: ${web3.fromWei(minDeposit, 'ether')} ETH`)
  } catch (error) {
    cmd.log(`Unable to connect to bridge: ${error.stack}`)
  }
}

const deposit = async (cmd, bridge, amount) => {
  try {
    await makeDeposit(
      cmd,
      bridge.api,
      operator,
      web3.toWei(amount, 'ether')
    )

    await status(cmd, bridge)
  } catch (error) {
    cmd.log(`Unable to deposit to ClaimManager: ${error.stack}`)
  }
}

const doThenExit = async (promise) => {
  try {
    await promise
    process.exit(0)
  } catch (error) {
    console.error(error.stack)
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
      await doThenExit(status(cmd, bridge))
    })

  program
    .command('deposit <amount>')
    .description('Deposit <amount> into ClaimManager')
    .action(async function (amount) {
      await doThenExit(deposit(cmd, bridge, amount))
    })

  program
    .command('resume-claim <proposal-id>')
    .description('Resume defending a blockheader on the DogeRelay')
    .action(async function (proposalID, options) {
      const claim = await bridge.api.getClaim(proposalID)

      await doThenExit(
        bridge.claimManager.defend(cmd, bridge.api, claim)
      )
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

      await doThenExit(
        bridge.submitClaim(cmd, claim, stopper)
      )
    })

  program
    .command('monitor')
    .description('Monitors the Doge-Eth bridge and validates blockheader claims.')
    .option('-c, --auto-challenge', 'Automatically challenge incorrect claims.')
    .action(async function (options) {
      await doThenExit(bridge.monitorClaims(cmd,
        operator,
        stopper,
        !!options.autoChallenge
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
