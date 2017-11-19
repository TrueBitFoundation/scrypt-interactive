
const ClaimManager = artifacts.require("./claimManager.sol");
const ScryptVerifier = artifacts.require("./scryptVerifier.sol");

// deployer.deploy(A).then(function() {
//   return deployer.deploy(B, A.address);
// });

module.exports = function(deployer, network, thing) {
  deployer.deploy(ClaimManager);
  deployer.deploy(ScryptVerifier);
};
