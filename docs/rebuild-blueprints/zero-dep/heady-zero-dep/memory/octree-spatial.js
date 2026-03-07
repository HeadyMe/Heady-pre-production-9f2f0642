/**
 * @fileoverview Octree Spatial Index
 * 3D space partitioning for spatial memory mapping and visualization.
 *
 * Features:
 *   - Octree data structure for recursive 3D space partitioning
 *   - Range queries: find all points within an axis-aligned box
 *   - K-nearest neighbor (KNN) search in 3D subspace
 *   - Spatial mapping: system components occupy 3D coordinates
 *   - Visualization data export (Three.js / WebGL-compatible JSON)
 *   - PHI-golden-ratio spatial layout
 *
 * Node.js built-ins only (no external dependencies).
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI = 1.6180339887498948482;

/** Default max points per leaf node before splitting */
const DEFAULT_CAPACITY = 8;

/** Default maximum octree depth */
const DEFAULT_MAX_DEPTH = 12;

/** Default world bounds (unit cube centred at origin) */
const DEFAULT_BOUNDS = {
  min: { x: -1, y: -1, z: -1 },
  max: { x:  1, y:  1, z:  1 },
};

// ─── 3D Geometry helpers ──────────────────────────────────────────────────────

/**
 * @typedef {object} Point3D
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {object} AABB
 * @property {Point3D} min
 * @property {Point3D} max
 */

/**
 * Squared Euclidean distance in 3D.
 * @param {Point3D} a
 * @param {Point3D} b
 * @returns {number}
 */
function distSq3D(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Euclidean distance in 3D.
 * @param {Point3D} a
 * @param {Point3D} b
 * @returns {number}
 */
function dist3D(a, b) { return Math.sqrt(distSq3D(a, b)); }

/**
 * Center of an AABB.
 * @param {AABB} box
 * @returns {Point3D}
 */
function center(box) {
  return {
    x: (box.min.x + box.max.x) / 2,
    y: (box.min.y + box.max.y) / 2,
    z: (box.min.z + box.max.z) / 2,
  };
}

/**
 * Test if a point lies within an AABB (inclusive bounds).
 * @param {Point3D} p
 * @param {AABB}    box
 * @returns {boolean}
 */
function containsPoint(box, p) {
  return p.x >= box.min.x && p.x <= box.max.x &&
         p.y >= box.min.y && p.y <= box.max.y &&
         p.z >= box.min.z && p.z <= box.max.z;
}

/**
 * Test if two AABBs intersect.
 * @param {AABB} a
 * @param {AABB} b
 * @returns {boolean}
 */
function intersects(a, b) {
  return a.min.x <= b.max.x && a.max.x >= b.min.x &&
         a.min.y <= b.max.y && a.max.y >= b.min.y &&
         a.min.z <= b.max.z && a.max.z >= b.min.z;
}

/**
 * Minimum squared distance from a point to an AABB.
 * (0 if point is inside the box)
 * @param {Point3D} p
 * @param {AABB}    box
 * @returns {number}
 */
function minDistSqToBox(p, box) {
  const cx = Math.max(box.min.x, Math.min(p.x, box.max.x));
  const cy = Math.max(box.min.y, Math.min(p.y, box.max.y));
  const cz = Math.max(box.min.z, Math.min(p.z, box.max.z));
  return distSq3D(p, { x: cx, y: cy, z: cz });
}

/**
 * Split an AABB into 8 child octants around its center.
 * @param {AABB} box
 * @returns {AABB[]} array of 8 children
 */
function splitOctants(box) {
  const c = center(box);
  return [
    { min: { x: box.min.x, y: box.min.y, z: box.min.z }, max: { x: c.x,     y: c.y,     z: c.z     } },
    { min: { x: box.min.x, y: box.min.y, z: c.z       }, max: { x: c.x,     y: c.y,     z: box.max.z } },
    { min: { x: box.min.x, y: c.y,       z: box.min.z }, max: { x: c.x,     y: box.max.y, z: c.z   } },
    { min: { x: box.min.x, y: c.y,       z: c.z       }, max: { x: c.x,     y: box.max.y, z: box.max.z } },
    { min: { x: c.x,       y: box.min.y, z: box.min.z }, max: { x: box.max.x, y: c.y,   z: c.z     } },
    { min: { x: c.x,       y: box.min.y, z: c.z       }, max: { x: box.max.x, y: c.y,   z: box.max.z } },
    { min: { x: c.x,       y: c.y,       z: box.min.z }, max: { x: box.max.x, y: box.max.y, z: c.z } },
    { min: { x: c.x,       y: c.y,       z: c.z       }, max: { x: box.max.x, y: box.max.y, z: box.max.z } },
  ];
}

// ─── OctreeNode ───────────────────────────────────────────────────────────────

/**
 * @typedef {object} SpatialEntry
 * @property {string}      id
 * @property {Point3D}     position
 * @property {object}      [metadata]
 * @property {string}      [label]
 * @property {string}      [color]    - hex color for visualization
 * @property {number}      [size]     - visual size
 */

class OctreeNode {
  /**
   * @param {AABB}   bounds
   * @param {number} depth
   * @param {number} capacity
   * @param {number} maxDepth
   */
  constructor(bounds, depth, capacity, maxDepth) {
    this.bounds   = bounds;
    this.depth    = depth;
    this.capacity = capacity;
    this.maxDepth = maxDepth;
    this.isLeaf   = true;

    /** @type {SpatialEntry[]} only populated in leaf nodes */
    this._points = [];

    /** @type {OctreeNode[]|null} 8 children (null for leaf nodes) */
    this._children = null;
  }

  /**
   * Insert a spatial entry.
   * @param {SpatialEntry} entry
   * @returns {boolean}
   */
  insert(entry) {
    if (!containsPoint(this.bounds, entry.position)) return false;

    if (this.isLeaf) {
      // Check for duplicate id
      const existIdx = this._points.findIndex(p => p.id === entry.id);
      if (existIdx !== -1) { this._points[existIdx] = entry; return true; }

      if (this._points.length < this.capacity || this.depth >= this.maxDepth) {
        this._points.push(entry);
        return true;
      }
      // Split
      this._split();
    }

    for (const child of this._children) {
      if (child.insert(entry)) return true;
    }
    return false;
  }

  _split() {
    this.isLeaf    = false;
    const octants  = splitOctants(this.bounds);
    this._children = octants.map(b => new OctreeNode(b, this.depth + 1, this.capacity, this.maxDepth));

    for (const point of this._points) {
      for (const child of this._children) {
        if (child.insert(point)) break;
      }
    }
    this._points = [];
  }

  /**
   * Delete a spatial entry by id.
   * @param {string} id
   * @returns {boolean}
   */
  delete(id) {
    if (this.isLeaf) {
      const idx = this._points.findIndex(p => p.id === id);
      if (idx === -1) return false;
      this._points.splice(idx, 1);
      return true;
    }
    for (const child of this._children) {
      if (child.delete(id)) return true;
    }
    return false;
  }

  /**
   * Range query: return all entries within the given AABB.
   * @param {AABB}          range
   * @param {SpatialEntry[]} results
   */
  rangeQuery(range, results) {
    if (!intersects(this.bounds, range)) return;
    if (this.isLeaf) {
      for (const p of this._points) {
        if (containsPoint(range, p.position)) results.push(p);
      }
    } else {
      for (const child of this._children) child.rangeQuery(range, results);
    }
  }

  /**
   * KNN helper: push leaf candidates into a min-heap based on min-dist to box.
   * @param {Point3D}    query
   * @param {MaxBoundedHeap} heap
   */
  knnSearch(query, heap) {
    const dSq = minDistSqToBox(query, this.bounds);
    if (heap.full && dSq > heap.worstDistSq) return;

    if (this.isLeaf) {
      for (const p of this._points) {
        const d = distSq3D(query, p.position);
        heap.offer(d, p);
      }
    } else {
      // Visit children ordered by proximity
      const ordered = this._children
        .map(c => ({ c, d: minDistSqToBox(query, c.bounds) }))
        .sort((a, b) => a.d - b.d);
      for (const { c } of ordered) c.knnSearch(query, heap);
    }
  }

  /** Collect all entries. */
  collectAll(results) {
    if (this.isLeaf) { results.push(...this._points); }
    else { for (const c of this._children) c.collectAll(results); }
  }

  /** Count all entries. */
  count() {
    if (this.isLeaf) return this._points.length;
    return this._children.reduce((s, c) => s + c.count(), 0);
  }

  /** Serialize for visualization (depth-first tree). */
  toVizNode(maxDepthExport = 3) {
    const node = {
      bounds: this.bounds,
      depth : this.depth,
      count : this.count(),
    };
    if (this.isLeaf || this.depth >= maxDepthExport) {
      node.points = this._points.map(p => ({ id: p.id, position: p.position, label: p.label, color: p.color, size: p.size }));
    } else {
      node.children = this._children.map(c => c.toVizNode(maxDepthExport));
    }
    return node;
  }
}

// ─── Max-Bounded Heap for KNN ────────────────────────────────────────────────

/** Keeps the K nearest candidates (max-heap on distance so we can prune). */
class MaxBoundedHeap {
  constructor(k) {
    this.k    = k;
    this._arr = []; // [{distSq, entry}]
  }

  get full()          { return this._arr.length >= this.k; }
  get worstDistSq()   { return this._arr.length ? this._arr[0].distSq : Infinity; }

  offer(distSq, entry) {
    if (this.full && distSq >= this.worstDistSq) return;
    this._arr.push({ distSq, entry });
    this._arr.sort((a, b) => b.distSq - a.distSq); // descending distSq: worst at [0], best at [end]
    if (this._arr.length > this.k) this._arr.shift(); // remove worst (index 0, largest distSq)
  }

  /** @returns {Array<{distSq:number, distance:number, entry:SpatialEntry}>} sorted nearest-first */
  results() {
    return this._arr
      .map(x => ({ ...x, distance: Math.sqrt(x.distSq) }))
      .sort((a, b) => a.distSq - b.distSq);
  }
}

// ─── OctreeSpatial ────────────────────────────────────────────────────────────

/**
 * 3D Octree spatial index with visualization export.
 *
 * Coordinate convention:
 *   - Default world space: [-1, 1]^3
 *   - The 3 Colab nodes occupy PHI-scaled positions on the unit sphere
 *
 * @example
 * const tree = new OctreeSpatial();
 * tree.insert({ id: 'brain', position: { x: 0, y: 0, z: 0 }, label: 'BRAIN', color: '#6B46C1' });
 * const nearest = tree.knn({ x: 0.1, y: 0, z: 0 }, 3);
 * const inBox   = tree.rangeQuery({ min: { x: -0.5, y: -0.5, z: -0.5 }, max: { x: 0.5, y: 0.5, z: 0.5 } });
 * const vizData = tree.exportVisualization();
 */
export class OctreeSpatial {
  /**
   * @param {object} opts
   * @param {AABB}    [opts.bounds]
   * @param {number}  [opts.capacity=8]
   * @param {number}  [opts.maxDepth=12]
   */
  constructor(opts = {}) {
    this._bounds   = opts.bounds   ?? { ...DEFAULT_BOUNDS, min: { ...DEFAULT_BOUNDS.min }, max: { ...DEFAULT_BOUNDS.max } };
    this._capacity = opts.capacity ?? DEFAULT_CAPACITY;
    this._maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;

    this._root = new OctreeNode(this._bounds, 0, this._capacity, this._maxDepth);

    /** Fast lookup by id → entry (for get/update) */
    this._index = new Map();

    // Pre-populate canonical system component positions
    this._initSystemComponents();
  }

  // ─ System component layout ─────────────────────────────────────────────────

  /**
   * Pre-define the 3 Colab node positions on a PHI-scaled ring.
   * Laid out on the unit circle in XZ plane:
   *   BRAIN     at (0, 0, 0) — central hub
   *   CONDUCTOR at (cos(0), 0, sin(0)) * φ/2
   *   SENTINEL  at (cos(2π/3), 0, sin(2π/3)) * φ/2
   */
  _initSystemComponents() {
    const r = PHI / (PHI + 1); // ≈ 0.618
    const components = [
      { id: 'sys:brain',     position: { x: 0,                    y: 0, z: 0 },                   label: 'BRAIN',     color: '#6B46C1', size: 1.0, metadata: { role: 'BRAIN',     layer: 'core' } },
      { id: 'sys:conductor', position: { x: r,                    y: 0, z: 0 },                   label: 'CONDUCTOR', color: '#2D3748', size: 0.8, metadata: { role: 'CONDUCTOR', layer: 'core' } },
      { id: 'sys:sentinel',  position: { x: r * Math.cos(2.094),  y: 0, z: r * Math.sin(2.094) }, label: 'SENTINEL',  color: '#E53E3E', size: 0.6, metadata: { role: 'SENTINEL',  layer: 'core' } },
    ];
    for (const c of components) this.insert(c);
  }

  // ─ CRUD ────────────────────────────────────────────────────────────────────

  /**
   * Insert or update a spatial entry.
   * @param {SpatialEntry} entry
   * @returns {string} entry id
   */
  insert(entry) {
    if (!entry.id) throw new Error('Entry must have an id');
    if (!entry.position) throw new Error('Entry must have a position {x,y,z}');

    // Expand bounds if necessary
    this._expandBoundsIfNeeded(entry.position);

    if (this._index.has(entry.id)) this.delete(entry.id);

    this._root.insert(entry);
    this._index.set(entry.id, entry);
    return entry.id;
  }

  /**
   * Delete an entry by id.
   * @param {string} id
   * @returns {boolean}
   */
  delete(id) {
    const result = this._root.delete(id);
    if (result) this._index.delete(id);
    return result;
  }

  /**
   * Get an entry by id.
   * @param {string} id
   * @returns {SpatialEntry|null}
   */
  get(id) { return this._index.get(id) ?? null; }

  /**
   * Update position and/or metadata of an existing entry.
   * @param {string} id
   * @param {object} updates
   * @returns {boolean}
   */
  update(id, updates) {
    const entry = this._index.get(id);
    if (!entry) return false;
    this.insert({ ...entry, ...updates, id });
    return true;
  }

  // ─ Bounds expansion ────────────────────────────────────────────────────────

  /**
   * Dynamically expand the world bounds and rebuild the root if a point lies outside.
   * @param {Point3D} p
   */
  _expandBoundsIfNeeded(p) {
    let changed = false;
    const b     = this._bounds;
    const pad   = 1 / PHI; // add padding of 1/φ ≈ 0.618 on expansion

    if (p.x < b.min.x) { b.min.x = p.x - pad; changed = true; }
    if (p.x > b.max.x) { b.max.x = p.x + pad; changed = true; }
    if (p.y < b.min.y) { b.min.y = p.y - pad; changed = true; }
    if (p.y > b.max.y) { b.max.y = p.y + pad; changed = true; }
    if (p.z < b.min.z) { b.min.z = p.z - pad; changed = true; }
    if (p.z > b.max.z) { b.max.z = p.z + pad; changed = true; }

    if (changed) this._rebuild();
  }

  _rebuild() {
    const all  = [...this._index.values()];
    this._root = new OctreeNode(this._bounds, 0, this._capacity, this._maxDepth);
    for (const entry of all) this._root.insert(entry);
  }

  // ─ Range query ─────────────────────────────────────────────────────────────

  /**
   * Return all entries within an axis-aligned bounding box.
   * @param {AABB} range
   * @returns {SpatialEntry[]}
   */
  rangeQuery(range) {
    const results = [];
    this._root.rangeQuery(range, results);
    return results;
  }

  /**
   * Return all entries within a sphere.
   * @param {Point3D} center
   * @param {number}  radius
   * @returns {Array<{entry:SpatialEntry, distance:number}>}
   */
  sphereQuery(center, radius) {
    // Use AABB enclosing the sphere, then filter by distance
    const range = {
      min: { x: center.x - radius, y: center.y - radius, z: center.z - radius },
      max: { x: center.x + radius, y: center.y + radius, z: center.z + radius },
    };
    const candidates = this.rangeQuery(range);
    return candidates
      .map(e => ({ entry: e, distance: dist3D(center, e.position) }))
      .filter(x => x.distance <= radius)
      .sort((a, b) => a.distance - b.distance);
  }

  // ─ KNN ─────────────────────────────────────────────────────────────────────

  /**
   * K-nearest neighbors in 3D.
   * @param {Point3D} query
   * @param {number}  [k=5]
   * @returns {Array<{entry:SpatialEntry, distance:number}>}
   */
  knn(query, k = 5) {
    const heap = new MaxBoundedHeap(k);
    this._root.knnSearch(query, heap);
    return heap.results().map(r => ({ entry: r.entry, distance: r.distance }));
  }

  // ─ Bulk operations ─────────────────────────────────────────────────────────

  /**
   * Return all entries.
   * @returns {SpatialEntry[]}
   */
  getAll() { return [...this._index.values()]; }

  /** @returns {number} entry count */
  get size() { return this._index.size; }

  /**
   * Clear all entries (preserves system components).
   * @param {boolean} [preserveSystem=true]
   */
  clear(preserveSystem = true) {
    const toKeep = preserveSystem
      ? [...this._index.values()].filter(e => e.id.startsWith('sys:'))
      : [];
    this._index.clear();
    this._root = new OctreeNode(this._bounds, 0, this._capacity, this._maxDepth);
    for (const e of toKeep) {
      this._index.set(e.id, e);
      this._root.insert(e);
    }
  }

  // ─ Spatial layout helpers ──────────────────────────────────────────────────

  /**
   * Distribute N items on a PHI-spiral (Fibonacci / sunflower pattern) in 3D.
   * Useful for laying out memory nodes or agents spatially.
   * @param {number} n
   * @param {number} [radius=1]
   * @returns {Point3D[]}
   */
  static phiSpiral(n, radius = 1) {
    const points = [];
    const golden = 2 * Math.PI / (PHI * PHI); // golden angle
    for (let i = 0; i < n; i++) {
      const t     = i / n;
      const theta = golden * i;
      const phi   = Math.acos(1 - 2 * t); // uniform spherical distribution
      points.push({
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.cos(phi),
        z: radius * Math.sin(phi) * Math.sin(theta),
      });
    }
    return points;
  }

  /**
   * Assign PHI-spiral positions to a list of entries.
   * @param {string[]} ids
   * @param {number}   [radius=0.8]
   */
  assignPhiLayout(ids, radius = 0.8) {
    const positions = OctreeSpatial.phiSpiral(ids.length, radius);
    for (let i = 0; i < ids.length; i++) {
      const entry = this._index.get(ids[i]);
      if (entry) this.update(ids[i], { position: positions[i] });
    }
  }

  // ─ Visualization export ────────────────────────────────────────────────────

  /**
   * Export data for 3D rendering (Three.js / WebGL compatible).
   *
   * Returns:
   *   - nodes: flat array of { id, position, label, color, size }
   *   - edges: proximity edges for visualization
   *   - octree: tree structure for bounding-box rendering
   *   - bounds: world bounds
   *
   * @param {object} [opts]
   * @param {number}  [opts.edgeRadius=0.3]   - max distance for auto-edges
   * @param {number}  [opts.maxEdges=200]
   * @param {number}  [opts.octreeDepth=4]    - how deep to export octree structure
   * @returns {object}
   */
  exportVisualization(opts = {}) {
    const edgeRadius = opts.edgeRadius ?? 0.3;
    const maxEdges   = opts.maxEdges   ?? 200;
    const octreeDepth= opts.octreeDepth ?? 4;

    const nodes = [...this._index.values()].map(e => ({
      id      : e.id,
      position: e.position,
      label   : e.label   ?? e.id,
      color   : e.color   ?? '#888888',
      size    : e.size    ?? 0.1,
      metadata: e.metadata ?? {},
    }));

    // Build proximity edges
    const edges = [];
    if (edgeRadius > 0) {
      for (let i = 0; i < nodes.length && edges.length < maxEdges; i++) {
        const nearby = this.sphereQuery(nodes[i].position, edgeRadius);
        for (const { entry, distance } of nearby) {
          if (entry.id === nodes[i].id) continue;
          if (edges.length >= maxEdges) break;
          edges.push({
            from    : nodes[i].id,
            to      : entry.id,
            distance,
            weight  : 1 - distance / edgeRadius, // normalized
          });
        }
      }
    }

    const octree = this._root.toVizNode(octreeDepth);

    return {
      version : 1,
      ts      : Date.now(),
      bounds  : this._bounds,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodes,
      edges,
      octree,
    };
  }

  /**
   * Export as compact JSON string for transmission.
   * @returns {string}
   */
  exportJSON() {
    return JSON.stringify(this.exportVisualization());
  }

  // ─ Stats ───────────────────────────────────────────────────────────────────

  stats() {
    return {
      size      : this.size,
      bounds    : this._bounds,
      capacity  : this._capacity,
      maxDepth  : this._maxDepth,
    };
  }
}

export default OctreeSpatial;
