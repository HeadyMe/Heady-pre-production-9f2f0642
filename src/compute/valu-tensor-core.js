/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
// RTP: VALU Tensor Core - Math-as-a-Service

'use strict';

const PHI = 1.6180339887;

// ─── Tensor ───────────────────────────────────────────────────────────────────

class Tensor {
  /**
   * N-dimensional tensor backed by Float32Array.
   * Shape is stored as an Array<number>; data is row-major Float32Array.
   */
  constructor(shape, data = null) {
    this.shape  = shape.slice();
    this.ndim   = shape.length;
    this.size   = shape.reduce((a, b) => a * b, 1);
    this.data   = data instanceof Float32Array ? data : new Float32Array(this.size);
    if (data && !(data instanceof Float32Array)) {
      const flat = Tensor._flatten(data);
      for (let i = 0; i < flat.length && i < this.size; i++) this.data[i] = flat[i];
    }
    this._computeStrides();
  }

  _computeStrides() {
    this.strides = new Array(this.ndim);
    let s = 1;
    for (let i = this.ndim - 1; i >= 0; i--) {
      this.strides[i] = s;
      s *= this.shape[i];
    }
  }

  static _flatten(arr, out = []) {
    if (Array.isArray(arr)) { for (const v of arr) Tensor._flatten(v, out); }
    else out.push(Number(arr));
    return out;
  }

  /**
   * Get element at multi-dimensional index.
   */
  get(...indices) {
    let offset = 0;
    for (let i = 0; i < indices.length; i++) offset += indices[i] * this.strides[i];
    return this.data[offset];
  }

  set(value, ...indices) {
    let offset = 0;
    for (let i = 0; i < indices.length; i++) offset += indices[i] * this.strides[i];
    this.data[offset] = value;
    return this;
  }

  /**
   * Reshape to new shape (must have same total size).
   */
  reshape(newShape) {
    const newSize = newShape.reduce((a, b) => a * b, 1);
    if (newSize !== this.size) throw new Error(`Cannot reshape ${this.size} elements to shape [${newShape}]`);
    return new Tensor(newShape, this.data.slice());
  }

  /**
   * Return a flat copy as regular Array.
   */
  toArray() { return Array.from(this.data); }

  /**
   * Clone the tensor.
   */
  clone() { return new Tensor(this.shape, this.data.slice()); }

  toString() {
    return `Tensor(shape=[${this.shape}], dtype=float32)`;
  }

  /**
   * Create a tensor filled with zeros.
   */
  static zeros(shape) { return new Tensor(shape); }

  /**
   * Create a tensor filled with ones.
   */
  static ones(shape) {
    const t = new Tensor(shape);
    t.data.fill(1);
    return t;
  }

  /**
   * Create an identity matrix.
   */
  static eye(n) {
    const t = Tensor.zeros([n, n]);
    for (let i = 0; i < n; i++) t.set(1, i, i);
    return t;
  }

  /**
   * Create from nested JS array.
   */
  static from(arr) {
    const shape = [];
    let cur = arr;
    while (Array.isArray(cur)) { shape.push(cur.length); cur = cur[0]; }
    return new Tensor(shape, arr);
  }

  /**
   * Create from a range [start, stop, step].
   */
  static arange(start, stop, step = 1) {
    const values = [];
    for (let v = start; v < stop; v += step) values.push(v);
    return new Tensor([values.length], values);
  }

  /**
   * Create with random uniform values [0, 1).
   */
  static rand(shape) {
    const t = new Tensor(shape);
    for (let i = 0; i < t.size; i++) t.data[i] = Math.random();
    return t;
  }

  /**
   * Create with random normal values (Box-Muller).
   */
  static randn(shape) {
    const t = new Tensor(shape);
    for (let i = 0; i < t.size; i += 2) {
      const u1 = Math.random() || 1e-10;
      const u2 = Math.random();
      const r   = Math.sqrt(-2 * Math.log(u1));
      const th  = 2 * Math.PI * u2;
      t.data[i]   = r * Math.cos(th);
      if (i + 1 < t.size) t.data[i+1] = r * Math.sin(th);
    }
    return t;
  }
}

// ─── VectorArithmetic ─────────────────────────────────────────────────────────

class VectorArithmetic {
  /**
   * Element-wise addition of two tensors (with broadcasting support).
   */
  static add(a, b) { return VectorArithmetic._elementWise(a, b, (x, y) => x + y); }

  /**
   * Element-wise subtraction.
   */
  static subtract(a, b) { return VectorArithmetic._elementWise(a, b, (x, y) => x - y); }

  /**
   * Element-wise (Hadamard) product.
   */
  static hadamard(a, b) { return VectorArithmetic._elementWise(a, b, (x, y) => x * y); }

  /**
   * Outer product of two 1D vectors.
   */
  static outer(a, b) {
    if (a.ndim !== 1 || b.ndim !== 1) throw new Error('Outer product requires 1D tensors');
    const m = a.shape[0], n = b.shape[0];
    const out = Tensor.zeros([m, n]);
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        out.data[i * n + j] = a.data[i] * b.data[j];
      }
    }
    return out;
  }

  /**
   * Cross product of two 3D vectors.
   */
  static cross(a, b) {
    if (a.shape[0] !== 3 || b.shape[0] !== 3) throw new Error('Cross product requires 3D vectors');
    return new Tensor([3], [
      a.data[1] * b.data[2] - a.data[2] * b.data[1],
      a.data[2] * b.data[0] - a.data[0] * b.data[2],
      a.data[0] * b.data[1] - a.data[1] * b.data[0],
    ]);
  }

  /**
   * Dot product of two 1D or 2D tensors.
   */
  static dot(a, b) {
    if (a.ndim === 1 && b.ndim === 1) {
      if (a.shape[0] !== b.shape[0]) throw new Error('Dot product: shape mismatch');
      let sum = 0;
      for (let i = 0; i < a.size; i++) sum += a.data[i] * b.data[i];
      return sum;
    }
    return MatrixOps.multiply(a, b);
  }

  /**
   * L2 norm of a tensor.
   */
  static norm(a) {
    let sum = 0;
    for (let i = 0; i < a.size; i++) sum += a.data[i] * a.data[i];
    return Math.sqrt(sum);
  }

  /**
   * Normalize a vector to unit length.
   */
  static normalize(a) {
    const n = VectorArithmetic.norm(a);
    if (n === 0) throw new Error('Cannot normalize zero vector');
    const out = a.clone();
    for (let i = 0; i < out.size; i++) out.data[i] /= n;
    return out;
  }

  /**
   * Cosine similarity between two tensors.
   */
  static cosineSimilarity(a, b) {
    const dot = VectorArithmetic.dot(a, b);
    return dot / (VectorArithmetic.norm(a) * VectorArithmetic.norm(b));
  }

  static _elementWise(a, b, op) {
    // Simple broadcasting: scalar broadcast
    if (a.size === 1) {
      const out = b.clone();
      for (let i = 0; i < out.size; i++) out.data[i] = op(a.data[0], b.data[i]);
      return out;
    }
    if (b.size === 1) {
      const out = a.clone();
      for (let i = 0; i < out.size; i++) out.data[i] = op(a.data[i], b.data[0]);
      return out;
    }
    // Same shape or last-dim broadcast
    if (a.size !== b.size) {
      // Try broadcasting last dimension
      const bcastResult = VectorArithmetic._broadcast(a, b, op);
      if (bcastResult) return bcastResult;
      throw new Error(`Shape mismatch: [${a.shape}] vs [${b.shape}]`);
    }
    const out = a.clone();
    for (let i = 0; i < out.size; i++) out.data[i] = op(a.data[i], b.data[i]);
    return out;
  }

  static _broadcast(a, b, op) {
    // Broadcasting: a is [m, n], b is [n]
    if (a.ndim === 2 && b.ndim === 1 && a.shape[1] === b.shape[0]) {
      const [m, n] = a.shape;
      const out = Tensor.zeros([m, n]);
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
          out.data[i * n + j] = op(a.data[i * n + j], b.data[j]);
        }
      }
      return out;
    }
    return null;
  }
}

// ─── MatrixOps ────────────────────────────────────────────────────────────────

class MatrixOps {
  /**
   * Matrix multiplication (2D tensors).
   */
  static multiply(a, b) {
    if (a.ndim !== 2 || b.ndim !== 2) throw new Error('Matrix multiply requires 2D tensors');
    const [m, k]  = a.shape;
    const [k2, n] = b.shape;
    if (k !== k2) throw new Error(`Matrix shape mismatch: [${a.shape}] × [${b.shape}]`);

    const out = Tensor.zeros([m, n]);
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let l = 0; l < k; l++) sum += a.data[i * k + l] * b.data[l * n + j];
        out.data[i * n + j] = sum;
      }
    }
    return out;
  }

  /**
   * Matrix transpose.
   */
  static transpose(a) {
    if (a.ndim !== 2) throw new Error('Transpose requires 2D tensor');
    const [m, n] = a.shape;
    const out = Tensor.zeros([n, m]);
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        out.data[j * m + i] = a.data[i * n + j];
      }
    }
    return out;
  }

  /**
   * Determinant (recursive Leibniz, for small matrices).
   */
  static determinant(a) {
    if (a.ndim !== 2 || a.shape[0] !== a.shape[1]) {
      throw new Error('Determinant requires square 2D tensor');
    }
    return MatrixOps._det(a.data, a.shape[0]);
  }

  static _det(data, n) {
    if (n === 1) return data[0];
    if (n === 2) return data[0] * data[3] - data[1] * data[2];
    let det = 0;
    for (let col = 0; col < n; col++) {
      const minor = MatrixOps._minor(data, n, 0, col);
      det += (col % 2 === 0 ? 1 : -1) * data[col] * MatrixOps._det(minor, n - 1);
    }
    return det;
  }

  static _minor(data, n, row, col) {
    const minor = [];
    for (let r = 0; r < n; r++) {
      if (r === row) continue;
      for (let c = 0; c < n; c++) {
        if (c === col) continue;
        minor.push(data[r * n + c]);
      }
    }
    return minor;
  }

  /**
   * Matrix inverse using Gauss-Jordan elimination.
   */
  static inverse(a) {
    if (a.ndim !== 2 || a.shape[0] !== a.shape[1]) {
      throw new Error('Inverse requires square 2D tensor');
    }
    const n   = a.shape[0];
    const aug = [];
    for (let i = 0; i < n; i++) {
      aug.push([...Array.from(a.data.slice(i * n, (i + 1) * n)),
                ...Array.from(Tensor.eye(n).data.slice(i * n, (i + 1) * n))]);
    }

    for (let col = 0; col < n; col++) {
      // Pivot
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
      }
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

      const pivot = aug[col][col];
      if (Math.abs(pivot) < 1e-10) throw new Error('Matrix is singular');

      for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

      for (let row = 0; row < n; row++) {
        if (row === col) continue;
        const factor = aug[row][col];
        for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
      }
    }

    const result = Tensor.zeros([n, n]);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) result.data[i * n + j] = aug[i][n + j];
    }
    return result;
  }

  /**
   * Eigendecomposition stub using power iteration for dominant eigenvalue.
   * Returns { values: number[], vectors: Tensor[] }
   */
  static eigenDecompositionStub(a, maxIter = 100, tol = 1e-6) {
    if (a.ndim !== 2 || a.shape[0] !== a.shape[1]) {
      throw new Error('Eigen requires square 2D tensor');
    }
    const n = a.shape[0];
    const results = [];

    // Power iteration for top-k eigenvalues (k = min(n, 3))
    const k = Math.min(n, 3);
    let deflated = a.clone();

    for (let ev = 0; ev < k; ev++) {
      let b = Tensor.rand([n, 1]);
      b = VectorArithmetic.normalize(b.reshape([n])).reshape([n, 1]);

      let eigenvalue = 0;
      for (let iter = 0; iter < maxIter; iter++) {
        const Ab     = MatrixOps.multiply(deflated, b);
        const norm   = VectorArithmetic.norm(Ab.reshape([n]));
        const prevEv = eigenvalue;
        eigenvalue   = norm;
        b = new Tensor([n, 1], Ab.data.map(v => v / norm));
        if (Math.abs(eigenvalue - prevEv) < tol) break;
      }

      results.push({ value: eigenvalue, vector: b.reshape([n]) });

      // Deflate: A = A - λ * v * vT
      const vvT = VectorArithmetic.outer(b.reshape([n]), b.reshape([n]));
      deflated = VectorArithmetic.subtract(
        deflated,
        VectorArithmetic._elementWise(vvT, new Tensor([1], [eigenvalue]), (x, y) => x * y)
      );
    }

    return {
      values:  results.map(r => r.value),
      vectors: results.map(r => r.vector),
    };
  }
}

// ─── VALUCore (reduction & broadcasting) ─────────────────────────────────────

class VALUCore {
  /**
   * Tensor sum along axis or total.
   */
  static sum(t, axis = null) {
    if (axis === null) {
      let s = 0; for (let i = 0; i < t.size; i++) s += t.data[i];
      return s;
    }
    return VALUCore._reduce(t, axis, 0, (a, b) => a + b);
  }

  static mean(t, axis = null) {
    if (axis === null) {
      let s = 0; for (let i = 0; i < t.size; i++) s += t.data[i];
      return s / t.size;
    }
    const reduced = VALUCore._reduce(t, axis, 0, (a, b) => a + b);
    for (let i = 0; i < reduced.size; i++) reduced.data[i] /= t.shape[axis];
    return reduced;
  }

  static max(t, axis = null) {
    if (axis === null) {
      let m = -Infinity; for (let i = 0; i < t.size; i++) if (t.data[i] > m) m = t.data[i];
      return m;
    }
    return VALUCore._reduce(t, axis, -Infinity, (a, b) => Math.max(a, b));
  }

  static min(t, axis = null) {
    if (axis === null) {
      let m = Infinity; for (let i = 0; i < t.size; i++) if (t.data[i] < m) m = t.data[i];
      return m;
    }
    return VALUCore._reduce(t, axis, Infinity, (a, b) => Math.min(a, b));
  }

  static _reduce(t, axis, init, fn) {
    if (t.ndim !== 2) throw new Error('Axis reduce currently supports 2D tensors');
    const [m, n] = t.shape;
    if (axis === 0) {
      const out = new Tensor([n]); out.data.fill(init);
      for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
        out.data[j] = fn(out.data[j], t.data[i * n + j]);
      }
      return out;
    } else {
      const out = new Tensor([m]); out.data.fill(init);
      for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
        out.data[i] = fn(out.data[i], t.data[i * n + j]);
      }
      return out;
    }
  }

  /**
   * Softmax along last axis (2D: row-wise).
   */
  static softmax(t) {
    if (t.ndim !== 2) throw new Error('Softmax requires 2D tensor');
    const [m, n] = t.shape;
    const out = Tensor.zeros([m, n]);
    for (let i = 0; i < m; i++) {
      let maxVal = -Infinity;
      for (let j = 0; j < n; j++) if (t.data[i * n + j] > maxVal) maxVal = t.data[i * n + j];
      let expSum = 0;
      for (let j = 0; j < n; j++) { out.data[i * n + j] = Math.exp(t.data[i * n + j] - maxVal); expSum += out.data[i * n + j]; }
      for (let j = 0; j < n; j++) out.data[i * n + j] /= expSum;
    }
    return out;
  }

  /**
   * ReLU activation.
   */
  static relu(t) {
    const out = t.clone();
    for (let i = 0; i < out.size; i++) if (out.data[i] < 0) out.data[i] = 0;
    return out;
  }

  /**
   * Apply a scalar function to all elements.
   */
  static map(t, fn) {
    const out = t.clone();
    for (let i = 0; i < out.size; i++) out.data[i] = fn(out.data[i]);
    return out;
  }
}

// ─── TensorRegistry ───────────────────────────────────────────────────────────

class TensorRegistry {
  constructor() {
    this._tensors = new Map();
    this._metadata = new Map();
  }

  register(name, tensor, meta = {}) {
    this._tensors.set(name, tensor);
    this._metadata.set(name, { ...meta, registeredAt: Date.now(), shape: tensor.shape.slice() });
    return this;
  }

  get(name) {
    const t = this._tensors.get(name);
    if (!t) throw new Error(`Tensor '${name}' not found in registry`);
    return t;
  }

  delete(name) { this._tensors.delete(name); this._metadata.delete(name); return this; }

  list() {
    return Array.from(this._tensors.keys()).map(name => ({
      name,
      ...this._metadata.get(name),
    }));
  }

  has(name) { return this._tensors.has(name); }
  size()    { return this._tensors.size; }
}

// ─── MathService ──────────────────────────────────────────────────────────────

class MathService {
  /**
   * REST-callable math operations.
   * Maps operation names to implementations.
   */
  constructor(opts = {}) {
    this._registry = opts.registry || new TensorRegistry();
    this._ops      = this._buildOps();
    this._callLog  = [];
  }

  _buildOps() {
    return {
      // Tensor creation
      zeros:   ({ shape })              => Tensor.zeros(shape),
      ones:    ({ shape })              => Tensor.ones(shape),
      eye:     ({ n })                  => Tensor.eye(n),
      rand:    ({ shape })              => Tensor.rand(shape),
      randn:   ({ shape })              => Tensor.randn(shape),
      arange:  ({ start, stop, step })  => Tensor.arange(start, stop, step),
      from:    ({ data })               => Tensor.from(data),

      // Arithmetic
      add:      ({ a, b })     => VectorArithmetic.add(this._resolve(a), this._resolve(b)),
      subtract: ({ a, b })     => VectorArithmetic.subtract(this._resolve(a), this._resolve(b)),
      hadamard: ({ a, b })     => VectorArithmetic.hadamard(this._resolve(a), this._resolve(b)),
      outer:    ({ a, b })     => VectorArithmetic.outer(this._resolve(a), this._resolve(b)),
      cross:    ({ a, b })     => VectorArithmetic.cross(this._resolve(a), this._resolve(b)),
      dot:      ({ a, b })     => VectorArithmetic.dot(this._resolve(a), this._resolve(b)),
      norm:     ({ a })        => VectorArithmetic.norm(this._resolve(a)),
      normalize:({ a })        => VectorArithmetic.normalize(this._resolve(a)),
      cosine:   ({ a, b })     => VectorArithmetic.cosineSimilarity(this._resolve(a), this._resolve(b)),

      // Matrix ops
      matmul:   ({ a, b })     => MatrixOps.multiply(this._resolve(a), this._resolve(b)),
      transpose:({ a })        => MatrixOps.transpose(this._resolve(a)),
      inverse:  ({ a })        => MatrixOps.inverse(this._resolve(a)),
      det:      ({ a })        => MatrixOps.determinant(this._resolve(a)),
      eigen:    ({ a })        => MatrixOps.eigenDecompositionStub(this._resolve(a)),

      // Reductions
      sum:      ({ a, axis })  => VALUCore.sum(this._resolve(a), axis),
      mean:     ({ a, axis })  => VALUCore.mean(this._resolve(a), axis),
      max:      ({ a, axis })  => VALUCore.max(this._resolve(a), axis),
      min:      ({ a, axis })  => VALUCore.min(this._resolve(a), axis),
      softmax:  ({ a })        => VALUCore.softmax(this._resolve(a)),
      relu:     ({ a })        => VALUCore.relu(this._resolve(a)),
      reshape:  ({ a, shape }) => this._resolve(a).reshape(shape),
    };
  }

  _resolve(input) {
    if (input instanceof Tensor) return input;
    if (typeof input === 'string') return this._registry.get(input);
    if (Array.isArray(input) || (input && input.shape)) return Tensor.from(input);
    throw new Error(`Cannot resolve tensor from: ${typeof input}`);
  }

  /**
   * Execute a named operation with given arguments.
   */
  execute(op, args = {}) {
    const fn = this._ops[op];
    if (!fn) throw new Error(`Unknown operation: ${op}`);

    const start  = Date.now();
    const result = fn(args);
    const ms     = Date.now() - start;

    this._callLog.push({ op, ms, ts: Date.now() });
    if (this._callLog.length > 1000) this._callLog.shift();

    return result;
  }

  /**
   * Handle a REST-style request object.
   */
  handleRequest(req) {
    const { op, args = {}, store } = req;
    try {
      const result = this.execute(op, args);
      if (store && result instanceof Tensor) {
        this._registry.register(store, result);
      }
      return {
        ok:     true,
        result: result instanceof Tensor
          ? { shape: result.shape, data: Array.from(result.data) }
          : result,
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  getRegistry() { return this._registry; }
  getCallLog()  { return this._callLog.slice(); }
}

// ─── BatchProcessor ───────────────────────────────────────────────────────────

class BatchProcessor {
  /**
   * Process arrays of tensor operations.
   */
  constructor(opts = {}) {
    this._service      = opts.service || new MathService();
    this._concurrency  = opts.concurrency || 4;
  }

  /**
   * Execute a batch of operation requests, returning results in order.
   */
  async processBatch(operations) {
    const results = new Array(operations.length);
    const chunks  = this._chunk(operations, this._concurrency);

    let offset = 0;
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(op => Promise.resolve(this._service.handleRequest(op)))
      );
      for (let i = 0; i < chunkResults.length; i++) {
        results[offset + i] = chunkResults[i];
      }
      offset += chunk.length;
    }

    return results;
  }

  _chunk(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  }

  getService() { return this._service; }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  PHI,
  Tensor,
  VectorArithmetic,
  MatrixOps,
  VALUCore,
  TensorRegistry,
  MathService,
  BatchProcessor,
};
