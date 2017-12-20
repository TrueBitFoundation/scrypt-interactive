const Ganache = require("ganache-core");
const Web3 = require('web3');
const fs = require('fs');

const web3 = new Web3(Ganache.provider())

const scryptRunnerBin = fs.readFileSync('./special_contracts_build/ScryptRunner.bin', 'utf8')
const scryptRunnerABI = JSON.parse(fs.readFileSync('./special_contracts_build/ScryptRunner.abi', 'utf8'))

async function scryptRunner() {

	//Because we are using old web3
	let accounts = await new Promise((resolve) => {
	  return web3.eth.getAccounts((err, result) => {
	    resolve(result)
	  })
	})

	return new Promise((resolve) => {
	  return web3.eth.contract(scryptRunnerABI)
	  .new({from: accounts[0], data: scryptRunnerBin}, (error, result) => {
	    if(error) { console.log(error) }
	    resolve(result)
	  })
	})
}

async function getStateProofAndHash(scryptRunner, input, step) {
  return new Promise((resolve) => {
    return scryptRunner.getStateProofAndHash.call(input, step, (err, result) => {
      resolve(result);
    })
  })
}

async function run(scryptRunner, input, step) {
  return new Promise((resolve) => {
    return scryptRunner.run.call(input, step, (err, result) => {
      resolve(result);
    })
  })
}

async function getStateAndProof(scryptRunner, input, step) {
  return new Promise((resolve) => {
    return scryptRunner.getStateAndProof.call(input, step, (err, result) => {
      resolve(result);
    })
  })
}

module.exports = {
  scryptRunner: scryptRunner,
  getStateProofAndHash: getStateProofAndHash,
  run: run,
  getStateAndProof: getStateAndProof,
}