'use strict';

/**
 * HeadyCache PostgreSQL Store
 *
 * Uses pgvector extension for native similarity search.
 * Schema:
 *   CREATE EXTENSION IF NOT EXISTS vector;
 *   CREATE TABLE IF NOT EXISTS heady_cache (
 *     key         TEXT PRIMARY KEY,
 *     namespace   TEXT NOT NULL DEFAULT 'default',
 *     value       JSONB NOT NULL,
 *     vector      vector(384),
 *     byte_size   INTEGER,
 *     ttl         BIGINT,
 *     expires_at  BIGINT,
 *     created_at  BIGINT NOT NULL,
 *     updated_at  BIGINT NOT NULL,
 *     last_accessed BIGINT NOT NULL,
 *     access_count  INTEGER NOT NULL DEFAULT 0
 *   );
 *   CREATE INDEX IF NOT EXISTS heady_cache_ns_idx ON heady_cache(namespace);
 *   CREATE INDEX IF NOT EXISTS heady_cache_exp_idx ON heady_cache(expires_at);
 *   CREATE INDEX IF NOT EXISTS heady_cache_vec_idx
 *     ON heady_cache USING ivfflat (vector vector_cosine_ops) WITH (lists = 100);
 */

const config = require('../config');

// Lazy-require pg to avoid crashing if not installed
let pg;
function getPool() {
  if (!pg) pg = require('pg');
  return pg;
}

class PgStore {
  /**
   * @param {object} opts
   * @param {string} [opts.connectionString]
   * @param {number} [opts.ttl]
   * @param {boolean} [opts.slidingWindow]
   * @param {number} [opts.embeddingDims]
   */
  constructor(opts = {}) {
    this._connStr = opts.connectionString || config.pgConnectionString;
    this._defaultTtl = opts.ttl !== undefined ? opts.ttl : config.ttl;
    this._sliding = opts.slidingWindow !== false;
    this._dims = opts.embeddingDims || config.embeddingDims;
    this._pool = null;
    this._ready = false;
    this._initPromise = null;
  }

  async init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._setup();
    await this._initPromise;
    this._ready = true;
  }

  // -------------------------------------------------------------------------
  // Core interface
  // -------------------------------------------------------------------------

  async get(key) {
    await this._ensureReady();
    const now = Date.now();
    const { rows } = await this._pool.query(
      `SELECT key, value, vector::text, byte_size, ttl, expires_at, created_at,
              updated_at, last_accessed, access_count, namespace
       FROM heady_cache
       WHERE key = $1`,
      [key]
    );
    if (rows.length === 0) return null;
    const row = rows[0];

    // Check expiry
    if (row.expires_at && row.expires_at > 0 && now > row.expires_at) {
      await this.delete(key);
      return null;
    }

    const newTtl = this._sliding && row.ttl > 0 ? row.ttl : null;
    const newExpiry = newTtl ? now + newTtl : row.expires_at;

    await this._pool.query(
      `UPDATE heady_cache
       SET last_accessed = $1, access_count = access_count + 1
           ${this._sliding && newTtl ? ', expires_at = $3' : ''}
       WHERE key = $2`,
      this._sliding && newTtl ? [now, key, newExpiry] : [now, key]
    );

    return {
      value: row.value,
      meta: this._rowToMeta(row, newExpiry),
    };
  }

  async set(key, value, meta = {}) {
    await this._ensureReady();
    const now = Date.now();
    const ttl = meta.ttl !== undefined ? meta.ttl : this._defaultTtl;
    const expiresAt = ttl > 0 ? now + ttl : 0;
    const vectorStr = meta.vector ? `[${meta.vector.join(',')}]` : null;
    const byteSize = meta.byteSize || this._estimateSize(value);
    const ns = meta.namespace || 'default';

    await this._pool.query(
      `INSERT INTO heady_cache
         (key, namespace, value, vector, byte_size, ttl, expires_at,
          created_at, updated_at, last_accessed, access_count)
       VALUES ($1,$2,$3,$4::vector,$5,$6,$7,$8,$9,$10,0)
       ON CONFLICT (key) DO UPDATE SET
         namespace    = EXCLUDED.namespace,
         value        = EXCLUDED.value,
         vector       = EXCLUDED.vector,
         byte_size    = EXCLUDED.byte_size,
         ttl          = EXCLUDED.ttl,
         expires_at   = EXCLUDED.expires_at,
         updated_at   = EXCLUDED.updated_at`,
      [key, ns, JSON.stringify(value), vectorStr, byteSize, ttl,
       expiresAt, now, now, now]
    );
  }

  async delete(key) {
    await this._ensureReady();
    const { rowCount } = await this._pool.query(
      'DELETE FROM heady_cache WHERE key = $1',
      [key]
    );
    return rowCount > 0;
  }

  async has(key) {
    await this._ensureReady();
    const now = Date.now();
    const { rows } = await this._pool.query(
      `SELECT expires_at FROM heady_cache WHERE key = $1`,
      [key]
    );
    if (rows.length === 0) return false;
    if (rows[0].expires_at > 0 && now > rows[0].expires_at) {
      await this.delete(key);
      return false;
    }
    return true;
  }

  async clear(namespace) {
    await this._ensureReady();
    if (!namespace) {
      await this._pool.query('TRUNCATE heady_cache');
    } else {
      await this._pool.query('DELETE FROM heady_cache WHERE namespace = $1', [namespace]);
    }
  }

  async size(namespace) {
    await this._ensureReady();
    const now = Date.now();
    const { rows } = await this._pool.query(
      namespace
        ? `SELECT COUNT(*) FROM heady_cache WHERE namespace=$1 AND (expires_at=0 OR expires_at>$2)`
        : `SELECT COUNT(*) FROM heady_cache WHERE (expires_at=0 OR expires_at>$1)`,
      namespace ? [namespace, now] : [now]
    );
    return parseInt(rows[0].count, 10);
  }

  async keys(namespace) {
    await this._ensureReady();
    const now = Date.now();
    const { rows } = await this._pool.query(
      namespace
        ? `SELECT key FROM heady_cache WHERE namespace=$1 AND (expires_at=0 OR expires_at>$2)`
        : `SELECT key FROM heady_cache WHERE (expires_at=0 OR expires_at>$1)`,
      namespace ? [namespace, now] : [now]
    );
    return rows.map((r) => r.key);
  }

  async entries(namespace) {
    await this._ensureReady();
    const now = Date.now();
    const { rows } = await this._pool.query(
      namespace
        ? `SELECT key, value, byte_size, ttl, expires_at, created_at, updated_at,
                  last_accessed, access_count, namespace
           FROM heady_cache WHERE namespace=$1 AND (expires_at=0 OR expires_at>$2)`
        : `SELECT key, value, byte_size, ttl, expires_at, created_at, updated_at,
                  last_accessed, access_count, namespace
           FROM heady_cache WHERE (expires_at=0 OR expires_at>$1)`,
      namespace ? [namespace, now] : [now]
    );
    return rows.map((r) => [r.key, { value: r.value, meta: this._rowToMeta(r) }]);
  }

  async getMeta(key) {
    await this._ensureReady();
    const { rows } = await this._pool.query(
      `SELECT byte_size, ttl, expires_at, created_at, updated_at,
              last_accessed, access_count, namespace
       FROM heady_cache WHERE key = $1`,
      [key]
    );
    if (rows.length === 0) return null;
    return this._rowToMeta(rows[0]);
  }

  async byteSize() {
    await this._ensureReady();
    const { rows } = await this._pool.query(
      'SELECT COALESCE(SUM(byte_size), 0) AS total FROM heady_cache'
    );
    return parseInt(rows[0].total, 10);
  }

  /**
   * pgvector-powered similarity search.
   * Returns [{ key, similarity }] ordered by similarity desc.
   */
  async similaritySearch(vector, ns, limit = 5) {
    await this._ensureReady();
    const vectorStr = `[${vector.join(',')}]`;
    const now = Date.now();
    const { rows } = await this._pool.query(
      `SELECT key, 1 - (vector <=> $1::vector) AS similarity
       FROM heady_cache
       WHERE vector IS NOT NULL
         AND namespace = $2
         AND (expires_at = 0 OR expires_at > $3)
       ORDER BY vector <=> $1::vector
       LIMIT $4`,
      [vectorStr, ns, now, limit]
    );
    return rows.map((r) => ({ key: r.key, similarity: parseFloat(r.similarity) }));
  }

  /**
   * Evict N least recently used rows.
   */
  async evictLru(n = 1) {
    await this._ensureReady();
    const { rows } = await this._pool.query(
      `DELETE FROM heady_cache
       WHERE key IN (
         SELECT key FROM heady_cache ORDER BY last_accessed ASC LIMIT $1
       ) RETURNING key`,
      [n]
    );
    return rows.map((r) => r.key);
  }

  /**
   * Evict N least frequently used rows.
   */
  async evictLfu(n = 1) {
    await this._ensureReady();
    const { rows } = await this._pool.query(
      `DELETE FROM heady_cache
       WHERE key IN (
         SELECT key FROM heady_cache ORDER BY access_count ASC LIMIT $1
       ) RETURNING key`,
      [n]
    );
    return rows.map((r) => r.key);
  }

  /**
   * Evict all expired rows.
   */
  async evictExpired() {
    await this._ensureReady();
    const { rows } = await this._pool.query(
      `DELETE FROM heady_cache WHERE expires_at > 0 AND expires_at < $1 RETURNING key`,
      [Date.now()]
    );
    return rows.map((r) => r.key);
  }

  async close() {
    if (this._pool) await this._pool.end();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  async _setup() {
    const { Pool } = getPool();
    this._pool = new Pool({ connectionString: this._connStr });

    await this._pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await this._pool.query(`
      CREATE TABLE IF NOT EXISTS heady_cache (
        key           TEXT PRIMARY KEY,
        namespace     TEXT NOT NULL DEFAULT 'default',
        value         JSONB NOT NULL,
        vector        vector(${this._dims}),
        byte_size     INTEGER,
        ttl           BIGINT,
        expires_at    BIGINT NOT NULL DEFAULT 0,
        created_at    BIGINT NOT NULL,
        updated_at    BIGINT NOT NULL,
        last_accessed BIGINT NOT NULL,
        access_count  INTEGER NOT NULL DEFAULT 0
      )
    `);
    await this._pool.query(
      `CREATE INDEX IF NOT EXISTS heady_cache_ns_idx ON heady_cache(namespace)`
    );
    await this._pool.query(
      `CREATE INDEX IF NOT EXISTS heady_cache_exp_idx ON heady_cache(expires_at)`
    );
    // ivfflat index for ANN (only valid if there's data)
    try {
      await this._pool.query(`
        CREATE INDEX IF NOT EXISTS heady_cache_vec_idx
        ON heady_cache USING ivfflat (vector vector_cosine_ops) WITH (lists = 100)
      `);
    } catch {
      // pgvector might not be installed or no data yet — skip
    }
  }

  _rowToMeta(row, overrideExpiry) {
    return {
      namespace: row.namespace || 'default',
      byteSize: row.byte_size || 0,
      ttl: row.ttl ? parseInt(row.ttl, 10) : 0,
      expiresAt: overrideExpiry || (row.expires_at ? parseInt(row.expires_at, 10) : 0),
      createdAt: row.created_at ? parseInt(row.created_at, 10) : 0,
      updatedAt: row.updated_at ? parseInt(row.updated_at, 10) : 0,
      lastAccessed: row.last_accessed ? parseInt(row.last_accessed, 10) : 0,
      accessCount: row.access_count ? parseInt(row.access_count, 10) : 0,
    };
  }

  _estimateSize(value) {
    try {
      return Buffer.byteLength(JSON.stringify(value), 'utf8');
    } catch {
      return 256;
    }
  }

  async _ensureReady() {
    if (!this._ready) await this.init();
  }
}

module.exports = { PgStore };
