pragma solidity ^0.4.4;
import './ClaimManager.sol';
import './IDogeRelay.sol';

contract DogeRelayDummy is IDogeRelay {

	ClaimManager claimManager;

	event ScryptVerified(bytes32 proposalId);

	function DogeRelayDummy(ClaimManager _claimManager) public {
		claimManager = _claimManager;
	}
	
	function scryptVerified(bytes32 proposalId) public returns (uint) {
		ScryptVerified(proposalId);
		return 42;
	}

	function verifyScrypt(bytes _plaintext, bytes32 _hash, address claimant, bytes32 proposalId) public payable {
		ClaimManager(claimManager).checkScrypt.value(msg.value)(_plaintext, _hash, claimant, proposalId);
	}
}
