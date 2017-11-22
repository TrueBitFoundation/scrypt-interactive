var ClaimManager = artifacts.require('./claimManager.sol');
var ScryptVerifier = artifacts.require('./scryptVerifier.sol');
var ScryptRunner = artifacts.require('./scryptRunner.sol');
var Web3 = require('web3');
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

function newSession(sessionData) {
    return {
        lowStep: sessionData[0].toNumber(),
        medStep: sessionData[1].toNumber(),
        highStep: sessionData[2].toNumber(),
        input: sessionData[3],
        medHash: sessionData[4]
    }
}

function newResult(resultData) {
    return {
        state: resultData[0],
        proof: resultData[1],
        stateHash: resultData[2]
    }
}

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

contract('ClaimManager', function(accounts) {
    const dogeRelayAddress = accounts[0]
    let claimManager, scryptVerifier, scryptRunner;

    const steps = 2050;
    const claimDeposit = 1;

    before(async () => {
        scryptRunner = await ScryptRunner.new()
        scryptVerifier = await ScryptVerifier.new()
        claimManager = await ClaimManager.new(dogeRelayAddress, scryptVerifier.address);
    })

    describe('it works', () => {
        const claimant = accounts[1];
        const challenger = accounts[2];

        it("challenger challenges", async () => {
            let tx, session, result, log, deposit;

            await claimManager.makeDeposit({from: claimant, value: claimDeposit});
            await claimManager.makeDeposit({from: challenger, value: claimDeposit});

            tx = await claimManager.checkScrypt("foo", "062f503253482f0472d35454085fffed", claimant, {from: dogeRelayAddress})
            log = tx.logs.find(l => l.event === 'ClaimCreated')
            const claimID = log.args.claimID.toNumber()
            // check that the claimant's deposits were bonded.
            deposit = await claimManager.getBondedDeposit.call(claimID, claimant, {from: claimant})
            assert.equal(deposit.toNumber(), claimDeposit)

            tx = await claimManager.challengeClaim(claimID, {from: challenger})
            log = tx.logs.find(l => l.event === 'ClaimChallenged')
            assert.equal(log.args.claimID.toNumber(), claimID)
            // check that the challenger's deposits were bonded.
            deposit = await claimManager.getBondedDeposit.call(claimID, challenger, {from: claimant})
            assert.equal(deposit.toNumber(), claimDeposit)

            tx = await claimManager.runNextVerificationGame(claimID, {from: claimant})
            log = tx.logs.find(l => l.event === 'ClaimVerificationGameStarted')
            assert.equal(log.args.claimID.toNumber(), claimID)
            assert.equal(log.args.claimant, claimant)
            assert.equal(log.args.challenger, challenger)

            // First challenge
            // Each call to query sets the new medstep
            // Intial high step is currently 2050 (assuming this is the final number of steps)
            tx = await scryptVerifier.query(claimID, 1, {from: challenger})
            session = newSession(await scryptVerifier.getSession.call(claimID))
            // console.log("Session after first query: \n", session, "\n")

            // claimant responds to first query.
            results = newResult(await scryptRunner.getStateProofAndHash.call(session.input, session.medStep, {from: claimant}))
            tx = await scryptVerifier.respond(claimID, session.medStep, results.stateHash, {from: claimant})
            session = newSession(await scryptVerifier.getSession.call(claimID))
            // console.log("Session after first response: \n", session, "\n")
            results = newResult(await scryptRunner.getStateProofAndHash.call(session.input, session.medStep, {from: claimant}))
            // console.log("Results after first response: \n", session, "\n")

            // second query from the challenger.
            tx = await scryptVerifier.query(claimID, 0, {from: challenger})
            session = newSession(await scryptVerifier.getSession.call(claimID))
            // console.log("Session after second query: \n", session, "\n")


            var preState = newResult(await scryptRunner.getStateProofAndHash.call(session.input, session.lowStep, {from: claimant})).state
            var postStateAndProof = newResult(await scryptRunner.getStateProofAndHash.call(session.input, session.highStep, {from: claimant}))
            var postState = postStateAndProof.state
            var proof = postStateAndProof.proof || '0x00'
            // console.log("... using\n   PreState:  ".yellow + preState + "\n   PostState: ".yellow + postState + "\n   Proof:    ".yellow + proof + "\n")

            // the final call for the verification game
            // can only happen when lowStep + 1 == highStep (typically lowStep = 0, highStep = 1)
            tx = await scryptVerifier.performStepVerification(claimID, preState, postState, proof, claimManager.address, {from: claimant, gas: 3000000})

            log = tx.logs.find(l => l.event === 'ChallengerConvicted')
            assert.equal(log.args.sessionId.toNumber(), claimID)
            log = tx.logs.find(l => l.event === 'ClaimantConvicted')
            assert.equal(log, undefined)

            // check that the callback to ClaimManager went through.
            const claimDecidedEvent = claimManager.ClaimDecided({fromBlock: 0, toBlock: 'latest'});
            claimDecidedEvent.watch((err, resp) => {
                assert.equal(claimDecidedEvent.args.claimID, claimID)
                assert.equal(claimDecidedEvent.args.winner, claimant)
                assert.equal(claimDecidedEvent.args.loser, challenger)
            })
            claimDecidedEvent.stopWatching()

            const gamesEndedEvent = claimManager.ClaimVerificationGamesEnded({fromBlock: 0, toBlock: 'latest'});
            gamesEndedEvent.watch((err, resp) => {
                assert.equal(gamesEndedEvent.args.claimID, claimID)
                assert.equal(gamesEndedEvent.args.winner, claimant)
                assert.equal(gamesEndedEvent.args.loser, challenger)
            })
            gamesEndedEvent.stopWatching()

            // check that the loser's deposits were transferred to the winner.
            deposit = await claimManager.getBondedDeposit.call(claimID, claimant, {from: claimant})
            assert.equal(deposit.toNumber(), 2 * claimDeposit)
            deposit = await claimManager.getBondedDeposit.call(claimID, challenger, {from: claimant})
            assert.equal(deposit.toNumber(), 0)
        });
    });
});
