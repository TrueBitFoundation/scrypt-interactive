/*
This tests the client's functionality on the challenger side of things. Code is meant to simulate the claimant by proxy.
*/

require('dotenv').config()
const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP_PROVIDER))

require('../helpers/chai').should()
const getAllEvents = require('../helpers/events').getAllEvents

const ClaimManager = artifacts.require('ClaimManager')
const ScryptVerifier = artifacts.require('ScryptVerifier')
const DogeRelay = artifacts.require('DogeRelay')

// eslint-disable-next-line max-len
const serializedBlockHeader = '0x03000000c63abe4881f9c765925fffb15c88cdb861e86a32f4c493a36c3e29c54dc62cf45ba4401d07d6d760e3b84fb0b9222b855c3b7c04a174f17c6e7df07d472d0126fe455556358c011b6017f799'
const testScryptHash = '0x3569d4c55c658997830bce8f904bf4cb74e63cfcc8e1037a5fab030000000000'
const fakeTestScryptHash = '0x424242c55c658997830bce8f904bf4cb74e63cfcc8e1037a5fab030000000000'

const timeout = require('../helpers/timeout')
const models = require(__dirname + '/../../client/util/models')

describe('Challenger Client Integration Tests', function () {
  // set max timeout to 120 seconds
  this.timeout(120000)

  let bridge, claimant, challenger, dogeRelay, contracts
  let monitor, stopMonitor

  before(async () => {
    scryptVerifier = await ScryptVerifier.new()
    claimManager = await ClaimManager.new(scryptVerifier.address)
    scryptRunner = await require('../helpers/offchain').scryptRunner()
    dogeRelay = await DogeRelay.new(claimManager.address)

    contracts = {
      scryptVerifier: scryptVerifier,
      claimManager: claimManager,
      scryptRunner: scryptRunner,
      dogeRelay: dogeRelay
    }

    bridge = await require('../../client')(web3, contracts)
    let accounts = web3.eth.accounts
    claimant = accounts[1]
    challenger = accounts[2]
    otherClaimant = accounts[3]
    await bridge.api.claimManager.setDogeRelay(dogeRelay.address, {from: claimant})

    const stopper = new Promise((resolve) => stopMonitor = resolve)
    monitor = bridge.monitorClaims(console, challenger, stopper, true, true)
  })

  after(async () => {
    // teardown processes
    stopMonitor()
    await monitor
  })

  describe('Challenger reacting to valid proof of work', async () => {

    it('should let claimant make a deposit and create real claim', async () => {
      // early indicator if contract deployment is correct
      await bridge.api.makeDeposit({ from: claimant, value: 1 })

      let deposit = await bridge.api.getDeposit(claimant)
      deposit.should.be.bignumber.equal(1)

      await bridge.api.createClaim(
        serializedBlockHeader, 
        testScryptHash, 
        claimant, 
        'bar', 
        { from: claimant, value: 1 }
      )
    })

    //challenger sees proof of work is valid and does not challenge
    it('should be zero challengers', async () => {
      let result = await getAllEvents(bridge.api.claimManager, 'ClaimCreated')
      assert.equal(0, (await bridge.api.claimManager.getChallengers(result[0].args.claimID.toNumber())).length)
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
        otherClaimant,
        'bar', 
        { from: otherClaimant, value: 1 }
      )
    })

    it('should convict claimant', async () => {
      await timeout(3000)

      let verificationGameOngoing = true
      while(verificationGameOngoing) {
        await timeout(5000)
        const result = await getAllEvents(bridge.api.scryptVerifier, 'NewQuery')
        result.length.should.be.gt(0)

        let sessionId = result[0].args.sessionId.toNumber()
        let _claimant = result[0].args.claimant
        assert.equal(_claimant, otherClaimant)

        let session = await bridge.api.getSession(sessionId)
        let step = session.medStep.toNumber()
        let highStep = session.highStep.toNumber()
        let lowStep = session.lowStep.toNumber()
        console.log("low step: " + lowStep + " | high step: " + highStep)

        if (lowStep + 1 == highStep) {
          verificationGameOngoing = false
        } else {
          let results = await bridge.api.getResult(session.input, step)

          await bridge.api.respond(sessionId, step, results.stateHash, { from: otherClaimant })
        }
      }

      //verification game ends on last step
      await timeout(5000)

      assert.equal(0, (await getAllEvents(bridge.api.scryptVerifier, 'ChallengerConvicted')).length)

      let result = await getAllEvents(bridge.api.scryptVerifier, 'ClaimantConvicted')
      assert.equal(true, result.length > 0)
      assert.equal(otherClaimant, result[0].claimant)
    })
  })
})