import React from 'react';
import { FigureConfig, VisualizationData } from '../../types';
import {
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
} from 'recharts';
import { buildLanguageLabelMap, getDisplayLanguageLabel, getDisplayLanguagePairLabel } from '../../utils/languageLabels';
import { getColorForMetric } from './graphColors';

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

const ScatterTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
  metricX: string;
  metricY: string;
  formatLanguage?: (label: string, isPair: boolean) => string;
}> = ({ active, payload, metricX, metricY, formatLanguage }) => {
  if (!active || !payload || payload.length === 0) return null;

  const pt = payload[0]?.payload || {};
  const hasLanguagePair = pt.languagePair !== undefined && pt.languagePair !== null;
  const rawLanguageLabel = hasLanguagePair ? pt.languagePair : pt.language;
  const languageLabel =
    rawLanguageLabel !== undefined && formatLanguage
      ? formatLanguage(String(rawLanguageLabel), hasLanguagePair)
      : rawLanguageLabel;
  const languageTitle = hasLanguagePair ? 'Language pair' : 'Language';
  const clusterSize = typeof pt.clusterSize === 'number' ? pt.clusterSize : undefined;
  const formatVal = (v: any) => (typeof v === 'number' ? v.toFixed(2) : v);

  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #ccc', padding: '5px' }}>
      <p><strong>Tokenizer: {pt.tokenizer ?? 'N/A'}</strong></p>
      {languageLabel !== undefined && <p>{languageTitle}: {languageLabel}</p>}
      {clusterSize !== undefined && clusterSize > 1 && <p>Points in cluster: {clusterSize}</p>}
      <p>{metricX}: {formatVal(pt[metricX])}</p>
      <p>{metricY}: {formatVal(pt[metricY])}</p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Downsampling
// ---------------------------------------------------------------------------

const MAX_SCATTER_POINTS_PER_GROUP = 2000;

function downsampleGroupPoints(
  points: any[],
  metricX: string,
  metricY: string,
  maxPointsPerGroup: number,
): any[] {
  if (!Array.isArray(points) || points.length <= maxPointsPerGroup) return points;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const pt of points) {
    const x = pt[metricX], y = pt[metricY];
    if (typeof x !== 'number' || typeof y !== 'number' || Number.isNaN(x) || Number.isNaN(y)) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return points;
  }

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const gridSize = Math.ceil(Math.sqrt(maxPointsPerGroup));
  type Cell = { sumX: number; sumY: number; count: number; template: any };
  const cells: Map<string, Cell> = new Map();

  for (const pt of points) {
    const x = pt[metricX], y = pt[metricY];
    if (typeof x !== 'number' || typeof y !== 'number' || Number.isNaN(x) || Number.isNaN(y)) continue;
    const gx = Math.min(gridSize - 1, Math.max(0, Math.floor(((x - minX) / rangeX) * gridSize)));
    const gy = Math.min(gridSize - 1, Math.max(0, Math.floor(((y - minY) / rangeY) * gridSize)));
    const key = `${gx}:${gy}`;
    let cell = cells.get(key);
    if (!cell) { cell = { sumX: 0, sumY: 0, count: 0, template: pt }; cells.set(key, cell); }
    cell.sumX += x; cell.sumY += y; cell.count += 1;
  }

  const result: any[] = [];
  cells.forEach((cell) => {
    if (cell.count === 0) return;
    const centroid: any = {
      ...cell.template,
      [metricX]: cell.sumX / cell.count,
      [metricY]: cell.sumY / cell.count,
    };
    if (cell.count > 1) centroid.clusterSize = cell.count;
    result.push(centroid);
  });
  return result;
}

// ---------------------------------------------------------------------------
// Trend computation
// ---------------------------------------------------------------------------

function computeTrend(
  pts: any[],
  metricX: string,
  metricY: string,
): { m: number; b: number; minX: number; maxX: number } | null {
  if (!pts || pts.length < 2) return null;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, minX = Infinity, maxX = -Infinity;
  for (const p of pts) {
    const x = p[metricX], y = p[metricY];
    sumX += x; sumY += y; sumXY += x * y; sumXX += x * x;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  const n = pts.length;
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const m = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - m * sumX) / n;
  return { m, b, minX, maxX };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ScatterGraphProps {
  config: FigureConfig;
  data: VisualizationData;
  chartData: any[];
}

const ScatterGraph: React.FC<ScatterGraphProps> = ({ config, data, chartData }) => {
  const metricX = config.metrics[0];
  const metricY = config.metrics[1];
  const groupBy = config.groupBy || 'tokenizer';

  const allLanguages = data.metadata?.languages || [];
  const languageLabelMap = React.useMemo(
    () => buildLanguageLabelMap(allLanguages),
    [allLanguages],
  );

  const getLanguageInfoForLabel = (label: string): any => {
    const parts = label.split('_');
    const base = parts.length >= 3 ? parts.slice(0, parts.length - 2).join('_') : label;
    const glottocode = parts.length >= 3 ? parts[parts.length - 1] : undefined;
    const root: any = data?.metadata?.languagesInfo || {};
    const direct = root.languages?.[base] ?? root[base] ?? null;
    if (direct) return direct;
    if (glottocode) {
      const entries: Array<{ info: any }> =
        root.languages && typeof root.languages === 'object'
          ? Object.values(root.languages).map((info) => ({ info }))
          : Object.values(root).map((info) => ({ info }));
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
    if (fam && typeof fam === 'object') return Object.keys(fam)[0] || 'unknown';
    if (typeof fam === 'string') return fam || 'unknown';
    return 'unknown';
  };

  const groupKeyForPoint = (pt: any): string => {
    if (groupBy === 'tokenizer') return pt.tokenizer || 'unknown';
    if (groupBy === 'language') return pt.language || 'unknown';
    if (groupBy === 'family') return getFamilyForLanguage(pt.language || '');
    return 'unknown';
  };

  const isValidPoint = (pt: any): boolean => {
    const x = pt[metricX], y = pt[metricY];
    return typeof x === 'number' && typeof y === 'number' && !Number.isNaN(x) && !Number.isNaN(y) && isFinite(x) && isFinite(y);
  };

  const allPoints = (Array.isArray(chartData) ? chartData : []).filter(isValidPoint);

  const groupsMap: Map<string, any[]> = new Map();
  allPoints.forEach((pt) => {
    const key = groupKeyForPoint(pt);
    if (!groupsMap.has(key)) groupsMap.set(key, []);
    groupsMap.get(key)!.push(pt);
  });
  const groupNames = Array.from(groupsMap.keys());

  const trendlineMode: 'none' | 'global' | 'groups' =
    (config as any).trendlineMode || (config.showTrendline ? 'global' : 'none');

  const buildTrendData = (trend: { m: number; b: number; minX: number; maxX: number }) => [
    { [metricX]: trend.minX, [metricY]: trend.m * trend.minX + trend.b },
    { [metricX]: trend.maxX, [metricY]: trend.m * trend.maxX + trend.b },
  ];

  type TrendLineDef = { key: string; name: string; color: string; data: any[] };
  const trendLines: TrendLineDef[] = [];

  if (trendlineMode === 'global') {
    const trend = computeTrend(allPoints, metricX, metricY);
    if (trend) trendLines.push({ key: 'global-trend', name: 'Trend (global)', color: '#444', data: buildTrendData(trend) });
  } else if (trendlineMode === 'groups') {
    groupNames.forEach((name, idx) => {
      const trend = computeTrend(groupsMap.get(name) || [], metricX, metricY);
      if (trend) trendLines.push({ key: `trend-${name}`, name: `${name} trend`, color: getColorForMetric(idx), data: buildTrendData(trend) });
    });
  }

  const displayGroupsMap: Map<string, any[]> = new Map();
  groupNames.forEach((name) => {
    displayGroupsMap.set(name, downsampleGroupPoints(groupsMap.get(name) || [], metricX, metricY, MAX_SCATTER_POINTS_PER_GROUP));
  });

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
          content={(
            <ScatterTooltip
              metricX={metricX}
              metricY={metricY}
              formatLanguage={(label, isPair) =>
                isPair
                  ? getDisplayLanguagePairLabel(label, languageLabelMap)
                  : getDisplayLanguageLabel(label, languageLabelMap)
              }
            />
          )}
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
            data={displayGroupsMap.get(name)!}
            dataKey={metricY}
            fill={getColorForMetric(idx)}
            isAnimationActive={false}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default ScatterGraph;
