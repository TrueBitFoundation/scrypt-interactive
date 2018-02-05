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
  let claimID1, claimID2
  let sessionId = null
  let stopSubmitting, submit
  let claimManager
  let stopSubmitting1, submit1
  let stopSubmitting2, submit2

  before(async () => {
    const contracts = await (await getContracts(web3)).deploy()
    bridge = await require('../../client')(web3, contracts)

    claimManager = contracts.claimManager

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

    it('should check if claim was successful', async () => {
        await miner.mineBlocks(40)

        result = await getAllEvents(claimManager, 'ClaimSuccessful')
        result[0].args.claimID.should.be.bignumber.eq(claimID)
    })

  })
})