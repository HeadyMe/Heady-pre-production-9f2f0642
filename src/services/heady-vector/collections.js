'use strict';

/**
 * HeadyVector Collection Management
 * Collections are the top-level namespace for vectors, analogous to Pinecone indexes.
 * Each collection maps to a configuration row in heady_collections.
 * HNSW/IVFFlat indexes are created per-collection by indexes.js.
 */

const { v4: uuidv4 } = require('uuid');
const config = require('./config');

// ─── Schema validation helpers ────────────────────────────────────────────────

/**
 * Validate metadata against a JSON Schema-like spec stored on the collection.
 * Supports: type, required, properties (basic type-checking only).
 * @param {object} metadata
 * @param {object|null} schema
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateMetadata(metadata, schema) {
  if (!schema) return { valid: true, errors: [] };
  const errors = [];

  if (schema.required && Array.isArray(schema.required)) {
    for (const field of schema.required) {
      if (!(field in metadata)) {
        errors.push(`Missing required metadata field: "${field}"`);
      }
    }
  }

  if (schema.properties && typeof schema.properties === 'object') {
    for (const [field, spec] of Object.entries(schema.properties)) {
      if (field in metadata && spec.type) {
        const actualType = Array.isArray(metadata[field]) ? 'array' : typeof metadata[field];
        if (actualType !== spec.type) {
          errors.push(`Metadata field "${field}" must be of type "${spec.type}", got "${actualType}"`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── CollectionManager class ──────────────────────────────────────────────────

class CollectionManager {
  /**
   * @param {import('pg').Pool} pool
   * @param {object} indexManager - instance of IndexManager from indexes.js
   */
  constructor(pool, indexManager) {
    this.pool = pool;
    this.indexManager = indexManager;
    this._cache = new Map(); // name -> collection row (TTL cache)
    this._cacheTTL = 60000; // 60s
    this._cacheTimestamps = new Map();
  }

  // ── Cache helpers ────────────────────────────────────────────────────────────

  _cacheSet(name, value) {
    this._cache.set(name, value);
    this._cacheTimestamps.set(name, Date.now());
  }

  _cacheGet(name) {
    const ts = this._cacheTimestamps.get(name);
    if (!ts || Date.now() - ts > this._cacheTTL) {
      this._cache.delete(name);
      this._cacheTimestamps.delete(name);
      return null;
    }
    return this._cache.get(name) || null;
  }

  _cacheInvalidate(name) {
    this._cache.delete(name);
    this._cacheTimestamps.delete(name);
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  /**
   * Create a new collection.
   * @param {object} opts
   * @param {string} opts.name - collection name (unique)
   * @param {number} [opts.dimension=384] - vector dimension
   * @param {string} [opts.description]
   * @param {object|null} [opts.metadataSchema]
   * @param {number} [opts.hnswM]
   * @param {number} [opts.hnswEfConstruction]
   * @param {number} [opts.hnswEfSearch]
   * @param {string} [opts.indexType='hnsw']
   * @param {string} [opts.distanceMetric='cosine']
   * @param {string[]} [opts.accessRoles=['*']]
   * @returns {Promise<object>} created collection
   */
  async create(opts) {
    const {
      name,
      dimension = config.vectorDimensions.default,
      description = null,
      metadataSchema = null,
      hnswM = config.hnsw.m,
      hnswEfConstruction = config.hnsw.efConstruction,
      hnswEfSearch = config.hnsw.efSearch,
      indexType = 'hnsw',
      distanceMetric = 'cosine',
      accessRoles = ['*'],
    } = opts;

    // Validate name
    if (!name || typeof name !== 'string') {
      throw new Error('Collection name is required and must be a string');
    }
    if (name.length > config.collections.maxNameLength) {
      throw new Error(`Collection name exceeds max length of ${config.collections.maxNameLength}`);
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error('Collection name must contain only alphanumeric characters, underscores, and hyphens');
    }

    // Validate dimension
    const validDims = Object.values(config.vectorDimensions).filter((d) => typeof d === 'number');
    if (!validDims.includes(dimension)) {
      throw new Error(`Unsupported dimension ${dimension}. Supported: ${validDims.join(', ')}`);
    }

    const client = await this.pool.connect();
    try {
      // Check for duplicates
      const existing = await client.query(
        'SELECT id FROM heady_collections WHERE name = $1',
        [name]
      );
      if (existing.rows.length > 0) {
        throw new Error(`Collection "${name}" already exists`);
      }

      const result = await client.query(
        `INSERT INTO heady_collections
           (name, dimension, description, metadata_schema, hnsw_m, hnsw_ef_construction,
            hnsw_ef_search, index_type, distance_metric, access_roles)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          name, dimension, description,
          metadataSchema ? JSON.stringify(metadataSchema) : null,
          hnswM, hnswEfConstruction, hnswEfSearch,
          indexType, distanceMetric,
          accessRoles,
        ]
      );

      const collection = result.rows[0];

      // Create vector index for this collection
      if (indexType !== 'none') {
        await this.indexManager.createCollectionIndex(collection);
      }

      this._cacheSet(name, collection);
      return collection;
    } finally {
      client.release();
    }
  }

  /**
   * Get a collection by name.
   * @param {string} name
   * @returns {Promise<object|null>}
   */
  async get(name) {
    const cached = this._cacheGet(name);
    if (cached) return cached;

    const result = await this.pool.query(
      'SELECT * FROM heady_collections WHERE name = $1',
      [name]
    );
    if (result.rows.length === 0) return null;
    const collection = result.rows[0];
    this._cacheSet(name, collection);
    return collection;
  }

  /**
   * Get a collection by ID.
   * @param {string} id - UUID
   * @returns {Promise<object|null>}
   */
  async getById(id) {
    const result = await this.pool.query(
      'SELECT * FROM heady_collections WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Require a collection by name — throws if not found.
   * @param {string} name
   * @returns {Promise<object>}
   */
  async require(name) {
    const collection = await this.get(name);
    if (!collection) {
      throw new Error(`Collection "${name}" not found`);
    }
    return collection;
  }

  /**
   * List all collections with optional pagination.
   * @param {object} [opts]
   * @param {number} [opts.limit=100]
   * @param {number} [opts.offset=0]
   * @returns {Promise<{collections: object[], total: number}>}
   */
  async list(opts = {}) {
    const { limit = 100, offset = 0 } = opts;

    const [rowsResult, countResult] = await Promise.all([
      this.pool.query(
        `SELECT c.*,
                COUNT(v.id) AS vector_count
         FROM heady_collections c
         LEFT JOIN heady_vectors v ON v.collection_id = c.id
         GROUP BY c.id
         ORDER BY c.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      this.pool.query('SELECT COUNT(*) AS total FROM heady_collections'),
    ]);

    return {
      collections: rowsResult.rows,
      total: parseInt(countResult.rows[0].total, 10),
    };
  }

  /**
   * Update collection settings.
   * @param {string} name
   * @param {object} updates - partial collection fields
   * @returns {Promise<object>}
   */
  async update(name, updates) {
    const allowed = ['description', 'metadata_schema', 'hnsw_ef_search', 'access_roles'];
    const setClauses = [];
    const values = [];
    let idx = 1;

    for (const key of allowed) {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      const val = updates[key] ?? updates[camelKey];
      if (val !== undefined) {
        setClauses.push(`${key} = $${idx++}`);
        values.push(
          key === 'metadata_schema' ? JSON.stringify(val) :
          key === 'access_roles' ? val :
          val
        );
      }
    }

    if (setClauses.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(name);
    const result = await this.pool.query(
      `UPDATE heady_collections SET ${setClauses.join(', ')} WHERE name = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error(`Collection "${name}" not found`);
    }

    const collection = result.rows[0];
    this._cacheSet(name, collection);
    return collection;
  }

  /**
   * Delete a collection and all its vectors (CASCADE).
   * @param {string} name
   * @returns {Promise<{deleted: boolean, vectorsRemoved: number}>}
   */
  async delete(name) {
    const collection = await this.get(name);
    if (!collection) {
      throw new Error(`Collection "${name}" not found`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Count vectors before deletion
      const countResult = await client.query(
        'SELECT COUNT(*) AS cnt FROM heady_vectors WHERE collection_id = $1',
        [collection.id]
      );
      const vectorsRemoved = parseInt(countResult.rows[0].cnt, 10);

      // Drop HNSW/IVFFlat indexes for this collection
      await this.indexManager.dropCollectionIndexes(collection.id);

      // Delete collection (vectors CASCADE)
      await client.query('DELETE FROM heady_collections WHERE id = $1', [collection.id]);
      await client.query('COMMIT');

      this._cacheInvalidate(name);
      return { deleted: true, vectorsRemoved };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Get detailed stats for a collection.
   * @param {string} name
   * @returns {Promise<object>}
   */
  async stats(name) {
    const collection = await this.require(name);

    const [vectorStats, indexInfo, queryStats] = await Promise.all([
      this.pool.query(
        `SELECT
           COUNT(*) AS total_vectors,
           COUNT(DISTINCT namespace) AS namespace_count,
           array_agg(DISTINCT namespace) AS namespaces,
           pg_size_pretty(pg_total_relation_size('heady_vectors')) AS table_size_pretty,
           pg_total_relation_size('heady_vectors') AS table_size_bytes,
           MIN(created_at) AS oldest_vector,
           MAX(created_at) AS newest_vector
         FROM heady_vectors
         WHERE collection_id = $1`,
        [collection.id]
      ),
      this.indexManager.getCollectionIndexInfo(collection.id),
      this.pool.query(
        `SELECT
           query_type,
           COUNT(*) AS count,
           AVG(latency_ms) AS avg_latency_ms,
           MAX(latency_ms) AS max_latency_ms,
           PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms
         FROM heady_query_metrics
         WHERE collection_id = $1
           AND created_at > NOW() - INTERVAL '1 hour'
         GROUP BY query_type`,
        [collection.id]
      ),
    ]);

    return {
      collection,
      vectors: vectorStats.rows[0],
      indexes: indexInfo,
      queryStats: queryStats.rows,
    };
  }

  /**
   * Validate metadata against collection schema.
   * @param {object} collection
   * @param {object} metadata
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validateMetadata(collection, metadata) {
    return validateMetadata(metadata, collection.metadata_schema);
  }

  /**
   * Check if a role has access to a collection.
   * @param {object} collection
   * @param {string} role
   * @returns {boolean}
   */
  hasAccess(collection, role) {
    const roles = collection.access_roles || ['*'];
    return roles.includes('*') || roles.includes(role);
  }
}

module.exports = { CollectionManager, validateMetadata };
