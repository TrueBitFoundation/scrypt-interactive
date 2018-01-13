const StateMachine = require('javascript-state-machine')
const BlockEmitter = require('../util/blockemitter')
const waitForEvent = require('../util/waitForEvent')
const timeout = require('../util/timeout')
const models = require('../util/models')

module.exports = (web3, api) => ({
  run: async (cmd, claim) => new Promise(async (resolve, reject) => {

      let claimID

      const m = new StateMachine({
        init: 'init',
        transitions: [
          { name: 'start', from: 'init', to: 'ready'},
          { name: 'create', from: 'ready', to: 'createdClaim'},
          { name: 'defend', from: 'createdClaim', to: 'verifiedClaim'},
        ],
        methods: {
          onStart: async (tsn) => {
              cmd.log('Checking deposits...')

              const minDeposit = await api.getMinDeposit()
              const currentDeposit = await api.getDeposit(claim.claimant)
              if (currentDeposit.lt(minDeposit)) {
                cmd.log('Not enough ETH deposited.')
                // if we don't have enough deposit, either add some or throw
                // let's just add exactly the right amount for now
                if (true) {
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
              } else {
                throw new Error(`
                          Your deposited ETH in ClaimManager is lower than minDeposit and --deposit was not enabled.`
                )
              }
            }
        },
        onBeforeCreate: async (tsn) => {
          console.log("Creating claim"); 
          await api.createClaim(claim.serializedBlockHeader, claim.scryptHash, claim.claimant, {from: claim.dogeRelayAddress}) 
        },
        onAfterCreate: async (tsn) => {
          //Check for ClaimCreated event
          const claimCreatedEvents = api.claimManager.ClaimCreated()
            await new Promise((resolve, reject) => {
              claimCreatedEvents.watch((error, result) => {
                if(error) reject(error)

                claimID = result.args.claimID.toNumber()

                const claim = {
                  id: claimID,
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
        //Listen for queries and respond
        onDefend: async (tsn) => {
          cmd.log('Defending claim')
          const queryEvent = api.scryptVerifier.NewQuery()
          await new Promise(async (resolve, reject) => {
            queryEvent.watch(async (err, result) => {
              if(err) reject(err)
              if(result) {
                let sessionId = result.args.sessionId.toNumber()
                let session = await api.getSession(sessionId)
                let step = session.medStep.toNumber() //Currently only responding with medStep
                let highStep = session.highStep.toNumber()
                let lowStep = session.lowStep.toNumber()
                
                if(session.highStep > 1) {
                  console.log("Defending step " + step)
                  let results = models.toResult(await api.getStateProofAndHash(session.input, step))
                  await api.respond(sessionId, step, results.stateHash, {from: claim.claimant})
                }else{
                  console.log("Defending step " + lowStep)
                  let preState = models.toResult(await api.getStateProofAndHash(session.input, lowStep)).state
                  let postStateAndProof = models.toResult(await api.getStateProofAndHash(session.input, highStep))
                  let postState = postStateAndProof.state
                  let proof = postStateAndProof.proof || '0x00'
                  await api.scryptVerifier.performStepVerification(sessionId, claimID, preState, postState, proof, api.claimManager.address, { from: claim.claimant, gas: 3000000 })
                }
                
                //should resolve after 100 blocks of unchallenged?
                //resolve()
              }
            })
          })
        },
      }
    })

    await m.start()
    await m.create()
    await m.defend()
    
  }),
})