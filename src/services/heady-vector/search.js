'use strict';

/**
 * HeadyVector Hybrid Search Engine
 * - Semantic search via pgvector HNSW/IVFFlat cosine similarity
 * - BM25 full-text search via PostgreSQL tsvector/tsquery
 * - Hybrid RRF (Reciprocal Rank Fusion) combining both
 * - MMR (Maximum Marginal Relevance) for diversity
 * - Pre-filtering (metadata JSONB) + post-filtering + re-ranking
 * - Pagination support
 */

const config = require('./config');
const { SIMILARITY_OPS } = require('./indexes');

// ─── Helper: build metadata filter WHERE clause ───────────────────────────────

/**
 * Build SQL WHERE conditions and params array from a metadata filter object.
 * Supports:
 *   { key: value }                — exact match via @>
 *   { key: { $gt, $gte, $lt, $lte, $ne, $in, $nin } }  — operators
 *   { $and: [...] }
 *   { $or: [...] }
 *
 * @param {object} filter
 * @param {Array} params - existing params array (mutated)
 * @param {string} [alias='v'] - table alias
 * @returns {string} SQL fragment (no WHERE keyword)
 */
function buildMetadataFilter(filter, params, alias = 'v') {
  if (!filter || Object.keys(filter).length === 0) return '1=1';

  function processNode(node) {
    const conditions = [];

    for (const [key, value] of Object.entries(node)) {
      if (key === '$and') {
        conditions.push(`(${value.map(processNode).join(' AND ')})`);
      } else if (key === '$or') {
        conditions.push(`(${value.map(processNode).join(' OR ')})`);
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Operator conditions
        for (const [op, opVal] of Object.entries(value)) {
          params.push(opVal);
          const idx = params.length;
          const jsonPath = `${alias}.metadata->>'${key}'`;
          switch (op) {
            case '$gt':
              conditions.push(`(${jsonPath})::numeric > $${idx}`);
              break;
            case '$gte':
              conditions.push(`(${jsonPath})::numeric >= $${idx}`);
              break;
            case '$lt':
              conditions.push(`(${jsonPath})::numeric < $${idx}`);
              break;
            case '$lte':
              conditions.push(`(${jsonPath})::numeric <= $${idx}`);
              break;
            case '$ne':
              conditions.push(`${alias}.metadata->>'${key}' != $${idx}`);
              break;
            case '$in':
              // opVal is array
              params.pop();
              conditions.push(
                `${alias}.metadata->>'${key}' = ANY($${params.push(opVal)}::text[])`
              );
              break;
            case '$nin':
              params.pop();
              conditions.push(
                `NOT (${alias}.metadata->>'${key}' = ANY($${params.push(opVal)}::text[]))`
              );
              break;
            default:
              // Unknown operator, skip
              params.pop();
          }
        }
      } else {
        // Exact match via @> containment
        params.push(JSON.stringify({ [key]: value }));
        conditions.push(`${alias}.metadata @> $${params.length}::jsonb`);
      }
    }

    return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
  }

  return processNode(filter);
}

// ─── SearchEngine class ───────────────────────────────────────────────────────

class SearchEngine {
  /**
   * @param {import('pg').Pool} pool
   * @param {import('./indexes').IndexManager} indexManager
   * @param {import('./collections').CollectionManager} collectionManager
   */
  constructor(pool, indexManager, collectionManager) {
    this.pool = pool;
    this.indexManager = indexManager;
    this.collectionManager = collectionManager;
  }

  /**
   * Record query latency to metrics table (fire-and-forget).
   */
  _recordMetric(collectionId, queryType, latencyMs, resultsCount, error = null) {
    this.pool.query(
      `INSERT INTO heady_query_metrics (collection_id, query_type, latency_ms, results_count, error)
       VALUES ($1, $2, $3, $4, $5)`,
      [collectionId, queryType, latencyMs, resultsCount, error]
    ).catch(() => {}); // Non-critical
  }

  /**
   * Format a raw JS array as pgvector literal.
   * @param {Float32Array|number[]|Float64Array} arr
   * @returns {string}
   */
  _toVecLiteral(arr) {
    return `[${Array.from(arr).join(',')}]`;
  }

  /**
   * Semantic vector search using pgvector HNSW index.
   *
   * @param {object} opts
   * @param {string} opts.collection - collection name
   * @param {Float32Array|number[]} opts.vector - query embedding
   * @param {number} [opts.topK=10]
   * @param {string} [opts.namespace]
   * @param {object} [opts.filter] - metadata pre-filter
   * @param {boolean} [opts.includeVector=false]
   * @param {number} [opts.efSearch] - override HNSW ef_search for this query
   * @param {number} [opts.offset=0]
   * @returns {Promise<{results: object[], latencyMs: number, total: number}>}
   */
  async semantic(opts) {
    const {
      collection: collectionName,
      vector,
      topK = config.search.defaultTopK,
      namespace,
      filter = {},
      includeVector = false,
      efSearch,
      offset = 0,
    } = opts;

    const start = Date.now();
    const collection = await this.collectionManager.require(collectionName);
    const simOp = this.indexManager.getSimilarityOp(collection.distance_metric);
    const embeddingCol = collection.dimension === 768 ? 'embedding_768' : 'embedding';

    const params = [];
    params.push(collection.id);                        // $1
    params.push(this._toVecLiteral(vector));           // $2
    params.push(Math.min(topK, config.search.maxTopK)); // $3
    params.push(offset);                               // $4

    let nsClause = '';
    if (namespace) {
      params.push(namespace);
      nsClause = `AND v.namespace = $${params.length}`;
    }

    const filterSql = buildMetadataFilter(filter, params);

    const vectorSelect = includeVector
      ? `, v.${embeddingCol}::text AS vector`
      : '';

    const client = await this.pool.connect();
    try {
      // Set HNSW ef_search if specified
      const ef = efSearch || collection.hnsw_ef_search;
      if (collection.index_type === 'hnsw') {
        await this.indexManager.setEfSearch(client, ef);
      } else if (collection.index_type === 'ivfflat') {
        await this.indexManager.setIvfProbes(client, config.ivfflat.probes);
      }

      const sql = `
        SELECT
          v.id,
          v.external_id,
          v.namespace,
          v.content,
          v.metadata,
          v.created_at,
          v.updated_at,
          1 - (v.${embeddingCol} ${simOp} $2::vector) AS similarity_score
          ${vectorSelect}
        FROM heady_vectors v
        WHERE v.collection_id = $1
          ${nsClause}
          AND v.${embeddingCol} IS NOT NULL
          AND ${filterSql}
        ORDER BY v.${embeddingCol} ${simOp} $2::vector
        LIMIT $3
        OFFSET $4
      `;

      const result = await client.query(sql, params);
      const latencyMs = Date.now() - start;

      this._recordMetric(collection.id, 'semantic', latencyMs, result.rows.length);

      return {
        results: result.rows,
        latencyMs,
        total: result.rows.length,
        queryType: 'semantic',
      };
    } catch (err) {
      this._recordMetric(collection.id, 'semantic', Date.now() - start, 0, err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * BM25 full-text search using PostgreSQL tsvector/tsquery.
   *
   * @param {object} opts
   * @param {string} opts.collection - collection name
   * @param {string} opts.query - text query
   * @param {number} [opts.topK=10]
   * @param {string} [opts.namespace]
   * @param {object} [opts.filter] - metadata pre-filter
   * @param {boolean} [opts.useRankCd=false] - use ts_rank_cd (cover density) instead of ts_rank
   * @param {number} [opts.offset=0]
   * @returns {Promise<{results: object[], latencyMs: number, total: number}>}
   */
  async bm25(opts) {
    const {
      collection: collectionName,
      query,
      topK = config.search.defaultTopK,
      namespace,
      filter = {},
      useRankCd = false,
      offset = 0,
    } = opts;

    if (!query || query.trim().length === 0) {
      throw new Error('BM25 search requires a non-empty query string');
    }

    const start = Date.now();
    const collection = await this.collectionManager.require(collectionName);

    const params = [];
    params.push(collection.id);                           // $1
    params.push(query);                                   // $2
    params.push(Math.min(topK, config.search.maxTopK));   // $3
    params.push(offset);                                  // $4

    let nsClause = '';
    if (namespace) {
      params.push(namespace);
      nsClause = `AND v.namespace = $${params.length}`;
    }

    const filterSql = buildMetadataFilter(filter, params);
    const rankFn = useRankCd ? 'ts_rank_cd' : 'ts_rank';

    const sql = `
      SELECT
        v.id,
        v.external_id,
        v.namespace,
        v.content,
        v.metadata,
        v.created_at,
        v.updated_at,
        ${rankFn}(v.content_tsv, plainto_tsquery('english', $2)) AS bm25_score
      FROM heady_vectors v
      WHERE v.collection_id = $1
        ${nsClause}
        AND v.content_tsv @@ plainto_tsquery('english', $2)
        AND ${filterSql}
      ORDER BY ${rankFn}(v.content_tsv, plainto_tsquery('english', $2)) DESC
      LIMIT $3
      OFFSET $4
    `;

    try {
      const result = await this.pool.query(sql, params);
      const latencyMs = Date.now() - start;
      this._recordMetric(collection.id, 'bm25', latencyMs, result.rows.length);
      return {
        results: result.rows,
        latencyMs,
        total: result.rows.length,
        queryType: 'bm25',
      };
    } catch (err) {
      this._recordMetric(collection.id, 'bm25', Date.now() - start, 0, err.message);
      throw err;
    }
  }

  /**
   * Hybrid search: RRF fusion of semantic + BM25 results.
   *
   * alpha = 1.0 → pure semantic
   * alpha = 0.0 → pure BM25
   * alpha = 0.7 → 70% semantic, 30% BM25 (default)
   *
   * RRF score = Σ 1/(k + rank_i), where k is a constant (default 60)
   *
   * @param {object} opts
   * @param {string} opts.collection
   * @param {Float32Array|number[]} [opts.vector] - required if alpha > 0
   * @param {string} [opts.query] - required if alpha < 1
   * @param {number} [opts.alpha=0.7] - weight for semantic (0-1)
   * @param {number} [opts.topK=10]
   * @param {string} [opts.namespace]
   * @param {object} [opts.filter]
   * @param {boolean} [opts.includeVector=false]
   * @param {number} [opts.rrfK=60] - RRF constant
   * @param {number} [opts.candidateMultiplier=3] - fetch topK*multiplier candidates
   * @param {number} [opts.offset=0]
   * @returns {Promise<{results: object[], latencyMs: number}>}
   */
  async hybrid(opts) {
    const {
      collection: collectionName,
      vector,
      query,
      alpha = config.search.defaultAlpha,
      topK = config.search.defaultTopK,
      namespace,
      filter = {},
      includeVector = false,
      rrfK = config.search.rrfK,
      candidateMultiplier = 3,
      offset = 0,
    } = opts;

    if (alpha > 0 && !vector) {
      throw new Error('Hybrid search with alpha > 0 requires a vector');
    }
    if (alpha < 1 && (!query || query.trim().length === 0)) {
      throw new Error('Hybrid search with alpha < 1 requires a query string');
    }

    const start = Date.now();
    const collection = await this.collectionManager.require(collectionName);
    const candidateK = Math.min(topK * candidateMultiplier, config.search.maxTopK);

    // Pure modes — delegate directly
    if (alpha >= 1.0) {
      return this.semantic({ ...opts, topK: candidateK });
    }
    if (alpha <= 0.0) {
      return this.bm25({ ...opts, topK: candidateK });
    }

    // Fetch candidates from both engines in parallel
    const [semResults, bm25Results] = await Promise.all([
      this.semantic({ collection: collectionName, vector, topK: candidateK, namespace, filter, includeVector }),
      this.bm25({ collection: collectionName, query, topK: candidateK, namespace, filter }),
    ]);

    // Build rank maps: id -> 1-based rank
    const semRank = new Map(semResults.results.map((r, i) => [r.id, i + 1]));
    const bm25Rank = new Map(bm25Results.results.map((r, i) => [r.id, i + 1]));

    // Union of all candidate IDs
    const allIds = new Set([
      ...semResults.results.map((r) => r.id),
      ...bm25Results.results.map((r) => r.id),
    ]);

    // Build a lookup map for result data
    const dataMap = new Map();
    for (const r of [...semResults.results, ...bm25Results.results]) {
      if (!dataMap.has(r.id)) dataMap.set(r.id, r);
    }

    // Compute RRF scores
    const scored = [];
    for (const id of allIds) {
      const semScore = semRank.has(id) ? alpha / (rrfK + semRank.get(id)) : 0;
      const bm25Score = bm25Rank.has(id) ? (1 - alpha) / (rrfK + bm25Rank.get(id)) : 0;
      const rrfScore = semScore + bm25Score;

      scored.push({
        ...dataMap.get(id),
        rrf_score: rrfScore,
        semantic_score: semRank.has(id) ? semResults.results[semRank.get(id) - 1].similarity_score : null,
        bm25_score: bm25Rank.has(id) ? bm25Results.results[bm25Rank.get(id) - 1].bm25_score : null,
      });
    }

    // Sort by RRF score descending, then paginate
    scored.sort((a, b) => b.rrf_score - a.rrf_score);
    const paginated = scored.slice(offset, offset + topK);

    const latencyMs = Date.now() - start;
    this._recordMetric(collection.id, 'hybrid', latencyMs, paginated.length);

    return {
      results: paginated,
      latencyMs,
      total: scored.length,
      queryType: 'hybrid',
      alpha,
    };
  }

  /**
   * MMR (Maximum Marginal Relevance) search for diverse results.
   *
   * Algorithm:
   * 1. Fetch topK * candidateMultiplier semantic candidates
   * 2. Greedily select next result that maximizes: λ*relevance - (1-λ)*max_sim_to_selected
   *
   * @param {object} opts
   * @param {string} opts.collection
   * @param {Float32Array|number[]} opts.vector - query embedding
   * @param {number} [opts.topK=10]
   * @param {number} [opts.lambda=0.5] - 1=pure relevance, 0=pure diversity
   * @param {string} [opts.namespace]
   * @param {object} [opts.filter]
   * @param {number} [opts.candidateMultiplier=5]
   * @returns {Promise<{results: object[], latencyMs: number}>}
   */
  async mmr(opts) {
    const {
      collection: collectionName,
      vector,
      topK = config.search.defaultTopK,
      lambda = config.search.mmrLambda,
      namespace,
      filter = {},
      candidateMultiplier = 5,
    } = opts;

    if (!vector) throw new Error('MMR search requires a vector');

    const start = Date.now();
    const collection = await this.collectionManager.require(collectionName);
    const candidateK = Math.min(topK * candidateMultiplier, config.search.maxTopK);

    // Fetch candidates with embeddings
    const { results: candidates } = await this.semantic({
      collection: collectionName,
      vector,
      topK: candidateK,
      namespace,
      filter,
      includeVector: true,
    });

    if (candidates.length === 0) {
      return { results: [], latencyMs: Date.now() - start, queryType: 'mmr' };
    }

    // Parse stored vector strings back to arrays
    const parseVec = (vecStr) => {
      if (!vecStr) return null;
      const inner = vecStr.replace(/^\[|\]$/g, '');
      return inner.split(',').map(Number);
    };

    const queryVec = Array.from(vector);
    const candidateVecs = candidates.map((c) => parseVec(c.vector));

    // Cosine similarity between two arrays
    const cosineSim = (a, b) => {
      if (!a || !b || a.length !== b.length) return 0;
      let dot = 0, normA = 0, normB = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      const denom = Math.sqrt(normA) * Math.sqrt(normB);
      return denom === 0 ? 0 : dot / denom;
    };

    const selected = [];
    const selectedVecs = [];
    const remaining = new Set(candidates.map((_, i) => i));

    while (selected.length < topK && remaining.size > 0) {
      let bestIdx = -1;
      let bestScore = -Infinity;

      for (const i of remaining) {
        const relevance = cosineSim(queryVec, candidateVecs[i]);
        const maxSimToSelected = selectedVecs.length === 0
          ? 0
          : Math.max(...selectedVecs.map((sv) => cosineSim(candidateVecs[i], sv)));

        const mmrScore = lambda * relevance - (1 - lambda) * maxSimToSelected;
        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIdx = i;
        }
      }

      if (bestIdx === -1) break;

      const chosen = { ...candidates[bestIdx], mmr_score: bestScore };
      delete chosen.vector; // Remove raw vector from output
      selected.push(chosen);
      selectedVecs.push(candidateVecs[bestIdx]);
      remaining.delete(bestIdx);
    }

    const latencyMs = Date.now() - start;
    this._recordMetric(collection.id, 'mmr', latencyMs, selected.length);

    return {
      results: selected,
      latencyMs,
      total: selected.length,
      queryType: 'mmr',
      lambda,
    };
  }

  /**
   * Re-rank results using a cross-encoder-like score.
   * Simple implementation: multiply similarity_score by a boost factor from metadata.
   *
   * @param {object[]} results
   * @param {object} [opts]
   * @param {string} [opts.boostField] - metadata field to use as boost multiplier
   * @returns {object[]}
   */
  rerank(results, opts = {}) {
    const { boostField } = opts;
    if (!boostField) return results;

    return results
      .map((r) => {
        const boost = parseFloat(r.metadata?.[boostField]) || 1.0;
        return {
          ...r,
          reranked_score: (r.similarity_score || r.rrf_score || r.bm25_score || 0) * boost,
        };
      })
      .sort((a, b) => b.reranked_score - a.reranked_score);
  }

  /**
   * Post-filter results by a predicate function.
   * @param {object[]} results
   * @param {Function} predicate - (result) => boolean
   * @returns {object[]}
   */
  postFilter(results, predicate) {
    return results.filter(predicate);
  }
}

module.exports = { SearchEngine, buildMetadataFilter };
