module.exports = async (web3, api, challenger) => {
    return {
        challengeClaim: require('./challengeClaim')(web3, api, challenger),
        createClaim: require('./createClaim')(web3, api),
    }
}