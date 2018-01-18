module.exports = async (web3, api) => {
    return {
        challengeClaim: require('./challengeClaim')(web3, api),
        createClaim: require('./createClaim')(web3, api),
    }
}