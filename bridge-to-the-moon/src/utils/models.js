module.exports = {
  toSession: (data) => ({
    lowStep: data[0].toNumber(),
    medStep: data[1].toNumber(),
    highStep: data[2].toNumber(),
    input: data[3],
    medHash: data[4],
  }),
  toResult: (data) => ({
    state: data[0],
    proof: data[1],
    stateHash: data[2],
  }),
}
