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

  const handleTokenizerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, (option) => option.value);
    setConfig((prev) => ({
      ...prev,
      tokenizers: selectedOptions,
    }));
  };

  const handleMetricChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, (option) => option.value);
    setConfig((prev) => ({
      ...prev,
      metrics: selectedOptions,
    }));
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, (option) => option.value);
    setConfig((prev) => ({
      ...prev,
      languages: selectedOptions,
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
          multiple
          value={config.tokenizers || []}
          onChange={handleTokenizerChange}
          className="multi-select"
        >
          {availableTokenizers.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div className="selected-count">
          {config.tokenizers?.length || 0} selected
        </div>
      </div>

      <div className="config-section">
        <label>Metrics:</label>
        <select
          multiple
          value={config.metrics || []}
          onChange={handleMetricChange}
          className="multi-select"
        >
          {availableMetrics.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <div className="selected-count">
          {config.metrics?.length || 0} selected
        </div>
      </div>

      <div className="config-section">
        <label>Languages:</label>
        <select
          multiple
          value={config.languages || []}
          onChange={handleLanguageChange}
          className="multi-select"
        >
          {availableLanguages.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <div className="selected-count">
          {config.languages?.length || 0} selected
        </div>
      </div>

      <button className="generate-btn" onClick={handleGenerateGraph}>
        Generate Graph
      </button>
    </div>
  );
};

export default GraphConfigurator;
