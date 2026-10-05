const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const uploadDirectory = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedExtensions = new Set([".csv", ".xlsx"]);
const allowedMimeTypes = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream"
]);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => {
    callback(null, `${Date.now()}-${crypto.randomBytes(12).toString("hex")}${path.extname(file.originalname).toLowerCase()}`);
  }
});

const fileFilter = (_req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.has(extension) || !allowedMimeTypes.has(file.mimetype)) {
    const error = new Error("Only CSV and XLSX dataset files are allowed.");
    error.status = 400;
    return callback(error);
  }
  return callback(null, true);
};

const maxFileSize = Number(process.env.MAX_FILE_SIZE_MB || 25) * 1024 * 1024;

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSize,
    files: 1
  }
});

module.exports = upload;
