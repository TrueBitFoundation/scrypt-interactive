#!/bin/bash

#just to be safe
echo > passfile

cd bin

wget https://parity-downloads-mirror.parity.io/v1.8.5/x86_64-unknown-linux-gnu/parity

chmod 755 ./parity
echo > passfile

npm cache verify
npm install
npm install -g ganache-cli truffle

./parity --chain dev 2>&1 &

PARITY_PID=$!
sleep 10
kill -9 $(lsof -t -i:8545)