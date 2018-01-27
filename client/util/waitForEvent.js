const promisify = require('es6-promisify')

module.exports = async (contract, ...args) => {
  const once = promisify(contract.contract.once, contract.contract)

  return once(...args)
}
