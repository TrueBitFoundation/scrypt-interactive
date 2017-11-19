const ClaimManager = artifacts.require("./claimManager.sol");
const ScryptVerifier = artifacts.require("./scryptVerifier.sol");
const DogeRelay = artifacts.require("./dogeRelay.sol");

module.exports = function(deployer, network, thing) {
	deployer.deploy(ScryptVerifier);
    deployer.deploy(DogeRelay);
    deployer.deploy(ClaimManager);
};