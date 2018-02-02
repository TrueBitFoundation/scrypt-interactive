require('dotenv').config()
require('./helpers/chai').should()
web3.eth.defaultAccount = web3.eth.accounts[0]

const _ = require('lodash')
const dataFormatter = require('./helpers/dataFormatter')
const random = require('./helpers/random')
const getContracts = require('../client/util/getContracts')

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

describe('ScryptVerifier', function () {
  this.timeout(10000)
  let scryptRunner,
    scryptVerifier

  before(async () => {
    const c = await (await getContracts(web3)).deploy()
    scryptRunner = c.scryptRunner
    scryptVerifier = c.scryptVerifier
  })

  context('Testing step values', () => {
    _.each(resultExpectations, (stepCase) => {
      it(`can compute ${stepCase.steps} steps`, async () => {
        const result = await scryptRunner.run.call(getStateAndProofInput, stepCase.steps)

        for (let i = 0; i < stepCase.results.length; i++) {
          stepCase.results[i].should.equal(
            web3.toHex(result[1][i])
          )
        }
      })
    })

    // it('should fail on step 2049', async () => {
    //   // @TODO(hswick) - should this actually throw on 2049?
    //   scryptRunner.run.call(getStateAndProofInput, 2049)
    //     .should.throw()
    // })
  })

  context('prover-verifier combination', () => {
    const verifyStep = async (input, step) => {
      const state = dataFormatter.newStateAndProof(await scryptRunner.getStateAndProof.call(input, step)).state
      const postData = dataFormatter.newStateAndProof(await scryptRunner.getStateAndProof.call(input, step + 1))

      const verified = await scryptVerifier.verifyStep(step, state, postData.state, postData.proof || '0x00', { from: web3.eth.accounts[0] })
      return verified
    }

    let binarySearchSteps = [0, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1025, 2048]
    for (let step of binarySearchSteps) {
      it(`should be able to prove and verify step ${step}`, async () => {
        (await verifyStep(verifyProveInput, step))
          .should.be.equal(true)
      })
    }
  })

  context('random bit flipping', async () => {
    _.times(30, async () => {
      it('correctly fails', async () => {
        const input = random.randomHexString()
        const step = random.chooseRandomly([0, 1, 2, 78, 79, 1020, 1022, 1023, 1024, 1025, 1026, 2047, 2048])

        let preState = dataFormatter.newStateAndProof(
          await scryptRunner.getStateAndProof.call(input, step)
        ).state
        const postData = dataFormatter.newStateAndProof(await scryptRunner.getStateAndProof.call(input, step + 1))
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

        // console.log(`step ${step} pre: ${preState} post: ${postState}, proof: ${proof}`)
        const verified = await scryptVerifier.verifyStep(
          step,
          preState,
          postState,
          proof,
          { from: web3.eth.accounts[0] }
        )
        verified.should.eq(false)
      })
    })
  })
})
