
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('claims', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      claimID: {
        type: Sequelize.STRING,
      },
      input: {
        type: Sequelize.TEXT,
      },
      hash: {
        type: Sequelize.TEXT,
      },
      claimant: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      claimCreatedAt: {
        type: Sequelize.INTEGER,
      },
      state: {
        type: Sequelize.STRING,
      },
      proposalID: {
        type: Sequelize.STRING,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('claims')
  },
}
