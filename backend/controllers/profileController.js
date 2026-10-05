const { UniqueConstraintError, ValidationError } = require("sequelize");
const { Dataset, DatasetVersion, User } = require("../models");

async function getProfile(req, res, next) {
  try {
    const [totalDatasets, totalVersions] = await Promise.all([
      Dataset.count({ where: { ownerId: req.user.id } }),
      DatasetVersion.count({
        include: [{
          model: Dataset,
          as: "dataset",
          attributes: [],
          where: { ownerId: req.user.id }
        }]
      })
    ]);
    return res.json({
      id: req.user.id,
      name: req.user.fullName,
      email: req.user.email,
      totalDatasets,
      totalUploads: totalVersions,
      totalVersions,
      createdAt: req.user.createdAt
    });
  } catch (error) {
    return next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const updates = {};
    if (Object.hasOwn(req.body, "name") || Object.hasOwn(req.body, "fullName")) {
      updates.fullName = String(req.body.fullName || req.body.name || "").trim();
      if (updates.fullName.length < 2 || updates.fullName.length > 100) {
        return res.status(400).json({ message: "Name must be between 2 and 100 characters." });
      }
    }
    if (Object.hasOwn(req.body, "email")) {
      updates.email = String(req.body.email || "").trim().toLowerCase();
      if (updates.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
        return res.status(400).json({ message: "Enter a valid email address." });
      }
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: "Provide a name or email to update." });
    }

    await req.user.update(updates);
    return res.json({
      message: "Profile updated successfully.",
      user: { id: req.user.id, name: req.user.fullName, email: req.user.email }
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({ message: "That email address is already in use." });
    }
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.errors.map((item) => item.message).join(" ") });
    }
    return next(error);
  }
}

module.exports = { getProfile, updateProfile };
