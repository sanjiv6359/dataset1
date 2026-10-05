const jwt = require("jsonwebtoken");
const { User } = require("../models");

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required. Send a Bearer token." });
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    return res.status(401).json({ message: "Authentication token is missing." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    const user = await User.findByPk(payload.userId);
    if (!user) {
      return res.status(401).json({ message: "The account for this token no longer exists." });
    }
    req.user = user;
    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid or expired authentication token." });
    }
    return next(error);
  }
}

module.exports = authMiddleware;
