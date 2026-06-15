/**
 * Multi-scheme byte-level token decoder.
 *
 * Modern LLM tokenizers represent raw bytes in two main ways:
 *
 *  1. GPT-2 / Tiktoken style  (DeepSeek, GLM, LLaMA, …)
 *     Each byte is mapped to a unique printable Unicode character via the
 *     `bytes_to_unicode()` table from GPT-2's encoder.py.
 *     Example:  Ġ = 0x20 (space),  ÙĬ = [0xD9, 0xAC] = Arabic ل
 *
 *  2. SentencePiece style  (Gemma, T5, …)
 *     Byte-fallback tokens are written as <0xNN> (exactly one byte each).
 *     Word-initial tokens carry a ▁ prefix (U+2581) that represents a space.
 *     Example:  <0xE2><0x80><0x9C> = three tokens → UTF-8 for "
 *
 * This module detects which scheme each token uses, extracts raw bytes,
 * groups consecutive byte-tokens that together form a single Unicode character,
 * and returns human-readable decoded text alongside metadata for rendering.
 *
 * Reference (GPT-2 scheme): https://github.com/openai/gpt-2/blob/master/src/encoder.py
 *   bytes_to_unicode()
 */


// ---------------------------------------------------------------------------
// GPT-2 bytes_to_unicode reverse map
// ---------------------------------------------------------------------------
/**
 * Build the reverse of GPT-2's bytes_to_unicode() table.
 *
 * **Background:** A tokenizer vocabulary must contain only printable,
 * unambiguous characters so it can be stored as plain text. Raw bytes 0–255
 * include control characters (NUL, TAB, LF, …) that cannot appear cleanly in
 * a vocab file. GPT-2 solves this by defining a bijection from every possible
 * byte value to a unique printable Unicode character:
 *
 *   • The 188 bytes that are already printable ASCII or Latin-1
 *     (33–126 "!"–"~", 161–172 "¡"–"¬", 174–255 "®"–"ÿ") map to themselves.
 *   • The remaining 68 "unsafe" bytes (0–32, 127, 173) are remapped to the
 *     first 68 codepoints starting at U+0100 (Ā, ā, Ă, …).
 *     For example:  0x00 (NUL) → Ā (U+0100)
 *                   0x20 (SPC) → Ġ (U+0120)
 *                   0x0A (LF)  → Ċ (U+010A)
 *
 * This function reconstructs the **inverse** mapping (Unicode char → byte),
 * which is what the decoder needs: given a GPT-2 token string, look up each
 * character to recover the original byte sequence, then decode as UTF-8.
 *
 * Example:
 *   Token "Ġcat"  →  bytes [0x20, 0x63, 0x61, 0x74]  →  " cat"
 *
 * The returned Map is built once at module load and stored in
 * GPT2_UNICODE_TO_BYTE.
 */
function buildUnicodeToBytes(): Map<string, number> {
  const bs: number[] = [];
  for (let b = 33; b <= 126; b++) bs.push(b);   // ! – ~   (printable ASCII)
  for (let b = 161; b <= 172; b++) bs.push(b);  // ¡ – ¬   (Latin-1 supplement, part 1)
  for (let b = 174; b <= 255; b++) bs.push(b);  // ® – ÿ   (Latin-1 supplement, part 2)

  const cs = [...bs];
  let n = 0;
  for (let b = 0; b < 256; b++) {
    if (!bs.includes(b)) {
      bs.push(b);        // record the unsafe byte value
      cs.push(256 + n);  // assign it to codepoint U+0100, U+0101, …
      n++;
    }
  }

  const map = new Map<string, number>();
  for (let i = 0; i < bs.length; i++) {
    map.set(String.fromCodePoint(cs[i]), bs[i]);
  }
  return map;
}

const GPT2_UNICODE_TO_BYTE: Map<string, number> = buildUnicodeToBytes();

// SentencePiece word-boundary marker
const SP_WORD_BOUNDARY = '\u2581'; // ▁


// ---------------------------------------------------------------------------
// Per-token byte extraction
// ---------------------------------------------------------------------------
const SP_HEX_RE = /^<0x([0-9A-Fa-f]{2})>$/;

/**
 * Extract the raw bytes a token represents, or null for plain text tokens.
 * Returns bytes for both GPT-2 style and SentencePiece <0xNN> style tokens.
 */
function getTokenBytes(token: string): number[] | null {
  // SentencePiece <0xNN> — unambiguous single-byte token
  const hexMatch = SP_HEX_RE.exec(token);
  if (hexMatch) {
    return [parseInt(hexMatch[1], 16)];
  }

  // GPT-2 byte-level: every character must be in the unicode-to-byte map,
  // AND the decoded byte sequence must differ from the raw string
  // (plain ASCII tokens like "Hello" pass the map check trivially).
  if (token.length > 0) {
    const bytes: number[] = [];
    let allInMap = true;
    for (const ch of token) {
      const b = GPT2_UNICODE_TO_BYTE.get(ch);
      if (b === undefined) { allInMap = false; break; }
      bytes.push(b);
    }
    if (allInMap) {
      let isEncoded = false;
      try {
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
        if (decoded !== token) isEncoded = true;
      } catch {
        isEncoded = true; // Invalid UTF-8 sequence → definitely a byte fragment
      }
      if (isEncoded) return bytes;
    }
  }

  return null; // Plain token
}

/**
 * Return the display string for a plain (non-byte-level) token.
 * Replaces the SentencePiece word-boundary marker ▁ with a regular space.
 */
function plainDisplay(token: string): string {
  return token.startsWith(SP_WORD_BOUNDARY)
    ? ' ' + token.slice(SP_WORD_BOUNDARY.length)
    : token;
}

// ---------------------------------------------------------------------------
// Sentence-level decoding with byte grouping
// ---------------------------------------------------------------------------

export interface DecodedToken {
  /** Original raw token string as stored in tokenizations.json.gz */
  raw: string;
  /**
   * Human-readable decoded text. Empty string if this token is a byte
   * fragment whose bytes were merged into a preceding group's display.
   */
  decoded: string;
  /** True if this token used byte-level encoding (either scheme). */
  isByteLevel: boolean;
  /** Tokens that together form a single Unicode character share a groupId. */
  groupId: number;
}

/**
 * Decode a full sentence (list of raw token strings) into DecodedToken[].
 *
 * Consecutive byte-level tokens whose combined bytes form valid UTF-8 are
 * merged into a group: the first token shows the decoded text, the rest show
 * an empty `decoded` field (rendered as small placeholders by the UI).
 */
export function decodeSentence(tokens: string[]): DecodedToken[] {
  const result: DecodedToken[] = [];
  let groupId = 0;
  let i = 0;

  while (i < tokens.length) {
    const bytes = getTokenBytes(tokens[i]);

    if (bytes === null) {
      // Plain token
      result.push({
        raw: tokens[i],
        decoded: plainDisplay(tokens[i]),
        isByteLevel: false,
        groupId,
      });
      groupId++;
      i++;
      continue;
    }

    // Byte-level token — collect a run and attempt UTF-8 decoding.
    // Extend the run (up to 6 tokens) until we get a valid decode.
    // We stop extending as soon as we hit a plain (non-byte) token.
    const collectBytes = (end: number): number[] => {
      const acc: number[] = [];
      for (let k = i; k < end; k++) {
        const b = getTokenBytes(tokens[k]);
        if (b) acc.push(...b);
      }
      return acc;
    };

    let decoded: string | null = null;
    let runEnd = i + 1;

    // Try current token alone first
    try {
      decoded = new TextDecoder('utf-8', { fatal: true }).decode(
        new Uint8Array(collectBytes(runEnd)),
      );
    } catch { /* fragment */ }

    if (decoded === null) {
      for (let ext = i + 2; ext <= Math.min(i + 6, tokens.length); ext++) {
        if (getTokenBytes(tokens[ext - 1]) === null) break; // stop at plain token
        try {
          decoded = new TextDecoder('utf-8', { fatal: true }).decode(
            new Uint8Array(collectBytes(ext)),
          );
          runEnd = ext;
          break;
        } catch { /* keep going */ }
      }
    }

    if (decoded !== null) {
      if (runEnd > i + 1) {
        // Multi-token character group
        for (let k = i; k < runEnd; k++) {
          result.push({
            raw: tokens[k],
            decoded: k === i ? decoded : '',
            isByteLevel: true,
            groupId,
          });
        }
      } else {
        result.push({ raw: tokens[i], decoded, isByteLevel: true, groupId });
      }
    } else {
      // Could not form valid UTF-8 even after extending — show as \xNN hex
      const hexStr = collectBytes(i + 1)
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join('');
      result.push({
        raw: tokens[i],
        decoded: `\\x${hexStr}`,
        isByteLevel: true,
        groupId,
      });
    }

    groupId++;
    i = runEnd;
  }

  return result;
}
