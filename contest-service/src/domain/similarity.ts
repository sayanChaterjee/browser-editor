/**
 * Code similarity between submissions, for spotting copied work.
 *
 * Code is normalised (comments and whitespace removed, lower-cased) and split into tokens;
 * every run of SHINGLE_TOKENS tokens is hashed. A submission's fingerprint keeps the
 * FINGERPRINT_SIZE smallest hashes (a bottom-k MinHash sketch), which estimates the Jaccard
 * similarity of two token-shingle sets from a few hundred numbers instead of the code itself.
 */

const SHINGLE_TOKENS = 5;
export const FINGERPRINT_SIZE = 128;
// Below this many distinct shingles there's too little code for a comparison to mean anything
// (two near-empty submissions would look identical)
export const MIN_SHINGLES = 40;

const COMMENTS = /\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|\/\/[^\n]*/g;
const TOKENS = /[a-z_$][\w$-]*|\d+(?:\.\d+)?|[^\s\w]/g;

// 32-bit FNV-1a
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function tokens(code: string): string[] {
  return code.replace(COMMENTS, ' ').toLowerCase().match(TOKENS) ?? [];
}

/** The bottom-k sketch of the code's shingles; empty when there is too little code. */
export function fingerprint(code: string): number[] {
  const words = tokens(code);
  const shingles = new Set<number>();
  for (let i = 0; i + SHINGLE_TOKENS <= words.length; i++) {
    shingles.add(hash(words.slice(i, i + SHINGLE_TOKENS).join(' ')));
  }
  if (shingles.size < MIN_SHINGLES) return [];
  return [...shingles].sort((a, b) => a - b).slice(0, FINGERPRINT_SIZE);
}

/** Estimated Jaccard similarity (0-1) of two fingerprints; 0 when either is empty. */
export function similarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const inA = new Set(a);
  const inB = new Set(b);
  // The k smallest hashes of the union; the share found in both sketches estimates Jaccard
  const union = [...new Set([...a, ...b])].sort((x, y) => x - y).slice(0, Math.min(FINGERPRINT_SIZE, a.length, b.length));
  const shared = union.filter((h) => inA.has(h) && inB.has(h)).length;
  return shared / union.length;
}

export const submissionCode = (s: { html?: string | null; css?: string | null; js?: string | null }) =>
  [s.html ?? '', s.css ?? '', s.js ?? ''].join('\n');
