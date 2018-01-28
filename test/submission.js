
require('dotenv').config()
require('./helpers/chai').should()
web3.eth.defaultAccount = web3.eth.accounts[0]

const getAllEvents = require('./helpers/events').getAllEvents
const getContracts = require('../client/util/getContracts')

const {
  serializedBlockHeader,
  scryptHash,
} = require('./helpers/blockheader')

describe('DogeRelay + ClaimManager submission', function () {
  this.timeout(50000)

  let c
  let claimant

  before(async () => {
    c = await (await getContracts(web3)).deploy()
    claimant = web3.eth.accounts[0]
  })

  it('should deposit some money', async () => {
    await c.claimManager.makeDeposit({ value: web3.toWei(1) })
  })

  it('should have deployed correctly', async () => {
    (await c.claimManager.dogeRelay.call())
      .should.eq(c.dogeRelay.address)
  })

  it('should have a minDeposit', async () => {
    (await c.claimManager.minDeposit.call())
      .should.be.bignumber.gt(0)
  })

  it('should produce the ClaimCreated event after a claim is created', async () => {
    await c.dogeRelay.verifyScrypt(serializedBlockHeader, scryptHash, claimant, 'test')

    const result = await getAllEvents(c.claimManager, 'ClaimCreated')
    result.length.should.be.gt(0)
  })
})
