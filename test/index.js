const fs = require('fs')
const tape = require('tape')
const spawn = require('tape-spawn')
const Web3 = require('web3')
const process = require('process')
const color = require('colors')
const child_process = require('child_process')

// Use the local (non-js) compiler or not.
const useLocalSolc = false
if (useLocalSolc) {
  console.log("using local solc".cyan)
} else {
  console.log("using js solc".cyan)
}

function invokeCompiler(input) {
    console.log("invoking the compiler...".green)
    if (useLocalSolc) {
        var result = child_process.spawnSync('solc', ['--standard-json', '-'], {input: input, encoding: 'utf-8'})
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
    console.log("checking for errors...".green)
    var anyError = false
    if ("errors" in results) {
      for (var e of results.errors) {
          if (e.severity != 'warning') {
              console.log(e.formattedMessage.red)
              anyError = true
          }
      }
    }
    if (anyError) {
        process.exit(1)
    } else {
      console.log("no errors found...".cyan)
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
        'scryptRunner.sol': {'content': readFile('contracts/scryptRunner.sol')}
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
        'scryptFramework.sol': {'content': readFile('contracts/scryptFramework.sol')},
        'scryptVerifier.sol': {'content': readFile('contracts/scryptVerifier.sol')}
        }
    }
    results = JSON.parse(invokeCompiler(JSON.stringify(compilerInput_verifier)))
    checkForErrors(results)
    verifierCode = '0x' + results['contracts']['scryptVerifier.sol']['ScryptVerifier']['evm']['bytecode']['object']
    verifierABI = results['contracts']['scryptVerifier.sol']['ScryptVerifier']['abi']
    // console.log('var verifierCode = "' + verifierCode + '"')
    // console.log('var verifierABI = ' + JSON.stringify(verifierABI) + '')
}
console.log("Compiling contracts...".green)
compile()

/*
Modify geth by setting the "call" timeout to 500 seconds instead of 5

start geth using

geth --dev --rpc --rpcapi miner,personal,web3,eth

then use `geth attach ipc:///tmp/ethereum_dev_mode/geth.ipc` with
var account = personal.newAccount('')
account
// and copy the account to below
personal.unlockAccount(account, '', 1000000)
miner.setEtherbase(account)
miner.start()
*/
// Needs to be done every time: personal.unlockAccount(account)

// Remove if not deployed yet
var web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'))
var contractAddr_runner = 0
var contractAddr_verifier = 0

async function SetupGeth(_account) {
    console.log("running geth setup:".green)
    var account = _account ? _account : await web3.eth.personal.newAccount('')
    console.log("Using account: ".cyan + account.cyan)
    await web3.eth.personal.unlockAccount(account, '', 1000000)
    //await miner.setEtherbase(account)
    //await web3.miner.start(2)
    //var account = "0x292248f34a6e929dd4820535b41219ba81d79255"
    return account
}

var expectations = {
    0: [
        "0x3c268302673baaf8870141b9f4794454d2205c8f4074876a845d4df804bf55f",
        "0x62f06b94b13667ab93881eaeee5bdf4e803b452cc81928c314fe8160e1ecbb4f",
        "0xd97d406e33f717cad5950a7e6bdb7efbd171aa0dd30a1e448c33f791cf8c2016",
        "0x8e5bfa6d8e22bf3f240a4fc063e1f5b100728f046756d669cee62bb872154b45"
    ],
    1: [
        "0xafd217fb5feb256ef297b38bfaa3b6ab11bc21149568a18bf91dac87db4e7a83",
        "0x6458f3f41a9147b9abb7535fccca15de735fbc7b1bfeacfd3597600e12c08012",
        "0xc5a9f7db6589b26e8ab04ddd707892ceff0cf3e1ed5432b837540d6d1946952e",
        "0x396ffd44dfb9444c8adb64caffd9dd922d6542dae17db75ed82bf38bf3b91b78"
    ],
    1024: [
        "0x1c62770d44a4eeb47f01de7e65c8f43b026c637cf208dd6013a3f9df6e6ded0a",
        "0xe7b7ae5b8deaa9d9a147775886b0d31cfc7af04a27662405de9554aa06b1800b",
        "0x28c68c4b78f4b4fad370f4b662d9e7bc01fcecf2b6d9545714b909f272fe49b5",
        "0xc19f7ed077ec236a0721b6fe7abc9369ade9d7d7b60d22bbbe0baf8699c09472"
    ],
    1025: [
        "0xfaf12052158160f6a7255bc1689a6cc5bd8bc953ebddf8bbe645157d479119b9",
        "0xf5d793693d8f7c2840341db0abb693c2e562bae33883c731b1d9170436b2a5c1",
        "0xf92d1f40b7a4f75f121568fe96389755f8b689a05082e084cc8e6b70eb0ec1d3",
        "0x799d0314cfc8962dab57508b04f6d94e73b554c3d1a6bd0bb7c404fcc08b1133"
    ],
    2048: [
        "0x3f3d915849eba08428ac85aa72f9159d4a406afc43a598789d32110ff4d0bc40",
        "0x3959831424f3546318d09292760cc19bd6a7559f4bd603470c16c61b45398fa",
        "0x9e17c9061d1313a0a0998c7664d5588f13c9040cb4aa942702ff75c460e92145",
        "0x28b3b2ce855bea481cd966c078c062a715e2897e7c144e15c05dfd52e3bb7cdb"
    ]
}

async function deployIfNeeded(account) {
    var block = await web3.eth.getBlockNumber()
    console.log("At block " + block)
    var runner
    if (contractAddr_runner) {
        runner = new web3.eth.Contract(runnerABI, contractAddr_runner)
    } else {
        runner = await new web3.eth.Contract(runnerABI).deploy({data: runnerCode}).send({
            from: account,
            gas: 4000000
        })
    }
    console.log("runner deployed at ".blue + runner.options.address.blue)
    return runner
}

async function deployContract(c_code, c_abi, c_addr, b_account, c_gas, bool_log) {
  var block = await web3.eth.getBlockNumber()
    if (bool_log) console.log("At block " + block)
    var contract
    if (c_addr) {
        contract = new web3.eth.Contract(c_abi, c_addr)
    } else {
        contract = await new web3.eth.Contract(c_abi).deploy({data: c_code}).send({
            from: b_account,
            gas: c_gas
        })
    }
    if (bool_log) console.log("contract deployed at ".blue + contract.options.address.blue)
    return contract
}

async function testStepValues(account) {
    console.log("testing step values:".green)
    var runner = await deployIfNeeded(account)
    var error = false
    var input = '0x5858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858'
    for (var i of [0, 1, 1024, 1025, 2048]) {
        var result = await runner.methods.run(input, i).call({
            from: account
        })
        for (var j = 0; j < 4; j++) {
            if (expectations[i][j] != web3.utils.numberToHex(result.vars[j])) {
                console.log("Invalid internal state at step " + i)
                console.log(web3.utils.numberToHex(result.vars[0]))
                console.log(web3.utils.numberToHex(result.vars[1]))
                console.log(web3.utils.numberToHex(result.vars[2]))
                console.log(web3.utils.numberToHex(result.vars[3]))
                error = true
            }
        }
    }
    result = await runner.methods.run(input, 2049).call({from: account})
    if (result.proof != "0xda26bdbab79be8f5162c4ca87cc52d6f926fb21461b9fb1c88bf19180cb5c246000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000") {
        console.log("Invalid result after step 2049: ".red + result.proof)
        error = true
    }
    if (!error) {
        console.log("success".green)
    } else {
        process.exit(1)
    }
}

async function verifyInnerStepTest(account) {
    console.log("verifying inner steps:".green)
    var runner = await deployContract(runnerCode, runnerABI, contractAddr_runner, account, 4000000, true)
    var verifier =  await deployContract(verifierCode, verifierABI, contractAddr_verifier, account, 4000000, true)
    var anyError = false
    var input = '0x5858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858'
    for (var step of [2, 8, 100, 1023, 1024, 1025, 1026, 2000]) {
        var pre = await runner.methods.run(input, step - 1).call({from: account})
        var post = await runner.methods.run(input, step).call({from: account})
        var error = await verifier.methods.verifyInnerStep(step, pre.vars, pre.memoryHash, post.vars, post.memoryHash, post.proof).call({from: account})
        if (error != 0) {
            anyError = true
            console.log("Verification failed for step ".red + step)
            console.log(pre)
            console.log(post)
            console.log(error)
        }
    }
    if (!anyError) {
        console.log("success".green)
        process.exit(0)
    } else {
      process.exit(1)
    }
}

async function test(_account) {
    var account = await SetupGeth(_account)
    await testStepValues(account)
    await verifyInnerStepTest(account)
}

async function tryStuff(account) {
    var runner =  await deployIfNeeded(account)
    var error = false
    var input = '0x5858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858'
    console.log(await runner.methods.run(input, 1).call({from: account}))
}

var account = null
if (process.argv.length >= 1 && process.argv[process.argv.length - 1].startsWith('0x'))
{
    account = process.argv[process.argv.length - 1]
}
test(account)
//tryStuff();
//verifyInnerStepTest()
