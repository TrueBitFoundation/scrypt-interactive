const ClaimManager = artifacts.require("./claimManager.sol");
const ScryptVerifier = artifacts.require("./scryptVerifier.sol");
const ScryptRunner = artifacts.require("./scryptRunner.sol");

module.exports = function(deployer, network, thing) {
	deployer.deploy(ScryptVerifier);
    deployer.deploy(ClaimManager);
    deployer.deploy(ScryptRunner);
};