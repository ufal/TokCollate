import React, { useState } from 'react';
import { FigureConfig, MetricDimensionality } from '../types';
import { getAvailableGraphTypes, getGraphType } from '../utils/graphTypes';
import { buildLanguageLabelMap, getDisplayLanguageLabel } from '../utils/languageLabels';
import './GraphConfigurator.css';

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

  // Language filter state
  const [continentFilter, setContinentFilter] = useState<string>('');
  const [familyFilter, setFamilyFilter] = useState<string[]>([]);
  const [fineweb2Filter, setFineweb2Filter] = useState<string[]>([]);
  const [glottocodeFilter, setGlottocodeFilter] = useState<string[]>([]);
  const [morphologyFilter, setMorphologyFilter] = useState<string[]>([]);
  const [tierFilter, setTierFilter] = useState<string>('');
  const [lockFilters, setLockFilters] = useState<boolean>(false);
  const [speakerOp, setSpeakerOp] = useState<'>=' | '<=' | ''>('>=');
  const [speakerVal, setSpeakerVal] = useState<string>('');

  // Derive filter option values from languagesInfo
  const getLanguageInfo = React.useCallback((lang: string) => {
    const root: any = languagesInfo || {};
    if (root.languages && root.languages[lang]) return root.languages[lang];
    return root[lang] || {};
  }, [languagesInfo]);

  const getCategoryList = React.useCallback((name: string, isArray: boolean): string[] => {
    const root: any = languagesInfo || {};
    const cat = root.categories ? root.categories[name] : undefined;
    if (Array.isArray(cat)) {
      return Array.from(new Set<string>(cat as string[])).sort();
    }
    if (cat && typeof cat === 'object') {
      return Object.keys(cat as Record<string, any>).sort();
    }
    const s = new Set<string>();
    const langs: string[] = root.languages && typeof root.languages === 'object'
      ? Object.keys(root.languages)
      : Object.keys(root);
    for (const lang of langs) {
      const info = getLanguageInfo(lang);
      const val = info?.[name];
      if (Array.isArray(val)) {
        for (const v of val) {
          if (typeof v === 'string' && v.trim()) s.add(v.trim());
          else if (typeof v === 'number') s.add(String(v));
          else if (typeof v === 'boolean') s.add(String(v));
        }
      } else if (val && typeof val === 'object') {
        for (const k of Object.keys(val)) s.add(String(k));
      } else if (typeof val === 'string' && val.trim()) {
        s.add(val.trim());
      } else if (typeof val === 'number') {
        s.add(String(val));
      } else if (typeof val === 'boolean') {
        s.add(String(val));
      }
    }
    return Array.from(s).sort();
  }, [languagesInfo, getLanguageInfo]);

  const allContinents = React.useMemo(() => getCategoryList('continent', false), [getCategoryList]);

  const allFamilies = React.useMemo(() => getCategoryList('families', true), [getCategoryList]);

  const allFineweb2Keys = React.useMemo((): string[] => {
    const root: any = languagesInfo || {};
    const fromCategories: string[] | null = root.categories && Array.isArray(root.categories.fineweb2) ? (root.categories.fineweb2 as string[]) : null;
    if (fromCategories) return Array.from(new Set<string>(fromCategories)).sort();
    const s = new Set<string>();
    const langs: string[] = root.languages && typeof root.languages === 'object'
      ? Object.keys(root.languages)
      : Object.keys(root);
    for (const lang of langs) {
      const fw = getLanguageInfo(lang)?.fineweb2;
      if (fw && typeof fw === 'object') {
        for (const k of Object.keys(fw)) s.add(String(k));
      } else if (Array.isArray(fw)) {
        for (const k of fw) s.add(String(k));
      } else if (typeof fw === 'string') {
        s.add(fw);
      }
    }
    return Array.from(s).sort();
  }, [languagesInfo, getLanguageInfo]);

  const allGlottocodes = React.useMemo(() => getCategoryList('glottocodes', true), [getCategoryList]);

  const allMorphology = React.useMemo(() => getCategoryList('morphology', true), [getCategoryList]);

  const allTiers = React.useMemo(() => getCategoryList('tier', false), [getCategoryList]);

  const languageLabelMap = React.useMemo(
    () => buildLanguageLabelMap(availableLanguages),
    [availableLanguages],
  );

  const getLanguageDisplayName = React.useCallback((label: string): string | null => {
    try {
      const parts = label.split('_');
      const base = parts.length >= 3 ? parts.slice(0, parts.length - 2).join('_') : label;
      const info = getLanguageInfo(base) || {};
      const name = info.Name || info.name;
      return name ? String(name) : null;
    } catch {
      return null;
    }
  }, [getLanguageInfo]);

  const buildLanguageTooltip = React.useCallback((label: string): string => {
    try {
      const parts = label.split('_');
      const base = parts.length >= 3 ? parts.slice(0, parts.length - 2).join('_') : label;
      const info = getLanguageInfo(base) || {};

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
  }, [getLanguageInfo]);

  const languageMatchesFilters = (lang: string): boolean => {
    const parseLabel = (label: string): { base: string; finewebKey?: string; glottocode?: string } => {
      const parts = label.split('_');
      if (parts.length >= 3) {
        const glottocode = parts[parts.length - 1];
        const finewebKey = parts[parts.length - 2];
        const base = parts.slice(0, parts.length - 2).join('_');
        return { base, finewebKey, glottocode };
      }
      return { base: label };
    };

    const { base, finewebKey, glottocode } = parseLabel(lang);

    const resolveInfo = (): any => {
      const direct = getLanguageInfo(base);
      if (direct && Object.keys(direct).length > 0) return direct;
      if (glottocode) {
        const root: any = languagesInfo || {};
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
      return direct || {};
    };

    const info = resolveInfo();
    // continent
    if (continentFilter && info?.continent !== continentFilter) return false;
    // families
    if (familyFilter.length > 0) {
      const fam = info?.families;
      let arr: string[] = [];
      if (Array.isArray(fam)) arr = fam;
      else if (fam && typeof fam === 'object') arr = Object.keys(fam);
      else if (typeof fam === 'string') arr = [fam];
      const set = new Set(arr);
      if (!familyFilter.some((f) => set.has(f))) return false;
    }
    // fineweb2
    if (fineweb2Filter.length > 0) {
      if (finewebKey) {
        if (!fineweb2Filter.includes(finewebKey)) return false;
      } else {
        const fw = info?.fineweb2;
        const keys = fw && typeof fw === 'object' ? Object.keys(fw) : (Array.isArray(fw) ? fw : (typeof fw === 'string' ? [fw] : []));
        const set = new Set(keys);
        if (!fineweb2Filter.some((k) => set.has(k))) return false;
      }
    }
    // glottocodes
    if (glottocodeFilter.length > 0) {
      if (glottocode) {
        if (!glottocodeFilter.includes(glottocode)) return false;
      } else {
        const gc = info?.glottocodes;
        let arr: string[] = [];
        if (Array.isArray(gc)) arr = gc;
        else if (gc && typeof gc === 'object') arr = Object.keys(gc);
        else if (typeof gc === 'string') arr = [gc];
        const set = new Set(arr);
        if (!glottocodeFilter.some((g) => set.has(g))) return false;
      }
    }
    // morphology
    if (morphologyFilter.length > 0) {
      const m = info?.morphology;
      let arr: string[] = [];
      if (Array.isArray(m)) arr = m;
      else if (m && typeof m === 'object') arr = Object.keys(m);
      else if (typeof m === 'string') arr = [m];
      const set = new Set(arr);
      if (!morphologyFilter.some((v) => set.has(v))) return false;
    }
    // tier
    if (tierFilter) {
      const t = info?.tier;
      const tv = typeof t === 'number' || typeof t === 'boolean' ? String(t) : (typeof t === 'string' ? t : '');
      if (tv !== tierFilter) return false;
    }
    // speaker threshold
    const hasSpeakerFilter = speakerOp !== '' && speakerVal.trim() !== '';
    if (hasSpeakerFilter) {
      const raw = info?.speaker !== undefined ? info.speaker : info?.speakers;
      let n: number | null = null;
      if (typeof raw === 'number') n = raw;
      else if (typeof raw === 'string') {
        const parsed = parseFloat(raw.replace(/[,\s]/g, ''));
        if (!Number.isNaN(parsed)) n = parsed; else n = null;
      }
      const thr = parseFloat(speakerVal);
      if (n === null || Number.isNaN(thr)) return false;
      if (speakerOp === '>=') {
        if (!(n >= thr)) return false;
      } else if (speakerOp === '<=') {
        if (!(n <= thr)) return false;
      }
    }
    return true;
  };

  // Auto-select matching languages when filters are active (disabled when locked)
  React.useEffect(() => {
    const anyFilterActive = Boolean(continentFilter) || familyFilter.length > 0 || fineweb2Filter.length > 0 || glottocodeFilter.length > 0 || morphologyFilter.length > 0 || Boolean(tierFilter) || (speakerOp !== '' && speakerVal.trim() !== '');
    if (!anyFilterActive || lockFilters) return;
    const matches = availableLanguages.filter(languageMatchesFilters);
    const current = config.languages || [];
    const arraysEqualSet = (a: string[], b: string[]): boolean => {
      if (a.length !== b.length) return false;
      const sb = new Set(b);
      for (const v of a) if (!sb.has(v)) return false;
      return true;
    };
    const isSameSet = arraysEqualSet(current, matches);
    if (!isSameSet) {
      const newConfig = { ...config, languages: matches };
      setConfig(newConfig);
      validateConfig(newConfig);
    }
  }, [continentFilter, familyFilter, fineweb2Filter, glottocodeFilter, morphologyFilter, tierFilter, speakerOp, speakerVal, availableLanguages, lockFilters]);

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
      if (!t) return availableMetrics;
      if (t.typeId === 'metric-table') {
        return availableMetrics.filter((m) => metricDimensionality[m] === 2 || metricDimensionality[m] === 3);
      }
      const dim = t.constraints.metrics.dimension;
      if (!dim || dim === 'both') return availableMetrics;
      return availableMetrics.filter((m) => metricDimensionality[m] === dim);
    };

    const filteredMetrics = filterMetricsForType(newTypeId);

    // Unified defaults for tokenizers and languages across all figure types:
    // select only 1	62 items by default (subject to each graph type's
    // min/max constraints) instead of all or many.
    const computeDefaultSelection = (
      items: string[],
      minAllowed: number | undefined,
      maxAllowed: number | undefined,
    ): string[] => {
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
    };

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
    if (newTypeId === 'metric-pair-correlation') {
      // Choose first for X, second for Y
      if (filteredMetrics.length >= 2) {
        defaultMetrics = [filteredMetrics[0], filteredMetrics[1]];
      } else if (filteredMetrics.length === 1) {
        defaultMetrics = [filteredMetrics[0]];
      } else {
        defaultMetrics = [];
      }
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
    const anyFilterActive = Boolean(continentFilter) || familyFilter.length > 0 || fineweb2Filter.length > 0 || glottocodeFilter.length > 0 || morphologyFilter.length > 0 || Boolean(tierFilter) || (speakerOp !== '' && speakerVal.trim() !== '');
    if (anyFilterActive && !lockFilters) {
      const matches = availableLanguages.filter(languageMatchesFilters);
      const arraysEqualSet = (a: string[], b: string[]): boolean => {
        if (a.length !== b.length) return false;
        const sb = new Set(b);
        for (const v of a) if (!sb.has(v)) return false;
        return true;
      };
      const isSameSet = arraysEqualSet(selectedOptions, matches);
      if (!isSameSet) {
        setContinentFilter('');
        setFamilyFilter([]);
        setFineweb2Filter([]);
        setGlottocodeFilter([]);
        setMorphologyFilter([]);
        setTierFilter('');
        setSpeakerOp('>=');
        setSpeakerVal('');
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

  const handleClearLanguageFilters = () => {
    setContinentFilter('');
    setFamilyFilter([]);
    setFineweb2Filter([]);
    setGlottocodeFilter([]);
    setMorphologyFilter([]);
    setTierFilter('');
    setSpeakerOp('>=');
    setSpeakerVal('');
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
    };

    // Always propagate the current configuration to the active figure.
    // When invalid, graph transformers typically return no data, which clears
    // any previously rendered datapoints while the "Configuration Issues"
    // panel explains what needs to be fixed.
    onUpdateFigure(newFigure);
  }, [metricDimensionality, onUpdateFigure]);

  // Live-update: no generate button; updates are emitted from validateConfig

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
    // Special-case Metric Table: allow only 2D or 3D metrics
    if (currentGraphType?.typeId === 'metric-table') {
      return availableMetrics.filter((m) => metricDimensionality[m] === 2 || metricDimensionality[m] === 3);
    }
    if (!currentGraphType?.constraints.metrics.dimension || currentGraphType.constraints.metrics.dimension === 'both') {
      return availableMetrics;
    }
    const requiredDimension = currentGraphType.constraints.metrics.dimension;
    return availableMetrics.filter((m) => metricDimensionality[m] === requiredDimension);
  };

  const getExcludedMetrics = (): string[] => {
    // For Metric Table, excluded metrics are 1D
    if (currentGraphType?.typeId === 'metric-table') {
      return availableMetrics.filter((m) => metricDimensionality[m] === 1);
    }
    if (!currentGraphType?.constraints.metrics.dimension || currentGraphType.constraints.metrics.dimension === 'both') {
      return [];
    }
    const requiredDimension = currentGraphType.constraints.metrics.dimension;
    return availableMetrics.filter((m) => metricDimensionality[m] !== requiredDimension);
  };

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
                disabled={getFilteredMetrics().length === 0}
              >
                <option value="">Select metric</option>
                {getFilteredMetrics().map((m) => (
                  <option key={m} value={m}>
                    {m}{getMetricDimensionLabel(m)}
                  </option>
                ))}
              </select>
              <div className="selected-count">
                {getFilteredMetrics().length} compatible / {availableMetrics.length} total
              </div>
              {availableMetrics.length > getFilteredMetrics().length && (
                <div className="info-message">
                  ⓘ Some metrics are hidden because Metric Table requires matrix metrics (2D or 3D).
                  {getExcludedMetrics().length > 0 && (
                    <span> Excluded: {getExcludedMetrics().slice(0, 6).join(', ')}{getExcludedMetrics().length > 6 ? '…' : ''}</span>
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
              <div style={{ marginTop: '8px' }}>
                <label>Color by:</label>
                <select value={config.groupBy || 'tokenizer'} onChange={handleGroupByChange} className="single-select">
                  <option value="tokenizer">Tokenizer</option>
                  <option value="language">Language</option>
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
              {config.languages?.length || 0} selected / {availableLanguages.length} total · {availableLanguages.filter(languageMatchesFilters).length} match
            </div>
          </div>

          {/* Language Filters section (moved after Languages selector) */}
          <div className="config-section">
            <div className="config-header-row">
              <label>Language Filters:</label>
              <button
                type="button"
                className="clear-filters-btn"
                onClick={handleClearLanguageFilters}
              >
                Clear filters
              </button>
            </div>
            <div className="filters-grid">
              <div>
                <span>Continent:</span>
                <select value={continentFilter} onChange={(e) => setContinentFilter(e.target.value)}>
                  <option value="">(any)</option>
                  {allContinents.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <span>Families:</span>
                <select multiple value={familyFilter} onChange={(e) => setFamilyFilter(Array.from(e.target.selectedOptions).map(o => o.value))} className="multi-select">
                  {allFamilies.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div>
                <span>Fineweb2 keys:</span>
                <select multiple value={fineweb2Filter} onChange={(e) => setFineweb2Filter(Array.from(e.target.selectedOptions).map(o => o.value))} className="multi-select">
                  {allFineweb2Keys.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <div>
                <span>Glottocodes:</span>
                <select multiple value={glottocodeFilter} onChange={(e) => setGlottocodeFilter(Array.from(e.target.selectedOptions).map(o => o.value))} className="multi-select">
                  {allGlottocodes.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <span>Morphology:</span>
                <select multiple value={morphologyFilter} onChange={(e) => setMorphologyFilter(Array.from(e.target.selectedOptions).map(o => o.value))} className="multi-select">
                  {allMorphology.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <span>Tier:</span>
                <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
                  <option value="">(any)</option>
                  {allTiers.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <span>Speakers:</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <select value={speakerOp} onChange={(e) => setSpeakerOp(e.target.value as any)} style={{ width: '70px' }}>
                    <option value=">=">≥</option>
                    <option value="<=">≤</option>
                  </select>
                  <input type="number" inputMode="numeric" min="0" step="any" value={speakerVal} onChange={(e) => setSpeakerVal(e.target.value)} placeholder="threshold" />
                </div>
              </div>
            </div>
            <div style={{ marginTop: '6px' }}>
              <label>
                <input type="checkbox" checked={lockFilters} onChange={(e) => setLockFilters(e.target.checked)} />
                {' '}Lock filters (prevent auto-selection and auto-clearing)
              </label>
            </div>
            <div className="selected-count">
              {availableLanguages.filter(languageMatchesFilters).length} match / {availableLanguages.length} total
            </div>
          </div>
          {/* Generate Figure button removed; figure updates automatically */}
        </>
      )}
    </div>
  );
};

export default GraphConfigurator;

