[![Build Status](https://travis-ci.org/TrueBitFoundation/scrypt-interactive.svg?branch=master)](https://travis-ci.org/TrueBitFoundation/scrypt-interactive)

# Truebit Verification for Scrypt.

## Overview

This repo provides a proof-of-concept implementation of the Truebit smart contract system.

It enables a step-by-step running and verification of the [Scrypt](https://en.wikipedia.org/wiki/Scrypt) hashing function on the EVM.

This can form the basis of a Dogecoin/Ethereum relay. Dogecoin uses Scrypt for its Proof-of-Work algorithm, specifically to calculate the block hash. Therefore, an ability to compute Scrypt hashes is required in order to verify the validity of Dogecoin transactions, as it allows one to check Merkle proofs from a known block header. This computation is too large given Ethereum's gas constraints, making it an ideal use case for Truebit.

For more context on how relays work, look at the [BTCRelay](https://github.com/ethereum/btcrelay) project.

![Protocol Schematic](./doge-eth.png)


## Technical Overview

> Read this if you're interested in running this code at all.

Parity is the only Ethereum client that doesn't have a timeout on EVM operations, which allows us to run the ScryptRunner contract past 1000 iterations of the scrypt hashing algorithm. This means it's necessary to, when acting as a challenger/claimant, have a local install of parity that's used to compute state roots and whatnot.

The rest of our contracts live on whatever arbitrary chain you want (currently ganache for local development, ropsten for staging, and mainnet for production).

There are 3 actors in the system:

1. The claimant submitting doge block headers to the DogeRelay contract.
    - The claimant must also defend their block headers in the event of a challenge.
2. The challenger that has the option of challenging a claimant's block headers.
3. The user who wishes to use the bridge to move dogecoins to Ethereum
    - This user can be the same as the claimant, but it's not necessary.
    - This user provides a merkle proof of a tx on dogecoin that is validated against the blockheader stored in DogeRelay.
    - DogeRelay can trust the blockheader submissions due to the protocol described in this repo.

We also run a postgres database to keep track of state. So run postgres on `5432`.

## Running the Project

The addresses of the doge relay on mainnet are

```
# @TODO - update this once we deploy
DOGE_RELAY_ADDRESS=0xd5cd4e3bede456d9e1da2582d7771fdbf6e28846
SCRYPT_VERIFIER_ADDRESS=0xc4291fc3a35a66c993a47b96079e5439c5febe16
SCRYPT_RUNNER_ADDRESS=0x75d860a49037082f1c96fe0c527f7cb9be3a3be6
CLAIM_MANAGER_ADDRESS=0xff35220a6e4771b94bf1a92cf27f060d6598b1c7
```

For your convenience, they've been coded into `.env`, but if you're interested in running against a different chain, make sure to deploy and then update those values.

## Installing Dependencies

You will need to have parity. Feel free to install it however you want, but you can also download a binary release for your machine from [here](https://github.com/paritytech/parity/releases).
```bash
# make sure it's executable
chmod 755 ./parity
# add it to your PATH if you want to use our scripts for launching it
```

Initialize the parity development chain database with
```bash
parity --chain dev
```

Let that run for 5 seconds or whatever and then kill it. In the future we'll run parity with
```bash
npm run parity
# or
parity --config config.toml --geth
```

Ensure you have the latest version of node installed.

Then install packages deps:
```bash
npm install
```

Make sure your env is set up with the correct operator address if it's not the default account associated with your node. So unlock your account in your local node and then set `OPERATOR_ADDRESS` to whatever that is.

By default, we expect the node you're communicating with to exist at `http://localhost:8545`. Sync your geth or parity node with your preferred chain and make it available here. You can configure this with the `WEB3_HTTP_PROVIDER` env variable.

Install postgres. The internet is your friend here. Run it at the default port of `5432`.

## Database installation (Ubuntu)
```
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

user Bootstrap your database with

```bash
sequelize db:create
sequelize db:migrate
NODE_ENV=test sequelize db:create
NODE_ENV=test sequelize db:migrate
```

### CLI Help

```bash
bridge --help
```

### Becoming a Challenger

Make sure you've installed the dependencies above.

Make sure your env is set up with the correct contract addresses (defaults to well-known mainnet contracts).

Then run the cli, acting as a challenger.

```bash
bridge monitor [-c, --auto-challenge] [-d, --auto-deposit]
```

The `challenge` and `deposit` flags configure how the bridge behaves. They should be self-explanatory. By default the monitor process will exclusively watch the bridge events.

If this ever crashes, it will intelligently resume where it left off.

As a challenger, your account must have the appropriate amount of Ether to stake per-claim you want to challenge. Make sure your address has enough Ether available for at least one challenge or it won't be able to do anything but watch.

### Becoming a Claimant

To become a claimant, your job is to submit doge block headers and the defend them against challenges. If you never submit an invalid doge header (who would do that??), you'll never have to play the verification game.

Regardless, you must have enough Ether deposited within the ClaimManager in order to submit blocks.

```bash
# @TODO
bridge claim <block_header> <block_header_hash>
```

### Managing Deposits

Manage your deposits using the cli.

Show the status of the bridge with:
```bash
# @TODO
bridge status
```

Deposit Ether into the ClaimManager (used for staking in the verification game) with:
```bash
# @TODO
bridge deposit <amout_in_ether>
```

Withdraw Ether from the ClaimManager with:
```bash
# @TODO
bridge withdraw <amout_in_ether>
```

Note that you can only withdraw Ether that is not actively being staked on a challenge.

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

## Running the Tests

Running the tests involves
1. Running ganache `npm run ganache`
2. Running parity `npm run parity`
3. Running the tests `npm run test`

We also have a convenient `test.sh` script that does all that for you.
```bash
./bin/test.sh
```

## Database Migrations

To run migrations:
```
sequelize db:migrate
```

To run on test db:
```
NODE_ENV=test sequelize db:migrate
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

## Doge-Ethereum Bounty Split Contract

We're splitting the bounty with additional developers via smart contract.

The bounty contract is deployed at: `0x1ed3e252dcb6d540947d2d63a911f56733d55681`
