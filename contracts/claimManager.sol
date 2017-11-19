pragma solidity ^0.4.0;

import {DepositsManager} from './DepositsManager.sol';
import {ScryptVerifier} from "./scryptVerifier.sol";

// ClaimManager: queues a sequence of challengers to play with a claimant.

contract ClaimManager is DepositsManager {
    uint private numClaims = 0;     // index as key for the claims mapping.
    uint private minDeposit = 1;    // TODO: what should the minimum deposit be?

    // a claim goes through two stages after being created:
    // stage 1: new challenges are allowed.
    // stage 2: no new challenges are allowed.
    // the claim exists until all verification games are played out.
    // reasoning behind having two stages is to prevent DoS attacks;
    // i.e. a malicious adversary cannot sybil challenge a claim after challengeTimeout blocks have passed.
    uint private challengeTimeout = 20;

    // blocks to wait for callback from scryptVerifier,
    // before moving onto the next.
    // TODO: we're not using this yet.
    uint private verificationGameTimeout = 40;

    address dogeRelayAddress;
    address receiver;
    address scryptVerifierAddress;

    event DepositBonded(uint claimID, address account, uint amount);
    event DepositUnbonded(uint claimID, address account, uint amount);
    event ClaimCreated(uint claimID, address claimant, bytes plaintext, bytes blockHash);
    event ClaimChallenged(uint claimID, address challenger);
    event ClaimVerificationGameStarted(uint claimID, address claimant, address challenger);
    event ClaimDecided(uint claimID, address winner, address loser);
    event ClaimSuccessful(uint claimID, address claimant, bytes plaintext, bytes blockHash);

    struct ScryptClaim {
        uint id;
        address claimant;
        bytes plaintext;    // the plaintext Dogecoin block header.
        bytes blockHash;    // the Dogecoin blockhash.
        uint createdAt;     // the block number at which the claim was created.
        mapping (uint => address) challengers;      // all current challengers.
        uint numChallengers;
        uint lastChallenger;    // index of last challenger who played a verification game.
        bool verificationOngoing;   // is the claim waiting for results from an ongoing verificationg game.
        mapping (address => uint) bondedDeposits;   // all deposits bonded in this claim.
    }

    mapping(uint => ScryptClaim) private claims;
    
    modifier onlyBy(address _account) {
        require(msg.sender == _account);
        _;
    }

    ScryptVerifier sv;
 
    // @dev – the constructor
    function ClaimManager(address _dogeRelayAddress, address _scryptVerifierAddress) public {
        owner = msg.sender;
        dogeRelayAddress = _dogeRelayAddress;
        sv = ScryptVerifier(_scryptVerifierAddress);
    }

    // @dev – locks up part of the a user's deposit into a claim.
    // @param claimID – the claim id.
    // @param account – the user's address.
    // @param amount – the amount of deposit to lock up. 
    // @return – the user's deposit bonded for the claim.
    function bondDeposit(uint claimID, address account, uint amount) private returns (uint) {
        ScryptClaim storage claim = claims[claimID];
        require(deposits[account] >= amount);
        deposits[account] = deposits[account].sub(amount);
        claim.bondedDeposits[account] = claim.bondedDeposits[account].add(amount);
        DepositBonded(claimID, account, amount);
        return claim.bondedDeposits[account];
    }
    
    // @dev – unlocks a user's bonded deposits from a claim.
    // @param claimID – the claim id.
    // @param account – the user's address.
    // @return – the user's deposit which was unbonded from the claim.
    function unbondDeposit(uint claimID, address account) private returns (uint) {
        ScryptClaim storage claim = claims[claimID];
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
    function checkScrypt(bytes _plaintext, bytes _blockHash, address claimant) onlyBy(dogeRelayAddress) public returns (uint) {
        require(deposits[claimant] >= minDeposit);

        ScryptClaim storage claim = claims[numClaims];
        claim.claimant = claimant;
        claim.plaintext = _plaintext;
        claim.blockHash = _blockHash;
        claim.numChallengers = 0;
        claim.lastChallenger = 0;
        claim.verificationOngoing = false;
        claim.createdAt = block.number;

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

        // check that the claim is in Stage 1 (i.e. accepting new challenges).
        require(block.number.sub(claim.createdAt) <= challengeTimeout);

        require(deposits[msg.sender] >= minDeposit);
        bondDeposit(claimID, msg.sender, minDeposit);

        claim.challengers[claim.numChallengers] = msg.sender;
        claim.numChallengers = claim.numChallengers.add(1);
        ClaimChallenged(claimID, msg.sender);
    }

    // @dev – runs a verification game between the claimant and
    // the next queued-up challenger.
    // 
    // @param claimID – the claim id.
    function runNextVerificationGame(uint claimID) public {
        ScryptClaim storage claim = claims[claimID];

        // check if there is a challenger who has not the played verificationg game yet.
        // note: lastChallenger is 0-indexed.
        require(claim.numChallengers >= claim.lastChallenger.add(1));
        
        require(claim.verificationOngoing == false);

        uint thisChallenger = claim.lastChallenger.add(1);
        
        // TODO: kick off a new verification game.
        sv.claimComputation(claim.challengers[thisChallenger], claim.claimant, claim.plaintext, claim.blockHash, 2050);
        ClaimVerificationGameStarted(claimID, claim.claimant, claim.challengers[thisChallenger]);

        claim.verificationOngoing = true;
        claim.lastChallenger = thisChallenger;
    }

    // @dev – called when a verification game has ended.
    // only callable by the scryptVerifier contract.
    //
    // @param claimID – the claim ID.
    // @param winner – winner of the verification game.
    // @param loser – loser of the verification game.
    function claimDecided(uint claimID, address winner, address loser) onlyBy(address(sv)) public {
        ScryptClaim storage claim = claims[claimID];

        claim.verificationOngoing = false;

        // reward the winner, with the loser's bonded deposit.
        uint depositToTransfer = claim.bondedDeposits[loser];
        delete claim.bondedDeposits[loser];
        claim.bondedDeposits[winner] = claim.bondedDeposits[winner].add(depositToTransfer);
    
        ClaimDecided(claimID, winner, loser);
        
        if (claim.claimant == loser) {
            // the claim is over.
            // note: no callback needed to the DogeRelay contract,
            // because it by default does not save blocks.

            // unlock the deposits of all challengers
            for (uint index = 0; index < claim.numChallengers; index++) {
                unbondDeposit(claim.id, claim.challengers[index]);
                delete claim.challengers[index];
            }

            delete claims[claimID];
        } else if (claim.claimant == winner) {
            // the claim continues.
            runNextVerificationGame(claimID);
        }
    }

    // @dev – check whether a claim has successfully withstood all challenges.
    // if successful, it will trigger a callback to the DogeRelay contract,
    // notifying it that the Scrypt blockhash was correctly calculated.
    // 
    // @param claimID – the claim ID.
    function checkClaimSuccessful(uint claimID) public {
        ScryptClaim storage claim = claims[claimID];
        
        // check that the claim is in Stage w (i.e. not accepting new challenges).
        require(block.number.sub(claim.createdAt) > challengeTimeout);
        
        // check that there is no ongoing verification game.
        require(claim.verificationOngoing == false);

        // check that all verification games have been played.
        require(claim.numChallengers == claim.lastChallenger.add(1));

        unbondDeposit(claim.id, claim.claimant);

        // TODO: callback to the DogeRelay.
        // DogeRelay.scryptVerified(claim.plaintext, claim.blockHash);

        ClaimSuccessful(claimID, claim.claimant, claim.plaintext, claim.blockHash);
    }
}

