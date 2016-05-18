import {Verifier} from "./verify.sol";
 
contract ScryptVerifier is Verifier {
    
    struct State {
        uint[4] vars;
        bytes32 memoryHash;
    }
    struct MemoryWrite {
        uint address;
        uint[4] value;
    }

    function unpackState(bytes value) internal returns (State s, bool err) {
        if (value.length != 32 * 5)
            return (s, false);
        for (uint i = 0; i < 4; i ++) {
            uint v;
            assembly { v := mload(add(add(value, 0x20), mul(i, 0x20))) }
            s.vars[i] = v;
        }
    }

    function stateHash(State state) internal returns (bytes32) {
        return sha3(state.vars, state.memoryHash);
    }

    function isInitiallyValid(Session storage session) internal returns (bool) {
        if (session.steps != 2048)
            return false;
        bytes32 emptyMemoryHash = 0; // TODO
        var initialState = State([uint(0), uint(0), uint(0), uint(0)], emptyMemoryHash);
        if (session.lowHash != stateHash(initialState))
            return false;
        return true;
    }

    function performStepVerificationSpecific(Session storage session, Transition transition) internal {
        uint step = session.lowStep;
        var (state, err) = unpackState(transition);
        if (err) {
            claimantConvicted(session.id);
            return;
        }
        uint[4] vars;
        if (step == 0) {
            vars = KeyDeriv.pbkdf2(session.input, session.input, 128);
            verify(transition, values, MemoryWrite(0, vars));
        } else if (step < 1024) {
            vars = Salsa8.round(state.vars);
            verify(transition, vars, MemoryWrite(step, vars));
        } else if (step < 2048) {
            var readIndex = (c / 0x100000000000000000000000000000000000000000000000000000000) % 1024;
            var (va, vb, vc, vd) = getMemory(transition, readIndex);
            vars = Salsa8.round([vars[0] ^ va, vars[1] ^ vb, vars[2] ^ vc, vars[3] ^ vd]);
            verify(transition, vars);
        } else if (step == 2048) {
            bytes memory val = new bytes(128);
            val = (a, b, c, d);
            var h = KeyDeriv.pbkdf2(val, val, 32);
            verify(transition, State());
            assertEqual(h, session.output);
        } else {
            claimantConvicted(session.id);
        }
    }
}

library Salsa8 {
    uint constant m0 = 0x100000000000000000000000000000000000000000000000000000000;
    uint constant m1 = 0x1000000000000000000000000000000000000000000000000;
    uint constant m2 = 0x10000000000000000000000000000000000000000;
    uint constant m3 = 0x100000000000000000000000000000000;
    uint constant m4 = 0x1000000000000000000000000;
    uint constant m5 = 0x10000000000000000;
    uint constant m6 = 0x100000000;
    uint constant m7 = 0x1;
    function quarter(uint32 y0, uint32 y1, uint32 y2, uint32 y3)
        internal returns (uint32, uint32, uint32, uint32)
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
    function get(uint data, uint word) internal returns (uint32 x)
    {
        return uint32(data / 2**(256 - word * 32 - 32));
    }
    function put(uint x, uint word) internal returns (uint) {
        return x * 2**(256 - word * 32 - 32);
    }
    function rowround(uint first, uint second) internal returns (uint f, uint s)
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
    function columnround(uint first, uint second) internal returns (uint f, uint s)
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
    function salsa20_8(uint _first, uint _second) internal returns (uint rfirst, uint rsecond) {
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
    function round(uint[4] values) constant returns (uint[4]) {
        var (a, b, c, d) = (values[0], values[1], values[2], values[3]);
        (a, b) = salsa20_8(a ^ c, b ^ d);
        (c, d) = salsa20_8(a ^ c, b ^ d);
        return [a, b, c, d];
    }
}
library KeyDeriv {
    function hmacsha256(bytes key, bytes message) constant returns (bytes32) {
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
    function pbkdf2(bytes key, bytes salt, uint dklen) constant returns (bytes32[4] r) {
        var msg = new bytes(salt.length + 4);
        for (uint i = 0; i < salt.length; i++)
            msg[i] = salt[i];
        for (i = 0; i * 32 < dklen; i++) {
            msg[msg.length - 1] = bytes1(uint8(i + 1));
            r[i] = hmacsha256(key, msg);
        }
    }
}
