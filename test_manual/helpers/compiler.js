
const fs = require('fs')

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
}

module.exports = {
    compile: compile
}
