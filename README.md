
# Truebit Verification for Scrypt.

## Overview

This repo provides a proof-of-concept implementation of the Truebit smart contract system.

It enables a step-by-step running and verification of the [Scrypt](https://en.wikipedia.org/wiki/Scrypt) hashing function on the EVM.

This can form the basis of a Dogecoin/Ethereum relay. Dogecoin uses Scrypt for its Proof-of-Work algorithm, specifically to calculate the block hash. Therefore, an ability to compute Scrypt hashes is required in order to verify the validity of Dogecoin transactions, as it allows one to check Merkle proofs from a known block header. This computation is too large given Ethereum's gas constraints, making it an ideal use case for Truebit.

For more context on how relays work, look at the [BTCRelay](https://github.com/ethereum/btcrelay) project.

![Protocol Schematic](./doge-eth.png)


The client relies on a local Parity instance to execute the ScryptRunner contract and compute state roots. These calls do not write to the blockchain, and conveniently, the Parity client does not trigger a timeout for long-running EVM operations.

The rest of the contracts can be deployed on any chain (currently ganache for local development, Rinkeby for staging, and mainnet for production).

There are 2 actors in the system:

1. The Claimant:
    -  submits doge block headers to the DogeRelay contract.
    -  must also defend their block headers in the event of a challenge.
2. The Verifier:
    -  monitors the Truebit contract and challenges incorrect claims.

The address for the contracts as deployed on Rinkeby are in the [`.env`](https://github.com/TrueBitFoundation/scrypt-interactive/blob/master/.env) file.

## Running the client

The client software is open-source and available in this repo.

Follow [these directions](https://github.com/TrueBitFoundation/scrypt-interactive/blob/master/docs/setup.md) to setup the client.

Use the CLI tool to interact with the client:

```bash
# check the status
npm start status

# manage your deposits
npm start deposit <amout_in_ether>
npm start withdraw <amout_in_ether>

# monitor the system as a Verifier.
# note: you must have the required amount of eth deposited to stake per claim you want to challenge;
# otherwise, it won't be able to do anything but watch.
npm start monitor --auto-challenge

# submit a claim as a Claimant.
# note: you must defend your claim (scrypt hash and plaintext payload) against challenges. 
# note: you must have the required amount of eth deposited to stake.
npm start claim <input> <hash> <proposalID>

```

## Running the tests

First, install the needed dependencies as described in the [setup docs](https://github.com/TrueBitFoundation/scrypt-interactive/blob/master/docs/setup.md).

Running the tests involves
1. Running ganache `npm run ganache`
2. Running parity `npm run parity`
3. Running the tests `npm run test`

We also have a convenient `test.sh` script that does all that for you.
```bash
./bin/test.sh
```

## Deploying the contracts

To deploy the contracts to your favorite chain:

```bash
# first:
# update the .env file.

# then
npm run migrate:rinkeby  # or target another chain.

# then
# update the resulting contract addresses in .env

```

