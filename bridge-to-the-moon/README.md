# Doge to The Moon
> The off-chain client for the DOGE-ETH bridge developed by TrueBit

- See [scrypt-interactive](https://github.com/TrueBitFoundation/scrypt-interactive) for the details of the bridge.

## Requirements

- Node v9.2.0
- Geth 1.7.3

## Implementation

A summary of the bridge mechanics is as follows:

First, the claimant and challenger(s) must deposit ETH to stake on their rational behavior. This is done via the `ClaimManager#makeDeposit` method.

An off-chain party submits a serialized, hex-encoded blockheader (`blockheader`, ex: `030162002adb34dfa6574cf127a781ecb9683ca28f911a59020628c90c72b4a3d9942233a3b905b2388b020085dbd9e03209db4493f5420336d882d0b78b54f728b8f90058f7115a2c83221a00000000`) and hash (`hash`, ex: `ce60a0d4a7c2223a94437d44fe4d33a30489436714d18376f9ebc5e2bd6e5682`) to the DogeRelay contract using `DogeRelay#storeBlockHeader(blockheader, hash)`.

At any point after a doge header's block has been validated by the bridge (we'll talk about that next), a third party that wants to use the bridge to transfer funds can call `DogeRelay#relayDogeTx(tx, spvProof)` to verify that a transaction was created with the new LOCK opcode. (this part doesn't need a verification game because the merkle hash function for doge is cheap in the EVM).

When `DogeRelay#storeBlockHeader` is called, it also calls `ClaimManager#checkScrypt`. `checkScrypt` does a few things:

1. it bonds the deposit of the claimant
2. stores the claim information in `claims[idx]`
3. announces `ClaimCreated(id, claimant, blockheader, hash)`
4. it starts the validation phase where anyone can challenge the claim.
5. It starts the "challengeTimeout" timer.

The bridge-to-the-moon (`bttm`) client configured to act as a verifier listens to `ClaimCreated` events.

When a claim is created, `bttm` checks the scrypt PoW for the supplied blockheader.

If the scrypt claim is correct, we do nothing.

If the scrypt claim is incorrect, we challenge the claim by calling `ClaimManager#challengeClaim(claimId)`. `challengeClaim` does the following:

1. bonds the challenger's deposit
2. adds that challenger to the list of challengers
3. announces `ClaimChallenged(id, challengerAddress)`

After `challengeTimeout`, if there are no challenges, someone (generally the claimant, since they probably want their deposit back) will call `checkClaimSuccessful(claimId)` to resolve the claim. If this method is successful, the DogeRelay contract is notified and it will respect transactions that claim they are in that block.

If there are challenges, someone (generally the next challenger, because they want to win) will call `ClaimManager#runNextVerificationGame(claimId)` to kick off the verifiation game.

The verification game is a binary search over the set of states that can exist in a scrypt proof of work verification.

First, a verification session is created. Then the challenger chooses a step within the (0, 2050) step range of scrypt. At first this should just be 2050/2.

1. The challenger issues a `query()` command with their provided step, challenging the claimant to provide a state hash for that step.
2. The claimant runs their proof of work (using `getStateAndProof`) and submits the state hash for a step
3. The challenger sees this state hash and compares it to their own version from `getStateAndProof`
    - if it is wrong, the error must be within (0, midStep)
    - if it is correct, the error must be within (midStep, 2050)
4. The challenger divides the current step by two and then recurses to step 1.
5. Once we've converged on the middle by using `query()` and `respond()` (aka when `lowStep + 1 === highStep`), the claimant can call the (poorly named) `performStepVerification` function. They can also refuse to call this function and the challenger can call `timeout()` after the appropriate block.
6. The `performStepVerification` announces some events and then called `claimDecided`.

Once a game has been decided, `ClaimManager#claimDecided(claimId, winner, loser)` is called by the ScryptVerifier contract. (step 6, above)

If the claimant won, the challenger loses deposit and the verification games continue.

If the claimant lost, the block claim is invalid and all challenger deposits are unbonded. The winning challenger is rewarded with the claimant's deposit.


## TODO

This all still needs to be tested against the actual contracts. And like, run in general.
