const StateMachine = require('javascript-state-machine')
const VerificationGame = require('./verificationGames/challenger')
const BlockEmitter = require('../util/blockemitter')
const waitForEvent = require('../util/waitForEvent')
const timeout = require('../util/timeout')

module.exports = (web3, api) => ({
  run: async (cmd, serializedBlockHeader, testScryptHash, claimant, from) => new Promise(async (resolve, reject) => {
     try {

      const m = new StateMachine({
        init: 'init',
        transitions: [
          { name: 'start', from: 'init', to: 'ready'},
          { name: 'create', from: 'ready', to: 'done'}
        ],
        methods: {
          onStart: async (tsn) => {
              cmd.log('Checking deposits...')

              const minDeposit = await api.getMinDeposit()
              const currentDeposit = await api.getDeposit(claimant)
              if (currentDeposit.lt(minDeposit)) {
                cmd.log('Not enough ETH deposited.')
                // if we don't have enough deposit, either add some or throw
                // let's just add exactly the right amount for now
                if (true) {
                  const neededAmount = minDeposit.sub(currentDeposit)
                  const myBalance = await api.getBalance(claimant)
                  if (myBalance.gte(neededAmount)) {
                    cmd.log(`Depositing ${web3.fromWei(neededAmount, 'ether')} ETH...`)
                    await api.makeDeposit({from: claimant, value: neededAmount})
                    cmd.log(`Deposited ${web3.fromWei(neededAmount, 'ether')} ETH.`)
                  } else {
                    throw new Error(`
                            You don't have enough ETH to submit a deposit that would be greater than minDeposit.
                          `)
                  }
              } else {
                throw new Error(`
                          Your deposited ETH in ClaimManager is lower than minDeposit and --deposit was not enabled.`
                )
              }
            }
        },
        onBeforeCreate: (tsn) => { console.log("Creating claim") },
        onCreate: async (tsn) => {
          await api.createClaim(serializedBlockHeader, testScryptHash, claimant, {from: from})
        },
        onAfterCreate: async (tsn) => {
          //Check for ClaimCreated event
          console.log("Claim created")
        }
      }
    })

    await m.start()
    await m.create()

    } catch (error) {
      reject(error)
    }
  }),
})