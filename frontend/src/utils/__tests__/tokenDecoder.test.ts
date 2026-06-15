import { describe, it, expect } from 'vitest';
import { decodeSentence } from '../tokenDecoder';

// ---------------------------------------------------------------------------
// Plain tokens
// ---------------------------------------------------------------------------

describe('decodeSentence – plain tokens', () => {
  it('returns a single plain ASCII token unchanged', () => {
    const result = decodeSentence(['Hello']);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ raw: 'Hello', decoded: 'Hello', isByteLevel: false });
  });

  it('assigns incrementing groupIds to consecutive plain tokens', () => {
    const result = decodeSentence(['The', 'Ġcat', 'Ġsat']);
    // 'The' is plain; 'Ġcat' and 'Ġsat' are GPT-2 byte-level (Ġ = 0x20 + 'cat')
    // verify groupIds are monotonically increasing
    const ids = result.map((t) => t.groupId);
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBeGreaterThan(ids[i - 1]);
    }
  });

  it('handles an empty token list', () => {
    expect(decodeSentence([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// SentencePiece word-boundary marker (▁)
// ---------------------------------------------------------------------------

describe('decodeSentence – SentencePiece ▁ prefix', () => {
  it('replaces leading ▁ with a space', () => {
    const result = decodeSentence(['▁hello']);
    expect(result).toHaveLength(1);
    expect(result[0].decoded).toBe(' hello');
    expect(result[0].isByteLevel).toBe(false);
  });

  it('keeps token without ▁ as-is', () => {
    const result = decodeSentence(['world']);
    expect(result[0].decoded).toBe('world');
  });
});

// ---------------------------------------------------------------------------
// SentencePiece <0xNN> byte tokens
// ---------------------------------------------------------------------------

describe('decodeSentence – SentencePiece <0xNN> single-byte ASCII', () => {
  it('decodes a single ASCII byte token', () => {
    // <0x41> = 'A'
    const result = decodeSentence(['<0x41>']);
    expect(result).toHaveLength(1);
    expect(result[0].decoded).toBe('A');
    expect(result[0].isByteLevel).toBe(true);
  });

  it('decodes lowercase hex byte', () => {
    // <0x61> = 'a'
    const result = decodeSentence(['<0x61>']);
    expect(result[0].decoded).toBe('a');
  });
});

describe('decodeSentence – SentencePiece multi-byte UTF-8 grouping', () => {
  it('groups three SP bytes that form a Unicode character into one group', () => {
    // U+201C LEFT DOUBLE QUOTATION MARK = E2 80 9C
    const tokens = ['<0xE2>', '<0x80>', '<0x9C>'];
    const result = decodeSentence(tokens);

    expect(result).toHaveLength(3);
    // All three share a groupId
    expect(result[0].groupId).toBe(result[1].groupId);
    expect(result[1].groupId).toBe(result[2].groupId);
    // First token carries the decoded character
    expect(result[0].decoded).toBe('\u201C');
    // Subsequent tokens in the group are empty
    expect(result[1].decoded).toBe('');
    expect(result[2].decoded).toBe('');
    // All are byte-level
    expect(result.every((t) => t.isByteLevel)).toBe(true);
  });

  it('groups two-byte UTF-8 sequence (U+00E9 é)', () => {
    // é = C3 A9
    const tokens = ['<0xC3>', '<0xA9>'];
    const result = decodeSentence(tokens);

    expect(result).toHaveLength(2);
    expect(result[0].groupId).toBe(result[1].groupId);
    expect(result[0].decoded).toBe('é');
    expect(result[1].decoded).toBe('');
  });

  it('assigns different groupIds to consecutive multi-byte characters', () => {
    // Two separate two-byte chars: é (C3 A9) then ü (C3 BC)
    const tokens = ['<0xC3>', '<0xA9>', '<0xC3>', '<0xBC>'];
    const result = decodeSentence(tokens);

    expect(result).toHaveLength(4);
    expect(result[0].groupId).toBe(result[1].groupId);   // é group
    expect(result[2].groupId).toBe(result[3].groupId);   // ü group
    expect(result[0].groupId).not.toBe(result[2].groupId); // different groups
    expect(result[0].decoded).toBe('é');
    expect(result[2].decoded).toBe('ü');
  });
});

// ---------------------------------------------------------------------------
// GPT-2 / Tiktoken byte-level tokens
// ---------------------------------------------------------------------------

describe('decodeSentence – GPT-2 byte-level tokens', () => {
  it('decodes Ġ (0x20) as a space, combined with following plain chars in one token', () => {
    // "Ġcat" in GPT-2 encoding: Ġ maps to 0x20, then 'c'=0x63, 'a'=0x61, 't'=0x74
    // But 0x20 0x63 0x61 0x74 = " cat" — which differs from "Ġcat", so it's byte-level
    const result = decodeSentence(['Ġcat']);
    expect(result).toHaveLength(1);
    expect(result[0].decoded).toBe(' cat');
    expect(result[0].isByteLevel).toBe(true);
  });

  it('decodes Ċ (0x0A) as newline', () => {
    // Ċ maps to 0x0A (newline) in GPT-2 byte mapping
    const result = decodeSentence(['Ċ']);
    expect(result).toHaveLength(1);
    expect(result[0].decoded).toBe('\n');
    expect(result[0].isByteLevel).toBe(true);
  });

  it('leaves plain ASCII "Hello" as plain (not byte-level)', () => {
    // "Hello" chars are all in the GPT-2 map, but decoded bytes produce the
    // same string, so it should NOT be treated as byte-level
    const result = decodeSentence(['Hello']);
    expect(result[0].isByteLevel).toBe(false);
    expect(result[0].decoded).toBe('Hello');
  });
});

// ---------------------------------------------------------------------------
// Mixed sequences
// ---------------------------------------------------------------------------

describe('decodeSentence – mixed plain and byte-level tokens', () => {
  it('handles mixed SP plain and byte tokens with correct groupIds', () => {
    // "▁the" (plain, ▁ → space), then "<0xC3><0xA9>" (é), then "▁cat" (plain)
    const tokens = ['▁the', '<0xC3>', '<0xA9>', '▁cat'];
    const result = decodeSentence(tokens);

    expect(result).toHaveLength(4);
    expect(result[0].decoded).toBe(' the');
    expect(result[0].isByteLevel).toBe(false);

    expect(result[1].decoded).toBe('é');
    expect(result[1].isByteLevel).toBe(true);
    expect(result[2].decoded).toBe('');
    expect(result[1].groupId).toBe(result[2].groupId);

    expect(result[3].decoded).toBe(' cat');
    expect(result[3].isByteLevel).toBe(false);

    // All groupIds unique per logical unit
    expect(result[0].groupId).not.toBe(result[1].groupId);
    expect(result[1].groupId).not.toBe(result[3].groupId);
  });

  it('preserves raw token strings in all cases', () => {
    const tokens = ['▁hi', '<0x41>', 'Ġworld'];
    const result = decodeSentence(tokens);
    expect(result.map((t) => t.raw)).toEqual(tokens);
  });
});

// ---------------------------------------------------------------------------
// Invalid / undecodable bytes fallback
// ---------------------------------------------------------------------------

describe('decodeSentence – undecodable byte fallback', () => {
  it('renders an isolated 0x80 continuation byte as \\xNN hex', () => {
    // 0x80 is not valid UTF-8 on its own and cannot be extended into a valid char
    const result = decodeSentence(['<0x80>']);
    expect(result).toHaveLength(1);
    expect(result[0].decoded).toMatch(/^\\x/i);
    expect(result[0].isByteLevel).toBe(true);
  });
});
