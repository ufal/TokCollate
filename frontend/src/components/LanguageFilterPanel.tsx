import React from 'react';
import { LanguageFilters } from '../utils/useLanguageFilters';

export interface LanguageFilterPanelProps {
  filters: LanguageFilters;
  setFilter: <K extends keyof LanguageFilters>(key: K, value: LanguageFilters[K]) => void;
  clearFilters: () => void;
  allContinents: string[];
  allFamilies: string[];
  allFineweb2Keys: string[];
  allGlottocodes: string[];
  allMorphology: string[];
  allTiers: string[];
  matchingLanguages: string[];
  availableLanguages: string[];
}

const LanguageFilterPanel: React.FC<LanguageFilterPanelProps> = ({
  filters,
  setFilter,
  clearFilters,
  allContinents,
  allFamilies,
  allFineweb2Keys,
  allGlottocodes,
  allMorphology,
  allTiers,
  matchingLanguages,
  availableLanguages,
}) => {
  return (
    <div className="config-section">
      <div className="config-header-row">
        <label>Language Filters:</label>
        <button type="button" className="clear-filters-btn" onClick={clearFilters}>
          Clear filters
        </button>
      </div>
      <div className="filters-grid">
        <div>
          <span>Continent:</span>
          <select value={filters.continent} onChange={(e) => setFilter('continent', e.target.value)}>
            <option value="">(any)</option>
            {allContinents.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <span>Families:</span>
          <select
            multiple
            value={filters.families}
            onChange={(e) => setFilter('families', Array.from(e.target.selectedOptions).map(o => o.value))}
            className="multi-select"
          >
            {allFamilies.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <span>Fineweb2 keys:</span>
          <select
            multiple
            value={filters.fineweb2}
            onChange={(e) => setFilter('fineweb2', Array.from(e.target.selectedOptions).map(o => o.value))}
            className="multi-select"
          >
            {allFineweb2Keys.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        <div>
          <span>Glottocodes:</span>
          <select
            multiple
            value={filters.glottocodes}
            onChange={(e) => setFilter('glottocodes', Array.from(e.target.selectedOptions).map(o => o.value))}
            className="multi-select"
          >
            {allGlottocodes.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div>
          <span>Morphology:</span>
          <select
            multiple
            value={filters.morphology}
            onChange={(e) => setFilter('morphology', Array.from(e.target.selectedOptions).map(o => o.value))}
            className="multi-select"
          >
            {allMorphology.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <span>Tier:</span>
          <select value={filters.tier} onChange={(e) => setFilter('tier', e.target.value)}>
            <option value="">(any)</option>
            {allTiers.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <span>Speakers:</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <select
              value={filters.speakerOp}
              onChange={(e) => setFilter('speakerOp', e.target.value as LanguageFilters['speakerOp'])}
              style={{ width: '70px' }}
            >
              <option value=">=">≥</option>
              <option value="<=">≤</option>
            </select>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="any"
              value={filters.speakerVal}
              onChange={(e) => setFilter('speakerVal', e.target.value)}
              placeholder="threshold"
            />
          </div>
        </div>
      </div>
      <div style={{ marginTop: '6px' }}>
        <label>
          <input
            type="checkbox"
            checked={filters.locked}
            onChange={(e) => setFilter('locked', e.target.checked)}
          />
          {' '}Lock filters (prevent auto-selection and auto-clearing)
        </label>
      </div>
      <div className="selected-count">
        {matchingLanguages.length} match / {availableLanguages.length} total
      </div>
    </div>
  );
};

export default LanguageFilterPanel;
