

const isDepositEnough = require('./deposit').isDepositEnough;
const calculateMidpoint = require('../util/math').calculateMidpoint

const getNewMedStep = async (api, sessionID) => {
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

// should submit challenge; and play full game.
const submitChallenge = async (api, claim, challenger) => {
  // @TODO: only challenge if 'who' has not already challenged the claim.
  
  if (!isDepositEnough(api, challenger)) {
    throw new Error(`
      Your deposited ETH in ClaimManager is lower than minDeposit.`
    )
  }

  // bonds deposit
  await api.challengeClaim(claim.claimID, {from: challenger})
}

// @TODO: these have to be refactored when claimManager allows for multiple claims per claimant. 
const getSessionID = async (api, claim, challenger) => {
  const sessionId = await api.claimManager.getSession.call(claim.claimID, challenger)
  return sessionId.toNumber()
}
const getSession = async (api, sessionID) => {
  const session = await api.getSession(sessionID)
  return session
}


const submitQuery = async (api, claim, sessionID, challenger) => {
  // @TODO: check that it is the challenger's turn, before submitting a query.
  // how: compare lastClaimantMessage and lastChallengerMessage on scryptVerifier 
  // (maybe add a helper method to the contract called whoseTurnIsIt)

  // @TODO: refactor this: make sessionID available from getSession in contract
  let session = await getSession(api, sessionID)
  
  // @TODO: add both cases below.
  // if it's the first step, query for the midpoint.
  // else: compare calculated value with claimant's mid state, and query the left or right half.
  let toQueryStep, lowStep, medStep, highStep
  lowStep = session.lowStep.toNumber()
  medStep = session.medStep.toNumber()
  highStep = session.highStep.toNumber()

  console.log(`\nSESSION: ${lowStep} ${medStep} ${highStep}`)
  
  if (session.medHash.toString() == '0x0000000000000000000000000000000000000000000000000000000000000000') {
    // this is the first query: simply query for the midpoint.
    toQueryStep = calculateMidpoint(lowStep, highStep)
    console.log(`Challenger: querying step ${toQueryStep}`)
    await api.query(sessionID, toQueryStep, {from: challenger})
  } else {
    // mid-game: decide whether to query the left or right half of the computation.
    toQueryStep = await getNewMedStep(api, sessionID)
    console.log(`Challenger: querying step ${toQueryStep}`)
    await api.query(sessionID, toQueryStep, {from: challenger})

    // check if we are on the final step
    session = await getSession(api, sessionID)
    lowStep = session.lowStep.toNumber()
    highStep = session.highStep.toNumber()
    if (lowStep + 1 == highStep) {
      await performFinalChallenge(api, claim, sessionID, session, challenger)
    }
  } 
}

const performFinalChallenge = async (api, claim, sessionID, session, challenger) => {
  const lowStep = session.lowStep.toNumber()
  const highStep = session.highStep.toNumber()

  const preState = (await api.getResult(session.input, lowStep)).state
  const postStateAndProof = await api.getResult(session.input, highStep)

  // @TODO: postState needs to be session.highHash; 
  // provide this in the solidity getter

  // const postState = postStateAndProof.state
  const postState = claim.hash

  const proof = postStateAndProof.proof || '0x00'

  await api.scryptVerifier.performStepVerification(
    sessionID,
    claim.claimID,
    preState,
    postState,
    proof,
    api.claimManager.address,
    {from: challenger, gas: 3000000}
  ) 
}


const triggerVerificationGame = async (api, claim, challenger) => {
  // Figure out if we are the first challenger
  const currentChallenger = await api.claimManager.getCurrentChallenger.call(claim.claimID)
  const verificationOngoing = await api.claimManager.getVerificationOngoing.call(claim.claimID)

  if (currentChallenger == challenger && !verificationOngoing) {
    await api.claimManager.runNextVerificationGame(claim.claimID, { from: challenger })  
  }
}

const queryAfterResponses = async (api, claim, challenger) => {
  const sessionID = await getSessionID(api, claim, challenger)
  const newResponseEvent = api.scryptVerifier.NewResponse({sessionId: sessionID, challenger: challenger})
  
  newResponseEvent.watch(async (err, result) => {
    if (result) {
      await submitQuery(api, claim, sessionID, challenger)
    }
  })

  // @TODO: fix this later.
  // newResponseEvent.stopWatching()
}

module.exports = async (api, claim, challenger) => {
  const verificationGameStartedEvent = api.claimManager.VerificationGameStarted({ claimID: claim.claimID, challenger: challenger })

  verificationGameStartedEvent.watch(async (err, event) => {
    if (event) { 
      await queryAfterResponses(api, claim, challenger) 
    }
  })

  await submitChallenge(api, claim, challenger) 

  await triggerVerificationGame(api, claim, challenger)
  
  // submit the first query; do not wait for a responseEvent.
  const sessionID = await getSessionID(api, claim, challenger)
  submitQuery(api, claim, sessionID, challenger)

  // @TODO: fix this somehow
  // verificationGameStartedEvent.stopWatching() 
}
