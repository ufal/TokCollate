import { describe, it, expect } from 'vitest';
import {
  buildLanguageLabelMap,
  getDisplayLanguageLabel,
  getDisplayLanguagePairLabel,
} from '../languageLabels';

// ---------------------------------------------------------------------------
// buildLanguageLabelMap
// ---------------------------------------------------------------------------

describe('buildLanguageLabelMap', () => {
  it('maps a unique code to its base <code>_<script>', () => {
    const map = buildLanguageLabelMap(['eng_Latn_abcd1234']);
    expect(map['eng_Latn_abcd1234']).toBe('eng_Latn');
  });

  it('maps code without glottocode to itself as base', () => {
    const map = buildLanguageLabelMap(['eng_Latn']);
    expect(map['eng_Latn']).toBe('eng_Latn');
  });

  it('includes glottocode when two codes share the same base', () => {
    const map = buildLanguageLabelMap(['eng_Latn_abcd1234', 'eng_Latn_efgh5678']);
    expect(map['eng_Latn_abcd1234']).toBe('eng_Latn_abcd1234');
    expect(map['eng_Latn_efgh5678']).toBe('eng_Latn_efgh5678');
  });

  it('does not include glottocode when only one code uses a base', () => {
    const map = buildLanguageLabelMap([
      'eng_Latn_abcd1234',
      'fra_Latn_xyzt9999',
    ]);
    expect(map['eng_Latn_abcd1234']).toBe('eng_Latn');
    expect(map['fra_Latn_xyzt9999']).toBe('fra_Latn');
  });

  it('handles a mix of colliding and non-colliding codes', () => {
    const codes = ['deu_Latn_xxxx1111', 'deu_Latn_yyyy2222', 'jpn_Jpan_zzzz3333'];
    const map = buildLanguageLabelMap(codes);

    // Colliding pair → glottocode retained
    expect(map['deu_Latn_xxxx1111']).toBe('deu_Latn_xxxx1111');
    expect(map['deu_Latn_yyyy2222']).toBe('deu_Latn_yyyy2222');
    // Unique → short form
    expect(map['jpn_Jpan_zzzz3333']).toBe('jpn_Jpan');
  });

  it('returns an empty map for an empty input', () => {
    expect(buildLanguageLabelMap([])).toEqual({});
  });

  it('skips falsy entries gracefully', () => {
    // The implementation guards `if (!code) continue`
    const map = buildLanguageLabelMap(['eng_Latn_abcd1234', '', 'fra_Latn_efgh5678']);
    expect(map['eng_Latn_abcd1234']).toBe('eng_Latn');
    expect(map['fra_Latn_efgh5678']).toBe('fra_Latn');
    expect('' in map).toBe(false);
  });

  it('produces unique display labels for a collision set', () => {
    const codes = ['zho_Hans_aaa1111', 'zho_Hans_bbb2222'];
    const map = buildLanguageLabelMap(codes);
    const labels = codes.map((c) => map[c]);
    expect(new Set(labels).size).toBe(2); // no two codes share a label
  });
});

// ---------------------------------------------------------------------------
// getDisplayLanguageLabel
// ---------------------------------------------------------------------------

describe('getDisplayLanguageLabel', () => {
  it('returns the mapped label when the code is in the map', () => {
    const map = buildLanguageLabelMap(['eng_Latn_abcd1234']);
    expect(getDisplayLanguageLabel('eng_Latn_abcd1234', map)).toBe('eng_Latn');
  });

  it('falls back to the raw code when not found in the map', () => {
    expect(getDisplayLanguageLabel('unknown_code', {})).toBe('unknown_code');
  });

  it('returns the empty string unchanged for an empty input', () => {
    expect(getDisplayLanguageLabel('', {})).toBe('');
  });
});

// ---------------------------------------------------------------------------
// getDisplayLanguagePairLabel
// ---------------------------------------------------------------------------

describe('getDisplayLanguagePairLabel', () => {
  it('shortens both sides of a hyphen-separated pair', () => {
    const map = buildLanguageLabelMap(['eng_Latn_abcd1234', 'fra_Latn_efgh5678']);
    const label = getDisplayLanguagePairLabel(
      'eng_Latn_abcd1234-fra_Latn_efgh5678',
      map,
    );
    expect(label).toBe('eng_Latn-fra_Latn');
  });

  it('handles a single code with no hyphen', () => {
    const map = buildLanguageLabelMap(['eng_Latn_abcd1234']);
    expect(getDisplayLanguagePairLabel('eng_Latn_abcd1234', map)).toBe('eng_Latn');
  });

  it('falls back gracefully when codes are not in the map', () => {
    const label = getDisplayLanguagePairLabel('foo_Bar-baz_Qux', {});
    expect(label).toBe('foo_Bar-baz_Qux');
  });

  it('returns empty string for empty input', () => {
    expect(getDisplayLanguagePairLabel('', {})).toBe('');
  });
});
