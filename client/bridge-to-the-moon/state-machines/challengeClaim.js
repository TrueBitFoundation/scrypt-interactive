const StateMachine = require('javascript-state-machine')
const VerificationGame = require('./verificationGames/challenger')
const BlockEmitter = require('../util/blockemitter')
const waitForEvent = require('../util/waitForEvent')
const timeout = require('../util/timeout')

module.exports = (web3, api, challenger) => ({
  run: async (cmd, claim, autoDeposit = false) => new Promise(async (resolve, reject) => {
    try {
      const { claimManager } = api
      const me = web3.eth.defaultAccount

      let sessionId

      const m = new StateMachine({
        init: 'init',
        transitions: [
          { name: 'start', from: 'init', to: 'ready' },
          { name: 'challenge', from: 'ready', to: 'didChallenge' },
          { name: 'verify', from: 'didChallenge', to: 'done' },
          { name: 'cancel', from: '*', to: 'cancelled' },
        ],
        methods: {
          onBeforeStart: async (tsn) => {
            cmd.log('Checking deposits...')

            const minDeposit = await api.getMinDeposit()
            const currentDeposit = await api.getDeposit(challenger)
            if (currentDeposit.lt(minDeposit)) {
              cmd.log('Not enough ETH deposited.')
              // if we don't have enough deposit, either add some or throw
              // let's just add exactly the right amount for now
              if (autoDeposit) {
                const neededAmount = minDeposit.sub(currentDeposit)
                const myBalance = await api.getBalance(challenger)
                if (myBalance.gte(neededAmount)) {
                  cmd.log(`Depositing ${web3.fromWei(neededAmount, 'ether')} ETH...`)
                  await api.makeDeposit({from: challenger, value: neededAmount})
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
          onAfterStart: async (tsn) => { console.log("Beginning challenge") },
          onBeforeChallenge: async (tsn) => {
            cmd.log('Challenging...')
            console.log(claim.id)
            api.challengeClaim(claim.id, {from: challenger})//bonds deposit
          },
          onAfterChallenge: async (tsn) => {
            cmd.log('Challenged.')
            let claimChallengedEvent = api.claimManager.ClaimChallenged({claimID: claim.id, challenger: challenger})
            await new Promise((resolve, reject) => {
              claimChallengedEvent.watch((err, result) => {
                if(err) reject(err)
                if(result) {
                  sessionId = result.args.claimID.toNumber()
                  resolve() 
                }
              })
            })
            claimChallengedEvent.stopWatching()
          },
          onBeforeVerify: async (tsn) => {

            const getMedStep = async (sessionId) => {
              const session = await api.getSession(sessionId)
              return calculateMidpoint(session.lowStep, session.highStep)
            }

            let medStep = getMedStep(sessionId)

            // now lets request the next medStep
            await api.query(sessionId, medStep, {from: challenger})
          }

          //   const verificationGame = VerificationGame(web3, api)
          //   // we either start the first verification game ourselves
          //   const weAreFirstChallenger = true
          //   if (weAreFirstChallenger) {
          //     cmd.log('We\'re the first challenger.')
          //     cmd.log('Starting Verification Game...')
          //     const sessionId = await runVerificationGameAndGetSessionId()
          //     cmd.log('Verification Game Started.')
          //     return verificationGame.run(cmd, claim, sessionId, challenger)
          //   }

          //   cmd.log('We\'re not the first challenger.')
          //   cmd.log('Waiting up to 1 minute for first challenger to start the verification game.')
          //   // otherwise we wait until our verification game has begun

          //   const sessionId = await Promise.race([
          //     waitForEventAndGetSessionId(),
          //     timeout(60 * 1000).then(runVerificationGameAndGetSessionId),
          //   ])

          //   cmd.log('Verification Game Started')
          //   return verificationGame.run(cmd, claim, sessionId)
          // },
          ,
          onAfterVerify: (tsn, res) => { resolve(res) },
          onCancel: (tsn, err) => { reject(err) },
        },
      })

      await m.start()
      await m.challenge()
      await m.verify()

    } catch (error) {
      reject(error)
    }
  }),
})
