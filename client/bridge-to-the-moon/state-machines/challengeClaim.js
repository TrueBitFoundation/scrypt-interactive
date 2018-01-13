const StateMachine = require('javascript-state-machine')
const BlockEmitter = require('../util/blockemitter')
const waitForEvent = require('../util/waitForEvent')
const timeout = require('../util/timeout')
const calculateMidpoint = require('../util/math').calculateMidpoint

module.exports = (web3, api, challenger) => ({
  run: async (cmd, claim, autoDeposit = false) => new Promise(async (resolve, reject) => {
    try {
      const { claimManager } = api

      let sessionId

      const m = new StateMachine({
        init: 'init',
        transitions: [
          { name: 'start', from: 'init', to: 'ready' },
          { name: 'challenge', from: 'ready', to: 'didChallenge' },
          { name: 'playGame', from: 'didChallenge', to: 'done'},
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
            //console.log(claim.id)
            api.challengeClaim(claim.id, {from: challenger})//bonds deposit
          },
          onAfterChallenge: async (tsn) => {
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
            cmd.log('Challenged.')
          },
          onBeforePlayGame: async (tsn) => {
            const getNewMedStep = async (sessionId) => {
              let session = await api.getSession(sessionId)
              return calculateMidpoint(session.lowStep.toNumber(), session.medStep.toNumber())
            }

            //Initial query
            let session = await api.getSession(sessionId)
            let medStep = calculateMidpoint(session.lowStep.toNumber(), session.highStep)
            await api.query(sessionId, medStep, {from: challenger})

            let newResponseEvent = api.scryptVerifier.NewResponse()
            await new Promise(async (resolve, reject) => {
              newResponseEvent.watch(async (err, result) => {
                if(err) reject(err)
                if(result) {
                  let medStep = await getNewMedStep(result.args.sessionId.toNumber())
                  console.log("Querying step: " + medStep)
                  await api.query(sessionId, medStep, {from: challenger})
                  if(medStep == 0) resolve()
                }
              })
            })
            newResponseEvent.stopWatching()
          },
          onAfterPlayGame: async (tsn) => {
            let sessionDecidedEvent = api.claimManager.SessionDecided({sessionId: sessionId})
            await new Promise((resolve, reject) => {
              sessionDecidedEvent.watch(async (err, result) => {
                if(err) reject(err)
                if(result) {
                  console.log(result)
                  resolve()
                }
              })
            })
            sessionDecidedEvent.stopWatching()
            resolve()
          },
          onCancel: (tsn, err) => { reject(err) },
        },
      })

      await m.start()
      await m.challenge()
      await m.playGame()

    } catch (error) {
      reject(error)
    }
  }),
})
