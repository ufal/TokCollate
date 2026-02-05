import React from 'react';
import { FigureConfig, VisualizationData } from '../types';
import Graph from './Graph';
import './GraphList.css';

interface GraphListProps {
  figures: FigureConfig[];
  data: VisualizationData | null;
  onRemoveFigure: (figureId: string) => void;
}

const GraphList: React.FC<GraphListProps> = ({
  figures,
  data,
  onRemoveFigure,
}) => {
  React.useEffect(() => {
    console.log('[GraphList] Data:', {
      dataAvailable: !!data,
      metricsCount: data?.metrics ? Object.keys(data.metrics).length : 0,
      figuresCount: figures.length,
    });
  }, [data, figures]);

  return (
    <div className="graph-list">
      <h2>Visualizations</h2>
      {figures.length === 0 ? (
        <div className="empty-state">
          <p>No visualizations added yet. Use the configurator on the right to add visualizations.</p>
        </div>
      ) : (
        <div className="graphs-container">
          {figures.map((figure) => {
            console.log(`[GraphList] Rendering figure ${figure.id}:`, figure);
            return (
              <div key={figure.id} className="graph-item">
                <div className="graph-header">
                  <h3>{figure.title}</h3>
                  <button
                    className="remove-btn"
                    onClick={() => onRemoveFigure(figure.id)}
                  >
                    ✕
                  </button>
                </div>
                {data ? (
                  <Graph
                    config={figure}
                    data={data}
                  />
                ) : (
                  <div className="no-data">No data loaded</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GraphList;
