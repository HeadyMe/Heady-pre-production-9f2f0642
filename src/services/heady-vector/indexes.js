'use strict';

/**
 * HeadyVector Index Management
 * Handles HNSW and IVFFlat index lifecycle for pgvector.
 * Index names are deterministic: heady_hnsw_{collectionId_short}_{dim}
 */

const config = require('./config');

// ─── Distance operator map ────────────────────────────────────────────────────
const DISTANCE_OPS = {
  cosine: 'vector_cosine_ops',
  l2:     'vector_l2_ops',
  ip:     'vector_ip_ops',    // inner product
};

// Query operators for similarity
const SIMILARITY_OPS = {
  cosine: '<=>',
  l2:     '<->',
  ip:     '<#>',
};

// ─── IndexManager class ───────────────────────────────────────────────────────

class IndexManager {
  /**
   * @param {import('pg').Pool} pool
   */
  constructor(pool) {
    this.pool = pool;
    this._indexCache = new Map(); // collectionId -> index info
  }

  /**
   * Sanitize collection ID to a safe SQL identifier fragment.
   * @param {string} collectionId - UUID
   * @returns {string} 8-char hex prefix
   */
  _shortId(collectionId) {
    return collectionId.replace(/-/g, '').slice(0, 8);
  }

  /**
   * Build deterministic index name.
   * @param {string} collectionId
   * @param {'hnsw'|'ivfflat'} type
   * @param {number} dim
   * @returns {string}
   */
  _indexName(collectionId, type, dim) {
    return `heady_${type}_${this._shortId(collectionId)}_${dim}`;
  }

  /**
   * Get the embedding column name for a dimension.
   * @param {number} dim
   * @returns {string}
   */
  _embeddingColumn(dim) {
    return dim === 768 ? 'embedding_768' : 'embedding';
  }

  /**
   * Get the distance operator for a metric.
   * @param {string} metric
   * @returns {string}
   */
  getSimilarityOp(metric) {
    return SIMILARITY_OPS[metric] || SIMILARITY_OPS.cosine;
  }

  /**
   * Create an HNSW index for a collection.
   * @param {object} collection
   * @returns {Promise<void>}
   */
  async createHNSWIndex(collection) {
    const { id, dimension, hnsw_m, hnsw_ef_construction, distance_metric } = collection;
    const col = this._embeddingColumn(dimension);
    const ops = DISTANCE_OPS[distance_metric] || DISTANCE_OPS.cosine;
    const indexName = this._indexName(id, 'hnsw', dimension);

    const sql = `
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "${indexName}"
      ON heady_vectors
      USING hnsw (${col} ${ops})
      WITH (m = ${hnsw_m}, ef_construction = ${hnsw_ef_construction})
      WHERE collection_id = '${id}'
    `;

    try {
      await this.pool.query(sql);
      this._indexCache.delete(id);
      console.log(`[indexes] Created HNSW index "${indexName}" for collection ${id} (m=${hnsw_m}, ef_construction=${hnsw_ef_construction})`);
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`[indexes] HNSW index "${indexName}" already exists, skipping`);
        return;
      }
      throw err;
    }
  }

  /**
   * Create an IVFFlat index for a collection.
   * @param {object} collection
   * @param {number} [lists] - number of cluster centroids
   * @returns {Promise<void>}
   */
  async createIVFFlatIndex(collection, lists) {
    const { id, dimension, distance_metric } = collection;
    const nLists = lists || config.ivfflat.lists;
    const col = this._embeddingColumn(dimension);
    const ops = DISTANCE_OPS[distance_metric] || DISTANCE_OPS.cosine;
    const indexName = this._indexName(id, 'ivfflat', dimension);

    const sql = `
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "${indexName}"
      ON heady_vectors
      USING ivfflat (${col} ${ops})
      WITH (lists = ${nLists})
      WHERE collection_id = '${id}'
    `;

    try {
      await this.pool.query(sql);
      this._indexCache.delete(id);
      console.log(`[indexes] Created IVFFlat index "${indexName}" for collection ${id} (lists=${nLists})`);
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`[indexes] IVFFlat index "${indexName}" already exists, skipping`);
        return;
      }
      throw err;
    }
  }

  /**
   * Create appropriate index for a collection based on index_type.
   * @param {object} collection
   * @returns {Promise<void>}
   */
  async createCollectionIndex(collection) {
    if (collection.index_type === 'hnsw') {
      return this.createHNSWIndex(collection);
    } else if (collection.index_type === 'ivfflat') {
      return this.createIVFFlatIndex(collection);
    }
    // 'none' — no index
  }

  /**
   * Drop all pgvector indexes for a collection.
   * @param {string} collectionId
   * @returns {Promise<void>}
   */
  async dropCollectionIndexes(collectionId) {
    const shortId = this._shortId(collectionId);

    // Find all matching indexes
    const result = await this.pool.query(
      `SELECT indexname
       FROM pg_indexes
       WHERE tablename = 'heady_vectors'
         AND indexname LIKE $1`,
      [`heady_%_${shortId}_%`]
    );

    for (const row of result.rows) {
      await this.pool.query(`DROP INDEX CONCURRENTLY IF EXISTS "${row.indexname}"`);
      console.log(`[indexes] Dropped index "${row.indexname}"`);
    }

    this._indexCache.delete(collectionId);
  }

  /**
   * Rebuild index for a collection (drop + recreate).
   * @param {object} collection
   * @returns {Promise<void>}
   */
  async rebuildIndex(collection) {
    await this.dropCollectionIndexes(collection.id);
    await this.createCollectionIndex(collection);
  }

  /**
   * Set ef_search for HNSW queries on this session.
   * @param {import('pg').PoolClient} client
   * @param {number} efSearch
   */
  async setEfSearch(client, efSearch) {
    await client.query(`SET hnsw.ef_search = ${parseInt(efSearch, 10)}`);
  }

  /**
   * Set ivfflat probes for queries on this session.
   * @param {import('pg').PoolClient} client
   * @param {number} probes
   */
  async setIvfProbes(client, probes) {
    await client.query(`SET ivfflat.probes = ${parseInt(probes, 10)}`);
  }

  /**
   * Get index information for a collection from pg_indexes / pg_stat_user_indexes.
   * @param {string} collectionId
   * @returns {Promise<Array<object>>}
   */
  async getCollectionIndexInfo(collectionId) {
    if (this._indexCache.has(collectionId)) {
      return this._indexCache.get(collectionId);
    }

    const shortId = this._shortId(collectionId);

    const result = await this.pool.query(
      `SELECT
         i.indexname,
         i.indexdef,
         s.idx_scan,
         s.idx_tup_read,
         s.idx_tup_fetch,
         pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size
       FROM pg_indexes i
       LEFT JOIN pg_stat_user_indexes s
         ON s.indexrelname = i.indexname AND s.relname = 'heady_vectors'
       WHERE i.tablename = 'heady_vectors'
         AND i.indexname LIKE $1`,
      [`heady_%_${shortId}_%`]
    );

    const info = result.rows;
    this._indexCache.set(collectionId, info);
    return info;
  }

  /**
   * Automatic index selection: HNSW for < 100k rows, IVFFlat for >= 100k.
   * @param {object} collection
   * @returns {Promise<'hnsw'|'ivfflat'|'none'>}
   */
  async recommendIndexType(collection) {
    const result = await this.pool.query(
      'SELECT COUNT(*) AS cnt FROM heady_vectors WHERE collection_id = $1',
      [collection.id]
    );
    const count = parseInt(result.rows[0].cnt, 10);

    if (count < 1000) return 'none';   // too small, sequential scan is faster
    if (count < 100000) return 'hnsw';
    return 'ivfflat';
  }

  /**
   * Run VACUUM ANALYZE on heady_vectors to update planner statistics.
   * @returns {Promise<void>}
   */
  async optimize() {
    // VACUUM cannot run in a transaction; use a direct client
    const client = await this.pool.connect();
    try {
      await client.query('VACUUM ANALYZE heady_vectors');
      await client.query('VACUUM ANALYZE heady_graph_nodes');
      console.log('[indexes] VACUUM ANALYZE complete');
    } finally {
      client.release();
    }
  }

  /**
   * Get overall index health summary.
   * @returns {Promise<object>}
   */
  async getHealthSummary() {
    const result = await this.pool.query(`
      SELECT
        i.indexname,
        i.indexdef,
        s.idx_scan AS scans,
        pg_size_pretty(pg_relation_size(s.indexrelid)) AS size
      FROM pg_indexes i
      LEFT JOIN pg_stat_user_indexes s
        ON s.indexrelname = i.indexname
      WHERE i.tablename IN ('heady_vectors', 'heady_graph_nodes')
        AND i.indexname LIKE 'heady_%'
      ORDER BY i.indexname
    `);

    return {
      indexes: result.rows,
      count: result.rows.length,
    };
  }
}

module.exports = { IndexManager, DISTANCE_OPS, SIMILARITY_OPS };
