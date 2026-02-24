# TokCollate Frontend Deployment Guide

## Overview

The TokCollate frontend is a React + TypeScript application built with Vite. It includes an Express.js backend server for loading local files from the filesystem.

## Development

### Prerequisites
- Node.js >= 16
- npm or yarn

### Setup

```bash
cd frontend
npm install
```

### Running in Development Mode

For development with hot module reloading:

```bash
npm run dev
```

This starts the Vite dev server on `http://localhost:3000` (or the next available port).

**Note:** The dev server does NOT provide the `/api/load-file` or `/api/parse-npz` endpoints. For full import functionality (including NPZ parsing), run the Express backend (`npm start`) and access the app at `http://localhost:5000`.

### Building for Production

```bash
npm run build
```

This compiles the TypeScript and builds the optimized production bundle in the `dist/` directory.

## Production Deployment

### Using the Express Backend Server

The included Express server (`server.js`) serves both the frontend and provides the `/api/load-file` endpoint for loading files from the server filesystem.

#### Starting the Server

```bash
npm run serve
```

or

```bash
npm start
```

or

```bash
node server.js
```

The server will:
- Listen on port 5000 (or `PORT` environment variable)
- Serve the built frontend from `dist/` directory
- Provide API endpoint for file loading at `/api/load-file`

#### Environment Variables

- `PORT`: Server port (default: 5000)
 - `TOKCOLLATE_PYTHON`: Optional path to the Python interpreter used for NPZ parsing (defaults to `python3` on PATH)

Example:
```bash
PORT=8080 npm start
```

## API Endpoints

### Load File
```
GET /api/load-file?path=<filepath>
```

Loads a file from the server filesystem and returns its content.

**Parameters:**
- `path` (required): Absolute path to the file

**Returns:**
- For `.json` files: JSON content with `Content-Type: application/json`
- For `.npz` files: JSON produced by the Python NPZ helper (arrays converted to JSON-safe lists)

**Examples:**
```bash
# Load metadata
curl "http://localhost:5000/api/load-file?path=/home/user/data/metadata.json"

# Load results NPZ file
curl "http://localhost:5000/api/load-file?path=/home/user/data/results.npz"
```

### Health Check
```
GET /api/health
```

Returns `{"status": "ok"}` if the server is running.

## Frontend Features

### Import Data

The **Import Data** button in the top menu opens a directory picker for selecting local results.

**Expected contents of the selected directory:**
- `metadata.json` (required) — describes dataset name, tokenizers, languages, metrics, and file paths
- `results.npz` (required) — NPZ file with metric arrays
- `languages_info.json` (optional) — language metadata used for advanced filters (continent, families, tier, etc.)

**Usage:**
1. Click **Import Data**.
2. Select a directory containing the files above.
3. The browser reads `metadata.json` and sends `results.npz` to `/api/parse-npz` on the backend.
4. On success, the frontend shows a multi-step import progress indicator and then enables figure configuration.

**Requirements:**
- Backend server must be running (`npm start`)
- Directory must be accessible to the server process
- Files must be readable by the server process user

## Docker Deployment (Optional)

To deploy in Docker:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm install express cors

# Copy built frontend (built locally)
COPY dist ./dist

# Copy server file
COPY server.js ./

EXPOSE 5000

CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t tokcollate-frontend .
docker run -p 5000:5000 -v /path/to/data:/data:ro tokcollate-frontend
```

Then access at `http://localhost:5000` and use paths like `/data/...` in the import dialog.

## Troubleshooting

### "Failed to load metadata.json" error

1. Check backend server is running: `ps aux | grep "node server"`
2. Verify the directory path is correct and accessible
3. Check browser console for detailed error messages
4. Ensure files exist: `ls -la /path/to/directory/`

### Port already in use

```bash
# Find process using port 5000
lsof -i :5000

# Kill the process
kill -9 <PID>

# Or use different port
PORT=8080 npm start
```

### File permission denied

Ensure the server process can read the files:
```bash
ls -l /path/to/file/
# Should have read permission for the user running the server
```

### CORS errors in browser console

The server has CORS enabled by default. If you still see CORS errors, check:
1. Browser console for the exact error
2. Server logs for details
3. Ensure the frontend is being served from the same origin as the API

## Architecture

```
frontend/
├── src/
│   ├── components/
│   │   ├── App.tsx               - Main app component and visualization state
│   │   ├── MainMenu.tsx          - Top menu with Import Data / Export Graph
│   │   ├── Graph.tsx             - Graph/chart and metric table rendering
│   │   ├── GraphConfigurator.tsx - Figure configuration UI and validation
│   │   └── ...
│   ├── utils/
│   │   ├── fileUtils.ts     - File loading utilities
│   │   ├── graphTypes.ts    - Graph type definitions
│   │   └── ...
│   └── types.ts             - TypeScript interfaces
├── dist/                     - Built production assets (generated by npm run build)
├── vite.config.ts           - Vite build configuration
├── server.js                - Express.js backend server
└── package.json             - Dependencies and scripts
```

## Scripts

- `npm run dev` - Start Vite dev server with HMR
- `npm run build` - Build for production
- `npm run serve` - Build and start Express server
- `npm start` - Start Express server (requires prior `npm run build`)
- `npm run preview` - Preview production build locally

## Security Considerations

- The `/api/load-file` endpoint uses `path.resolve()` to prevent path traversal attacks
- Files are read with full access to the server process user - restrict files appropriately
- No authentication is implemented - add authentication middleware if needed for production
- Consider rate limiting for the API in production deployments
