
require('dotenv').config()
const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP_PROVIDER))

require('./helpers/chai').should()

describe('Integration!!', () => {
  let bridge
  before(async () => {
    bridge = await require('../client/bridge-to-the-moon')(web3)
    
    accounts = web3.eth.accounts
    process.env.OPERATOR = accounts[0]

    if(await bridge.api.claimManager.dogeRelay.call() == '0x0') {

      let dogeRelayAddress = bridge.getContracts().dogeRelay.address

      await bridge.api.claimManager.setDogeRelay(dogeRelayAddress, {from: process.env.OPERATOR})
    }


  })

  after(async () => {
    // teardown processes
  })

  context('normal conditions', () => {
    it('')
  })
})
