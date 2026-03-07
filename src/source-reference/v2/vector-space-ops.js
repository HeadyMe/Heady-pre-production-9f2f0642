/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

/**
 * Vector math primitives for 384-dimensional embedding space.
 * All operations are pure functions; no external dependencies.
 */

const EMBEDDING_DIM = 384;

// ─── Basic operations ────────────────────────────────────────────────────────

/**
 * Dot product of two vectors.
 * @param {number[]|Float64Array} a
 * @param {number[]|Float64Array} b
 * @returns {number}
 */
function dotProduct(a, b) {
  if (a.length !== b.length) throw new RangeError(`dotProduct: dimension mismatch (${a.length} vs ${b.length})`);
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/**
 * Euclidean magnitude of a vector.
 * @param {number[]|Float64Array} v
 * @returns {number}
 */
function magnitude(v) {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  return Math.sqrt(sum);
}

/**
 * Normalize a vector to unit length. Returns a new Float64Array.
 * @param {number[]|Float64Array} v
 * @returns {Float64Array}
 */
function normalize(v) {
  const mag = magnitude(v);
  const out = new Float64Array(v.length);
  if (mag === 0) return out; // zero vector stays zero
  for (let i = 0; i < v.length; i++) out[i] = v[i] / mag;
  return out;
}

/**
 * Cosine similarity between two vectors (range −1 to 1).
 * @param {number[]|Float64Array} a
 * @param {number[]|Float64Array} b
 * @returns {number}
 */
function cosineSimilarity(a, b) {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

/**
 * Euclidean distance between two vectors.
 * @param {number[]|Float64Array} a
 * @param {number[]|Float64Array} b
 * @returns {number}
 */
function euclideanDistance(a, b) {
  if (a.length !== b.length) throw new RangeError(`euclideanDistance: dimension mismatch (${a.length} vs ${b.length})`);
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Element-wise addition of two vectors. Returns a new Float64Array.
 * @param {number[]|Float64Array} a
 * @param {number[]|Float64Array} b
 * @returns {Float64Array}
 */
function add(a, b) {
  if (a.length !== b.length) throw new RangeError(`add: dimension mismatch (${a.length} vs ${b.length})`);
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + b[i];
  return out;
}

/**
 * Element-wise subtraction (a − b). Returns a new Float64Array.
 * @param {number[]|Float64Array} a
 * @param {number[]|Float64Array} b
 * @returns {Float64Array}
 */
function subtract(a, b) {
  if (a.length !== b.length) throw new RangeError(`subtract: dimension mismatch (${a.length} vs ${b.length})`);
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] - b[i];
  return out;
}

/**
 * Scalar multiplication. Returns a new Float64Array.
 * @param {number[]|Float64Array} v
 * @param {number} scalar
 * @returns {Float64Array}
 */
function scale(v, scalar) {
  const out = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] * scalar;
  return out;
}

// ─── Higher-order operations ─────────────────────────────────────────────────

/**
 * Centroid (mean vector) of an array of vectors.
 * @param {Array<number[]|Float64Array>} vectors
 * @returns {Float64Array}
 */
function centroid(vectors) {
  if (!vectors || vectors.length === 0) throw new Error('centroid: empty vector array');
  const dim = vectors[0].length;
  const out = new Float64Array(dim);
  for (const v of vectors) {
    if (v.length !== dim) throw new RangeError('centroid: inconsistent dimensions');
    for (let i = 0; i < dim; i++) out[i] += v[i];
  }
  for (let i = 0; i < dim; i++) out[i] /= vectors.length;
  return out;
}

/**
 * Linear interpolation between two vectors at parameter t ∈ [0, 1].
 * @param {number[]|Float64Array} a  start
 * @param {number[]|Float64Array} b  end
 * @param {number} t  interpolation factor
 * @returns {Float64Array}
 */
function lerp(a, b, t) {
  if (a.length !== b.length) throw new RangeError(`lerp: dimension mismatch (${a.length} vs ${b.length})`);
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}

/**
 * Generate a random unit vector of the given dimensionality.
 * Uses Box-Muller for Gaussian sampling to ensure uniform distribution on sphere.
 * @param {number} [dimensions=EMBEDDING_DIM]
 * @returns {Float64Array}
 */
function randomVector(dimensions = EMBEDDING_DIM) {
  const raw = new Float64Array(dimensions);
  for (let i = 0; i < dimensions; i += 2) {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const r = Math.sqrt(-2 * Math.log(u1 + Number.EPSILON));
    const theta = 2 * Math.PI * u2;
    raw[i] = r * Math.cos(theta);
    if (i + 1 < dimensions) raw[i + 1] = r * Math.sin(theta);
  }
  return normalize(raw);
}

// ─── PCA via power iteration ──────────────────────────────────────────────────

/**
 * Basic PCA using power iteration (randomised SVD-lite).
 * Projects `vectors` down to `targetDims` principal components.
 *
 * @param {Array<number[]|Float64Array>} vectors  N × D matrix (array of row vectors)
 * @param {number} targetDims  desired output dimensions
 * @returns {Float64Array[]}  projected vectors (N × targetDims)
 */
function pca(vectors, targetDims) {
  if (!vectors || vectors.length === 0) throw new Error('pca: empty input');
  const N = vectors.length;
  const D = vectors[0].length;
  if (targetDims >= D) throw new RangeError(`pca: targetDims (${targetDims}) must be < source dims (${D})`);

  // 1. Centre the data
  const mean = centroid(vectors);
  const centred = vectors.map(v => subtract(v, mean));

  // 2. Extract `targetDims` principal components via deflation + power iteration
  const components = [];
  let residual = centred.map(v => Float64Array.from(v));

  for (let k = 0; k < targetDims; k++) {
    // Random initialisation
    let pc = randomVector(D);

    // Power iteration (30 iterations is usually sufficient for embedding dims)
    for (let iter = 0; iter < 30; iter++) {
      // Compute covariance-vector product: C^T * C * pc  (= X^T (X pc))
      // Step 1: project each row onto pc → scores
      const scores = residual.map(row => dotProduct(row, pc));
      // Step 2: reconstruct direction
      const next = new Float64Array(D);
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < D; j++) next[j] += scores[i] * residual[i][j];
      }
      pc = normalize(next);
    }

    components.push(pc);

    // Deflate: remove this component from residual
    residual = residual.map(row => {
      const proj = dotProduct(row, pc);
      return subtract(row, scale(pc, proj));
    });
  }

  // 3. Project original (centred) vectors onto components
  return centred.map(row => {
    const projected = new Float64Array(targetDims);
    for (let k = 0; k < targetDims; k++) projected[k] = dotProduct(row, components[k]);
    return projected;
  });
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  EMBEDDING_DIM,
  cosineSimilarity,
  euclideanDistance,
  dotProduct,
  normalize,
  magnitude,
  add,
  subtract,
  scale,
  centroid,
  lerp,
  randomVector,
  pca,
};
