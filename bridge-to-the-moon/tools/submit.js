const setup = require('../src/utils/setup')

async function main () {
  const { web3, bridge, api } = await setup()
}

main()
