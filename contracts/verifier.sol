pragma solidity ^0.4.0;
import {ClaimManager} from "./claimManager.sol";
// Simple generic challenge-response computation verifier.
//
// @TODO:
// * Multiple challangers (proposer should not win just because one challenger fails)
// * Require "gas available" proof for timeout
/**
  * @title
  * @author Christian Reitwiessner
*/
contract Verifier {

    event NewSession(uint sessionId, address claimant, address challenger);
    event NewQuery(uint sessionId, address claimant);
    event NewResponse(uint sessionId, address challenger);
    event ChallengerConvicted(uint sessionId, address challenger);
    event ClaimantConvicted(uint sessionId, address claimant);

    uint constant responseTime = 1 hours;

    struct VerificationSession {
        uint id;
        address claimant;
        address challenger;
        bytes input;
        bytes output;
        uint lastClaimantMessage;
        uint lastChallengerMessage;
        uint lowStep;
        bytes32 lowHash;
        uint medStep;
        bytes32 medHash;
        uint highStep;
        bytes32 highHash;
    }

    mapping(uint => VerificationSession) public sessions;
    uint sessionsCount = 0;

    function claimComputation(
        address challenger,
        address claimant,
        bytes _input,
        bytes _output,
        uint steps
    )
        public
        returns (uint)
    {
        require(steps > 2);

        //ClaimManager constraints don't allow for sessionId 0
        uint sessionId = sessionsCount+1;
        sessions[sessionId] = VerificationSession({
            id: sessionId,
            claimant: claimant,
            challenger: challenger,
            input: _input,
            output: _output,
            lastClaimantMessage: now,
            lastChallengerMessage: now,
            lowStep: 0,
            lowHash: keccak256(_input),
            medStep: 0,
            medHash: 0,
            highStep: steps,
            highHash: keccak256(_output)
        });

        require(isInitiallyValid(sessions[sessionId]));
        sessionsCount+=1;

        NewSession(sessionId, claimant, challenger);
        return sessionId;
    }

    modifier onlyClaimant(uint sessionId) {
        require(msg.sender == sessions[sessionId].claimant);
        _;
    }

    // @TODO(shrugs) - this allows anyone to challenge an empty claim
    //  is this what we want?
    modifier onlyChallenger(uint sessionId) {
        var session = sessions[sessionId];
        require(msg.sender == session.challenger);
        _;
    }

    function query(uint sessionId, uint step)
        onlyChallenger(sessionId)
        public
    {
        VerificationSession storage s = sessions[sessionId];

        bool isFirstStep = s.medStep == 0;
        bool haveMedHash = s.medHash != bytes32(0);
        require(isFirstStep || haveMedHash);
        // ^ invariant if the step has been set but we don't have a hash for it

        if (step == s.lowStep && step + 1 == s.medStep) {
            // final step of the binary search (lower end)
            s.highHash = s.medHash;
            s.highStep = step + 1;
        } else if (step == s.medStep && step + 1 == s.highStep) {
            // final step of the binary search (upper end)
            s.lowHash = s.medHash;
            s.lowStep = step;
        } else {
            // this next step must be in the correct range
            require(step > s.lowStep && step < s.highStep);

            // if this is NOT the first query, update the steps and assign the correct hash
            // (if this IS the first query, we just want to initialize medStep and medHash)
            if (!isFirstStep) {
                if (step < s.medStep) {
                    // if we're iterating lower,
                    //   the new highest is the current middle
                    s.highStep = s.medStep;
                    s.highHash = s.medHash;
                } else if (step > s.medStep) {
                    // if we're iterating upwards,
                    //   the new lowest is the current middle
                    s.lowStep = s.medStep;
                    s.lowHash = s.medHash;
                } else {
                    // and if we're requesting the midStep that we've already requested,
                    //   there's nothing to do.
                    // @TODO(shrugs) - should this revert?
                    revert();
                }
            }

            s.medStep = step;
            s.medHash = bytes32(0);
        }
        s.lastChallengerMessage = now;
        NewQuery(sessionId, s.claimant);
    }

    function respond(uint sessionId, uint step, bytes32 hash)
        onlyClaimant(sessionId)
        public
    {
        VerificationSession storage s = sessions[sessionId];
        // Require step to avoid replay problems
        require(step == s.medStep);
        
        // provided hash cannot be zero; as that is a special flag.
        require(hash != 0);

        // record the claimed hash
        require(s.medHash == bytes32(0));
        s.medHash = hash;
        s.lastClaimantMessage = now;

        // notify watchers
        NewResponse(sessionId, s.challenger);
    }

    function performStepVerification(
        uint sessionId,
        uint claimID,
        bytes preValue,
        bytes postValue,
        bytes proofs,
        ClaimManager claimManager
    )
        onlyClaimant(sessionId)
        public
    {
        VerificationSession storage s = sessions[sessionId];
        require(s.lowStep + 1 == s.highStep);
        // ^ must be at the end of the binary search according to the smart contract

        require(keccak256(preValue) == s.lowHash);
        require(keccak256(postValue) == s.highHash);

        if (performStepVerificationSpecific(s, s.lowStep, preValue, postValue, proofs)) {
            claimManager.sessionDecided(sessionId, claimID, s.claimant, s.challenger);
            challengerConvicted(sessionId, s.challenger);
        } else {
            claimManager.sessionDecided(sessionId, claimID, s.challenger, s.claimant);
            claimantConvicted(sessionId, s.claimant);
        }
    }

    function performStepVerificationSpecific(
        VerificationSession storage session,
        uint step,
        bytes preState,
        bytes postState,
        bytes proof
    )
        internal
        returns (bool);

    function isInitiallyValid(VerificationSession storage session)
        internal
        returns (bool);

    function timeout(uint sessionId)
        public
    {
        var session = sessions[sessionId];
        require(session.claimant != 0);
        if (
            session.lastChallengerMessage > session.lastClaimantMessage &&
            now > session.lastChallengerMessage + responseTime
        ) {
            claimantConvicted(sessionId, session.claimant);
        } else if (
            session.lastClaimantMessage > session.lastChallengerMessage &&
            now > session.lastClaimantMessage + responseTime
        ) {
            challengerConvicted(sessionId, session.challenger);
        } else {
            require(false);
        }
    }

    function challengerConvicted(uint sessionId, address challenger)
        internal
    {
        disable(sessionId);
        ChallengerConvicted(sessionId, challenger);
    }

    function claimantConvicted(uint sessionId, address claimant)
        internal
    {
        disable(sessionId);
        ClaimantConvicted(sessionId, claimant);
    }

    function disable(uint sessionId)
        internal
    {
        delete sessions[sessionId];
    }

    function getSession(uint sessionId)
        public
        view
        returns (uint, uint, uint, bytes, bytes32)
    {
        VerificationSession storage session = sessions[sessionId];
        return (
            session.lowStep,
            session.medStep,
            session.highStep,
            session.input,
            session.medHash
        );
    }
}
