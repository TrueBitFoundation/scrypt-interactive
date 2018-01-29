/*
This tests the client's functionality on the claimant side of things. Code is meant to simulate the challenger by proxy.
*/

require('dotenv').config()

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP_PROVIDER))

require('../helpers/chai').should()
const getAllEvents = require('../helpers/events').getAllEvents

const ClaimManager = artifacts.require('ClaimManager')
const ScryptVerifier = artifacts.require('ScryptVerifier')
const DogeRelay = artifacts.require('DogeRelay')

const Claim = require('../../client/db/models').Claim;

// eslint-disable-next-line max-len

const serializedBlockHeader = '0x03000000c63abe4881f9c765925fffb15c88cdb861e86a32f4c493a36c3e29c54dc62cf45ba4401d07d6d760e3b84fb0b9222b855c3b7c04a174f17c6e7df07d472d0126fe455556358c011b6017f799'
const testScryptHash = '0x3569d4c55c658997830bce8f904bf4cb74e63cfcc8e1037a5fab030000000000'

const timeout = require('../helpers/timeout')

const calculateMidpoint = require('../../client/util/math').calculateMidpoint

describe('Claimant Client Integration Tests', function () {
  this.timeout(120000)// set max timeout to 120 seconds

  let bridge, claimant, challenger, dogeRelay, contracts, claim
  let sessionId = null

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
    
    await bridge.api.claimManager.setDogeRelay(dogeRelay.address, {from: claimant})
  })

  after(async () => {
    console.log('waiting on createClaim to resolve...')
  })

  describe('claimant reacting to verification game', () => {
    it('should let claimant make a deposit', async () => {
      // early indicator if contract deployment is correct
      await bridge.api.makeDeposit({ from: claimant, value: 1 })
      await bridge.api.makeDeposit({ from: challenger, value: 1 })

      let deposit = await bridge.api.getDeposit(claimant)
      deposit.should.be.bignumber.equal(1)

      deposit = await bridge.api.getDeposit(challenger)
      deposit.should.be.bignumber.equal(1)
    })

    it('should create claim', async () => {
      let claim;
      
      await Claim.create({
        claimant: claimant,
        input: serializedBlockHeader,
        hash: testScryptHash,
        proposalID: 'foobar'
      }).then((result) => claim = result)
      
      // const testClaim = {
      //   claimant: claimant,
      //   scryptHash: testScryptHash,
      //   serializedBlockHeader: serializedBlockHeader,
      //   dogeRelay: dogeRelay.address,
      //   proposalId: 'foobar'
      // }
      bridge.createClaim(console, claim)
    })

    it('should challenge claim and send initial query', async () => {
      await timeout(1000)
      let claimID = (await bridge.api.claimManager.claimantClaims(claimant)).toNumber()

      await bridge.api.challengeClaim(claimID, { from: challenger })

      await bridge.api.claimManager.runNextVerificationGame(claimID, { from: challenger })

      sessionId = (await bridge.api.claimManager.getSession.call(claimID, challenger)).toNumber()

      // Fire off initial query
      let medStep = 1025
      await bridge.api.query(sessionId, medStep, { from: challenger })
    })

    it('should respond to query normal case', async () => {
      assert.notEqual(sessionId, null)

      await timeout(2000)

      await new Promise(async (resolve, reject) => {
        for (let i = 0; i < 11; i++) {
          await timeout(4000)
          const result = await getAllEvents(bridge.api.scryptVerifier, 'NewResponse')
  
          result.length.should.be.gt(0)
  
          let sessionId = result[0].args.sessionId.toNumber()
          let _challenger = result[0].args.challenger
          assert.equal(_challenger, challenger)
  
          let session = await bridge.api.getSession(sessionId)
          // let step = session.medStep.toNumber()
          // let highStep = session.highStep.toNumber()
          // let lowStep = session.lowStep.toNumber()
  
          let medStep = calculateMidpoint(session.lowStep.toNumber(), session.medStep.toNumber())
          console.log("Querying: " + medStep)
          await bridge.api.query(sessionId, medStep, { from: challenger })
        }
        resolve()
      })

      await timeout(3000)
    })

    it('should wait for timeout and finish claim', async () => {
      await new Promise(async (resolve, reject) => {
        for(i = 0; i<20; i++) {
          web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0})
        }
        resolve()
      })

      console.log("Finished mining blocks")
    })
  })
})
