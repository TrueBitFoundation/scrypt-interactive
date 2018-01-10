module.exports = async (web3, api) => {
    return {
        challengeClaim: require('./challengeClaim')(web3, api),
    }
}