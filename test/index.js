const fs = require('fs')
const tape = require('tape')
const spawn = require('tape-spawn')
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
    var anyError = false
    for (var e of results.errors) {
        if (e.severity != 'warning') {
            console.log(e.formattedMessage.red)
            anyError = true
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
var mining_threads = 1

function checkWork() {
    if (eth.pendingTransactions.length > 0) {
        if (eth.mining) return;
        console.log("== Pending transactions! Mining...");
        miner.start(mining_threads);
    } else {
        miner.stop();
        console.log("== No transactions! Mining stopped.");
    }
}

eth.filter("latest", function(err, block) { checkWork(); });
eth.filter("pending", function(err, block) { checkWork(); });

checkWork();
*/
// Needs to be done every time: personal.unlockAccount(account)

// Remove if not deployed yet
var web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'))
var contractAddr_runner = 0
var contractAddr_verifier = 0

async function setupAccount(_account) {
    console.log("Account setup...".green)
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

function randomHexString() {
    var length = Math.floor(Math.random() * 1024); 
    var s = '0x';
    for (var i = 0; i < length; i++)
        s += Math.floor(Math.random() * 0xff).toString(16);
    if (s.length % 2 == 1) {
        s += '0'
    }
    return s;
}

function randomInt(n) {
    return Math.floor(Math.random() * n);
}

function chooseRandomly(data) {
    return data[randomInt(data.length)];
}

function flipRandomNibble(data) {
    if (data.length == 2) {
        console.log("Cannot flip nibble in empty data".red)
        process.exit(1)
    }
    var nibble = 2 + randomInt(data.length - 2);
    var m = data;
    while (m == data) {
        m = data.substring(0, nibble) + randomInt(16).toString(16) + data.substring(nibble + 1)
    }
    return m;
}

async function testStepValues(runner, verifier, account) {
    console.log("testing step values:".green)
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
    if (result.output != "0xda26bdbab79be8f5162c4ca87cc52d6f926fb21461b9fb1c88bf19180cb5c246") {
        console.log("Invalid result after step 2049: ".red + result.output)
        anyError = true
    }
}

async function runProverVerifierCombination(prover, verifier, account, step, input)
{
    var state = (await prover.methods.getStateAndProof(input, step).call({from: account})).state;
    var postData = (await prover.methods.getStateAndProof(input, step + 1).call({from: account}))
    return await verifier.methods.verifyStep(step, state, postData.state, postData.proof || '0x00').call({from: account});
}

/// This tests the prover-verifier-combination on same steps for a specific input.
async function testProverVerifierCombination(runner, verifier, account, input) {
    console.log(("Testing prover verifier combination on " + input + "...").green)
    for (var step of [0, 1, 2, 3, 100, 106, 1021, 1023, 1024, 1025, 1026, 2000, 2044, 2045, 2046, 2047, 2048, 2049]) {
        if (await runProverVerifierCombination(runner, verifier, account, step, input) !== true) {
            console.log(("Error verifying step " + step).red)
            anyError = true;
        }
    }
}

// This flips a random nibble in the proof or state.
async function testRandomManipulatedProverVerifierCombination(prover, verifier, account)
{
    var input = randomHexString()
    var step = chooseRandomly([0, 1, 2, 78, 79, 1020, 1022, 1023, 1024, 1025, 1026, 2047, 2048, 2049])
    console.log("Random manipulation test on step " + step)
    var preState = (await prover.methods.getStateAndProof(input, step).call({from: account})).state;
    var postData = (await prover.methods.getStateAndProof(input, step + 1).call({from: account}))
    var postState = postData.state;
    var proof = postData.proof || '0x00';

    var correctData = '';
    var which = randomInt(3);
    if (which == 0) {
        correctData = preState
        preState = flipRandomNibble(preState);
    } else if (which == 1 || step == 0 /* proof is unused in step 0 */) {
        correctData = postState
        postState = flipRandomNibble(postState);
    } else {
        correctData = proof
        proof = flipRandomNibble(proof);
    }
    if ((await verifier.methods.verifyStep(step, preState, postState, proof).call({from: account})) !== false) {
        console.log("Verification of manipulated data succeeded:".red)
        console.log("input: " + input)
        console.log("step: " + step)
        console.log("Manipulated part: " + ['pre state', 'post state', 'proof'][which])
        console.log("Original value: " + correctData)
        console.log("Modified data:")
        console.log("preState: " + preState)
        console.log("postState: " + postState)
        console.log("proof: " + proof)
        anyError = true
    }
}

async function test(_account) {
    var account = await setupAccount(_account)
    var runner = await deployContract(runnerCode, runnerABI, contractAddr_runner, account, 4000000, true)
    var verifier =  await deployContract(verifierCode, verifierABI, contractAddr_verifier, account, 4000000, true)
    await testStepValues(runner, verifier, account)
    var input = '0x5858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858'
    await testProverVerifierCombination(runner, verifier, account, input)
    console.log("Trying random input")
    for (var i = 0; i < 10; i++) {
        await testProverVerifierCombination(runner, verifier, account, randomHexString())
    }
    for (var i = 0; i < 50; i++) {
        await testRandomManipulatedProverVerifierCombination(runner, verifier, account)
    }
}

var account = null
if (process.argv.length >= 1 && process.argv[process.argv.length - 1].startsWith('0x'))
{
    account = process.argv[process.argv.length - 1]
}

var anyError = false
test(account)
if (anyError) {
    process.exit(1)
}

