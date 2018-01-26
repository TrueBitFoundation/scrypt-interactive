const dataFormatter = require('./helpers/dataFormatter')
const offchain = require('./helpers/offchain')

const ClaimManager = artifacts.require('ClaimManager')
const ScryptVerifier = artifacts.require('ScryptVerifier')

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))

contract('ClaimManager', function (accounts) {
  const steps = 2050
  const claimDeposit = 1

  const [
    dogeRelayAddress,
    claimant,
    otherClaimant,
    challenger,
  ] = accounts

  let claimManager,
    scryptVerifier,
    scryptRunner
  let claimID, sessionId
  let tx, session, result, log, deposit

  const serializedBlockHeader = '030162002adb34dfa6574cf127a781ecb9683ca28f911a59020628c90c72b4a3d9942233a3b905b2388b020085dbd9e03209db4493f5420336d882d0b78b54f728b8f90058f7115a2c83221a00000000'
  const testScryptHash = 'ce60a0d4a7c2223a94437d44fe4d33a30489436714d18376f9ebc5e2bd6e5682'

  context('normal conditions', function () {
    before(async () => {
      scryptRunner = await offchain.scryptRunner()
      scryptVerifier = await ScryptVerifier.new()
      claimManager = await ClaimManager.new(scryptVerifier.address)
      await claimManager.setDogeRelay(dogeRelayAddress, { from: dogeRelayAddress })
    })

    it('claimant checks scrypt, after implicitly making a deposit', async () => {
      try {
        tx = await claimManager.checkScrypt(serializedBlockHeader, testScryptHash, otherClaimant, 'bar', { from: dogeRelayAddress, value: claimDeposit })
        log = tx.logs.find(l => l.event === 'ClaimCreated')
        claimID = log.args.claimID.toNumber()
      } catch (e) {
        console.log(e)
      }
      deposit = await claimManager.getBondedDeposit.call(claimID, otherClaimant, { from: claimant })
      assert.equal(deposit.toNumber(), claimDeposit)
    })

    it('claimant checks scrypt, after explicitely making a deposit', async () => {
      await claimManager.makeDeposit({ from: claimant, value: claimDeposit })

      try {
        tx = await claimManager.checkScrypt(serializedBlockHeader, testScryptHash, claimant, 'foo', { from: dogeRelayAddress })
        log = tx.logs.find(l => l.event === 'ClaimCreated')
        claimID = log.args.claimID.toNumber()
      } catch (e) {
        console.log(e)
      }
      deposit = await claimManager.getBondedDeposit.call(claimID, claimant, { from: claimant })
      assert.equal(deposit.toNumber(), claimDeposit)
    })

    it('challenger challenges', async () => {
      await claimManager.makeDeposit({ from: challenger, value: claimDeposit })
      tx = await claimManager.challengeClaim(claimID, { from: challenger })
      // check that the challenger's deposits were bonded.
      deposit = await claimManager.getBondedDeposit.call(claimID, challenger, { from: challenger })
      assert.equal(deposit.toNumber(), claimDeposit)
    })

    it('begins verification game', async () => {
      tx = await claimManager.runNextVerificationGame(claimID, { from: claimant })
      log = tx.logs.find(l => l.event === 'VerificationGameStarted')
      assert.equal(log.args.claimID.toNumber(), claimID)
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
      results = dataFormatter.newResult(await scryptRunner.getStateProofAndHash.call(session.input, session.medStep, { from: claimant }))
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

      // check that the callback to ClaimManager went through.
      const sessionDecidedEvent = claimManager.SessionDecided({ fromBlock: 0, toBlock: 'latest' })
      sessionDecidedEvent.watch((err, resp) => {
        assert.equal(sessionDecidedEvent.args.sessionId, sessionId)
        assert.equal(sessionDecidedEvent.args.winner, claimant)
        assert.equal(sessionDecidedEvent.args.loser, challenger)
      })
      sessionDecidedEvent.stopWatching()
    })

    it('waits for timeout of block number when claim is decided', async () => {
      await new Promise(async (resolve, reject) => {
        for(i = 0; i<50; i++) {
          web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0})
        }
        resolve()
      })

      //trigger claim decided
      await claimManager.runNextVerificationGame(claimID, {from: claimant})

      claimManager.ClaimVerificationGamesEnded({}, {fromBlock: 0, toBlock: 'latest'}).get((err, result) => {
        assert.equal(claimID, result[0].args.claimID.toNumber())
      })
    })

    it('checks bonded deposits', async () => {
      // check that the loser's deposits were transferred to the winner.
      deposit = await claimManager.getBondedDeposit.call(claimID, claimant, { from: claimant })
      assert.equal(deposit.toNumber(), 2 * claimDeposit)
      deposit = await claimManager.getBondedDeposit.call(claimID, challenger, { from: challenger })
      assert.equal(deposit.toNumber(), 0)
    })

    it('checks unbonded deposits', async () => {
      // Check that participants can unbond their deposit
      await claimManager.unbondDeposit(claimID, claimant, { from: claimant })
      deposit = await claimManager.getDeposit.call(claimant, { from: claimant })
      assert.equal(deposit.toNumber(), 2 * claimDeposit)
      await claimManager.unbondDeposit(claimID, challenger, { from: challenger })
      deposit = await claimManager.getDeposit.call(challenger, { from: challenger })
      assert.equal(deposit.toNumber(), 0)
    })
  })
})
