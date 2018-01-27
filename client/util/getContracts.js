const promisify = require('es6-promisify')
const path = require('path')
const readFile = promisify(require('fs').readFile)

const abisLocation = process.env.BTTM_ABI_LOCATION || '../../build/contracts'
const abiPath = (name) => path.resolve(__dirname, abisLocation, `${name}.json`)
const getAbi = async (name) => JSON.parse(await readFile(abiPath(name), 'utf8')).abi

module.exports = async (web3) => {
  const getContract = async (name, address) =>
    web3.eth.contract(await getAbi(name)).at(address)

  const claimManager = await getContract('ClaimManager', process.env.CLAIM_MANAGER_ADDRESS)
  const scryptVerifier = await getContract('ScryptVerifier', process.env.SCRYPT_VERIFIER_ADDRESS)
  const dogeRelay = await getContract('DogeRelay', process.env.DOGE_RELAY_ADDRESS)

  //need web3 that points to 4242 to get this to work
  const scryptRunner = await getContract('ScryptRunner', process.env.SCRYPT_RUNNER_ADDRESS)

  return {
    claimManager,
    scryptVerifier,
    scryptRunner,
    dogeRelay
  }
}