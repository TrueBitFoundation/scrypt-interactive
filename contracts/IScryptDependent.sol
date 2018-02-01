pragma solidity ^0.4.4;

interface IScryptDependent {
    function scryptVerified(bytes32 _proposalId) public returns(uint);
}