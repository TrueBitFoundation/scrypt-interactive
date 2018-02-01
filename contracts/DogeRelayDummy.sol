pragma solidity ^0.4.4;
import './ClaimManager.sol';
import './IScryptDependent.sol';

contract DogeRelayDummy is IScryptDependent {

	ClaimManager claimManager;

	event ScryptVerified(bytes32 proposalId);

	function DogeRelayDummy(ClaimManager _claimManager) public {
		claimManager = _claimManager;
	}
	
	function scryptVerified(bytes32 proposalId) public returns (uint) {
		ScryptVerified(proposalId);
		return 42;
	}

	function verifyScrypt(bytes _plaintext, bytes32 _hash, bytes32 proposalId) public payable {
		ClaimManager(claimManager).checkScrypt.value(msg.value)(_plaintext, _hash, proposalId, this);
	}
}