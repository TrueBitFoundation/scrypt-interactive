pragma solidity ^0.4.4;
import './ClaimManager.sol';

contract DogeRelay {

	ClaimManager claimManager;

	event ScryptVerified(bytes32 proposalId);

	function DogeRelay(ClaimManager _claimManager) public {
		claimManager = _claimManager;
	}
	
	function scryptVerified(bytes32 proposalId) public {
		ScryptVerified(proposalId);
	}

	function verifyScrypt(bytes _plaintext, bytes _blockHash, address claimant, bytes32 proposalId) public payable {
		ClaimManager(claimManager).checkScrypt.value(msg.value)(_plaintext, _blockHash, claimant, proposalId);
	}
}