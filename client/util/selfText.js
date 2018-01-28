/* eslint-disable max-len */

module.exports = `
  The Doge-Eth Bridge facilitates transfer of value from Dogecoin to Ethereum.

  This software is the off-chain client that interfaces with both the Dogecoin blockchain (when acting as a block submitter) and the Ethereum smart contracts (when acting as verifier and, optionally, challenger).

  To monitor the doge block header claims, run 'monitor', either from the command line or the repl.

  To automatically challenge invalid headers, use 'monitor --challenge'.
  Challenging involves staking ETH and executing a verification game against the claimant.

  For more information about challenging, see https://truebit.io
`
