#!/usr/bin/env python3
import numpy as np
import json
import sys
import os

def npz_to_json(npz_path, json_path=None):
    data = np.load(npz_path, allow_pickle=True)
    out = {}
    for key in data.files:
        arr = data[key]
        # Convert numpy arrays to lists, scalars to Python types
        if isinstance(arr, np.ndarray):
            out[key] = arr.tolist()
        else:
            out[key] = arr.item() if hasattr(arr, 'item') else arr
    if json_path is None:
        json_path = os.path.splitext(npz_path)[0] + '.json'
    with open(json_path, 'w') as f:
        json.dump(out, f, indent=2)
    print(f"Converted {npz_path} to {json_path}")

if __name__ == '__main__':
    if len(sys.argv) < 2 or len(sys.argv) > 3:
        print("Usage: python npz_to_json.py input.npz [output.json]")
        sys.exit(1)
    npz_path = sys.argv[1]
    json_path = sys.argv[2] if len(sys.argv) == 3 else None
    npz_to_json(npz_path, json_path)
