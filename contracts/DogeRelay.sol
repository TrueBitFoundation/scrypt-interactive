pragma solidity ^0.4.0;

interface DogeRelay {
	function scryptVerified(bytes plainText, bytes blockHash) public;
}