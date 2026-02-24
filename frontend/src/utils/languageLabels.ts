export type LanguageLabelMap = Record<string, string>;

/**
 * Build a mapping from full language code (e.g. "eng_Latn_1234") to a
 * shorter display label (e.g. "eng_Latn"), while preserving uniqueness.
 *
 * If multiple full codes share the same <code>_<script> prefix, their
 * display labels will include the glottocode to distinguish them.
 */
export const buildLanguageLabelMap = (allLanguages: string[]): LanguageLabelMap => {
  const baseToCodes: Record<string, string[]> = {};

  for (const code of allLanguages || []) {
    if (!code) continue;
    const parts = code.split('_');
    const base = parts.length >= 2 ? `${parts[0]}_${parts[1]}` : code;
    if (!baseToCodes[base]) {
      baseToCodes[base] = [];
    }
    baseToCodes[base].push(code);
  }

  const map: LanguageLabelMap = {};

  for (const [base, codes] of Object.entries(baseToCodes)) {
    if (codes.length === 1) {
      // No collision for this base; show just <code>_<script>
      const only = codes[0];
      map[only] = base;
    } else {
      // Collision: include glottocode to distinguish
      for (const code of codes) {
        const parts = code.split('_');
        const glottocode = parts.length >= 3 ? parts[2] : undefined;
        map[code] = glottocode ? `${base}_${glottocode}` : code;
      }
    }
  }

  return map;
};

export const getDisplayLanguageLabel = (code: string, map: LanguageLabelMap): string => {
  if (!code) return code;
  return map[code] || code;
};

/**
 * Format a language pair label like "eng_Latn_1234-ces_Latn_5678" using the
 * provided map, so each side is shortened consistently.
 */
export const getDisplayLanguagePairLabel = (pair: string, map: LanguageLabelMap): string => {
  if (!pair) return pair;
  const [left, right] = pair.split('-', 2);
  if (right === undefined) {
    return getDisplayLanguageLabel(left, map);
  }
  const leftLabel = getDisplayLanguageLabel(left, map);
  const rightLabel = getDisplayLanguageLabel(right, map);
  return `${leftLabel}-${rightLabel}`;
};
