pragma solidity ^0.4.0;

import {ScryptFramework} from "./scryptFramework.sol";
import {Verifier} from "./verify.sol";

contract ScryptVerifier is ScryptFramework, Verifier {
    function initMemory(State memory state) pure internal {
        state.memoryHash = bytes32(0); // @TODO correct empty memory hash
    }


    function unpackState(bytes value) pure internal returns (State memory s, bool err) {
        if (value.length != 32 * 5)
            return (s, true);
        for (uint i = 0; i < 4; i ++) {
            uint v;
            assembly { v := mload(add(add(value, 0x20), mul(i, 0x20))) }
            s.vars[i] = v;
        }
        bytes32 memoryHash;
        assembly { memoryHash := mload(add(add(value, 0x20), mul(4, 0x20))) }
        s.memoryHash = memoryHash;
    }

    function stateHash(State memory state) pure internal returns (bytes32) {
        return sha3(state.vars, state.memoryHash);
    }

    function isInitiallyValid(VerificationSession storage session) internal returns (bool) {
        if (session.highStep != 2049)
            return false;
        if (session.lowHash != stateHash(inputToState(session.input)))
            return false;
        return true;
    }

}