[![Build Status](https://travis-ci.org/TrueBitFoundation/scrypt-interactive.svg?branch=master)](https://travis-ci.org/TrueBitFoundation/scrypt-interactive)

# Truebit Verification for Scrypt.

## Overview

This repo provides a proof-of-concept implementation of the Truebit smart contract system.<br/>

It enables a step-by-step running and verification of the [Scrypt](https://en.wikipedia.org/wiki/Scrypt) hashing function on the EVM.<br/>

This can form the basis of a Dogecoin/Ethereum relay. Dogecoin uses Scrypt for its Proof-of-Work algorithm, specifically to calculate the block hash. Therefore, an ability to compute Scrypt hashes is required in order to verify the validity of Dogecoin transactions, as it allows one to check Merkle proofs from a known block header. This computation is too large given Ethereum's gas constraints, making it an ideal use case for Truebit.<br/>

For more context on how relays work, look at the [BTCRelay](https://github.com/ethereum/btcrelay) project.<br/>

![Protocol Schematic](./doge-eth.png)

## Running the Tests

You will need to have parity, which can be done by downloading a binary release for your machine from [here](https://github.com/paritytech/parity/releases)

```bash
# install parity however you want, but this is an easy way to do it if you're on a mac
cd ~/
wget https://parity-downloads-mirror.parity.io/v1.8.5/x86_64-unknown-linux-gnu/parity
chmod 755 ./parity
```

Ensure you have the latest version of node installed.

You will need a testrpc and truffle:
```bash
npm install -g ganache-cli truffle
```

Then install packages deps:
```bash
npm install
```

Then, you can run tests by executing the `run.sh` script:
```bash
./bin/run.sh
```

Or you can run parity with this config:

```bash
parity --config config.toml --geth
```

In a separate terminal window run ganache-cli
```bash
ganache-cli
```

Then run the tests with:
```bash
truffle test
```

## Easy Parity Installation

For MacOS

```bash
brew install parity
```

Everyone else, download latest binary relase for your OS from [here](https://github.com/paritytech/parity/releases)

You might need to run parity and kill it once if you are getting an issue with accounts.

```bash
./parity --chain dev
```

Kill it. Then do:

```bash
./parity --config config.toml --geth
```

Which runs the parity dev chain needed for the offchain component.

## Database Migrations

To run migrations:
```
sequelize db:migrate
```

## Running Normally

Deploy the contracts (or reference the addresses on the network you're using) and add them to your environment.

```bash
export WEB3_HTTP_PROVIDER=http://localhost:8545
export WEB3_PARITY_PROVIDER=http://localhost:4242
export DOGE_RELAY_ADDRESS=0x0
export SCRYPT_VERIFIER_ADDRESS=0x0
export SCRYPT_RUNNER_ADDRESS=0x0
export CLAIM_MANAGER_ADDRESS=0x0
```

Then

```
node client/cli.js
```

use `--help` to see help, `status` for bridge status, and `monitor` to operate as a potential challenger.

## Testing out the client (bridge-to-the-moon)

Ensure you have followed all installation instructions above, and have ganache-cli at 8545 and parity dev at 4242 for the offchain computations.

```bash
export WEB3_HTTP_PROVIDER=http://localhost:8545
export WEB3_PARITY_PROVIDER=http://localhost:4242
export DOGE_RELAY_ADDRESS=0x0
export SCRYPT_VERIFIER_ADDRESS=0x0
export SCRYPT_RUNNER_ADDRESS=0x0
export CLAIM_MANAGER_ADDRESS=0x0
```

Then run the integration tests (TODO) with

```bash
npm run test:integration
```

## Doge-Ethereum bounty split contract

 The bounty contract is deployed at: `0x1ed3e252dcb6d540947d2d63a911f56733d55681`
