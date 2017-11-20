
const tape = require('tape')
const spawn = require('tape-spawn')
const process = require('process')
const color = require('colors')
const child_process = require('child_process')

const compiler = require('./helpers/compiler')
const util = require('./helpers/util')

console.log("Compiling contracts...".green)
compiler.compile()

const web3 = util.web3;

var contractAddr_runner = 0
var contractAddr_verifier = 0
var contractAddr_claimManager = 0

function createConvictionCallback(verifier, resolve) {
    verifier.events.ChallengerConvicted().on('data', function(event) {
        console.log("Challenger convicted for session ".greed + event.returnValues.sessionId)
        resolve(+event.returnValues.sessionId, true)
    })
    verifier.events.ClaimantConvicted().on('data', function(event) {
        console.log("Claimant convicted for session ".green + event.returnValues.sessionId)
        resolve(+event.returnValues.sessionId, false)
    })
}

const testDogeBlockHeader = {
    version: 6422787,
    previousBlockHash: "dc1379e657ac01b5bdb38b7949d28945d44ee0effac43c35011a4e6c24f04456",
    merkleRoot: "60f3ad52c6c887f00d17bc5901e6fbe8b7ec22c5b7c69615420933ce1d40906f",
    timestamp: "2017-11-18 09:37:23 -0800",
    difficulty: "296,944.00130067",
    nonce: 0
}

// const testInputData = web3.utils.asciiToHex(JSON.stringify(testDogeBlockHeader));

const dogeTestHash = "0x0e4b99c4d9a39f462776e5e688dc432ba8af1f22b0b8ffe6c299a5177efb4fdf";

async function test(_account) {
    var account = await util.setupAccount(_account)
    var runner = await util.deployContract(runnerCode, runnerABI, contractAddr_runner, account, 4000000, true, null)
    var verifier =  await util.deployContract(verifierCode, verifierABI, contractAddr_verifier, account, 4000000, true, null)
    var claimManager =  await util.deployContract(claimManagerCode, claimManagerABI, contractAddr_claimManager, account, 4000000, true, ['0x1234', verifier._address])
    var challengerAccount = await util.setupAccount()

    // await testBinarySearchCheatingClaimant(runner, verifier, account, challengerAccount, randomHexString())
    process.exit(anyError ? 1 : 0)
}

var anyError = false
test()
