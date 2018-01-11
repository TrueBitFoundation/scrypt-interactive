
const BigNumber = require('bignumber.js')
const { toSession, toResult } = require('./utils/models')
const offchain = require('./offchain/offchain')
const contracts = require('./contracts')

module.exports = async (web3, contractAddresses) => {
  const {
    claimManager,
    scryptVerifier
  } = await contracts(web3, contractAddresses);

  const scryptRunner = offchain.scryptRunner();

  return {
    /**
     * The instances, for direct access to methods like events.
     */
    claimManager,
    scryptRunner,
    scryptVerifier,
    /**
     * @return BigNumber value of ether deposited
     */
    getDeposit: async (...args) => {
      return claimManager.getDeposit.call(...args)
    },
    /**
     * @desc deposit ether to the ClaimManager
     */
    makeDeposit: async (...args) => {
      return claimManager.makeDeposit.sendTransaction(...args)
    },
    /**
     * @desc withdraw ether from the ClaimManager
     */
    withdraw: async (...args) => {
      return claimManager.withdrawDeposit.sendTransaction(...args)
    },
    /**
     * @desc challenges the provided claim
     */
    challengeClaim: async (claimId) => {
      return claimManager.challengeClaim.sendTransaction(claimId)
    },
    /**
     * Runs the next verification game.
     */
    runNextVerificationGame: async (claimId) => {
      return claimManager.challengeClaim.sendTransaction(claimId)
    },
    /**
     * @return BigNumber number of blocks that represent challenge timeout
     */
    getChallengeTimeout: async () => {
      return claimManager.challengeTimeout.call()
    },
    /**
     * @desc get the minimum deposit necessary to challenge
     * @return BigNumber minDeposit
     */
    getMinDeposit: async () => {
      return claimManager.minDeposit.call()
    },
    /**
     * @desc get the ether balance of any address
     * @param string address
     * @return BigNumber balance of the supplied addres
     */
    getBalance: async (addr) => {
      return new BigNumber(await web3.eth.getBalance(addr))
    },
    /**
     * @desc get the session info from scryptVerifier
     * @param claimId
     * @return Session
     */
    getSession: async (claimId) => {
      return toSession(await scryptVerifier.getSession.call(claimId))
    },
    /**
     * @desc get the state proof and hash from scryptRunner
     * @param input original input
     * @param step compute up to this step
     * @return Result
     */
    getResult: async (input, step) => {
      return toResult(await offchain.getStateProofAndHash(
        scryptRunner,
        input,
        step
      ))
    },
    /**
     * @desc get the state and proof from scryptRunner
     * @param input original input
     * @param step compute up to this step
     * @return Result
     */
    getStateAndProof: async (input, step) => {
        return toStateAndProof(await offchain.getStateAndProof(
            scryptRunner, 
            input, 
            step
        ))
    },
    /**
     * @desc Claim a state for a step. Called by claimant.
     * @param claimId
     * @param step
     * @param stateHash
     */
    respond: async (claimId, step, stateHash) => {
      return scryptVerifier.respond.sendTransaction(claimId, step, stateHash)
    },
    /**
     * @desc challenge a claimant to prove a stateHash for a step.
     *       Caled by challenger.
     * @param claimId
     * @param step
     */
    query: async (claimId, step) => {
      return scryptVerifier.query.sendTransaction(claimId, step)
    },
    /**
     * @desc finalize the verification game by proving the final step's state
     * @param claimId
     * @param preState
     * @param postState
     * @param proof
     */
    performStepVerification: async (claimId, preState, postState, proof) => {
      return scryptVerifier.performStepVerification.sendTransaction(
        claimId,
        preState,
        postState,
        proof,
        claimManager.address
      )
    },
    /**
     * @desc just test the connection
     */
    testConnection: async () => {
      await claimManager
    },
  }
}
