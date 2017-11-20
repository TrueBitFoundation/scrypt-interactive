#!/bin/bash

# if geth attach returns with permission denied, change the location of the geth.ipc file
# geth --verbosity 6 --dev --rpc --rpcapi admin,miner,eth,net,web3,personal --rpcaddr "localhost" --rpcport "8546" --port "30303" --datadir /tmp/ethereum_dev_mode &>/dev/null &
geth --ipcpath /tmp/ethereum_dev_mode/geth.ipc --verbosity 6 --dev --rpc --rpcapi admin,miner,eth,net,web3,personal --rpcaddr "localhost" --rpcport "8546" --port "30303" --datadir /tmp/ethereum_dev_mode &>/dev/null &

GETH_PID=$!

sleep 2

# geth --exec 'loadScript("./test_manual/gethconfig.js")' attach 'http://127.0.0.1:8546'
geth --exec 'loadScript("./test_manual/gethconfig.js")' attach ipc://tmp/ethereum_dev_mode/geth.ipc

# pass the test filename as an argument.
node $@

kill -9 $GETH_PID
