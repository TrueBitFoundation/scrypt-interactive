
function randomHexString () {
  var length = Math.floor(Math.random() * 1024)
  var s = '0x'
  for (var i = 0; i < length; i++) { s += Math.floor(Math.random() * 0xff).toString(16) }
  if (s.length % 2 === 1) {
    s += '0'
  }
  return s
}

function randomInt (n) {
  return Math.floor(Math.random() * n)
}

function chooseRandomly (data) {
  return data[randomInt(data.length)]
}

function flipRandomNibble (data) {
  if (data.length === 2) {
    console.log('Cannot flip nibble in empty data'.red)
    process.exit(1)
  }
  var nibble = 2 + randomInt(data.length - 2)
  var m = data
  while (m === data) {
    m = data.substring(0, nibble) + randomInt(16).toString(16) + data.substring(nibble + 1)
  }
  return m
}

module.exports = {
  randomHexString: randomHexString,
  chooseRandomly: chooseRandomly,
  flipRandomNibble: flipRandomNibble,
}
