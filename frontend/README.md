# TokCollate Frontend Visualizer

A single-page web application for visualizing and analyzing TokCollate tokenization metrics and correlation results.

## Features

- **Load Results**: Load TokCollate metrics and correlation data from JSON/NPZ files via a local directory picker and backend NPZ parser
- **Interactive Visualizations**:
  - Scatter plots for metric–metric correlations with optional trendlines (global or grouped)
  - Metric tables with sortable rows/columns and value-based green heatmap-style shading
- **Flexible Configuration**:
  - Select tokenizers and languages (with rich filters based on language metadata when available)
  - Choose which metrics to visualize, including both monolingual and multilingual (language pairwise) metrics
  - Configure figure types, trendline modes, and grouping options

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── App.tsx              # Main application component
│   │   ├── App.css
│   │   ├── MainMenu.tsx         # Top menu bar
│   │   ├── MainMenu.css
│   │   ├── GraphList.tsx        # Left column: scrollable graph list
│   │   ├── GraphList.css
│   │   ├── Graph.tsx            # Individual graph rendering
│   │   ├── Graph.css
│   │   ├── GraphConfigurator.tsx # Right panel: configuration
│   │   └── GraphConfigurator.css
│   ├── utils/
│   │   └── fileUtils.ts         # File loading, data extraction
│   ├── types.ts                 # TypeScript interfaces
│   ├── main.tsx                 # Entry point
│   └── index.css                # Global styles
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Tech Stack

- **React 18**: UI framework
- **TypeScript**: Type safety
- **Vite**: Fast build tool and dev server
- **Recharts**: Chart library for visualizations
- **html2canvas**: Graph export to PNG/image format
- **CSS**: Styling (no CSS framework for minimal dependencies)

## Installation

### Prerequisites

- Node.js 16+ and npm

### Setup

1. Install dependencies:

```bash
cd frontend
npm install
```

The project includes the following key dependencies:
- **React 18**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **Recharts**: Chart rendering library
- **html2canvas**: Graph export to PNG functionality

```bash
npm run dev
```

The application will open at `http://localhost:3000` in your default browser.

## Usage

### Loading Data

1. Start the backend server (see `DEPLOYMENT.md`) or run the frontend in dev mode.
2. Click the **Import Data** button in the top menu.
3. In the directory picker, choose a folder containing at least:
  - `metadata.json` (required)
  - `results.npz` (required)
  - `languages_info.json` (optional; adds richer language filtering/metadata)
4. Watch the import progress indicator; once complete, the dataset name will appear in the top-right.

### Creating Visualizations

1. Use the right panel (**Figure Configuration**) to:
  - Choose a **Figure Type** (e.g., metric correlation scatter, metric table).
  - Select tokenizers and languages (optionally using continent/family/tier and other filters).
  - Pick one or more metrics depending on the figure type.
  - Optionally enable trendlines for correlation scatter plots.
2. The graph updates automatically as you adjust configuration.
3. If a configuration is invalid, the **Configuration Issues** box explains what needs fixing.

### Managing Figures

- Configure one primary figure at a time; the current figure is shown in the left column.
- Export the currently visible graph as PNG via the **Export Graph** button in the top menu.

## Data Format

TokCollate primarily consumes NPZ files produced by the TokCollate scorer.

- `metadata.json` describes the dataset and metric layout (tokenizers, languages, metrics, and paths).
- `results.npz` contains the actual metric arrays:
  - 2D metrics typically have shape `[num_tokenizers, num_languages]`.
  - 3D metrics (e.g., language–language matrices per tokenizer) typically have shape `[num_tokenizers, num_languages, num_languages]`.
- The backend Python helper deserializes these arrays to JSON-safe structures for the frontend.

You can also work with pre-built JSON exports that follow this structure:

```json
{
  "metrics": {
    "some_metric": {
      "data": [[1.0, 2.0], [3.0, 4.0]],
      "shape": [2, 2]
    }
  },
  "correlation": {},
  "metadata": {
    "datasetName": "example-dataset",
    "tokenizers": ["tok1", "tok2"],
    "languages": ["eng_Latn", "ces_Latn"],
    "metrics": ["some_metric"]
  }
}
```

## Future Enhancements

- [ ] Additional figure types
- [ ] Export graphs as PDF
- [ ] Run the TokCollate CLI using the analysis config via the web frontend
- [ ] Graph customization (zoom, panning)

## Notes

- Currently loads JSON files. NPZ support requires additional dependencies (e.g., `jszip`, `nippy`).
- Chart rendering is optimized for Recharts library; ensure data is in the expected format.
- The application stores graphs in memory; refresh the page to reset.
