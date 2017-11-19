/**
 * Example javascript code for the following:
 *   1) example serialized blockheader
 *   2) example output block header hash
 *   3) portable (minimal dependencies) implementation of doge's block header hashing
 *
 * As best I can tell, doge's header hash algorithm is as follows:
 *
 * reverseHex(toHex(sha256(sha256(serialized blockheader))))
 *
 * I also wrote this in as basic a javascript as possible cause I'm not really sure what
 * env it's running in.
 */

// @return serialized blockheader
function serialize(blockheader) {
  var bw = new BufferWriter()

  bw.writeUInt32LE(blockheader.version)
  bw.write(blockheader.prevHash)
  bw.write(blockheader.merkleRoot)
  bw.writeUInt32LE(blockheader.time)
  bw.writeUInt32LE(blockheader.bits)
  bw.writeUInt32LE(blockheader.nonce)

  return toHex(bw)
}

// @return hex-encoded hash of blockheader
function hash(serializedBlockheader) {
  return hexReverse(toHex(sha256(sha256(serializedBlockheader))))
}


// via: https://dogechain.info/api/v1/block/1976514

// an example blockheader for block 1976514
var blockheader = {
  version: 6422787,
  time: 1511126872,
  prevHash: '332294d9a3b4720cc9280602591a918fa23c68b9ec81a727f14c57a6df34db2a',
  merkleRoot: '00f9b828f7548bb7d082d8360342f59344db0932e0d9db8500028b38b205b9a3',
  bits: 438469420,
  nonce: 0,
}

var serialized = serialize(blockheader)
assert(
  serialized === '030162002adb34dfa6574cf127a781ecb9683ca28f911a59020628c90c72b4a3d9942233a3b905b2388b020085dbd9e03209db4493f5420336d882d0b78b54f728b8f90058f7115a2c83221a00000000'
)

var hash = hash(serialized)
assert(
  hash === 'ce60a0d4a7c2223a94437d44fe4d33a30489436714d18376f9ebc5e2bd6e5682'
)
