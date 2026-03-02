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
const { execSync, execFileSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5000;

// Root directory for persistent datasets
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

// Utility: scan available datasets in DATA_ROOT
function scanDatasets() {
  const datasets = [];
  let entries = [];
  try {
    entries = fs.readdirSync(DATA_ROOT, { withFileTypes: true });
  } catch (e) {
    console.warn('[Datasets] Failed to read dataset root:', e.message);
    return datasets;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const id = entry.name;
    const dirPath = path.join(DATA_ROOT, id);
    const metadataPath = path.join(dirPath, 'metadata.json');
    const resultsPath = path.join(dirPath, 'results.npz');
    const languagesInfoPath = path.join(dirPath, 'languages_info.json');

    if (!fs.existsSync(metadataPath) || !fs.existsSync(resultsPath)) {
      continue;
    }

    let hasLanguagesInfo = false;
    try {
      hasLanguagesInfo = fs.existsSync(languagesInfoPath);
    } catch {
      hasLanguagesInfo = false;
    }

    let createdAt = null;
    let modifiedAt = null;
    try {
      const stat = fs.statSync(metadataPath);
      createdAt = stat.birthtime || null;
      modifiedAt = stat.mtime || null;
    } catch {
      // ignore
    }

    datasets.push({
      id,
      displayName: id,
      hasLanguagesInfo,
      createdAt,
      modifiedAt,
    });
  }

  return datasets;
}

// Helper function to parse NPZ files using Python
function parseNPZWithPython(filePath) {
  const pythonScript = `
import json
import numpy as np
import sys
import math
import os

def convert_array_safe(arr):
  """Convert numpy array to list, replacing NaN/Inf with JSON-safe strings, with recursion."""
  if not isinstance(arr, np.ndarray):
    return arr

  arr_list = arr.tolist()

  def replace_special_floats(obj):
    if isinstance(obj, float):
      if math.isnan(obj):
        return 'NaN'
      if math.isinf(obj):
        return 'Infinity' if obj > 0 else '-Infinity'
      return obj
    elif isinstance(obj, list):
      return [replace_special_floats(item) for item in obj]
    elif isinstance(obj, dict):
      return {k: replace_special_floats(v) for k, v in obj.items()}
    else:
      return obj

  return replace_special_floats(arr_list)

npz_path = sys.argv[1]
out_json_path = sys.argv[2] if len(sys.argv) > 2 else None
try:
    data = np.load(npz_path, allow_pickle=True)
except Exception as e:
    print(json.dumps({"__error__": f"Failed to load NPZ: {str(e)}"}))
    sys.exit(0)

# Extract all arrays and convert to JSON-serializable format
result = {}
try:
    for key in data.keys():
        arr = data[key]
        
        # Handle object arrays (like pickled metrics dict)
        if arr.dtype == object:
          if arr.shape == ():
            # Scalar object array - extract the item
            obj = arr.item()
            if isinstance(obj, dict):
              # Convert each nested array to list and flatten into top-level keys
              for k, v in obj.items():
                if isinstance(v, np.ndarray):
                  result[k] = convert_array_safe(v)
                elif isinstance(v, (float, np.floating)):
                  if math.isnan(v):
                    result[k] = 'NaN'
                  elif math.isinf(v):
                    result[k] = 'Infinity' if v > 0 else '-Infinity'
                  else:
                    result[k] = float(v)
                elif isinstance(v, (int, np.integer)):
                  result[k] = int(v)
                else:
                  result[k] = v
            else:
              result[key] = str(obj)
          else:
            # Array of objects - attempt to flatten if it's a single dict container
            arr_list = arr.tolist()
            if isinstance(arr_list, list) and len(arr_list) == 1 and isinstance(arr_list[0], dict):
              obj = arr_list[0]
              for k, v in obj.items():
                if isinstance(v, np.ndarray):
                  result[k] = convert_array_safe(v)
                elif isinstance(v, (float, np.floating)):
                  if math.isnan(v):
                    result[k] = 'NaN'
                  elif math.isinf(v):
                    result[k] = 'Infinity' if v > 0 else '-Infinity'
                  else:
                    result[k] = float(v)
                elif isinstance(v, (int, np.integer)):
                  result[k] = int(v)
                else:
                  result[k] = v
            else:
              # Fallback: convert to JSON-safe structure under the original key
              result[key] = convert_array_safe(arr)
        else:
            # Regular numeric array - convert to list safely
            result[key] = convert_array_safe(arr)

except Exception as e:
    import traceback
    tb = traceback.format_exc()
    print(json.dumps({"__error__": f"Error processing NPZ data: {str(e)}"}))
    sys.exit(0)

payload = json.dumps(result)
if out_json_path:
    try:
        with open(out_json_path, 'w', encoding='utf-8') as f:
            f.write(payload)
    except Exception as e:
        print(json.dumps({"__error__": f"Failed to write output JSON: {str(e)}"}))
else:
    # Fallback to stdout (may be large)
    print(payload)
`;
    
    const tempFile = path.join('/tmp', 'npz_parser_' + Date.now() + '.py');
    fs.writeFileSync(tempFile, pythonScript);
    const tempJson = path.join('/tmp', 'npz_output_' + Date.now() + '.json');
    
    try {
      // Determine Python executable path from environment, falling back to `which python3`
      // and finally to plain 'python3' on PATH.
      let pythonPath = process.env.TOKCOLLATE_PYTHON;
      if (!pythonPath) {
        try {
          pythonPath = execSync('which python3', { encoding: 'utf-8' }).trim();
        } catch (e) {
          console.warn('[NPZ Parser] Could not locate python3 via `which`; falling back to "python3" on PATH.');
          pythonPath = 'python3';
        }
      }

      // Use execFileSync to avoid shell and write output to a temp file to
      // prevent stdout buffer overflows with large NPZ payloads.
      execFileSync(pythonPath, [tempFile, filePath, tempJson], { stdio: 'pipe', maxBuffer: 100 * 1024 * 1024 });

      // Read the JSON from the temp file
      let content = '';
      try {
        content = fs.readFileSync(tempJson, { encoding: 'utf-8' });
      } catch (readErr) {
        // If reading failed, try to capture any stdout output as a fallback
        console.warn('[NPZ Parser] Failed to read temp JSON, falling back to stdout');
        const fallback = execSync(`"${pythonPath}" "${tempFile}" "${filePath}" 2>&1`, { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 });
        content = fallback;
      }

      // Cleanup temp files
      try { fs.unlinkSync(tempFile); } catch (ignore) {}
      try { fs.unlinkSync(tempJson); } catch (ignore) {}

      // Parse the JSON content
      let result;
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        console.error('[NPZ Parser] Failed to parse Python output as JSON');
        console.error('[NPZ Parser] Output (truncated):', content.substring(0, 500));
        throw new Error(`Invalid JSON from Python: ${parseError.message}`);
      }
      
      // Check for error marker in the result
      if (result.__error__) {
        throw new Error(`Python error: ${result.__error__}`);
      }
      
      return result;
    } catch (e) {
      try { fs.unlinkSync(tempFile); } catch (ignore) {}
      try { fs.unlinkSync(tempJson); } catch (ignore) {}
      const errorMsg = e.message || e.toString();
      console.error('[NPZ Parser] Error:', errorMsg);
      throw new Error(errorMsg);
    }
}

// API endpoint to load files from the filesystem
app.get('/api/load-file', (req, res) => {
  const filePath = req.query.path;
  
  if (!filePath) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  console.log(`[API] Loading file: ${filePath}`);

  try {
    // Security: prevent path traversal attacks
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`[API] File not found: ${resolvedPath}`);
      return res.status(404).json({ error: `File not found: ${filePath}` });
    }

    const ext = path.extname(resolvedPath);

    if (ext === '.json') {
      const fileContent = fs.readFileSync(resolvedPath);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(fileContent);
    } else if (ext === '.npz') {
      // Parse NPZ using Python to handle pickled objects
      console.log('[API] Parsing NPZ file with Python...');
      const npzData = parseNPZWithPython(resolvedPath);
      
      if (npzData === null) {
        return res.status(500).json({ error: 'Failed to parse NPZ file. Python numpy may not be available.' });
      }
      
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.json(npzData);
    } else {
      return res.status(400).json({ error: 'Unsupported file type: ' + ext });
    }
  } catch (error) {
    console.error(`[API] Error loading file:`, error);
    res.status(500).json({ error: 'Error reading file: ' + error.message });
  }
});

// List available server-side datasets
app.get('/api/datasets', (req, res) => {
  try {
    const datasets = scanDatasets();
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
    const [descriptor] = scanDatasets().filter((d) => d.id === safeId);
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
  console.log(`[Server] API available at http://localhost:${PORT}/api/load-file?path=<path>`);
});
