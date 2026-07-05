import React from 'react';

export interface TrendlineControlsProps {
  trendlineMode: 'none' | 'global' | 'groups';
  trendlineUncertainty: 'none' | 'confidence-band';
  onChange: (patch: { trendlineMode?: 'none' | 'global' | 'groups'; trendlineUncertainty?: 'none' | 'confidence-band' }) => void;
}

const TrendlineControls: React.FC<TrendlineControlsProps> = ({
  trendlineMode,
  trendlineUncertainty,
  onChange,
}) => {
  return (
    <>
      <div style={{ marginTop: '8px' }}>
        <label>Trendline:</label>
        <select
          value={trendlineMode}
          onChange={(e) => {
            const mode = e.target.value as 'none' | 'global' | 'groups';
            onChange({ trendlineMode: mode, ...(mode === 'none' ? { trendlineUncertainty: 'none' } : {}) });
          }}
          className="single-select"
        >
          <option value="none">None</option>
          <option value="global">Global</option>
          <option value="groups">Groups</option>
        </select>
      </div>
      {trendlineMode !== 'none' && (
        <div style={{ marginTop: '8px' }}>
          <label>Trendline (Uncertainty):</label>
          <select
            value={trendlineUncertainty}
            onChange={(e) =>
              onChange({ trendlineUncertainty: e.target.value as 'none' | 'confidence-band' })
            }
            className="single-select"
          >
            <option value="none">None</option>
            <option value="confidence-band">Confidence Band</option>
          </select>
        </div>
      )}
    </>
  );
};

export default TrendlineControls;
