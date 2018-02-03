[![Build Status](https://travis-ci.org/TrueBitFoundation/scrypt-interactive.svg?branch=master)](https://travis-ci.org/TrueBitFoundation/scrypt-interactive)

# Truebit Verification for Scrypt.

## Overview

This repo provides a proof-of-concept implementation of the Truebit smart contract system.

It enables a step-by-step running and verification of the [Scrypt](https://en.wikipedia.org/wiki/Scrypt) hashing function on the EVM.

This can form the basis of a Dogecoin/Ethereum relay. Dogecoin uses Scrypt for its Proof-of-Work algorithm, specifically to calculate the block hash. Therefore, an ability to compute Scrypt hashes is required in order to verify the validity of Dogecoin transactions, as it allows one to check Merkle proofs from a known block header. This computation is too large given Ethereum's gas constraints, making it an ideal use case for Truebit.

For more context on how relays work, look at the [BTCRelay](https://github.com/ethereum/btcrelay) project.

![Protocol Schematic](./doge-eth.png)


The client relies on a local Parity instance to execute the ScryptRunner contract and compute state roots. These calls do not write to the blockchain, and conveniently, the Parity client does not trigger a timeout for long-running EVM operations.

The rest of the contracts can be deployed on any chain (currently ganache for local development, Rinkeby for staging, and mainnet for production).

There are 3 actors in the system:

1. The claimant submitting doge block headers to the DogeRelay contract.
    - The claimant must also defend their block headers in the event of a challenge.
2. The challenger that has the option of challenging a claimant's block headers.
3. The user who wishes to use the bridge to move dogecoins to Ethereum
    - This user can be the same as the claimant, but it's not necessary.
    - This user provides a merkle proof of a tx on dogecoin that is validated against the blockheader stored in DogeRelay.
    - DogeRelay can trust the blockheader submissions due to the protocol described in this repo.


The addresses of the doge relay on mainnet are
```
# @TODO - update this once we deploy
DOGE_RELAY_ADDRESS=0xd5cd4e3bede456d9e1da2582d7771fdbf6e28846
SCRYPT_VERIFIER_ADDRESS=0xc4291fc3a35a66c993a47b96079e5439c5febe16
SCRYPT_RUNNER_ADDRESS=0x75d860a49037082f1c96fe0c527f7cb9be3a3be6
CLAIM_MANAGER_ADDRESS=0xff35220a6e4771b94bf1a92cf27f060d6598b1c7
```

For your convenience, they've been coded into `.env`, but if you're interested in running against a different chain, make sure to deploy and then update those values.

## Running the Tests

First, install the needed dependencies.

Running the tests involves
1. Running ganache `npm run ganache`
2. Running parity `npm run parity`
3. Running the tests `npm run test`

We also have a convenient `test.sh` script that does all that for you.
```bash
./bin/test.sh
```

## Installing Dependencies

Install the Parity Ethereum client. You can download binary release for your machine from [here](https://github.com/paritytech/parity/releases).
```bash
# make sure it's executable
chmod 755 ./parity
# add it to your PATH if you want to use our scripts for launching it
```

Initialize the parity development chain database with
```bash
parity --chain dev
```

Let that run for 5 seconds or whatever and then kill it. In the future, run parity with
```bash
npm run parity
# or
parity --config config.toml --geth
```

Ensure you have the latest version of node installed (currently v9.4.0).

Then install packages deps:
```bash
npm install
npm install -g sequelize-cli
```

Install postgres and run it on the default port `5432`:

```
# Ubuntu instructions for installing psql

sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# Switch over to postgres account
sudo -i -u postgres

# create a new role
createuser --interactive

# enter user name
# then select yes for superuser

# give you user the ability to execute commands as postgres user
# by giving it the right permissions in pg_hba.conf

```

Bootstrap your database with:

```bash
sequelize db:create
sequelize db:migrate
NODE_ENV=test sequelize db:create
NODE_ENV=test sequelize db:migrate
```

Configure your client by updating the `.env` file:

```bash
export WEB3_HTTP_PROVIDER=http://localhost:8545
export WEB3_PARITY_PROVIDER=http://localhost:4242
export DOGE_RELAY_ADDRESS=0x0
export SCRYPT_VERIFIER_ADDRESS=0x0
export SCRYPT_RUNNER_ADDRESS=0x0
export CLAIM_MANAGER_ADDRESS=0x0
```

## The CLI

```bash
bridge --help

# run the cli as a challenger
# The `challenge` and `deposit` flags configure how the bridge behaves.
# note: as a challenger, your account must have the required amount of Ether to stake per claim you want to challenge;
# otherwise, it won't be able to do anything but watch.
bridge monitor [-c, --auto-challenge]

# run the cli as a claimant
# note: your job is to submit doge block headers and defend them against challenges. 
# if you never submit an invalid doge header (who would do that??), you'll never have to play the verification game.
# note: you must have enough Ether deposited within the ClaimManager in order to submit blocks.
# @TODO
bridge claim <block_header> <block_header_hash>

# manage your deposits
# @TODO
bridge deposit <amout_in_ether>
bridge withdraw <amout_in_ether>

# show the status of the bridge
# @TODO
bridge status
```

## Deploying the Contracts

To deploy the contracts to your favorite dev chain,
```bash
npm run migrate:dev
# or
truffle migrate --network :your-chain-here

# use `npm run migrate:dev -- --reset` for force-migrate
```

To deploy the contracts to your favorite infura chain, do something like
```bash
MNEMONIC="your mnemonic here do not put this in a file keep it in the interpreter" \
npm run migrate:rinkeby
# or
MNEMONIC="your mnemonic here do not put this in a file keep it in the interpreter" \
INFURA_CHAIN=ropsten \
truffle migrate --network infura
```

And note the addresses for configuring your env when actually running the code.

## Geth Docker Image Testing

Want to test against a more reasonable test chain?

```
git clone git@github.com:livepeer/docker-livepeer.git
cd docker-livepeer/geth-dev

# replace the latest tag with v1.7.3
s/latest/v1.7.3/g Dockerfile

docker build . -t geth-dev

docker run \
    --name geth-dev --rm -d \
    -p 8545:8545 \
    geth-dev

docker logs -f :container-id
```

## Doge-Ethereum Bounty Split Contract

We're splitting the bounty with additional developers via smart contract.

The bounty contract is deployed at: `0x1ed3e252dcb6d540947d2d63a911f56733d55681`

