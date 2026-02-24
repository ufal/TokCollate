# TokCollate Frontend Visualizer

A single-page web application for visualizing and analyzing TokCollate tokenization metrics and correlation results.

## Features

- **Load Results**: Load TokCollate metrics and correlation data from JSON/NPZ files
- **Interactive Visualizations**: Create bar charts and line charts from your metrics
- **Flexible Configuration**: 
  - Select tokenizers to compare
  - Filter by languages
  - Choose which metrics to visualize
  - Customize graph titles and types
- **Responsive Layout**: 
  - Main menu bar with dataset selector
  - Two-column layout: wider left column for graphs, compact right panel for configuration
  - Scrollable graph list and configurator
- **Save/Load**: Save visualization configurations and load them later

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

1. Click the **Import Data** button in the top menu
2. Select a directory containing TokCollate results
3. The available tokenizers, metrics, and languages will be extracted automatically

### Creating Visualizations

1. In the right panel (Graph Configuration):
   - Enter a title for your graph
   - Select the graph type (Bar Chart or Line Chart)
   - Add tokenizers to compare
   - Select metrics to visualize
   - Optionally filter by languages
2. Click **Generate Graph** to add it to the left column
3. The graph will render based on the configuration

### Managing Graphs

- Remove a graph by clicking the **✕** button in its header
- Switch between different dataset names using the selector
- Export all graphs as PNG files by clicking **Export graphs**

### Saving Configurations

Click the **Save** button to download the current visualization configuration as JSON.

## Data Format

The application expects a JSON file with the following structure:

```json
{
  "metrics": {
    "tokenizer_1_metric_name_lang1": [value],
    "tokenizer_2_metric_name_lang1": [value]
  },
  "correlation": {
    "metric_1_metric_2": [value]
  }
}
```

## Future Enhancements

- [ ] Support for NPZ file format (binary numpy archives)
- [ ] Scatter plots and heatmaps
- [ ] Advanced filtering options
- [ ] Export graphs as PDF
- [ ] Correlation matrix visualization
- [ ] Add custom tokenizers at runtime
- [ ] Dark mode
- [ ] Graph customization (colors, fonts, axis ranges)

## Development

### Building for Production

```bash
npm run build
```

The optimized build will be in the `dist/` directory.

### Type Checking

```bash
npm run type-check
```

## Notes

- Currently loads JSON files. NPZ support requires additional dependencies (e.g., `jszip`, `nippy`).
- Chart rendering is optimized for Recharts library; ensure data is in the expected format.
- The application stores graphs in memory; refresh the page to reset.
