require('dotenv').config()
require('./helpers/chai').should()
web3.eth.defaultAccount = web3.eth.accounts[0]

const _ = require('lodash')

const getContracts = require('../client/util/getContracts')
const offchain = require('../client/util/offchain')
const scryptsy = require('scryptsy')

// eslint-disable-next-line max-len
const getStateAndProofInput = '0x03000000c63abe4881f9c765925fffb15c88cdb861e86a32f4c493a36c3e29c54dc62cf45ba4401d07d6d760e3b84fb0b9222b855c3b7c04a174f17c6e7df07d472d0126fe455556358c011b6017f799'
const scryptHashOutput = '0x3569d4c55c658997830bce8f904bf4cb74e63cfcc8e1037a5fab030000000000'

const resultExpectations = [
  {
    steps: 0,
    results: [
      '0x8038dac43cd98648dd6b968e98ed95c485341450beb516a6251685144bbc21dd',
      '0xc515df536d656b62f305a4f75679d93ffc3f41b192af5aa5704e5274522db12f',
      '0xd6b3a7b38edba0ac6f84d61e2670b6cae76f2b3fe6548cd31f54a3dcd63539ab',
      '0x9a6e32b98c8bfc9a3f0f40c8e785e9b238fc801ed4295822883ad78b4f133b83',
    ],
  },
  {
    steps: 1,
    results: [
      '0x77e2847d5ebbbfb1d39cc82b9e5909d4cb178738b94c113aa33812f42dff5115',
      '0x9543e76238b667c89c14b1a0d4621281888271fea5080584b37395ceea5d4025',
      '0x33a4558e6e6e114e2639d40c46cc477bf37e1adb34ce712bf65bec405643059b',
      '0x39cd702732c1ab7b725d635b94753d063213a4916544024f7f90f9a36ecea3e2',
    ],
  },
  {
    steps: 1024,
    results: [
      '0xbdb398758050764ad4120c4aa90fbead653859e171f56b45b80fe72cad51a3a5',
      '0x69fdc582957293e48831bd5194afedb41e3ad1505e8c8bc4a1f3914bd0d25afb',
      '0xfb17fc81a7352edbdabd5cb40deb8b28cdbe744c994ce53cda6fa86761c4edcd',
      '0x76224170840c81f81f10c7a59a56363d5ef98121f17c26a419baa0b34b9b7eff',
    ],
  },
  {
    steps: 1025,
    results: [
      '0x2eb1d4c932f0fbdd9210de96972f05477f4f538de546adde5ae7f2c65a5bb0c2',
      '0x30c88b9b61dff39992e75cdbca48f8bcb9a4d849ce6cb84799dad8f5ed144b74',
      '0xf928cdfc49d2e1b0cd9b941cd45d358b227fe03d4fd1647e32ca0e978263f85f',
      '0x166f7281b24b25e22c298500c9679a6697fea7512111662fc61cef5ef33c6fd5',
    ],
  },
  {
    steps: 2048,
    results: [
      '0x14ae37fca7d055c0ecdd951256c071c20748dc15cbf0ae85d987aacfe42476e',
      '0x12c5cec15dbe43c903c76e356fa9444738c70e1d21f13942cd87bab50fdeb2ba',
      '0x814c1a94c473453592405cb2adf2870e6a66ee784ba9b36781a7245eaa940d41',
      '0x5e20350d7edcce1212c57744844b4b39a859b23219643bdd88e9fa20530df52b',
    ],
  },
  {
    steps: 2049,
    results: [
      '0x7fe34a015c057dca51d9cd0e1c076c25c18d7420e80abf5cac7a985d6e4742fe',
      '0xc1cec512c943be5d356ec7034744a96f1d0ec7384239f121b5ba87cdbab2de0f',
      '0x941a4c81354573c4b25c40920e87f2ad78ee666a67b3a94b5e24a781410d94aa',
      '0xd35205e12cedc7e4477c512394b4b8432b259a8dd3b641920fae9882bf50d53',
    ],
  },
]

describe('checking hashes', async function() {
  this.timeout(30000)

  let scryptRunner

  before(async () => {
    const c = await (await getContracts(web3)).deploy()
    scryptRunner = c.scryptRunner
  })

  it('scryptsy and scryptRunner == same', async () => {

    const scryptHash = (data, start = 0, length = 80) => {
      let buff = Buffer.from(data, start, length);
      return scryptsy(buff, buff, 1024, 1, 1, 32)
    }

    //slicing the 0x because of possible encoding issue
    const hash = scryptHash(getStateAndProofInput.slice(2, -1)).toString('hex')
    const result = await scryptRunner.run.call(getStateAndProofInput.slice(2, -1), 2049)
    web3.toHex(result[4]).should.equal('0x' + hash)
  })
})

describe('Scrypt hash verifier', function () {
  this.timeout(120000)
  let scryptRunner

  before(async () => {
    const c = await (await getContracts(web3)).deploy()
    scryptRunner = c.scryptRunner
  })

  context('Verify intermediate values', () => {
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

    it('verify final step', async () => {
      const result = await scryptRunner.run.call(getStateAndProofInput, 2049)
      web3.toHex(result[4]).should.equal(scryptHashOutput)
    })
  })
})