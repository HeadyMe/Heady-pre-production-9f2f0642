/**
 * @fileoverview Graph RAG (Retrieval-Augmented Generation) Engine
 * Zero-dependency knowledge graph with vector embeddings on nodes.
 *
 * Features:
 *   - Nodes with 384D vector embeddings
 *   - Typed directional edges (relationships)
 *   - Multi-hop traversal with relevance scoring
 *   - Subgraph extraction for context windows
 *   - Community detection (Louvain-inspired label propagation)
 *   - Full graph persistence to disk (JSON)
 *
 * Node.js built-ins only: fs, path, crypto
 */

import fs    from 'node:fs';
import path  from 'node:path';
import crypto from 'node:crypto';
import { cosineSimilarity } from './vector-db.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI = 1.6180339887498948482;

/** Default similarity threshold for vector-based traversal */
const DEFAULT_SIM_THRESHOLD = 0.75;

/** Maximum context window tokens (approximate) */
const DEFAULT_CONTEXT_LIMIT = 4096;

// ─── Edge ─────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} Edge
 * @property {string} id
 * @property {string} from       - source node id
 * @property {string} to         - target node id
 * @property {string} type       - relationship type, e.g. 'RELATED_TO', 'CAUSES', 'PART_OF'
 * @property {number} weight     - edge weight [0,1]
 * @property {object} metadata
 * @property {number} createdAt
 */

/**
 * @typedef {object} GraphNode
 * @property {string}       id
 * @property {string}       label       - human-readable label
 * @property {Float32Array|null} vector  - 384D embedding (null if not yet embedded)
 * @property {object}       metadata
 * @property {number}       community   - community id (after detection)
 * @property {number}       pageRank    - PageRank score
 * @property {number}       accessCount
 * @property {number}       createdAt
 * @property {number}       updatedAt
 */

// ─── GraphRAG ─────────────────────────────────────────────────────────────────

/**
 * Knowledge graph engine with vector-augmented retrieval.
 *
 * @example
 * const graph = new GraphRAG({ dataDir: './data/graph' });
 * await graph.init();
 * const nodeId = graph.addNode({ label: 'Machine Learning', vector: embedding });
 * graph.addEdge(nodeId, otherId, 'RELATED_TO', { weight: 0.9 });
 * const results = await graph.search(queryVec, { hops: 2, k: 5 });
 */
export class GraphRAG {
  /**
   * @param {object} opts
   * @param {string}  [opts.dataDir]
   * @param {number}  [opts.simThreshold=0.75]
   * @param {number}  [opts.contextLimit=4096]
   */
  constructor(opts = {}) {
    this.dataDir       = opts.dataDir       ?? null;
    this.simThreshold  = opts.simThreshold  ?? DEFAULT_SIM_THRESHOLD;
    this.contextLimit  = opts.contextLimit  ?? DEFAULT_CONTEXT_LIMIT;

    /** @type {Map<string, GraphNode>} */
    this._nodes = new Map();

    /** @type {Map<string, Edge>} */
    this._edges = new Map();

    /** Adjacency list: nodeId → { out: Map<edgeId, Edge>, in: Map<edgeId, Edge> } */
    this._adj = new Map();

    this._dirty = false;
    this._saveTimer = null;
  }

  // ─ init ────────────────────────────────────────────────────────────────────

  async init() {
    if (this.dataDir) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      await this._load();
    }
  }

  // ─ Node operations ─────────────────────────────────────────────────────────

  /**
   * Add or update a node.
   * @param {object}           props
   * @param {string}           [props.id]
   * @param {string}           props.label
   * @param {Float32Array|number[]|null} [props.vector]
   * @param {object}           [props.metadata]
   * @returns {string} node id
   */
  addNode(props) {
    const id  = props.id ?? crypto.randomUUID();
    const vec = props.vector
      ? (props.vector instanceof Float32Array ? props.vector : new Float32Array(props.vector))
      : null;

    const existing = this._nodes.get(id);
    const node = {
      id,
      label      : props.label ?? id,
      vector     : vec,
      metadata   : props.metadata ?? {},
      community  : -1,
      pageRank   : 1.0,
      accessCount: existing?.accessCount ?? 0,
      createdAt  : existing?.createdAt   ?? Date.now(),
      updatedAt  : Date.now(),
    };
    this._nodes.set(id, node);
    if (!this._adj.has(id)) this._adj.set(id, { out: new Map(), in: new Map() });
    this._markDirty();
    return id;
  }

  /**
   * Get a node by id.
   * @param {string} id
   * @returns {GraphNode|null}
   */
  getNode(id) { return this._nodes.get(id) ?? null; }

  /**
   * Delete a node and all its edges.
   * @param {string} id
   * @returns {boolean}
   */
  deleteNode(id) {
    const node = this._nodes.get(id);
    if (!node) return false;

    // Remove all adjacent edges
    const adj = this._adj.get(id);
    if (adj) {
      for (const edgeId of [...adj.out.keys(), ...adj.in.keys()]) {
        this._removeEdgeById(edgeId);
      }
    }

    this._nodes.delete(id);
    this._adj.delete(id);
    this._markDirty();
    return true;
  }

  // ─ Edge operations ─────────────────────────────────────────────────────────

  /**
   * Add a directed edge.
   * @param {string} from
   * @param {string} to
   * @param {string} type
   * @param {object} [opts]
   * @param {number}  [opts.weight=1]
   * @param {object}  [opts.metadata]
   * @returns {string} edge id
   */
  addEdge(from, to, type, opts = {}) {
    if (!this._nodes.has(from)) throw new Error(`Node not found: ${from}`);
    if (!this._nodes.has(to))   throw new Error(`Node not found: ${to}`);

    const id = crypto.randomUUID();
    const edge = {
      id,
      from,
      to,
      type,
      weight   : opts.weight   ?? 1.0,
      metadata : opts.metadata ?? {},
      createdAt: Date.now(),
    };
    this._edges.set(id, edge);

    // Update adjacency
    if (!this._adj.has(from)) this._adj.set(from, { out: new Map(), in: new Map() });
    if (!this._adj.has(to))   this._adj.set(to,   { out: new Map(), in: new Map() });
    this._adj.get(from).out.set(id, edge);
    this._adj.get(to).in.set(id, edge);

    this._markDirty();
    return id;
  }

  /**
   * Delete an edge by id.
   * @param {string} edgeId
   * @returns {boolean}
   */
  deleteEdge(edgeId) { return this._removeEdgeById(edgeId); }

  _removeEdgeById(edgeId) {
    const edge = this._edges.get(edgeId);
    if (!edge) return false;
    this._adj.get(edge.from)?.out.delete(edgeId);
    this._adj.get(edge.to)?.in.delete(edgeId);
    this._edges.delete(edgeId);
    this._markDirty();
    return true;
  }

  /**
   * Get all edges between two nodes.
   * @param {string} from
   * @param {string} to
   * @returns {Array<Edge>}
   */
  getEdgesBetween(from, to) {
    const adj = this._adj.get(from);
    if (!adj) return [];
    return [...adj.out.values()].filter(e => e.to === to);
  }

  // ─ Traversal ───────────────────────────────────────────────────────────────

  /**
   * BFS multi-hop traversal from a set of seed nodes.
   * @param {Array<string>} seeds       - starting node ids
   * @param {object} [opts]
   * @param {number}  [opts.hops=2]     - max traversal depth
   * @param {string|string[]} [opts.edgeTypes] - filter by edge type(s)
   * @param {boolean} [opts.directed=false]    - follow only outgoing edges
   * @param {number}  [opts.maxNodes=100]      - cap on visited nodes
   * @returns {Array<{node:GraphNode, depth:number, path:string[]}>}
   */
  traverse(seeds, opts = {}) {
    const hops     = opts.hops     ?? 2;
    const maxNodes = opts.maxNodes ?? 100;
    const directed = opts.directed ?? false;
    const edgeTypes = opts.edgeTypes
      ? (Array.isArray(opts.edgeTypes) ? new Set(opts.edgeTypes) : new Set([opts.edgeTypes]))
      : null;

    const visited = new Map(); // nodeId → { depth, path }
    const queue   = seeds.map(id => ({ id, depth: 0, path: [id] }));

    for (const id of seeds) visited.set(id, { depth: 0, path: [id] });

    const results = [];

    while (queue.length > 0 && results.length < maxNodes) {
      const { id, depth, path } = queue.shift();
      const node = this._nodes.get(id);
      if (!node) continue;
      node.accessCount++;
      results.push({ node, depth, path });

      if (depth >= hops) continue;

      const adj = this._adj.get(id);
      if (!adj) continue;

      const edgeSets = directed
        ? [adj.out.values()]
        : [adj.out.values(), adj.in.values()];

      for (const edgeIter of edgeSets) {
        for (const edge of edgeIter) {
          if (edgeTypes && !edgeTypes.has(edge.type)) continue;
          const neighborId = edge.from === id ? edge.to : edge.from;
          if (visited.has(neighborId)) continue;
          visited.set(neighborId, { depth: depth + 1, path: [...path, neighborId] });
          queue.push({ id: neighborId, depth: depth + 1, path: [...path, neighborId] });
        }
      }
    }

    return results;
  }

  /**
   * Vector similarity search → multi-hop traversal.
   * Finds the k most similar nodes to `queryVec`, then traverses their neighborhood.
   * @param {Float32Array|number[]} queryVec
   * @param {object} [opts]
   * @param {number}  [opts.k=5]         - seed nodes
   * @param {number}  [opts.hops=2]
   * @param {number}  [opts.threshold]   - similarity cutoff
   * @param {string}  [opts.edgeTypes]
   * @returns {Array<{node:GraphNode, score:number, depth:number}>}
   */
  async search(queryVec, opts = {}) {
    const vec       = queryVec instanceof Float32Array ? queryVec : new Float32Array(queryVec);
    const k         = opts.k         ?? 5;
    const hops      = opts.hops      ?? 2;
    const threshold = opts.threshold ?? this.simThreshold;

    // Find vector-similar seed nodes
    const seeds = [];
    for (const [id, node] of this._nodes) {
      if (!node.vector) continue;
      const sim = cosineSimilarity(vec, node.vector);
      if (sim >= threshold) seeds.push({ id, sim });
    }
    seeds.sort((a, b) => b.sim - a.sim);
    const topSeeds = seeds.slice(0, k).map(x => x.id);
    const seedScores = new Map(seeds.slice(0, k).map(x => [x.id, x.sim]));

    if (topSeeds.length === 0) return [];

    // Traverse from seeds
    const traversed = this.traverse(topSeeds, { hops, ...opts });

    // Score each result: seed similarity decays by PHI per hop
    return traversed
      .map(({ node, depth, path }) => {
        const seedId = path[0];
        const baseSim = seedScores.get(seedId) ?? 0;
        const score   = baseSim / Math.pow(PHI, depth);
        return { node, score, depth, path };
      })
      .sort((a, b) => b.score - a.score);
  }

  // ─ Subgraph extraction ─────────────────────────────────────────────────────

  /**
   * Extract a subgraph suitable for a context window.
   * Returns a compact JSON representation.
   * @param {Array<string>} nodeIds
   * @param {object} [opts]
   * @param {number}  [opts.maxTokens=4096] - approximate token budget
   * @returns {{nodes: Array<object>, edges: Array<object>, tokenEstimate: number}}
   */
  extractSubgraph(nodeIds, opts = {}) {
    const maxTokens = opts.maxTokens ?? this.contextLimit;

    const nodeSet  = new Set(nodeIds);
    const included = [];
    let   tokenEst = 0;

    for (const id of nodeIds) {
      const node = this._nodes.get(id);
      if (!node) continue;
      const snippet = { id: node.id, label: node.label, metadata: node.metadata };
      const tokens  = Math.ceil(JSON.stringify(snippet).length / 4);
      if (tokenEst + tokens > maxTokens) break;
      included.push(snippet);
      tokenEst += tokens;
    }

    const includedIds = new Set(included.map(n => n.id));
    const edges = [];
    for (const edge of this._edges.values()) {
      if (includedIds.has(edge.from) && includedIds.has(edge.to)) {
        edges.push({ from: edge.from, to: edge.to, type: edge.type, weight: edge.weight });
      }
    }

    return { nodes: included, edges, tokenEstimate: tokenEst };
  }

  // ─ Community Detection ─────────────────────────────────────────────────────

  /**
   * Label propagation community detection (simple, O(V+E)).
   * Updates node.community for all nodes.
   * @param {number} [iterations=10]
   * @returns {Map<number, string[]>} community → node ids
   */
  detectCommunities(iterations = 10) {
    // Initialize: each node gets its own community
    for (const [id, node] of this._nodes) node.community = id.hashCode?.() ?? this._hashId(id);

    for (let iter = 0; iter < iterations; iter++) {
      const order = [...this._nodes.keys()].sort(() => Math.random() - 0.5);
      let changed = false;

      for (const id of order) {
        const adj = this._adj.get(id);
        if (!adj) continue;

        // Gather community labels from neighbors
        const votes = new Map();
        for (const edge of [...adj.out.values(), ...adj.in.values()]) {
          const neighborId = edge.from === id ? edge.to : edge.from;
          const neighbor   = this._nodes.get(neighborId);
          if (!neighbor) continue;
          const w = votes.get(neighbor.community) ?? 0;
          votes.set(neighbor.community, w + edge.weight);
        }

        if (votes.size === 0) continue;

        // Adopt the community with the highest total weight
        let bestCom = null, bestWeight = -1;
        for (const [com, w] of votes) {
          if (w > bestWeight) { bestWeight = w; bestCom = com; }
        }

        const node = this._nodes.get(id);
        if (bestCom !== null && bestCom !== node.community) {
          node.community = bestCom;
          changed = true;
        }
      }

      if (!changed) break;
    }

    const communities = new Map();
    for (const [id, node] of this._nodes) {
      if (!communities.has(node.community)) communities.set(node.community, []);
      communities.get(node.community).push(id);
    }

    this._markDirty();
    return communities;
  }

  _hashId(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
    return h;
  }

  // ─ PageRank ────────────────────────────────────────────────────────────────

  /**
   * Compute PageRank for all nodes.
   * @param {number} [iterations=20]
   * @param {number} [damping=0.85]
   */
  computePageRank(iterations = 20, damping = 0.85) {
    const N = this._nodes.size;
    if (N === 0) return;

    for (const node of this._nodes.values()) node.pageRank = 1 / N;

    for (let iter = 0; iter < iterations; iter++) {
      const newRanks = new Map();
      for (const id of this._nodes.keys()) newRanks.set(id, (1 - damping) / N);

      for (const [id, adj] of this._adj) {
        const outCount = adj.out.size;
        if (outCount === 0) continue;
        const node = this._nodes.get(id);
        if (!node) continue;
        const share = node.pageRank / outCount;
        for (const edge of adj.out.values()) {
          newRanks.set(edge.to, (newRanks.get(edge.to) ?? 0) + damping * share);
        }
      }

      for (const [id, rank] of newRanks) {
        const node = this._nodes.get(id);
        if (node) node.pageRank = rank;
      }
    }
    this._markDirty();
  }

  // ─ Persistence ─────────────────────────────────────────────────────────────

  _markDirty() {
    this._dirty = true;
    if (this.dataDir && !this._saveTimer) {
      this._saveTimer = setTimeout(() => { this._saveTimer = null; this.save(); }, 3000);
    }
  }

  async save() {
    if (!this.dataDir || !this._dirty) return;
    this._dirty = false;

    const nodes = [];
    for (const node of this._nodes.values()) {
      nodes.push({
        ...node,
        vector: node.vector ? Array.from(node.vector) : null,
      });
    }

    const edges = [...this._edges.values()];
    const data  = { version: 1, ts: Date.now(), nodes, edges };

    const filePath = path.join(this.dataDir, 'graph.json');
    await fs.promises.writeFile(filePath, JSON.stringify(data));
  }

  async _load() {
    const filePath = path.join(this.dataDir, 'graph.json');
    if (!fs.existsSync(filePath)) return;

    try {
      const data = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));

      for (const n of (data.nodes ?? [])) {
        n.vector = n.vector ? new Float32Array(n.vector) : null;
        this._nodes.set(n.id, n);
        if (!this._adj.has(n.id)) this._adj.set(n.id, { out: new Map(), in: new Map() });
      }

      for (const e of (data.edges ?? [])) {
        this._edges.set(e.id, e);
        if (!this._adj.has(e.from)) this._adj.set(e.from, { out: new Map(), in: new Map() });
        if (!this._adj.has(e.to))   this._adj.set(e.to,   { out: new Map(), in: new Map() });
        this._adj.get(e.from).out.set(e.id, e);
        this._adj.get(e.to).in.set(e.id, e);
      }
    } catch (err) {
      console.error('[GraphRAG] Load failed:', err.message);
    }
  }

  async close() {
    if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
    await this.save();
  }

  // ─ Stats ───────────────────────────────────────────────────────────────────

  stats() {
    const communities = new Set([...this._nodes.values()].map(n => n.community));
    return {
      nodes: this._nodes.size,
      edges: this._edges.size,
      communities: communities.size,
    };
  }
}

export default GraphRAG;
