import React, { useState } from 'react';
import { GraphConfig } from '../types';
import './GraphConfigurator.css';

interface GraphConfiguratorProps {
  onAddGraph: (config: GraphConfig) => void;
  availableTokenizers: string[];
  availableMetrics: string[];
  availableLanguages: string[];
}

const GraphConfigurator: React.FC<GraphConfiguratorProps> = ({
  onAddGraph,
  availableTokenizers,
  availableMetrics,
  availableLanguages,
}) => {
  const [config, setConfig] = useState<Partial<GraphConfig>>({
    type: 'bar',
    title: 'New Graph',
    tokenizers: [],
    languages: [],
    metrics: [],
  });

  const handleAddTokenizer = (tokenizer: string) => {
    setConfig((prev) => ({
      ...prev,
      tokenizers: [...(prev.tokenizers || []), tokenizer],
    }));
  };

  const handleRemoveTokenizer = (tokenizer: string) => {
    setConfig((prev) => ({
      ...prev,
      tokenizers: (prev.tokenizers || []).filter((t) => t !== tokenizer),
    }));
  };

  const handleAddMetric = (metric: string) => {
    setConfig((prev) => ({
      ...prev,
      metrics: [...(prev.metrics || []), metric],
    }));
  };

  const handleRemoveMetric = (metric: string) => {
    setConfig((prev) => ({
      ...prev,
      metrics: (prev.metrics || []).filter((m) => m !== metric),
    }));
  };

  const handleAddLanguage = (language: string) => {
    setConfig((prev) => ({
      ...prev,
      languages: [...(prev.languages || []), language],
    }));
  };

  const handleRemoveLanguage = (language: string) => {
    setConfig((prev) => ({
      ...prev,
      languages: (prev.languages || []).filter((l) => l !== language),
    }));
  };

  const handleGenerateGraph = () => {
    if (
      config.tokenizers?.length === 0 ||
      config.metrics?.length === 0
    ) {
      alert('Please select at least one tokenizer and one metric.');
      return;
    }

    const newGraph: GraphConfig = {
      id: `graph-${Date.now()}`,
      type: (config.type as any) || 'bar',
      title: config.title || 'New Graph',
      tokenizers: config.tokenizers || [],
      languages: config.languages || [],
      metrics: config.metrics || [],
      filters: {},
    };

    onAddGraph(newGraph);

    // Reset form
    setConfig({
      type: 'bar',
      title: 'New Graph',
      tokenizers: [],
      languages: [],
      metrics: [],
    });
  };

  return (
    <div className="graph-configurator">
      <h2>Graph Configuration</h2>

      <div className="config-section">
        <label>Graph Title:</label>
        <input
          type="text"
          value={config.title || ''}
          onChange={(e) => setConfig((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="Enter graph title"
        />
      </div>

      <div className="config-section">
        <label>Graph Type:</label>
        <select
          value={config.type || 'bar'}
          onChange={(e) => setConfig((prev) => ({ ...prev, type: e.target.value as any }))}
        >
          <option value="bar">Bar Chart</option>
          <option value="line">Line Chart</option>
          <option value="scatter">Scatter Plot (coming soon)</option>
          <option value="heatmap">Heatmap (coming soon)</option>
        </select>
      </div>

      <div className="config-section">
        <label>Tokenizers:</label>
        <select
          onChange={(e) => {
            if (e.target.value && !config.tokenizers?.includes(e.target.value)) {
              handleAddTokenizer(e.target.value);
            }
            e.target.value = '';
          }}
        >
          <option value="">Select tokenizer...</option>
          {availableTokenizers
            .filter((t) => !config.tokenizers?.includes(t))
            .map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
        </select>
        <div className="selected-items">
          {config.tokenizers?.map((t) => (
            <span key={t} className="tag">
              {t}
              <button onClick={() => handleRemoveTokenizer(t)}>✕</button>
            </span>
          ))}
        </div>
      </div>

      <div className="config-section">
        <label>Metrics:</label>
        <select
          onChange={(e) => {
            if (e.target.value && !config.metrics?.includes(e.target.value)) {
              handleAddMetric(e.target.value);
            }
            e.target.value = '';
          }}
        >
          <option value="">Select metric...</option>
          {availableMetrics
            .filter((m) => !config.metrics?.includes(m))
            .map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
        </select>
        <div className="selected-items">
          {config.metrics?.map((m) => (
            <span key={m} className="tag">
              {m}
              <button onClick={() => handleRemoveMetric(m)}>✕</button>
            </span>
          ))}
        </div>
      </div>

      <div className="config-section">
        <label>Languages:</label>
        <select
          onChange={(e) => {
            if (e.target.value && !config.languages?.includes(e.target.value)) {
              handleAddLanguage(e.target.value);
            }
            e.target.value = '';
          }}
        >
          <option value="">Select language...</option>
          {availableLanguages
            .filter((l) => !config.languages?.includes(l))
            .map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
        </select>
        <div className="selected-items">
          {config.languages?.map((l) => (
            <span key={l} className="tag">
              {l}
              <button onClick={() => handleRemoveLanguage(l)}>✕</button>
            </span>
          ))}
        </div>
      </div>

      <button className="generate-btn" onClick={handleGenerateGraph}>
        Generate Graph
      </button>
    </div>
  );
};

export default GraphConfigurator;
