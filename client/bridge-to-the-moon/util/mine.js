module.exports = (web3) => {
  function mineBlocks(n) {
    for(i = 0; i < n; i++) {
       console.log("Mining block " + i)
      web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0})
    }
  }
  return { mineBlocks: mineBlocks }
}