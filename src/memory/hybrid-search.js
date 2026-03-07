/**
 * @fileoverview Hybrid Search Engine for Heady Latent OS
 * @module hybrid-search
 *
 * Combines BM25 full-text search with dense vector similarity using
 * Reciprocal Rank Fusion (RRF) for score combination.
 *
 * Architecture (from research/section1_vector_db.md):
 *   - BM25 alone: nDCG@10 ≈ 43.4 (BEIR average)
 *   - Dense alone: nDCG@10 ≈ 51–55
 *   - Hybrid (BM25 + dense + RRF): +10–15% over individual methods
 *   - Three-way (BM25 + dense + SPLADE): best overall, especially adversarial
 *
 * Search pipeline:
 *   1. Parallel: BM25 (tsvector GIN) + Dense HNSW + optional SPLADE sparse
 *   2. RRF fusion (k=60, scale-invariant across score domains)
 *   3. Deduplication + optional re-ranking
 *
 * @example
 * import { HybridSearchEngine } from './hybrid-search.js';
 * const engine = new HybridSearchEngine(pgPool, embeddingRouter);
 * const results = await engine.search('quantum entanglement', {
 *   beeId: 'bee_001',
 *   limit: 10,
 *   // defaults now use phi-fusion weights: denseWeight≈0.618, bm25Weight≈0.382
 * });
 */

import { EventEmitter } from 'events';
import {
  PHI, PSI,
  phiFusionWeights,
  CSL_THRESHOLDS,
  cslGate,
  DEDUP_THRESHOLD,
  fib,
} from '../../shared/phi-math.js';

// RRF constant k=60 is the standard; k=0 gives pure rank-based scores
const RRF_K = 60;

/**
 * Phi-derived two-way fusion weights for dense + BM25 retrieval.
 * phiFusionWeights(2) → [0.618, 0.382]  (dense gets the golden-ratio share)
 * Replaces the old arbitrary [0.6, 0.4] split.
 */
const [PHI_DENSE_WEIGHT, PHI_BM25_WEIGHT] = phiFusionWeights(2);

/**
 * Phi-derived three-way fusion weights for dense + BM25 + SPLADE.
 * phiFusionWeights(3) → [0.528, 0.326, 0.146]
 * Replaces the old arbitrary [0.4, 0.35, 0.25] split.
 */
const [PHI_3W_DENSE, PHI_3W_BM25, PHI_3W_SPARSE] = phiFusionWeights(3);

/**
 * Nearest Fibonacci number to the old efSearch=100.
 * fib(11) = 89 — controls HNSW recall vs. speed at query time.
 */
const PHI_EF_SEARCH = fib(11);  // 89

/**
 * Phi-scaled binary oversampling factor for two-stage re-ranking.
 * fib(7) = 13 — replaces arbitrary 4× oversample.
 * Larger Fibonacci number → more candidates → better recall recovery.
 */
const PHI_BINARY_OVERSAMPLE = fib(7);  // 13

/**
 * Re-rank candidate pool size.
 * fib(8) = 21 — nearest Fibonacci to the old rerankTopK=20.
 */
const PHI_RERANK_TOP_K = fib(8);  // 21

/**
 * Slow-query alert threshold in milliseconds.
 * Math.round(1000 * PSI) ≈ 618ms — phi-derived boundary replacing 500ms.
 * PSI = 1/φ ≈ 0.618; 618ms is the golden-ratio fraction of 1 second.
 */
const PHI_SLOW_QUERY_THRESHOLD_MS = Math.round(1000 * PSI);  // ≈ 618ms

// Default search configuration
const DEFAULT_OPTIONS = {
  limit: 10,
  /** @see PHI_DENSE_WEIGHT — phiFusionWeights(2)[0] ≈ 0.618 */
  denseWeight: PHI_DENSE_WEIGHT,
  /** @see PHI_BM25_WEIGHT — phiFusionWeights(2)[1] ≈ 0.382 */
  bm25Weight: PHI_BM25_WEIGHT,
  sparseWeight: 0.0,            // SPLADE weight (0 = disabled; non-zero enables 3-way phi split)
  /** @see PHI_EF_SEARCH — fib(11) = 89, HNSW runtime beam width */
  efSearch: PHI_EF_SEARCH,
  useIterativeScan: true,       // pgvector 0.8.0 iterative scan for filtered queries
  useQuantized: true,           // Use halfvec index for speed (50% less memory)
  useBinaryPrefilter: false,    // Use binary quantization pre-filter
  /** @see PHI_BINARY_OVERSAMPLE — fib(7) = 13, phi-scaled oversample for accuracy */
  binaryOversample: PHI_BINARY_OVERSAMPLE,
  minBm25Score: 0.0,            // Minimum BM25 score threshold
  minDenseScore: 0.0,           // Minimum cosine similarity threshold
  memoryTypes: null,            // Filter by memory type(s)
  workspaceId: null,
  sessionId: null,
  tags: null,
  rerank: false,                // Enable ColBERT-style re-ranking (placeholder)
  /** @see PHI_RERANK_TOP_K — fib(8) = 21, nearest Fibonacci to old 20 */
  rerankTopK: PHI_RERANK_TOP_K,
};

/**
 * @class HybridSearchEngine
 * @extends EventEmitter
 *
 * Production hybrid search combining BM25 + dense vector + optional SPLADE.
 * Uses Reciprocal Rank Fusion (RRF) for score combination.
 *
 * Emits events:
 *   - 'search:start' (query, options)
 *   - 'search:bm25:complete' (results count, duration_ms)
 *   - 'search:dense:complete' (results count, duration_ms)
 *   - 'search:sparse:complete' (results count, duration_ms)
 *   - 'search:fused' (results count, duration_ms)
 *   - 'search:slow' (query, duration_ms) — emitted when total > slowThreshold
 */
export class HybridSearchEngine extends EventEmitter {
  /**
   * @param {import('pg').Pool} pool - PostgreSQL connection pool
   * @param {object} [embeddingRouter] - EmbeddingRouter instance for query embedding
   * @param {object} [options] - Engine-level configuration
   * @param {number} [options.slowQueryThresholdMs] - Emit 'search:slow' above this threshold (default: Math.round(1000*PSI) ≈ 618ms)
   * @param {boolean} [options.enableMetrics=true] - Track search metrics
   * @param {object} [options.logger=console] - Logger with info/warn/error methods
   */
  constructor(pool, embeddingRouter = null, options = {}) {
    super();
    this.pool = pool;
    this.embeddingRouter = embeddingRouter;
    /** Slow-query threshold: Math.round(1000 * PSI) ≈ 618ms (phi-derived, replaces 500ms) */
    this.slowQueryThresholdMs = options.slowQueryThresholdMs ?? PHI_SLOW_QUERY_THRESHOLD_MS;
    this.enableMetrics = options.enableMetrics ?? true;
    this.logger = options.logger ?? console;

    // Internal metrics store (ring buffer, last 1000 searches)
    this._metrics = {
      totalSearches: 0,
      totalDurationMs: 0,
      slowSearches: 0,
      bm25Only: 0,
      denseOnly: 0,
      hybrid: 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Execute hybrid search combining BM25 + dense vector retrieval.
   *
   * @param {string} query - Natural language search query
   * @param {object} [options] - Search options (merged with DEFAULT_OPTIONS)
   * @param {string} options.beeId - Required: filter to specific bee agent's memories
   * @param {number[]} [options.embedding] - Pre-computed query embedding (skips embedding call)
   * @param {number} [options.limit=10] - Maximum results to return
   * @param {number} [options.bm25Weight=0.4] - BM25 weight in [0,1]
   * @param {number} [options.denseWeight=0.6] - Dense weight in [0,1]
   * @param {number} [options.sparseWeight=0.0] - SPLADE weight (0 = disabled)
   * @param {string[]} [options.memoryTypes] - Filter: ['episodic','semantic',...]
   * @param {boolean} [options.useQuantized=true] - Use halfvec HNSW index
   * @returns {Promise<HybridSearchResult[]>} Ranked results with fused scores
   */
  async search(query, options = {}) {
    if (!options.beeId) {
      throw new Error('HybridSearchEngine.search: options.beeId is required');
    }

    const opts = { ...DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();

    this.emit('search:start', { query, options: opts });

    try {
      // Step 1: Get query embedding (if not pre-computed)
      const embedding = opts.embedding
        ?? await this._getQueryEmbedding(query, opts);

      // Step 2: Run BM25 and dense searches in parallel
      const [bm25Results, denseResults, sparseResults] = await Promise.all([
        opts.bm25Weight > 0
          ? this._searchBm25(query, opts)
          : Promise.resolve([]),
        opts.denseWeight > 0 && embedding
          ? this._searchDense(embedding, opts)
          : Promise.resolve([]),
        opts.sparseWeight > 0
          ? this._searchSparse(query, opts)
          : Promise.resolve([]),
      ]);

      // Step 3: Resolve phi-based fusion weights.
      // When SPLADE is enabled (sparseWeight > 0), apply the 3-way phi split
      // and CSL-gate each weight if a cosine confidence score is available.
      let bm25W   = opts.bm25Weight;
      let denseW  = opts.denseWeight;
      let sparseW = opts.sparseWeight;

      if (sparseW > 0) {
        // 3-way phi split: [0.528 dense, 0.326 bm25, 0.146 sparse]
        [denseW, bm25W, sparseW] = phiFusionWeights(3);
      }

      // CSL gate: if a query cosine confidence score is available, modulate
      // BM25 weight down when the dense embedding has strong alignment
      // (dense model already covers the semantic space well).
      if (opts.cslScore != null) {
        /**
         * cslGate smoothly reduces bm25W when cslScore >> CSL_THRESHOLDS.MEDIUM
         * (≈0.809), reflecting that a high-confidence dense match renders
         * keyword search less additive.
         */
        bm25W  = cslGate(bm25W,  opts.cslScore, CSL_THRESHOLDS.MEDIUM);
        denseW = cslGate(denseW, opts.cslScore, CSL_THRESHOLDS.LOW);
      }

      // Step 3: RRF fusion
      const fused = this._rrfFusion(
        { results: bm25Results,   weight: bm25W },
        { results: denseResults,  weight: denseW },
        { results: sparseResults, weight: sparseW },
        opts.limit,
      );

      const durationMs = Date.now() - startTime;
      this._recordMetrics(durationMs, opts);

      if (durationMs > this.slowQueryThresholdMs) {
        this.emit('search:slow', { query, durationMs });
        this.logger.warn(`[HybridSearch] Slow search: ${durationMs}ms for query="${query.slice(0, 80)}"`);
      }

      this.emit('search:fused', { count: fused.length, durationMs });

      return fused;
    } catch (error) {
      this.logger.error('[HybridSearch] Search error:', error.message);
      throw error;
    }
  }

  /**
   * BM25-only search using PostgreSQL full-text search.
   * Uses ts_rank_cd for BM25-like scoring with cover density.
   *
   * @param {string} query - Search query
   * @param {object} opts - Resolved options
   * @returns {Promise<RawSearchResult[]>}
   */
  async searchBm25Only(query, opts = {}) {
    const resolvedOpts = { ...DEFAULT_OPTIONS, ...opts };
    return this._searchBm25(query, resolvedOpts);
  }

  /**
   * Dense-only vector search.
   *
   * @param {number[]|Float32Array} embedding - Query embedding
   * @param {object} opts - Resolved options (requires beeId)
   * @returns {Promise<RawSearchResult[]>}
   */
  async searchDenseOnly(embedding, opts = {}) {
    const resolvedOpts = { ...DEFAULT_OPTIONS, ...opts };
    if (!resolvedOpts.beeId) throw new Error('beeId required');
    return this._searchDense(embedding, resolvedOpts);
  }

  /**
   * Get current engine metrics.
   *
   * @returns {object} Metrics snapshot
   */
  getMetrics() {
    return {
      ...this._metrics,
      avgDurationMs: this._metrics.totalSearches > 0
        ? Math.round(this._metrics.totalDurationMs / this._metrics.totalSearches)
        : 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Private: Search methods
  // ---------------------------------------------------------------------------

  /**
   * BM25 search using PostgreSQL tsvector + ts_rank_cd.
   * ts_rank_cd approximates BM25 cover density scoring.
   *
   * @private
   * @param {string} query
   * @param {object} opts
   * @returns {Promise<RawSearchResult[]>}
   */
  async _searchBm25(query, opts) {
    const t0 = Date.now();

    // Build tsquery — use plainto_tsquery for robustness (handles arbitrary text)
    // websearch_to_tsquery is more powerful but requires PostgreSQL 11+
    const sql = `
      SELECT
        id,
        content,
        memory_type,
        coherence_score,
        importance_score,
        created_at,
        ts_rank_cd(content_tsv, query, 32) AS bm25_score
      FROM
        vector_memories,
        websearch_to_tsquery('english', $1) AS query
      WHERE
        content_tsv @@ query
        AND bee_id = $2
        ${opts.memoryTypes?.length ? `AND memory_type = ANY($3)` : ''}
        ${opts.workspaceId ? `AND workspace_id = $4` : ''}
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY bm25_score DESC
      LIMIT $${this._paramIndex(opts, 2) + 1}
    `;

    const params = this._buildBm25Params(query, opts);

    try {
      const { rows } = await this.pool.query(sql, params);
      const durationMs = Date.now() - t0;
      this.emit('search:bm25:complete', { count: rows.length, durationMs });
      return rows.map(r => ({
        id: r.id,
        content: r.content,
        memory_type: r.memory_type,
        coherence_score: r.coherence_score,
        importance_score: r.importance_score,
        created_at: r.created_at,
        score: parseFloat(r.bm25_score),
        source: 'bm25',
      }));
    } catch (error) {
      // Degrade gracefully: return empty if BM25 fails
      this.logger.warn('[HybridSearch] BM25 search error (degrading):', error.message);
      return [];
    }
  }

  /**
   * Dense vector search using HNSW index.
   * Supports float32 (max recall), halfvec (50% memory), or binary pre-filter.
   *
   * @private
   * @param {number[]|Float32Array} embedding
   * @param {object} opts
   * @returns {Promise<RawSearchResult[]>}
   */
  async _searchDense(embedding, opts) {
    const t0 = Date.now();

    // Format embedding as PostgreSQL vector string
    const embeddingStr = Array.isArray(embedding)
      ? `[${embedding.join(',')}]`
      : `[${Array.from(embedding).join(',')}]`;

    const dim = Array.isArray(embedding) ? embedding.length : embedding.length;

    let sql;
    let params;

    if (opts.useBinaryPrefilter) {
      // Two-stage: binary Hamming pre-filter → float32 re-rank
      // ~67x faster than full HNSW with ~95%+ recall after re-ranking
      sql = this._buildBinaryRerankSql(dim, opts);
      params = this._buildDenseParams(embeddingStr, opts);
    } else if (opts.useQuantized) {
      // Scalar-quantized halfvec HNSW (50% memory savings, near-identical recall)
      sql = this._buildHalfvecSql(dim, opts);
      params = this._buildDenseParams(embeddingStr, opts);
    } else {
      // Full float32 HNSW (maximum recall)
      sql = this._buildFloat32Sql(dim, opts);
      params = this._buildDenseParams(embeddingStr, opts);
    }

    try {
      // Set HNSW runtime parameters
      await this._setHnswParams(opts);

      const { rows } = await this.pool.query(sql, params);
      const durationMs = Date.now() - t0;
      this.emit('search:dense:complete', { count: rows.length, durationMs });

      return rows.map(r => ({
        id: r.id,
        content: r.content,
        memory_type: r.memory_type,
        coherence_score: r.coherence_score,
        importance_score: r.importance_score,
        created_at: r.created_at,
        score: parseFloat(r.similarity ?? r.cosine_score),
        source: 'dense',
      }));
    } catch (error) {
      this.logger.warn('[HybridSearch] Dense search error (degrading):', error.message);
      return [];
    }
  }

  /**
   * Sparse vector search using SPLADE embeddings (sparsevec column).
   * Falls back to empty if sparse embeddings not available.
   *
   * @private
   * @param {string} query
   * @param {object} opts
   * @returns {Promise<RawSearchResult[]>}
   */
  async _searchSparse(query, opts) {
    const t0 = Date.now();

    // Generate sparse embedding if router supports it
    if (!this.embeddingRouter?.supportsSparse) {
      return [];
    }

    try {
      const sparseEmbedding = await this.embeddingRouter.embedSparse(query);
      if (!sparseEmbedding) return [];

      // Format as sparsevec: '{index:value,...}/dim'
      const sparseStr = this._formatSparsevec(sparseEmbedding);

      const sql = `
        SELECT
          vm.id,
          vm.content,
          vm.memory_type,
          vm.coherence_score,
          vm.importance_score,
          vm.created_at,
          1 - (vms.sparse_embed <=> $1::sparsevec(30522)) AS sparse_score
        FROM vector_memories_sparse vms
        JOIN vector_memories vm ON vm.id = vms.id
        WHERE vms.bee_id = $2
          AND (vm.expires_at IS NULL OR vm.expires_at > NOW())
        ORDER BY vms.sparse_embed <=> $1::sparsevec(30522)
        LIMIT $3
      `;

      const { rows } = await this.pool.query(sql, [sparseStr, opts.beeId, opts.limit * 2]);
      const durationMs = Date.now() - t0;
      this.emit('search:sparse:complete', { count: rows.length, durationMs });

      return rows.map(r => ({
        id: r.id,
        content: r.content,
        memory_type: r.memory_type,
        coherence_score: r.coherence_score,
        importance_score: r.importance_score,
        created_at: r.created_at,
        score: parseFloat(r.sparse_score),
        source: 'sparse',
      }));
    } catch (error) {
      this.logger.warn('[HybridSearch] Sparse search error (degrading):', error.message);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Private: RRF Fusion
  // ---------------------------------------------------------------------------

  /**
   * Reciprocal Rank Fusion (RRF) combining multiple ranked lists.
   *
   * RRF formula: score(d) = Σ_r weight_r / (k + rank_r(d))
   * k=60 is standard; prevents extreme score differences between rank 1 and rank 2.
   * Scale-invariant: works even when BM25 scores (0–∞) and cosine (0–1) differ.
   *
   * @private
   * @param {...{results: RawSearchResult[], weight: number}} rankedLists
   * @param {number} limit - Final result count
   * @returns {HybridSearchResult[]}
   */
  _rrfFusion(...args) {
    const limit = args.pop(); // Last arg is limit
    const rankedLists = args;

    /** @type {Map<string, HybridSearchResult>} */
    const scoreMap = new Map();

    for (const { results, weight } of rankedLists) {
      if (!results || results.length === 0 || weight <= 0) continue;

      results.forEach((result, rank) => {
        const rrfScore = weight / (RRF_K + rank + 1);
        const existing = scoreMap.get(result.id);

        if (existing) {
          existing.rrf_score += rrfScore;
          existing.sources.push(result.source);
          // Keep best individual score per source
          if (result.source === 'bm25') existing.bm25_score = result.score;
          if (result.source === 'dense') existing.dense_score = result.score;
          if (result.source === 'sparse') existing.sparse_score = result.score;
        } else {
          scoreMap.set(result.id, {
            id: result.id,
            content: result.content,
            memory_type: result.memory_type,
            coherence_score: result.coherence_score,
            importance_score: result.importance_score,
            created_at: result.created_at,
            rrf_score: rrfScore,
            bm25_score: result.source === 'bm25' ? result.score : null,
            dense_score: result.source === 'dense' ? result.score : null,
            sparse_score: result.source === 'sparse' ? result.score : null,
            sources: [result.source],
          });
        }
      });
    }

    // Sort by RRF score descending, return top-limit
    return Array.from(scoreMap.values())
      .sort((a, b) => b.rrf_score - a.rrf_score)
      .slice(0, limit)
      .map((r, idx) => ({
        ...r,
        rank: idx + 1,
        sources: [...new Set(r.sources)], // Deduplicate source labels
      }));
  }

  // ---------------------------------------------------------------------------
  // Private: SQL builders
  // ---------------------------------------------------------------------------

  _buildHalfvecSql(dim, opts) {
    const paramIdx = this._paramIndex(opts, 1);
    return `
      SELECT
        id,
        content,
        memory_type,
        coherence_score,
        importance_score,
        created_at,
        1 - (embedding_half <=> $1::halfvec(${dim})) AS similarity
      FROM vector_memories
      WHERE bee_id = $2
        ${opts.memoryTypes?.length ? `AND memory_type = ANY($3)` : ''}
        ${opts.workspaceId ? `AND workspace_id = $${opts.memoryTypes?.length ? 4 : 3}` : ''}
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY embedding_half <=> $1::halfvec(${dim})
      LIMIT $${paramIdx}
    `;
  }

  _buildFloat32Sql(dim, opts) {
    const paramIdx = this._paramIndex(opts, 1);
    return `
      SELECT
        id,
        content,
        memory_type,
        coherence_score,
        importance_score,
        created_at,
        1 - (embedding <=> $1::vector(${dim})) AS similarity
      FROM vector_memories
      WHERE bee_id = $2
        ${opts.memoryTypes?.length ? `AND memory_type = ANY($3)` : ''}
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY embedding <=> $1::vector(${dim})
      LIMIT $${paramIdx}
    `;
  }

  _buildBinaryRerankSql(dim, opts) {
    const oversample = opts.binaryOversample ?? 4;
    const limit = opts.limit;
    const paramIdx = this._paramIndex(opts, 1);
    return `
      SELECT
        vm.id,
        vm.content,
        vm.memory_type,
        vm.coherence_score,
        vm.importance_score,
        vm.created_at,
        1 - (vm.embedding <=> $1::vector(${dim})) AS similarity
      FROM (
        SELECT id
        FROM vector_memories
        WHERE bee_id = $2
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY embedding_binary <~> binary_quantize($1::vector(${dim}))::bit(${dim})
        LIMIT ${limit * oversample}
      ) candidates
      JOIN vector_memories vm ON vm.id = candidates.id
      ORDER BY vm.embedding <=> $1::vector(${dim})
      LIMIT $${paramIdx}
    `;
  }

  _buildDenseParams(embeddingStr, opts) {
    const params = [embeddingStr, opts.beeId];
    if (opts.memoryTypes?.length) params.push(opts.memoryTypes);
    if (opts.workspaceId) params.push(opts.workspaceId);
    params.push(opts.limit * 2); // Over-fetch for better RRF quality
    return params;
  }

  _buildBm25Params(query, opts) {
    const params = [query, opts.beeId];
    if (opts.memoryTypes?.length) params.push(opts.memoryTypes);
    if (opts.workspaceId) params.push(opts.workspaceId);
    params.push(opts.limit * 2);
    return params;
  }

  /**
   * Compute the next parameter index for a dynamic SQL query.
   * @private
   */
  _paramIndex(opts, base) {
    let idx = base + 1; // $1=embedding, $2=bee_id
    if (opts.memoryTypes?.length) idx++;
    if (opts.workspaceId) idx++;
    return idx;
  }

  // ---------------------------------------------------------------------------
  // Private: HNSW runtime params
  // ---------------------------------------------------------------------------

  /**
   * Set HNSW session parameters for the current query.
   * pgvector 0.8.0 iterative scan is critical for agent memory filtered queries.
   *
   * @private
   * @param {object} opts
   */
  async _setHnswParams(opts) {
    const client = await this.pool.connect();
    try {
      // ef_search: controls recall vs speed tradeoff at query time
      /** efSearch default: fib(11) = 89 (phi-scaled, replaces 100) */
      await client.query(`SET LOCAL hnsw.ef_search = ${opts.efSearch ?? PHI_EF_SEARCH}`);

      if (opts.useIterativeScan) {
        // pgvector 0.8.0: prevents incomplete results for filtered queries
        // 'relaxed_order' is recommended for production (faster than strict_order)
        await client.query(`SET LOCAL hnsw.iterative_scan = 'relaxed_order'`);
        await client.query(`SET LOCAL hnsw.max_scan_tuples = ${opts.maxScanTuples ?? 20000}`);
      }
    } finally {
      client.release();
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Embedding
  // ---------------------------------------------------------------------------

  /**
   * Get query embedding via the embedding router.
   *
   * @private
   * @param {string} query
   * @param {object} opts
   * @returns {Promise<number[]|null>}
   */
  async _getQueryEmbedding(query, opts) {
    if (!this.embeddingRouter) {
      this.logger.warn('[HybridSearch] No embedding router — skipping dense search');
      return null;
    }
    try {
      return await this.embeddingRouter.embed(query, {
        type: 'query',
        domain: opts.domain,
      });
    } catch (error) {
      this.logger.warn('[HybridSearch] Embedding failed (degrading to BM25 only):', error.message);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Sparse vector formatting
  // ---------------------------------------------------------------------------

  /**
   * Format sparse vector as PostgreSQL sparsevec literal.
   * Format: '{index1:value1,index2:value2,...}/dimensions'
   *
   * @private
   * @param {Map<number,number>|object} sparseEmbedding
   * @returns {string}
   */
  _formatSparsevec(sparseEmbedding) {
    const entries = sparseEmbedding instanceof Map
      ? Array.from(sparseEmbedding.entries())
      : Object.entries(sparseEmbedding).map(([k, v]) => [parseInt(k, 10), v]);

    const pairs = entries
      .filter(([, v]) => v !== 0)
      .map(([k, v]) => `${k}:${v}`)
      .join(',');

    return `{${pairs}}/30522`;
  }

  // ---------------------------------------------------------------------------
  // Private: Metrics
  // ---------------------------------------------------------------------------

  /**
   * @private
   */
  _recordMetrics(durationMs, opts) {
    if (!this.enableMetrics) return;
    this._metrics.totalSearches++;
    this._metrics.totalDurationMs += durationMs;
    if (durationMs > this.slowQueryThresholdMs) this._metrics.slowSearches++;
    if (opts.bm25Weight > 0 && opts.denseWeight > 0) this._metrics.hybrid++;
    else if (opts.bm25Weight > 0) this._metrics.bm25Only++;
    else this._metrics.denseOnly++;
  }
}

// ---------------------------------------------------------------------------
// Type definitions (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {object} RawSearchResult
 * @property {string} id - Memory UUID
 * @property {string} content - Memory text content
 * @property {string} memory_type - episodic|semantic|procedural|working
 * @property {number|null} coherence_score - Sacred Geometry coherence score
 * @property {number|null} importance_score - Memory importance (0-1)
 * @property {Date} created_at
 * @property {number} score - Raw score from this retrieval method
 * @property {string} source - 'bm25'|'dense'|'sparse'
 */

/**
 * @typedef {object} HybridSearchResult
 * @property {string} id - Memory UUID
 * @property {string} content - Memory text content
 * @property {string} memory_type
 * @property {number|null} coherence_score
 * @property {number|null} importance_score
 * @property {Date} created_at
 * @property {number} rrf_score - Fused RRF score (higher = more relevant)
 * @property {number|null} bm25_score - BM25 score if retrieved via BM25
 * @property {number|null} dense_score - Cosine similarity if retrieved via dense
 * @property {number|null} sparse_score - Sparse score if retrieved via SPLADE
 * @property {number} rank - Final rank position (1-based)
 * @property {string[]} sources - Which retrieval methods returned this result
 */

export default HybridSearchEngine;
