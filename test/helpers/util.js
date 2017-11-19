
const Web3 = require('web3')
const net = require('net')

var ipcpath = '/tmp/ethereum_dev_mode/geth.ipc'
if (process.argv.length >= 3) {
    ipcpath = process.argv[process.argv.length - 1]
}

console.log(("using ipcpath: " + ipcpath).cyan)
var web3 = new Web3(new Web3.providers.IpcProvider(ipcpath, net))

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

module.exports = {
    web3: web3,
    setupAccount: setupAccount,
    deployContract: deployContract
}

