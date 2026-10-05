const path = require("path");
const { Sequelize } = require("sequelize");

const databaseName = process.env.DATABASE_NAME || "dataset_passport";
const storage = process.env.DATABASE_STORAGE
  ? path.resolve(__dirname, "..", process.env.DATABASE_STORAGE)
  : path.join(__dirname, "..", `${databaseName}.sqlite`);

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage,
  logging: false
});

module.exports = sequelize;
