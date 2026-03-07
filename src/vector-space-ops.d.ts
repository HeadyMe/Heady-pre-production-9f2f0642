/**
 * Vector math primitives for 384-dimensional embedding space.
 * All operations are pure functions; no external dependencies.
 */
export const EMBEDDING_DIM: 384;
/**
 * Cosine similarity between two vectors (range −1 to 1).
 * @param {number[]|Float64Array} a
 * @param {number[]|Float64Array} b
 * @returns {number}
 */
export function cosineSimilarity(a: number[] | Float64Array, b: number[] | Float64Array): number;
/**
 * Euclidean distance between two vectors.
 * @param {number[]|Float64Array} a
 * @param {number[]|Float64Array} b
 * @returns {number}
 */
export function euclideanDistance(a: number[] | Float64Array, b: number[] | Float64Array): number;
/**
 * Dot product of two vectors.
 * @param {number[]|Float64Array} a
 * @param {number[]|Float64Array} b
 * @returns {number}
 */
export function dotProduct(a: number[] | Float64Array, b: number[] | Float64Array): number;
/**
 * Normalize a vector to unit length. Returns a new Float64Array.
 * @param {number[]|Float64Array} v
 * @returns {Float64Array}
 */
export function normalize(v: number[] | Float64Array): Float64Array;
/**
 * Euclidean magnitude of a vector.
 * @param {number[]|Float64Array} v
 * @returns {number}
 */
export function magnitude(v: number[] | Float64Array): number;
/**
 * Element-wise addition of two vectors. Returns a new Float64Array.
 * @param {number[]|Float64Array} a
 * @param {number[]|Float64Array} b
 * @returns {Float64Array}
 */
export function add(a: number[] | Float64Array, b: number[] | Float64Array): Float64Array;
/**
 * Element-wise subtraction (a − b). Returns a new Float64Array.
 * @param {number[]|Float64Array} a
 * @param {number[]|Float64Array} b
 * @returns {Float64Array}
 */
export function subtract(a: number[] | Float64Array, b: number[] | Float64Array): Float64Array;
/**
 * Scalar multiplication. Returns a new Float64Array.
 * @param {number[]|Float64Array} v
 * @param {number} scalar
 * @returns {Float64Array}
 */
export function scale(v: number[] | Float64Array, scalar: number): Float64Array;
/**
 * Centroid (mean vector) of an array of vectors.
 * @param {Array<number[]|Float64Array>} vectors
 * @returns {Float64Array}
 */
export function centroid(vectors: Array<number[] | Float64Array>): Float64Array;
/**
 * Linear interpolation between two vectors at parameter t ∈ [0, 1].
 * @param {number[]|Float64Array} a  start
 * @param {number[]|Float64Array} b  end
 * @param {number} t  interpolation factor
 * @returns {Float64Array}
 */
export function lerp(a: number[] | Float64Array, b: number[] | Float64Array, t: number): Float64Array;
/**
 * Generate a random unit vector of the given dimensionality.
 * Uses Box-Muller for Gaussian sampling to ensure uniform distribution on sphere.
 * @param {number} [dimensions=EMBEDDING_DIM]
 * @returns {Float64Array}
 */
export function randomVector(dimensions?: number): Float64Array;
/**
 * Basic PCA using power iteration (randomised SVD-lite).
 * Projects `vectors` down to `targetDims` principal components.
 *
 * @param {Array<number[]|Float64Array>} vectors  N × D matrix (array of row vectors)
 * @param {number} targetDims  desired output dimensions
 * @returns {Float64Array[]}  projected vectors (N × targetDims)
 */
export function pca(vectors: Array<number[] | Float64Array>, targetDims: number): Float64Array[];
//# sourceMappingURL=vector-space-ops.d.ts.map