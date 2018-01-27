const promisify = require('es6-promisify')

const getAllEvents = async (contract, eventName) => {
  const ctx = contract[eventName]({}, { fromBlock: 0, toBlock: 'latest' })
  return promisify(ctx.get, ctx)()
}

module.exports = {
  getAllEvents,
}
