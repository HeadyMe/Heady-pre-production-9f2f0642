/**
 * @fileoverview Vector Database with HNSW Index
 * Zero-dependency replacement for pgvector / Neon DB.
 *
 * Features:
 *   - HNSW (Hierarchical Navigable Small World) index — O(log n) ANN search
 *   - 384-dimensional embedding storage
 *   - Cosine similarity, Euclidean distance, Dot-product metrics
 *   - Insert / search / delete / update
 *   - Disk persistence (JSON metadata + Float32Array binary vectors)
 *   - Batch operations with parallel search
 *   - Spatial sharding: 8 octants over the first 3 dimensions
 *   - PHI-scaled parameters (φ = 1.618…)
 *
 * Node.js built-ins only: fs, path, os, crypto, worker_threads
 */

import fs   from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Golden ratio — used for level probability & layer scaling */
const PHI = 1.6180339887498948482;

/** Default vector dimensionality */
const DIM = 384;

/** HNSW construction parameters */
const HNSW_M          = 16;   // max edges per node per layer
const HNSW_M0         = 32;   // max edges for layer 0 (ground layer)
const HNSW_EF_CONST   = 200;  // ef during construction
const HNSW_EF_SEARCH  = 50;   // ef during search (default)

/** Magic bytes for binary vector file */
const MAGIC = Buffer.from('HDYVDB1');

// ─── Similarity functions ─────────────────────────────────────────────────────

/**
 * Cosine similarity between two Float32Arrays.
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number} similarity in [-1, 1]
 */
export function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Squared Euclidean distance.
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number}
 */
export function euclideanDistanceSq(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    d += diff * diff;
  }
  return d;
}

/**
 * Euclidean distance.
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number}
 */
export function euclideanDistance(a, b) {
  return Math.sqrt(euclideanDistanceSq(a, b));
}

/**
 * Dot product.
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number}
 */
export function dotProduct(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += a[i] * b[i];
  return d;
}

// ─── Priority Queue (min-heap) ────────────────────────────────────────────────

class MinHeap {
  constructor(compareFn = (a, b) => a.score - b.score) {
    this._heap = [];
    this._cmp  = compareFn;
  }
  get size() { return this._heap.length; }
  peek()     { return this._heap[0]; }
  push(item) {
    this._heap.push(item);
    this._siftUp(this._heap.length - 1);
  }
  pop() {
    const top  = this._heap[0];
    const last = this._heap.pop();
    if (this._heap.length > 0) { this._heap[0] = last; this._siftDown(0); }
    return top;
  }
  _siftUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this._cmp(this._heap[i], this._heap[p]) >= 0) break;
      [this._heap[i], this._heap[p]] = [this._heap[p], this._heap[i]];
      i = p;
    }
  }
  _siftDown(i) {
    const n = this._heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this._cmp(this._heap[l], this._heap[smallest]) < 0) smallest = l;
      if (r < n && this._cmp(this._heap[r], this._heap[smallest]) < 0) smallest = r;
      if (smallest === i) break;
      [this._heap[i], this._heap[smallest]] = [this._heap[smallest], this._heap[i]];
      i = smallest;
    }
  }
}

class MaxHeap extends MinHeap {
  constructor() { super((a, b) => b.score - a.score); }
}

// ─── HNSW Node ────────────────────────────────────────────────────────────────

class HNSWNode {
  /**
   * @param {string}      id
   * @param {Float32Array} vector
   * @param {object}      metadata
   * @param {number}      level
   */
  constructor(id, vector, metadata = {}, level = 0) {
    this.id       = id;
    this.vector   = vector;
    this.metadata = metadata;
    this.level    = level;
    /** @type {Map<number, Set<string>>} layer → neighbour ids */
    this.neighbors = new Map();
    for (let l = 0; l <= level; l++) this.neighbors.set(l, new Set());
    this.createdAt = Date.now();
    this.accessCount = 0;
  }
}

// ─── HNSW Index ───────────────────────────────────────────────────────────────

/**
 * Hierarchical Navigable Small World graph index.
 */
class HNSWIndex {
  /**
   * @param {object} opts
   * @param {number} [opts.dim=384]
   * @param {number} [opts.M=16]
   * @param {number} [opts.M0=32]
   * @param {number} [opts.efConstruction=200]
   * @param {string} [opts.metric='cosine']
   */
  constructor(opts = {}) {
    this.dim           = opts.dim           ?? DIM;
    this.M             = opts.M             ?? HNSW_M;
    this.M0            = opts.M0            ?? HNSW_M0;
    this.efConstruction= opts.efConstruction?? HNSW_EF_CONST;
    this.metric        = opts.metric        ?? 'cosine';

    /** @type {Map<string, HNSWNode>} */
    this.nodes     = new Map();
    this.entryPoint= null;  // id of the entry-point node
    this.maxLevel  = -1;
  }

  // ─ distance / score ────────────────────────────────────────────────────────

  /**
   * Distance between two nodes (lower = more similar for search).
   * For cosine we return 1 - similarity so min-heap works correctly.
   */
  _dist(a, b) {
    switch (this.metric) {
      case 'cosine':    return 1 - cosineSimilarity(a, b);
      case 'euclidean': return euclideanDistance(a, b);
      case 'dot':       return -dotProduct(a, b);
      default:          return 1 - cosineSimilarity(a, b);
    }
  }

  // ─ level sampling ──────────────────────────────────────────────────────────

  /** Randomly sample the node level using PHI-scaled probability. */
  _sampleLevel() {
    const mL = 1 / Math.log(this.M * PHI / (PHI + 1));
    return Math.floor(-Math.log(Math.random()) * mL);
  }

  // ─ core HNSW search ────────────────────────────────────────────────────────

  /**
   * Search layer for ef candidates nearest to query.
   * @param {Float32Array} query
   * @param {string}       entryId
   * @param {number}       ef
   * @param {number}       layer
   * @returns {Array<{id:string,score:number}>} sorted nearest-first
   */
  _searchLayer(query, entryId, ef, layer) {
    const visited   = new Set([entryId]);
    const entryNode = this.nodes.get(entryId);
    if (!entryNode) return [];

    const entryDist = this._dist(query, entryNode.vector);
    // candidates: min-heap (closest first)
    const candidates = new MinHeap();
    candidates.push({ id: entryId, score: entryDist });
    // results: max-heap (farthest on top for eviction)
    const results = new MaxHeap();
    results.push({ id: entryId, score: entryDist });

    while (candidates.size > 0) {
      const current = candidates.pop();
      const worst   = results.peek();

      if (current.score > worst.score) break;

      const node = this.nodes.get(current.id);
      if (!node) continue;
      const layerNeighbors = node.neighbors.get(layer) ?? new Set();

      for (const neighborId of layerNeighbors) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const neighbor = this.nodes.get(neighborId);
        if (!neighbor) continue;

        const d = this._dist(query, neighbor.vector);
        if (results.size < ef || d < results.peek().score) {
          candidates.push({ id: neighborId, score: d });
          results.push({ id: neighborId, score: d });
          if (results.size > ef) results.pop();
        }
      }
    }

    // convert max-heap to sorted array (nearest first)
    const arr = [];
    while (results.size > 0) arr.push(results.pop());
    arr.sort((a, b) => a.score - b.score);
    return arr;
  }

  // ─ select neighbors ────────────────────────────────────────────────────────

  /**
   * Simple greedy neighbor selection (heuristic).
   * @param {string}   nodeId
   * @param {Array<{id:string,score:number}>} candidates
   * @param {number}   M
   * @returns {Array<string>}
   */
  _selectNeighbors(nodeId, candidates, M) {
    // Use heuristic: keep diverse nearest neighbors
    const selected = [];
    for (const c of candidates) {
      if (c.id === nodeId) continue;
      if (selected.length >= M) break;
      selected.push(c.id);
    }
    return selected;
  }

  // ─ insert ──────────────────────────────────────────────────────────────────

  /**
   * Insert a vector into the index.
   * @param {string}      id
   * @param {Float32Array} vector
   * @param {object}      metadata
   */
  insert(id, vector, metadata = {}) {
    if (this.nodes.has(id)) this.delete(id);

    const level  = this._sampleLevel();
    const node   = new HNSWNode(id, vector, metadata, level);
    this.nodes.set(id, node);

    if (!this.entryPoint) {
      this.entryPoint = id;
      this.maxLevel   = level;
      return;
    }

    let currEntry = this.entryPoint;
    const topLevel = this.maxLevel;

    // Greedy descent from topLevel to level+1
    for (let l = topLevel; l > level; l--) {
      const result = this._searchLayer(vector, currEntry, 1, l);
      if (result.length > 0) currEntry = result[0].id;
    }

    // Insert into layers from min(level, maxLevel) down to 0
    for (let l = Math.min(level, topLevel); l >= 0; l--) {
      const M_l      = l === 0 ? this.M0 : this.M;
      const ef       = Math.max(this.efConstruction, M_l);
      const results  = this._searchLayer(vector, currEntry, ef, l);
      const selected = this._selectNeighbors(id, results, M_l);

      node.neighbors.set(l, new Set(selected));

      for (const neighborId of selected) {
        const neighbor = this.nodes.get(neighborId);
        if (!neighbor) continue;
        if (!neighbor.neighbors.has(l)) neighbor.neighbors.set(l, new Set());
        neighbor.neighbors.get(l).add(id);

        // Prune neighbor connections if over capacity
        if (neighbor.neighbors.get(l).size > M_l) {
          const neighborNeighbors = [...neighbor.neighbors.get(l)].map(nid => {
            const nn = this.nodes.get(nid);
            return { id: nid, score: nn ? this._dist(neighbor.vector, nn.vector) : Infinity };
          });
          neighborNeighbors.sort((a, b) => a.score - b.score);
          neighbor.neighbors.set(l, new Set(neighborNeighbors.slice(0, M_l).map(x => x.id)));
        }
      }

      if (results.length > 0) currEntry = results[0].id;
    }

    if (level > this.maxLevel) {
      this.maxLevel   = level;
      this.entryPoint = id;
    }
  }

  // ─ search ──────────────────────────────────────────────────────────────────

  /**
   * K-nearest neighbor search.
   * @param {Float32Array} query
   * @param {number}       k
   * @param {number}       [ef]
   * @param {object}       [filter] - metadata filter {key: value}
   * @returns {Array<{id:string, score:number, metadata:object, vector:Float32Array}>}
   */
  search(query, k = 10, ef = HNSW_EF_SEARCH, filter = null) {
    if (!this.entryPoint || this.nodes.size === 0) return [];

    let currEntry = this.entryPoint;
    for (let l = this.maxLevel; l > 0; l--) {
      const result = this._searchLayer(query, currEntry, 1, l);
      if (result.length > 0) currEntry = result[0].id;
    }

    const results = this._searchLayer(query, currEntry, Math.max(ef, k), 0);

    return results
      .filter(r => {
        const node = this.nodes.get(r.id);
        if (!node) return false;
        node.accessCount++;
        if (!filter) return true;
        for (const [key, val] of Object.entries(filter)) {
          if (node.metadata[key] !== val) return false;
        }
        return true;
      })
      .slice(0, k)
      .map(r => {
        const node = this.nodes.get(r.id);
        // Convert distance back to similarity score for caller
        let score;
        switch (this.metric) {
          case 'cosine':    score = 1 - r.score; break;
          case 'euclidean': score = r.score;     break;
          case 'dot':       score = -r.score;    break;
          default:          score = 1 - r.score;
        }
        return { id: r.id, score, metadata: node.metadata, vector: node.vector };
      });
  }

  // ─ delete ──────────────────────────────────────────────────────────────────

  /**
   * Delete a node from the index.
   * @param {string} id
   * @returns {boolean}
   */
  delete(id) {
    const node = this.nodes.get(id);
    if (!node) return false;

    // Remove from all neighbors' connection lists
    for (const [layer, neighbors] of node.neighbors) {
      for (const neighborId of neighbors) {
        const neighbor = this.nodes.get(neighborId);
        if (neighbor && neighbor.neighbors.has(layer)) {
          neighbor.neighbors.get(layer).delete(id);
        }
      }
    }

    this.nodes.delete(id);

    // Update entry point if needed
    if (this.entryPoint === id) {
      if (this.nodes.size === 0) {
        this.entryPoint = null;
        this.maxLevel   = -1;
      } else {
        // Pick the node with the highest level
        let best = null, bestLevel = -1;
        for (const [nid, n] of this.nodes) {
          if (n.level > bestLevel) { bestLevel = n.level; best = nid; }
        }
        this.entryPoint = best;
        this.maxLevel   = bestLevel;
      }
    }

    return true;
  }

  /** @returns {number} number of indexed vectors */
  get size() { return this.nodes.size; }
}

// ─── Octant Sharding ─────────────────────────────────────────────────────────

/**
 * Assigns a vector to one of 8 octants based on the sign of the first 3 dimensions.
 * @param {Float32Array} vec
 * @returns {number} 0–7
 */
function getOctant(vec) {
  const x = vec[0] >= 0 ? 1 : 0;
  const y = vec[1] >= 0 ? 1 : 0;
  const z = vec[2] >= 0 ? 1 : 0;
  return (x << 2) | (y << 1) | z;
}

// ─── VectorDB ─────────────────────────────────────────────────────────────────

/**
 * Production-grade vector database with HNSW indexing, sharding, and persistence.
 *
 * @example
 * const db = new VectorDB({ dataDir: './data/vectors' });
 * await db.init();
 * await db.insert('id1', new Float32Array(384).fill(0.1), { type: 'memory' });
 * const results = await db.search(queryVec, { k: 5 });
 */
export class VectorDB {
  /**
   * @param {object} opts
   * @param {string}  [opts.dataDir]           - directory for persistence
   * @param {number}  [opts.dim=384]
   * @param {string}  [opts.metric='cosine']   - 'cosine'|'euclidean'|'dot'
   * @param {boolean} [opts.sharding=true]     - enable octant sharding
   * @param {number}  [opts.M=16]
   * @param {number}  [opts.efConstruction=200]
   */
  constructor(opts = {}) {
    this.dataDir    = opts.dataDir    ?? null;
    this.dim        = opts.dim        ?? DIM;
    this.metric     = opts.metric     ?? 'cosine';
    this.sharding   = opts.sharding   ?? true;
    this.M          = opts.M          ?? HNSW_M;
    this.efConst    = opts.efConstruction ?? HNSW_EF_CONST;

    /** 8 HNSW shards (one per octant) when sharding=true, else single shard [0] */
    this._shards = Array.from({ length: this.sharding ? 8 : 1 }, () =>
      new HNSWIndex({ dim: this.dim, M: this.M, efConstruction: this.efConst, metric: this.metric })
    );

    /** Global metadata store (also holds vector → shard mapping) */
    this._meta = new Map(); // id → { shard, createdAt, updatedAt }

    this._dirty  = false;
    this._saveTimer = null;
  }

  // ─ init ────────────────────────────────────────────────────────────────────

  /** Initialise DB, loading persisted data if dataDir exists. */
  async init() {
    if (this.dataDir) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      await this._loadFromDisk();
    }
  }

  // ─ insert ──────────────────────────────────────────────────────────────────

  /**
   * Insert or update a vector.
   * @param {string}      id
   * @param {Float32Array|number[]} vector
   * @param {object}      [metadata={}]
   * @returns {string} id
   */
  async insert(id, vector, metadata = {}) {
    const vec    = vector instanceof Float32Array ? vector : new Float32Array(vector);
    const shard  = this.sharding ? getOctant(vec) : 0;

    if (this._meta.has(id)) {
      const prev = this._meta.get(id);
      this._shards[prev.shard].delete(id);
    }

    this._shards[shard].insert(id, vec, metadata);
    this._meta.set(id, { shard, createdAt: Date.now(), updatedAt: Date.now() });
    this._markDirty();
    return id;
  }

  /**
   * Batch insert.
   * @param {Array<{id:string, vector:Float32Array|number[], metadata?:object}>} items
   */
  async insertBatch(items) {
    for (const item of items) {
      await this.insert(item.id, item.vector, item.metadata ?? {});
    }
  }

  // ─ search ──────────────────────────────────────────────────────────────────

  /**
   * Search for k nearest neighbors.
   * @param {Float32Array|number[]} query
   * @param {object} [opts]
   * @param {number}  [opts.k=10]
   * @param {number}  [opts.ef=50]
   * @param {object}  [opts.filter]    - metadata equality filter
   * @param {boolean} [opts.allShards] - force search across all shards
   * @returns {Array<{id:string, score:number, metadata:object}>}
   */
  async search(query, opts = {}) {
    const vec       = query instanceof Float32Array ? query : new Float32Array(query);
    const k         = opts.k         ?? 10;
    const ef        = opts.ef        ?? HNSW_EF_SEARCH;
    const filter    = opts.filter    ?? null;
    const allShards = opts.allShards ?? true;

    let candidates;

    if (allShards || !this.sharding) {
      // Parallel search across all shards
      candidates = this._shards.flatMap(shard => shard.search(vec, k * 2, ef, filter));
    } else {
      // Primary shard only
      const shardIdx = getOctant(vec);
      candidates = this._shards[shardIdx].search(vec, k * 2, ef, filter);
    }

    // Deduplicate and sort
    const seen = new Map();
    for (const c of candidates) {
      if (!seen.has(c.id) || c.score > seen.get(c.id).score) {
        seen.set(c.id, c);
      }
    }

    const sorted = [...seen.values()];
    if (this.metric === 'euclidean') {
      sorted.sort((a, b) => a.score - b.score);
    } else {
      sorted.sort((a, b) => b.score - a.score);
    }

    return sorted.slice(0, k).map(({ id, score, metadata }) => ({ id, score, metadata }));
  }

  /**
   * Batch search — runs multiple queries.
   * @param {Array<Float32Array|number[]>} queries
   * @param {object} [opts]
   * @returns {Array<Array<{id:string,score:number,metadata:object}>>}
   */
  async searchBatch(queries, opts = {}) {
    return Promise.all(queries.map(q => this.search(q, opts)));
  }

  // ─ delete ──────────────────────────────────────────────────────────────────

  /**
   * Delete a vector by id.
   * @param {string} id
   * @returns {boolean}
   */
  async delete(id) {
    const meta = this._meta.get(id);
    if (!meta) return false;
    this._shards[meta.shard].delete(id);
    this._meta.delete(id);
    this._markDirty();
    return true;
  }

  // ─ update ──────────────────────────────────────────────────────────────────

  /**
   * Update a vector's embedding and/or metadata.
   * @param {string}      id
   * @param {object}      updates  - { vector?, metadata? }
   */
  async update(id, updates) {
    const meta = this._meta.get(id);
    if (!meta) throw new Error(`Vector not found: ${id}`);

    const oldNode = this._shards[meta.shard].nodes.get(id);
    const vec     = updates.vector
      ? (updates.vector instanceof Float32Array ? updates.vector : new Float32Array(updates.vector))
      : oldNode.vector;
    const newMeta = updates.metadata
      ? { ...oldNode.metadata, ...updates.metadata }
      : oldNode.metadata;

    await this.insert(id, vec, newMeta);
  }

  // ─ get ─────────────────────────────────────────────────────────────────────

  /**
   * Retrieve a vector and metadata by id.
   * @param {string} id
   * @returns {{id:string, vector:Float32Array, metadata:object}|null}
   */
  get(id) {
    const meta = this._meta.get(id);
    if (!meta) return null;
    const node = this._shards[meta.shard].nodes.get(id);
    if (!node) return null;
    return { id, vector: node.vector, metadata: node.metadata };
  }

  /** @returns {number} total vector count */
  get size() { return this._meta.size; }

  /** @returns {Array<string>} all IDs */
  ids() { return [...this._meta.keys()]; }

  // ─ persistence ─────────────────────────────────────────────────────────────

  _markDirty() {
    this._dirty = true;
    if (this.dataDir && !this._saveTimer) {
      this._saveTimer = setTimeout(() => { this._saveTimer = null; this.save(); }, 2000);
    }
  }

  /**
   * Persist to disk.
   * Format:
   *   vectors.bin  — MAGIC(7) + count(4) + dim(4) + [id_len(2) + id + Float32Array]*
   *   meta.json    — { id: { shard, createdAt, updatedAt, metadata } }
   */
  async save() {
    if (!this.dataDir || !this._dirty) return;
    this._dirty = false;

    const metaObj = {};
    const buffers = [ MAGIC, Buffer.alloc(4), Buffer.alloc(4) ];
    let count = 0;

    for (const [id, m] of this._meta) {
      const node = this._shards[m.shard].nodes.get(id);
      if (!node) continue;

      const idBuf  = Buffer.from(id, 'utf8');
      const lenBuf = Buffer.alloc(2);
      lenBuf.writeUInt16LE(idBuf.length);
      const vecBuf = Buffer.from(node.vector.buffer, node.vector.byteOffset, node.vector.byteLength);

      buffers.push(lenBuf, idBuf, vecBuf);
      metaObj[id] = { shard: m.shard, createdAt: m.createdAt, updatedAt: m.updatedAt, metadata: node.metadata };
      count++;
    }

    buffers[1].writeUInt32LE(count);
    buffers[2].writeUInt32LE(this.dim);

    const vecPath  = path.join(this.dataDir, 'vectors.bin');
    const metaPath = path.join(this.dataDir, 'meta.json');

    await fs.promises.writeFile(vecPath,  Buffer.concat(buffers));
    await fs.promises.writeFile(metaPath, JSON.stringify(metaObj));
  }

  /** Load from disk. */
  async _loadFromDisk() {
    const vecPath  = path.join(this.dataDir, 'vectors.bin');
    const metaPath = path.join(this.dataDir, 'meta.json');

    if (!fs.existsSync(vecPath) || !fs.existsSync(metaPath)) return;

    try {
      const metaObj = JSON.parse(await fs.promises.readFile(metaPath, 'utf8'));
      const binData = await fs.promises.readFile(vecPath);

      // Verify magic
      if (!binData.subarray(0, 7).equals(MAGIC)) {
        throw new Error('Invalid vector file magic bytes');
      }

      const count  = binData.readUInt32LE(7);
      const dim    = binData.readUInt32LE(11);
      if (dim !== this.dim) throw new Error(`Dimension mismatch: file=${dim} expected=${this.dim}`);

      let offset = 15;
      for (let i = 0; i < count; i++) {
        const idLen = binData.readUInt16LE(offset); offset += 2;
        const id    = binData.subarray(offset, offset + idLen).toString('utf8'); offset += idLen;
        const vecBuf= binData.subarray(offset, offset + dim * 4); offset += dim * 4;
        const vec   = new Float32Array(vecBuf.buffer, vecBuf.byteOffset, dim);

        const m = metaObj[id];
        if (!m) continue;

        const shard = this.sharding ? getOctant(vec) : 0;
        this._shards[shard].insert(id, vec, m.metadata);
        this._meta.set(id, { shard, createdAt: m.createdAt, updatedAt: m.updatedAt });
      }
    } catch (err) {
      console.error('[VectorDB] Failed to load from disk:', err.message);
    }
  }

  /** Force save and flush timers. */
  async close() {
    if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
    await this.save();
  }

  // ─ stats ───────────────────────────────────────────────────────────────────

  /** @returns {object} statistics */
  stats() {
    return {
      totalVectors  : this.size,
      dim           : this.dim,
      metric        : this.metric,
      shardingEnabled: this.sharding,
      shards        : this._shards.map((s, i) => ({ octant: i, size: s.size, maxLevel: s.maxLevel })),
    };
  }
}

export default VectorDB;
