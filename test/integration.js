require('dotenv').config()
const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP_PROVIDER))

require('./helpers/chai').should()

const getAccounts = require('./helpers/getAccounts')
const timeout = require('./helpers/timeout')

const serializedBlockHeader = '030162002adb34dfa6574cf127a781ecb9683ca28f911a59020628c90c72b4a3d9942233a3b905b2388b020085dbd9e03209db4493f5420336d882d0b78b54f728b8f90058f7115a2c83221a00000000'
const testScryptHash = 'ce60a0d4a7c2223a94437d44fe4d33a30489436714d18376f9ebc5e2bd6e5682'

describe('Integration!', () => {
  let bridge,
    accounts,
    claimant,
    challenger,
    dogeRelayAddress

  const claimDeposit = 1
  before(async () => {
    bridge = await require('../client/bridge-to-the-moon')(web3)
    accounts = await getAccounts(web3)

    process.env.OPERATOR = accounts[5] // use account not used yet

    if (await bridge.api.claimManager.dogeRelay.call() === '0x0') {
      dogeRelayAddress = bridge.getContracts().dogeRelay.address
      await bridge.api.claimManager.setDogeRelay(dogeRelayAddress, { from: process.env.OPERATOR })
    }

    claimant = accounts[5]
    challenger = accounts[6]
  })

  context('normal conditions', async () => {
    it('should make a deposit', async () => {
      const tx = await bridge.api.makeDeposit({ from: claimant, value: claimDeposit })
    })

    it('should make a claim', async () => {
      const tx = await bridge.api.claimManager.checkScrypt(serializedBlockHeader, testScryptHash, claimant, 'bar', { from: accounts[0], value: claimDeposit })
    })

    context('monitorClaims', () => {
      let stopper, stop
      beforeEach(async () => {
        stopper = new Promise((resolve) => {
          stop = resolve
        })
      })

      it('should begin monitoring and accept outside stop', async () => {
        const monitor = bridge.monitorClaims(console, challenger, stopper, true, true)
        await timeout(1500)
        stop()
        await monitor
      })
    })
  })

  after(async () => {
    // teardown processes
  })
})
