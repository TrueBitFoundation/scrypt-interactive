const promisify = require('es6-promisify')
const timeout = require('./timeout')

const mineBlocks = (web3) => async (n) => {
  for (let i = 0; i < n; i++) {
    if (process.env.IS_GETH_TEST) {
      await timeout(3000)
    } else {
      await web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_mine',
        params: [],
        id: 0,
      })
      await timeout(1000)
    }
  }
}

const mineBlock = (web3) => async () => mineBlocks(web3)(1)

module.exports = (web3) => ({
  mineBlock: mineBlock(web3),
  mineBlocks: mineBlocks(web3),
})
