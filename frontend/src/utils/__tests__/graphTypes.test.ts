import { describe, it, expect } from 'vitest';
import {
  MetricPairCorrelationGraphType,
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
// MetricPairCorrelationGraphType
// ---------------------------------------------------------------------------

describe('MetricPairCorrelationGraphType.validate()', () => {
  const gType = new MetricPairCorrelationGraphType();

  it('passes with two 2D metrics', () => {
    const result = gType.validate(
      cfg({ metrics: ['seq_len', 'vocab_size'] }),
      dims({ seq_len: 2, vocab_size: 2 }),
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('passes with two 3D metrics of the same dimensionality', () => {
    const result = gType.validate(
      cfg({ metrics: ['pmi', 'js_div'] }),
      dims({ pmi: 3, js_div: 3 }),
    );
    expect(result.valid).toBe(true);
  });

  it('fails when fewer than 2 metrics provided', () => {
    const result = gType.validate(cfg({ metrics: ['seq_len'] }), dims({ seq_len: 2 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /minimum/i.test(e))).toBe(true);
  });

  it('fails when more than 2 metrics provided', () => {
    const result = gType.validate(
      cfg({ metrics: ['a', 'b', 'c'] }),
      dims({ a: 2, b: 2, c: 2 }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /maximum/i.test(e))).toBe(true);
  });

  it('fails when a metric is 1D', () => {
    const result = gType.validate(
      cfg({ metrics: ['freq', 'seq_len'] }),
      dims({ freq: 1, seq_len: 2 }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /2D or 3D/i.test(e))).toBe(true);
  });

  it('fails when metrics have different dimensionalities', () => {
    const result = gType.validate(
      cfg({ metrics: ['seq_len', 'pmi'] }),
      dims({ seq_len: 2, pmi: 3 }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /different dimensionality/i.test(e))).toBe(true);
  });

  it('fails when no tokenizers are selected', () => {
    const result = gType.validate(
      cfg({ metrics: ['seq_len', 'vocab_size'], tokenizers: [] }),
      dims({ seq_len: 2, vocab_size: 2 }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /tokenizer/i.test(e))).toBe(true);
  });

  it('fails when no languages are selected', () => {
    const result = gType.validate(
      cfg({ metrics: ['seq_len', 'vocab_size'], languages: [] }),
      dims({ seq_len: 2, vocab_size: 2 }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /language/i.test(e))).toBe(true);
  });

  it('accumulates multiple errors at once', () => {
    const result = gType.validate(cfg({ metrics: [] }), dims());
    expect(result.valid).toBe(false);
    // At minimum: too few metrics error
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
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
// Base validate – tokenizer / language count edges
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
