
const ClaimManager = artifacts.require("./claimManager.sol");
const ScryptVerifier = artifacts.require("./scryptVerifier.sol");

module.exports = function(deployer, network, thing) {
    deployer.deploy(ClaimManager);
    deployer.deploy(ScryptVerifier);
};
