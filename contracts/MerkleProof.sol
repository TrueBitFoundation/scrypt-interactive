/**
* @title a library to verify the proofs in a binary sha3/keccak merkle tree with 32-byte hash size
* @author Christian Reitwiessner
*/

/**
 * This library can be used to verify a proof in a binary sha3/keccak
 * Merkle tree with 32 bytes hash size.
 * Proofs have the following form:
 * Leaf ( {0|1} Sibling )*
 * where Leaf is the 32 byte value whose presence in the tree is to be
 * verified, {0|1} is a single byte value signifying whether the previous
 * node is the left (0) or right (1) child node and Sibling is a 32 byte
 * value which is the other sibling.
 * Example:
 * 
 *
 */
library BinaryMerkleProof {
    /**
    * @dev  verifies the merkle proof
    *
    * @param _root the root of the merkle tree
    * @param _proof proof to be verified
    *
    * @return whether the proof was correct. returns a boolean value.
    */
    function verify(bytes32 _root, bytes _proof) returns (bool) {
        bytes32 v = getBytes32Slice(_proof, 0);
        for (uint i = 32; i < _proof.length; i += 33) {
            byte order = _proof[i];
            bytes32 sibling = getBytes32Slice(_proof, i + 1);
            v = (order == 0 ? sha3(v, sibling) : sha3(sibling, v));
        }
        return v == _root;
    }

    /**
    * @dev  slice off 32 bytes from _proof starting at offset _index and return it
    *
    * @param _proof where we are slicing off from
    * @param _index the offset at which to start slicing
    *
    * @return return the sliced-off 32-byte value
    */
    function getBytes32Slice(bytes _proof, uint _index) internal returns (bytes32 r) {
        _proof[_index + 31]; // bounds checking
        assembly {
            r := mload(add(add(_proof, 0x20), _index))
        }
    }

    /**
    * @dev  sets a slice inside _proof to value _value starting at offset _index
    *
    * @param _proof the merkle proof
    * @param _index the offset at which to set value _value
    * @param _value the value to set inside the merkle proof
    *
    * @return 
    */
    function setBytes32Slice(bytes _proof, uint _index, bytes32 _value) {
        _proof[_index + 31]; // bounds checking
        assembly {
            mstore(add(add(_proof, 0x20), _index), _value)
        }
    }

    /**
    * @dev  a test for the functions inside this module.
    *
    * @return returns a boolean value indicating whether the test was passed successfully.
    */
    function test() returns (bool) {
        bytes32[8] memory v = [
            bytes32("abc"), bytes32("def"), bytes32("ghi"), bytes32("jkl"),
            bytes32("mno"), bytes32("pqr"), bytes32("stu"), bytes32("vwx")
        ];
        bytes32[4] memory l1 = [sha3(v[0], v[1]), sha3(v[2], v[3]), sha3(v[4], v[5]), sha3(v[6], v[7])];
        bytes32[2] memory l2 = [sha3(l1[0], l1[1]), sha3(l1[2], l1[3])];
        bytes32 root = sha3(l2[0], l2[1]);

        bytes32[] memory siblings = new bytes32[](3);
        byte[] memory directions = new byte[](3);
        siblings[0] = v[3];
        directions[0] = 0;
        siblings[1] = l1[0];
        directions[1] = 1;
        siblings[2] = l2[1];
        directions[2] = 0;
        if (!verify(root, constructProof(v[2], siblings, directions)))
            return false;
        return true;
    }

    /**
    * @dev  constructs a merkle proof for a given leaf, its siblings and their respective directions.
    *
    * @param leaf the leaf for which we are constructing a proof.
    * @param siblings the siblings of the leaf.
    * @param directions indicates whether the siblings are to the left or to the right of the leaf.
    *
    * @return returns the merkle proof.
    */
    function constructProof(bytes32 leaf, bytes32[] siblings, byte[] directions) returns (bytes r) {
        uint len = directions.length;
        if (siblings.length != len) throw;
        r = new bytes(32 + 33 * len);
        setBytes32Slice(r, 0, leaf);
        for (uint i = 0; i < len; ++i) {
            r[32 + i * 33] = directions[i];
            setBytes32Slice(r, 32 + i * 33 + 1, siblings[i]);
        }
    }
}
