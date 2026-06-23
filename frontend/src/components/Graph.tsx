import React from 'react';
import { FigureConfig, VisualizationData } from '../types';
import { getGraphType } from '../utils/graphTypes';
import BarGraph from './graphs/BarGraph';
import ScatterGraph from './graphs/ScatterGraph';
import MetricTable from './graphs/MetricTable';
import TokenizedText from './graphs/TokenizedText';
import './Graph.css';

interface GraphProps {
  config: FigureConfig;
  data: VisualizationData;
}

const Graph: React.FC<GraphProps> = ({ config, data }) => {
  const graphType = getGraphType(config.typeId);

  // Tokenized-text is data-independent — render directly.
  if (config.typeId === 'tokenized-text') {
    return (
      <div className="graph" id={`graph-${config.id}`}>
        <TokenizedText config={config} data={data} />
      </div>
    );
  }

  if (!graphType) {
    return <div className="graph error">Graph type not found: {config.typeId}</div>;
  }

  let chartData: any;
  try {
    chartData = graphType.transform(data, {
      metrics: config.metrics,
      tokenizers: config.tokenizers,
      languages: config.languages,
    });
  } catch (err) {
    console.error('Error transforming chart data:', err);
    return <div className="graph no-data">Error computing chart data</div>;
  }

  const hasData =
    (Array.isArray(chartData) && chartData.length > 0) ||
    (chartData && typeof chartData === 'object' && (chartData.data || chartData.error));

  if (!hasData) {
    const msg = chartData?.error || 'No data available for this configuration';
    return (
      <div className="graph" id={`graph-${config.id}`}>
        <div className="no-data">{msg}</div>
      </div>
    );
  }

  const renderContent = () => {
    if (config.typeId === 'metric-pair-correlation') {
      return <ScatterGraph config={config} data={data} chartData={chartData} />;
    }
    if (config.typeId === 'metric-table') {
      return <MetricTable config={config} data={data} tableData={chartData} />;
    }
    return <BarGraph config={config} data={data} chartData={chartData} />;
  };

  return (
    <div className="graph" id={`graph-${config.id}`}>
      {renderContent()}
    </div>
  );
};

export default Graph;
