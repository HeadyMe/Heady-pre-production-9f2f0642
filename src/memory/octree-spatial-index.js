/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
// RTP: 3D Vector Space Memory with Octree Indexing - HS-series

'use strict';

const crypto = require('crypto');

const PHI = 1.6180339887;

// ─── Fibonacci Shard Mapping ──────────────────────────────────────────────────

const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];

function fibonacciShard(point, numShards = 8) {
  // Map 3D point to shard index using Fibonacci sequence
  const hashVal = Math.abs(
    Math.round(point.x * FIBONACCI[2] + point.y * FIBONACCI[3] + point.z * FIBONACCI[4])
  );
  return hashVal % numShards;
}

// ─── Vec3 ─────────────────────────────────────────────────────────────────────

class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }

  static fromArray(arr) { return new Vec3(arr[0] || 0, arr[1] || 0, arr[2] || 0); }
  toArray()  { return [this.x, this.y, this.z]; }

  distanceTo(other) {
    return Math.sqrt(
      Math.pow(this.x - other.x, 2) +
      Math.pow(this.y - other.y, 2) +
      Math.pow(this.z - other.z, 2)
    );
  }

  add(other) { return new Vec3(this.x + other.x, this.y + other.y, this.z + other.z); }
  scale(s)   { return new Vec3(this.x * s, this.y * s, this.z * s); }
  midpoint(other) {
    return new Vec3((this.x + other.x) / 2, (this.y + other.y) / 2, (this.z + other.z) / 2);
  }
  equals(other, eps = 1e-9) {
    return Math.abs(this.x - other.x) < eps && Math.abs(this.y - other.y) < eps && Math.abs(this.z - other.z) < eps;
  }
  toString() { return `Vec3(${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)})`; }
}

// ─── AABB (Axis-Aligned Bounding Box) ────────────────────────────────────────

class AABB {
  constructor(min, max) { this.min = min; this.max = max; }

  get center() { return this.min.midpoint(this.max); }
  get halfSize() {
    return new Vec3(
      (this.max.x - this.min.x) / 2,
      (this.max.y - this.min.y) / 2,
      (this.max.z - this.min.z) / 2
    );
  }

  contains(point) {
    return point.x >= this.min.x && point.x <= this.max.x &&
           point.y >= this.min.y && point.y <= this.max.y &&
           point.z >= this.min.z && point.z <= this.max.z;
  }

  intersectsSphere(center, radius) {
    const dx = Math.max(this.min.x - center.x, 0, center.x - this.max.x);
    const dy = Math.max(this.min.y - center.y, 0, center.y - this.max.y);
    const dz = Math.max(this.min.z - center.z, 0, center.z - this.max.z);
    return dx * dx + dy * dy + dz * dz <= radius * radius;
  }

  /**
   * Split into 8 child octants.
   */
  split() {
    const c = this.center;
    return [
      new AABB(this.min,                                    c),
      new AABB(new Vec3(c.x, this.min.y, this.min.z),      new Vec3(this.max.x, c.y, c.z)),
      new AABB(new Vec3(this.min.x, c.y, this.min.z),      new Vec3(c.x, this.max.y, c.z)),
      new AABB(new Vec3(c.x, c.y, this.min.z),             new Vec3(this.max.x, this.max.y, c.z)),
      new AABB(new Vec3(this.min.x, this.min.y, c.z),      new Vec3(c.x, c.y, this.max.z)),
      new AABB(new Vec3(c.x, this.min.y, c.z),             new Vec3(this.max.x, c.y, this.max.z)),
      new AABB(new Vec3(this.min.x, c.y, c.z),             new Vec3(c.x, this.max.y, this.max.z)),
      new AABB(c,                                            this.max),
    ];
  }
}

// ─── OctreeNode ───────────────────────────────────────────────────────────────

const OCTREE_CAPACITY = 8;

class OctreeNode {
  constructor(bounds, depth = 0, maxDepth = 12, capacity = OCTREE_CAPACITY) {
    this.bounds   = bounds;
    this.depth    = depth;
    this.maxDepth = maxDepth;
    this.capacity = capacity;
    this.points   = [];  // { id, pos: Vec3, data }
    this.children = null; // Array<OctreeNode>[8] when subdivided
    this._count   = 0;
  }

  get isLeaf()    { return this.children === null; }
  get pointCount(){ return this._count; }

  /**
   * Insert a point. Auto-subdivides when capacity is reached.
   */
  insert(point) {
    if (!this.bounds.contains(point.pos)) return false;

    if (this.isLeaf) {
      if (this.points.length < this.capacity || this.depth >= this.maxDepth) {
        this.points.push(point);
        this._count++;
        return true;
      }
      this._subdivide();
    }

    for (const child of this.children) {
      if (child.insert(point)) {
        this._count++;
        return true;
      }
    }
    return false;
  }

  _subdivide() {
    const childBounds = this.bounds.split();
    this.children     = childBounds.map(b =>
      new OctreeNode(b, this.depth + 1, this.maxDepth, this.capacity)
    );
    // Redistribute existing points
    for (const p of this.points) {
      for (const child of this.children) { if (child.insert(p)) break; }
    }
    this.points = [];
  }

  /**
   * Query all points within a sphere.
   */
  queryRadius(center, radius, results = []) {
    if (!this.bounds.intersectsSphere(center, radius)) return results;

    if (this.isLeaf) {
      for (const p of this.points) {
        if (p.pos.distanceTo(center) <= radius) results.push(p);
      }
    } else {
      for (const child of this.children) child.queryRadius(center, radius, results);
    }
    return results;
  }

  /**
   * Find k-nearest neighbors.
   */
  kNearest(center, k, heap = []) {
    if (this.isLeaf) {
      for (const p of this.points) {
        const dist = p.pos.distanceTo(center);
        heap.push({ ...p, dist });
        heap.sort((a, b) => a.dist - b.dist);
        if (heap.length > k) heap.pop();
      }
    } else {
      // Sort children by distance to center for pruning
      const sorted = this.children
        .map(c => ({ child: c, dist: c.bounds.center.distanceTo(center) }))
        .sort((a, b) => a.dist - b.dist);
      for (const { child } of sorted) child.kNearest(center, k, heap);
    }
    return heap;
  }

  /**
   * Remove a point by ID.
   */
  remove(id) {
    if (this.isLeaf) {
      const before = this.points.length;
      this.points = this.points.filter(p => p.id !== id);
      const removed = before - this.points.length;
      this._count -= removed;
      return removed;
    }
    let removed = 0;
    for (const child of this.children) {
      const r = child.remove(id);
      removed += r;
      this._count -= r;
    }
    return removed;
  }

  /**
   * Collect all points in this subtree.
   */
  all(results = []) {
    if (this.isLeaf) { results.push(...this.points); }
    else { for (const c of this.children) c.all(results); }
    return results;
  }

  getStats() {
    return { depth: this.depth, count: this._count, isLeaf: this.isLeaf,
             children: this.isLeaf ? 0 : this.children.length };
  }
}

// ─── PCA-lite: 384D → 3D Projection ─────────────────────────────────────────

class PCAProjector {
  /**
   * Lightweight PCA-inspired projection from high-D to 3D.
   * Uses fixed random projection matrix (seeded for reproducibility).
   * For production: use real SVD/PCA; this is a fast approximation.
   */
  constructor(inputDim = 384, seed = 42) {
    this._inputDim = inputDim;
    this._seed     = seed;
    this._matrix   = this._buildMatrix(inputDim, 3, seed);
  }

  _buildMatrix(inDim, outDim, seed) {
    // Seeded pseudo-random matrix (Gaussian approximation via LCG)
    const matrix = [];
    let state = seed;
    const lcg = () => { state = ((1664525 * state + 1013904223) >>> 0); return state / 0x100000000; };
    for (let j = 0; j < outDim; j++) {
      const row = new Float32Array(inDim);
      for (let i = 0; i < inDim; i++) {
        // Box-Muller for Gaussian weights
        const u1 = lcg() || 1e-10;
        const u2 = lcg();
        row[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      }
      // Normalize row
      let norm = 0; for (let i = 0; i < inDim; i++) norm += row[i] * row[i];
      norm = Math.sqrt(norm);
      for (let i = 0; i < inDim; i++) row[i] /= norm;
      matrix.push(row);
    }
    return matrix;
  }

  /**
   * Project a high-D vector to 3D.
   * @param {number[]|Float32Array} vector
   * @returns {Vec3}
   */
  project(vector) {
    const coords = this._matrix.map(row => {
      let sum = 0;
      const len = Math.min(row.length, vector.length);
      for (let i = 0; i < len; i++) sum += row[i] * vector[i];
      return sum;
    });
    return new Vec3(coords[0], coords[1], coords[2]);
  }
}

// ─── SpatialIndex ─────────────────────────────────────────────────────────────

class SpatialIndex {
  constructor(opts = {}) {
    const extent = opts.extent || 10;
    this._bounds    = opts.bounds || new AABB(new Vec3(-extent, -extent, -extent), new Vec3(extent, extent, extent));
    this._root      = new OctreeNode(this._bounds, 0, opts.maxDepth || 12, opts.capacity || OCTREE_CAPACITY);
    this._index     = new Map();  // id → point
    this._projector = opts.projector || null;  // PCAProjector
    this._shards    = opts.numShards || 8;
  }

  /**
   * Insert a vector with ID and data payload.
   * If vector is high-dimensional, projects it first.
   */
  insert(id, vector, data = {}) {
    let pos;
    if (Array.isArray(vector) && vector.length === 3) {
      pos = Vec3.fromArray(vector);
    } else if (vector instanceof Vec3) {
      pos = vector;
    } else if (Array.isArray(vector) && vector.length > 3) {
      if (!this._projector) this._projector = new PCAProjector(vector.length);
      pos = this._projector.project(vector);
    } else {
      throw new Error('Vector must be Vec3, [x,y,z], or high-D array');
    }

    const point = { id, pos, data, shard: fibonacciShard(pos, this._shards), ts: Date.now() };
    this._root.insert(point);
    this._index.set(id, point);
    return point;
  }

  /**
   * Query points within radius of a position.
   */
  queryRadius(center, radius) {
    const c = center instanceof Vec3 ? center : Vec3.fromArray(center);
    return this._root.queryRadius(c, radius);
  }

  /**
   * Find k-nearest neighbors.
   */
  kNearest(center, k = 5) {
    const c = center instanceof Vec3 ? center : Vec3.fromArray(center);
    return this._root.kNearest(c, k).slice(0, k);
  }

  remove(id) {
    this._root.remove(id);
    this._index.delete(id);
    return this;
  }

  get(id) { return this._index.get(id) || null; }
  has(id) { return this._index.has(id); }
  size()  { return this._index.size; }
  all()   { return this._root.all(); }

  getProjector() { return this._projector; }
  getRoot()      { return this._root; }
}

// ─── GraphRAG ─────────────────────────────────────────────────────────────────

class GraphRAG {
  /**
   * Knowledge graph linking memory vectors with typed edges.
   * Supports traversal for retrieval-augmented generation.
   */
  constructor(opts = {}) {
    this._nodes   = new Map();  // id → { id, data }
    this._edges   = new Map();  // id → [{to, type, weight}]
    this._reverseEdges = new Map(); // id → [{from, type, weight}]
    this._maxEdges = opts.maxEdgesPerNode || 50;
  }

  addNode(id, data = {}) {
    this._nodes.set(id, { id, data, ts: Date.now() });
    if (!this._edges.has(id))        this._edges.set(id, []);
    if (!this._reverseEdges.has(id)) this._reverseEdges.set(id, []);
    return this;
  }

  addEdge(fromId, toId, type = 'related', weight = 1.0) {
    if (!this._nodes.has(fromId) || !this._nodes.has(toId)) {
      throw new Error(`Both nodes must exist: ${fromId}, ${toId}`);
    }
    const edges = this._edges.get(fromId);
    // Dedup
    const existing = edges.find(e => e.to === toId && e.type === type);
    if (existing) { existing.weight = weight; return this; }

    if (edges.length >= this._maxEdges) {
      // Remove weakest edge
      edges.sort((a, b) => a.weight - b.weight);
      const removed = edges.shift();
      const rev = this._reverseEdges.get(removed.to);
      if (rev) { const i = rev.findIndex(e => e.from === fromId && e.type === type); if (i !== -1) rev.splice(i, 1); }
    }

    edges.push({ to: toId, type, weight });
    this._reverseEdges.get(toId).push({ from: fromId, type, weight });
    return this;
  }

  removeNode(id) {
    this._nodes.delete(id);
    this._edges.delete(id);
    this._reverseEdges.delete(id);
    // Clean up edges
    for (const edges of this._edges.values()) {
      const i = edges.findIndex(e => e.to === id);
      if (i !== -1) edges.splice(i, 1);
    }
    return this;
  }

  /**
   * BFS traversal from a node up to maxDepth hops.
   */
  traverse(startId, maxDepth = 2, edgeTypes = null) {
    const visited = new Set();
    const result  = [];
    const queue   = [{ id: startId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift();
      if (visited.has(id) || depth > maxDepth) continue;
      visited.add(id);
      const node = this._nodes.get(id);
      if (node) result.push({ ...node, depth });

      const edges = this._edges.get(id) || [];
      for (const edge of edges) {
        if (edgeTypes && !edgeTypes.includes(edge.type)) continue;
        if (!visited.has(edge.to)) queue.push({ id: edge.to, depth: depth + 1 });
      }
    }
    return result;
  }

  /**
   * Get neighbors of a node.
   */
  neighbors(id, direction = 'outgoing') {
    if (direction === 'outgoing') return this._edges.get(id) || [];
    if (direction === 'incoming') return this._reverseEdges.get(id) || [];
    return [
      ...(this._edges.get(id) || []).map(e => ({ ...e, dir: 'out' })),
      ...(this._reverseEdges.get(id) || []).map(e => ({ ...e, dir: 'in' })),
    ];
  }

  /**
   * Retrieve context for RAG: BFS neighborhood + node data.
   */
  retrieveContext(nodeIds, maxDepth = 1) {
    const allNodes = new Map();
    for (const id of nodeIds) {
      const nodes = this.traverse(id, maxDepth);
      for (const n of nodes) allNodes.set(n.id, n);
    }
    return Array.from(allNodes.values());
  }

  nodeCount() { return this._nodes.size; }
  edgeCount() {
    let count = 0;
    for (const edges of this._edges.values()) count += edges.length;
    return count;
  }
}

// ─── ImportanceScorer ─────────────────────────────────────────────────────────

class ImportanceScorer {
  /**
   * I(m) = frequency × recency × relevance
   * Used to rank memories for LTM consolidation.
   */
  constructor(opts = {}) {
    this._decayRate = opts.decayRate || 1 / (24 * 60 * 60 * 1000); // 1/day in ms
    this._phiDecay  = opts.phiDecay !== false; // use φ-modulated decay
  }

  /**
   * Compute importance score for a memory.
   * @param {Object} memory - { frequency, lastAccessed, relevanceScore, createdAt }
   * @returns {number} importance in [0, 1]
   */
  score(memory) {
    const now       = Date.now();
    const age       = now - (memory.lastAccessed || memory.createdAt || now);
    const frequency = memory.frequency || 1;
    const relevance = memory.relevanceScore || 0.5;

    // Recency: exponential decay, φ-modulated
    const decayBase = this._phiDecay
      ? Math.exp(-this._decayRate * age * PHI)
      : Math.exp(-this._decayRate * age);
    const recency = Math.max(0, Math.min(1, decayBase));

    // Frequency: log-normalized
    const freqScore = Math.min(1, Math.log1p(frequency) / Math.log1p(100));

    const importance = freqScore * recency * relevance;
    return Math.max(0, Math.min(1, importance));
  }

  /**
   * Rank a list of memories by importance.
   */
  rank(memories) {
    return memories
      .map(m => ({ ...m, importance: this.score(m) }))
      .sort((a, b) => b.importance - a.importance);
  }
}

// ─── ZoneManager ─────────────────────────────────────────────────────────────

class ZoneManager {
  /**
   * Manages 8 octant zones with centroids.
   * Used for memory categorization and routing.
   */
  constructor(extent = 10) {
    this._extent = extent;
    const h = extent / 2;
    this._zones = [
      { id: 0, name: 'NW-Bottom', centroid: new Vec3(-h, -h, -h) },
      { id: 1, name: 'NE-Bottom', centroid: new Vec3( h, -h, -h) },
      { id: 2, name: 'SW-Bottom', centroid: new Vec3(-h,  h, -h) },
      { id: 3, name: 'SE-Bottom', centroid: new Vec3( h,  h, -h) },
      { id: 4, name: 'NW-Top',    centroid: new Vec3(-h, -h,  h) },
      { id: 5, name: 'NE-Top',    centroid: new Vec3( h, -h,  h) },
      { id: 6, name: 'SW-Top',    centroid: new Vec3(-h,  h,  h) },
      { id: 7, name: 'SE-Top',    centroid: new Vec3( h,  h,  h) },
    ];
  }

  /**
   * Find the zone that a point belongs to.
   */
  getZone(point) {
    const p = point instanceof Vec3 ? point : Vec3.fromArray(point);
    let nearest = this._zones[0];
    let minDist = Infinity;
    for (const zone of this._zones) {
      const d = p.distanceTo(zone.centroid);
      if (d < minDist) { minDist = d; nearest = zone; }
    }
    return nearest;
  }

  getZoneById(id) { return this._zones[id] || null; }
  getAllZones()   { return this._zones.slice(); }
}

// ─── STMtoLTM ─────────────────────────────────────────────────────────────────

class STMtoLTM {
  /**
   * Consolidation pipeline: Short-Term Memory → Long-Term Memory.
   * High-importance memories get promoted to LTM after a consolidation cycle.
   */
  constructor(opts = {}) {
    this._stm         = new Map();  // id → memory
    this._ltm         = new Map();  // id → memory
    this._scorer      = new ImportanceScorer(opts.scorerOpts || {});
    this._threshold   = opts.threshold || 0.4;
    this._stmCapacity = opts.stmCapacity || 1000;
    this._ltmCapacity = opts.ltmCapacity || 10000;
    this._cycleMs     = opts.cycleMs || 30000;
    this._timer       = null;
    this._callbacks   = [];
  }

  addToSTM(id, memory) {
    if (this._stm.size >= this._stmCapacity) {
      // Evict lowest importance
      const sorted = this._scorer.rank(Array.from(this._stm.values()));
      const evict  = sorted[sorted.length - 1];
      if (evict) this._stm.delete(evict.id);
    }
    this._stm.set(id, { ...memory, id, frequency: 1, lastAccessed: Date.now(), createdAt: Date.now() });
    return this;
  }

  touch(id) {
    const m = this._stm.get(id) || this._ltm.get(id);
    if (m) {
      m.frequency   = (m.frequency || 0) + 1;
      m.lastAccessed = Date.now();
    }
    return this;
  }

  /**
   * Run a consolidation cycle: evaluate STM, promote to LTM if important enough.
   */
  consolidate() {
    const promoted = [];
    const evicted  = [];

    for (const [id, memory] of this._stm.entries()) {
      const importance = this._scorer.score(memory);
      memory.importance = importance;

      if (importance >= this._threshold) {
        if (this._ltm.size >= this._ltmCapacity) {
          const sorted = this._scorer.rank(Array.from(this._ltm.values()));
          const weak   = sorted[sorted.length - 1];
          if (weak && weak.importance < importance) {
            this._ltm.delete(weak.id);
          }
        }
        this._ltm.set(id, memory);
        this._stm.delete(id);
        promoted.push(id);
      } else if (importance < this._threshold * 0.1) {
        this._stm.delete(id);
        evicted.push(id);
      }
    }

    const result = { promoted: promoted.length, evicted: evicted.length, stm: this._stm.size, ltm: this._ltm.size };
    for (const fn of this._callbacks) fn(result);
    return result;
  }

  startAutoConsolidate() {
    this._timer = setInterval(() => this.consolidate(), this._cycleMs);
    if (this._timer.unref) this._timer.unref();
    return this;
  }

  stopAutoConsolidate() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    return this;
  }

  onConsolidate(fn) { this._callbacks.push(fn); return this; }

  getSTM() { return new Map(this._stm); }
  getLTM() { return new Map(this._ltm); }
  getMemory(id) { return this._stm.get(id) || this._ltm.get(id) || null; }
  getStats()    { return { stm: this._stm.size, ltm: this._ltm.size, threshold: this._threshold }; }
}

// ─── MemoryStore (Top-level) ──────────────────────────────────────────────────

class MemoryStore {
  /**
   * Full 3D Vector Space Memory combining OctreeIndex + GraphRAG + STMtoLTM.
   */
  constructor(opts = {}) {
    this._spatial    = new SpatialIndex(opts.spatialOpts || {});
    this._graph      = new GraphRAG(opts.graphOpts || {});
    this._zones      = new ZoneManager(opts.extent || 10);
    this._stmLtm     = new STMtoLTM(opts.stmLtmOpts || {});
    this._projector  = opts.inputDim ? new PCAProjector(opts.inputDim) : null;
    this._scorer     = new ImportanceScorer(opts.scorerOpts || {});
  }

  /**
   * Store a memory: insert into spatial index, add to graph, add to STM.
   */
  store(id, vector, data = {}) {
    const point  = this._spatial.insert(id, vector, data);
    const zone   = this._zones.getZone(point.pos);

    this._graph.addNode(id, { ...data, zone: zone.name, pos: point.pos.toArray() });
    this._stmLtm.addToSTM(id, { ...data, pos: point.pos.toArray(), zone: zone.name, relevanceScore: data.relevanceScore || 0.5 });

    return { id, pos: point.pos.toArray(), zone };
  }

  /**
   * Retrieve memories near a query vector.
   */
  retrieve(queryVector, k = 10, maxRadius = 5) {
    const neighbors = this._spatial.kNearest(queryVector, k);

    // Touch for frequency tracking
    for (const n of neighbors) this._stmLtm.touch(n.id);

    // Enrich with graph context
    const ids     = neighbors.map(n => n.id);
    const context = this._graph.retrieveContext(ids, 1);

    return { neighbors, context };
  }

  /**
   * Link two memories with a typed edge.
   */
  link(idA, idB, type = 'related', weight = 1.0) {
    this._graph.addEdge(idA, idB, type, weight);
    return this;
  }

  remove(id) {
    this._spatial.remove(id);
    this._graph.removeNode(id);
    return this;
  }

  consolidate() { return this._stmLtm.consolidate(); }

  getStats() {
    return {
      spatial:   this._spatial.size(),
      graphNodes: this._graph.nodeCount(),
      graphEdges: this._graph.edgeCount(),
      stmLtm:    this._stmLtm.getStats(),
    };
  }

  getSpatialIndex()  { return this._spatial; }
  getGraphRAG()      { return this._graph; }
  getZoneManager()   { return this._zones; }
  getSTMtoLTM()      { return this._stmLtm; }
  getImportanceScorer() { return this._scorer; }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  PHI,
  FIBONACCI,
  fibonacciShard,
  Vec3,
  AABB,
  OctreeNode,
  PCAProjector,
  SpatialIndex,
  GraphRAG,
  ImportanceScorer,
  ZoneManager,
  STMtoLTM,
  MemoryStore,
};
