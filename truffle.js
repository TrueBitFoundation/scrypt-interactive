module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*', // Match any network id
      gas: 6700000,
    },
    testrpc: {
      host: 'localhost',
      port: 8545,
      network_id: '*', // Match any network id
      gas: 6700000,
    },
    ganache: {
      host: 'localhost',
      port: 7545,
      network_id: '*', // Match any network id
    },
    parity: {
      host: 'localhost',
      port: 4242,
      network_id: '*', // Match any network id
      gas: 8000000,
    },
  },
}
