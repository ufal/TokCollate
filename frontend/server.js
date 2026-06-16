#!/usr/bin/env node

/**
 * Simple Express server for TokCollate Frontend
 * Serves the built frontend and provides an API to load local files
 * NPZ files are automatically parsed using Python and served as JSON
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { scanDatasets } = require('./utils/datasets');
const { parseNPZ, parseGzipBuffer, parseGzipFile } = require('./utils/dataParsers');

const app = express();
const PORT = process.env.PORT || 5000;

// Root directory for (local-hosted) persistent datasets
const DATA_ROOT = process.env.TOKCOLLATE_DATA_DIR
  ? path.resolve(process.env.TOKCOLLATE_DATA_DIR)
  : path.join(__dirname, 'data');

// Ensure data root exists
try {
  fs.mkdirSync(DATA_ROOT, { recursive: true });
  console.log(`[Server] Dataset root: ${DATA_ROOT}`);
} catch (e) {
  console.error('[Server] Failed to create dataset root directory:', e.message);
}

// Middleware
// TODO(varisd): add some additional settings for strictly local use (localhost) and internet accessible visualizer
//   serving, e.g. when sharing data analysis with others
app.use(cors());

// JSON parser with size limit (for simple APIs)
app.use(express.json({ limit: '10mb' }));

// Multipart/form-data parser for dataset uploads (no extra dependency)
// This is a very small, purpose-built handler that expects three fields:
// - field "id" as text
// - field "metadata" as a JSON file (metadata.json)
// - field "results" as a binary file (results.npz)
// - optional field "languagesInfo" as a JSON file (languages_info.json)
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// List available server-side datasets
app.get('/api/datasets', (req, res) => {
  try {
    const datasets = scanDatasets(DATA_ROOT);
    res.json({ datasets });
  } catch (e) {
    console.error('[Datasets] Failed to list datasets:', e.message);
    res.status(500).json({ error: 'Failed to list datasets' });
  }
});

// Load a specific dataset (metadata + results.npz + optional languages_info)
app.get('/api/datasets/:id', (req, res) => {
  const id = req.params.id;
  const dirPath = path.join(DATA_ROOT, id);
  const metadataPath = path.join(dirPath, 'metadata.json');
  const resultsPath = path.join(dirPath, 'results.npz');
  const languagesInfoPath = path.join(dirPath, 'languages_info.json');
  const tokenizationsPath = path.join(dirPath, 'tokenizations.json.gz');

  if (!fs.existsSync(dirPath)) {
    return res.status(404).json({ error: `Dataset '${id}' not found` });
  }
  if (!fs.existsSync(metadataPath) || !fs.existsSync(resultsPath)) {
    return res.status(400).json({ error: `Dataset '${id}' is missing required files (metadata.json, results.npz)` });
  }

  try {
    const metadataRaw = fs.readFileSync(metadataPath, { encoding: 'utf-8' });
    const metadata = JSON.parse(metadataRaw);

    let languagesInfo = undefined;
    if (fs.existsSync(languagesInfoPath)) {
      try {
        const langRaw = fs.readFileSync(languagesInfoPath, { encoding: 'utf-8' });
        languagesInfo = JSON.parse(langRaw);
      } catch (e) {
        console.warn(`[Datasets] Failed to parse languages_info.json for dataset '${id}':`, e.message);
      }
    }

    let tokenizations = undefined;
    const hasTokenizations = metadata && metadata.has_tokenizations === true;
    if (hasTokenizations) {
      if (!fs.existsSync(tokenizationsPath)) {
        return res.status(400).json({
          error: `Dataset '${id}' metadata indicates has_tokenizations=true, but tokenizations.json.gz is missing.`,
        });
      }
      try {
        tokenizations = parseTokenizationsGzipFile(tokenizationsPath);
      } catch (e) {
        return res.status(400).json({
          error: `Failed to parse tokenizations.json.gz for dataset '${id}': ${e.message}`,
        });
      }
    }

    console.log(`[Datasets] Parsing results.npz for dataset '${id}'`);
    const npzData = parseNPZWithPython(resultsPath);

    if (!npzData) {
      return res.status(500).json({ error: `Failed to parse results.npz for dataset '${id}'` });
    }

    res.json({
      id,
      metadata,
      npzData,
      languagesInfo,
      tokenizations,
    });
  } catch (e) {
    console.error(`[Datasets] Error loading dataset '${id}':`, e.message);
    res.status(500).json({ error: `Error loading dataset '${id}': ${e.message}` });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Endpoint to parse NPZ files uploaded as binary
app.post('/api/parse-npz', express.raw({ type: 'application/octet-stream', limit: '100mb' }), (req, res) => {
  try {
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ error: 'No file data provided' });
    }

    // req.body is a Buffer when using express.raw()
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
    
    // Write the buffer to a temporary file
    const tempFile = path.join('/tmp', 'npz_upload_' + Date.now() + '.npz');
    fs.writeFileSync(tempFile, buffer);
    
    console.log('[API] Parsing uploaded NPZ file (size:', buffer.length, 'bytes)');
    
    let npzData;
    try {
      npzData = parseNPZWithPython(tempFile);
    } catch (parseError) {
      // Clean up temp file
      try { fs.unlinkSync(tempFile); } catch (e) {}
      
      console.error('[API] NPZ parsing error:', parseError.message);
      return res.status(400).json({ 
        error: 'Failed to parse NPZ file: ' + parseError.message 
      });
    }
    
    // Clean up temp file
    try {
      fs.unlinkSync(tempFile);
    } catch (e) {
      console.warn('[API] Failed to clean up temp file:', e.message);
    }
    
    if (!npzData) {
      return res.status(500).json({ error: 'Failed to parse NPZ file: received empty result' });
    }
    
    console.log('[API] ✓ NPZ parsed successfully, keys:', Object.keys(npzData).join(', '));
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(npzData);
  } catch (error) {
    console.error('[API] Unexpected error parsing NPZ:', error.message);
    res.status(500).json({ error: 'Error parsing file: ' + error.message });
  }
});

// Endpoint to parse tokenizations.json.gz uploaded as binary
app.post('/api/parse-tokenizations', express.raw({ type: 'application/octet-stream', limit: '200mb' }), (req, res) => {
  try {
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ error: 'No file data provided' });
    }

    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
    let tokenizations;
    try {
      tokenizations = parseTokenizationsGzipBuffer(buffer);
    } catch (parseError) {
      console.error('[API] tokenizations parsing error:', parseError.message);
      return res.status(400).json({ error: 'Failed to parse tokenizations.json.gz: ' + parseError.message });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(tokenizations);
  } catch (error) {
    console.error('[API] Unexpected error parsing tokenizations.gz:', error.message);
    res.status(500).json({ error: 'Error parsing tokenizations file: ' + error.message });
  }
});

// Create a new persistent dataset on the server
// Expects multipart/form-data with fields:
// - id: dataset identifier / directory name (text field)
// - metadata: metadata.json file
// - results: results.npz file
// - optional languagesInfo: languages_info.json file
app.post('/api/datasets', upload.fields([
  { name: 'metadata', maxCount: 1 },
  { name: 'results', maxCount: 1 },
  { name: 'languagesInfo', maxCount: 1 },
]), (req, res) => {
  try {
    const id = (req.body && req.body.id ? String(req.body.id) : '').trim();
    if (!id) {
      return res.status(400).json({ error: 'Missing dataset id' });
    }

    // Sanitize id for filesystem usage: allow alphanum, dash, underscore
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!safeId) {
      return res.status(400).json({ error: 'Invalid dataset id' });
    }

    const dirPath = path.join(DATA_ROOT, safeId);
    if (fs.existsSync(dirPath)) {
      return res.status(409).json({
        error: `Dataset '${safeId}' already exists on the server. There is a name duplicity; you can change the uploaded dataset name in metadata.json and try again.`,
      });
    }

    const files = req.files || {};
    const metadataFiles = files.metadata || [];
    const resultsFiles = files.results || [];
    const languagesInfoFiles = files.languagesInfo || [];

    if (metadataFiles.length === 0 || resultsFiles.length === 0) {
      return res.status(400).json({ error: 'Both metadata and results files are required' });
    }

    const metadataFile = metadataFiles[0];
    const resultsFile = resultsFiles[0];
    const languagesInfoFile = languagesInfoFiles[0];

    // Create directory and write files
    fs.mkdirSync(dirPath, { recursive: true });

    const metadataPath = path.join(dirPath, 'metadata.json');
    const resultsPath = path.join(dirPath, 'results.npz');
    const languagesInfoPath = path.join(dirPath, 'languages_info.json');

    fs.writeFileSync(metadataPath, metadataFile.buffer);
    fs.writeFileSync(resultsPath, resultsFile.buffer);
    if (languagesInfoFile) {
      fs.writeFileSync(languagesInfoPath, languagesInfoFile.buffer);
    }

    console.log(`[Datasets] Created dataset '${safeId}' at ${dirPath}`);

    // Return updated descriptor
    const [descriptor] = scanDatasets(DATA_ROOT).filter((d) => d.id === safeId);
    res.status(201).json({ dataset: descriptor || { id: safeId, displayName: safeId } });
  } catch (e) {
    console.error('[Datasets] Failed to create dataset:', e.message);
    res.status(500).json({ error: 'Failed to create dataset: ' + e.message });
  }
});

// Serve static files from dist (for production build)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  
  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}


app.listen(PORT, () => {
  console.log(`[Server] TokCollate Frontend Server running at http://localhost:${PORT}`);
});
