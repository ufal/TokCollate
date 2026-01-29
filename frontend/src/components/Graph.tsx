import React from 'react';
import { FigureConfig, VisualizationData } from '../types';
import { getGraphType } from '../utils/graphTypes';
import {
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import './Graph.css';

interface GraphProps {
  config: FigureConfig;
  data: VisualizationData;
}

const Graph: React.FC<GraphProps> = ({ config, data }) => {
  const graphType = getGraphType(config.typeId);

  const getChartData = () => {
    console.log('[Graph.getChartData] Called');
    console.log('[Graph.getChartData] graphType:', graphType?.displayName);
    console.log('[Graph.getChartData] config.metrics:', config.metrics);
    console.log('[Graph.getChartData] config.tokenizers:', config.tokenizers);
    console.log('[Graph.getChartData] config.languages:', config.languages);
    
    if (!graphType) {
      console.error(`Unknown graph type: ${config.typeId}`);
      return [];
    }

    try {
      const result = graphType.transform(data, {
        metrics: config.metrics,
        tokenizers: config.tokenizers,
        languages: config.languages,
      });
      console.log('[Graph.getChartData] Result length:', result.length);
      console.log('[Graph.getChartData] Result:', result);
      return result;
    } catch (error) {
      console.error('Error transforming chart data:', error);
      return [];
    }
  };

  const chartData = getChartData();

  React.useEffect(() => {
    console.log('=== Graph Component Mount/Update ===');
    console.log('Figure config:', config);
    console.log('Data available:', !!data);
    console.log('Data metrics count:', data?.metrics ? Object.keys(data.metrics).length : 0);
    console.log('Chart data type:', typeof chartData);
    console.log('Chart data:', chartData);
    
    if (Array.isArray(chartData)) {
      console.log('Chart data length (array):', chartData.length);
      if (chartData.length > 0) {
        console.log('First row:', chartData[0]);
        console.log('First row keys:', Object.keys(chartData[0]));
      }
    } else if (chartData && typeof chartData === 'object') {
      console.log('Chart data is object with keys:', Object.keys(chartData));
      if (chartData.data) {
        console.log('Table rows:', chartData.rows);
        console.log('Table columns:', chartData.columns);
        console.log('Table data rows count:', chartData.data.length);
        if (chartData.data.length > 0) {
          console.log('First table row:', chartData.data[0]);
        }
      }
    }
    console.log('Config metrics:', config.metrics);
  }, [chartData, config, data]);

  const renderChart = () => {
    if (!graphType) {
      return <div className="error">Graph type not found: {config.typeId}</div>;
    }

    const metrics = config.metrics;

    console.log('[renderChart] Rendering chart type:', config.typeId);
    console.log('[renderChart] Rendering with metrics:', metrics);
    console.log('[renderChart] ChartData type:', typeof chartData);
    
    if (Array.isArray(chartData)) {
      console.log('[renderChart] ChartData items (array):', chartData.length);
      if (chartData.length > 0) {
        console.log('[renderChart] First data row:', chartData[0]);
        console.log('[renderChart] Data row keys:', Object.keys(chartData[0]));
      }
    } else if (chartData && typeof chartData === 'object') {
      console.log('[renderChart] ChartData is object:', Object.keys(chartData));
    }

    // Check if we have valid data
    const hasData = (Array.isArray(chartData) && chartData.length > 0) || 
                    (chartData && typeof chartData === 'object' && (chartData.data || chartData.error));

    if (!hasData) {
      console.error('[Graph] No data available. Chart data:', chartData);
      console.error('[Graph] Config:', config);
      console.error('[Graph] Available data metrics:', data?.metrics ? Object.keys(data.metrics) : 'none');
      
      let errorMsg = 'No data available for this configuration';
      if (chartData?.error) {
        errorMsg = chartData.error;
      }
      
      return <div className="no-data">{errorMsg}</div>;
    }

    // Render based on graph type
    if (config.typeId === 'metric-pair-correlation') {
      return renderScatterChart(metrics);
    } else if (config.typeId === 'metric-table') {
      return renderMetricTable();
    } else {
      return renderBarChart(metrics);
    }
  };

  const renderBarChart = (metrics: string[]) => {
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
          {metrics.map((metric, index) => {
            console.log(`[renderChart] Creating Bar for metric: ${metric}`);
            return (
              <Bar
                key={metric}
                dataKey={metric}
                fill={getColorForMetric(index)}
                name={metric}
                isAnimationActive={false}
              />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderScatterChart = (metrics: string[]) => {
    const metricX = metrics[0];
    const metricY = metrics[1];

    return (
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 30, left: 60, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            type="number" 
            dataKey={metricX} 
            name={metricX}
            label={{ value: metricX, position: 'insideBottomRight', offset: -10 }}
          />
          <YAxis 
            type="number" 
            dataKey={metricY} 
            name={metricY}
            label={{ value: metricY, angle: -90, position: 'insideLeft', offset: 10 }}
          />
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }}
            content={({ payload }) => {
              if (payload && payload.length > 0) {
                const data = payload[0].payload;
                return (
                  <div style={{ backgroundColor: '#fff', border: '1px solid #ccc', padding: '5px' }}>
                    <p><strong>Tokenizer: {data.tokenizer}</strong></p>
                    <p>Language: {data.language}</p>
                    <p>{metricX}: {data[metricX]?.toFixed ? data[metricX].toFixed(2) : data[metricX]}</p>
                    <p>{metricY}: {data[metricY]?.toFixed ? data[metricY].toFixed(2) : data[metricY]}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Scatter 
            name="Metric Pair Correlation" 
            data={chartData} 
            fill="#8884d8"
            isAnimationActive={false}
          />
        </ScatterChart>
      </ResponsiveContainer>
    );
  };

  const renderMetricTable = () => {
    const tableData = chartData as any;
    
    // Check for error message
    if (tableData.error) {
      return <div className="no-data"><strong>Error:</strong> {tableData.error}</div>;
    }
    
    if (!tableData.rows || !tableData.columns || !tableData.data) {
      return <div className="no-data">Invalid table data structure</div>;
    }

    if (tableData.data.length === 0) {
      return <div className="no-data">No data available for this configuration</div>;
    }

    return (
      <div className="metric-table-container">
        <table className="metric-table">
          <thead>
            <tr>
              <th className="table-row-header">Tokenizer</th>
              {tableData.columns.map((col: string, idx: number) => (
                <th key={idx} className="table-column-header">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.data.map((row: any[], rowIdx: number) => (
              <tr key={rowIdx}>
                <td className="table-row-label">{tableData.rows[rowIdx]}</td>
                {row.map((cell: any, colIdx: number) => (
                  <td key={colIdx} className="table-cell" title={`Value: ${cell.value !== undefined ? cell.value : 'N/A'}`}>
                    {cell.formatted}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const getColorForMetric = (index: number): string => {
    const colors = [
      '#8884d8',
      '#82ca9d',
      '#ffc658',
      '#ff7c7c',
      '#8dd1e1',
      '#d084d0',
      '#ffa500',
      '#00ff00',
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="graph" id={`graph-${config.id}`}>
      {(Array.isArray(chartData) ? chartData.length > 0 : !!chartData) ? (
        renderChart()
      ) : (
        <div className="no-data">No data available for this configuration</div>
      )}
    </div>
  );
};

export default Graph;
