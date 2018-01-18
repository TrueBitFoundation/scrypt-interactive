// spin up parity
// spin up ganache-cli
// deploy contracts
// set addresses in ENV

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP_PROVIDER))


const main = async () => {
  const bridge = await require('./bridge-to-the-moon')(web3)

  // test deposit CRUD
  // test monitorClaim and then run through the entire flow
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
