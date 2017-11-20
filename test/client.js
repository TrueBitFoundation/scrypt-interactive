var ClaimManager = artifacts.require('./claimManager.sol');
var ScryptVerifier = artifacts.require('./scryptVerifier.sol');
var ScryptRunner = artifacts.require('./scryptRunner.sol');
var Web3 = require('web3');
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

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

            var session = await scryptVerifier.getSession.call(claimID)
            var lowStep = session[0].toNumber();
            var medStep = session[1].toNumber();
            var highStep = session[2].toNumber();
            var input = session[3];
            
            tx = await scryptVerifier.query(claimID, Math.floor(steps / 2), {from: challenger})

            log = tx.logs.find(log => log.event === 'NewQuery')
            assert.equal(log.args.sessionId.toNumber(), claimID)

            var results = await scryptRunner.getStateProofAndHash.call(input, medStep, {from: claimant})

            var session = await scryptVerifier.getSession.call(claimID)
            var lowStep = session[0].toNumber();
            var medStep = session[1].toNumber();
            var highStep = session[2].toNumber();
            var input = session[3];

            tx = await scryptVerifier.respond(claimID, medStep, results[2], {from: claimant})

           log = tx.logs.find(log => log.event === 'NewResponse')
           assert.equal(log.args.sessionId.toNumber(), claimID)

            //const number = 1000;
            //assert.equal(number, 1000);
        });
    });
});
