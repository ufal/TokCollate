#!/usr/bin/env node

/**
 * Simple Express server for TokEval Frontend
 * Serves the built frontend and provides an API to load local files
 * NPZ files are automatically parsed using Python and served as JSON
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());

// JSON parser with size limit
app.use(express.json({ limit: '10mb' }));

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
      const pythonPath = '/home/varis/python-virtualenv/tokeval-py3.12/bin/python3';
      // Use execFileSync to avoid shell and write output to a temp file to
      // prevent stdout buffer overflows with large NPZ payloads.
      const { execFileSync } = require('child_process');
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
  console.log(`[Server] TokEval Frontend Server running at http://localhost:${PORT}`);
  console.log(`[Server] API available at http://localhost:${PORT}/api/load-file?path=<path>`);
});
