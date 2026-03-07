'use strict';

/**
 * HeadyVector — Main Service Entry Point
 * Self-hosted vector search service backed by PostgreSQL + pgvector.
 * Replaces Pinecone/Weaviate with full HNSW, hybrid BM25+semantic, and Graph RAG.
 *
 * Sacred Geometry: PHI = 1.618033988749895
 */

const { Pool } = require('pg');
const config = require('./config');
const { MigrationRunner } = require('./migrations');
const { CollectionManager } = require('./collections');
const { IndexManager } = require('./indexes');
const { SearchEngine } = require('./search');
const { GraphRAG } = require('./graph-rag');
const { HealthChecker } = require('./health');

// ─── HeadyVector class ────────────────────────────────────────────────────────

class HeadyVector {
  constructor(opts = {}) {
    this.config = { ...config, ...opts };

    // PostgreSQL connection pool
    this.pool = new Pool({
      connectionString: this.config.database.url,
      max: this.config.database.poolSize,
      idleTimeoutMillis: this.config.database.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.database.connectionTimeoutMillis,
      statement_timeout: this.config.database.statementTimeout,
      ssl: this.config.database.ssl || undefined,
    });

    this.pool.on('error', (err) => {
      console.error('[heady-vector] Pool error:', err.message);
    });

    // Sub-systems (initialized in start())
    this.migrations = null;
    this.indexes = null;
    this.collections = null;
    this.search = null;
    this.graph = null;
    this.health = null;

    this._ready = false;
    this._metrics = {
      upserts: 0,
      queries: 0,
      errors: 0,
      startTime: null,
    };
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Initialize the service: run migrations, build subsystems.
   * @returns {Promise<void>}
   */
  async start() {
    console.log(`[heady-vector] Starting service v${this.config.version}...`);
    this._metrics.startTime = new Date();

    // Run migrations
    this.migrations = new MigrationRunner(this.pool);
    const { applied } = await this.migrations.runAll();
    if (applied.length > 0) {
      console.log(`[heady-vector] Applied ${applied.length} migration(s): ${applied.join(', ')}`);
    }

    // Initialize subsystems
    this.indexes = new IndexManager(this.pool);
    this.collections = new CollectionManager(this.pool, this.indexes);
    this.search = new SearchEngine(this.pool, this.indexes, this.collections);
    this.graph = new GraphRAG(this.pool, this.indexes);
    this.health = new HealthChecker(this.pool, this.indexes);

    this._ready = true;
    console.log(`[heady-vector] Ready on port ${this.config.port}`);
  }

  /**
   * Graceful shutdown.
   * @returns {Promise<void>}
   */
  async stop() {
    this._ready = false;
    await this.pool.end();
    console.log('[heady-vector] Stopped');
  }

  /**
   * Assert service is ready.
   */
  _assertReady() {
    if (!this._ready) throw new Error('HeadyVector service is not ready');
  }

  // ─── Collection operations ──────────────────────────────────────────────────

  /**
   * Create a collection.
   * @param {object} opts
   * @returns {Promise<object>}
   */
  async createCollection(opts) {
    this._assertReady();
    return this.collections.create(opts);
  }

  /**
   * Get collection by name.
   * @param {string} name
   * @returns {Promise<object|null>}
   */
  async getCollection(name) {
    this._assertReady();
    return this.collections.get(name);
  }

  /**
   * List collections.
   * @param {object} [opts]
   * @returns {Promise<{collections: object[], total: number}>}
   */
  async listCollections(opts = {}) {
    this._assertReady();
    return this.collections.list(opts);
  }

  /**
   * Delete collection and all vectors.
   * @param {string} name
   * @returns {Promise<object>}
   */
  async deleteCollection(name) {
    this._assertReady();
    return this.collections.delete(name);
  }

  /**
   * Get collection stats.
   * @param {string} name
   * @returns {Promise<object>}
   */
  async collectionStats(name) {
    this._assertReady();
    return this.collections.stats(name);
  }

  // ─── Vector operations ──────────────────────────────────────────────────────

  /**
   * Upsert a single vector.
   * @param {object} opts
   * @param {string} opts.collection - collection name
   * @param {string} [opts.namespace='default']
   * @param {string} [opts.id] - external ID for upsert semantics
   * @param {Float32Array|number[]} opts.vector - embedding values
   * @param {string} [opts.content] - text content for BM25
   * @param {object} [opts.metadata={}]
   * @returns {Promise<object>} upserted vector record
   */
  async upsert(opts) {
    this._assertReady();
    this._metrics.upserts++;
    return this._upsertOne(opts);
  }

  /**
   * Batch upsert vectors with configurable batch size.
   * @param {string} collectionName
   * @param {Array<object>} vectors - array of vector objects
   * @param {object} [opts]
   * @param {number} [opts.batchSize]
   * @param {string} [opts.namespace='default']
   * @returns {Promise<{upserted: number, errors: Array}>}
   */
  async upsertBatch(collectionName, vectors, opts = {}) {
    this._assertReady();
    const batchSize = opts.batchSize || this.config.batch.upsertSize;
    const namespace = opts.namespace || 'default';
    const collection = await this.collections.require(collectionName);

    let upserted = 0;
    const errors = [];

    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (v, j) => {
          try {
            await this._upsertOne({
              collection: collectionName,
              collectionObj: collection,
              namespace: v.namespace || namespace,
              id: v.id,
              vector: v.vector || v.embedding,
              content: v.content,
              metadata: v.metadata || {},
            });
            upserted++;
            this._metrics.upserts++;
          } catch (err) {
            errors.push({ index: i + j, id: v.id, error: err.message });
          }
        })
      );
    }

    return { upserted, errors };
  }

  /**
   * Internal: upsert a single vector record.
   * @param {object} opts
   * @returns {Promise<object>}
   */
  async _upsertOne(opts) {
    const {
      collection: collectionName,
      collectionObj,
      namespace = 'default',
      id: externalId,
      vector,
      content,
      metadata = {},
    } = opts;

    const collection = collectionObj || await this.collections.require(collectionName);

    // Validate metadata schema if present
    if (collection.metadata_schema) {
      const { valid, errors } = this.collections.validateMetadata(collection, metadata);
      if (!valid) {
        throw new Error(`Metadata validation failed: ${errors.join('; ')}`);
      }
    }

    // Validate vector dimensions
    if (vector && vector.length !== collection.dimension) {
      throw new Error(
        `Vector dimension mismatch: expected ${collection.dimension}, got ${vector.length}`
      );
    }

    // Format vector as PostgreSQL array literal
    const vecArray = vector ? `[${Array.from(vector).join(',')}]` : null;
    const embeddingCol = collection.dimension === 768 ? 'embedding_768' : 'embedding';

    const client = await this.pool.connect();
    try {
      let result;

      if (externalId) {
        // Upsert by external_id
        result = await client.query(
          `INSERT INTO heady_vectors
             (collection_id, namespace, external_id, ${embeddingCol}, dimension, content, metadata)
           VALUES ($1, $2, $3, $4::vector, $5, $6, $7)
           ON CONFLICT (collection_id, namespace, external_id)
           DO UPDATE SET
             ${embeddingCol} = EXCLUDED.${embeddingCol},
             content         = EXCLUDED.content,
             metadata        = EXCLUDED.metadata,
             updated_at      = NOW()
           RETURNING *`,
          [collection.id, namespace, externalId, vecArray, collection.dimension,
           content || null, JSON.stringify(metadata)]
        );
      } else {
        // Insert new vector (no external_id)
        result = await client.query(
          `INSERT INTO heady_vectors
             (collection_id, namespace, ${embeddingCol}, dimension, content, metadata)
           VALUES ($1, $2, $3::vector, $4, $5, $6)
           RETURNING *`,
          [collection.id, namespace, vecArray, collection.dimension,
           content || null, JSON.stringify(metadata)]
        );
      }

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Get a vector by internal UUID.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async getVector(id) {
    this._assertReady();
    const result = await this.pool.query(
      `SELECT v.*, c.name AS collection_name
       FROM heady_vectors v
       JOIN heady_collections c ON c.id = v.collection_id
       WHERE v.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get a vector by external_id within a collection/namespace.
   * @param {string} collectionName
   * @param {string} externalId
   * @param {string} [namespace='default']
   * @returns {Promise<object|null>}
   */
  async getVectorByExternalId(collectionName, externalId, namespace = 'default') {
    this._assertReady();
    const collection = await this.collections.require(collectionName);
    const result = await this.pool.query(
      `SELECT * FROM heady_vectors
       WHERE collection_id = $1 AND namespace = $2 AND external_id = $3`,
      [collection.id, namespace, externalId]
    );
    return result.rows[0] || null;
  }

  /**
   * Delete a vector by internal UUID.
   * @param {string} id
   * @returns {Promise<{deleted: boolean}>}
   */
  async deleteVector(id) {
    this._assertReady();
    const result = await this.pool.query(
      'DELETE FROM heady_vectors WHERE id = $1 RETURNING id',
      [id]
    );
    return { deleted: result.rows.length > 0 };
  }

  /**
   * Delete vectors matching a metadata filter.
   * @param {string} collectionName
   * @param {object} filter - metadata key/value filter
   * @param {string} [namespace]
   * @returns {Promise<{deleted: number}>}
   */
  async deleteByFilter(collectionName, filter, namespace) {
    this._assertReady();
    const collection = await this.collections.require(collectionName);
    const conditions = ['collection_id = $1'];
    const params = [collection.id];
    let idx = 2;

    if (namespace) {
      conditions.push(`namespace = $${idx++}`);
      params.push(namespace);
    }

    for (const [key, value] of Object.entries(filter)) {
      conditions.push(`metadata @> $${idx++}::jsonb`);
      params.push(JSON.stringify({ [key]: value }));
    }

    const result = await this.pool.query(
      `DELETE FROM heady_vectors WHERE ${conditions.join(' AND ')} RETURNING id`,
      params
    );
    return { deleted: result.rows.length };
  }

  // ─── Search operations ──────────────────────────────────────────────────────

  /**
   * Semantic vector search.
   * @param {object} opts
   * @returns {Promise<{results: object[], latencyMs: number}>}
   */
  async semanticSearch(opts) {
    this._assertReady();
    this._metrics.queries++;
    return this.search.semantic(opts);
  }

  /**
   * BM25 full-text search.
   * @param {object} opts
   * @returns {Promise<{results: object[], latencyMs: number}>}
   */
  async bm25Search(opts) {
    this._assertReady();
    this._metrics.queries++;
    return this.search.bm25(opts);
  }

  /**
   * Hybrid search combining semantic + BM25 with RRF.
   * @param {object} opts
   * @returns {Promise<{results: object[], latencyMs: number}>}
   */
  async hybridSearch(opts) {
    this._assertReady();
    this._metrics.queries++;
    return this.search.hybrid(opts);
  }

  /**
   * MMR diverse search.
   * @param {object} opts
   * @returns {Promise<{results: object[], latencyMs: number}>}
   */
  async mmrSearch(opts) {
    this._assertReady();
    this._metrics.queries++;
    return this.search.mmr(opts);
  }

  // ─── Graph RAG operations ───────────────────────────────────────────────────

  /**
   * Add a graph node.
   * @param {object} opts
   * @returns {Promise<object>}
   */
  async addNode(opts) {
    this._assertReady();
    return this.graph.addNode(opts);
  }

  /**
   * Add a graph edge.
   * @param {object} opts
   * @returns {Promise<object>}
   */
  async addEdge(opts) {
    this._assertReady();
    return this.graph.addEdge(opts);
  }

  /**
   * Graph traversal query.
   * @param {object} opts
   * @returns {Promise<object>}
   */
  async traverse(opts) {
    this._assertReady();
    return this.graph.traverse(opts);
  }

  /**
   * Graph RAG retrieval.
   * @param {object} opts
   * @returns {Promise<object>}
   */
  async graphRag(opts) {
    this._assertReady();
    return this.graph.rag(opts);
  }

  // ─── Health & metrics ───────────────────────────────────────────────────────

  /**
   * Health check.
   * @returns {Promise<object>}
   */
  async healthCheck() {
    if (!this._ready) return { status: 'starting', ready: false };
    return this.health.check();
  }

  /**
   * Get service metrics.
   * @returns {object}
   */
  getMetrics() {
    return {
      ...this._metrics,
      uptime: this._metrics.startTime
        ? Date.now() - this._metrics.startTime.getTime()
        : 0,
      poolTotal: this.pool.totalCount,
      poolIdle: this.pool.idleCount,
      poolWaiting: this.pool.waitingCount,
    };
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _instance = null;

/**
 * Get or create the singleton HeadyVector instance.
 * @param {object} [opts]
 * @returns {HeadyVector}
 */
function getInstance(opts) {
  if (!_instance) {
    _instance = new HeadyVector(opts);
  }
  return _instance;
}

module.exports = { HeadyVector, getInstance };
