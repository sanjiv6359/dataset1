const sequelize = require("../config/database");
const User = require("./User");
const Dataset = require("./Dataset");
const DatasetVersion = require("./DatasetVersion");

User.hasMany(Dataset, {
  foreignKey: { name: "ownerId", allowNull: false },
  as: "datasets",
  onDelete: "CASCADE"
});
Dataset.belongsTo(User, { foreignKey: "ownerId", as: "owner" });

Dataset.hasMany(DatasetVersion, {
  foreignKey: { name: "datasetId", allowNull: false },
  as: "versions",
  onDelete: "CASCADE"
});
DatasetVersion.belongsTo(Dataset, { foreignKey: "datasetId", as: "dataset" });

module.exports = { sequelize, User, Dataset, DatasetVersion };
