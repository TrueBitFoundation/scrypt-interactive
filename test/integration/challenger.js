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
} = require('../helpers/blockheader')

describe('Challenger Client Integration Tests', function () {
  // set max timeout to 120 seconds
  this.timeout(120000)

  let bridge, claimant, challenger
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

  describe('Challenger reacting to verificaiton game', () => {
    it('should start monitoring claims', async () => {
      // eslint-disable-next-line
      const stopper = new Promise((resolve) => stopMonitor = resolve)
      monitor = bridge.monitorClaims(console, challenger, stopper, true, true)
    })

    it('should let claimant make a deposit and check scrypt', async () => {
      await bridge.api.createClaim(
        serializedBlockHeader,
        scryptHash,
        claimant,
        'bar',
        { from: claimant, value: 1 }
      )
      await miner.mineBlocks(4)
    })

    for (let i = 0; i < 11; i++) {
      it(`should query to normal case medHash==0x0 step ${i}`, async () => {
        const result = await getAllEvents(bridge.api.scryptVerifier, 'NewQuery')
        result.length.should.be.gt(0)

        let sessionId = result[0].args.sessionId.toNumber()
        let _claimant = result[0].args.claimant
        assert.equal(_claimant, claimant)

        let session = await bridge.api.getSession(sessionId)
        let step = session.medStep.toNumber()
        // let highStep = session.highStep.toNumber()
        // let lowStep = session.lowStep.toNumber()

        let results = await bridge.api.getResult(session.input, step)

        await bridge.api.respond(sessionId, step, results.stateHash, { from: claimant })
        await miner.mineBlocks(4)
      })
    }

    it('should query special case medHash!=0x0', async () => {
      const result = await getAllEvents(bridge.api.scryptVerifier, 'NewQuery')

      result.length.should.be.gt(0)

      let sessionId = result[0].args.sessionId.toNumber()
      let _claimant = result[0].args.claimant
      _claimant.should.equal(claimant)

      let session = await bridge.api.getSession(sessionId)
      // let step = session.medStep.toNumber()
      let highStep = session.highStep.toNumber()
      let lowStep = session.lowStep.toNumber()

      let preState = (await bridge.api.getResult(session.input, lowStep)).state

      let postStateAndProof = await bridge.api.getResult(session.input, highStep)

      let postState = postStateAndProof.state
      let proof = postStateAndProof.proof || '0x00'

      let claimID = (await bridge.api.claimManager.claimantClaims(claimant)).toNumber()

      await bridge.api.scryptVerifier.performStepVerification(
        sessionId,
        claimID,
        preState,
        postState,
        proof,
        bridge.api.claimManager.address,
        { from: claimant, gas: 3000000 }
      )
    })

    it('should end verification game', async () => {
      console.log(await getAllEvents(bridge.api.scryptVerifier, 'ClaimantConvicted'))
      console.log(await getAllEvents(bridge.api.scryptVerifier, 'ChallengerConvicted'))
    })
  })
})
