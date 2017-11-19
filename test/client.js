var ClaimManager = artifacts.require('./claimManager.sol');
var DogeRelay = artifacts.require('./dogeRelay.sol');
var ScryptVerifier = artifacts.require('./scryptVerifier.sol');
var Web3 = require('web3');
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

contract('ClaimManager', function(accounts) {
    const dogeRelayAddress = accounts[0]
    let claimManager, scryptVerifier;

    const steps = 2050;

    beforeEach(async () => {
        scryptVerifier = await ScryptVerifier.new()
        claimManager = await ClaimManager.new(dogeRelayAddress, scryptVerifier.address);
    })

    describe('it works', () => {
        const claimant = accounts[1];
        const challenger = accounts[2];

        it("challenger challenges", async () => {

            await claimManager.makeDeposit({from: claimant, value: 100});
            await claimManager.makeDeposit({from: challenger, value: 100});

            await claimManager.checkScrypt("foo", "0x02", claimant, {from: dogeRelayAddress})

            log = tx.logs.find(log => log.event === 'ClaimCreated')
            console.log(log.args.claimID);
            claimID = log.args.claimID

            await claimManager.challengeClaim(claimID)

            log = tx.logs.find(log => log.event === 'NewClaim')
            assert.equal(log.args.sessionId, claimID)

            var session = await info.getSession(log.args.sessionId)
            await scryptVerifier.query(log.args.sessionId, Math.floor(steps / 2)).send({from: challenger})

            log = tx.logs.find(log => log.event === 'NewQuery')
            assert.equal(log.args.sessionId, claimID)

            var stateHash = (await info.getStateProofAndHash(inputForStep(session.medStep, session.input), session.medStep)).stateHash
            await scryptVerifier.respond(event.returnValues.sessionId, session.medStep, stateHash).send({from: interface.account})

            const number = 1000;
            assert.equal(number, 1000);
        });
    });
});
