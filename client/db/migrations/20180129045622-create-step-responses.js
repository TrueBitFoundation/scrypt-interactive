'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('step_responses', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      claim_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'claims', key: 'id'}
      },
      sessionID: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      step: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      state: {
        type: Sequelize.TEXT
      },
      stateHash: {
        type: Sequelize.TEXT
      },
      proof: {
        type: Sequelize.TEXT
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('step_responses');
  }
};
