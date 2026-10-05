const fs = require("fs/promises");
const path = require("path");
const ExcelJS = require("exceljs");
const { parse } = require("csv-parse/sync");
const { Op } = require("sequelize");
const { sequelize, Dataset, DatasetVersion, User } = require("../models");

async function inspectDataset(filePath, extension) {
  let rows;
  if (extension === ".xlsx") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const firstSheet = workbook.worksheets[0];
    if (!firstSheet) {
      throw new Error("The spreadsheet does not contain a worksheet.");
    }
    rows = [];
    firstSheet.eachRow({ includeEmpty: false }, (row) => {
      rows.push(row.values.slice(1));
    });
  } else {
    const content = await fs.readFile(filePath, "utf8");
    rows = parse(content, {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      record_delimiter: ["\r\n", "\n", "\r"]
    });
  }

  if (!rows.length) {
    throw new Error("The dataset file is empty.");
  }

  const headers = rows[0].map((value) => String(value ?? "").trim());
  const dataRows = rows.slice(1);
  const columnsCount = dataRows.reduce((count, row) => Math.max(count, row.length), headers.length);
  let missingValuesCount = 0;
  const normalizedRows = dataRows.map((row) => {
    const values = Array.from({ length: columnsCount }, (_, index) => row[index] ?? "");
    missingValuesCount += values.filter((value) => String(value).trim() === "").length;
    return JSON.stringify(values.map((value) => String(value).trim()));
  });

  return {
    rowsCount: dataRows.length,
    columnsCount,
    missingValuesCount,
    duplicateRowsCount: normalizedRows.length - new Set(normalizedRows).size
  };
}

async function uploadDataset(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ message: "Choose a CSV or XLSX file to upload." });
  }

  let transaction;
  try {
    const datasetName = String(req.body.datasetName || "").trim();
    const datasetId = req.body.datasetId ? Number(req.body.datasetId) : null;
    const versionNote = String(req.body.versionNote || "").trim();
    if (!datasetId && (datasetName.length < 1 || datasetName.length > 150)) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ message: "Dataset name is required and must be 150 characters or fewer." });
    }
    if (datasetId && (!Number.isSafeInteger(datasetId) || datasetId < 1)) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ message: "Dataset ID must be a positive integer." });
    }
    if (versionNote.length > 500) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ message: "Version note must be 500 characters or fewer." });
    }

    let targetDataset = null;
    if (datasetId) {
      targetDataset = await Dataset.findOne({ where: { id: datasetId, ownerId: req.user.id } });
      if (!targetDataset) {
        await fs.unlink(req.file.path);
        return res.status(404).json({ message: "Dataset was not found in your account." });
      }
    }

    let statistics;
    try {
      statistics = await inspectDataset(req.file.path, path.extname(req.file.originalname).toLowerCase());
    } catch (error) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ message: `Could not read dataset: ${error.message}` });
    }

    transaction = await sequelize.transaction();
    if (!targetDataset) {
      targetDataset = await Dataset.create({
        datasetName,
        ownerId: req.user.id
      }, { transaction });
    }

    const latest = await DatasetVersion.findOne({
      where: { datasetId: targetDataset.id },
      order: [["id", "DESC"]],
      transaction
    });
    const previousVersion = latest?.versionNumber.match(/^v?(\d+)\.(\d+)$/i);
    const versionNumber = previousVersion
      ? `v${previousVersion[1]}.${Number(previousVersion[2]) + 1}`
      : "v1.0";
    const version = await DatasetVersion.create({
      datasetId: targetDataset.id,
      versionNumber,
      ...statistics,
      versionNote: versionNote || null,
      originalFileName: req.file.originalname,
      fileSize: req.file.size,
      filePath: path.relative(path.join(__dirname, ".."), req.file.path).split(path.sep).join("/"),
      uploadDate: new Date()
    }, { transaction });
    await targetDataset.update({ uploadDate: version.uploadDate }, { transaction });
    await transaction.commit();

    return res.status(201).json({
      message: "Dataset uploaded successfully.",
      dataset: {
        id: targetDataset.id,
        datasetName: targetDataset.datasetName,
        passportId: `DSP${String(targetDataset.id).padStart(6, "0")}`
      },
      version: {
        id: version.id,
        versionNumber: version.versionNumber,
        uploadDate: version.uploadDate,
        originalFileName: version.originalFileName,
        fileSize: version.fileSize,
        ...statistics
      }
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    try {
      await fs.unlink(req.file.path);
    } catch (cleanupError) {
      if (cleanupError.code !== "ENOENT") {
        console.error("Could not remove the failed upload.", cleanupError);
      }
    }
    return next(error);
  }
}

async function getHistory(req, res, next) {
  try {
    const versions = await DatasetVersion.findAll({
      include: [{
        model: Dataset,
        as: "dataset",
        attributes: ["id", "datasetName", "ownerId"],
        where: { ownerId: req.user.id }
      }],
      order: [["uploadDate", "DESC"]],
      limit: 500
    });
    return res.json({
      history: versions.map((version) => ({
        id: version.id,
        datasetId: version.datasetId,
        datasetName: version.dataset.datasetName,
        versionNumber: version.versionNumber,
        uploadDate: version.uploadDate,
        rowsCount: version.rowsCount,
        columnsCount: version.columnsCount,
        originalFileName: version.originalFileName,
        versionNote: version.versionNote
      }))
    });
  } catch (error) {
    return next(error);
  }
}

async function getPassport(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ message: "Passport ID must be a positive dataset ID." });
    }
    const dataset = await Dataset.findOne({
      where: { id, ownerId: req.user.id },
      include: [
        { model: User, as: "owner", attributes: ["id", "fullName", "email"] },
        { model: DatasetVersion, as: "versions", attributes: { exclude: ["filePath"] } }
      ]
    });
    if (!dataset) {
      return res.status(404).json({ message: "Dataset passport was not found." });
    }
    const uploadHistory = dataset.versions
      .sort((left, right) => new Date(right.uploadDate) - new Date(left.uploadDate))
      .map((version) => version.toJSON());
    return res.json({
      passportId: `DSP${String(dataset.id).padStart(6, "0")}`,
      datasetId: dataset.id,
      datasetName: dataset.datasetName,
      owner: dataset.owner.fullName,
      ownerId: dataset.owner.id,
      createdAt: dataset.createdAt,
      uploadDate: dataset.uploadDate,
      versionCount: uploadHistory.length,
      currentVersion: uploadHistory[0]?.versionNumber || null,
      rowsCount: uploadHistory[0]?.rowsCount ?? 0,
      columnsCount: uploadHistory[0]?.columnsCount ?? 0,
      uploadHistory
    });
  } catch (error) {
    return next(error);
  }
}

async function compareVersions(req, res, next) {
  try {
    const versionIds = [Number(req.params.v1), Number(req.params.v2)];
    if (versionIds.some((id) => !Number.isSafeInteger(id) || id < 1)) {
      return res.status(400).json({ message: "Version IDs must be positive integers." });
    }
    if (versionIds[0] === versionIds[1]) {
      return res.status(400).json({ message: "Choose two different versions to compare." });
    }

    const versions = await DatasetVersion.findAll({
      where: { id: { [Op.in]: versionIds } },
      include: [{
        model: Dataset,
        as: "dataset",
        attributes: ["id", "datasetName", "ownerId"]
      }]
    });
    if (versions.length !== 2 || versions.some((version) => version.dataset.ownerId !== req.user.id)) {
      return res.status(404).json({ message: "One or both dataset versions were not found." });
    }
    if (versions[0].datasetId !== versions[1].datasetId) {
      return res.status(400).json({ message: "Versions must belong to the same dataset." });
    }

    const byId = new Map(versions.map((version) => [version.id, version]));
    const first = byId.get(versionIds[0]);
    const second = byId.get(versionIds[1]);
    const rowDifference = second.rowsCount - first.rowsCount;
    const columnDifference = second.columnsCount - first.columnsCount;
    return res.json({
      datasetId: first.datasetId,
      datasetName: first.dataset.datasetName,
      version1: {
        id: first.id,
        versionNumber: first.versionNumber,
        rowsCount: first.rowsCount,
        columnsCount: first.columnsCount
      },
      version2: {
        id: second.id,
        versionNumber: second.versionNumber,
        rowsCount: second.rowsCount,
        columnsCount: second.columnsCount
      },
      comparison: {
        rowsAdded: Math.max(rowDifference, 0),
        rowsRemoved: Math.max(-rowDifference, 0),
        columnsAdded: Math.max(columnDifference, 0),
        columnsRemoved: Math.max(-columnDifference, 0)
      },
      note: "Counts compare dataset shapes; removed/added records are estimated from the row-count difference."
    });
  } catch (error) {
    return next(error);
  }
}

async function getDashboard(req, res, next) {
  try {
    const [totalDatasets, totalVersions, recentVersions] = await Promise.all([
      Dataset.count({ where: { ownerId: req.user.id } }),
      DatasetVersion.count({
        include: [{
          model: Dataset,
          as: "dataset",
          attributes: [],
          where: { ownerId: req.user.id }
        }]
      }),
      DatasetVersion.findAll({
        include: [{
          model: Dataset,
          as: "dataset",
          attributes: ["id", "datasetName"],
          where: { ownerId: req.user.id }
        }],
        order: [["uploadDate", "DESC"]],
        limit: 5,
        attributes: ["id", "versionNumber", "rowsCount", "columnsCount", "uploadDate"]
      })
    ]);
    return res.json({
      totalDatasets,
      totalVersions,
      totalUploads: totalVersions,
      recentUploads: recentVersions.map((version) => ({
        datasetId: version.datasetId,
        datasetName: version.dataset.datasetName,
        versionNumber: version.versionNumber,
        rowsCount: version.rowsCount,
        columnsCount: version.columnsCount,
        uploadDate: version.uploadDate
      }))
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  uploadDataset,
  getHistory,
  getPassport,
  compareVersions,
  getDashboard
};
