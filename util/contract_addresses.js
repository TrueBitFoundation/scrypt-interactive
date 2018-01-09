const fs = require('fs');

async function getAccounts() {
  return await new Promise((resolve, reject) => {
    web3.eth.getAccounts((error, _accounts) => {
      if(error) reject();
      resolve(_accounts);  
    })
  })
}

module.exports = async function(callback) {
  // perform actions
  const ClaimManager = artifacts.require('ClaimManager')
  const ScryptVerifier = artifacts.require('ScryptVerifier')

  let accounts = await getAccounts();

  let dogeAddress = accounts[0];

  let scryptVerifier = await ScryptVerifier.new()
  let claimManager = await ClaimManager.new(dogeAddress, scryptVerifier.address)

  fs.writeFileSync('./contract_addresses.json', JSON.stringify({
  	scryptVerifier: scryptVerifier.address,
  	claimManager: claimManager.address,
  	dogeRelay: dogeAddress,
  	claimant: accounts[1],
  	challenger: accounts[2]
  }))

}