
const isDepositEnough = require('./deposit').isDepositEnough;

// should submit challenge; and play full game.
module.exports = async (api, claim, challenger) => {
  // @TODO: only challenge if 'who' has not already challenged the claim.
  
  if (!isDepositEnough(api, challenger)) {
    throw new Error(`
      Your deposited ETH in ClaimManager is lower than minDeposit.`
    )
  }

  // bonds deposit
  await api.challengeClaim(claim.claimID, {from: challenger})
}
