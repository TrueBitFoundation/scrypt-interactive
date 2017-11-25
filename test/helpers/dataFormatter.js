function newSession (sessionData) {
  return {
    lowStep: sessionData[0].toNumber(),
    medStep: sessionData[1].toNumber(),
    highStep: sessionData[2].toNumber(),
    input: sessionData[3],
    medHash: sessionData[4],
  }
}

function newResult (resultData) {
  return {
    state: resultData[0],
    proof: resultData[1],
    stateHash: resultData[2],
  }
}

module.exports = {
  newSession: newSession,
  newResult: newResult,
}