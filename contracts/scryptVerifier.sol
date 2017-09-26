pragma solidity ^0.4.0;

import {ScryptFramework} from "./scryptFramework.sol";
//import {Verifier} from "./verify.sol";

contract ScryptVerifier is ScryptFramework /*, Verifier*/ {
    // function unpackState(bytes value) pure internal returns (State memory s, bool err) {
    //     if (value.length != 32 * 5)
    //         return (s, true);
    //     for (uint i = 0; i < 4; i ++) {
    //         uint v;
    //         assembly { v := mload(add(add(value, 0x20), mul(i, 0x20))) }
    //         s.vars[i] = v;
    //     }
    //     bytes32 memoryHash;
    //     assembly { memoryHash := mload(add(add(value, 0x20), mul(4, 0x20))) }
    //     s.memoryHash = memoryHash;
    // }

    // function stateHash(State memory state) pure internal returns (bytes32) {
    //     return sha3(state.vars, state.memoryHash);
    // }

    // function isInitiallyValid(VerificationSession storage session) pure internal returns (bool) {
    //     if (session.highStep != 2049)
    //         return false;
    //     if (session.lowHash != stateHash(inputToState(session.input)))
    //         return false;
    //     return true;
    // }

    // This can be called on steps that are not the first or the last step.
    function verifyInnerStep(uint step, uint[4] preVars, bytes32 preMemory, uint[4] postVars, bytes32 postMemory, bytes32[] proof) pure public returns (bool) {
        require(step > 0 && step < 2049);
        State memory state;
        state.vars = preVars;
        state.memoryHash = preMemory;
        Proofs memory proofs;
        proofs.proof = proof;

        runStep(state, step, proofs);

        if (proofs.verificationError)
            return false;
        for (uint i = 0; i < 4; i++)
            if (state.vars[i] != postVars[i])
                return false;
        if (state.memoryHash != postMemory)
            return false;
        return true;
    }

    function initMemory(State memory state) pure internal {
        // This is the root hash of empty memory.
        state.memoryHash = bytes32(0x93b69c64407d65fb222caeb0b7c23ca69fc00f3edb84381093ccb4fe21beab9d);
    }

    function readMemory(State memory state, uint index, Proofs memory proofs) pure internal returns (uint a, uint b, uint c, uint d) {
        require(index < 1024);

        preCheckProof(state, index, proofs);

        // Extract read result from proof
        a = uint(proofs.proof[0]);
        b = uint(proofs.proof[1]);
        c = uint(proofs.proof[2]);
        d = uint(proofs.proof[3]);
    }
    function writeMemory(State memory state, uint index, uint[4] values, Proofs memory proofs) pure internal {
        preCheckProof(state, index, proofs);

        proofs.proof[0] = bytes32(values[0]);
        proofs.proof[1] = bytes32(values[1]);
        proofs.proof[2] = bytes32(values[2]);
        proofs.proof[3] = bytes32(values[3]);

        // Compute the post-hash.
        state.memoryHash = executeProof(proofs.proof, index);
    }
    function preCheckProof(State memory state, uint index, Proofs memory proofs) pure internal returns (bool) {
        require(index < 1024);
        if (proofs.proof.length != 14) {
            proofs.verificationError = true;
            return false;
        }
        // Check the pre-hash.
        if (executeProof(proofs.proof, index) != state.memoryHash) {
            proofs.verificationError = true;
            return false;
        }
        return true;
    }
    function executeProof(bytes32[] proof, uint index) pure internal returns (bytes32) {
        bytes32 h = keccak256(proof[0], proof[1], proof[2], proof[3]);
        for (uint step = 0; step < 10; step++) {
            if (index % 2 == 0) {
                h = keccak256(h, proof[4 + step]);
            } else {
                h = keccak256(proof[4 + step], h);
            }
            index /= 2;
        }
        return h;
    }
}