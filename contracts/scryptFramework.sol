pragma solidity ^0.4.0;

contract ScryptFramework {
    // The state object, can be used in both generating and verifying mode.
    // In generating mode, only vars and fullMemory is used, in verifying
    // mode only vars and memoryHash is used.
    struct State {
        // We need the input as part of the state because it is required
        // for the final step. We could move it to memory to shorten the state size.
        bytes input;
        uint[4] vars;
        bytes32 memoryHash;
        uint[] fullMemory;
    }
    // This is the witness data that is generated in generating mode
    // and used for verification in verification mode.
    struct Proofs {
        bool generateProofs;
        bytes proofs;
        uint readIndex;
        uint[4] vars;
        uint[4] read;
    }

    function inputToState(bytes memory input) pure internal returns (State memory state)
    {
        state.input = input;
        state.vars = KeyDeriv.pbkdf2(input, input, 128);
        state.vars[0] = Salsa8.endianConvert256bit(state.vars[0]);
        state.vars[1] = Salsa8.endianConvert256bit(state.vars[1]);
        state.vars[2] = Salsa8.endianConvert256bit(state.vars[2]);
        state.vars[3] = Salsa8.endianConvert256bit(state.vars[3]);
        initMemory(state);
    }

    function finalStateToOutput(State memory state) pure internal returns (bytes memory output)
    {
        state.vars[0] = Salsa8.endianConvert256bit(state.vars[0]);
        state.vars[1] = Salsa8.endianConvert256bit(state.vars[1]);
        state.vars[2] = Salsa8.endianConvert256bit(state.vars[2]);
        state.vars[3] = Salsa8.endianConvert256bit(state.vars[3]);
        bytes memory val = uint4ToBytes(state.vars);
        return uint4ToBytes(KeyDeriv.pbkdf2(state.input, val, 32));
    }

    function uint4ToBytes(uint[4] memory val) pure internal returns (bytes memory r)
    {
        r = new bytes(4 * 32);
        var v = val[0];
        assembly { mstore(add(r, 0x20), v) }
        v = val[1];
        assembly { mstore(add(r, 0x40), v) }
        v = val[2];
        assembly { mstore(add(r, 0x60), v) }
        v = val[3];
        assembly { mstore(add(r, 0x80), v) }
    }

    function initMemory(State memory state) pure internal;
    function writeMemory(State memory state, uint index, uint[4] values, Proofs memory proofs) pure internal;
    function readMemory(State memory state, uint index, Proofs memory proofs) pure internal returns (uint, uint, uint, uint);

    // Runs a single step, modifying state
    function runStep(State memory state, uint step, Proofs memory proofs) pure internal {
        require(step < 2048);
        if (step < 1024) {
            writeMemory(state, step, state.vars, proofs);
            state.vars = Salsa8.round(state.vars);
        } else {
            var readIndex = (state.vars[2] / 0x100000000000000000000000000000000000000000000000000000000) % 1024;
            proofs.readIndex = readIndex;
            var (va, vb, vc, vd) = readMemory(state, readIndex, proofs);
            proofs.vars = state.vars;
            proofs.read = [va, vb, vc, vd];
            state.vars = Salsa8.round([
                state.vars[0] ^ va,
                state.vars[1] ^ vb,
                state.vars[2] ^ vc,
                state.vars[3] ^ vd
            ]);
        }
    }
}

library Salsa8 {
    uint constant m0 = 0x100000000000000000000000000000000000000000000000000000000;
    uint constant m1 = 0x1000000000000000000000000000000000000000000000000;
    uint constant m2 = 0x010000000000000000000000000000000000000000;
    uint constant m3 = 0x100000000000000000000000000000000;
    uint constant m4 = 0x1000000000000000000000000;
    uint constant m5 = 0x10000000000000000;
    uint constant m6 = 0x100000000;
    uint constant m7 = 0x1;
    function quarter(uint32 y0, uint32 y1, uint32 y2, uint32 y3)
        pure internal returns (uint32, uint32, uint32, uint32)
    {
        uint32 t;
        t = y0 + y3;
        y1 = y1 ^ ((t * 2**7) | (t / 2**(32-7)));
        t = y1 + y0;
        y2 = y2 ^ ((t * 2**9) | (t / 2**(32-9)));
        t = y2 + y1;
        y3 = y3 ^ ((t * 2**13) | (t / 2**(32-13)));
        t = y3 + y2;
        y0 = y0 ^ ((t * 2**18) | (t / 2**(32-18)));
        return (y0, y1, y2, y3);        
    }
    function get(uint data, uint word) pure internal returns (uint32 x)
    {
        return uint32(data / 2**(256 - word * 32 - 32));
    }
    function put(uint x, uint word) pure internal returns (uint) {
        return x * 2**(256 - word * 32 - 32);
    }
    function rowround(uint first, uint second) pure internal returns (uint f, uint s)
    {
        var (a,b,c,d) = quarter(uint32(first / m0), uint32(first / m1), uint32(first / m2), uint32(first / m3));
        f = (((((uint(a) * 2**32) | uint(b)) * 2 ** 32) | uint(c)) * 2**32) | uint(d);
        (b,c,d,a) = quarter(uint32(first / m5), uint32(first / m6), uint32(first / m7), uint32(first / m4));
        f = (((((((f * 2**32) | uint(a)) * 2**32) | uint(b)) * 2 ** 32) | uint(c)) * 2**32) | uint(d);
        (c,d,a,b) = quarter(uint32(second / m2), uint32(second / m3), uint32(second / m0), uint32(second / m1));
        s = (((((uint(a) * 2**32) | uint(b)) * 2 ** 32) | uint(c)) * 2**32) | uint(d);
        (d,a,b,c) = quarter(uint32(second / m7), uint32(second / m4), uint32(second / m5), uint32(second / m6));
        s = (((((((s * 2**32) | uint(a)) * 2**32) | uint(b)) * 2 ** 32) | uint(c)) * 2**32) | uint(d);
    }
    function columnround(uint first, uint second) pure internal returns (uint f, uint s)
    {
        var (a,b,c,d) = quarter(uint32(first / m0), uint32(first / m4), uint32(second / m0), uint32(second / m4));
        f = (uint(a) * m0) | (uint(b) * m4);
        s = (uint(c) * m0) | (uint(d) * m4);
        (a,b,c,d) = quarter(uint32(first / m5), uint32(second / m1), uint32(second / m5), uint32(first / m1));
        f |= (uint(a) * m5) | (uint(d) * m1);
        s |= (uint(b) * m1) | (uint(c) * m5);
        (a,b,c,d) = quarter(uint32(second / m2), uint32(second / m6), uint32(first / m2), uint32(first / m6));
        f |= (uint(c) * m2) | (uint(d) * m6);
        s |= (uint(a) * m2) | (uint(b) * m6);
        (a,b,c,d) = quarter(uint32(second / m7), uint32(first / m3), uint32(first / m7), uint32(second / m3));
        f |= (uint(b) * m3) | (uint(c) * m7);
        s |= (uint(a) * m7) | (uint(d) * m3);
    }
    function salsa20_8(uint _first, uint _second) pure internal returns (uint rfirst, uint rsecond) {
        uint first = _first;
        uint second = _second;
        for (uint i = 0; i < 8; i += 2)
        {
            (first, second) = columnround(first, second);
            (first, second) = rowround(first, second);
        }
        for (i = 0; i < 8; i++)
        {
            rfirst |= put(get(_first, i) + get(first, i), i);
            rsecond |= put(get(_second, i) + get(second, i), i);
        }
    }
    function endianConvert256bit(uint x) pure internal returns (uint) {
        return
            endianConvert32bit(x / m0) * m0 +
            endianConvert32bit(x / m1) * m1 +
            endianConvert32bit(x / m2) * m2 +
            endianConvert32bit(x / m3) * m3 +
            endianConvert32bit(x / m4) * m4 +
            endianConvert32bit(x / m5) * m5 +
            endianConvert32bit(x / m6) * m6 +
            endianConvert32bit(x / m7) * m7;
    }
    function endianConvert32bit(uint x) pure internal returns (uint) {
        return
            (x & 0xff) * 0x1000000 +
            (x & 0xff00) * 0x100 +
            (x & 0xff0000) / 0x100 +
            (x & 0xff000000) / 0x1000000;
    }

    function round(uint[4] values) pure internal returns (uint[4]) {
        var (a, b, c, d) = (values[0], values[1], values[2], values[3]);
        (a, b) = salsa20_8(a ^ c, b ^ d);
        (c, d) = salsa20_8(a ^ c, b ^ d);
        return [a, b, c, d];
    }
}

library KeyDeriv {
    function hmacsha256(bytes key, bytes message) pure internal returns (bytes32) {
        bytes32 keyl;
        bytes32 keyr;
        uint i;
        if (key.length > 64) {
            keyl = sha256(key);
        } else {
            for (i = 0; i < key.length && i < 32; i++)
                keyl |= bytes32(uint(key[i]) * 2**(8 * (31 - i)));
            for (i = 32; i < key.length && i < 64; i++)
                keyr |= bytes32(uint(key[i]) * 2**(8 * (63 - i)));
        }
        bytes32 threesix = 0x3636363636363636363636363636363636363636363636363636363636363636;
        bytes32 fivec = 0x5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c; 
        return sha256(fivec ^ keyl, fivec ^ keyr, sha256(threesix ^ keyl, threesix ^ keyr, message));
    }
    /// PBKDF2 restricted to c=1, hash = hmacsha256 and dklen being a multiple of 32 not larger than 128
    function pbkdf2(bytes key, bytes salt, uint dklen) pure internal returns (uint[4] r) {
        var message = new bytes(salt.length + 4);
        for (uint i = 0; i < salt.length; i++)
            message[i] = salt[i];
        for (i = 0; i * 32 < dklen; i++) {
            message[message.length - 1] = bytes1(uint8(i + 1));
            r[i] = uint(hmacsha256(key, message));
        }
    }
}
