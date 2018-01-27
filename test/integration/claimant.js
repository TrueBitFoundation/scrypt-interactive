/*
This tests the client's functionality on the claimant side of things. Code is meant to simulate the challenger by proxy.
*/

require('dotenv').config()
const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP_PROVIDER))

require('../helpers/chai').should()

const ClaimManager = artifacts.require('ClaimManager')
const ScryptVerifier = artifacts.require('ScryptVerifier')

const serializedBlockHeader = '030162002adb34dfa6574cf127a781ecb9683ca28f911a59020628c90c72b4a3d9942233a3b905b2388b020085dbd9e03209db4493f5420336d882d0b78b54f728b8f90058f7115a2c83221a00000000'
const testScryptHash = 'ce60a0d4a7c2223a94437d44fe4d33a30489436714d18376f9ebc5e2bd6e5682'

const timeout = require('../helpers/timeout')
const models = require('../../client/bridge-to-the-moon/util/models')

const calculateMidpoint = require(__dirname + '/../../client/bridge-to-the-moon/util/math').calculateMidpoint

describe('Challenger Client Integration Tests', function() {
  this.timeout(120000)//set max timeout to 120 seconds

  let bridge, claimant, challenger, dogeRelay
  let sessionId = null

  before(async () => {
    scryptVerifier = await ScryptVerifier.new()
    claimManager = await ClaimManager.new(scryptVerifier.address)
    scryptRunner = await require('../helpers/offchain').scryptRunner()

    contracts = {
      scryptVerifier: scryptVerifier,
      claimManager: claimManager,
      scryptRunner: scryptRunner
    }

    bridge = await require('../../client/bridge-to-the-moon')(web3, contracts)
    let accounts = web3.eth.accounts
    dogeRelay = accounts[0]
    claimant = accounts[1]
    challenger = accounts[2]
    await bridge.api.claimManager.setDogeRelay(dogeRelay, {from: dogeRelay})
  })

  after(async () => {
    // teardown processes
  })

  describe('claimant reacting to verification game', () => {
    it('should let claimant make a deposit', async () => {

      //early indicator if contract deployment is correct
      await bridge.api.makeDeposit({from: claimant, value: 1})
      await bridge.api.makeDeposit({from: challenger, value: 1})

      let deposit = await bridge.api.getDeposit(claimant)
      deposit.should.be.bignumber.equal(1)

      deposit = await bridge.api.getDeposit(challenger)
      deposit.should.be.bignumber.equal(1)
    })

    it('should create claim', async () => {
      const testClaim = {
        claimant: claimant,
        scryptHash: testScryptHash,
        serializedBlockHeader: serializedBlockHeader,
        dogeRelay: dogeRelay,
        proposalId: 'foobar'
      }
      bridge.createClaim(console, testClaim)
    })

    it('should challenge claim and send initial query', async () => {
      await timeout(1000)
      let claimID = (await bridge.api.claimManager.claimantClaims(claimant)).toNumber()

      await bridge.api.challengeClaim(claimID, {from: challenger})

      await bridge.api.claimManager.runNextVerificationGame(claimID, {from: challenger})

      sessionId = (await bridge.api.claimManager.getSession.call(claimID, challenger)).toNumber()

      let medStep = 1025;
      await bridge.api.query(sessionId, medStep, {from: challenger})

    })

    it('should respond to query normal case', async () => {
      assert.notEqual(sessionId, null)

      await timeout(5000)

      for(i = 0; i < 11; i++) {
        bridge.api.scryptVerifier.NewResponse({}, { fromBlock: 0, toBlock: 'latest' }).get(async (err, result) => {
          let sessionId = result[0].args.sessionId.toNumber()
          let _challenger = result[0].args.challenger
          assert.equal(_challenger, challenger)
  
          let session = await bridge.api.getSession(sessionId)
          let step = session.medStep.toNumber()
          let highStep = session.highStep.toNumber()
          let lowStep = session.lowStep.toNumber()

          let medStep = calculateMidpoint(session.lowStep.toNumber(), session.medStep.toNumber())
          await bridge.api.query(sessionId, medStep, {from: challenger})
        })
        await timeout(5000)
      }
    })
  })
})