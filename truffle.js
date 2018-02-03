const HDWalletProvider = require('truffle-hdwallet-provider')

const defaultConfig = {
  // eslint-disable-next-line camelcase
  network_id: '*',
  gas: 5000000,
  gasPrice: 4000000000, // gwei
}

module.exports = {
  networks: {
    infura: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          `https://${process.env.INFURA_CHAIN}.infura.io`
        )
      },
      ...defaultConfig,
    },
    development: {
      host: 'localhost',
      port: 8545,
      ...defaultConfig,
    },
    ganache: {
      host: 'localhost',
      port: 8545,
      ...defaultConfig,
    },
    geth: {
      host: '127.0.0.1',
      port: 8545,
      ...defaultConfig,
    },
    parity: {
      host: 'localhost',
      port: 4242,
      ...defaultConfig,
    },
  },
}
