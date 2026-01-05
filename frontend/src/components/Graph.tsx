import React from 'react';
import { GraphConfig, VisualizationData } from '../types';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import './Graph.css';

interface GraphProps {
  config: GraphConfig;
  data: VisualizationData;
  datasetType: 'metrics' | 'correlation';
}

const Graph: React.FC<GraphProps> = ({ config, data, datasetType }) => {
  const getChartData = () => {
    const sourceData = datasetType === 'metrics' ? data.metrics : data.correlation;
    if (!sourceData) return [];

    // Transform data for selected metrics and tokenizers
    const chartData: any[] = [];
    
    Object.entries(sourceData).forEach(([key, value]: [string, any]) => {
      const matches = config.metrics.some(
        (m) => key.includes(m) || key === m
      ) && config.tokenizers.some((t) => key.includes(t) || key === t);

      if (matches) {
        chartData.push({
          name: key,
          value: typeof value === 'number' ? value : 0,
        });
      }
    });

    return chartData;
  };

  const chartData = getChartData();

  const renderChart = () => {
    switch (config.type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#8884d8" />
            </LineChart>
          </ResponsiveContainer>
        );
      default:
        return <div>Unsupported chart type: {config.type}</div>;
    }
  };

  return (
    <div className="graph">
      {chartData.length > 0 ? (
        renderChart()
      ) : (
        <div className="no-data">No data available for this configuration</div>
      )}
    </div>
  );
};

export default Graph;
