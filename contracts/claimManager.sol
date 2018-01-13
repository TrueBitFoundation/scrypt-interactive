pragma solidity ^0.4.0;

import {DepositsManager} from './DepositsManager.sol';
import {ScryptVerifier} from "./scryptVerifier.sol";
import {DogeRelay} from "./DogeRelay.sol";

// ClaimManager: queues a sequence of challengers to play with a claimant.

contract ClaimManager is DepositsManager {
    uint private numClaims = 0;     // index as key for the claims mapping.
    uint public minDeposit = 1;    // TODO: what should the minimum deposit be?

    //default initial amount of blocks for challenge timeout
    uint public defaultChallengeTimeout = 20;

    // blocks to wait for callback from scryptVerifier,
    // before moving onto the next.
    // TODO: we're not using this yet.
    uint public verificationGameTimeout = 40;

    DogeRelay public dogeRelay;
    ScryptVerifier public scryptVerifier;

    event DepositBonded(uint claimID, address account, uint amount);
    event DepositUnbonded(uint claimID, address account, uint amount);
    event ClaimCreated(uint claimID, address claimant, bytes plaintext, bytes blockHash);
    event ClaimChallenged(uint claimID, address challenger, uint sessionId);
    event ClaimVerificationGameStarted(uint claimID, address claimant, address challenger, uint sessionId);
    event SessionDecided(uint sessionId, address winner, address loser);
    event ClaimSuccessful(uint claimID, address claimant, bytes plaintext, bytes blockHash);
    event ClaimVerificationGamesEnded(uint claimID);

    struct ScryptClaim {
        uint id;
        address claimant;
        bytes plaintext;    // the plaintext Dogecoin block header.
        bytes blockHash;    // the Dogecoin blockhash.
        uint createdAt;     // the block number at which the claim was created.
        address[] challengers;      // all current challengers.
        mapping(address => uint) sessions; //map challengers to sessionId's
        uint numChallengers;
        uint currentChallenger;    // index of next challenger to play a verification game.
        bool verificationOngoing;   // is the claim waiting for results from an ongoing verificationg game.
        mapping (address => uint) bondedDeposits;   // all deposits bonded in this claim.
        bool decided;
        uint challengeTimeoutBlockNumber;
    }

    mapping(uint => ScryptClaim) private claims;

    modifier onlyBy(address _account) {
        require(msg.sender == _account);
        _;
    }



    // @dev – the constructor
    function ClaimManager(DogeRelay _dogeRelay, ScryptVerifier _scryptVerifier) public {
        dogeRelay = _dogeRelay;
        scryptVerifier = _scryptVerifier;
    }

    // @dev – locks up part of the a user's deposit into a claim.
    // @param claimID – the claim id.
    // @param account – the user's address.
    // @param amount – the amount of deposit to lock up.
    // @return – the user's deposit bonded for the claim.
    function bondDeposit(uint claimID, address account, uint amount) private returns (uint) {
        ScryptClaim storage claim = claims[claimID];

        require(claimExists(claim));
        require(deposits[account] >= amount);
        deposits[account] -= amount;

        claim.bondedDeposits[account] = claim.bondedDeposits[account].add(amount);
        DepositBonded(claimID, account, amount);
        return claim.bondedDeposits[account];
    }

    // @dev – accessor for a claims bonded deposits.
    // @param claimID – the claim id.
    // @param account – the user's address.
    // @return – the user's deposit bonded for the claim.
    function getBondedDeposit(uint claimID, address account) public view returns (uint) {
        ScryptClaim storage claim = claims[claimID];
        require(claimExists(claim));
        return claim.bondedDeposits[account];
    }

    // @dev – unlocks a user's bonded deposits from a claim.
    // @param claimID – the claim id.
    // @param account – the user's address.
    // @return – the user's deposit which was unbonded from the claim.
    function unbondDeposit(uint claimID, address account) public returns (uint) {
        ScryptClaim storage claim = claims[claimID];
        require(claimExists(claim));
        //require(claim.decided == true);
        uint bondedDeposit = claim.bondedDeposits[account];
        delete claim.bondedDeposits[account];
        deposits[account] = deposits[account].add(bondedDeposit);
        DepositUnbonded(claimID, account, bondedDeposit);

        return bondedDeposit;
    }

    // @dev – check whether a DogeCoin blockHash was calculated correctly from the plaintext block header.
    // only callable by the DogeRelay contract.
    // @param _plaintext – the plaintext blockHeader.
    // @param _blockHash – the blockHash.
    // @param claimant – the address of the Dogecoin block submitter.
    function checkScrypt(bytes _plaintext, bytes _blockHash, address claimant) onlyBy(dogeRelay) public returns (uint) {
        require(deposits[claimant] >= minDeposit);

        ScryptClaim storage claim = claims[numClaims];
        claim.claimant = claimant;
        claim.plaintext = _plaintext;
        claim.blockHash = _blockHash;
        claim.numChallengers = 0;
        claim.currentChallenger = 0;
        claim.verificationOngoing = false;
        claim.createdAt = block.number;
        claim.decided = false;

        bondDeposit(numClaims, claimant, minDeposit);
        ClaimCreated(numClaims, claim.claimant, claim.plaintext, claim.blockHash);

        numClaims.add(1);
        return numClaims;
    }

    // @dev – challenge an existing Scrypt claim.
    // triggers a downstream claim computation on the scryptVerifier contract
    // where the claimant & the challenger will immediately begin playing a verification.
    //
    // @param claimID – the claim ID.
    function challengeClaim(uint claimID) public {
        ScryptClaim storage claim = claims[claimID];

        require(claimExists(claim));
        require(!claim.decided);
        require(claim.sessions[msg.sender] == 0);

        require(deposits[msg.sender] >= minDeposit);
        bondDeposit(claimID, msg.sender, minDeposit);

        claim.challengeTimeoutBlockNumber = block.number.add(defaultChallengeTimeout);
        uint sessionId = scryptVerifier.claimComputation(msg.sender, claim.claimant, claim.plaintext, claim.blockHash, 2050);
        claim.sessions[msg.sender] = sessionId;
        claim.numChallengers = claim.numChallengers.add(1);
        ClaimChallenged(claimID, msg.sender, sessionId);
    }

    // @dev – called when a verification game has ended.
    // only callable by the scryptVerifier contract.
    //
    // @param sessionId – the sessionId.
    // @param winner – winner of the verification game.
    // @param loser – loser of the verification game.
    function sessionDecided(uint sessionId, uint claimID, address winner, address loser) onlyBy(address(scryptVerifier)) public {
        ScryptClaim storage claim = claims[claimID];

        require(claimExists(claim));

        //require(claim.verificationOngoing == true);
        claim.verificationOngoing = false;

        // reward the winner, with the loser's bonded deposit.
        uint depositToTransfer = claim.bondedDeposits[loser];
        delete claim.bondedDeposits[loser];
        claim.bondedDeposits[winner] = claim.bondedDeposits[winner].add(depositToTransfer);

        SessionDecided(sessionId, winner, loser);
    }

    // @dev – check whether a claim has successfully withstood all challenges.
    // if successful, it will trigger a callback to the DogeRelay contract,
    // notifying it that the Scrypt blockhash was correctly calculated.
    //
    // @param claimID – the claim ID.
    function checkClaimSuccessful(uint claimID) public {
        ScryptClaim storage claim = claims[claimID];

        require(claimExists(claim));

        // check that the claim has exceeded the default challenge timeout.
        require(block.number.sub(claim.createdAt) > defaultChallengeTimeout);

        //check that the claim has exceeded the claim's specific challenge timeout.
        require(block.number > claim.challengeTimeoutBlockNumber);

        // check that there is no ongoing verification game.
        require(claim.verificationOngoing == false);

        // check that all verification games have been played.
        require(claim.numChallengers == claim.currentChallenger);

        require(claim.decided);

        unbondDeposit(claim.id, claim.claimant);

        dogeRelay.scryptVerified(claim.plaintext, claim.blockHash);

        ClaimSuccessful(claimID, claim.claimant, claim.plaintext, claim.blockHash);
    }

    function claimExists(ScryptClaim claim) pure private returns(bool) {
        return claim.claimant != 0x0;
    }

    function firstChallenger(uint claimID) public view returns(address) {
        require(claimID < numClaims);
        return claims[claimID].challengers[0];
    }

    function createdAt(uint claimID) public view returns(uint) {
        require(claimID < numClaims);
        return claims[claimID].createdAt;
    }

    //Only one challenger can have a session
    function getSession(uint claimID) public view returns(uint) {
        return claims[claimID].sessions[msg.sender];
    }
}