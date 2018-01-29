'use strict';

module.exports = (sequelize, DataTypes) => {
  var Claim = sequelize.define('Claim', {
    claimID: {
      type: DataTypes.STRING
    },
    input: {
      type: DataTypes.TEXT
    },
    hash: {
      type: DataTypes.TEXT
    },
    claimant: {
      allowNull: false,
      type: DataTypes.STRING
    },
    claimCreatedAt: {
      type: DataTypes.INTEGER
    },
    state: {
      type: DataTypes.STRING
    },
    proposalID: {
      type: DataTypes.STRING
    }
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    },
    tableName: 'claims',
  });

  return Claim;
};
