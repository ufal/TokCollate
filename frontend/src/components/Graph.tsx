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
  ReferenceLine,
  ComposedChart,
  Line,
} from 'recharts';
import './Graph.css';

interface GraphProps {
  config: FigureConfig;
  data: VisualizationData;
}

const ScatterTooltip: React.FC<{ active?: boolean; payload?: any[]; metricX: string; metricY: string }> = ({
  active,
  payload,
  metricX,
  metricY,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const pt = payload[0]?.payload || {};
  const hasLanguagePair = pt.languagePair !== undefined && pt.languagePair !== null;
  const languageLabel = hasLanguagePair ? pt.languagePair : pt.language;
  const languageTitle = hasLanguagePair ? 'Language pair' : 'Language';

  const xVal = pt[metricX];
  const yVal = pt[metricY];

  const formatVal = (v: any) => (typeof v === 'number' ? v.toFixed(2) : v);

  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #ccc', padding: '5px' }}>
      <p><strong>Tokenizer: {pt.tokenizer ?? 'N/A'}</strong></p>
      {languageLabel !== undefined && (
        <p>{languageTitle}: {languageLabel}</p>
      )}
      <p>{metricX}: {formatVal(xVal)}</p>
      <p>{metricY}: {formatVal(yVal)}</p>
    </div>
  );
};

const Graph: React.FC<GraphProps> = ({ config, data }) => {
  const graphType = getGraphType(config.typeId);

  const getChartData = (): any[] | any => {
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

    const groupBy = config.groupBy || 'tokenizer';

    const getLanguageInfoForLabel = (label: string): any => {
      const parts = label.split('_');
      const base = parts.length >= 3 ? parts.slice(0, parts.length - 2).join('_') : label;
      const glottocode = parts.length >= 3 ? parts[parts.length - 1] : undefined;
      const root: any = data?.metadata?.languagesInfo || {};
      const direct = root.languages && root.languages[base] ? root.languages[base]
        : (root[base] ? root[base] : null);
      if (direct) return direct;
      if (glottocode) {
        const entries: Array<{ key: string; info: any }> = root.languages && typeof root.languages === 'object'
          ? Object.keys(root.languages).map((k) => ({ key: k, info: root.languages[k] }))
          : Object.keys(root).map((k) => ({ key: k, info: root[k] }));
        for (const { info } of entries) {
          const gc = info?.glottocodes;
          if (typeof gc === 'string' && gc === glottocode) return info;
          if (Array.isArray(gc) && gc.includes(glottocode)) return info;
          if (gc && typeof gc === 'object' && Object.keys(gc).includes(glottocode)) return info;
        }
      }
      return null;
    };

    const getFamilyForLanguage = (label: string): string => {
      const info = getLanguageInfoForLabel(label);
      if (!info) return 'unknown';
      const fam = info.families;
      if (Array.isArray(fam)) return fam[0] || 'unknown';
      if (fam && typeof fam === 'object') {
        const keys = Object.keys(fam);
        return keys[0] || 'unknown';
      }
      if (typeof fam === 'string') return fam || 'unknown';
      return 'unknown';
    };

    const groupKeyForPoint = (pt: any): string => {
      if (groupBy === 'tokenizer') return pt.tokenizer || 'unknown';
      if (groupBy === 'language') return pt.language || 'unknown';
      if (groupBy === 'family') return getFamilyForLanguage(pt.language || '');
      return 'unknown';
    };

    // Partition chartData into groups
    const groupsMap: Map<string, any[]> = new Map();
    (Array.isArray(chartData) ? chartData : []).forEach((pt) => {
      const key = groupKeyForPoint(pt);
      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key)!.push(pt);
    });
    const groupNames = Array.from(groupsMap.keys());

    const isValidPoint = (pt: any): boolean => {
      const x = pt[metricX];
      const y = pt[metricY];
      return typeof x === 'number' && typeof y === 'number' && !Number.isNaN(x) && !Number.isNaN(y) && isFinite(x) && isFinite(y);
    };

    const allPoints: any[] = (Array.isArray(chartData) ? chartData : []).filter(isValidPoint);

    const computeTrend = (pts: any[]): { m: number; b: number; minX: number; maxX: number } | null => {
      if (!pts || pts.length < 2) return null;
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      let minX = Infinity, maxX = -Infinity;
      for (const p of pts) {
        const x = p[metricX];
        const y = p[metricY];
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
      const n = pts.length;
      const denom = (n * sumXX - sumX * sumX);
      if (denom === 0) return null;
      const m = (n * sumXY - sumX * sumY) / denom;
      const b = (sumY - m * sumX) / n;
      return { m, b, minX, maxX };
    };

    const trendlineMode: 'none' | 'global' | 'groups' =
      (config as any).trendlineMode || (config.showTrendline ? 'global' : 'none');

    const buildTrendData = (trend: { m: number; b: number; minX: number; maxX: number }) => ([
      { [metricX]: trend.minX, [metricY]: trend.m * trend.minX + trend.b },
      { [metricX]: trend.maxX, [metricY]: trend.m * trend.maxX + trend.b },
    ]);

    type TrendLineDef = { key: string; name: string; color: string; data: any[] };
    const trendLines: TrendLineDef[] = [];

    if (trendlineMode === 'global') {
      const trend = computeTrend(allPoints);
      if (trend) {
        trendLines.push({
          key: 'global-trend',
          name: 'Trend (global)',
          color: '#444',
          data: buildTrendData(trend),
        });
      }
    } else if (trendlineMode === 'groups') {
      groupNames.forEach((name, idx) => {
        const groupPts = (groupsMap.get(name) || []).filter(isValidPoint);
        const trend = computeTrend(groupPts);
        if (trend) {
          trendLines.push({
            key: `trend-${name}`,
            name: `${name} trend`,
            color: getColorForMetric(idx),
            data: buildTrendData(trend),
          });
        }
      });
    }

    return (
      <ResponsiveContainer width="100%" height={420}>
        <ComposedChart margin={{ top: 20, right: 30, left: 60, bottom: 90 }}>
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
            content={<ScatterTooltip metricX={metricX} metricY={metricY} />}
          />
          <Legend verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: 10 }} />
          {trendLines.map((t) => (
            <Line
              key={t.key}
              type="linear"
              data={t.data}
              dataKey={metricY}
              name={t.name}
              stroke={t.color}
              strokeDasharray="4 2"
              dot={false}
              isAnimationActive={false}
            />
          ))}
          {groupNames.map((name, idx) => (
            <Scatter
              key={name}
              name={name}
              data={groupsMap.get(name)!}
              dataKey={metricY}
              fill={getColorForMetric(idx)}
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
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
              <th className="table-row-header">{tableData.rowHeader || 'Tokenizer'}</th>
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
