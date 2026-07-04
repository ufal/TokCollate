import React from 'react';
import { FigureConfig, VisualizationData } from '../../types';
import {
  Chart as ChartJS,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  LineController,
  Tooltip,
  Legend,
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import { buildLanguageLabelMap, getDisplayLanguageLabel, getDisplayLanguagePairLabel } from '../../utils/languageLabels';
import { getColorForMetric, GRAPH_COLORS } from './graphColors';

ChartJS.register(LinearScale, LogarithmicScale, PointElement, LineElement, LineController, Tooltip, Legend, zoomPlugin);

// ---------------------------------------------------------------------------
// Symlog transform: sign(x) * log10(1 + |x|) — handles negative values
// ---------------------------------------------------------------------------

function symlog(x: number): number {
  return Math.sign(x) * Math.log10(1 + Math.abs(x));
}

function isymlog(y: number): number {
  return Math.sign(y) * (Math.pow(10, Math.abs(y)) - 1);
}

function fmtSymlogTick(v: number): string {
  const orig = isymlog(v);
  if (orig === 0) return '0';
  return parseFloat(orig.toPrecision(3)).toString();
}

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
// hex color → rgba helper
// ---------------------------------------------------------------------------

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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
  const chartRef = React.useRef<ChartJS<'scatter'>>(null);

  const txX = config.axisTransforms?.x;
  const txY = config.axisTransforms?.y;
  const scaleX = txX?.scale ?? 'linear';
  const scaleY = txY?.scale ?? 'linear';
  const flipX = txX?.flip ?? false;
  const flipY = txY?.flip ?? false;

  // Apply per-axis transforms to a raw data value
  // For log scale we use symlog so negative values are preserved
  const applyX = (v: number) => { const f = flipX ? -v : v; return scaleX === 'log' ? symlog(f) : f; };
  const applyY = (v: number) => { const f = flipY ? -v : v; return scaleY === 'log' ? symlog(f) : f; };

  // Build axis label with active transform annotations
  const axisLabel = (metric: string, scale: string, flip: boolean) => {
    const parts: string[] = [];
    if (flip) parts.push('−');
    parts.push(metric);
    if (scale === 'log') parts.push('[symlog]');
    return parts.join('');
  };

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

  const getFamilyGroupKey = (pt: any): string => {
    if (pt.languagePair) {
      const dashIdx = pt.languagePair.indexOf('-');
      if (dashIdx > 0) {
        const lang1 = pt.languagePair.slice(0, dashIdx);
        const lang2 = pt.languagePair.slice(dashIdx + 1);
        const fam1 = getFamilyForLanguage(lang1);
        const fam2 = getFamilyForLanguage(lang2);
        const sorted = [fam1, fam2].sort();
        return `${sorted[0]} × ${sorted[1]}`;
      }
    }
    return getFamilyForLanguage(pt.language || '');
  };

  const groupKeyForPoint = (pt: any): string => {
    if (groupBy === 'tokenizer') return pt.tokenizer || 'unknown';
    if (groupBy === 'language') return pt.language || 'unknown';
    if (groupBy === 'languagePair') return pt.languagePair || 'unknown';
    if (groupBy === 'family') return getFamilyGroupKey(pt);
    return 'unknown';
  };

  const isValidPoint = (pt: any): boolean => {
    const x = pt[metricX], y = pt[metricY];
    if (typeof x !== 'number' || typeof y !== 'number' || Number.isNaN(x) || Number.isNaN(y) || !isFinite(x) || !isFinite(y)) return false;
    return true;
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
    config.trendlineMode || (config.showTrendline ? 'global' : 'none');

  // Build Chart.js datasets
  const datasets: any[] = [];

  groupNames.forEach((name, idx) => {
    const color = getColorForMetric(idx);
    const pts = downsampleGroupPoints(groupsMap.get(name) || [], metricX, metricY, MAX_SCATTER_POINTS_PER_GROUP);
    datasets.push({
      type: 'scatter' as const,
      label: name,
      data: pts.map((pt) => ({ x: applyX(pt[metricX]), y: applyY(pt[metricY]), _raw: pt })),
      backgroundColor: hexToRgba(color, 0.7),
      borderColor: color,
      borderWidth: 1,
      pointRadius: 4,
      pointHoverRadius: 6,
    });
  });

  // Trendlines as line datasets — computed on transformed values
  const trendPointsForGroup = (name: string) =>
    (groupsMap.get(name) || [])
      .filter(isValidPoint)
      .map((pt) => ({ [metricX]: applyX(pt[metricX]), [metricY]: applyY(pt[metricY]) }));
  const allTransformedPoints = allPoints.map((pt) => ({ [metricX]: applyX(pt[metricX]), [metricY]: applyY(pt[metricY]) }));

  if (trendlineMode === 'global') {
    const trend = computeTrend(allTransformedPoints, metricX, metricY);
    if (trend) {
      datasets.push({
        type: 'line' as const,
        label: 'Trend (global)',
        data: [
          { x: trend.minX, y: trend.m * trend.minX + trend.b },
          { x: trend.maxX, y: trend.m * trend.maxX + trend.b },
        ],
        borderColor: '#444',
        borderDash: [4, 2],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        tension: 0,
      });
    }
  } else if (trendlineMode === 'groups') {
    groupNames.forEach((name, idx) => {
      const trend = computeTrend(trendPointsForGroup(name), metricX, metricY);
      if (trend) {
        const color = getColorForMetric(idx);
        datasets.push({
          type: 'line' as const,
          label: `${name} trend`,
          data: [
            { x: trend.minX, y: trend.m * trend.minX + trend.b },
            { x: trend.maxX, y: trend.m * trend.maxX + trend.b },
          ],
          borderColor: color,
          borderDash: [4, 2],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0,
        });
      }
    });
  }

  const options: any = {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    parsing: false,
    scales: {
      x: {
        type: 'linear' as const,
        title: { display: true, text: axisLabel(metricX, scaleX, flipX) },
        ticks: scaleX === 'log' ? { callback: (v: any) => fmtSymlogTick(v) } : {},
      },
      y: {
        type: 'linear' as const,
        title: { display: true, text: axisLabel(metricY, scaleY, flipY) },
        ticks: scaleY === 'log' ? { callback: (v: any) => fmtSymlogTick(v) } : {},
      },
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const raw = context.raw as any;
            const pt = raw?._raw || raw;
            const hasLanguagePair = pt?.languagePair !== undefined && pt?.languagePair !== null;
            const rawLabel = hasLanguagePair ? pt.languagePair : pt.language;
            const displayLabel =
              rawLabel !== undefined
                ? hasLanguagePair
                  ? getDisplayLanguagePairLabel(String(rawLabel), languageLabelMap)
                  : getDisplayLanguageLabel(String(rawLabel), languageLabelMap)
                : undefined;
            const languageTitle = hasLanguagePair ? 'Language pair' : 'Language';
            const clusterSize = typeof pt?.clusterSize === 'number' ? pt.clusterSize : undefined;
            const fmt = (v: any) => (typeof v === 'number' ? v.toFixed(4) : String(v));
            // Show original (pre-transform) values from _raw when available
            const dispX = pt?.[metricX] !== undefined ? fmt(pt[metricX]) : fmt(raw.x);
            const dispY = pt?.[metricY] !== undefined ? fmt(pt[metricY]) : fmt(raw.y);
            const lines = [
              `Tokenizer: ${pt?.tokenizer ?? context.dataset.label ?? 'N/A'}`,
              ...(displayLabel !== undefined ? [`${languageTitle}: ${displayLabel}`] : []),
              ...(clusterSize !== undefined && clusterSize > 1 ? [`Points in cluster: ${clusterSize}`] : []),
              `${metricX}: ${dispX}`,
              `${metricY}: ${dispY}`,
            ];
            return lines;
          },
        },
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'xy' as const,
          modifierKey: undefined,
        },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'xy' as const,
        },
      },
    },
  };

  const handleResetZoom = () => {
    chartRef.current?.resetZoom();
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: 420 }}>
      <Scatter ref={chartRef} data={{ datasets }} options={options} />
      <button
        onClick={handleResetZoom}
        title="Reset zoom"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          padding: '3px 8px',
          fontSize: '0.75rem',
          cursor: 'pointer',
          background: '#fff',
          border: '1px solid #aaa',
          borderRadius: 3,
          zIndex: 10,
        }}
      >
        Reset zoom
      </button>
    </div>
  );
};

export default ScatterGraph;
