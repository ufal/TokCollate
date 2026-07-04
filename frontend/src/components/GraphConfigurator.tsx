import React, { useState } from 'react';
import { FigureConfig, MetricDimensionality } from '../types';
import { getAvailableGraphTypes, getGraphType } from '../utils/graphTypes';
import { buildLanguageLabelMap, getDisplayLanguageLabel } from '../utils/languageLabels';
import { useLanguageFilters, lookupLanguageInfo } from '../utils/useLanguageFilters';
import './GraphConfigurator.css';

/** Check whether two string arrays contain the same set of values. */
function arraysEqualSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  for (const v of a) if (!sb.has(v)) return false;
  return true;
}

/** Select up to `desiredMax` items while respecting graph-type min/max constraints. */
function computeDefaultSelection(
  items: string[],
  minAllowed: number | undefined,
  maxAllowed: number | undefined,
): string[] {
  if (!items || items.length === 0) return [];

  const desiredMax = 2;
  const minConstraint = minAllowed ?? 0;
  const maxConstraint = maxAllowed ?? Infinity;

  let limit = Math.min(desiredMax, items.length);
  if (limit < minConstraint) {
    limit = Math.min(minConstraint, items.length);
  }
  if (Number.isFinite(maxConstraint)) {
    limit = Math.min(limit, maxConstraint);
  }

  return items.slice(0, Math.max(0, limit));
}

/** Format a constraint range label, e.g. "Tokenizers (1-3)" or "Metrics (2)". */
function getConstraintLabel(label: string, min: number, max: number): string {
  if (min === max) return `${label} (${min})`;
  return `${label} (${min}-${max})`;
}

interface GraphConfiguratorProps {
  onUpdateFigure: (config: FigureConfig) => void;
  availableTokenizers: string[];
  availableMetrics: string[];
  availableLanguages: string[];
  metricDimensionality?: MetricDimensionality;
  languagesInfo?: Record<string, any>;
}

const GraphConfigurator: React.FC<GraphConfiguratorProps> = ({
  onUpdateFigure,
  availableTokenizers,
  availableMetrics,
  availableLanguages,
  metricDimensionality = {},
  languagesInfo = {},
}) => {
  const graphTypes = getAvailableGraphTypes();
  const [config, setConfig] = useState<Partial<FigureConfig>>({
    typeId: '',
    tokenizers: [],
    languages: [],
    metrics: [],
    trendlineMode: 'none',
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Sentence range state (for tokenized-text type)
  const [sentenceRangeFrom, setSentenceRangeFrom] = useState<string>('1');
  const [sentenceRangeTo, setSentenceRangeTo] = useState<string>('10');

  const {
    filters: langFilters,
    setFilter: setLangFilter,
    clearFilters: clearLanguageFilters,
    allContinents,
    allFamilies,
    allFineweb2Keys,
    allGlottocodes,
    allMorphology,
    allTiers,
    languageMatchesFilters,
    matchingLanguages,
    isAnyFilterActive,
  } = useLanguageFilters(availableLanguages, languagesInfo);

  const languageLabelMap = React.useMemo(
    () => buildLanguageLabelMap(availableLanguages),
    [availableLanguages],
  );

  const getLanguageDisplayName = React.useCallback((label: string): string | null => {
    try {
      const parts = label.split('_');
      const base = parts.length >= 3 ? parts.slice(0, parts.length - 2).join('_') : label;
      const info = lookupLanguageInfo(base, languagesInfo) || {};
      const name = info.Name || info.name;
      return name ? String(name) : null;
    } catch {
      return null;
    }
  }, [languagesInfo]);

  const buildLanguageTooltip = React.useCallback((label: string): string => {
    try {
      const parts = label.split('_');
      const base = parts.length >= 3 ? parts.slice(0, parts.length - 2).join('_') : label;
      const info = lookupLanguageInfo(base, languagesInfo) || {};

      const toList = (val: any): string => {
        if (!val) return '';
        if (Array.isArray(val)) return val.join(', ');
        if (typeof val === 'object') return Object.keys(val).join(', ');
        return String(val);
      };

      const rows: string[] = [];
      const displayName = info.Name || info.name || base;
      rows.push(`Language: ${displayName}`);
      if (info.continent) rows.push(`Continent: ${info.continent}`);
      const fam = toList(info.families);
      if (fam) rows.push(`Families: ${fam}`);
      const fw = toList(info.fineweb2);
      if (fw) rows.push(`Fineweb2: ${fw}`);
      const gc = toList(info.glottocodes);
      if (gc) rows.push(`Glottocodes: ${gc}`);
      const morph = toList(info.morphology);
      if (morph) rows.push(`Morphology: ${morph}`);
      if (info.tier !== undefined) rows.push(`Tier: ${String(info.tier)}`);
      if (info.speaker !== undefined) rows.push(`Speakers: ${String(info.speaker)}`);
      else if (info.speakers !== undefined) rows.push(`Speakers: ${String(info.speakers)}`);

      return rows.join('\n');
    } catch (e) {
      return label;
    }
  }, [languagesInfo]);

  // languageMatchesFilters, matchingLanguages, and isAnyFilterActive
  // are provided by useLanguageFilters above.

  // Auto-select matching languages when filters change (disabled when locked)
  React.useEffect(() => {
    if (!isAnyFilterActive || langFilters.locked) return;
    const current = config.languages || [];
    if (!arraysEqualSet(current, matchingLanguages)) {
      const newConfig = { ...config, languages: matchingLanguages };
      setConfig(newConfig);
      validateConfig(newConfig);
    }
  }, [matchingLanguages, langFilters.locked]);

  const currentGraphType = getGraphType(config.typeId || 'bar-ranking-correlation');

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
    const newTypeId = e.target.value;

    const gt = getGraphType(newTypeId);

    const filterMetricsForType = (typeId: string): string[] => {
      const t = getGraphType(typeId);
      return t?.getCompatibleMetrics(availableMetrics, metricDimensionality) ?? availableMetrics;
    };

    const filteredMetrics = filterMetricsForType(newTypeId);

    // Unified defaults for tokenizers and languages across all figure types.

    let defaultTokenizers: string[] = computeDefaultSelection(
      availableTokenizers,
      gt?.constraints.tokenizers.min,
      gt?.constraints.tokenizers.max,
    );
    let defaultLanguages: string[] = computeDefaultSelection(
      availableLanguages,
      gt?.constraints.languages.min,
      gt?.constraints.languages.max,
    );

    // Defaults for metrics depend on graph type and constraints
    let defaultMetrics: string[] = [];
    if (newTypeId === 'metric-pair-correlation-mono' || newTypeId === 'metric-pair-correlation-bi') {
      // Choose first for X, second for Y
      if (filteredMetrics.length >= 2) {
        defaultMetrics = [filteredMetrics[0], filteredMetrics[1]];
      } else if (filteredMetrics.length === 1) {
        defaultMetrics = [filteredMetrics[0]];
      } else {
        defaultMetrics = [];
      }
    } else if (newTypeId === 'tokenized-text') {
      // Tokenized Text uses tokenizer/language selections only.
      defaultMetrics = [];
    } else if (newTypeId === 'metric-table') {
      // Single metric: first compatible
      defaultMetrics = filteredMetrics.length > 0 ? [filteredMetrics[0]] : [];
    } else {
      // For other graph types, keep existing behavior: select as many
      // compatible metrics as allowed by the constraint.
      if (filteredMetrics.length === 0) {
        defaultMetrics = [];
      } else {
        const maxConstraint = gt?.constraints.metrics.max ?? Infinity;
        const limit = Number.isFinite(maxConstraint)
          ? Math.min(filteredMetrics.length, maxConstraint)
          : filteredMetrics.length;
        defaultMetrics = filteredMetrics.slice(0, Math.max(0, limit));
      }
    }

    const newConfig = {
      ...config,
      typeId: newTypeId,
      tokenizers: defaultTokenizers,
      languages: defaultLanguages,
      metrics: defaultMetrics,
      sentenceRange: newTypeId === 'tokenized-text'
        ? ([Number(sentenceRangeFrom) || 1, Number(sentenceRangeTo) || 10] as [number, number])
        : undefined,
    };

    setConfig(newConfig);
    setValidationErrors([]);
    validateConfig(newConfig);
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

  const handleSelectAllTokenizers = () => {
    const max = currentGraphType?.constraints.tokenizers.max;
    const limit = typeof max === 'number' && Number.isFinite(max)
      ? Math.min(availableTokenizers.length, max)
      : availableTokenizers.length;
    const newTokenizers = availableTokenizers.slice(0, Math.max(0, limit));
    const newConfig = {
      ...config,
      tokenizers: newTokenizers,
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

  const handleGroupByChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const groupBy = e.target.value as 'tokenizer' | 'language' | 'family';
    const newConfig = { ...config, groupBy };
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

    // If filters are active and manual selection deviates from matches, clear filters
    if (isAnyFilterActive && !langFilters.locked) {
      if (!arraysEqualSet(selectedOptions, matchingLanguages)) {
        clearLanguageFilters();
      }
    }

    validateConfig(newConfig);
  };

  const handleSelectAllLanguages = () => {
    const max = currentGraphType?.constraints.languages.max;
    const limit = typeof max === 'number' && Number.isFinite(max)
      ? Math.min(availableLanguages.length, max)
      : availableLanguages.length;
    const newLanguages = availableLanguages.slice(0, Math.max(0, limit));
    const newConfig = {
      ...config,
      languages: newLanguages,
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

    // Determine trendline mode, with backward compatibility for old boolean flag
    const rawTrendlineMode = (cfg as any).trendlineMode;
    let trendlineMode: 'none' | 'global' | 'groups' = 'none';
    if (rawTrendlineMode === 'global' || rawTrendlineMode === 'groups' || rawTrendlineMode === 'none') {
      trendlineMode = rawTrendlineMode;
    } else if ((cfg as any).showTrendline) {
      // Legacy configs with boolean showTrendline => treat as global trendline
      trendlineMode = 'global';
    }

    const newFigure: FigureConfig = {
      id: 'active-figure',
      typeId: cfg.typeId || 'bar-ranking-correlation',
      tokenizers: cfg.tokenizers || [],
      languages: cfg.languages || [],
      metrics: cfg.metrics || [],
      filters: {},
      groupBy: (cfg as any).groupBy || 'tokenizer',
      trendlineMode,
      // Keep boolean flag in sync for any legacy consumers
      showTrendline: trendlineMode !== 'none',
      sentenceRange: cfg.sentenceRange,
      axisTransforms: (cfg as any).axisTransforms,
    };

    // Always propagate the current configuration to the active figure.
    // When invalid, graph transformers typically return no data, which clears
    // any previously rendered datapoints while the "Configuration Issues"
    // panel explains what needs to be fixed.
    onUpdateFigure(newFigure);
  }, [metricDimensionality, onUpdateFigure]);

  // Live-update: no generate button; updates are emitted from validateConfig

  /** Metrics compatible with the current graph type, used to populate metric dropdowns. */
  const filteredMetrics = React.useMemo(
    () => currentGraphType?.getCompatibleMetrics(availableMetrics, metricDimensionality) ?? availableMetrics,
    [currentGraphType, availableMetrics, metricDimensionality],
  );

  /** Metrics excluded by the current graph type — shown as a count/hint in the UI. */
  const excludedMetrics = React.useMemo(() => {
    const compatibleSet = new Set(filteredMetrics);
    return availableMetrics.filter((m) => !compatibleSet.has(m));
  }, [filteredMetrics, availableMetrics]);

  const getMetricDimensionLabel = (metric: string): string => {
    const dim = metricDimensionality[metric];
    if (dim === 1) return ' (1D)';
    if (dim === 2) return ' (2D)';
    if (dim === 3) return ' (3D)';
    return '';
  };

  // Removed Generate Figure button handler

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

      {config.typeId && currentGraphType && (
        <>


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
                disabled={filteredMetrics.length === 0}
              >
                <option value="">Select metric</option>
                {filteredMetrics.map((m) => (
                  <option key={m} value={m}>
                    {m}{getMetricDimensionLabel(m)}
                  </option>
                ))}
              </select>
              <div className="selected-count">
                {filteredMetrics.length} compatible / {availableMetrics.length} total
              </div>
              {availableMetrics.length > filteredMetrics.length && (
                <div className="info-message">
                  ⓘ Some metrics are hidden because Metric Table requires matrix metrics (2D or 3D).
                  {excludedMetrics.length > 0 && (
                    <span> Excluded: {excludedMetrics.slice(0, 6).join(', ')}{excludedMetrics.length > 6 ? '…' : ''}</span>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="config-section">
            <div className="config-header-row">
              <label>
                {getConstraintLabel(
                  'Tokenizers',
                  currentGraphType.constraints.tokenizers.min,
                  currentGraphType.constraints.tokenizers.max
                )}
              </label>
              <button
                type="button"
                className="select-all-btn"
                onClick={handleSelectAllTokenizers}
                disabled={availableTokenizers.length === 0}
              >
                Select all
              </button>
            </div>
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

          {(config.typeId === 'metric-pair-correlation-mono' || config.typeId === 'metric-pair-correlation-bi') ? (
            <div className="config-section">
              <label>Metric X (X-axis):</label>
              <select
                value={config.metrics?.[0] || ''}
                onChange={handleMetricXChange}
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
                onChange={handleMetricYChange}
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
                <select value={config.groupBy || 'tokenizer'} onChange={handleGroupByChange} className="single-select">
                  <option value="tokenizer">Tokenizer</option>
                  {config.typeId === 'metric-pair-correlation-bi'
                    ? <option value="languagePair">Language Pair</option>
                    : <option value="language">Language</option>
                  }
                  <option value="family">Language family</option>
                </select>
              </div>
              <div style={{ marginTop: '8px' }}>
                <label>Trendline:</label>
                <select
                  value={(config as any).trendlineMode || ((config as any).showTrendline ? 'global' : 'none')}
                  onChange={(e) => {
                    const mode = e.target.value as 'none' | 'global' | 'groups';
                    const newConfig = { ...config, trendlineMode: mode };
                    setConfig(newConfig);
                    validateConfig(newConfig);
                  }}
                  className="single-select"
                >
                  <option value="none">None</option>
                  <option value="global">Global</option>
                  <option value="groups">Groups</option>
                </select>
              </div>
              {/* Axis transform controls */}
              {(['x', 'y'] as const).map((axis) => {
                const metricLabel = axis === 'x' ? 'X-axis' : 'Y-axis';
                const tx = (config as any).axisTransforms?.[axis] || {};
                const setTx = (patch: Record<string, any>) => {
                  const newConfig = {
                    ...config,
                    axisTransforms: {
                      ...((config as any).axisTransforms || {}),
                      [axis]: { ...tx, ...patch },
                    },
                  };
                  setConfig(newConfig);
                  validateConfig(newConfig);
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
          ) : config.typeId !== 'metric-table' && config.typeId !== 'tokenized-text' && (
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
                disabled={filteredMetrics.length === 0}
              >
                {filteredMetrics.map((m) => (
                  <option key={m} value={m}>
                    {m}{getMetricDimensionLabel(m)}
                  </option>
                ))}
              </select>
              <div className="selected-count">
                {config.metrics?.length || 0} / {filteredMetrics.length} available selected
              </div>
              {availableMetrics.length > filteredMetrics.length && (
                <div className="info-message">
                  ⓘ Some metrics are hidden because this graph type requires {currentGraphType.constraints.metrics.dimension}D metrics.
                </div>
              )}
            </div>
          )}

          <div className="config-section">
            <div className="config-header-row">
              <label>
                {getConstraintLabel(
                  'Languages',
                  currentGraphType.constraints.languages.min,
                  currentGraphType.constraints.languages.max
                )}
              </label>
              <button
                type="button"
                className="select-all-btn"
                onClick={handleSelectAllLanguages}
                disabled={availableLanguages.length === 0}
              >
                Select all
              </button>
            </div>
            <select
              multiple
              value={config.languages || []}
              onChange={handleLanguageChange}
              className="multi-select"
              disabled={availableLanguages.length === 0}
            >
              {availableLanguages.map((l) => {
                const match = languageMatchesFilters(l);
                const shortLabel = getDisplayLanguageLabel(l, languageLabelMap);
                const displayName = getLanguageDisplayName(l);
                const optionLabel = displayName ? `${shortLabel} [${displayName}]` : shortLabel;
                return (
                  <option key={l} value={l} title={buildLanguageTooltip(l)}>
                    {optionLabel}{match ? ' ✓' : ''}
                  </option>
                );
              })}
            </select>
            <div className="selected-count">
              {config.languages?.length || 0} selected / {availableLanguages.length} total · {matchingLanguages.length} match
            </div>
          </div>

          {/* Sentence Range section — only for tokenized-text */}
          {config.typeId === 'tokenized-text' && (
            <div className="config-section">
              <label>Sentence Range:</label>
              <div className="sentence-range-row">
                <span>From</span>
                <input
                  type="number"
                  min={1}
                  value={sentenceRangeFrom}
                  className="sentence-range-input"
                  onChange={(e) => {
                    setSentenceRangeFrom(e.target.value);
                    const from = Number(e.target.value) || 1;
                    const to = Number(sentenceRangeTo) || 10;
                    const newConfig = { ...config, sentenceRange: [from, to] as [number, number] };
                    setConfig(newConfig);
                    validateConfig(newConfig);
                  }}
                />
                <span>to</span>
                <input
                  type="number"
                  min={1}
                  value={sentenceRangeTo}
                  className="sentence-range-input"
                  onChange={(e) => {
                    setSentenceRangeTo(e.target.value);
                    const from = Number(sentenceRangeFrom) || 1;
                    const to = Number(e.target.value) || 10;
                    const newConfig = { ...config, sentenceRange: [from, to] as [number, number] };
                    setConfig(newConfig);
                    validateConfig(newConfig);
                  }}
                />
                <span className="sentence-range-hint">(1-based, inclusive)</span>
              </div>
            </div>
          )}

          {/* Language Filters section (moved after Languages selector) */}
          <div className="config-section">
            <div className="config-header-row">
              <label>Language Filters:</label>
              <button
                type="button"
                className="clear-filters-btn"
                onClick={clearLanguageFilters}
              >
                Clear filters
              </button>
            </div>
            <div className="filters-grid">
              <div>
                <span>Continent:</span>
                <select value={langFilters.continent} onChange={(e) => setLangFilter('continent', e.target.value)}>
                  <option value="">(any)</option>
                  {allContinents.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <span>Families:</span>
                <select multiple value={langFilters.families} onChange={(e) => setLangFilter('families', Array.from(e.target.selectedOptions).map(o => o.value))} className="multi-select">
                  {allFamilies.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div>
                <span>Fineweb2 keys:</span>
                <select multiple value={langFilters.fineweb2} onChange={(e) => setLangFilter('fineweb2', Array.from(e.target.selectedOptions).map(o => o.value))} className="multi-select">
                  {allFineweb2Keys.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <div>
                <span>Glottocodes:</span>
                <select multiple value={langFilters.glottocodes} onChange={(e) => setLangFilter('glottocodes', Array.from(e.target.selectedOptions).map(o => o.value))} className="multi-select">
                  {allGlottocodes.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <span>Morphology:</span>
                <select multiple value={langFilters.morphology} onChange={(e) => setLangFilter('morphology', Array.from(e.target.selectedOptions).map(o => o.value))} className="multi-select">
                  {allMorphology.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <span>Tier:</span>
                <select value={langFilters.tier} onChange={(e) => setLangFilter('tier', e.target.value)}>
                  <option value="">(any)</option>
                  {allTiers.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <span>Speakers:</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <select value={langFilters.speakerOp} onChange={(e) => setLangFilter('speakerOp', e.target.value as any)} style={{ width: '70px' }}>
                      <option value=">=">≥</option>
                      <option value="<=">≤</option>
                    </select>
                    <input type="number" inputMode="numeric" min="0" step="any" value={langFilters.speakerVal} onChange={(e) => setLangFilter('speakerVal', e.target.value)} placeholder="threshold" />
                </div>
              </div>
            </div>
            <div style={{ marginTop: '6px' }}>
              <label>
                <input type="checkbox" checked={langFilters.locked} onChange={(e) => setLangFilter('locked', e.target.checked)} />
                {' '}Lock filters (prevent auto-selection and auto-clearing)
              </label>
            </div>
            <div className="selected-count">
              {matchingLanguages.length} match / {availableLanguages.length} total
            </div>
          </div>
          {/* Generate Figure button removed; figure updates automatically */}
        </>
      )}
    </div>
  );
};

export default GraphConfigurator;

