const Web3 = require('web3');
const fs = require('fs');
const deploy = require('./deploy');

const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:4242"))

var account

var _scryptRunner

async function scryptRunner() {

  if(!account) account = await deploy.setupAccount(Buffer("0x00a329c0648769a73afac7f9381e08fb43dbea72"))

  if(!_scryptRunner) _scryptRunner = await deploy.deployContract(runnerCode, runnerABI, 0, account, 4000000, true)

  return _scryptRunner 
}

async function getStateProofAndHash(scryptRunner, input, step) {
  return new Promise((resolve) => {
    return scryptRunner.getStateProofAndHash.call(input, step, (err, result) => {
      if(err) {
        reject(err);
      }else{
        resolve(result);
      }
    })
  })
}

async function run(scryptRunner, input, step) {
  return new Promise((resolve, reject) => {
    return scryptRunner.run.call(input, step, (err, result) => {
      if(err) {
        reject(err);
      }else{
        resolve(result);
      }
    })
  })
}

async function getStateAndProof(scryptRunner, input, step) {
  return new Promise((resolve) => {
    return scryptRunner.getStateAndProof.call(input, step, (err, result) => {
      if(err) {
        reject(err);
      }else{
        resolve(result);
      }
    })
  })
}

module.exports = {
  scryptRunner: scryptRunner,
  getStateProofAndHash: getStateProofAndHash,
  run: run,
  getStateAndProof: getStateAndProof,
}