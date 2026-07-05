import React from 'react';
import { FigureConfig } from '../../types';
import TrendlineControls from './TrendlineControls';

export interface ScatterGraphControlsProps {
  config: Partial<FigureConfig>;
  filteredMetrics: string[];
  getMetricDimensionLabel: (metric: string) => string;
  onChange: (patch: Partial<FigureConfig>) => void;
}

const ScatterGraphControls: React.FC<ScatterGraphControlsProps> = ({
  config,
  filteredMetrics,
  getMetricDimensionLabel,
  onChange,
}) => {
  const trendlineMode = config.trendlineMode ?? 'none';
  const trendlineUncertainty = config.trendlineUncertainty ?? 'none';

  return (
    <div className="config-section">
      <label>Metric X (X-axis):</label>
      <select
        value={config.metrics?.[0] || ''}
        onChange={(e) => {
          const metricX = e.target.value;
          const metrics = [metricX, config.metrics?.[1] || ''].filter(Boolean);
          onChange({ metrics });
        }}
        className="single-select"
        disabled={filteredMetrics.length === 0}
      >
        <option value="">Select metric</option>
        {filteredMetrics.map((m) => (
          <option key={m} value={m}>
            {m}{getMetricDimensionLabel(m)}
          </option>
        ))}
      </select>

      <label>Metric Y (Y-axis):</label>
      <select
        value={config.metrics?.[1] || ''}
        onChange={(e) => {
          const metricY = e.target.value;
          const metrics = [config.metrics?.[0] || '', metricY].filter(Boolean);
          onChange({ metrics });
        }}
        className="single-select"
        disabled={filteredMetrics.length === 0}
      >
        <option value="">Select metric</option>
        {filteredMetrics.map((m) => (
          <option key={m} value={m}>
            {m}{getMetricDimensionLabel(m)}
          </option>
        ))}
      </select>

      <div style={{ marginTop: '8px' }}>
        <label>Color by:</label>
        <select
          value={config.groupBy || 'tokenizer'}
          onChange={(e) => onChange({ groupBy: e.target.value as FigureConfig['groupBy'] })}
          className="single-select"
        >
          <option value="tokenizer">Tokenizer</option>
          {config.typeId === 'metric-pair-correlation-bi'
            ? <option value="languagePair">Language Pair</option>
            : <option value="language">Language</option>
          }
          <option value="family">Language family</option>
        </select>
      </div>

      <TrendlineControls
        trendlineMode={trendlineMode}
        trendlineUncertainty={trendlineUncertainty}
        onChange={onChange}
      />

      {/* Axis transform controls */}
      {(['x', 'y'] as const).map((axis) => {
        const metricLabel = axis === 'x' ? 'X-axis' : 'Y-axis';
        const tx = config.axisTransforms?.[axis] || {};
        const setTx = (patch: Record<string, any>) => {
          onChange({
            axisTransforms: {
              ...(config.axisTransforms || {}),
              [axis]: { ...tx, ...patch },
            },
          });
        };
        return (
          <div key={axis} style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <label style={{ minWidth: '56px' }}>{metricLabel}:</label>
            <select
              value={tx.scale || 'linear'}
              onChange={(e) => setTx({ scale: e.target.value })}
              className="single-select"
              style={{ width: 'auto' }}
              title={`Scale for ${metricLabel}`}
            >
              <option value="linear">Linear</option>
              <option value="log">Log</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 'normal' }}>
              <input
                type="checkbox"
                checked={tx.flip || false}
                onChange={(e) => setTx({ flip: e.target.checked })}
              />
              Flip Axis
            </label>
          </div>
        );
      })}
    </div>
  );
};

export default ScatterGraphControls;
