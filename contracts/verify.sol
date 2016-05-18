import {VerifierHelper} from "./verifierhelper.sol";

contract Verifier is VerifierHelper {
    uint constant responseTime = 1 hour;

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
        int medStep;
        bytes32 medHash;
        uint highStep;
        bytes32 highHash;
    }
    VerificationSession[] public sessions;

    struct Transition {
        bytes preValue;
        bytes postValue;
        bytes proofs;
    }

    function claimComputation(bytes _input, bytes _output, uint steps, bytes32 lowHash, bytes32 highHash) {
        if (steps <= 2 || lowHash == 0 || highHash == 0) throw;
        sessions.push(VerificationSession({
            id: sessions.length,
            claimant: msg.sender,
            challenger: address(0),
            input: _input,
            output: _output,
            lastClaimantMessage: now,
            lastChallengerMessage: now,
            lowStep: 0,
            lowHash: lowHash,
            medStep: lowStep,
            medHash: lowHash,
            highStep: steps,
            highHash: highHash
        }));
        if (!isInitiallyValid(sessions[sessions.length - 1])) throw;
        NewClaim(sessions.length - 1);
    }
    event NewClaim(uint sessionId);
    event NewQuery(uint sessionId);
    event NewResponse(uint sessionId);
    event ChallengerConvicted(uint sessionId);
    event ClaimantConvicted(uint sessionId);

    modifier onlyClaimant(uint id) { if (msg.sender != sessions[id].claimant) throw; _ }
    modifier onlyChallenger(uint id) {
        var session = sessions[id];
        if (session.challenger == 0) session.challenger = msg.sender;
        else if (msg.sender != session.challenger) throw;
        _
    }

    function query(uint session, uint step) onlyChallenger(session) {
        var s = sessions[session];
        if (step <= s.lowStep || step >= s.highStep || step == s.medStep) throw;
        if (step < s.medStep) {
            s.highStep = s.medStep;
            s.highHash = s.medHash;
        } else {
            s.lowStep = s.medStep;
            s.lowHash = s.medHash;
        }
        s.medStep = step;
        s.medHash = 0;
        sessions[session].lastChallengerMessage = now;
        NewQuery(session);
    }

    function respond(uint session, uint step, bytes32 hash) onlyClaimant(session) {
        var s = sessions[session];
        if (step != s.medStep) throw;
        if (hash == 0) {
            challengerConvicted(session);
            return;
        }
        s.medHash = hash;
        s.lastClaimantMessage = now;
        NewResponse(session);
    }

    function requestStepVerification(uint session, uint step) onlyChallenger(session) {
        var s = sessions[session];
        bytes32 lowHash;
        bytes32 highHash;
        if (step == s.lowStep)
            lowHash = s.lowHash;            
        else if (step == s.medStep)
            lowHash = s.medHash;
        else
            throw;
        if (step + 1 == s.highStep)
            highHash = s.highHash;
        else if (step + 1 == s.medStep)
            highHash = s.medHash;
        else
            throw;
        if (lowHash == 0 || highHash == 0) throw;
        s.lowHash = lowHash;
        s.highHash = highHash;
        s.lowStep = step;
        s.highStep = step + 1;
        NewQuery(session);        
    }

    function performStepVerification(uint session, bytes preValue, bytes postValue, bytes proofs) onlyClaimant(session) {
        var s = sessions[session];
        if (s.lowStep + 1 != s.highStep) throw;
        if (sha3(preValue) != s.lowHash) claimantConvicted(session);
        if (sha3(postValue) != s.highHash) claimantConvicted(session);
        performStepVerificationSpecific(s, Transition(preValue, postValue, proofs));
    }

    function performStepVerificationSpecific(Session storage session, bytes preValue, bytes postValue) internal;
    function isInitiallyValid(Session storage session) internal returns (bool);

    function timeout(uint session) {
        var session = sessions[session];
        if (!session.active) throw;
        // TODO: we also have to keep a "last message" pointer
        if (now > session.lastChallengerMessage + responseTime)
            challengerConvicted();
        if (now > session.lastClaimantMessage + responseTime)
            claimantConvicted();
        throw;
    }
    
    function challengerConvicted(uint session) internal {
        disable(sessions[session]);
        ChallengerConvicted(session);
    }
    function claimantConvicted(uint session) internal {
        disable(sessions[session]);
        ClaimantConvicted(session);
    }
    function disable(uint session) internal {
        delete sessions[session];
    }
}