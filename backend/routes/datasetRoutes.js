const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
const {
  uploadDataset,
  getHistory,
  getPassport,
  compareVersions,
  getDashboard
} = require("../controllers/datasetController");

const router = express.Router();

router.use(authMiddleware);
router.get("/history", getHistory);
router.get("/dashboard", getDashboard);
router.get("/compare/:v1/:v2", compareVersions);
router.get("/passport/:id", getPassport);
router.post("/upload", upload.single("file"), uploadDataset);

module.exports = router;
