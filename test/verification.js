
const _ = require('lodash')
const { expect } = require('./helpers/chai')
const dataFormatter = require('./helpers/dataFormatter')

const ScryptVerifier = artifacts.require('ScryptVerifier')
const ScryptRunner = artifacts.require('ScryptRunner')

const random = require('./helpers/random')

// eslint-disable-next-line max-len
const getStateAndProofInput = '0x5858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858'
const resultExpectations = [
  {
    steps: 0,
    results: [
      '0x3c268302673baaf8870141b9f4794454d2205c8f4074876a845d4df804bf55f',
      '0x62f06b94b13667ab93881eaeee5bdf4e803b452cc81928c314fe8160e1ecbb4f',
      '0xd97d406e33f717cad5950a7e6bdb7efbd171aa0dd30a1e448c33f791cf8c2016',
      '0x8e5bfa6d8e22bf3f240a4fc063e1f5b100728f046756d669cee62bb872154b45',
    ],
  },
  {
    steps: 1,
    results: [
      '0xafd217fb5feb256ef297b38bfaa3b6ab11bc21149568a18bf91dac87db4e7a83',
      '0x6458f3f41a9147b9abb7535fccca15de735fbc7b1bfeacfd3597600e12c08012',
      '0xc5a9f7db6589b26e8ab04ddd707892ceff0cf3e1ed5432b837540d6d1946952e',
      '0x396ffd44dfb9444c8adb64caffd9dd922d6542dae17db75ed82bf38bf3b91b78',
    ],
  },
  {
    steps: 1024,
    results: [
      '0x1c62770d44a4eeb47f01de7e65c8f43b026c637cf208dd6013a3f9df6e6ded0a',
      '0xe7b7ae5b8deaa9d9a147775886b0d31cfc7af04a27662405de9554aa06b1800b',
      '0x28c68c4b78f4b4fad370f4b662d9e7bc01fcecf2b6d9545714b909f272fe49b5',
      '0xc19f7ed077ec236a0721b6fe7abc9369ade9d7d7b60d22bbbe0baf8699c09472',
    ],
  },
  {
    steps: 1025,
    results: [
      '0xfaf12052158160f6a7255bc1689a6cc5bd8bc953ebddf8bbe645157d479119b9',
      '0xf5d793693d8f7c2840341db0abb693c2e562bae33883c731b1d9170436b2a5c1',
      '0xf92d1f40b7a4f75f121568fe96389755f8b689a05082e084cc8e6b70eb0ec1d3',
      '0x799d0314cfc8962dab57508b04f6d94e73b554c3d1a6bd0bb7c404fcc08b1133',
    ],
  },
  {
    steps: 2048,
    results: [
      '0x3f3d915849eba08428ac85aa72f9159d4a406afc43a598789d32110ff4d0bc40',
      '0x3959831424f3546318d09292760cc19bd6a7559f4bd603470c16c61b45398fa',
      '0x9e17c9061d1313a0a0998c7664d5588f13c9040cb4aa942702ff75c460e92145',
      '0x28b3b2ce855bea481cd966c078c062a715e2897e7c144e15c05dfd52e3bb7cdb',
    ],
  },
]

// eslint-disable-next-line max-len
const verifyProveInput = '0x5858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858'

contract('ScryptVerifier', function (accounts) {
  let scryptRunner,
    scryptVerifier

  before(async () => {
    scryptRunner = await ScryptRunner.new()
    scryptVerifier = await ScryptVerifier.new()
  })

  context('Testing step values', () => {
    _.each(resultExpectations, (stepCase) => {
      // @TODO – remove this if statement, to run for all stepCases.
      // currently gives "out of gas" error when when doing scryptRunner.run with i = 1024
      // potentially helpful links:
      // 1. https://ethereum.stackexchange.com/questions/9824/can-solidity-constant-functions-be-arbitrarily-complex/9827
      // 2. start testrpc with a higher limit: testrpc -l 4500000000000
      if (stepCase.steps > 1) return

      it(`can compute ${stepCase.steps} steps`, async () => {
        const result = await scryptRunner.run.call(getStateAndProofInput, stepCase.steps)

        for (let i = 0; i < stepCase.results.length; i++) {
          expect(stepCase.results[i]).to.equal(
            web3.toHex(result[1][i])
          )
        }
      })
    })

    it('should fail on step 2049', async () => {
      expect(scryptRunner.run.call(getStateAndProofInput, 2049)).to.be.rejected
    })
  })

  context('prover-verifier combination', () => {
    const verifyStep = async (input, step) => {
      const state = dataFormatter.newStateAndProof(await scryptRunner.getStateAndProof.call(input, step, {gas: 200000000})).state
      const postData = dataFormatter.newStateAndProof(await scryptRunner.getStateAndProof.call(input, step + 1, {gas: 200000000}))

      const verified = await scryptVerifier.verifyStep(step, state, postData.state, postData.proof || '0x00', {from: accounts[0]})
      return verified
    }



    let binarySearchSteps = [0, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1025, 2049]
    //any step above 85 will give out of gas
    for (let step of binarySearchSteps) {
      it(`should be able to prove and verify step ${step}`, async () => {
        expect(await verifyStep(verifyProveInput, step)).to.be.equal(true)
      })
    }
  })

  context('random bit flipping', () => {
    _.times(5, () => {//change 5 to higher number when out of gas error issue resolved
      const input = random.randomHexString()
      //const step = random.chooseRandomly([0, 1, 2, 78, 79, 1020, 1022, 1023, 1024, 1025, 1026, 2047, 2048, 2049])

      //Keeping this list smaller for now to get meaningful test results
      const step = random.chooseRandomly([0, 1, 2])

      it('correctly fails', async () => {
        let preState = dataFormatter.newStateAndProof(await scryptRunner.getStateAndProof(input, step)).state
        const postData = dataFormatter.newStateAndProof(await scryptRunner.getStateAndProof(input, step + 1))
        let postState = postData.state

        let proof = postData.proof || '0x00'
        const which = random.randomInt(3)
        if (which === 0) {
          // correctData = preState
          preState = random.flipRandomNibble(preState)
        } else if (which === 1 || step === 0 /* proof is unused in step 0 */) {
          // correctData = postState
          postState = random.flipRandomNibble(postState)
        } else {
          // correctData = proof
          proof = random.flipRandomNibble(proof)
        }

        expect(
          await scryptVerifier.verifyStep(step, preState, postState, proof, {from: accounts[0]})
        ).to.be.equal(false)
      })
    })
  })

  //@TODO(shrugs) - port these tests as well

  //(hswick) To be honest these tests below are outdated since we've created ClaimManager.
  //The key functions being tested here are query, respond, and performStepVerification which are all integrated into client.js tests.
  //The real benefit of these would be an adverserial test which is basically happening above


  //session = dataFormatter.newSession(await scryptVerifier.getSession.call(claimID))
  // function Info(account, prover, verifier) {
  //     this.getSession = async function(id) {
  //         return dataFormatter.newSession(await verifier.getSession.call(id, {from: account}))
  //     }
  //     this.getStateProofAndHash = async function(input, step) {
  //         return dataFormatter.newResult(await prover.getStateProofAndHash.call(input, step, { from: account }))
  //     }
  // }

  // function Claimant(interface, info) {
  //     var steps = 2050;
  //     var that = this;
  //     this.switchingPoint = 2051; // disabled at construction time
  //     this.switchedInput = '0x00'
  //     // TODO only respond to queries to own sessions
  //     function inputForStep(step, input) {
  //         return +step >= that.switchingPoint ? that.switchedInput : input
  //     }
  //     console.log("Registering events".yellow)
  //     interface.verifier.events.NewQuery(async function(err, event) {
  //         if (err) throw err
  //         console.log("Got NewQuery event...".yellow)
  //         var session = await info.getSession(event.returnValues.sessionId)
  //         console.log(("New query for session " + event.returnValues.sessionId + " at step " + session.medStep).yellow)
  //         if (session.medHash == "0x0000000000000000000000000000000000000000000000000000000000000000") {
  //             // Regular case
  //             var stateHash = (await info.getStateProofAndHash(inputForStep(session.medStep, session.input), session.medStep)).stateHash
  //             console.log(("Sending state hash: " + stateHash).yellow)
  //             await interface.verifier.methods.respond(event.returnValues.sessionId, session.medStep, stateHash).send({from: interface.account})
  //         } else {
  //             // Binary search is finished
  //             if (+session.highStep - session.lowStep != 1) {
  //                 throw "Med hash set, but we are not in final step."
  //             }
  //             console.log("Binary search ended. Asking for verification of step ".yellow + session.lowStep)
  //             var preState = (await info.getStateProofAndHash(inputForStep(session.lowStep, session.input), session.lowStep)).state
  //             var postStateAndProof = await info.getStateProofAndHash(inputForStep(session.highStep, session.input), session.highStep)
  //             var postState = postStateAndProof.state
  //             var proof = postStateAndProof.proof || '0x00'
  //             console.log("... using\n   PreState:  ".yellow + preState + "\n   PostState: ".yellow + postState + "\n   Proof:    ".yellow + proof)
  //             await interface.verifier.methods.performStepVerification(
  //                 event.returnValues.sessionId,
  //                 preState,
  //                 postState,
  //                 proof
  //             ).send({from: interface.account, gas: 1000000})
  //         }
  //     })
  //     this.claim = async function(input) {
  //         console.log("Claiming computation...".yellow)
  //         var output = (await info.getStateProofAndHash(inputForStep(steps, input), steps)).state
  //         console.log("with output ".yellow + output)
  //         var claimOut = await interface.verifier.methods.claimComputation(input, output, steps).send({from: interface.account, gas: 2000000})
  //         // console.log(claimOut)
  //     }
  // }

  // function Challenger(interface, info) {
  //     var steps = 2050;
  //     var that = this;
  //     this.switchingPoint = 2055 // disabled at construction time
  //     this.switchedInput = '0x00'
  //     console.log("Registering events".blue)
  //     function inputForStep(step, sessionInput) {
  //         return step >= that.switchingPoint ? that.switchedInput : sessionInput
  //     }
  //     interface.verifier.events.NewClaim(async function(err, event) {
  //         if (err) throw err
  //         console.log("Got NewClaim event...".blue)
  //         var session = await info.getSession(event.returnValues.sessionId)
  //         console.log(("New claim for session " + event.returnValues.sessionId).blue)
  //         var myOutput = (await info.getStateProofAndHash(inputForStep(steps, session.input), steps)).state
  //         console.log(("Claimed output: " + session.output).blue)
  //         console.log(("My output: " + myOutput).blue)
  //         if (myOutput != session.output) {
  //             console.log(("Challenging...").blue)
  //             await interface.verifier.methods.query(event.returnValues.sessionId, Math.floor(steps / 2)).send({from: interface.account})
  //         } else {
  //             console.log(("Will not challenge").blue)
  //         }
  //     })
  //     interface.verifier.events.NewResponse(async function(err, event) {
  //         if (err) throw err
  //         console.log("Got NewResponse event...".blue)
  //         var session = await info.getSession(event.returnValues.sessionId)
  //         console.log(("New response for session " + event.returnValues.sessionId).blue)
  //         var myStateHash = (await info.getStateProofAndHash(inputForStep(session.medStep, session.input), session.medStep)).stateHash
  //         console.log("Claimant responded with state hash ".blue + session.medHash + " - mine is ".blue + myStateHash)
  //         console.log("Current steps: ".blue + session.lowStep + " - ".blue + session.medStep + " - ".blue + session.highStep)
  //         var lowStep = +session.lowStep
  //         var medStep = +session.medStep
  //         var highStep = +session.highStep
  //         var step = 0
  //         if (session.medHash == myStateHash) {
  //             step = medStep + Math.floor((highStep - medStep) / 2)
  //         } else {
  //             step = lowStep + Math.floor((medStep - lowStep) / 2)
  //         }
  //         await interface.verifier.methods.query(event.returnValues.sessionId, step).send({from: interface.account})
  //     })
  // }

  // function createConvictionCallback(verifier, resolve) {
  //     verifier.events.ChallengerConvicted().on('data', function(event) {
  //         console.log("Challenger convicted for session ".greed + event.returnValues.sessionId)
  //         resolve(+event.returnValues.sessionId, true)
  //     })
  //     verifier.events.ClaimantConvicted().on('data', function(event) {
  //         console.log("Claimant convicted for session ".green + event.returnValues.sessionId)
  //         resolve(+event.returnValues.sessionId, false)
  //     })
  // }

  // async function testBinarySearchCheatingClaimant(runner, verifier, claimantAccount, challengerAccount, input) {
  //     var info = new Info(claimantAccount, runner, verifier)
  //     var claimantInterface = { account: claimantAccount, prover: runner, verifier: verifier }
  //     var challengerInterface = { account: challengerAccount, prover: runner, verifier: verifier }
  //     var claimant = new Claimant(claimantInterface, info)
  //     var challenger = new Challenger(challengerInterface, info)

  //     var game = {ended: null}
  //     createConvictionCallback(verifier, (sessionId, claimantWon) => {
  //         game.ended(claimantWon)
  //     })
  //     for (var i = 0; i < 5; i++) {
  //         claimant.switchingPoint = chooseRandomly([0, 1, 2, 78, 79, 1020, 1022, 1023, 1024, 1025, 1026, 2047, 2048, 2049])
  //         console.log((
  //             "---------------------------------\n" +
  //             "Testing binary search (cheating claimant at step " + claimant.switchingPoint + ") on " +
  //             input + "..."
  //         ).green)
  //         await claimant.claim(input)
  //         await new Promise(resolve => {
  //             var timeout = setTimeout(() => {
  //                 console.log("ERROR: Timeout".red)
  //                 anyErorr = true
  //                 resolve()
  //             }, 200 * 1000)
  //             game.ended = (claimantWon) => {
  //                 if (claimantWon) {
  //                     console.log("ERROR: Claimant won".red)
  //                     anyError = true
  //                 } else {
  //                     console.log("Challenger won".green)
  //                 }
  //                 clearTimeout(timeout)
  //                 resolve()
  //             }
  //         })
  //     }
  // }
})
