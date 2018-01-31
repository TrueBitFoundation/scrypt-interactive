module.exports = () => {
  let stop
  const stopper = new Promise((resolve) => {
    stop = resolve
  })

  return { stop, stopper }
}
