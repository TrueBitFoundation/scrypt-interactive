module.exports = async (web3) => new Promise((resolve, reject) => {
  web3.eth.getAccounts((err, res) => {
    if (err) return reject(err)
    resolve(res)
  })
})
