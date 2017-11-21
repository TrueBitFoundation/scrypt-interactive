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

    beforeEach(async () => {
        scryptRunner = await ScryptRunner.new()
        scryptVerifier = await ScryptVerifier.new()
        claimManager = await ClaimManager.new(dogeRelayAddress, scryptVerifier.address);
    })

    describe('it works', () => {
        const claimant = accounts[1];
        const challenger = accounts[2];

        it("challenger challenges", async () => {
            var tx

            await claimManager.makeDeposit({from: claimant, value: 100});
            await claimManager.makeDeposit({from: challenger, value: 100});

            tx = await claimManager.checkScrypt("foo", "062f503253482f0472d35454085fffed", claimant, {from: dogeRelayAddress})

            log = tx.logs.find(log => log.event === 'ClaimCreated')
            const claimID = log.args.claimID.toNumber()
            console.log("claimID is : " + claimID)

            tx = await claimManager.challengeClaim(claimID, {from: challenger})

            log = tx.logs.find(log => log.event === 'ClaimChallenged')
            assert.equal(log.args.claimID.toNumber(), claimID)

            tx = await claimManager.runNextVerificationGame(claimID, {from: claimant})
            
            log = tx.logs.find(log => log.event === 'ClaimVerificationGameStarted')
            assert.equal(log.args.claimID.toNumber(), claimID)
            assert.equal(log.args.claimant, claimant)
            assert.equal(log.args.challenger, challenger)
            
            //First challenge
            //Each call to query sets the new medstep
            //Intial high step is currently 2050 (assuming this is the final number of steps)
            tx = await scryptVerifier.query(claimID, 1, {from: challenger})

            var session = newSession(await scryptVerifier.getSession.call(claimID))
            console.log(session)
            var results = newResult(await scryptRunner.getStateProofAndHash.call(session.input, session.medStep, {from: claimant}))
            tx = await scryptVerifier.respond(claimID, session.medStep, results.stateHash, {from: claimant})

            var session = newSession(await scryptVerifier.getSession.call(claimID))
            var results = newResult(await scryptRunner.getStateProofAndHash.call(session.input, session.medStep, {from: claimant}))
            tx = await scryptVerifier.query(claimID, 0, {from: challenger})

            var session = newSession(await scryptVerifier.getSession.call(claimID))

            var preState = newResult(await scryptRunner.getStateProofAndHash.call(session.input, session.lowStep, {from: claimant})).state
            var postStateAndProof = newResult(await scryptRunner.getStateProofAndHash.call(session.input, session.highStep, {from: claimant}))
            var postState = postStateAndProof.state
            var proof = postStateAndProof.proof || '0x00'
            console.log("lowStep: " + session.lowStep)
            console.log("highStep: " + session.highStep)
            console.log("... using\n   PreState:  ".yellow + preState + "\n   PostState: ".yellow + postState + "\n   Proof:    ".yellow + proof)
            //the final call for the verification game
            //can only happen when lowStep + 1 == highStep (typically lowStep = 0, highStep = 1)
            tx = await scryptVerifier.performStepVerification(claimID, preState, postState, proof, claimManager.address, {from: claimant, gas: 3000000})

            log = tx.logs.find(log => log.event === 'ChallengerConvicted')
            assert.equal(log.args.sessionId.toNumber(), claimID)

            log = tx.logs.find(log => log.event === 'ClaimantConvicted')
            assert.equal(log, undefined)
            assert.equal(log.args.sessionId.toNumber(), claimID)

            //TODO: Track events from claimManager to pick up these events
            // log1 = events.find(log => log.event === 'ClaimDecided')
            // assert.equal(log1.args.claimID.toNumber(), claimID)
            // assert.equal(log1.args.winner, claimant)
            // assert.equal(log1.args.loser, challenger)

            // log2 = events.find(log => log.event === 'VerificationGamesEnded')
            // assert.equal(log2.args.sessionId.toNumber(), claimID)
        });
    });
});
