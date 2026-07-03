'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Scan dataRoot for valid datasets.
 *
 * A valid dataset directory must contain both metadata.json and results.npz.
 * languages_info.json is optional — its presence is recorded in `hasLanguagesInfo`.
 *
 * @param {string} dataRoot - Absolute path to the dataset root directory.
 * @returns {{ id: string, displayName: string, hasLanguagesInfo: boolean,
 *             createdAt: Date|null, modifiedAt: Date|null }[]}
 */
function scanDatasets(dataRoot) {
  const datasets = [];
  let entries = [];

  try {
    entries = fs.readdirSync(dataRoot, { withFileTypes: true });
  } catch (e) {
    console.warn('[Datasets] Failed to read dataset root:', e.message);
    return datasets;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const id = entry.name;
    const dirPath = path.join(dataRoot, id);
    const metadataPath = path.join(dirPath, 'metadata.json');
    const resultsPath = path.join(dirPath, 'results.npz');
    const languagesInfoPath = path.join(dirPath, 'languages_info.json');

    if (!fs.existsSync(metadataPath) || !fs.existsSync(resultsPath)) {
      continue;
    }

    const hasLanguagesInfo = fs.existsSync(languagesInfoPath);

    let createdAt = null;
    let modifiedAt = null;
    try {
      const stat = fs.statSync(metadataPath);
      createdAt = stat.birthtime || null;
      modifiedAt = stat.mtime || null;
    } catch {
      // file became inaccessible between existsSync and stat — ignore
    }

    datasets.push({ id, displayName: id, hasLanguagesInfo, createdAt, modifiedAt });
  }

  return datasets;
}

module.exports = { scanDatasets };
