const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { getProfile, updateProfile } = require("../controllers/profileController");

const router = express.Router();

router.use(authMiddleware);
router.get("/", getProfile);
router.patch("/", updateProfile);

module.exports = router;
