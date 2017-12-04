module.exports = async (web3) => {
  const emitter = web3.eth.subscribe('newBlockHeaders', (err) => {
    if (err) { console.error(err) }
  })

  return {
    emitter,
    waitForBlock: async (num) => new Promise((resolve, reject) => {
      emitter.on('data', (block) => {
        if (block.number >= num) {
          resolve(block)
        }
      })
      emitter.on('error', reject)
    }),
  }
}
