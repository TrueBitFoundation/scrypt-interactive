
require('dotenv').config()
require('./helpers/chai').should()
web3.eth.defaultAccount = web3.eth.accounts[0]

const getContracts = require('../client/util/getContracts')

const miner = require('./helpers/miner')(web3)
const makeDeposit = require('../client/claimManager/deposit').makeDeposit
const isDepositEnough = require('../client/claimManager/deposit').isDepositEnough

describe('Deposit', function () {
  this.timeout(30000)

  let me = web3.eth.accounts[1]
  let client

  before(async () => {
    const contracts = await (await getContracts(web3)).deploy()
    client = await require('../client')(web3, contracts)
  })

  it('it determines whether the deposit is enough, and makes a deposit', async () => {
    let depositAmount = await client.api.getDeposit(me)
    assert.equal(depositAmount, 0)

    let isEnough = await isDepositEnough(client.api, me)
    assert.isFalse(isEnough)

    // make a deposit
    await makeDeposit(console, client.api, me, 2)
    await miner.mineBlock()

    depositAmount = await client.api.getDeposit(me)
    assert.equal(depositAmount.toNumber(), 2)

    isEnough = await isDepositEnough(client.api, me)
    assert.isTrue(isEnough)
  })
})
