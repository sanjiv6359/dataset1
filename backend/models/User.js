const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define("User", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  fullName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: "Full name is required." },
      len: { args: [2, 100], msg: "Full name must be between 2 and 100 characters." }
    }
  },
  email: {
    type: DataTypes.STRING(254),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: { msg: "Enter a valid email address." },
      notEmpty: { msg: "Email is required." }
    },
    set(value) {
      this.setDataValue("email", value.trim().toLowerCase());
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: "Users",
  defaultScope: {
    attributes: { exclude: ["password"] }
  },
  scopes: {
    withPassword: { attributes: { include: ["password"] } }
  }
});

module.exports = User;
