/*
This tests the client's functionality on the challenger side of things. Code is meant to simulate the claimant by proxy.
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

describe('Challenger Client Integration Tests', function() {
  // set max timeout to 60 seconds
  this.timeout(60000)

  let bridge, claimant, challenger, dogeRelay

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

  describe('Challenger reacting to verificaiton game', () => {
    it('should let claimant make a deposit and check scrypt', async () => {

      //early indicator if contract deployment is correct
      await bridge.api.makeDeposit({from: claimant, value: 1})

      let deposit = await bridge.api.getDeposit(claimant)
      deposit.should.be.bignumber.equal(1)

      await bridge.api.claimManager.checkScrypt(serializedBlockHeader, testScryptHash, claimant, 'bar', { from: dogeRelay, value: 1 })
    })

    it('should start monitoring claims', async () => {
      bridge.monitorClaims(console, challenger, true, true)
    })

    it('should query to normal case medHash==0x0', async () => {

      await timeout(1000)

      for(i = 0; i < 11; i++) {
        bridge.api.scryptVerifier.NewQuery({}, { fromBlock: 0, toBlock: 'latest' }).get(async (err, result) => {
          let sessionId = result[0].args.sessionId.toNumber()
          let _claimant = result[0].args.claimant
          assert.equal(_claimant, claimant)
  
          let session = await bridge.api.getSession(sessionId)
          let step = session.medStep.toNumber()
          let highStep = session.highStep.toNumber()
          let lowStep = session.lowStep.toNumber()
  
          let results = models.toResult(await bridge.api.getStateProofAndHash(session.input, step))
  
          await bridge.api.respond(sessionId, step, results.stateHash, {from: claimant})
        })
        await timeout(5000)
      }
    })

    it('should query special case medHash!=0x0', async () => {
      bridge.api.scryptVerifier.NewQuery({}, { fromBlock: 0, toBlock: 'latest' }).get(async (err, result) => {
        let sessionId = result[0].args.sessionId.toNumber()
        let _claimant = result[0].args.claimant
        assert.equal(_claimant, claimant)

        let session = await bridge.api.getSession(sessionId)
        let step = session.medStep.toNumber()
        let highStep = session.highStep.toNumber()
        let lowStep = session.lowStep.toNumber()

        let preState = models.toResult(await bridge.api.getStateProofAndHash(session.input, lowStep)).state
        let postStateAndProof = models.toResult(await bridge.api.getStateProofAndHash(session.input, highStep))
        let postState = postStateAndProof.state
        let proof = postStateAndProof.proof || '0x00'

        let claimID = (await bridge.api.claimManager.claimantClaims(claimant)).toNumber()

        await bridge.api.scryptVerifier.performStepVerification(sessionId, claimID, preState, postState, proof, bridge.api.claimManager.address, { from: claimant, gas: 3000000 })
      })
    })

    it('should end verification game', async () => {
      await(5000)
      bridge.api.scryptVerifier.ClaimantConvicted({}, { fromBlock: 0, toBlock: 'latest' }).get(async (err, result) => {
        console.log(result)
      })
      bridge.api.scryptVerifier.ChallengerConvicted({}, { fromBlock: 0, toBlock: 'latest' }).get(async (err, result) => {
        console.log(result)
      })
    })
  })
})
