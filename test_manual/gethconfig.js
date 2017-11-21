personal.unlockAccount(eth.accounts[0], "", 10000000)
personal.unlockAccount(eth.accounts[1], "", 10000000)
personal.unlockAccount(eth.accounts[2], "", 10000000)
// and copy the account to below
miner.setEtherbase(eth.accounts[0])
var mining_threads = 1
function checkWork() {
    if (eth.pendingTransactions.length > 0) {
        if (eth.mining) return;
        console.log("== Pending transactions! Mining...");
        miner.start(mining_threads);
    } else {
        miner.stop();
        console.log("== No transactions! Mining stopped.");
    }
}
eth.filter("latest", function(err, block) { checkWork(); });
eth.filter("pending", function(err, block) { checkWork(); });
checkWork();