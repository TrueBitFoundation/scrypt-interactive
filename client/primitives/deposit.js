
// @dev – check whether the user has enough deposit
// to submit or challenge a claim.
// @param api – the api for the deployed contracts.
// @param who – the account's address
// @return – boolean.
const isDepositEnough = async (api, who) => {
  const requiredDeposit = await api.getMinDeposit()
  const currentDeposit = await api.getDeposit(who)

  return currentDeposit.gte(requiredDeposit)
}

// @dev – make a deposit for the account.
// @param api – the api for the deployed contracts.
// @param who – the account's address.
// @param amount – amount to deposit in wei.
const makeDeposit = async (cmd, api, who, amount) => {
  const myBalance = await api.getBalance(who)

  if (myBalance.lt(amount)) {
    throw new Error(`You do not have enough ETH to make a deposit of ${amount}.`)
  }

  cmd.log(`Depositing ${api.web3.fromWei(amount, 'ether')} ETH.`)
  await api.makeDeposit({ from: who, value: amount })
}

module.exports = {
  isDepositEnough,
  makeDeposit,
}
