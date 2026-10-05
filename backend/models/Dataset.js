const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Dataset = sequelize.define("Dataset", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  datasetName: {
    type: DataTypes.STRING(150),
    allowNull: false,
    validate: {
      notEmpty: { msg: "Dataset name is required." },
      len: { args: [1, 150], msg: "Dataset name must be 150 characters or fewer." }
    }
  },
  ownerId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  uploadDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "Datasets"
});

module.exports = Dataset;
