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
