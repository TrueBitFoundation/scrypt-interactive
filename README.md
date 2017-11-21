[![Build Status](https://travis-ci.org/TrueBitFoundation/scrypt-interactive.svg?branch=master)](https://travis-ci.org/TrueBitFoundation/scrypt-interactive)

# Truebit Verification for Scrypt.

## Overview

This repo provides a proof-of-concept implementation of the Truebit smart contract system.<br/>
It enables a step-by-step running and verification of the [Scrypt](https://en.wikipedia.org/wiki/Scrypt) hashing function on the EVM.<br/>
This can form the basis of a Dogecoin/Ethereum relay. Dogecoin uses Scrypt for its Proof-of-Work algorithm, specifically to calculate the block hash. Therefore, an ability to compute Scrypt hashes is required in order to verify the validity of Dogecoin transactions, as it allows one to check Merkle proofs from a known block header. This computation is too large given Ethereum's gas constraints, making it an ideal use case for Truebit.<br/>
For more context on how relays work, look at the [BTCRelay](https://github.com/ethereum/btcrelay) project.<br/>

## Running the Tests

There are two sets of tests:

### Truffle tests:

To run these tests, run `truffle test` in the root directory of the repo.

### The low level tests:

To run these tests you need `geth` and a JS `node` version higher than 7.6. 

After getting those, use `run.sh` to run tests in the root directory:
```
# you can run all tests
./run.sh test_manual/index.js

# you can run a specific test file. e.g.:
./run.sh test_manual/client.js

```

Also note that you will need to have an account in the data directory that geth has been passed. `run.sh` does not make one for you. You can either copy an existing account there or just run:<br/>
```bash

geth --datadir /tmp/ethereum_dev_mode --password /path/to/password/file account new

```

Also make sure that when you run a process in the background it is not suspended. You could use `ps -aux | grep geth` to see geth's status. if it is suspended, just run `stty tostop` to toggle your terminal's behavour.<br/>