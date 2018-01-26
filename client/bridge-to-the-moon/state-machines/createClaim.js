const StateMachine = require('javascript-state-machine')
const BlockEmitter = require('../util/blockemitter')
const waitForEvent = require('../util/waitForEvent')
const timeout = require('../util/timeout')
const models = require('../util/models')
const fs = require('fs')

const claimCachePath = __dirname + '/../../cache/claims/'

module.exports = (web3, api) => ({
  run: async (cmd, claim, initClaimData = null) => new Promise(async (resolve, reject) => {

      let claimantConvictedEvent, queryEvent, claimData

      if (initClaimData) {
        claimData = initClaimData
      } else {
        claimData = {stepResponses: {}}
      }

      const m = new StateMachine({
        init: 'init',
        transitions: [
          { name: 'start', from: 'init', to: 'ready'},
          { name: 'create', from: 'ready', to: 'createdClaim'},
          { name: 'defend', from: 'createdClaim', to: 'verifiedClaim'},
          { name: 'skipCreate', from: 'ready', to: 'createdClaim'}
        ],
        methods: {
        onStart: async (tsn) => {
          if('claim' in claimData) {
              return true;
          } else {
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
            return false;
          }
        },
        onBeforeCreate: async (tsn) => {
          console.log("Creating claim");
          let testProposalId = "foo";
          // TODO: api.createClaim needs to be updated with how Oscar's team is submitting claims
          await api.createClaim(claim.serializedBlockHeader, claim.scryptHash, claim.claimant, claim.proposalId, {from: claim.dogeRelay})
        },
        onAfterCreate: async (tsn) => {
          claimData.claimID = (await api.claimManager.claimantClaims(claim.claimant)).toNumber()
          claimData.createdAt = (await api.claimManager.createdAt.call(claimData.claimID)).toNumber()
          claimData.claim = claim;

          fs.writeFile(claimCachePath+claimData.claimID+'.json', JSON.stringify(claimData), (err) => { if(err) console.log(err)})
        },
        onBeforeDefend: async (tsn) => {
          cmd.log("Ready to defend claim")
          claimantConvictedEvent = api.scryptVerifier.ClaimantConvicted({claimant: claim.claimant})
          queryEvent = api.scryptVerifier.NewQuery({claimant: claim.claimant})
        },
        onDefend: async (tsn) => {
          await Promise.race([
            new Promise((resolve, reject) => {
              claimantConvictedEvent.watch((err, result) => {
                // claimant loses verification game
                if(err) reject(err)
                if(result) resolve()
              })
            }),
            new Promise(async (resolve, reject) => {
              queryEvent.watch(async (err, result) => {
                if(err) reject(err)
                if(result) {
                  let sessionId = result.args.sessionId.toNumber()
                  let session = await api.getSession(sessionId)
                  let step = session.medStep.toNumber()
                  let highStep = session.highStep.toNumber()
                  let lowStep = session.lowStep.toNumber()
                  
                  if(session.medHash == "0x0000000000000000000000000000000000000000000000000000000000000000") {
                    console.log("Defending step " + step)
                    if(step in claimData.stepResponses) {//check claim cache
                      let stateHash = claimData.stepResponses[step].stateHash;
                      await api.respond(sessionId, step, stateHash, {from: claim.claimant})
                    } else {
                      let results = models.toResult(await api.getStateProofAndHash(session.input, step))
                      claimData.stepResponses[step] = results;
                      fs.writeFile(claimCachePath+claimData.claimID+'.json', JSON.stringify(claimData), (err) => { if(err) console.log(err)})
                      await api.respond(sessionId, step, results.stateHash, {from: claim.claimant})
                    }
                  }else{
                    //Defending final step 0
                    console.log("Defending step " + lowStep)
                    let preState, postStateAndProof, postState, proof
                    if('preState' in claimData) {
                      preState = claimData.preState
                      postStateAndProof = claimData.postStateAndProof
                    }else{
                      preState = models.toResult(await api.getStateProofAndHash(session.input, lowStep)).state
                      postStateAndProof = models.toResult(await api.getStateProofAndHash(session.input, highStep))
                      claimData.preState = preState;
                      claimData.postStateAndProof = postStateAndProof;
                      fs.writeFile(claimCachePath+claimData.claimID+'.json', JSON.stringify(claimData), (err) => { if(err) console.log(err)})
                    }
                    postState = postStateAndProof.state
                    proof = postStateAndProof.proof || '0x00'
                    await api.scryptVerifier.performStepVerification(sessionId, claimData.claimID, preState, postState, proof, api.claimManager.address, { from: claim.claimant, gas: 3000000 })
                  }
                  
                  //should resolve after 100 blocks of unchallenged?
                  //resolve()
                }
              })
            })
          ])
        },
        onAfterDefend: async (tsn) => {
          claimantConvictedEvent.stopWatching()
          queryEvent.stopWatching()
          resolve()
        },
        onSkipCreate: async (tsn) => {
          let challengers = (await api.claimManager.getChallengers(claimData.claimID)).toNumber()
          for(challenger in challengers) {
            let sessionId = (await api.claimManager.getSession.call(claimData.claimID, challenger)).toNumber()
            if(sessionId > 0) {
              let lastSteps = await api.scryptVerifier.getLastSteps.call(sessionId)
              let claimantLastStep = lastSteps[0].toNumber()
              let challengerLastStep = lastSteps[1].toNumber()
              if(claimantLastStep < challengerLastStep) {
                //I think we can get away with only dealing with steps above 0, but needs to be tested
                let session = await api.getSession(sessionId)
                let step = session.medStep.toNumber()
                let results = models.toResult(await api.getStateProofAndHash(session.input, step))
                claimData.stepResponses[step] = results;
                fs.writeFile(claimCachePath+claimData.claimID+'.json', JSON.stringify(claimData), (err) => { if(err) console.log(err)})
                await api.respond(sessionId, step, results.stateHash, {from: claim.claimant})
              }
            }
          }
        }
      }
    })

    if(await m.start()) {
      await m.skipCreate()
    }else{
      await m.create()
    }
    await m.defend()
    
  }),
})
