import { describe, it, expect } from 'vitest';
import {
  MonolingualMetricPairCorrelationGraphType,
  BilingualMetricPairCorrelationGraphType,
  MetricTableGraphType,
  TokenizedTextGraphType,
} from '../graphTypes';
import type { VisualizationConfig } from '../graphTypes';
import type { MetricDimensionality } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cfg(overrides: Partial<VisualizationConfig> = {}): VisualizationConfig {
  return {
    metrics: [],
    tokenizers: ['tok-a'],
    languages: ['eng_Latn'],
    ...overrides,
  };
}

function dims(map: Record<string, 1 | 2 | 3> = {}): MetricDimensionality {
  return map;
}

// ---------------------------------------------------------------------------
// MonolingualMetricPairCorrelationGraphType
// ---------------------------------------------------------------------------

describe('MonolingualMetricPairCorrelationGraphType.validate()', () => {
  const gType = new MonolingualMetricPairCorrelationGraphType();

  it('passes with two 2D metrics', () => {
    const result = gType.validate(
      cfg({ metrics: ['seq_len', 'vocab_size'] }),
      dims({ seq_len: 2, vocab_size: 2 }),
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when fewer than 2 metrics provided', () => {
    const result = gType.validate(cfg({ metrics: ['seq_len'] }), dims({ seq_len: 2 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => /minimum/i.test(e))).toBe(true);
  });

  it('fails when more than 2 metrics provided', () => {
    const result = gType.validate(
      cfg({ metrics: ['a', 'b', 'c'] }),
      dims({ a: 2, b: 2, c: 2 }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => /maximum/i.test(e))).toBe(true);
  });

  it('fails when a metric is not 2D', () => {
    const result = gType.validate(
      cfg({ metrics: ['freq', 'seq_len'] }),
      dims({ freq: 1, seq_len: 2 }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => /2D/i.test(e))).toBe(true);
  });

  it('fails when a 3D metric is provided', () => {
    const result = gType.validate(
      cfg({ metrics: ['seq_len', 'pmi'] }),
      dims({ seq_len: 2, pmi: 3 }),
    );
    expect(result.valid).toBe(false);
  });

  it('fails when no tokenizers are selected', () => {
    const result = gType.validate(
      cfg({ metrics: ['seq_len', 'vocab_size'], tokenizers: [] }),
      dims({ seq_len: 2, vocab_size: 2 }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => /tokenizer/i.test(e))).toBe(true);
  });

  it('fails when no languages are selected', () => {
    const result = gType.validate(
      cfg({ metrics: ['seq_len', 'vocab_size'], languages: [] }),
      dims({ seq_len: 2, vocab_size: 2 }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => /language/i.test(e))).toBe(true);
  });

  it('accumulates multiple errors at once', () => {
    const result = gType.validate(cfg({ metrics: [] }), dims());
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// BilingualMetricPairCorrelationGraphType
// ---------------------------------------------------------------------------

describe('BilingualMetricPairCorrelationGraphType.validate()', () => {
  const gType = new BilingualMetricPairCorrelationGraphType();

  it('passes with two 3D metrics', () => {
    const result = gType.validate(
      cfg({ metrics: ['pmi', 'js_div'], languages: ['eng_Latn', 'deu_Latn'] }),
      dims({ pmi: 3, js_div: 3 }),
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when fewer than 2 metrics provided', () => {
    const result = gType.validate(
      cfg({ metrics: ['pmi'], languages: ['eng_Latn', 'deu_Latn'] }),
      dims({ pmi: 3 }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => /minimum/i.test(e))).toBe(true);
  });

  it('fails when a 2D metric is provided', () => {
    const result = gType.validate(
      cfg({ metrics: ['pmi', 'seq_len'], languages: ['eng_Latn', 'deu_Latn'] }),
      dims({ pmi: 3, seq_len: 2 }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => /3D/i.test(e))).toBe(true);
  });

  it('fails when no tokenizers are selected', () => {
    const result = gType.validate(
      cfg({ metrics: ['pmi', 'js_div'], tokenizers: [], languages: ['eng_Latn', 'deu_Latn'] }),
      dims({ pmi: 3, js_div: 3 }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => /tokenizer/i.test(e))).toBe(true);
  });

  it('fails when fewer than 2 languages are selected', () => {
    const result = gType.validate(
      cfg({ metrics: ['pmi', 'js_div'], languages: ['eng_Latn'] }),
      dims({ pmi: 3, js_div: 3 }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => /language/i.test(e))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MetricTableGraphType
// ---------------------------------------------------------------------------

describe('MetricTableGraphType.validate()', () => {
  const gType = new MetricTableGraphType();

  it('passes with exactly 1 metric, 1 tokenizer, 1 language', () => {
    const result = gType.validate(cfg({ metrics: ['seq_len'] }), dims({ seq_len: 2 }));
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('passes with a 1D metric (dimension constraint is "both")', () => {
    const result = gType.validate(
      cfg({ metrics: ['vocab_size'] }),
      dims({ vocab_size: 1 }),
    );
    expect(result.valid).toBe(true);
  });

  it('fails with zero metrics', () => {
    const result = gType.validate(cfg({ metrics: [] }), dims());
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /minimum/i.test(e))).toBe(true);
  });

  it('fails with two metrics', () => {
    const result = gType.validate(
      cfg({ metrics: ['seq_len', 'vocab_size'] }),
      dims({ seq_len: 2, vocab_size: 1 }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /maximum/i.test(e))).toBe(true);
  });

  it('fails with zero tokenizers', () => {
    const result = gType.validate(
      cfg({ metrics: ['seq_len'], tokenizers: [] }),
      dims({ seq_len: 2 }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /tokenizer/i.test(e))).toBe(true);
  });

  it('fails with zero languages', () => {
    const result = gType.validate(
      cfg({ metrics: ['seq_len'], languages: [] }),
      dims({ seq_len: 2 }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /language/i.test(e))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TokenizedTextGraphType
// ---------------------------------------------------------------------------

describe('TokenizedTextGraphType.validate()', () => {
  const gType = new TokenizedTextGraphType();

  it('passes with 0 metrics (text type does not need a metric)', () => {
    const result = gType.validate(cfg({ metrics: [] }), dims());
    expect(result.valid).toBe(true);
  });

  it('fails when more metrics than allowed are supplied', () => {
    const result = gType.validate(
      cfg({ metrics: ['seq_len', 'vocab_size'] }),
      dims({ seq_len: 2, vocab_size: 1 }),
    );
    expect(result.valid).toBe(false);
  });

  it('fails with no tokenizers', () => {
    const result = gType.validate(cfg({ metrics: [], tokenizers: [] }), dims());
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /tokenizer/i.test(e))).toBe(true);
  });

  it('fails with no languages', () => {
    const result = gType.validate(cfg({ metrics: [], languages: [] }), dims());
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /language/i.test(e))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Base validate – tokenizer and language count edges
// ---------------------------------------------------------------------------

describe('GraphType base validate – tokenizer and language count edges', () => {
  const gType = new MetricTableGraphType(); // concrete class to exercise base logic

  it('allows multiple tokenizers', () => {
    const result = gType.validate(
      cfg({ metrics: ['seq_len'], tokenizers: ['tok-a', 'tok-b', 'tok-c'] }),
      dims({ seq_len: 2 }),
    );
    expect(result.valid).toBe(true);
  });

  it('allows multiple languages', () => {
    const result = gType.validate(
      cfg({ metrics: ['seq_len'], languages: ['eng_Latn', 'fra_Latn', 'deu_Latn'] }),
      dims({ seq_len: 2 }),
    );
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getCompatibleMetrics
// ---------------------------------------------------------------------------

describe('MonolingualMetricPairCorrelationGraphType.getCompatibleMetrics()', () => {
  const gType = new MonolingualMetricPairCorrelationGraphType();
  const allMetrics = ['seq_len', 'vocab_size', 'pmi', 'freq'];
  const dimensionality = { seq_len: 2, vocab_size: 2, pmi: 3, freq: 1 } as Record<string, 1 | 2 | 3>;

  it('returns only 2D metrics', () => {
    const result = gType.getCompatibleMetrics(allMetrics, dimensionality);
    expect(result).toEqual(['seq_len', 'vocab_size']);
  });

  it('excludes 1D and 3D metrics', () => {
    const result = gType.getCompatibleMetrics(allMetrics, dimensionality);
    expect(result).not.toContain('freq');
    expect(result).not.toContain('pmi');
  });

  it('returns empty array when no 2D metrics', () => {
    const result = gType.getCompatibleMetrics(['freq', 'pmi'], { freq: 1, pmi: 3 });
    expect(result).toEqual([]);
  });
});

describe('BilingualMetricPairCorrelationGraphType.getCompatibleMetrics()', () => {
  const gType = new BilingualMetricPairCorrelationGraphType();
  const allMetrics = ['seq_len', 'vocab_size', 'pmi', 'freq'];
  const dimensionality = { seq_len: 2, vocab_size: 2, pmi: 3, freq: 1 } as Record<string, 1 | 2 | 3>;

  it('returns only 3D metrics', () => {
    const result = gType.getCompatibleMetrics(allMetrics, dimensionality);
    expect(result).toEqual(['pmi']);
  });

  it('excludes 1D and 2D metrics', () => {
    const result = gType.getCompatibleMetrics(allMetrics, dimensionality);
    expect(result).not.toContain('freq');
    expect(result).not.toContain('seq_len');
  });

  it('returns empty array when no 3D metrics', () => {
    const result = gType.getCompatibleMetrics(['freq', 'seq_len'], { freq: 1, seq_len: 2 });
    expect(result).toEqual([]);
  });
});

describe('MetricTableGraphType.getCompatibleMetrics()', () => {
  const gType = new MetricTableGraphType();
  const allMetrics = ['seq_len', 'vocab_size', 'pmi', 'freq'];
  const dimensionality = { seq_len: 2, vocab_size: 2, pmi: 3, freq: 1 } as Record<string, 1 | 2 | 3>;

  it('returns only 2D and 3D metrics', () => {
    const result = gType.getCompatibleMetrics(allMetrics, dimensionality);
    expect(result).toEqual(['seq_len', 'vocab_size', 'pmi']);
  });

  it('excludes 1D metrics', () => {
    const result = gType.getCompatibleMetrics(allMetrics, dimensionality);
    expect(result).not.toContain('freq');
  });
});

describe('TokenizedTextGraphType.getCompatibleMetrics()', () => {
  const gType = new TokenizedTextGraphType();
  const allMetrics = ['seq_len', 'vocab_size', 'pmi', 'freq'];
  const dimensionality = { seq_len: 2, vocab_size: 2, pmi: 3, freq: 1 } as Record<string, 1 | 2 | 3>;

  it('returns all metrics (no restriction — type uses no metrics anyway)', () => {
    const result = gType.getCompatibleMetrics(allMetrics, dimensionality);
    expect(result).toEqual(allMetrics);
  });

  it('returns empty array for empty input', () => {
    expect(gType.getCompatibleMetrics([], {})).toEqual([]);
  });
});
