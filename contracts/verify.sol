pragma solidity ^0.4.0;

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

    function claimComputation(bytes _input, bytes _output, uint steps) public {
        require(steps > 2);
        sessions.push(VerificationSession({
            id: sessions.length,
            claimant: msg.sender,
            challenger: address(0),
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
        require(isInitiallyValid(sessions[sessions.length - 1]));
        NewClaim(sessions.length - 1);
    }
    event NewClaim(uint sessionId);
    event NewQuery(uint sessionId);
    event NewResponse(uint sessionId);
    event ChallengerConvicted(uint sessionId);
    event ClaimantConvicted(uint sessionId);

    modifier onlyClaimant(uint id) { require(msg.sender == sessions[id].claimant); _; }
    modifier onlyChallenger(uint id) {
        var session = sessions[id];
        if (session.challenger == 0) session.challenger = msg.sender;
        else require(msg.sender != session.challenger);
        _;
    }

    function query(uint session, uint step) onlyChallenger(session) public {
        var s = sessions[session];
        require(step > s.lowStep && step < s.highStep && step != s.medStep);
        if (step < s.medStep) {
            s.highStep = s.medStep;
            s.highHash = s.medHash;
        } else {
            s.lowStep = s.medStep;
            s.lowHash = s.medHash;
        }
        s.medStep = step;
        s.medHash = bytes32(0);
        sessions[session].lastChallengerMessage = now;
        NewQuery(session);
    }

    function respond(uint session, uint step, bytes32 hash) onlyClaimant(session) public {
        var s = sessions[session];
        // Require step to avoid replay problems
        require(step == s.medStep);
        if (hash == 0) {
            // Special "fold" signal
            challengerConvicted(session);
            return;
        }
        s.medHash = hash;
        s.lastClaimantMessage = now;
        NewResponse(session);
    }

    function requestStepVerification(uint session, uint step) onlyChallenger(session) public {
        var s = sessions[session];
        bytes32 lowHash;
        bytes32 highHash;
        if (step == s.lowStep)
            lowHash = s.lowHash;
        else if (step == s.medStep)
            lowHash = s.medHash;
        else
            require(false);
        if (step + 1 == s.highStep)
            highHash = s.highHash;
        else if (step + 1 == s.medStep)
            highHash = s.medHash;
        else
            require(false);
        require(lowHash != 0 && highHash != 0);
        s.lowHash = lowHash;
        s.highHash = highHash;
        s.lowStep = step;
        s.highStep = step + 1;
        NewQuery(session);
    }

    function performStepVerification(uint session, bytes preValue, bytes postValue, bytes proofs) onlyClaimant(session) internal {
        var s = sessions[session];
        require(s.lowStep + 1 == s.highStep);
        if (keccak256(preValue) != s.lowHash) claimantConvicted(session);
        if (keccak256(postValue) != s.highHash) claimantConvicted(session);
        if (performStepVerificationSpecific(s, s.lowStep, preValue, postValue, proofs)) {
            challengerConvicted(session);
        } else {
            claimantConvicted(session);
        }
    }

    function performStepVerificationSpecific(VerificationSession storage session, uint step, bytes preState, bytes postState, bytes proof) internal returns (bool);
    function isInitiallyValid(VerificationSession storage session) internal returns (bool);

    function timeout(uint sessionId) public {
        var session = sessions[sessionId];
        require(session.claimant != 0);
        if (
            session.lastChallengerMessage > session.lastClaimantMessage &&
            now > session.lastClaimantMessage + responseTime
        )
            claimantConvicted(sessionId);
        else if (
            session.lastClaimantMessage > session.lastChallengerMessage &&
            now > session.lastChallengerMessage + responseTime
        )
            challengerConvicted(sessionId);
        else
            require(false);
    }
    
    function challengerConvicted(uint session) internal {
        disable(session);
        ChallengerConvicted(session);
    }
    function claimantConvicted(uint session) internal {
        disable(session);
        ClaimantConvicted(session);
    }
    function disable(uint session) internal {
        delete sessions[session];
    }
}
