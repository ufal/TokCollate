import React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LanguageFilters {
  continent: string;
  families: string[];
  fineweb2: string[];
  glottocodes: string[];
  morphology: string[];
  tier: string;
  speakerOp: '>=' | '<=' | '';
  speakerVal: string;
  locked: boolean;
}

const EMPTY_FILTERS: LanguageFilters = {
  continent: '',
  families: [],
  fineweb2: [],
  glottocodes: [],
  morphology: [],
  tier: '',
  speakerOp: '>=',
  speakerVal: '',
  locked: false,
};

export interface UseLanguageFiltersResult {
  filters: LanguageFilters;
  /** Update a single filter field by name. */
  setFilter: <K extends keyof LanguageFilters>(key: K, value: LanguageFilters[K]) => void;
  /** Reset all filters to their default (empty) state. */
  clearFilters: () => void;
  /** Options for the filter dropdowns, derived from languagesInfo. */
  allContinents: string[];
  allFamilies: string[];
  allFineweb2Keys: string[];
  allGlottocodes: string[];
  allMorphology: string[];
  allTiers: string[];
  /** Returns true if `lang` passes all currently active filters. */
  languageMatchesFilters: (lang: string) => boolean;
  /** Subset of `availableLanguages` that pass all active filters (memoized). */
  matchingLanguages: string[];
  /** True when at least one filter has a non-empty value. */
  isAnyFilterActive: boolean;
}

// ---------------------------------------------------------------------------
// Standalone helper — also exported for components that need it outside the hook
// ---------------------------------------------------------------------------

/**
 * Look up per-language metadata from the languagesInfo blob.
 * Handles both flat `{ lang: info }` and nested `{ languages: { lang: info } }` shapes.
 */
export function lookupLanguageInfo(lang: string, languagesInfo: Record<string, any>): any {
  const root: any = languagesInfo || {};
  if (root.languages?.[lang]) return root.languages[lang];
  return root[lang] || {};
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useLanguageFilters(
  availableLanguages: string[],
  languagesInfo: Record<string, any>,
): UseLanguageFiltersResult {
  const [filters, setFilters] = React.useState<LanguageFilters>(EMPTY_FILTERS);

  const setFilter = React.useCallback(
    <K extends keyof LanguageFilters>(key: K, value: LanguageFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const clearFilters = React.useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, []);

  // ---- derive category lists for the filter dropdowns ----

  const getLanguageInfo = React.useCallback(
    (lang: string) => lookupLanguageInfo(lang, languagesInfo),
    [languagesInfo],
  );

  const getCategoryList = React.useCallback(
    (name: string, _isArray: boolean): string[] => {
      const root: any = languagesInfo || {};
      const cat = root.categories ? root.categories[name] : undefined;
      if (Array.isArray(cat)) {
        return Array.from(new Set<string>(cat as string[])).sort();
      }
      if (cat && typeof cat === 'object') {
        return Object.keys(cat as Record<string, any>).sort();
      }
      const s = new Set<string>();
      const langs: string[] =
        root.languages && typeof root.languages === 'object'
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
    },
    [languagesInfo, getLanguageInfo],
  );

  const allContinents = React.useMemo(
    () => getCategoryList('continent', false),
    [getCategoryList],
  );
  const allFamilies = React.useMemo(() => getCategoryList('families', true), [getCategoryList]);

  // fineweb2 has special nested-key extraction logic
  const allFineweb2Keys = React.useMemo((): string[] => {
    const root: any = languagesInfo || {};
    const fromCategories: string[] | null =
      root.categories && Array.isArray(root.categories.fineweb2)
        ? (root.categories.fineweb2 as string[])
        : null;
    if (fromCategories) return Array.from(new Set<string>(fromCategories)).sort();
    const s = new Set<string>();
    const langs: string[] =
      root.languages && typeof root.languages === 'object'
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

  const allGlottocodes = React.useMemo(
    () => getCategoryList('glottocodes', true),
    [getCategoryList],
  );
  const allMorphology = React.useMemo(
    () => getCategoryList('morphology', true),
    [getCategoryList],
  );
  const allTiers = React.useMemo(() => getCategoryList('tier', false), [getCategoryList]);

  // ---- filter matching ----

  const isAnyFilterActive = React.useMemo(
    () =>
      Boolean(filters.continent) ||
      filters.families.length > 0 ||
      filters.fineweb2.length > 0 ||
      filters.glottocodes.length > 0 ||
      filters.morphology.length > 0 ||
      Boolean(filters.tier) ||
      (filters.speakerOp !== '' && filters.speakerVal.trim() !== ''),
    [filters],
  );

  const languageMatchesFilters = React.useCallback(
    (lang: string): boolean => {
      // Parse the structured language code into its components.
      // Format: <code>_<script>_<finewebKey>_<glottocode>
      const parseLabel = (
        label: string,
      ): { base: string; finewebKey?: string; glottocode?: string } => {
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

      // Resolve language info, falling back to glottocode lookup if direct
      // lookup returns nothing (e.g. when the base isn't a top-level key).
      const resolveInfo = (): any => {
        const direct = getLanguageInfo(base);
        if (direct && Object.keys(direct).length > 0) return direct;
        if (glottocode) {
          const root: any = languagesInfo || {};
          const entries: Array<{ info: any }> =
            root.languages && typeof root.languages === 'object'
              ? Object.keys(root.languages).map((k) => ({ info: root.languages[k] }))
              : Object.keys(root).map((k) => ({ info: root[k] }));
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
      if (filters.continent && info?.continent !== filters.continent) return false;

      // families (any-of)
      if (filters.families.length > 0) {
        const fam = info?.families;
        let arr: string[] = [];
        if (Array.isArray(fam)) arr = fam;
        else if (fam && typeof fam === 'object') arr = Object.keys(fam);
        else if (typeof fam === 'string') arr = [fam];
        const set = new Set(arr);
        if (!filters.families.some((f) => set.has(f))) return false;
      }

      // fineweb2 (any-of)
      if (filters.fineweb2.length > 0) {
        if (finewebKey) {
          if (!filters.fineweb2.includes(finewebKey)) return false;
        } else {
          const fw = info?.fineweb2;
          const keys =
            fw && typeof fw === 'object'
              ? Object.keys(fw)
              : Array.isArray(fw)
              ? fw
              : typeof fw === 'string'
              ? [fw]
              : [];
          const set = new Set(keys);
          if (!filters.fineweb2.some((k) => set.has(k))) return false;
        }
      }

      // glottocodes (any-of)
      if (filters.glottocodes.length > 0) {
        if (glottocode) {
          if (!filters.glottocodes.includes(glottocode)) return false;
        } else {
          const gc = info?.glottocodes;
          let arr: string[] = [];
          if (Array.isArray(gc)) arr = gc;
          else if (gc && typeof gc === 'object') arr = Object.keys(gc);
          else if (typeof gc === 'string') arr = [gc];
          const set = new Set(arr);
          if (!filters.glottocodes.some((g) => set.has(g))) return false;
        }
      }

      // morphology (any-of)
      if (filters.morphology.length > 0) {
        const m = info?.morphology;
        let arr: string[] = [];
        if (Array.isArray(m)) arr = m;
        else if (m && typeof m === 'object') arr = Object.keys(m);
        else if (typeof m === 'string') arr = [m];
        const set = new Set(arr);
        if (!filters.morphology.some((v) => set.has(v))) return false;
      }

      // tier
      if (filters.tier) {
        const t = info?.tier;
        const tv =
          typeof t === 'number' || typeof t === 'boolean'
            ? String(t)
            : typeof t === 'string'
            ? t
            : '';
        if (tv !== filters.tier) return false;
      }

      // speaker threshold
      const hasSpeakerFilter = filters.speakerOp !== '' && filters.speakerVal.trim() !== '';
      if (hasSpeakerFilter) {
        const raw = info?.speaker !== undefined ? info.speaker : info?.speakers;
        let n: number | null = null;
        if (typeof raw === 'number') {
          n = raw;
        } else if (typeof raw === 'string') {
          const parsed = parseFloat(raw.replace(/[,\s]/g, ''));
          if (!Number.isNaN(parsed)) n = parsed;
        }
        const thr = parseFloat(filters.speakerVal);
        if (n === null || Number.isNaN(thr)) return false;
        if (filters.speakerOp === '>=') {
          if (!(n >= thr)) return false;
        } else if (filters.speakerOp === '<=') {
          if (!(n <= thr)) return false;
        }
      }

      return true;
    },
    [filters, languagesInfo, getLanguageInfo],
  );

  const matchingLanguages = React.useMemo(
    () => availableLanguages.filter(languageMatchesFilters),
    [availableLanguages, languageMatchesFilters],
  );

  return {
    filters,
    setFilter,
    clearFilters,
    allContinents,
    allFamilies,
    allFineweb2Keys,
    allGlottocodes,
    allMorphology,
    allTiers,
    languageMatchesFilters,
    matchingLanguages,
    isAnyFilterActive,
  };
}
