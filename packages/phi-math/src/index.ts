import { createHash } from 'node:crypto';

export const PHI = 1.618033988749895;
export const PSI = 1 / PHI;

export const CSL_BANDS = {
  DORMANT_MAX: 0.236068,
  LOW_MAX: 0.381966,
  MODERATE_MAX: 0.618034,
  HIGH_MAX: 0.854102,
  CRITICAL_MAX: 1,
} as const;

export type CslBand = 'DORMANT' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export function fib(n: number): number {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  let a = 1;
  let b = 1;
  for (let i = 3; i <= n; i += 1) {
    const next = a + b;
    a = b;
    b = next;
  }
  return b;
}

export function clamp01(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function labelForCslScore(score: number): CslBand {
  const normalized = clamp01(score);
  if (normalized <= CSL_BANDS.DORMANT_MAX) return 'DORMANT';
  if (normalized <= CSL_BANDS.LOW_MAX) return 'LOW';
  if (normalized <= CSL_BANDS.MODERATE_MAX) return 'MODERATE';
  if (normalized <= CSL_BANDS.HIGH_MAX) return 'HIGH';
  return 'CRITICAL';
}

export function phiWeights(count: number): number[] {
  if (count <= 0) return [];
  const raw = Array.from({ length: count }, (_, index) => Math.pow(PHI, count - index - 1));
  const total = raw.reduce((sum, value) => sum + value, 0);
  return raw.map((value) => value / total);
}

export function phiBlend(values: number[]): number {
  if (values.length === 0) return 0;
  const weights = phiWeights(values.length);
  return clamp01(values.reduce((sum, value, index) => sum + clamp01(value) * weights[index], 0));
}

export function phiBackoffMs(attempt: number, baseMs = 1000, maxMs = fib(15) * 100): number {
  const delay = baseMs * Math.pow(PHI, Math.max(0, attempt));
  return Math.round(Math.min(delay, maxMs));
}

export function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
}

export function magnitude(vector: number[]): number {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  const cosine = dotProduct(a, b) / (magA * magB);
  return Math.max(-1, Math.min(1, cosine));
}

export function normalizeVector(vector: number[]): number[] {
  const mag = magnitude(vector);
  if (mag === 0) return vector.map(() => 0);
  return vector.map((value) => value / mag);
}

export function meanVector(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dimension = vectors[0].length;
  const totals = Array.from({ length: dimension }, () => 0);
  for (const vector of vectors) {
    for (let i = 0; i < dimension; i += 1) {
      totals[i] += vector[i] ?? 0;
    }
  }
  return totals.map((value) => value / vectors.length);
}

export function spatialDistance(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function attenuationFromDistance(distance: number): number {
  return 1 / (1 + distance * distance);
}

export function hashToUnitInterval(seed: string): number {
  const digest = createHash('sha256').update(seed).digest('hex').slice(0, 12);
  const integer = Number.parseInt(digest, 16);
  return integer / 0xffffffffffff;
}

export function hashToVector3(seed: string, scale = fib(8)): Vector3 {
  const x = (hashToUnitInterval(`${seed}:x`) * 2 - 1) * scale;
  const y = (hashToUnitInterval(`${seed}:y`) * 2 - 1) * scale;
  const z = (hashToUnitInterval(`${seed}:z`) * 2 - 1) * scale;
  return { x, y, z };
}
