#!/bin/bash
geth --verbosity 6 --dev --rpc --rpcapi admin,miner,eth,net,web3,personal --rpcaddr "localhost" --rpcport "8545" --port "30303" --datadir /tmp/ethereum_dev_mode &>/dev/null &
sleep 2
geth --exec 'loadScript("./test/gethconfig.js")' attach http://127.0.0.1:8545
node ./test/index.js
GETH_PID=$(pgrep geth | gawk '{print $1}')
kill -9 $GETH_PID
