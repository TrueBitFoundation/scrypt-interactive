/*
This tests the client's functionality on the challenger side of things. Code is meant to simulate the claimant by proxy.
*/

require('dotenv').config()
require('../helpers/chai').should()
web3.eth.defaultAccount = web3.eth.accounts[0]

const miner = require('../helpers/miner')(web3)
const getAllEvents = require('../helpers/events').getAllEvents
const getContracts = require('../../client/util/getContracts')

const {
  serializedBlockHeader,
  scryptHash,
  fakeTestScryptHash,
} = require('../helpers/blockheader')

describe('Challenger Client Integration Tests', function () {
  // set max timeout to 5 minutes
  this.timeout(300000)

  let bridge, claimant, challenger, otherClaimant
  let monitor, stopMonitor

  before(async () => {
    const contracts = await (await getContracts(web3)).deploy()
    bridge = await require('../../client')(web3, contracts)

    claimant = web3.eth.accounts[1]
    challenger = web3.eth.accounts[2]
  })

  after(async () => {
    // teardown processes
    stopMonitor()
    await monitor
  })

  describe('Challenger reacting to verification game', () => {
    it('should start monitoring claims', async () => {
      // eslint-disable-next-line
      const stopper = new Promise((resolve) => stopMonitor = resolve)
      await bridge.api.makeDeposit({ from: challenger, value: 2 })
      monitor = bridge.monitorClaims(console, challenger, stopper, true)
    })

    it('should let claimant make a deposit and create real claim', async () => {
      // early indicator if contract deployment is correct
      await bridge.api.makeDeposit({ from: claimant, value: 1 })

      let deposit = await bridge.api.getDeposit(claimant)
      deposit.should.be.bignumber.equal(1)

      const stopper = new Promise((resolve) => stopMonitor = resolve)

      const claim = {
        claimant: claimant,
        input: serializedBlockHeader,
        hash: scryptHash,
        proposalID: 'foobar',
      }

      bridge.submitClaim(console, claim, stopper)
    })

    it('should let claimant make a deposit and create real claim', async () => {
        // early indicator if contract deployment is correct
        await bridge.api.makeDeposit({ from: claimant, value: 1 })
  
        let deposit = await bridge.api.getDeposit(claimant)
        deposit.should.be.bignumber.equal(1)
  
        const stopper = new Promise((resolve) => stopMonitor = resolve)
  
        const claim = {
          claimant: claimant,
          input: serializedBlockHeader,
          hash: fakeTestScryptHash,
          proposalID: 'barbar',
        }
  
        bridge.submitClaim(console, claim, stopper)
      })
  })
})