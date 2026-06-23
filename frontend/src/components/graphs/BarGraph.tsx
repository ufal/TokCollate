import React from 'react';
import { FigureConfig, VisualizationData } from '../../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getColorForMetric } from './graphColors';

interface BarGraphProps {
  config: FigureConfig;
  data: VisualizationData;
  chartData: any[];
}

const BarGraph: React.FC<BarGraphProps> = ({ config, chartData }) => {
  const metrics = config.metrics;

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 60, bottom: 100 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          angle={-45}
          textAnchor="end"
          height={120}
          interval={0}
        />
        <YAxis
          type="number"
          domain={[0, 16]}
          ticks={[0, 2, 4, 6, 8, 10, 12, 14, 16]}
          label={{ value: 'Ranking (1=Best)', angle: -90, position: 'insideLeft', offset: 10 }}
        />
        <Tooltip />
        <Legend />
        {metrics.map((metric, index) => (
          <Bar
            key={metric}
            dataKey={metric}
            fill={getColorForMetric(index)}
            name={metric}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

export default BarGraph;
