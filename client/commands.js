const makeDeposit = require('./primitives/deposit').makeDeposit

const doThenExit = (fn) => async (...args) => {
  try {
    await fn(...args)
    process.exit(0)
  } catch (error) {
    console.error(error.stack)
    process.exit(1)
  }
}

const status = async (cmd, bridge, operator, claimId) => {
  try {
    const deposited = await bridge.api.getDeposit(operator)
    const balance = await bridge.api.getBalance(operator)
    const minDeposit = await bridge.api.getMinDeposit()

    cmd.log(`I am: ${operator}`)
    cmd.log(`I have: ${bridge.api.web3.fromWei(balance, 'ether')} ETH`)
    cmd.log(`Deposited: ${bridge.api.web3.fromWei(deposited, 'ether')} ETH`)
    cmd.log(`minDeposit: ${bridge.api.web3.fromWei(minDeposit, 'ether')} ETH`)

    if (claimId) {
      const bondedAmount = await bridge.api.claimManager.getBondedDeposit(claimId, operator)

      cmd.log(`Bonded in Claim ${claimId}: ${bridge.api.web3.fromWei(bondedAmount, 'ether')} ETH`)
    }
  } catch (error) {
    cmd.log(`Unable to connect to bridge: ${error.stack}`)
  }
}

const deposit = async (cmd, bridge, operator, amount) => {
  try {
    await makeDeposit(
      cmd,
      bridge.api,
      operator,
      bridge.api.web3.toWei(amount, 'ether')
    )

    await status(cmd, bridge, operator)
  } catch (error) {
    cmd.log(`Unable to deposit to ClaimManager: ${error}`)
  }
}

const withdraw = async (cmd, bridge, operator, amount) => {
  try {
    const amountToWithdraw = amount === 'all'
      ? await bridge.api.getDeposit(operator)
      : bridge.api.web3.toWei(amount, 'ether')

    console.log(`Withdrawing ${bridge.api.web3.fromWei(amountToWithdraw, 'ether')} ETH...`)
    await bridge.api.withdrawDeposit(amountToWithdraw, { from: operator })
    await status(cmd, bridge, operator)
  } catch (error) {
    cmd.log(`Unable to withdraw from ClaimManager: ${error}`)
  }
}

const claim = async (cmd, bridge, operator, claim, stopper) => {
  await bridge.submitClaim(cmd, claim, stopper)
}

const resumeClaim = async (cmd, bridge, operator, proposalID) => {
  const claim = await bridge.api.getClaim(proposalID)
  await bridge.primitives.defend(cmd, bridge.api, claim)
}

const monitor = async (cmd, bridge, operator, autoChallenge = false, stopper) => {
  await bridge.monitorClaims(cmd,
    operator,
    stopper,
    autoChallenge
  )
}

module.exports = {
  status: doThenExit(status),
  deposit: doThenExit(deposit),
  withdraw: doThenExit(withdraw),
  claim: doThenExit(claim),
  resumeClaim: doThenExit(resumeClaim),
  monitor: doThenExit(monitor),
}
