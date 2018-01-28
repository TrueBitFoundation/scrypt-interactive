
module.exports = async (cmd, api, claim, autoDeposit = false) => {
  const minDeposit = await api.getMinDeposit()
  const currentDeposit = await api.getDeposit(claim.claimant)

  let value = 0
  if (currentDeposit.lt(minDeposit)) {
    cmd.log('Not enough ETH deposited.')
    // if we don't have enough deposit, either add some or throw
    // let's just add exactly the right amount for now
    if (autoDeposit) {
      const neededAmount = minDeposit.sub(currentDeposit)
      const myBalance = await api.getBalance(claim.claimant)
      if (!myBalance.gte(neededAmount)) {
        throw new Error(`
          You don't have enough ETH to submit a deposit that would be greater than minDeposit.
        `)
      }

      value = neededAmount
      cmd.log(`Depositing ${api.web3.fromWei(neededAmount, 'ether')} ETH along with claim.`)
    } else {
      throw new Error(`
        Your deposited ETH in ClaimManager is lower than minDeposit and autoDeposit was not enabled.`
      )
    }
  }

  try {
    await api.createClaim(
      claim.input,
      claim.hash,
      claim.claimant,
      claim.proposalID,
      { from: claim.claimant, value }
    )
  } catch (error) {
    throw new Error(`Could not createClaim ${claim.proposalID} from ${claim.claimant}

      ${error.stack}
    `)
  }

  // update values in the db
  claim.claimID = (await api.claimManager.claimantClaims(claim.claimant)).toNumber()
  claim.createdAt = (await api.claimManager.createdAt.call(claim.claimID)).toNumber()
  await claim.save()
}
