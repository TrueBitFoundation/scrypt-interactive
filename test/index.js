const db = require('../client/db/models')

before(async () => {
  // clean up database before running tests.
  await db.sequelize.authenticate()
  await db.sequelize.sync({ force: true })
})

after(async () => {
  console.log('closing db...')
  // await db.sequelize.close()
  console.log('closed.')
})
