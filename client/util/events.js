module.exports = {
  tryStopWatching: async (filter, name = 'Unknown') => {
    try {
      filter.stopWatching()
    } catch (error) {
      console.error(`Could not stop watching filter ${name}. Continuing to watch. This could cause bugs.`)
    }
  },
}
