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
    otherClaimant = web3.eth.accounts[3]
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

      await bridge.api.createClaim(
        serializedBlockHeader,
        scryptHash,
        'bar',
        { from: claimant }
      )
    })

    // challenger sees proof of work is valid and does not challenge
    it('should be zero challengers', async () => {
      let result = await getAllEvents(bridge.api.claimManager, 'ClaimCreated')
      assert.equal(0, (await bridge.api.claimManager.getChallengers(result[0].args.claimID /* .toNumber() */)).length)
    })
  })

  describe('challenger reacting to invalid proof of work', async () => {
    it('should let other claimant make a deposit and create fake claim', async () => {
      // early indicator if contract deployment is correct
      await bridge.api.makeDeposit({ from: otherClaimant, value: 1 })

      let deposit = await bridge.api.getDeposit(otherClaimant)
      deposit.should.be.bignumber.equal(1)

      await bridge.api.createClaim(
        serializedBlockHeader,
        fakeTestScryptHash,
        'foobar',
        { from: otherClaimant }
      )
      await miner.mineBlocks(10)
    })

    for (let i = 0; i < 12; i++) {
      it(`should query normal case medHash==0x0 step ${i}`, async () => {
        const result = await getAllEvents(bridge.api.scryptVerifier, 'NewQuery')
        result.length.should.be.gt(0)

        const sessionId = result[0].args.sessionId.toNumber()
        const _claimant = result[0].args.claimant
        assert.equal(_claimant, otherClaimant)

        let session = await bridge.api.getSession(sessionId)
        let step = session.medStep.toNumber()

        let results = await bridge.api.getResult(session.input, step)
        console.log(`[test] responding to query for session ${sessionId} step ${step} with ${results.stateHash}`)
        await bridge.api.respond(sessionId, step, results.stateHash, { from: otherClaimant })
        await miner.mineBlocks(3)
      })
    }

    it('should wait for the challenger to end the game', async () => {
      await miner.mineBlocks(2)
    })

    it('should have ended verification game', async () => {
      assert.equal(0, (await getAllEvents(bridge.api.scryptVerifier, 'ChallengerConvicted')).length)
      let result = await getAllEvents(bridge.api.scryptVerifier, 'ClaimantConvicted')
      assert.equal(true, result.length > 0)
      assert.equal(otherClaimant, result[0].args.claimant)
    })
  })
})
