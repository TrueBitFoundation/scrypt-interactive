/*
This tests the client's functionality on the claimant side of things. Code is meant to simulate the challenger by proxy.
*/

require('dotenv').config()
require('../helpers/chai').should()
web3.eth.defaultAccount = web3.eth.accounts[0]

const miner = require('../helpers/miner')(web3)
const newStopper = require('../../client/util/stopper')
const getAllEvents = require('../helpers/events').getAllEvents
const getContracts = require('../../client/util/getContracts')
const calculateMidpoint = require('../../client/util/math').calculateMidpoint
const timeout = require('../helpers/timeout')

const {
  serializedBlockHeader,
  scryptHash,
} = require('../helpers/blockheader')

describe('Claimant Client Integration Tests', function () {
  // set max timeout to 120 seconds
  this.timeout(120000)

  let bridge, claimant, challenger, claimID
  let sessionId = null
  let stopSubmitting, submit

  before(async () => {
    const contracts = await (await getContracts(web3)).deploy()
    bridge = await require('../../client')(web3, contracts)

    claimant = web3.eth.accounts[1]
    challenger = web3.eth.accounts[2]
  })

  after(async () => {
    console.log('closing submission...')
    stopSubmitting()
    await submit
    console.log('submission closed.')
  })

  describe('claimant reacting to verification game', () => {
    it('should let claimant make a deposit', async () => {
      await bridge.api.makeDeposit({ from: claimant, value: 1 })
      await bridge.api.makeDeposit({ from: challenger, value: 1 })

      let deposit = await bridge.api.getDeposit(claimant)
      deposit.should.be.bignumber.gte(1)

      deposit = await bridge.api.getDeposit(challenger)
      deposit.should.be.bignumber.gte(1)
    })

    it('should create claim', async () => {
      const claim = {
        claimant: claimant,
        input: serializedBlockHeader,
        hash: scryptHash,
        proposalID: 'foobar',
      }

      const { stop, stopper } = newStopper()
      stopSubmitting = stop
      submit = bridge.submitClaim(console, claim, stopper)

      claimID = (await bridge.api.claimManager.calcId.call(claim.input, claim.hash, claim.claimant, claim.proposalID)).toString()
      
    })

    it('should challenge claim and send initial query', async () => {
      await timeout(5000)

      await miner.mineBlocks(4)

      await bridge.api.challengeClaim(claimID, { from: challenger })

      await bridge.api.claimManager.runNextVerificationGame(claimID, { from: challenger })

      sessionId = (await bridge.api.claimManager.getSession.call(claimID, challenger)).toNumber()

      // Fire off initial query
      let medStep = 1025
      await bridge.api.query(sessionId, medStep, { from: challenger })
      await miner.mineBlocks(4)
    })

    for (let i = 0; i < 11; i++) {
      it(`should respond to query normal case step ${i}`, async () => {
        const result = await getAllEvents(bridge.api.scryptVerifier, 'NewResponse')

        result.length
          .should.be.gt(0)

        const sessionId = result[0].args.sessionId.toNumber()
        result[0].args.challenger
          .should.eq(challenger)

        const session = await bridge.api.getSession(sessionId)
        // let step = session.medStep.toNumber()
        // let highStep = session.highStep.toNumber()
        // let lowStep = session.lowStep.toNumber()

        let medStep = calculateMidpoint(session.lowStep.toNumber(), session.medStep.toNumber())
        console.log('Querying: ' + medStep)
        await bridge.api.query(sessionId, medStep, { from: challenger })
        await miner.mineBlocks(4)
      })
    }
  })
})
