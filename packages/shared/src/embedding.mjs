import crypto from 'node:crypto';

export const EMBEDDING_DIM = 384;

export function normalizeText(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function deterministicEmbedding(input) {
  const text = normalizeText(input);
  const vector = new Array(EMBEDDING_DIM).fill(0);
  const seed = text || 'empty';

  for (let i = 0; i < EMBEDDING_DIM; i += 1) {
    const round = Math.floor(i / 32);
    const digest = crypto.createHash('sha256').update(`${seed}:${round}`).digest();
    const byte = digest[i % digest.length];
    vector[i] = (byte / 127.5) - 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

export function coordinatesFromEmbedding(vector) {
  const safe = Array.isArray(vector) ? vector : [];
  const third = Math.max(1, Math.floor(safe.length / 3));
  const group = (start, end) => {
    const slice = safe.slice(start, end);
    const total = slice.reduce((sum, value) => sum + value, 0);
    return Number((total / Math.max(1, slice.length)).toFixed(6));
  };
  return {
    x: group(0, third),
    y: group(third, third * 2),
    z: group(third * 2, safe.length)
  };
}

export function cosineSimilarity(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
