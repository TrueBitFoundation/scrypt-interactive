const lc = require('litecore-lib')

module.exports = {
  /**
   * @desc decides whether or not a serialized blockheader has a valid proof of work
   * @param serializedBlockHeader String a hex-encoded serialized blockheader
   * @return bool
   */
  validProofOfWork: (serializedBlockHeader) => {
    return lc.BlockHeader.fromBuffer(Buffer.from(serializedBlockHeader, 'hex')).validProofOfWork()
  }
}
