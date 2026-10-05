require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { ValidationError, UniqueConstraintError } = require("sequelize");
const { sequelize } = require("./models");
const authRoutes = require("./routes/authRoutes");
const datasetRoutes = require("./routes/datasetRoutes");
const profileRoutes = require("./routes/profileRoutes");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("Set JWT_SECRET to a random value of at least 32 characters in backend/.env.");
}

const app = express();
const port = Number(process.env.PORT || 5000);

const allowedOrigins = new Set([
  ...(process.env.FRONTEND_ORIGIN || "http://localhost:5000").split(",").map((origin) => origin.trim()),
  "http://127.0.0.1:5000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "null"
]);

app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use((req, res, next) => {
  if (req.is("application/json") && (!req.body || typeof req.body !== "object" || Array.isArray(req.body))) {
    return res.status(400).json({ message: "JSON request body must be an object." });
  }
  req.body = req.body || {};
  return next();
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "AI Dataset Change Passport API" });
});
app.use("/api/auth", authRoutes);
app.use("/api/datasets", datasetRoutes);
app.use("/api/profile", profileRoutes);

app.use(express.static(path.join(__dirname, "..", "frontend")));

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
});

app.use((error, _req, res, _next) => {
  if (res.headersSent) return;
  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const message = error.code === "LIMIT_FILE_SIZE"
      ? `File exceeds the ${process.env.MAX_FILE_SIZE_MB || 25} MB upload limit.`
      : error.message;
    return res.status(status).json({ message });
  }
  if (error instanceof UniqueConstraintError) {
    return res.status(409).json({ message: "A record with this value already exists." });
  }
  if (error instanceof ValidationError) {
    return res.status(400).json({ message: error.errors.map((item) => item.message).join(" ") });
  }
  if (error.status && error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ message: error.message });
  }
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ message: "Request body must contain valid JSON." });
  }

  console.error("Unhandled request error:", error);
  return res.status(500).json({ message: "An unexpected server error occurred." });
});

async function startServer() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    app.listen(port, () => {
      console.log(`DataPass API is running at http://localhost:${port}`);
      console.log(`Frontend is available at http://localhost:${port}/`);
    });
  } catch (error) {
    console.error("Could not start the DataPass API:", error);
    process.exitCode = 1;
  }
}

startServer();

module.exports = app;
