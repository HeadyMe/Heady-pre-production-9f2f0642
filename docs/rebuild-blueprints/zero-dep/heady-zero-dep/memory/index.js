/**
 * @fileoverview Heady Memory System — Main Entry Point
 * Zero-dependency memory subsystem for the Heady AI platform.
 *
 * Replaces:
 *   - PostgreSQL / pgvector / Neon DB  → VectorDB (HNSW)
 *   - Redis / Upstash                  → KVStore
 *   - Graph databases                  → GraphRAG
 *   - External memory services         → STMLTM
 *   - External embedding APIs (opt-in) → EmbeddingEngine
 *   - Distributed vector services      → VectorFederation
 *   - Spatial indexing libraries       → OctreeSpatial
 *
 * PHI = 1.618… governs all timing, decay, and eviction thresholds.
 *
 * Usage:
 * @example
 * import { createMemorySystem } from './memory/index.js';
 *
 * const memory = await createMemorySystem({
 *   dataDir   : './data',
 *   nodeId    : 'node-brain',
 *   embedding : { provider: 'local' },
 * });
 *
 * // Store a memory
 * const vec = await memory.embedding.embed('Heady processes knowledge');
 * await memory.vectorDb.insert('m1', vec, { type: 'concept' });
 * await memory.stmLtm.remember({ content: 'Heady processes knowledge', vector: vec, importance: 0.8 });
 *
 * // Retrieve
 * const results = await memory.vectorDb.search(vec, { k: 5 });
 * const recalled = await memory.stmLtm.searchByVector(vec, { from: 'both', k: 5 });
 *
 * // Graceful shutdown
 * await memory.close();
 */

import path from 'node:path';

// ─── Module exports ───────────────────────────────────────────────────────────

export { VectorDB, cosineSimilarity, euclideanDistance, dotProduct } from './vector-db.js';
export { KVStore }                                                    from './kv-store.js';
export { GraphRAG }                                                   from './graph-rag.js';
export { STMLTM, MemoryConsolidator }                                 from './stm-ltm.js';
export { EmbeddingEngine }                                            from './embedding-engine.js';
export { VectorFederation, VectorClock, Consistency }                 from './vector-federation.js';
export { OctreeSpatial }                                              from './octree-spatial.js';

// ─── PHI constant (re-exported for consumers) ────────────────────────────────

/** Golden ratio φ = 1.618… — used throughout for timing and scaling */
export const PHI = 1.6180339887498948482;

// ─── MemorySystem ─────────────────────────────────────────────────────────────

/**
 * Composite memory system that wires all subsystems together.
 * Initialised via {@link createMemorySystem}.
 */
export class MemorySystem {
  /**
   * @param {object}           opts
   * @param {VectorDB}         opts.vectorDb
   * @param {KVStore}          opts.kvStore
   * @param {GraphRAG}         opts.graphRag
   * @param {STMLTM}           opts.stmLtm
   * @param {EmbeddingEngine}  opts.embedding
   * @param {VectorFederation|null} opts.federation
   * @param {OctreeSpatial}    opts.spatial
   */
  constructor(opts) {
    /** @type {import('./vector-db.js').VectorDB} */
    this.vectorDb  = opts.vectorDb;

    /** @type {import('./kv-store.js').KVStore} */
    this.kvStore   = opts.kvStore;

    /** @type {import('./graph-rag.js').GraphRAG} */
    this.graphRag  = opts.graphRag;

    /** @type {import('./stm-ltm.js').STMLTM} */
    this.stmLtm    = opts.stmLtm;

    /** @type {import('./embedding-engine.js').EmbeddingEngine} */
    this.embedding = opts.embedding;

    /** @type {import('./vector-federation.js').VectorFederation|null} */
    this.federation = opts.federation;

    /** @type {import('./octree-spatial.js').OctreeSpatial} */
    this.spatial   = opts.spatial;
  }

  // ─ High-level API ──────────────────────────────────────────────────────────

  /**
   * Embed text and store in all relevant subsystems atomically.
   * @param {object}  props
   * @param {string}  props.id
   * @param {string}  props.content
   * @param {object}  [props.metadata]
   * @param {number}  [props.importance=0.5]
   * @param {Point3D} [props.position]     - 3D spatial position
   * @returns {Promise<{id:string, vector:Float32Array}>}
   */
  async store(props) {
    const { id, content, metadata = {}, importance = 0.5, position } = props;

    const vector = await this.embedding.embed(content);

    // Vector DB
    await this.vectorDb.insert(id, vector, { ...metadata, content });

    // STM/LTM
    await this.stmLtm.remember({ id, content, vector, importance, metadata });

    // Graph RAG node
    this.graphRag.addNode({ id, label: content.slice(0, 60), vector, metadata });

    // Spatial indexing
    if (position) {
      this.spatial.insert({ id, position, label: content.slice(0, 40), metadata });
    }

    // KV cache for fast lookup
    await this.kvStore.set(`content:${id}`, content, { ttl: Math.round(PHI * 3600 * 1000) });

    return { id, vector };
  }

  /**
   * Recall the K most relevant memories for a text query.
   * Searches vector DB + STM/LTM in parallel and merges results.
   * @param {string} query
   * @param {object} [opts]
   * @param {number}  [opts.k=10]
   * @param {number}  [opts.hops=2]         - graph traversal hops
   * @param {boolean} [opts.useGraph=true]
   * @returns {Promise<Array<{id:string, score:number, source:string, content?:string}>>}
   */
  async recall(query, opts = {}) {
    const k        = opts.k        ?? 10;
    const useGraph = opts.useGraph ?? true;
    const hops     = opts.hops     ?? 2;

    const queryVec = await this.embedding.embed(query);

    // Parallel search
    const [vectorResults, memoryResults] = await Promise.all([
      this.vectorDb.search(queryVec, { k: k * 2 }),
      this.stmLtm.searchByVector(queryVec, { from: 'both', k: k * 2 }),
    ]);

    const seen   = new Map();
    const addResult = (id, score, source, metadata) => {
      if (!seen.has(id) || score > seen.get(id).score) {
        seen.set(id, { id, score, source, metadata });
      }
    };

    for (const r of vectorResults)  addResult(r.id, r.score, 'vectorDb', r.metadata);
    for (const r of memoryResults)  addResult(r.entry.id, r.score, r.source, r.entry.metadata);

    // Graph-expanded results
    if (useGraph && seen.size > 0) {
      const graphResults = await this.graphRag.search(queryVec, { k: Math.min(k, 5), hops });
      for (const r of graphResults) {
        addResult(r.node.id, r.score, 'graph', r.node.metadata);
      }
    }

    // Enrich with cached content
    const results = [...seen.values()].sort((a, b) => b.score - a.score).slice(0, k);
    for (const r of results) {
      const content = await this.kvStore.get(`content:${r.id}`);
      if (content) r.content = content;
    }

    return results;
  }

  /**
   * Connect two memories with a typed relationship in the graph.
   * @param {string} fromId
   * @param {string} toId
   * @param {string} [type='RELATED_TO']
   * @param {number} [weight=0.8]
   * @returns {string} edge id
   */
  connect(fromId, toId, type = 'RELATED_TO', weight = 0.8) {
    return this.graphRag.addEdge(fromId, toId, type, { weight });
  }

  /**
   * Run memory consolidation (STM → LTM), forgetting curve, and dream cycle.
   * @returns {Promise<object>}
   */
  async consolidate() {
    return this.stmLtm.consolidate();
  }

  /**
   * Get aggregated stats from all subsystems.
   * @returns {object}
   */
  stats() {
    return {
      vectorDb  : this.vectorDb.stats(),
      kvStore   : this.kvStore.stats(),
      graphRag  : this.graphRag.stats(),
      stmLtm    : this.stmLtm.stats(),
      embedding : this.embedding.stats(),
      spatial   : this.spatial.stats(),
      federation: this.federation?.stats() ?? null,
    };
  }

  /**
   * Gracefully shut down all subsystems.
   */
  async close() {
    await Promise.all([
      this.vectorDb.close(),
      this.kvStore.close(),
      this.graphRag.close(),
      this.stmLtm.close(),
    ]);
    this.federation?.stop();
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create and initialise a complete MemorySystem.
 *
 * @param {object}  [opts={}]
 * @param {string}  [opts.dataDir]                 - root dir for all persistence
 * @param {string}  [opts.nodeId='local']           - this node's federation id
 * @param {string}  [opts.metric='cosine']          - vector distance metric
 * @param {boolean} [opts.sharding=true]            - octant sharding
 * @param {object}  [opts.embedding]               - embedding engine options
 * @param {boolean} [opts.federation=false]         - enable federation
 * @param {Array}   [opts.peers=[]]                - peer node configs
 * @param {string}  [opts.consistency='QUORUM']     - replication consistency
 * @param {boolean} [opts.autoDream=true]           - STM→LTM background cycle
 * @returns {Promise<MemorySystem>}
 */
export async function createMemorySystem(opts = {}) {
  const {
    VectorDB      : VDB  } = await import('./vector-db.js');
  const { KVStore        } = await import('./kv-store.js');
  const { GraphRAG       } = await import('./graph-rag.js');
  const { STMLTM         } = await import('./stm-ltm.js');
  const { EmbeddingEngine} = await import('./embedding-engine.js');
  const { VectorFederation, Consistency } = await import('./vector-federation.js');
  const { OctreeSpatial  } = await import('./octree-spatial.js');

  const dataDir = opts.dataDir ?? null;

  const vectorDb = new VDB({
    dataDir: dataDir ? path.join(dataDir, 'vectors') : null,
    metric : opts.metric   ?? 'cosine',
    sharding: opts.sharding ?? true,
  });

  const kvStore = new KVStore({
    dataDir: dataDir ? path.join(dataDir, 'kv') : null,
  });

  const graphRag = new GraphRAG({
    dataDir: dataDir ? path.join(dataDir, 'graph') : null,
  });

  const stmLtm = new STMLTM({
    dataDir  : dataDir ? path.join(dataDir, 'memory') : null,
    autoDream: opts.autoDream ?? true,
  });

  const embedding = new EmbeddingEngine(opts.embedding ?? {});

  const spatial = new OctreeSpatial();

  let federation = null;
  if (opts.federation && (opts.peers?.length ?? 0) > 0) {
    federation = new VectorFederation({
      localDb    : vectorDb,
      localNodeId: opts.nodeId ?? 'local',
      nodes      : opts.peers ?? [],
      consistency: opts.consistency ?? Consistency.QUORUM,
    });
    federation.start();
  }

  // Initialise all subsystems
  await Promise.all([
    vectorDb.init(),
    kvStore.init(),
    graphRag.init(),
    stmLtm.init(),
  ]);

  return new MemorySystem({ vectorDb, kvStore, graphRag, stmLtm, embedding, federation, spatial });
}

export default createMemorySystem;
