
const Web3 = require('web3')
var web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8546'))

async function setupAccount(_account) {
    console.log("Account setup...".green)
    var account = _account ? _account : await web3.personal.newAccount('')
    console.log("Using account: ".cyan + account.cyan)
    await web3.personal.unlockAccount(account, '', 1000000)
    return account
}

async function deployContract(c_code, c_abi, c_addr, b_account, c_gas, bool_log, args) {
    var block = web3.eth.blockNumber
    if (bool_log) console.log("At block " + block)
    var contract
    if (c_addr) {
        contract = web3.eth.contract(c_abi).at(c_addr)
    } else {
        if (args) {
            contract = await web3.eth.contract(c_abi).new(args, {
                data: c_code,
                from: b_account,
                gas: c_gas
            })
        } else {
            contract = await web3.eth.contract(c_abi).new({
                data: c_code,
                from: b_account,
                gas: c_gas
            })
        }
    }
    // if (bool_log) console.log("contract deployed at ".blue + contract.address.blue)
    if (bool_log) console.log("contract deployed.")
    return contract
}

module.exports = {
    web3: web3,
    setupAccount: setupAccount,
    deployContract: deployContract
}

