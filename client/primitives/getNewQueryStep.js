

const calculateMidpoint = require('../util/math').calculateMidpoint
const getSessionID = require('./session').getSessionID
const getSession = require('./session').getSession

module.exports = async (api, sessionID) => {
  const session = await getSession(api, sessionID)
  const medStep = session.medStep.toNumber()
  const lowStep = session.lowStep.toNumber()
  const highStep = session.highStep.toNumber()

  const result = await api.getResult(session.input, medStep)

  if (result.stateHash == session.medHash) {
    // we agree with their state; look in the right half
    return calculateMidpoint(medStep, highStep)
  } else {
    // we disagree with their state; look in the left half.
    return calculateMidpoint(lowStep, medStep)
  }
}
