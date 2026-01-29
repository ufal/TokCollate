import React, { useState } from 'react';
import { FigureConfig, MetricDimensionality } from '../types';
import { getAvailableGraphTypes, getGraphType } from '../utils/graphTypes';
import './GraphConfigurator.css';

interface GraphConfiguratorProps {
  onAddFigure: (config: FigureConfig) => void;
  availableTokenizers: string[];
  availableMetrics: string[];
  availableLanguages: string[];
  metricDimensionality?: MetricDimensionality;
}

const GraphConfigurator: React.FC<GraphConfiguratorProps> = ({
  onAddFigure,
  availableTokenizers,
  availableMetrics,
  availableLanguages,
  metricDimensionality = {},
}) => {
  const graphTypes = getAvailableGraphTypes();
  const [config, setConfig] = useState<Partial<FigureConfig>>({
    typeId: '',
    title: 'New Figure',
    tokenizers: [],
    languages: [],
    metrics: [],
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const currentGraphType = getGraphType(config.typeId || 'metric-pair-correlation');

  // Re-validate whenever available options change (e.g., new data loaded)
  React.useEffect(() => {
    console.log('[GraphConfigurator] Available options changed:', {
      tokenizers: availableTokenizers.length,
      metrics: availableMetrics.length,
      languages: availableLanguages.length,
    });
    validateConfig(config);
  }, [availableTokenizers, availableMetrics, availableLanguages]);

  const handleGraphTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setConfig((prev) => ({
      ...prev,
      typeId: e.target.value,
      tokenizers: [],
      languages: [],
      metrics: [],
    }));
    setValidationErrors([]);
  };

  const handleTokenizerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, (option) => option.value);
    const newConfig = {
      ...config,
      tokenizers: selectedOptions,
    };
    setConfig(newConfig);
    validateConfig(newConfig);
  };

  // For metric pair correlation: separate X and Y axis selectors
  const handleMetricXChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const metricX = e.target.value;
    const metrics = [metricX, config.metrics?.[1] || ''].filter(Boolean);
    const newConfig = { ...config, metrics };
    setConfig(newConfig);
    validateConfig(newConfig);
  };
  const handleMetricYChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const metricY = e.target.value;
    const metrics = [config.metrics?.[0] || '', metricY].filter(Boolean);
    const newConfig = { ...config, metrics };
    setConfig(newConfig);
    validateConfig(newConfig);
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, (option) => option.value);
    const newConfig = {
      ...config,
      languages: selectedOptions,
    };
    setConfig(newConfig);
    validateConfig(newConfig);
  };

  const handleMetricChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, (option) => option.value);
    const newConfig = {
      ...config,
      metrics: selectedOptions,
    };
    setConfig(newConfig);
    validateConfig(newConfig);
  };

  const validateConfig = React.useCallback((cfg: Partial<FigureConfig>) => {
    const gt = getGraphType(cfg.typeId || 'bar-ranking-correlation');
    if (!gt) return;

    const validation = gt.validate({
      metrics: cfg.metrics || [],
      tokenizers: cfg.tokenizers || [],
      languages: cfg.languages || [],
    }, metricDimensionality);

    setValidationErrors(validation.errors);
  }, [metricDimensionality]);

  const handleGenerateGraph = () => {
    if (!currentGraphType) {
      alert('Please select a graph type.');
      return;
    }

    console.log('Generate graph clicked with config:', {
      metrics: config.metrics,
      tokenizers: config.tokenizers,
      languages: config.languages,
    });

    const validation = currentGraphType.validate({
      metrics: config.metrics || [],
      tokenizers: config.tokenizers || [],
      languages: config.languages || [],
    }, metricDimensionality);

    console.log('Validation result:', validation);

    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    const newFigure: FigureConfig = {
      id: `graph-${Date.now()}`,
      typeId: config.typeId || 'bar-ranking-correlation',
      title: config.title || 'New Figure',
      tokenizers: config.tokenizers || [],
      languages: config.languages || [],
      metrics: config.metrics || [],
      filters: {},
    };

    console.log('Adding figure:', newFigure);

    onAddFigure(newFigure);

    // Reset form
    setConfig({
      typeId: 'bar-ranking-correlation',
      title: 'New Figure',
      tokenizers: [],
      languages: [],
      metrics: [],
    });
    setValidationErrors([]);
  };

  const getConstraintLabel = (label: string, min: number, max: number): string => {
    if (min === max) {
      return `${label} (${min})`;
    }
    return `${label} (${min}-${max})`;
  };

  /**
   * Filter metrics based on the current graph type's dimension requirements
   */
  const getFilteredMetrics = (): string[] => {
    if (!currentGraphType?.constraints.metrics.dimension || currentGraphType.constraints.metrics.dimension === 'both') {
      return availableMetrics;
    }

    const requiredDimension = currentGraphType.constraints.metrics.dimension;
    return availableMetrics.filter(m => metricDimensionality[m] === requiredDimension);
  };

  const getMetricDimensionLabel = (metric: string): string => {
    const dim = metricDimensionality[metric];
    if (dim === 1) return ' (1D)';
    if (dim === 2) return ' (2D)';
    return '';
  };

  const handleGenerateGraphClick = () => {
    console.log('Graph generation clicked');
    console.log('Current selections:', {
      typeId: config.typeId,
      title: config.title,
      metrics: config.metrics,
      tokenizers: config.tokenizers,
      languages: config.languages,
      availableMetrics: availableMetrics.length,
      availableTokenizers: availableTokenizers.length,
      availableLanguages: availableLanguages.length,
    });
    handleGenerateGraph();
  };

  return (
    <div className="graph-configurator">
      <h2>Figure Configuration</h2>

      {availableMetrics.length === 0 && (
        <div className="info-message">
          ⓘ No data loaded yet. Click <strong>Import Data</strong> to load a visualization file.
        </div>
      )}

      <div className="config-section">
        <label>Figure Type:</label>
        <select value={config.typeId || ''} onChange={handleGraphTypeChange}>
          <option value="">-- Select Figure Type --</option>
          {graphTypes.map((gt) => (
            <option key={gt.typeId} value={gt.typeId}>
              {gt.displayName}
            </option>
          ))}
        </select>
        {currentGraphType && (
          <div className="graph-type-help">
            {currentGraphType.description}
          </div>
        )}
      </div>

      {config.typeId && currentGraphType && (
        <>
          <div className="config-section">
            <label>Graph Title:</label>
            <input
              type="text"
              value={config.title || ''}
              onChange={(e) => setConfig((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Enter graph title"
            />
          </div>

          {config.typeId === 'metric-table' && (
            <div className="config-section">
              <label>
                {getConstraintLabel(
                  'Metric',
                  currentGraphType.constraints.metrics.min,
                  currentGraphType.constraints.metrics.max
                )}
              </label>
              <select
                value={config.metrics?.[0] || ''}
                onChange={(e) => {
                  const newConfig = { ...config, metrics: e.target.value ? [e.target.value] : [] };
                  setConfig(newConfig);
                  validateConfig(newConfig);
                }}
                className="single-select"
                disabled={getFilteredMetrics().length === 0}
              >
                <option value="">Select metric</option>
                {getFilteredMetrics().map((m) => (
                  <option key={m} value={m}>
                    {m}{getMetricDimensionLabel(m)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="config-section">
            <label>
              {getConstraintLabel(
                'Tokenizers',
                currentGraphType.constraints.tokenizers.min,
                currentGraphType.constraints.tokenizers.max
              )}
            </label>
            <select
              multiple
              value={config.tokenizers || []}
              onChange={handleTokenizerChange}
              className="multi-select"
              disabled={availableTokenizers.length === 0}
            >
              {availableTokenizers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <div className="selected-count">
              {config.tokenizers?.length || 0} / {availableTokenizers.length} selected
            </div>
          </div>

          {config.typeId === 'metric-pair-correlation' ? (
            <div className="config-section">
              <label>Metric X (X-axis):</label>
              <select
                value={config.metrics?.[0] || ''}
                onChange={handleMetricXChange}
                className="single-select"
                disabled={getFilteredMetrics().length === 0}
              >
                <option value="">Select metric</option>
                {getFilteredMetrics().map((m) => (
                  <option key={m} value={m}>
                    {m}{getMetricDimensionLabel(m)}
                  </option>
                ))}
              </select>
              <label>Metric Y (Y-axis):</label>
              <select
                value={config.metrics?.[1] || ''}
                onChange={handleMetricYChange}
                className="single-select"
                disabled={getFilteredMetrics().length === 0}
              >
                <option value="">Select metric</option>
                {getFilteredMetrics().map((m) => (
                  <option key={m} value={m}>
                    {m}{getMetricDimensionLabel(m)}
                  </option>
                ))}
              </select>
            </div>
          ) : config.typeId !== 'metric-table' && (
            <div className="config-section">
              <label>
                {getConstraintLabel(
                  'Metrics',
                  currentGraphType.constraints.metrics.min,
                  currentGraphType.constraints.metrics.max
                )}
                {currentGraphType.constraints.metrics.dimension && currentGraphType.constraints.metrics.dimension !== 'both' && (
                  <span className="dimension-constraint">
                    {` (requires ${currentGraphType.constraints.metrics.dimension}D metrics)`}
                  </span>
                )}
              </label>
              <select
                multiple
                value={config.metrics || []}
                onChange={handleMetricChange}
                className="multi-select"
                disabled={getFilteredMetrics().length === 0}
              >
                {getFilteredMetrics().map((m) => (
                  <option key={m} value={m}>
                    {m}{getMetricDimensionLabel(m)}
                  </option>
                ))}
              </select>
              <div className="selected-count">
                {config.metrics?.length || 0} / {getFilteredMetrics().length} available selected
              </div>
              {availableMetrics.length > getFilteredMetrics().length && (
                <div className="info-message">
                  ⓘ Some metrics are hidden because this graph type requires {currentGraphType.constraints.metrics.dimension}D metrics.
                </div>
              )}
            </div>
          )}

          <div className="config-section">
            <label>
              {getConstraintLabel(
                'Languages',
                currentGraphType.constraints.languages.min,
                currentGraphType.constraints.languages.max
              )}
            </label>
            <select
              multiple
              value={config.languages || []}
              onChange={handleLanguageChange}
              className="multi-select"
              disabled={availableLanguages.length === 0}
            >
              {availableLanguages.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <div className="selected-count">
              {config.languages?.length || 0} / {availableLanguages.length} selected
            </div>
          </div>

          {validationErrors.length > 0 && (
            <div className="validation-errors">
              <strong>Configuration Issues:</strong>
              <ul>
                {validationErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            className="generate-btn"
            onClick={handleGenerateGraphClick}
            disabled={validationErrors.length > 0}
          >
            Generate Figure
          </button>
        </>
      )}
    </div>
  );
};

export default GraphConfigurator;

