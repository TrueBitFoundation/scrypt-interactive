const StateMachine = require('javascript-state-machine')
const VerificationGame = require('./verificationGames/challenger')
const BlockEmitter = require('../util/blockemitter')
const waitForEvent = require('../util/waitForEvent')
const timeout = require('../util/timeout')

module.exports = (web3, api) => ({
  run: async (cmd, serializedBlockHeader, testScryptHash, claimant, from) => new Promise(async (resolve, reject) => {

      let claim

      const m = new StateMachine({
        init: 'init',
        transitions: [
          { name: 'start', from: 'init', to: 'ready'},
          { name: 'create', from: 'ready', to: 'createdClaim'},
          { name: 'timeout', from: 'createdClaim', to: 'defendClaim'}
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
        onBeforeCreate: async (tsn) => { 
          console.log("Creating claim"); 
          await api.createClaim(serializedBlockHeader, testScryptHash, claimant, {from: from}) 
        },
        onAfterCreate: async (tsn) => {
          //Check for ClaimCreated event
          const claimCreatedEvents = api.claimManager.ClaimCreated()
            await new Promise((resolve, reject) => {
              claimCreatedEvents.watch((error, result) => {
                if(error) reject(error)

                claim = {
                  id: result.args.claimID.toNumber(),
                  claimant: result.args.claimant,
                  plaintext: result.args.plaintext,
                  blockHash: result.args.blockHash,
                  createdAt: result.blockNumber,
                }
              
                cmd.log(`
                  ClaimCreated(
                    id: ${claim.id}
                    claimant: ${claim.claimant}
                    plaintext: ${claim.plaintext}
                    blockHash: ${claim.blockHash}
                    createdAt: ${claim.createdAt}
                  )
                `)
              resolve()
            })
          })
          claimCreatedEvents.stopWatching()
        },
        onBeforeTimeout: async (tsn) => {
          cmd.log('Waiting for challenge timeout...')
          const challengeTimeout = await api.getChallengeTimeout()
          cmd.log(`    (which is ${challengeTimeout} blocks)`)
          const blockEmitter = await BlockEmitter(web3)
          const timeoutExpiresAt = claim.createdAt + challengeTimeout.toNumber()
          await blockEmitter.waitForBlock(timeoutExpiresAt)
        },
        onAfterTimeout: async (tsn) => {
          cmd.log('Timeout over.')
        },
      }
    })

    await m.start()
    await m.create()
    await m.timeout()
    
  }),
})