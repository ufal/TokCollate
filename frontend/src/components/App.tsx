import React, { useState } from 'react';
import { VisualizationState, GraphConfig } from '../types';
import MainMenu from './MainMenu';
import GraphList from './GraphList';
import GraphConfigurator from './GraphConfigurator';
import './App.css';

const App: React.FC = () => {
  const [state, setState] = useState<VisualizationState>({
    graphs: [],
    currentDataset: 'metrics',
    availableTokenizers: [],
    availableMetrics: [],
    availableLanguages: [],
    data: null,
  });

  const handleLoadVisualization = (data: any) => {
    setState((prev) => ({
      ...prev,
      data,
      availableTokenizers: extractTokenizers(data),
      availableMetrics: extractMetrics(data),
      availableLanguages: extractLanguages(data),
    }));
  };

  const handleSaveVisualization = () => {
    if (state.data) {
      const config = {
        graphs: state.graphs,
        data: state.data,
      };
      saveVisualization(config, `tokeval-viz-${new Date().getTime()}.json`);
    }
  };

  const handleAddGraph = (graphConfig: GraphConfig) => {
    setState((prev) => ({
      ...prev,
      graphs: [...prev.graphs, graphConfig],
    }));
  };

  const handleRemoveGraph = (graphId: string) => {
    setState((prev) => ({
      ...prev,
      graphs: prev.graphs.filter((g) => g.id !== graphId),
    }));
  };

  const handleDatasetChange = (dataset: 'metrics' | 'correlation') => {
    setState((prev) => ({
      ...prev,
      currentDataset: dataset,
    }));
  };

  return (
    <div className="app">
      <MainMenu
        onLoadVisualization={handleLoadVisualization}
        onSaveVisualization={handleSaveVisualization}
        onDatasetChange={handleDatasetChange}
        currentDataset={state.currentDataset}
      />
      <div className="content">
        <div className="graph-list-container">
          <GraphList
            graphs={state.graphs}
            data={state.data}
            onRemoveGraph={handleRemoveGraph}
            datasetType={state.currentDataset}
          />
        </div>
        <div className="configurator-container">
          <GraphConfigurator
            onAddGraph={handleAddGraph}
            availableTokenizers={state.availableTokenizers}
            availableMetrics={state.availableMetrics}
            availableLanguages={state.availableLanguages}
          />
        </div>
      </div>
    </div>
  );
};

// Helper functions imported from utils
import { extractTokenizers, extractMetrics, extractLanguages, saveVisualization } from '../utils/fileUtils';

export default App;
