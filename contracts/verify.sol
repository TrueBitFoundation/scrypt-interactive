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

    event NewClaim(uint sessionId);
    event NewQuery(uint sessionId);
    event NewResponse(uint sessionId);
    event ChallengerConvicted(uint sessionId);
    event ClaimantConvicted(uint sessionId);

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
    VerificationSession[] public sessions;

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

        uint sessionId = sessions.length;
        sessions.push(VerificationSession({
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
        }));

        require(isInitiallyValid(sessions[sessionId]));

        NewClaim(sessionId);
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
        if (session.challenger == address(0)) {
            session.challenger = msg.sender;
        } else {
            require(msg.sender == session.challenger);
        }
        _;
    }

    function query(uint sessionId, uint step)
        onlyChallenger(sessionId)
        public
    {
        VerificationSession storage s = sessions[sessionId];
        // Special case: first query
        require(s.medHash != 0 || s.medStep == 0);
        if (step == s.lowStep && step + 1 == s.medStep) {
            // Final step of the binary search
            s.highHash = s.medHash;
            s.highStep = step + 1;
        } else if (step == s.medStep && step + 1 == s.highStep) {
            // Final step of the binary search
            s.lowHash = s.medHash;
            s.lowStep = step;
        } else {
            require(step > s.lowStep && step < s.highStep);
            if (s.medStep == 0 && s.medHash == 0) {
                // Special case: First query
            } else {
                require(s.medHash != 0);
                if (step < s.medStep) {
                    s.highStep = s.medStep;
                    s.highHash = s.medHash;
                } else {
                    require(step > s.medStep);
                    require(s.medHash != 0);
                    s.lowStep = s.medStep;
                    s.lowHash = s.medHash;
                }
            }
            s.medStep = step;
            s.medHash = bytes32(0);
        }
        s.lastChallengerMessage = now;
        NewQuery(sessionId);
    }

    function respond(uint sessionId, uint step, bytes32 hash)
        onlyClaimant(sessionId)
        public
    {
        VerificationSession storage s = sessions[sessionId];
        // Require step to avoid replay problems
        require(step == s.medStep);
        require(s.medHash == 0);
        if (hash == 0) {
            // Special "fold" signal
            challengerConvicted(sessionId);
            return;
        }
        s.medHash = hash;
        s.lastClaimantMessage = now;
        NewResponse(sessionId);
    }

    function performStepVerification(
        uint sessionId,
        bytes preValue,
        bytes postValue,
        bytes proofs,
        address claimManager
    )
        onlyClaimant(sessionId)
        public
    {
        VerificationSession storage s = sessions[sessionId];
        require(s.lowStep + 1 == s.highStep);
        if (keccak256(preValue) != s.lowHash) claimantConvicted(sessionId);
        if (keccak256(postValue) != s.highHash) claimantConvicted(sessionId);

        ClaimManager cm = ClaimManager(claimManager);
        if (performStepVerificationSpecific(s, s.lowStep, preValue, postValue, proofs)) {
            cm.claimDecided(sessionId, s.claimant, s.challenger);
            challengerConvicted(sessionId);
        } else {
            cm.claimDecided(sessionId, s.challenger, s.challenger);
            claimantConvicted(sessionId);
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
            now > session.lastClaimantMessage + responseTime
        ) {
            claimantConvicted(sessionId);
        }
        else if (
            session.lastClaimantMessage > session.lastChallengerMessage &&
            now > session.lastChallengerMessage + responseTime
        ) {
            challengerConvicted(sessionId);
        } else {
            require(false);
        }
    }

    function challengerConvicted(uint sessionId)
        internal
    {
        disable(sessionId);
        ChallengerConvicted(sessionId);
    }

    function claimantConvicted(uint sessionId)
        internal
    {
        disable(sessionId);
        ClaimantConvicted(sessionId);
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
