module.exports = {
  toSession: (data) => ({
    lowStep: data[0],
    medStep: data[1],
    highStep: data[2],
    input: data[3],
    medHash: data[4],
  }),
  toResult: (data) => ({
    state: data[0],
    proof: data[1],
    stateHash: data[2],
  }),
  toClaim: (data) => ({
    claimant: data[0],
    plaintext: data[1],
    blockHash: data[2],
    proposalID: data[3],
  }),
}
