import React from 'react';
import { FigureConfig, VisualizationData } from '../types';
import Graph from './Graph';
import './GraphList.css';

interface GraphListProps {
  figure?: FigureConfig;
  data: VisualizationData | null;
}

const GraphList: React.FC<GraphListProps> = ({ figure, data }) => {
  React.useEffect(() => {
    console.log('[GraphList] Data:', {
      dataAvailable: !!data,
      metricsCount: data?.metrics ? Object.keys(data.metrics).length : 0,
      hasFigure: !!figure,
    });
  }, [data, figure]);

  return (
    <div className="graph-list">
      {!figure ? (
        <div className="empty-state">
          <p>No figure yet. Use the configurator to build one.</p>
        </div>
      ) : (
        <div className="graphs-container">
          <div className="graph-item">
            {/* Title removed; rendering only the graph */}
            {data ? (
              <Graph config={figure} data={data} />
            ) : (
              <div className="no-data">No data loaded</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphList;
