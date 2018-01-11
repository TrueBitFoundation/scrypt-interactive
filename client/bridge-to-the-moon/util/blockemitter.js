module.exports = async (web3) => {
  const emitter = web3.eth.filter("latest")
  
  // const emitter = web3.eth.subscribe('newBlockHeaders', (err) => {
  //   if (err) { console.error(err) }
  // })

  return {
    emitter,
    waitForBlock: async (num) => new Promise((resolve, reject) => {
      // var block = web3.eth.getBlock(result, true)
      //console.log(block.number-num)
      for(i = 0; i < 20; i++) {
        console.log("Mining block " + i)
        web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0})
      }
      emitter.watch((err, result) => {
        if(err) console.log(err)
        var block = web3.eth.getBlock(result, true);
        if(block.number >= num) {
          resolve(block)
        }
      })

      // emitter.on('data', (block) => {
      //   if (block.number >= num) {
      //     resolve(block)
      //   }
      // })
      // emitter.on('error', reject)
    }),
  }
}
