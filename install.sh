#!/bin/bash

wget https://parity-downloads-mirror.parity.io/v1.8.5/x86_64-unknown-linux-gnu/parity

chmod 755 ./parity

npm install

npm install -g ganache-cli truffle

./parity --chain dev 2>&1 &
PARITY_PID=$!
sleep 10
kill $PARITY_PID