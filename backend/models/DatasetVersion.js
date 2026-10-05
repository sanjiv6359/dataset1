const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const DatasetVersion = sequelize.define("DatasetVersion", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  datasetId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  versionNumber: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  rowsCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  columnsCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  missingValuesCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  duplicateRowsCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  versionNote: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  originalFileName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  fileSize: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  uploadDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  filePath: {
    type: DataTypes.STRING(500),
    allowNull: false
  }
}, {
  tableName: "DatasetVersions"
});

module.exports = DatasetVersion;
