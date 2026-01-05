import React from 'react';
import { GraphConfig, VisualizationData } from '../types';
import Graph from './Graph';
import './GraphList.css';

interface GraphListProps {
  graphs: GraphConfig[];
  data: VisualizationData | null;
  onRemoveGraph: (graphId: string) => void;
  datasetType: 'metrics' | 'correlation';
}

const GraphList: React.FC<GraphListProps> = ({
  graphs,
  data,
  onRemoveGraph,
  datasetType,
}) => {
  return (
    <div className="graph-list">
      <h2>Visualizations</h2>
      {graphs.length === 0 ? (
        <div className="empty-state">
          <p>No graphs added yet. Use the configurator on the right to add graphs.</p>
        </div>
      ) : (
        <div className="graphs-container">
          {graphs.map((graph) => (
            <div key={graph.id} className="graph-item">
              <div className="graph-header">
                <h3>{graph.title}</h3>
                <button
                  className="remove-btn"
                  onClick={() => onRemoveGraph(graph.id)}
                >
                  ✕
                </button>
              </div>
              {data && (
                <Graph
                  config={graph}
                  data={data}
                  datasetType={datasetType}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GraphList;
