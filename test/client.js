var ClaimManager = artifacts.require('./claimManager.sol');
var Web3 = require('web3');
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

contract('ClaimManager', function(accounts) {
    let claimManager;

    beforeEach(async () => {
        claimManager = await ClaimManager.new()
    })

    describe('it works', () => {
        const claimant = accounts[1];

        it("be true.", async () => {
            const number = 1000;
            assert.equal(number, 1000);
        });
    });
});
