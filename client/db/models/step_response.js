'use strict';
module.exports = (sequelize, DataTypes) => {
  var StepResponse = sequelize.define('StepResponse', {
    claim_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'claims', key: 'id'}
    },
    sessionID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    step: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    state: {
      type: DataTypes.TEXT
    },
    stateHash: {
      type: DataTypes.TEXT
    },
    proof: {
      type: DataTypes.TEXT
    }
  }, {
    classMethods: {
      associate: function(models) {
        StepResponse.belongsTo(models.Claim)
      }
    },
    tableName: 'step_responses',
    underscored: true
  });

  return StepResponse;
};

