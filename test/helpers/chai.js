const chai = require('chai')
const BigNumber = require('bignumber.js')

chai.use(require('chai-as-promised'))
chai.use(require('chai-bignumber')(BigNumber))

module.exports = chai
