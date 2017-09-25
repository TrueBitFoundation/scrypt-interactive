pragma solidity ^0.4.0;

import {ScryptFramework} from "./scryptFramework.sol";
 

contract ScryptRunner is ScryptFramework {
    function initMemory(State memory state) pure internal {
        state.fullMemory = new uint[](4 * 1024);
    }

    function run(bytes input, uint upToStep) pure returns (uint[4] vars, bytes proof, uint readIndex, uint[4] varsout, uint[4] read) {
        State memory s = inputToState(input);
        Proofs memory proofs;
        if (upToStep > 0) {
            uint internalStep = upToStep - 1;
            for (uint i = 0; i < internalStep; i++) {
                runStep(s, i, proofs);
            }
            proofs.generateProofs = true;
            if (internalStep < 2048) {
                runStep(s, internalStep, proofs);
            } else {
                proofs.proofs = finalStateToOutput(s);
            }
        }
        vars[0] = s.vars[0];
        vars[1] = s.vars[1];
        vars[2] = s.vars[2];
        vars[3] = s.vars[3];
        proof = proofs.proofs;
        readIndex = proofs.readIndex;
        varsout = proofs.vars;
        read = proofs.read;
    }

    function readMemory(State memory state, uint index, Proofs memory /*proofs*/) pure internal returns (uint a, uint b, uint c, uint d) {
        require(index < 1024);
        uint pos = 0x20 * 4 * index;
        uint[] memory fullMem = state.fullMemory;
        assembly {
            pos := add(pos, 0x20)
            a := mload(add(fullMem, pos))
            pos := add(pos, 0x20)
            b := mload(add(fullMem, pos))
            pos := add(pos, 0x20)
            c := mload(add(fullMem, pos))
            pos := add(pos, 0x20)
            d := mload(add(fullMem, pos))
        }
    }
    function writeMemory(State memory state, uint index, uint[4] values, Proofs memory proofs) pure internal {
        require(index < 1024);
        uint pos = 0x20 * 4 * index;
        uint[] memory fullMem = state.fullMemory;
        var (a, b, c, d) = (values[0], values[1], values[2], values[3]);
        assembly {
            pos := add(pos, 0x20)
            mstore(add(fullMem, pos), a)
            pos := add(pos, 0x20)
            mstore(add(fullMem, pos), b)
            pos := add(pos, 0x20)
            mstore(add(fullMem, pos), c)
            pos := add(pos, 0x20)
            mstore(add(fullMem, pos), d)
        }
        if (proofs.generateProofs) {
            proofs.proofs = generateMemoryProof(state.fullMemory, index);
        }
    }
    // Generate a proof that shows that the memory root hash was updated correctly.
    // This assumes that index is multiplied by four.
    // Returns a list of hashes of siblings.
    // Since we know that memory is only written in sequence, this might be
    // optimized, but we keep it general for now.
    function generateMemoryProof(uint[] fullMem, uint index) internal pure returns (bytes) {
        uint access = index;
        bytes32[] memory siblings = new bytes32[](12);
        bytes32[] memory hashes = new bytes32[](1024);
        for (uint i = 0; i < 1024; i++)
            hashes[i] = keccak256(fullMem[4 * i], fullMem[4 * i + 1], fullMem[4 * i + 2], fullMem[4 * i + 3]);
        uint numHashes = 1024;
        for (uint step = 0; step < 12; step++) {
            siblings[step] = hashes[access ^ 1];
            access /= 2;
            numHashes /= 2;
            for (i = 0; i < numHashes; i++) {
                hashes[i] = keccak256(hashes[2 * i], hashes[2 * i + 1]);
            }
        }
        uint size = siblings.length;
        bytes memory proof = new bytes(32 * size);
        assembly {
            for { let j := 0 } lt(j, size) { j := add(j, 1) } {
                let offset := mul(0x20, add(1, j))
                mstore(add(proof, offset), mload(add(siblings, offset)))
            }
        }
        return proof;
    }
}
