'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync, execFileSync } = require('child_process');

// ---------------------------------------------------------------------------
// NPZ parsing (Metric Analysis Result parsing)
// ---------------------------------------------------------------------------

/**
 * The embedded Python script that loads an NPZ file and serialises its arrays
 * to JSON. NaN/Infinity values are emitted as the strings "NaN" / "Inf" /
 * "-Inf" because JSON has no native representation for them.
 */
const NPZ_PYTHON_SCRIPT = `
import json
import numpy as np
import sys
import math
import os

def convert_array_safe(arr):
  """Convert numpy array to list, replacing NaN/Inf with JSON-safe strings."""
  if not isinstance(arr, np.ndarray):
    return arr

  arr_list = arr.tolist()

  def replace_special_floats(obj):
    if isinstance(obj, float):
      if math.isnan(obj):
        return 'NaN'
      if math.isinf(obj):
        return 'Inf' if obj > 0 else '-Inf'
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
    sys.exit(1)

result = {}
try:
    for key in data.keys():
        arr = data[key]

        if arr.dtype == object:
          if arr.shape == ():
            obj = arr.item()
            if isinstance(obj, dict):
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
              result[key] = convert_array_safe(arr)
        else:
            result[key] = convert_array_safe(arr)

except Exception as e:
    import traceback
    tb = traceback.format_exc()
    print(json.dumps({"__error__": f"Error processing NPZ data: {str(e)}"}))
    sys.exit(1)

payload = json.dumps(result)
if out_json_path:
    try:
        with open(out_json_path, 'w', encoding='utf-8') as f:
            f.write(payload)
    except Exception as e:
        print(json.dumps({"__error__": f"Failed to write output JSON: {str(e)}"}))
else:
    print(payload)
`;

/**
 * Parse an NPZ file by invoking a Python subprocess.
 *
 * Output is written to a temp JSON file rather than stdout to avoid buffer
 * overflow with large payloads. The temp files are always cleaned up.
 *
 * @param {string} filePath - Absolute path to the .npz file.
 * @returns {object} Parsed key→array map.
 * @throws {Error} If Python fails or the output is not valid JSON.
 */
function parseNPZ(filePath) {
  const tempScript = path.join('/tmp', `npz_parser_${Date.now()}.py`);
  const tempJson = path.join('/tmp', `npz_output_${Date.now()}.json`);

  fs.writeFileSync(tempScript, NPZ_PYTHON_SCRIPT);

  try {
    const pythonPath = resolvePython();
    execFileSync(pythonPath, [tempScript, filePath, tempJson], {
      stdio: 'pipe',
      maxBuffer: 100 * 1024 * 1024,
    });

    let content = '';
    try {
      content = fs.readFileSync(tempJson, { encoding: 'utf-8' });
    } catch {
      // Temp JSON missing — fall back to re-running with stdout capture
      console.warn('[NPZ Parser] Failed to read temp JSON, falling back to stdout');
      content = execSync(`"${pythonPath}" "${tempScript}" "${filePath}" 2>&1`, {
        encoding: 'utf-8',
        maxBuffer: 100 * 1024 * 1024,
      });
    }

    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error('[NPZ Parser] Failed to parse Python output as JSON');
      console.error('[NPZ Parser] Output (truncated):', content.substring(0, 500));
      throw new Error(`Invalid JSON from Python: ${parseError.message}`);
    }

    if (result.__error__) {
      throw new Error(`Python error: ${result.__error__}`);
    }

    return result;
  } finally {
    try { fs.unlinkSync(tempScript); } catch { /* ignore */ }
    try { fs.unlinkSync(tempJson); } catch { /* ignore */ }
  }
}

/**
 * Resolve the Python 3 executable path.
 * Checks TOKCOLLATE_PYTHON env var first, then `which python3`, then falls
 * back to `python3` on PATH.
 *
 * @returns {string}
 */
function resolvePython() {
  if (process.env.TOKCOLLATE_PYTHON) {
    return process.env.TOKCOLLATE_PYTHON;
  }
  try {
    return execSync('which python3', { encoding: 'utf-8' }).trim();
  } catch {
    console.warn('[NPZ Parser] Could not locate python3 via `which`; falling back to "python3" on PATH.');
    return 'python3';
  }
}

// ---------------------------------------------------------------------------
// GZip parsing (Tokenizations)
// ---------------------------------------------------------------------------

/**
 * Decompress and parse a gzipped JSON buffer.
 *
 * @param {Buffer|ArrayBuffer} buffer
 * @returns {object}
 */
function parseGzipBuffer(buffer) {
  const gzBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const unzipped = zlib.gunzipSync(gzBuffer);
  return JSON.parse(unzipped.toString('utf-8'));
}

/**
 * Read, decompress and parse a gzipped JSON file.
 *
 * @param {string} filePath
 * @returns {object}
 */
function parseGzipFile(filePath) {
  return parseGzipBuffer(fs.readFileSync(filePath));
}

module.exports = { parseNPZ, parseGzipBuffer, parseGzipFile };
