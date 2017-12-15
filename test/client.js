const Ganache = require("ganache-core");
const Web3 = require('web3');
const fs = require('fs');

const web3 = new Web3(Ganache.provider())

const scryptRunnerBin = fs.readFileSync('./special_contracts_build/ScryptRunner.bin', 'utf8')
const scryptRunnerABI = JSON.parse(fs.readFileSync('./special_contracts_build/ScryptRunner.abi', 'utf8'))

const timeout = require('./helpers/timeout')
const dataFormatter = require('./helpers/dataFormatter')

const ClaimManager = artifacts.require('ClaimManager')
const ScryptVerifier = artifacts.require('ScryptVerifier')
const ScryptRunner = artifacts.require('ScryptRunner')

contract('ClaimManager', function (accounts) {
  const steps = 2050
  const claimDeposit = 1

  const [
    dogeRelayAddress,
    claimant,
    challenger,
  ] = accounts

  let claimManager,
    scryptVerifier,
    scryptRunner
  let claimID
  let tx, session, result, log, deposit

  const serializedBlockHeader = '030162002adb34dfa6574cf127a781ecb9683ca28f911a59020628c90c72b4a3d9942233a3b905b2388b020085dbd9e03209db4493f5420336d882d0b78b54f728b8f90058f7115a2c83221a00000000'
  const testScryptHash = 'ce60a0d4a7c2223a94437d44fe4d33a30489436714d18376f9ebc5e2bd6e5682'

  context('normal conditions', function () {
    before(async () => {

      let accounts2 = await new Promise((resolve) => {
        return web3.eth.getAccounts((err, result) => {
          resolve(result)
        })
      })

      //Because we are using old web3
      scryptRunner = await new Promise((resolve) => {
        return web3.eth.contract(scryptRunnerABI)
        .new({from: accounts2[0], data: scryptRunnerBin}, (error, result) => {
          if(error) { console.log(error) }
          resolve(result)
        })
      })

      scryptVerifier = await ScryptVerifier.new()
      claimManager = await ClaimManager.new(dogeRelayAddress, scryptVerifier.address)
    })

    it('claimant checks scrypt', async () => {
      await claimManager.makeDeposit({ from: claimant, value: claimDeposit })

      tx = await claimManager.checkScrypt(serializedBlockHeader, testScryptHash, claimant, { from: dogeRelayAddress })
      log = tx.logs.find(l => l.event === 'ClaimCreated')
      claimID = log.args.claimID.toNumber()
      // check that the claimant's deposits were bonded.
      deposit = await claimManager.getBondedDeposit.call(claimID, claimant, { from: claimant })
      assert.equal(deposit.toNumber(), claimDeposit)
    })

    it('challenger challenges', async () => {
      await claimManager.makeDeposit({ from: challenger, value: claimDeposit })
      tx = await claimManager.challengeClaim(claimID, { from: challenger })
      log = tx.logs.find(l => l.event === 'ClaimChallenged')
      assert.equal(log.args.claimID.toNumber(), claimID)
      // check that the challenger's deposits were bonded.
      deposit = await claimManager.getBondedDeposit.call(claimID, challenger, { from: claimant })
      assert.equal(deposit.toNumber(), claimDeposit)
    })

    it('begins verification game', async () => {
      tx = await claimManager.runNextVerificationGame(claimID, { from: claimant })
      log = tx.logs.find(l => l.event === 'ClaimVerificationGameStarted')
      assert.equal(log.args.claimID.toNumber(), claimID)
      assert.equal(log.args.claimant, claimant)
      assert.equal(log.args.challenger, challenger)
    })

    it('participates in verification game', async () => {
      // First challenge
      // Each call to query sets the new medstep
      // Intial high step is currently 2050 (assuming this is the final number of steps)
      tx = await scryptVerifier.query(claimID, 1, { from: challenger })
      session = dataFormatter.newSession(await scryptVerifier.getSession.call(claimID))
      // console.log("Session after first query: \n", session, "\n")

      // claimant responds to first query.
      results = dataFormatter.newResult(await getStateProofAndHash(scryptRunner, session.input, session.medStep))

      tx = await scryptVerifier.respond(claimID, session.medStep, results.stateHash, { from: claimant })
      session = dataFormatter.newSession(await scryptVerifier.getSession.call(claimID))
      // console.log("Session after first response: \n", session, "\n")
      results = dataFormatter.newResult(await getStateProofAndHash(scryptRunner, session.input, session.medStep))
      // console.log("Results after first response: \n", session, "\n")
      // second query from the challenger.
      tx = await scryptVerifier.query(claimID, 0, { from: challenger })
    })

    it('finalizes verification game', async () => {
      session = dataFormatter.newSession(await scryptVerifier.getSession.call(claimID))
      // console.log("Session after second query: \n", session, "\n")

      var preState = dataFormatter.newResult(await getStateProofAndHash(scryptRunner, session.input, session.lowStep)).state
      var postStateAndProof = dataFormatter.newResult(await getStateProofAndHash(scryptRunner, session.input, session.highStep))
      var postState = postStateAndProof.state
      var proof = postStateAndProof.proof || '0x00'
      // console.log("... using\n   PreState:  ".yellow + preState + "\n   PostState: ".yellow + postState + "\n   Proof:    ".yellow + proof + "\n")

      // the final call for the verification game
      // can only happen when lowStep + 1 == highStep (typically lowStep = 0, highStep = 1)
      tx = await scryptVerifier.performStepVerification(claimID, preState, postState, proof, claimManager.address, { from: claimant, gas: 3000000 })

      log = tx.logs.find(l => l.event === 'ChallengerConvicted')
      assert.equal(log.args.sessionId.toNumber(), claimID)
      log = tx.logs.find(l => l.event === 'ClaimantConvicted')
      assert.equal(log, undefined)

      // check that the callback to ClaimManager went through.
      const claimDecidedEvent = claimManager.ClaimDecided({ fromBlock: 0, toBlock: 'latest' })
      claimDecidedEvent.watch((err, resp) => {
        assert.equal(claimDecidedEvent.args.claimID, claimID)
        assert.equal(claimDecidedEvent.args.winner, claimant)
        assert.equal(claimDecidedEvent.args.loser, challenger)
      })
      claimDecidedEvent.stopWatching()

      const gamesEndedEvent = claimManager.ClaimVerificationGamesEnded({ fromBlock: 0, toBlock: 'latest' })
      gamesEndedEvent.watch((err, resp) => {
        assert.equal(gamesEndedEvent.args.claimID, claimID)
        assert.equal(gamesEndedEvent.args.winner, claimant)
        assert.equal(gamesEndedEvent.args.loser, challenger)
      })
      gamesEndedEvent.stopWatching()
    })

    it('checks bonded deposits', async () => {
      // check that the loser's deposits were transferred to the winner.
      deposit = await claimManager.getBondedDeposit.call(claimID, claimant, { from: claimant })
      assert.equal(deposit.toNumber(), 2 * claimDeposit)
      deposit = await claimManager.getBondedDeposit.call(claimID, challenger, { from: challenger })
      assert.equal(deposit.toNumber(), 0)
    })

    it('checks unbonded deposits', async () => {
      //Check that participants can unbond their deposit
      await claimManager.unbondDeposit(claimID, claimant, {from: claimant})
      deposit = await claimManager.getDeposit.call(claimant, {from: claimant})
      await claimManager.unbondDeposit(claimID, challenger, { from: challenger })
      deposit = await claimManager.getDeposit.call(challenger, {from: challenger})
    })
  })
})

async function getStateProofAndHash(scryptRunner, input, step) {
  return new Promise((resolve) => {
    return scryptRunner.getStateProofAndHash.call(input, step, (err, result) => {
      resolve(result);
    })
  })
}