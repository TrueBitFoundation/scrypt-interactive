const Web3 = require('web3')
const Bridge = require('../bridge')
const Api = require('../api')

// let's monekypatch web3 cause it doesn't play nice with truffle-contract yet
//Web3.providers.WebsocketProvider.prototype.sendAsync = Web3.providers.WebsocketProvider.prototype.send

// @TODO(shrugs) - there's got to be a better pattern for init-once promises
module.exports = async function () {
  if (this.res) { return this.res }
  const provider = new Web3.providers.WebsocketProvider(process.env.WEB3_WS_PROVIDER || 'ws://localhost:8546')
  const web3 = new Web3(provider)

  const contractAddresses = {
    claimManager: process.env.CLAIM_MANAGER_ADDRESS || '0xcafecafecafecafecafecafecafecafecafecafe',
  }

  const bridge = await Bridge(web3, contractAddresses)
  const api = await Api(web3, contractAddresses)
  // @TODO(shrugs) - enable this
  // await api.testConnection()

  this.res = { web3, bridge, api }
  return this.res
}
