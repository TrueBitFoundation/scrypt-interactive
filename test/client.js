const fs = require('fs')
const tape = require('tape')
const spawn = require('tape-spawn')
const net = require('net')
const Web3 = require('web3')
const process = require('process')
const color = require('colors')
const child_process = require('child_process')

// Use the local (non-js) compiler or not.
const useLocalSolc = false

function invokeCompiler(input) {
    if (useLocalSolc) {
        var result = child_process.spawnSync('solc', ['--optimize', '--standard-json', '-'], {input: input, encoding: 'utf-8'})
        if (result.status != 0) {
            console.log("Error invoking compiler:".red)
            console.log(result.output[2])
        }
        return result.output[1]
    } else {
        return require('solc').compileStandard(input)
    }
}

function checkForErrors(results) {
    if (!results) {
        console.log("Error invoking compiler (results is invalid).")
        console.log(results)
        process.exit(1)
    }
    var anyError = false
    if (results.errors) {
        for (var e of results.errors) {
            if (e.severity != 'warning') {
                console.log(e.formattedMessage.red)
                anyError = true
            }
        }
    }
    if (anyError) {
        process.exit(1)        
    }
}

function compile() {
    const solc = require('solc')
    function readFile(name) {
        return fs.readFileSync(name, {encoding: 'utf-8'})
    }

    const compilerInput_runner = {
        'language': 'Solidity',
        'sources': {
            'scryptFramework.sol': {'content': readFile('contracts/scryptFramework.sol')},
            'scryptRunner.sol': {'content': readFile('contracts/scryptRunner.sol')},
            'verify.sol': {'content': readFile('contracts/verify.sol')}
        }
    }

    var results = JSON.parse(invokeCompiler(JSON.stringify(compilerInput_runner)))
    checkForErrors(results)
    runnerCode = '0x' + results['contracts']['scryptRunner.sol']['ScryptRunner']['evm']['bytecode']['object']
    runnerABI = results['contracts']['scryptRunner.sol']['ScryptRunner']['abi']
    // console.log('var runnerCode = "' + runnerCode + '"')
    // console.log('var runnerABI = ' + JSON.stringify(runnerABI) + '')

    const compilerInput_verifier = {
        'language': 'Solidity',
        'sources': {
            'math/SafeMath.sol': {'content': readFile('contracts/math/SafeMath.sol')},
            'DepositsManager.sol': {'content': readFile('contracts/DepositsManager.sol')},
            'claimManager.sol': {'content': readFile('contracts/claimManager.sol')},
            'scryptFramework.sol': {'content': readFile('contracts/scryptFramework.sol')},
            'scryptVerifier.sol': {'content': readFile('contracts/scryptVerifier.sol')},
            'verify.sol': {'content': readFile('contracts/verify.sol')}
        }
    }
    results = JSON.parse(invokeCompiler(JSON.stringify(compilerInput_verifier)))
    checkForErrors(results)
    verifierCode = '0x' + results['contracts']['scryptVerifier.sol']['ScryptVerifier']['evm']['bytecode']['object']
    verifierABI = results['contracts']['scryptVerifier.sol']['ScryptVerifier']['abi']
    // console.log('var verifierCode = "' + verifierCode + '"')
    // console.log('var verifierABI = ' + JSON.stringify(verifierABI) + '')

    const compilerInput_claimManager = {
        'language': 'Solidity',
        'sources': {
            'math/SafeMath.sol': {'content': readFile('contracts/math/SafeMath.sol')},
            'DepositsManager.sol': {'content': readFile('contracts/DepositsManager.sol')},
            'claimManager.sol': {'content': readFile('contracts/claimManager.sol')},
            'scryptFramework.sol': {'content': readFile('contracts/scryptFramework.sol')},
            'scryptVerifier.sol': {'content': readFile('contracts/scryptVerifier.sol')},
            'verify.sol': {'content': readFile('contracts/verify.sol')}
        }
    }
    results = JSON.parse(invokeCompiler(JSON.stringify(compilerInput_claimManager)))
    checkForErrors(results)
    claimManagerCode = '0x' + results['contracts']['claimManager.sol']['ClaimManager']['evm']['bytecode']['object']
    claimManagerABI = results['contracts']['claimManager.sol']['ClaimManager']['abi']

    const compilerInput_dogeRelay = {
        'language': 'Solidity',
        'sources': {
            'dogeRelay.sol': {'content': readFile('contracts/dogeRelay.sol')}
        }
    }
    results = JSON.parse(invokeCompiler(JSON.stringify(compilerInput_dogeRelay)))
    checkForErrors(results)
    dogeRelayCode = '0x' + results['contracts']['dogeRelay.sol']['DogeRelay']['evm']['bytecode']['object']
    dogeRelayABI = results['contracts']['dogeRelay.sol']['DogeRelay']['abi']
}
console.log("Compiling contracts...".green)
compile()


var ipcpath = '/tmp/ethereum_dev_mode/geth.ipc'
if (process.argv.length >= 1)
{
    ipcpath = process.argv[process.argv.length - 1]
}

var web3 = new Web3(new Web3.providers.IpcProvider(ipcpath, net))
var contractAddr_runner = 0
var contractAddr_verifier = 0
var contractAddr_claimManager = 0
var contractAddr_dogeRelay = 0

async function setupAccount(_account) {
    console.log("Account setup...".green)
    var account = _account ? _account : await web3.eth.personal.newAccount('')
    console.log("Using account: ".cyan + account.cyan)
    await web3.eth.personal.unlockAccount(account, '', 1000000)
    return account
}

async function deployContract(c_code, c_abi, c_addr, b_account, c_gas, bool_log, args) {
  var block = await web3.eth.getBlockNumber()
    if (bool_log) console.log("At block " + block)
    var contract
    if (c_addr) {
        contract = new web3.eth.Contract(c_abi, c_addr)
    } else {
        if (args) {
            contract = await new web3.eth.Contract(c_abi).deploy({data: c_code, arguments: args}).send({
                from: b_account,
                gas: c_gas
            })
        } else {
            contract = await new web3.eth.Contract(c_abi).deploy({data: c_code}).send({
                from: b_account,
                gas: c_gas
            })
        }
    }
    if (bool_log) console.log("contract deployed at ".blue + contract.options.address.blue)
    return contract
}

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

const testInputData = web3.utils.asciiToHex(JSON.stringify(testDogeBlockHeader));

const dogeTestHash = "0x0e4b99c4d9a39f462776e5e688dc432ba8af1f22b0b8ffe6c299a5177efb4fdf";

async function test(_account) {
    var account = await setupAccount(_account)
    var runner = await deployContract(runnerCode, runnerABI, contractAddr_runner, account, 4000000, true, null)
    var verifier =  await deployContract(verifierCode, verifierABI, contractAddr_verifier, account, 4000000, true, null)
    var dogeRelay =  await deployContract(dogeRelayCode, dogeRelayABI, contractAddr_dogeRelay, account, 4000000, true, null)
    var claimManager =  await deployContract(claimManagerCode, claimManagerABI, contractAddr_claimManager, account, 4000000, true, [dogeRelay._address, verifier._address])
    var challengerAccount = await setupAccount()

    // await testBinarySearchCheatingClaimant(runner, verifier, account, challengerAccount, randomHexString())
    process.exit(anyError ? 1 : 0)
}

var anyError = false
test()
