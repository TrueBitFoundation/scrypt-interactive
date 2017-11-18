pragma solidity ^0.4.0;

import './scryptRunner.sol';
import {DepositsManager} from './DepositsManager.sol';
import {ScryptVerifier} from "./scryptVerifier.sol";

// ClaimManager: queues a sequence of challengers to play with a claimant.

contract ClaimManager is DepositsManager {
    uint private numClaims = 0;     // index as key for the claims mapping.
    uint private minDeposit = 1;    // TODO: what should the minimum deposit be?
    uint private challengeTimeout = 40;  // claimant needs to unchallenged for 40 blocks, before a blockHash is deemed correct.

    address dogeRelayAddress;
    address receiver;
    address scryptVerifierAddress;

    event DepositBonded(uint claimID, address account, uint amount);
    event DepositUnbonded(uint claimID, address account, uint amount);
    event ClaimCreated(uint claimID);

    struct ScryptClaim {
        uint id;
        uint numChallengers; // index to key challengers mapping.
        address claimant;
        bytes plaintext;    // the plaintext Dogecoin block header.
        bytes blockHash;    // the Dogecoin blockhash.
        uint lastChallengeAt; // the block number at which the last challenge came in.
        mapping (uint => address) challengers;      // all current challengers.
        mapping (address => uint) bondedDeposits;   // all deposits bonded in this claim.
    }

    mapping(uint => ScryptClaim) private claims;
    ScryptClaim private task;
    
    modifier onlyBy(address _account) {
        require(msg.sender == _account);
        _;
    }

    ScryptVerifier sv;
 
    // @dev – the constructor
    function ClaimManager(address dogeRelayAddress, address scryptVerifierAddress) public {
        owner = msg.sender;
        dogeRelayAddress = dogeRelayAddress;
        sv = ScryptVerifier(scryptVerifierAddress);
    }

    // @dev – locks up part of the a user's deposit into a claim.
    // @param claimID – the claim id.
    // @param account – the user's address.
    // @param amount – the amount of deposit to lock up. 
    // @return – the user's deposit bonded for the claim.
  function bondDeposit(uint claimID, address account, uint amount) private returns (uint) { 
        ScryptClaim storage claim = claims[claimID];
        require(deposits[msg.sender] >= amount);
        deposits[account] = deposits[account].sub(amount);
        task.bondedDeposits[account] = task.bondedDeposits[account].add(amount);
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
    claim.lastChallengeAt = block.number;

        bondDeposit(numClaims, claimant, minDeposit); 
        ClaimCreated(numClaims);

    numClaims.add(1);
    return numClaims;
    }

    // @dev – challenge an existing Scrypt claim.
    // triggers a downstream claim computation on the scryptVerifier contract
    // where the claimant & the challenger will immediately begin playing a verification.
    //
    // @param claimID – the claim ID.
    function challengeClaim(uint claimID) public {
        require(deposits[msg.sender] >= minDeposit);
        bondDeposit(claimID, msg.sender, minDeposit);

        ScryptClaim storage claim = claims[claimID];
        claim.challengers[0] = msg.sender;
        claim.numChallengers = claim.numChallengers.add(1);
        claim.lastChallengeAt = block.number;

        // call into the scryptVerifier contract.
        ScryptVerifier scryptVerifier = ScryptVerifier(scryptVerifierAddress);
        //scryptVerifier.claimComputation(receiver, amount); // TODO: fix this.
    }

    // @dev – called when a verification game has ended.
    // only callable by the scryptVerifier contract.
    //
    // @param claimID – the claim ID.
    // @param winner – winner of the verification game.
    // @param loser – loser of the verification game.
    function claimDecided(uint claimID, address winner, address loser) onlyBy(scryptVerifierAddress) public {
        ScryptClaim storage claim = claims[claimID];

        // reward the winner, with the loser's bonded deposit.
        uint depositToTransfer = claim.bondedDeposits[loser];
        delete claim.bondedDeposits[loser];
        claim.bondedDeposits[winner] = claim.bondedDeposits[winner].add(depositToTransfer);
        
        if (claim.claimant == loser) {
            // the claim is over.

            // unlock the deposits of all challengers
            for (uint index = 0; index < claim.numChallengers; index++) {
                unbondDeposit(claim.challengers[index]);
                delete claim.challengers[index];
            }
        } else if (claim.claimant == winner) {
            // the claim continues.
            delete claim.challengers[loser];
        }
    } 

    // @dev – check whether a claim has successfully withstood all challenges.
    // if successful, it will trigger a callback to the DogeRelay contract,
    // notifying it that the Scrypt blockhash was correctly calculated.
    // 
    // @param claimID – the claim ID.
    function checkClaimSuccessful(uint claimID) public {
        ScryptClaim storage claim = claims[claimID];
        
        // TODO: check that there are no on-going challenges.

        // check that claim has gone unchallenged for the required number of blocks.
        if (block.number - claim.lastChallengeAt > challengeTimeout) {
            // the claim is successful.

            unbondDeposit(claim.claimant);

            // there should be no one in this for loop..
            for (uint index = 0; index < claim.numChallengers; index++) {
                unbondDeposit(claim.challengers[index]);
                delete claim.challengers[index];
            }

            // TODO: callback to the DogeRelay.
            // DogeRelay.scryptVerified(claim.plaintext, claim.blockHash);
        }
    }
}

