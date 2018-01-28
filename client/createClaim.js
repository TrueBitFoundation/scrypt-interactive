const StateMachine = require('javascript-state-machine')
const fs = require('fs')
const path = require('path')
const promisify = require('es6-promisify')

const writeFile = promisify(fs.writeFile, fs)
const mkdirp = promisify(require('mkdirp'))

const BlockEmitter = require('./util/blockemitter')
const waitForEvent = require('./util/waitForEvent')
const timeout = require('./util/timeout')

const claimCachePath = path.resolve(__dirname, '../../cache/claims')

const saveClaimData = async (claimData) => {
  await mkdirp(claimCachePath)
  await writeFile(`${claimCachePath}/${claimData.claimID}.json`, JSON.stringify(claimData))
}

module.exports = (web3, api) => ({
  run: async (cmd, claim, initClaimData = null) =>
    new Promise(async (resolveClaim, reject) => {
      let claimantConvictedEvent, queryEvent
      let claimData = initClaimData || { stepResponses: {} }

      const m = new StateMachine({
        init: 'init',
        transitions: [
          { name: 'start', from: 'init', to: 'ready' },
          { name: 'create', from: 'ready', to: 'createdClaim' },
          { name: 'defend', from: 'createdClaim', to: 'verifiedClaim' },
          { name: 'skipCreate', from: 'ready', to: 'createdClaim' }
        ],
        methods: {
          onStart: async (tsn) => {
            if ('claim' in claimData) {
              return true
            }

            cmd.log('Checking deposits...')
            const minDeposit = await api.getMinDeposit()
            const currentDeposit = await api.getDeposit(claim.claimant)
            if (currentDeposit.lt(minDeposit)) {
              cmd.log('Not enough ETH deposited.')
              // if we don't have enough deposit, either add some or throw
              // let's just add exactly the right amount for now
              const neededAmount = minDeposit.sub(currentDeposit)
              const myBalance = await api.getBalance(claim.claimant)
              if (myBalance.gte(neededAmount)) {
                cmd.log(`Depositing ${web3.fromWei(neededAmount, 'ether')} ETH...`)
                await api.makeDeposit({from: claim.claimant, value: neededAmount})
                cmd.log(`Deposited ${web3.fromWei(neededAmount, 'ether')} ETH.`)
              } else {
                throw new Error(`
                  You don't have enough ETH to submit a deposit that would be greater than minDeposit.
                `)
              }
            }

            return false
          },
          onBeforeCreate: async (tsn) => {
            console.log('Creating claim');
            let testProposalId = 'foo';
            // @TODO - replace with a call to DogeRelay that forwards to claimmanager
            await api.createClaim(claim.serializedBlockHeader, claim.scryptHash, claim.claimant, testProposalId, { from: claim.claimant })
          },
          onAfterCreate: async (tsn) => {
            claimData.claimID = (await api.claimManager.claimantClaims(claim.claimant)).toNumber()
            claimData.createdAt = (await api.claimManager.createdAt.call(claimData.claimID)).toNumber()
            claimData.claim = claim;
            await saveClaimData(claimData)
          },
          onBeforeDefend: async (tsn) => {
            cmd.log('Ready to defend claim')
            claimantConvictedEvent = api.scryptVerifier.ClaimantConvicted({claimant: claim.claimant})
            queryEvent = api.scryptVerifier.NewQuery({claimant: claim.claimant})
          },
          onDefend: async (tsn) => {
            await Promise.race([
              new Promise((resolve, reject) => {
                claimantConvictedEvent.watch((err, result) => {//claimant loses verification game
                  if(err) reject(err)
                  if(result) resolve()
                })
              }),
              new Promise(async (resolve, reject) => {//Expected to resolve all times besides losing
                let ready 
                while(!ready) {
                  await timeout(10000)//wait 10 seconds
                  ready = await api.claimManager.getClaimReady.call(claimData.claimID)
                }
                //breaks out of loop and finishes claim
                console.log("Finishing claim")
                await api.claimManager.checkClaimSuccessful(claimData.claimID, {from: claim.claimant})
                await timeout(1000)
                resolve()
              }),
              new Promise(async (resolve, reject) => {//Don't expect this to ever resolve
                queryEvent.watch(async (err, result) => {
                  if (err) {
                    return reject(err)
                  }

                  if (result) {
                    let sessionId = result.args.sessionId.toNumber()
                    let session = await api.getSession(sessionId)
                    let step = session.medStep.toNumber()
                    let highStep = session.highStep.toNumber()
                    let lowStep = session.lowStep.toNumber()

                    if (session.medHash == '0x0000000000000000000000000000000000000000000000000000000000000000') {
                      console.log(`Defending step ${step}`)
                      if (step in claimData.stepResponses) {
                        let stateHash = claimData.stepResponses[step].stateHash;
                        await api.respond(sessionId, step, stateHash, {from: claim.claimant})
                      } else {
                        let results = await api.getResult(session.input, step)
                        claimData.stepResponses[step] = results;
                        await saveClaimData(claimData)
                        await api.respond(sessionId, step, results.stateHash, {from: claim.claimant})
                      }
                    } else {
                      //Defending final step 0
                      console.log(`Defending step ${lowStep}`)
                      let preState, postStateAndProof, postState, proof
                      if ('preState' in claimData) {
                        preState = claimData.preState
                        postStateAndProof = claimData.postStateAndProof
                      } else {
                        preState = (await api.getResult(session.input, lowStep)).state
                        postStateAndProof = await api.getResult(session.input, highStep)
                        claimData.preState = preState;
                        claimData.postStateAndProof = postStateAndProof;
                        await saveClaimData(claimData)
                      }
                      postState = postStateAndProof.state
                      proof = postStateAndProof.proof || '0x00'
                      await api.scryptVerifier.performStepVerification(sessionId, claimData.claimID, preState, postState, proof, api.claimManager.address, { from: claim.claimant, gas: 3000000 })
                      await timeout(1000)
                    }
                  }
                })
              })
            ])

            //Tidy up claim and kill promise
            claimantConvictedEvent.stopWatching()
            queryEvent.stopWatching()
            console.log("Finishing claim")
            resolveClaim()
          },
          //Used for initializing after hard reboot
          onSkipCreate: async (tsn) => {
            let challengers = (await api.claimManager.getChallengers(claimData.claimID)).toNumber()
            for (challenger in challengers) {
              let sessionId = (await api.claimManager.getSession.call(claimData.claimID, challenger)).toNumber()
              if (sessionId > 0) {
                let lastSteps = await api.scryptVerifier.getLastSteps.call(sessionId)
                let claimantLastStep = lastSteps[0].toNumber()
                let challengerLastStep = lastSteps[1].toNumber()
                if (claimantLastStep < challengerLastStep) {
                  //I think we can get away with only dealing with steps above 0, but needs to be tested
                  let session = await api.getSession(sessionId)
                  let step = session.medStep.toNumber()
                  let results = await api.getResult(session.input, step)
                  claimData.stepResponses[step] = results;
                  await saveClaimData(claimData)
                  await api.respond(sessionId, step, results.stateHash, {from: claim.claimant})
                }
              }
            }
          }
        }
      })

      //FSM high level transitions
      if (await m.start()) {
        await m.skipCreate()
      } else {
        await m.create()
      }
      await m.defend()
    }),
})