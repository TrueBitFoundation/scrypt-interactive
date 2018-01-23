
require('dotenv').config()
const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP_PROVIDER))

require('./helpers/chai').should()

describe('Integration!!', () => {
  let bridge
  before(async () => {
    bridge = await require('../client/bridge-to-the-moon')(web3)
    // spin up parity
    // spin up ganache-cli
    // deploy contracts
    // set addresses in ENV
    // set dogeRelayAddress for claimManager
  })

  after(async () => {
    // teardown processes
  })

  describe('ClaimManager', () => {
    it('does stuff', async () => {
      (await bridge.api.getDeposit('0x0'))
        .should.be.bignumber.equal(0)
      // test deposit CRUD
      // test monitorClaim and then run through the entire flow
    })
  })
})
