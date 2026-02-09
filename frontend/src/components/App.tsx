import React, { useState } from 'react';
import { VisualizationState, FigureConfig, MetricDimensionality, VisualizationData } from '../types';
import MainMenu from './MainMenu';
import GraphList from './GraphList';
import GraphConfigurator from './GraphConfigurator';
import './App.css';
import { exportAllGraphs } from '../utils/fileUtils';

const App: React.FC = () => {

  const [state, setState] = useState<VisualizationState>({
    figures: [],
    datasetName: 'Unknown',
    availableTokenizers: [],
    availableMetrics: [],
    availableLanguages: [],
    metricDimensionality: {},
    data: null,
  });
  const [importStatus, setImportStatus] = useState<{success: boolean, message: string} | null>(null);

  const handleLoadVisualization = (data: any) => {
    // Data structure from MainMenu:
    // { metadata: {...}, npzData: {...} }
    // OR legacy format: { metrics: {...}, correlation: {...}, metadata: {...} }
    
    let datasetName = 'Unknown';
    let availableTokenizers: string[] = [];
    let availableMetrics: string[] = [];
    let availableLanguages: string[] = [];
    let metricDimensionality: MetricDimensionality = {};
    let processedData: VisualizationData;
    let missingMetrics: string[] = [];

    if (data?.metadata && data?.npzData) {
      // New format from MainMenu: { metadata, npzData }
      // npzData contains metrics (from parsed NPZ) and correlation arrays
      // Metrics are now plain JS arrays (not npyjs objects), so we need to wrap them
      const metadata = data.metadata;
      const npzData = data.npzData;
      const languagesInfo = data.languagesInfo;
      
      datasetName = metadata.dataset_name || 'Unknown';
      availableTokenizers = metadata.tokenizers || [];
      availableLanguages = metadata.languages || [];
      
      // Extract metrics from npzData
      // npzData now contains metric arrays converted from numpy (plain JS arrays)
      // We need to wrap them to work with the graphTypes that expect numpy-like objects with .shape property
      const metricsObj: Record<string, any> = {};
      
      console.log('[App] NPZ data keys:', Object.keys(npzData));
      console.log('[App] Metadata:', { dataset_name: datasetName, tokenizers: availableTokenizers.length, languages: availableLanguages.length, metrics: metadata.metrics });
      
      // Iterate through npzData and wrap metrics
      for (const [key, value] of Object.entries(npzData)) {
        if (key === 'correlation') {
          // Skip correlation for now
          continue;
        }
        
        if (Array.isArray(value)) {
          // Convert JS array to numpy-like object with shape property
          const arrayValue = value as number[][];
          let shape: number[] = [];
          
          // Determine shape by inspecting the nested array structure
          if (arrayValue.length > 0) {
            if (Array.isArray(arrayValue[0])) {
              if (Array.isArray(arrayValue[0][0])) {
                // 3D array: [tokenizers][languages][languages]
                shape = [arrayValue.length, arrayValue[0].length, arrayValue[0][0].length];
              } else {
                // 2D array: [tokenizers][languages]
                shape = [arrayValue.length, arrayValue[0].length];
              }
            } else {
              // 1D array
              shape = [arrayValue.length];
            }
          }
          
          // Flatten the array to TypedArray-like format (row-major order)
          const flatArray = new Float64Array(arrayValue.flat(Infinity) as number[]);
          
          // Wrap in numpy-like object to be compatible with graphTypes
          metricsObj[key] = {
            data: flatArray,
            shape: shape,
            dtype: 'float64',
          };
          
          console.log(`[App] Wrapped metric: ${key}`, { shape, dtype: 'float64', dataLength: flatArray.length });
        }
      }
      
      // Determine available metrics, preferring those listed in metadata
      const npzMetricKeys = Object.keys(metricsObj);
      if (metadata.metrics && Array.isArray(metadata.metrics) && metadata.metrics.length > 0) {
        const listed = metadata.metrics;
        const present = listed.filter((m: string) => npzMetricKeys.includes(m));
        const missing = listed.filter((m: string) => !npzMetricKeys.includes(m));
        availableMetrics = present;
        missingMetrics = missing;
        if (missing.length > 0) {
          console.warn('[App] Metrics listed in metadata but missing in results.npz:', missing);
        }
      } else {
        // Fallback: use all metrics parsed from NPZ
        availableMetrics = npzMetricKeys;
      }
      
      // Detect metric dimensionality only for available metrics
      availableMetrics.forEach((metric) => {
        if (metricsObj[metric]) {
          const shape = metricsObj[metric].shape;
          if (shape.length === 1) {
            metricDimensionality[metric] = 1; // 1D metric
          } else if (shape.length === 2) {
            metricDimensionality[metric] = 2; // 2D metric
          } else if (shape.length === 3) {
            metricDimensionality[metric] = 3; // 3D metric
          } else {
            metricDimensionality[metric] = 1; // Default to 1D
          }
          console.log(`[App] Metric dimensionality: ${metric} = ${metricDimensionality[metric]}D (shape: ${shape.join('x')})`);
        }
      });
      
      const correlationObj = npzData?.correlation?.() || npzData?.correlation || {};
      
      console.log('[App] Loaded metadata:', { datasetName, tokenizers: availableTokenizers.length, metrics: availableMetrics.length, languages: availableLanguages.length });
      console.log('[App] Processed metrics:', Object.keys(metricsObj));
      
      processedData = {
        metrics: metricsObj,
        correlation: correlationObj,
        metadata: {
          datasetName,
          timestamp: metadata.timestamp,
          version: metadata.version,
          tokenizers: availableTokenizers,
          languages: availableLanguages,
          metrics: availableMetrics,
          languagesInfo: languagesInfo,
        },
      };
    } else if (data?.metadata) {
      // Legacy format or metadata-only
      datasetName = data.metadata.datasetName || data.metadata.dataset_name || 'Unknown';
      availableTokenizers = data.metadata.tokenizers || [];
      availableMetrics = data.metadata.metrics || [];
      availableLanguages = data.metadata.languages || [];
      
      processedData = {
        metrics: data.metrics || {},
        correlation: data.correlation || {},
        metadata: {
          datasetName,
          timestamp: data.metadata.timestamp,
          version: data.metadata.version,
          tokenizers: availableTokenizers,
          languages: availableLanguages,
          metrics: availableMetrics,
        },
      };
    } else {
      // Fallback to raw data
      datasetName = data.dataset_name || 'Unknown';
      availableTokenizers = data.tokenizers || [];
      availableMetrics = data.metrics || [];
      availableLanguages = data.languages || [];
      
      processedData = {
        metrics: data.metrics || {},
        correlation: data.correlation || {},
        metadata: {
          datasetName,
          tokenizers: availableTokenizers,
          languages: availableLanguages,
          metrics: availableMetrics,
        },
      };
    }

    // Check for import validity
    if (!datasetName || (availableTokenizers.length === 0 && availableMetrics.length === 0 && availableLanguages.length === 0)) {
      setImportStatus({ success: false, message: 'Import failed: Invalid or missing metadata/data.' });
      console.error('[App] Import validation failed:', { datasetName, tokenizers: availableTokenizers.length, metrics: availableMetrics.length, languages: availableLanguages.length });
      return;
    }

    setState((prev) => ({
      ...prev,
      data: processedData,
      datasetName,
      availableTokenizers,
      availableMetrics,
      availableLanguages,
      metricDimensionality,
    }));
    // Build an informative import status message
    const metaListedCount = (processedData.metadata?.metrics || []).length;
    const missingSummary = missingMetrics && missingMetrics.length > 0
      ? `; Missing (listed but not in NPZ): ${missingMetrics.join(', ')}`
      : '';
    const importMsg = `Imported "${datasetName}" — Tokenizers: ${availableTokenizers.length}, Languages: ${availableLanguages.length}, Metrics available: ${availableMetrics.length}${metaListedCount ? ` (listed: ${metaListedCount})` : ''}${missingSummary}`;
    setImportStatus({ success: true, message: importMsg });
  };

  const handleSaveVisualization = () => {
    if (state.data) {
      const config = {
        figures: state.figures,
        data: state.data,
      };
      saveVisualization(config as any, `tokeval-viz-${new Date().getTime()}.json`);
    }
  };

  const handleUpdateFigure = (figureConfig: FigureConfig) => {
    setState((prev) => ({
      ...prev,
      figures: [figureConfig],
    }));
  };

  const handleDatasetChange = (dataset: string) => {
    setState((prev) => ({
      ...prev,
      datasetName: dataset,
    }));
  };

  const handleExportGraphs = async () => {
    const figuresForExport = state.figures.map((figure) => ({
      id: figure.id,
      filename: figure.typeId,
    }));
    await exportAllGraphs(figuresForExport as any);
  };

  return (
    <div className="app">
      <MainMenu
        onLoadVisualization={handleLoadVisualization}
        onSaveVisualization={handleSaveVisualization}
        onExportGraphs={handleExportGraphs}
        datasetName={state.datasetName}
      />
      {importStatus && (
        <div
          style={{
            margin: '10px',
            padding: '8px',
            background: importStatus.success ? '#e0ffe0' : '#ffe0e0',
            color: importStatus.success ? '#207520' : '#a00000',
            border: '1px solid',
            borderColor: importStatus.success ? '#b0e0b0' : '#e0b0b0',
            borderRadius: '4px',
            fontWeight: 'bold',
          }}
        >
          {importStatus.message}
        </div>
      )}
      <div className="content">
        <div className="graph-list-container">
          <GraphList
            figure={state.figures[0]}
            data={state.data}
          />
        </div>
        <div className="configurator-container">
          <GraphConfigurator
            onUpdateFigure={handleUpdateFigure}
            availableTokenizers={state.availableTokenizers}
            availableMetrics={state.availableMetrics}
            availableLanguages={state.availableLanguages}
            metricDimensionality={state.metricDimensionality}
            languagesInfo={state.data?.metadata?.languagesInfo || {}}
          />
        </div>
      </div>
    </div>
  );
};

// Helper functions imported from utils
import { extractTokenizers, extractMetrics, extractLanguages, detectMetricDimensionality, saveVisualization } from '../utils/fileUtils';

export default App;
