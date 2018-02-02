require('dotenv').config()
require('./helpers/chai').should()
web3.eth.defaultAccount = web3.eth.accounts[0]

const miner = require('./helpers/miner')(web3)
const dataFormatter = require('./helpers/dataFormatter')
const getContracts = require('../client/util/getContracts')
const getAllEvents = require('./helpers/events').getAllEvents

const {
  serializedBlockHeader,
  scryptHash,
} = require('./helpers/blockheader')

describe('ClaimManager', function () {
  this.timeout(120000)

  let claimant, challenger
  let claimManager,
    scryptVerifier,
    scryptRunner,
    dogeRelay
  let claimID, sessionId, claimDeposit
  let tx, session, log, deposit

  context('normal conditions', function () {
    before(async () => {
      const c = await (await getContracts(web3)).deploy()
      claimManager = c.claimManager
      scryptVerifier = c.scryptVerifier
      scryptRunner = c.scryptRunner
      dogeRelay = c.dogeRelay

      claimDeposit = (await claimManager.minDeposit()).toNumber()

      claimant = web3.eth.accounts[1]
      challenger = web3.eth.accounts[2]
    })

    it('claimant checks scrypt, after implicitly making a deposit', async () => {
        
      tx = await dogeRelay.verifyScrypt(serializedBlockHeader, scryptHash, claimant, 'bar', { from: claimant, value: claimDeposit })

      const results = await getAllEvents(claimManager, 'ClaimCreated')
      results.length.should.be.gt(0)

      claimID = results[0].args.claimID /* .toNumber() */

      deposit = await claimManager.getBondedDeposit.call(claimID, claimant, { from: claimant })
      
      assert.equal(deposit.toNumber(), claimDeposit)
    })

    it('challenger challenges', async () => {
      await claimManager.makeDeposit({ from: challenger, value: claimDeposit })

      tx = await claimManager.challengeClaim(claimID, { from: challenger })
      // check that the challenger's deposits were bonded.
      deposit = await claimManager.getBondedDeposit.call(claimID, challenger, { from: challenger })
      deposit.should.be.bignumber.gte(claimDeposit)
    })

    it('begins verification game', async () => {
      tx = await claimManager.runNextVerificationGame(claimID, { from: claimant })
      log = tx.logs.find(l => l.event === 'VerificationGameStarted')
      assert.equal(log.args.claimID.toString(), claimID.toString())
      assert.equal(log.args.claimant, claimant)
      assert.equal(log.args.challenger, challenger)
      sessionId = await claimManager.getSession.call(claimID, challenger)
    })

    // Need to throw some asserts in here lol >:D
    // Might need more verification steps
    it('participates in verification game', async () => {
      // First challenge
      // Each call to query sets the new medstep
      // Intial high step is currently 2050 (assuming this is the final number of steps)
      tx = await scryptVerifier.query(sessionId, 1, { from: challenger })
      session = dataFormatter.newSession(await scryptVerifier.getSession.call(sessionId))
      // console.log("Session after first query: \n", session, "\n")

      // claimant responds to first query.
      let results = dataFormatter.newResult(await scryptRunner.getStateProofAndHash.call(session.input, session.medStep))
      tx = await scryptVerifier.respond(sessionId, session.medStep, results.stateHash, { from: claimant })
      session = dataFormatter.newSession(await scryptVerifier.getSession.call(sessionId))
      // console.log("Session after first response: \n", session, "\n")
      results = dataFormatter.newResult(await scryptRunner.getStateProofAndHash.call(session.input, session.medStep))
      // console.log("Results after first response: \n", session, "\n")
      // second query from the challenger.
      tx = await scryptVerifier.query(sessionId, 0, { from: challenger })
    })

    it('finalizes verification game', async () => {
      session = dataFormatter.newSession(await scryptVerifier.getSession.call(sessionId))
      // console.log("Session after second query: \n", session, "\n")

      var preState = dataFormatter.newResult(await scryptRunner.getStateProofAndHash.call(session.input, session.lowStep)).state
      var postStateAndProof = dataFormatter.newResult(await scryptRunner.getStateProofAndHash.call(session.input, session.highStep))
      var postState = postStateAndProof.state
      var proof = postStateAndProof.proof || '0x00'
      // console.log("... using\n   PreState:  ".yellow + preState + "\n   PostState: ".yellow + postState + "\n   Proof:    ".yellow + proof + "\n")

      // the final call for the verification game
      // can only happen when lowStep + 1 == highStep (typically lowStep = 0, highStep = 1)
      tx = await scryptVerifier.performStepVerification(sessionId, claimID, preState, postState, proof, claimManager.address, { from: claimant, gas: 3000000 })

      log = tx.logs.find(l => l.event === 'ChallengerConvicted')
      assert.equal(log.args.sessionId.toNumber(), sessionId)
      log = tx.logs.find(l => l.event === 'ClaimantConvicted')
      assert.equal(log, undefined)

      const result = await getAllEvents(claimManager, 'SessionDecided')
      result[0].args.sessionId.should.be.bignumber.eq(sessionId)
      result[0].args.winner.should.be.bignumber.eq(claimant)
      result[0].args.loser.should.be.bignumber.eq(challenger)
    })

    it('waits for timeout of block number when claim is decided', async () => {
      await miner.mineBlocks(21)

      // trigger claim decided
      await claimManager.runNextVerificationGame(claimID, { from: claimant })

      const isReady = await claimManager.getClaimReady.call(claimID)
      isReady.should.eq(true)

      const result = await getAllEvents(claimManager, 'ClaimVerificationGamesEnded')
      result[0].args.claimID.should.be.bignumber.eq(claimID)
    })

    it('should check if claim successful', async () => {
      await claimManager.checkClaimSuccessful(claimID, { from: claimant })

      const result = await getAllEvents(claimManager, 'ClaimSuccessful')
      result[0].args.claimID.should.be.bignumber.eq(claimID)
    })

    it('checks claimant refunded deposit', async () => {
      deposit = await claimManager.getDeposit.call(claimant, { from: claimant })
      deposit.should.be.bignumber.eq(2 * claimDeposit)
    })

    it('checks challenger bonded deposits', async () => {
      // check that the loser's deposits were transferred to the winner.
      deposit = await claimManager.getBondedDeposit.call(claimID, challenger, { from: challenger })
      deposit.should.be.bignumber.eq(0)
    })

    it('checks challenger unbond deposits', async () => {
      await claimManager.unbondDeposit(claimID, challenger, { from: challenger })
      deposit = await claimManager.getDeposit.call(challenger, { from: challenger })
      deposit.should.be.bignumber.eq(0)
    })

    it('claimant makes another claim and is not challenged', async () => {
      tx = await dogeRelay.verifyScrypt(serializedBlockHeader, scryptHash, claimant, 'foobar', { from: claimant, value: claimDeposit })

      const results = await getAllEvents(claimManager, 'ClaimCreated')
      results.length.should.be.gt(1)

      claimID = results[1].args.claimID // .toNumber()

      await miner.mineBlocks(21)

      // trigger claim decided
      await claimManager.runNextVerificationGame(claimID, { from: claimant })

      let result = await getAllEvents(claimManager, 'ClaimVerificationGamesEnded')
      result[1].args.claimID.should.be.bignumber.eq(claimID)

      const isReady = await claimManager.getClaimReady.call(claimID)
      isReady.should.eq(true)

      await claimManager.checkClaimSuccessful(claimID, { from: claimant })

      result = await getAllEvents(claimManager, 'ClaimSuccessful')
      result[1].args.claimID.should.be.bignumber.eq(claimID)
    })
  })
})
