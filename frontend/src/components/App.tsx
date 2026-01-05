import React, { useState } from 'react';
import { VisualizationState, GraphConfig } from '../types';
import MainMenu from './MainMenu';
import GraphList from './GraphList';
import GraphConfigurator from './GraphConfigurator';
import './App.css';
import { exportAllGraphs } from '../utils/fileUtils';

const App: React.FC = () => {
  const [state, setState] = useState<VisualizationState>({
    graphs: [],
    datasetName: 'Unknown',
    availableTokenizers: [],
    availableMetrics: [],
    availableLanguages: [],
    data: null,
  });

  const handleLoadVisualization = (data: any) => {
    const datasetName = data?.metadata?.datasetName || 'Unknown';
    setState((prev) => ({
      ...prev,
      data,
      datasetName,
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

  const handleDatasetChange = (dataset: string) => {
    setState((prev) => ({
      ...prev,
      datasetName: dataset,
    }));
  };

  const handleExportGraphs = async () => {
    const graphsForExport = state.graphs.map((graph) => ({
      id: graph.id,
      title: graph.title,
    }));
    await exportAllGraphs(graphsForExport);
  };

  return (
    <div className="app">
      <MainMenu
        onLoadVisualization={handleLoadVisualization}
        onSaveVisualization={handleSaveVisualization}
        onExportGraphs={handleExportGraphs}
        datasetName={state.datasetName}
      />
      <div className="content">
        <div className="graph-list-container">
          <GraphList
            graphs={state.graphs}
            data={state.data}
            onRemoveGraph={handleRemoveGraph}
            datasetType={state.datasetName}
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
