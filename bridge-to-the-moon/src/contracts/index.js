const promisify = require('es6-promisify')
const path = require('path')
const contract = require('truffle-contract')
const readFile = promisify(require('fs').readFile)

const abisLocation = process.env.BTTM_ABI_LOCATION || '../../build'
const abiPath = (name) => path.resolve(__dirname, abisLocation, `${name}.abi`)
const getAbi = async (name) => readFile(abiPath(name), 'utf8')

module.exports = async (web3, {
  claimManager: claimManagerAddress,
  scryptRunner: scryptRunnerAddress,
}) => {
  const getContract = async (name) => {
    const AbstractContract = contract({
      abi: await getAbi(name),
    })

    AbstractContract.setProvider(web3.currentProvider)

    return AbstractContract
  }

  const ClaimManager = await getContract('ClaimManager')
  const ScryptRunner = await getContract('ScryptRunner')
  const ScryptVerifier = await getContract('ScryptVerifier')

  // @TODO(shrugs) - once truffle stops being fucking awful software
  //  change this to await ClaimManager.at()
  const claimManager = ClaimManager.at(claimManagerAddress)
  const scryptRunner = ScryptRunner.at(scryptRunnerAddress)
  const scryptVerifier = ScryptVerifier.at(
    await claimManager.scryptVerifierAddress.call()
  )

  return {
    claimManager,
    scryptRunner,
    scryptVerifier,
  }
}
