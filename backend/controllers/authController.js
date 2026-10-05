const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { UniqueConstraintError, ValidationError } = require("sequelize");
const { User } = require("../models");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function register(req, res, next) {
  try {
    const fullName = String(req.body.fullName || req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (fullName.length < 2 || fullName.length > 100) {
      return res.status(400).json({ message: "Name must be between 2 and 100 characters." });
    }
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }
    if (password.length < 6 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ message: "Password must be between 6 and 72 characters." });
    }

    const existingUser = await User.unscoped().findOne({ where: { email }, attributes: ["id"] });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ fullName, email, password: hashedPassword });
    return res.status(201).json({
      message: "Account created successfully.",
      user: { id: user.id, name: user.fullName, email: user.email, createdAt: user.createdAt }
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.errors.map((item) => item.message).join(" ") });
    }
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!EMAIL_PATTERN.test(email) || !password) {
      return res.status(400).json({ message: "A valid email and password are required." });
    }

    const user = await User.unscoped().findOne({
      where: { email },
      attributes: ["id", "fullName", "email", "password", "createdAt"]
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Email or password is incorrect." });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "7d", issuer: "ai-dataset-change-passport" }
    );

    return res.status(200).json({
      token,
      user: { id: user.id, name: user.fullName, email: user.email }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login };
