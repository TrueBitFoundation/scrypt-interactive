const StateMachine = require('javascript-state-machine')
const waitForEvent = require('../util/waitForEvent')
const timeout = require('../util/timeout')
const calculateMidpoint = require('../util/math').calculateMidpoint
const fs = require('fs')
const promisify = require('es6-promisify')
const mkdirp = promisify(require('mkdirp'))

const writeFile = promisify(fs.writeFile, fs)
const unlink = promisify(fs.unlink, fs)
const path = require('path')

const challengeCachePath = path.resolve(__dirname, '../../cache/challenges')

const models = require('../util/models')

const saveChallengeData = async (data) => {
  await mkdirp(challengeCachePath)
  await writeFile(`${challengeCachePath}/${data.id}.json`, JSON.stringify(data))
}

const deleteChallengeData = async (data) => unlink(`${challengeCachePath}/${data.id}.json`)

module.exports = (web3, api) => ({
  run: async (cmd, claim, challenger, autoDeposit = false) => new Promise(async (resolve, reject) => {
    // TODO: getNewMedStep needs to compare challenger's state hash with the claimant's value
    // and decide whether to ask for midpoint of first OR second half interval.
    const getNewMedStep = async (sessionId) => {
      let session = await api.getSession(sessionId)
      return calculateMidpoint(session.lowStep.toNumber(), session.medStep.toNumber())
    }

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
          { name: 'skipChallenge', from: 'ready', to: 'didChallenge'}
        ],
        methods: {
          onStart: async (tsn) => {
            if('sessionId' in claim) {
              return true;
            }else{
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
              return false;
            }
          },
          onBeforeChallenge: async (tsn) => {
            cmd.log('Challenging...')
            //console.log(claim.id)
            if(!('sessionId' in claim)) {
              await api.challengeClaim(claim.id, {from: challenger})//bonds deposit
            }
          },
          onAfterChallenge: async (tsn) => {
            const sendQuery = async () => {
              claim.sessionId = await api.claimManager.getSession.call(claim.id, challenger)
              //Initial query
              await saveChallengeData(claim)

              let session = await api.getSession(claim.sessionId)

              let medStep = calculateMidpoint(session.lowStep.toNumber(), session.highStep.toNumber())
              await api.query(claim.sessionId, medStep, {from: challenger})
            }

            //Figure out if first challenger
            let currentChallenger = await api.claimManager.getCurrentChallenger.call(claim.id)
            let verificationOngoing = await api.claimManager.getVerificationOngoing.call(claim.id)
            if (currentChallenger == challenger && !verificationOngoing) {
              console.log('... we are first challenger.')
              await api.claimManager.runNextVerificationGame(claim.id, {from: challenger})
              //Initial query on normal cases
              await sendQuery()
            } else if (currentChallenger == challenger && verificationOngoing) {
              // ^ should only happen if rebooting during game
              console.log('... resuming challenge.')
              let lastSteps = api.scryptVerifier.getLastSteps.call(claim.sessionId)
              let claimantLastStep = lastSteps[0].toNumber()
              let challengerLastStep = lastSteps[0].toNumber()
              if(claimantLastStep == challengerLastStep) {
                let medStep = await getNewMedStep(result.args.sessionId.toNumber())
                console.log("Querying step: " + medStep)
                await api.query(sessionId, medStep, {from: challenger})
                if (medStep == 0) resolve()
              }
            } else if (currentChallenger != challenger && verificationOngoing) {
              console.log('... waiting')
              const verificationGameStartedEvent = api.claimManager.VerificationGameStarted({claimID: claim.id, challenger: challenger})
              await new Promise(async (resolve, reject) => {
                verificationGameStartedEvent.watch(async (err, result) => {
                  if(err) reject(err)
                  if(result) resolve()
                })
              })
              verificationGameStartedEvent.stopWatching()
              sendQuery()
            } else {
              // ^ this case probably won't happen but this should cover us if it does
              console.log('... ???')
              await api.claimManager.runNextVerificationGame(claim.id, {from: challenger})
              const verificationGameStartedEvent = api.claimManager.VerificationGameStarted({claimID: claim.id, challenger: challenger})
              await new Promise(async (resolve, reject) => {
                verificationGameStartedEvent.watch(async (err, result) => {
                  if(err) reject(err)
                  if(result) resolve()
                })
              })
              verificationGameStartedEvent.stopWatching()
              sendQuery()
            }
          },
          onBeforePlayGame: async (tsn) => {
            //playGame
            let newResponseEvent = api.scryptVerifier.NewResponse({sessionId: claim.sessionId, challenger: challenger})
            await new Promise(async (resolve, reject) => {
              newResponseEvent.watch(async (err, result) => {
                if(err) reject(err)
                if(result) {

                  //Carry out binary search
                  let session = models.toSession(await api.scryptVerifier.getSession(claim.sessionId))
                  let lastStep = session.medStep.toNumber()
                  let lastHash = session.medHash

                  let stateHash = models.toResult(await api.scryptRunner.getStateAndProof.call(session.input, lastStep)).stateHash

                  let newStep
                  if(stateHash == lastHash) {
                    newStep = calculateMidpoint(lastStep, session.highStep.toNumber())
                  }else{
                    newStep = calculateMidpoint(session.lowStep.toNumber(), lastStep)
                  }

                  console.log("Querying step: " + newStep)
                  await api.query(claim.sessionId, newStep, {from: challenger})
                  if(newStep == 0) resolve()
                }
              })
            })
            newResponseEvent.stopWatching()
          },
          onAfterPlayGame: async (tsn) => {
            let sessionDecidedEvent = api.claimManager.SessionDecided({sessionId: claim.sessionId})
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
            await deleteChallengeData(claim)
            resolve()
          },
          onCancel: (tsn, err) => { reject(err) },
        }
      })

      if(await m.start()) {
        await m.playGame()
      }else{
        await m.challenge()
        await m.playGame()
      }

    } catch (error) {
      reject(error)
    }
  }),
})