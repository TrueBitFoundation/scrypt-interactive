#!/bin/bash
# if geth attach returns with permission denied, change the location of the geth.ipc file
geth --ipcpath /tmp/ethereum_dev_mode/geth.ipc --verbosity 6 --dev --rpc --rpcapi admin,miner,eth,net,web3,personal --rpcaddr "localhost" --rpcport "8545" --port "30303" --datadir /tmp/ethereum_dev_mode &>/dev/null &
GETH_PID=$!
sleep 2
geth --exec 'loadScript("./test/gethconfig.js")' attach ipc://tmp/ethereum_dev_mode/geth.ipc
node ./test/client.js $1
kill -9 $GETH_PID