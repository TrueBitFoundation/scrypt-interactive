const StateMachine = require('javascript-state-machine')
const VerificationGame = require('./verificationGames/challenger')
const BlockEmitter = require('../util/blockemitter')
const waitForEvent = require('../util/waitForEvent')
const timeout = require('../util/timeout')

module.exports = (web3, api) => ({
  run: async (cmd, claim, autoDeposit = false) => new Promise(async (resolve, reject) => {
    try {
      const { claimManager } = api
      const me = web3.eth.defaultAccount

      const m = new StateMachine({
        init: 'init',
        transitions: [
          { name: 'start', from: 'init', to: 'ready' },
          { name: 'challenge', from: 'ready', to: 'didChallenge' },
          { name: 'timeout', from: 'didChallenge', to: 'postChallenge' },
          { name: 'verify', from: 'postChallenge', to: 'done' },
          { name: 'cancel', from: '*', to: 'cancelled' },
        ],
        methods: {
          onBeforeStart: async (tsn) => {
            cmd.log('Checking deposits...')

            const minDeposit = await api.getMinDeposit()
            const currentDeposit = await api.getDeposit()
            if (currentDeposit.lt(minDeposit)) {
              cmd.log('Not enough ETH deposited.')
              // if we don't have enough deposit, either add some or throw
              // let's just add exactly the right amount for now
              if (autoDeposit) {
                const neededAmount = minDeposit.sub(currentDeposit)
                const myBalance = await api.getBalance(me)
                if (myBalance.gte(neededAmount)) {
                  cmd.log(`Depositing ${web3.fromWei(neededAmount, 'ether')} ETH...`)
                  await api.deposit(neededAmount)
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
          onAfterStart: async (tsn) => tsn.fsm.challenge(),
          onBeforeChallenge: async (tsn) => {
            cmd.log('Challenging...')
            await api.challengeClaim(claim.id)
          },
          onAfterChallenge: async (tsn) => {
            cmd.log('Challenged.')
            await tsn.fsm.timeout()
          },
          onBeforeTimeout: async (tsn) => {
            cmd.log('Waiting for challenge timeout...')
            const challengeTimeout = await api.getChallengeTimeout()
            cmd.log(`    (which is ${challengeTimeout} blocks)`)
            const blockEmitter = await BlockEmitter(web3)
            const timeoutExpiresAt = claim.createdAt.plus(challengeTimeout).toNumber()
            await blockEmitter.waitForBlock(timeoutExpiresAt)
          },
          onAfterTimeout: async (tsn) => {
            cmd.log('Timeout over.')
            await tsn.fsm.verify()
          },
          onBeforeVerify: async (tsn) => {
            const waitForEventAndGetSessionId = async () => {
              const event = await waitForEvent(claimManager, 'ClaimVerificationGameStarted', {
                filter: {
                  claimID: claim.id,
                  challenger: me,
                },
              })

              return event.returnValues.sessionId
            }

            const runVerificationGameAndGetSessionId = async () => {
              const [sessionId] = await Promise.all([
                waitForEventAndGetSessionId(),
                api.runNextVerificationGame(claim.id),
              ])

              return sessionId
            }

            const verificationGame = VerificationGame(web3, api)
            // we either start the first verification game ourselves
            const weAreFirstChallenger = true
            if (weAreFirstChallenger) {
              cmd.log('We\'re the first challenger.')
              cmd.log('Starting Verification Game...')
              const sessionId = await runVerificationGameAndGetSessionId()
              cmd.log('Verification Game Started.')
              return verificationGame.run(cmd, claim, sessionId)
            }

            cmd.log('We\'re not the first challenger.')
            cmd.log('Waiting up to 1 minute for first challenger to start the verification game.')
            // otherwise we wait until our verification game has begun

            const sessionId = await Promise.race([
              waitForEventAndGetSessionId(),
              timeout(60 * 1000).then(runVerificationGameAndGetSessionId),
            ])

            cmd.log('Verification Game Started')
            return verificationGame.run(cmd, claim, sessionId)
          },
          onAfterVerify: (tsn, res) => { resolve(res) },
          onCancel: (tsn, err) => { reject(err) },
        },
      })

      await m.start()
    } catch (error) {
      reject(error)
    }
  }),
})
