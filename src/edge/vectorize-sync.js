/**
 * vectorize-sync.js
 * Heady Latent OS — Vectorize ↔ pgvector Bidirectional Sync
 *
 * Manages synchronization between Cloudflare Vectorize (edge-native vector DB)
 * and the origin pgvector PostgreSQL extension (source of truth).
 *
 * Architecture:
 *   - pgvector is the authoritative source of truth for all vectors
 *   - Vectorize is the edge-side read cache for fast retrieval
 *   - Sync is unidirectional on conflict: pgvector always wins
 *   - Incremental sync via watermark tracking (last_synced_at timestamps)
 *   - Batch upsert to Vectorize (max 1,000 per Workers batch)
 *   - Scheduled via Cron Trigger in wrangler.toml
 *
 * pgvector access: Uses Neon HTTP serverless driver (TCP not available in Workers)
 *
 * @module vectorize-sync
 */

import { PHI, PSI, fib, phiBackoff } from '../../shared/phi-math.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maximum vectors per Vectorize upsert batch.
 * Workers limit is 1,000 — fib(16) = 987 is the nearest Fibonacci number below the limit.
 * Using fib(16) makes this value phi-continuous and semantically grounded.
 */
const VECTORIZE_BATCH_SIZE = fib(16); // fib(16) = 987 (nearest Fibonacci ≤ Workers limit of 1,000)

/**
 * Maximum vectors per HTTP API batch (limit: 5,000).
 * fib(19) = 4181 is the nearest Fibonacci ≤ 5000.
 */
const VECTORIZE_HTTP_BATCH_SIZE = fib(19); // fib(19) = 4181 (nearest Fibonacci ≤ HTTP API limit of 5,000)

/**
 * Maximum pg rows fetched per sync iteration.
 * fib(14) = 377 is the nearest Fibonacci to 500.
 * Using phi-scaling: fib(15) = 610 > 500, so fib(14) = 377 is nearest below.
 */
const PG_FETCH_BATCH_SIZE = fib(14); // fib(14) = 377 (phi-continuous replacement for 500)

/**
 * Phi-based retry delays (ms) for transient failures.
 * Uses phiBackoff() sequence: 1000 × PHI^0, PHI^1, ..., PHI^5
 * ≈ [1000, 1618, 2618, 4236, 6854, 11090]
 * These replace the original fixed Fibonacci-like array [1000, 1000, 2000, 3000, 5000, 8000, 13000].
 * phiBackoff() is called dynamically in _withRetry() below.
 */
// Note: RETRY_DELAYS_MS replaced by dynamic phiBackoff() calls in _withRetry()

/** Sync watermark storage key in KV */
const WATERMARK_KEY_PREFIX = 'sync:watermark:';

/** Sync health metrics key in KV */
const HEALTH_KEY_PREFIX = 'sync:health:';

// ─────────────────────────────────────────────────────────────────────────────
// Type definitions (JSDoc)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} SyncRecord
 * @property {string} id - Unique identifier (matches Vectorize vector ID)
 * @property {number[]} embedding - Float32 embedding vector
 * @property {object} metadata - JSON metadata attached to the vector
 * @property {number} updated_at - Unix timestamp (ms) of last update in pgvector
 * @property {string} [namespace] - Optional Vectorize namespace
 */

/**
 * @typedef {object} SyncResult
 * @property {number} synced - Count of vectors successfully synced to Vectorize
 * @property {number} skipped - Count of already-current vectors skipped
 * @property {number} errors - Count of vectors that failed to sync
 * @property {number} watermark - New watermark timestamp after sync
 * @property {number} duration_ms - Total sync duration
 * @property {string} index - Vectorize index synced
 */

/**
 * @typedef {object} SyncHealth
 * @property {number} last_sync_at - Unix timestamp (ms) of last successful sync
 * @property {number} last_sync_count - Vectors synced in last run
 * @property {number} total_synced - Lifetime total vectors synced
 * @property {number} total_errors - Lifetime error count
 * @property {string} status - 'healthy' | 'degraded' | 'failing'
 * @property {number} lag_ms - Estimated sync lag (now - last_sync_at)
 */

// ─────────────────────────────────────────────────────────────────────────────
// VectorizeSync class
// ─────────────────────────────────────────────────────────────────────────────

export class VectorizeSync {
  /**
   * @param {object} deps
   * @param {VectorizeIndex} deps.vectorize - Cloudflare Vectorize binding
   * @param {KVNamespace} deps.kv - Workers KV for watermarks and health
   * @param {string} deps.pgHttpUrl - Neon/Supabase HTTP API base URL
   * @param {string} deps.pgApiKey - pgvector API key / service role key
   * @param {string} [deps.indexName] - Vectorize index name for logging
   * @param {string} [deps.pgTable] - pgvector table name (default: 'embeddings')
   * @param {string} [deps.pgEmbeddingCol] - Embedding column name (default: 'embedding')
   * @param {string} [deps.pgIdCol] - Primary key column (default: 'id')
   * @param {string} [deps.pgMetadataCol] - Metadata JSON column (default: 'metadata')
   * @param {string} [deps.pgUpdatedAtCol] - Timestamp column (default: 'updated_at')
   */
  constructor({
    vectorize,
    kv,
    pgHttpUrl,
    pgApiKey,
    indexName = 'heady-vectors',
    pgTable = 'embeddings',
    pgEmbeddingCol = 'embedding',
    pgIdCol = 'id',
    pgMetadataCol = 'metadata',
    pgUpdatedAtCol = 'updated_at',
  }) {
    this.vectorize = vectorize;
    this.kv = kv;
    this.pgHttpUrl = pgHttpUrl;
    this.pgApiKey = pgApiKey;
    this.indexName = indexName;
    this.pgTable = pgTable;
    this.pgEmbeddingCol = pgEmbeddingCol;
    this.pgIdCol = pgIdCol;
    this.pgMetadataCol = pgMetadataCol;
    this.pgUpdatedAtCol = pgUpdatedAtCol;

    this._watermarkKey = `${WATERMARK_KEY_PREFIX}${indexName}`;
    this._healthKey = `${HEALTH_KEY_PREFIX}${indexName}`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Run an incremental sync pass: fetch changed records from pgvector
   * since the last watermark, upsert them into Vectorize.
   *
   * Conflict resolution: if a vector exists in both with different content,
   * pgvector's version always wins (pgvector is source of truth).
   *
   * @param {object} [options]
   * @param {boolean} [options.fullResync] - Ignore watermark, sync all records
   * @param {string} [options.namespace] - Filter by Vectorize namespace
   * @param {number} [options.maxRecords] - Cap total records processed per run
   * @returns {Promise<SyncResult>}
   */
  async runIncrementalSync({ fullResync = false, namespace = null, maxRecords = 10000 } = {}) {
    const startTime = Date.now();
    let totalSynced = 0;
    let totalErrors = 0;
    let totalSkipped = 0;
    let offset = 0;

    // Load watermark (last successful sync timestamp)
    const watermark = fullResync ? 0 : await this._loadWatermark();
    let newWatermark = watermark;

    console.log(`[VectorizeSync:${this.indexName}] starting incremental sync, watermark=${watermark}, fullResync=${fullResync}`);

    try {
      while (offset < maxRecords) {
        // Fetch batch from pgvector via HTTP
        const batch = await this._fetchPgBatch(watermark, offset, PG_FETCH_BATCH_SIZE, namespace);

        if (batch.length === 0) {
          console.log(`[VectorizeSync:${this.indexName}] no more records at offset=${offset}`);
          break;
        }

        // Upsert batch to Vectorize
        const { synced, errors, maxUpdatedAt } = await this._upsertToVectorize(batch);
        totalSynced += synced;
        totalErrors += errors;
        offset += batch.length;

        if (maxUpdatedAt > newWatermark) {
          newWatermark = maxUpdatedAt;
        }

        console.log(`[VectorizeSync:${this.indexName}] batch synced: offset=${offset}, synced=${synced}, errors=${errors}`);

        // If batch was smaller than requested, we've reached the end
        if (batch.length < PG_FETCH_BATCH_SIZE) break;
      }

      // Update watermark
      if (newWatermark > watermark) {
        await this._saveWatermark(newWatermark);
      }

      const result = {
        synced: totalSynced,
        skipped: totalSkipped,
        errors: totalErrors,
        watermark: newWatermark,
        duration_ms: Date.now() - startTime,
        index: this.indexName,
      };

      // Update health metrics
      await this._updateHealth({
        last_sync_at: Date.now(),
        last_sync_count: totalSynced,
        errors: totalErrors,
        duration_ms: result.duration_ms,
      });

      console.log(`[VectorizeSync:${this.indexName}] sync complete:`, result);
      return result;
    } catch (err) {
      console.error(`[VectorizeSync:${this.indexName}] sync failed:`, err);
      await this._updateHealth({ errors: totalErrors + 1, failure: true });
      throw err;
    }
  }

  /**
   * Sync a specific set of vector IDs from pgvector to Vectorize.
   * Useful for triggering immediate sync after a write to pgvector.
   *
   * @param {string[]} ids - pgvector row IDs to sync
   * @returns {Promise<{synced: number, errors: number}>}
   */
  async syncById(ids) {
    if (!ids || ids.length === 0) return { synced: 0, errors: 0 };

    const records = await this._fetchPgByIds(ids);
    if (records.length === 0) return { synced: 0, errors: 0 };

    const { synced, errors } = await this._upsertToVectorize(records);
    return { synced, errors };
  }

  /**
   * Delete vectors from Vectorize that no longer exist in pgvector.
   * Run periodically (e.g., nightly) to clean up orphaned edge vectors.
   *
   * @param {string[]} idsToDelete - pgvector IDs that have been deleted
   * @returns {Promise<{deleted: number, errors: number}>}
   */
  async syncDeletions(idsToDelete) {
    if (!idsToDelete || idsToDelete.length === 0) return { deleted: 0, errors: 0 };

    let deleted = 0;
    let errors = 0;

    // Delete in batches of 1000
    for (let i = 0; i < idsToDelete.length; i += VECTORIZE_BATCH_SIZE) {
      const batch = idsToDelete.slice(i, i + VECTORIZE_BATCH_SIZE);
      try {
        await this.vectorize.deleteByIds(batch);
        deleted += batch.length;
      } catch (err) {
        console.error(`[VectorizeSync] deletion batch failed:`, err);
        errors += batch.length;
      }
    }

    return { deleted, errors };
  }

  /**
   * Query Vectorize with automatic fallback to pgvector on failure.
   * Implements the "Vectorize as cache" pattern.
   *
   * @param {number[]} queryVector - Embedding to search against
   * @param {object} options
   * @param {number} [options.topK] - Number of results (max 20 with metadata)
   * @param {string} [options.namespace]
   * @param {object} [options.filter] - Metadata filter
   * @param {boolean} [options.returnMetadata]
   * @returns {Promise<object[]>}
   */
  async queryWithFallback(queryVector, { topK = 10, namespace, filter, returnMetadata = true } = {}) {
    try {
      const vectorizeResult = await this._withRetry(() =>
        this.vectorize.query(queryVector, {
          topK: Math.min(topK, returnMetadata ? 20 : 100),
          namespace,
          filter,
          returnValues: false,
          returnMetadata: returnMetadata ? 'all' : 'none',
        }),
      );
      return vectorizeResult.matches ?? [];
    } catch (err) {
      console.warn('[VectorizeSync] Vectorize query failed, falling back to pgvector:', err.message);
      return this._pgVectorQuery(queryVector, topK, filter);
    }
  }

  /**
   * Get sync health metrics.
   * @returns {Promise<SyncHealth>}
   */
  async getHealth() {
    const raw = await this.kv.get(this._healthKey, { type: 'json' });
    if (!raw) {
      return {
        last_sync_at: 0,
        last_sync_count: 0,
        total_synced: 0,
        total_errors: 0,
        status: 'unknown',
        lag_ms: Infinity,
      };
    }

    const lagMs = Date.now() - (raw.last_sync_at ?? 0);
    const status = lagMs > 3600_000 ? 'degraded' : raw.total_errors > 100 ? 'degraded' : 'healthy';

    return {
      ...raw,
      lag_ms: lagMs,
      status,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: pgvector HTTP access
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Fetch a batch of changed records from pgvector via Neon HTTP API.
   *
   * @param {number} watermark - Fetch records updated after this timestamp
   * @param {number} offset - Pagination offset
   * @param {number} limit - Batch size
   * @param {string|null} namespace - Optional namespace filter
   * @returns {Promise<SyncRecord[]>}
   */
  async _fetchPgBatch(watermark, offset, limit, namespace) {
    const query = namespace
      ? `SELECT ${this.pgIdCol}::text as id, ${this.pgEmbeddingCol}::text as embedding, ${this.pgMetadataCol} as metadata, EXTRACT(EPOCH FROM ${this.pgUpdatedAtCol}) * 1000 as updated_at FROM ${this.pgTable} WHERE ${this.pgUpdatedAtCol} > to_timestamp($1::double precision / 1000) AND (${this.pgMetadataCol}->>'namespace') = $4 ORDER BY ${this.pgUpdatedAtCol} ASC LIMIT $2 OFFSET $3`
      : `SELECT ${this.pgIdCol}::text as id, ${this.pgEmbeddingCol}::text as embedding, ${this.pgMetadataCol} as metadata, EXTRACT(EPOCH FROM ${this.pgUpdatedAtCol}) * 1000 as updated_at FROM ${this.pgTable} WHERE ${this.pgUpdatedAtCol} > to_timestamp($1::double precision / 1000) ORDER BY ${this.pgUpdatedAtCol} ASC LIMIT $2 OFFSET $3`;

    const params = namespace ? [watermark, limit, offset, namespace] : [watermark, limit, offset];
    const rows = await this._pgQuery(query, params);

    return rows.map((row) => ({
      id: String(row.id),
      embedding: this._parseEmbedding(row.embedding),
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
      updated_at: Number(row.updated_at),
      namespace: row.metadata?.namespace ?? namespace ?? undefined,
    }));
  }

  /**
   * Fetch specific records by ID from pgvector.
   * @param {string[]} ids
   * @returns {Promise<SyncRecord[]>}
   */
  async _fetchPgByIds(ids) {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const query = `SELECT ${this.pgIdCol}::text as id, ${this.pgEmbeddingCol}::text as embedding, ${this.pgMetadataCol} as metadata, EXTRACT(EPOCH FROM ${this.pgUpdatedAtCol}) * 1000 as updated_at FROM ${this.pgTable} WHERE ${this.pgIdCol}::text = ANY(ARRAY[${placeholders}])`;

    const rows = await this._pgQuery(query, ids);
    return rows.map((row) => ({
      id: String(row.id),
      embedding: this._parseEmbedding(row.embedding),
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
      updated_at: Number(row.updated_at),
    }));
  }

  /**
   * Execute a pgvector ANN search via HTTP fallback.
   * @param {number[]} queryVector
   * @param {number} topK
   * @param {object|null} filter
   * @returns {Promise<object[]>}
   */
  async _pgVectorQuery(queryVector, topK, filter) {
    const vectorLiteral = `[${queryVector.join(',')}]`;
    let query = `SELECT ${this.pgIdCol}::text as id, ${this.pgMetadataCol} as metadata, 1 - (${this.pgEmbeddingCol} <=> $1::vector) as score FROM ${this.pgTable}`;
    const params = [vectorLiteral];

    if (filter && Object.keys(filter).length > 0) {
      const conditions = Object.entries(filter)
        .map(([k, v], i) => `${this.pgMetadataCol}->>'${k}' = $${i + 2}`)
        .join(' AND ');
      query += ` WHERE ${conditions}`;
      params.push(...Object.values(filter).map(String));
    }

    query += ` ORDER BY ${this.pgEmbeddingCol} <=> $1::vector LIMIT ${topK}`;

    const rows = await this._pgQuery(query, params);
    return rows.map((r) => ({
      id: r.id,
      score: Number(r.score),
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata ?? {}),
    }));
  }

  /**
   * Execute a SQL query against pgvector via Neon HTTP API.
   * @param {string} sql
   * @param {Array} params
   * @returns {Promise<object[]>}
   */
  async _pgQuery(sql, params = []) {
    const response = await fetch(`${this.pgHttpUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.pgApiKey}`,
        'Neon-Pool-Opt-In': 'true',
      },
      body: JSON.stringify({ query: sql, params }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`pgvector HTTP query failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    return data.rows ?? data.results?.[0]?.rows ?? [];
  }

  /**
   * Parse pgvector embedding string format "[x,y,z,...]" to number[].
   * @param {string|number[]} raw
   * @returns {number[]}
   */
  _parseEmbedding(raw) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      return raw.replace(/^\[|\]$/g, '').split(',').map(Number);
    }
    return [];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Vectorize upsert
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Upsert a batch of records to Vectorize in chunks of VECTORIZE_BATCH_SIZE.
   *
   * @param {SyncRecord[]} records
   * @returns {Promise<{synced: number, errors: number, maxUpdatedAt: number}>}
   */
  async _upsertToVectorize(records) {
    let synced = 0;
    let errors = 0;
    let maxUpdatedAt = 0;

    for (let i = 0; i < records.length; i += VECTORIZE_BATCH_SIZE) {
      const batch = records.slice(i, i + VECTORIZE_BATCH_SIZE);

      const vectors = batch
        .filter((r) => r.embedding && r.embedding.length > 0)
        .map((r) => ({
          id: r.id,
          values: r.embedding,
          namespace: r.namespace,
          metadata: r.metadata,
        }));

      if (vectors.length === 0) continue;

      try {
        await this._withRetry(() => this.vectorize.upsert(vectors));
        synced += vectors.length;

        for (const r of batch) {
          if (r.updated_at > maxUpdatedAt) maxUpdatedAt = r.updated_at;
        }
      } catch (err) {
        console.error(`[VectorizeSync] Vectorize upsert failed for batch of ${vectors.length}:`, err);
        errors += vectors.length;
      }
    }

    return { synced, errors, maxUpdatedAt };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Watermark management
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Load the last successful sync watermark from KV.
   * @returns {Promise<number>} Unix timestamp (ms)
   */
  async _loadWatermark() {
    const raw = await this.kv.get(this._watermarkKey);
    return raw ? parseInt(raw, 10) : 0;
  }

  /**
   * Persist the new sync watermark to KV.
   * @param {number} timestamp - Unix timestamp (ms)
   */
  async _saveWatermark(timestamp) {
    await this.kv.put(this._watermarkKey, String(timestamp), { expirationTtl: 86400 * 30 });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Health tracking
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Update health metrics in KV.
   * @param {object} update
   */
  async _updateHealth(update) {
    const current = await this.kv.get(this._healthKey, { type: 'json' }) ?? {
      last_sync_at: 0,
      last_sync_count: 0,
      total_synced: 0,
      total_errors: 0,
    };

    const next = {
      ...current,
      ...(update.last_sync_at !== undefined ? { last_sync_at: update.last_sync_at } : {}),
      ...(update.last_sync_count !== undefined ? { last_sync_count: update.last_sync_count } : {}),
      total_synced: (current.total_synced ?? 0) + (update.last_sync_count ?? 0),
      total_errors: (current.total_errors ?? 0) + (update.errors ?? 0),
      last_duration_ms: update.duration_ms ?? current.last_duration_ms,
    };

    await this.kv.put(this._healthKey, JSON.stringify(next), { expirationTtl: 86400 * 7 });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Retry logic (Fibonacci backoff)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Retry an async operation using phi-backoff delay.
   * Replaces fixed RETRY_DELAYS_MS array with phiBackoff() from shared/phi-math.js.
   * delay(attempt) = 1000ms × PHI^attempt, clamped to 60s, with ±ψ² jitter.
   * Sequence ≈ [1000, 1618, 2618, 4236, 6854, 11090] ms.
   *
   * @template T
   * @param {() => Promise<T>} fn
   * @param {number} [maxAttempts]
   * @returns {Promise<T>}
   */
  async _withRetry(fn, maxAttempts = 3) {
    let lastErr;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (attempt < maxAttempts - 1) {
          // phi-backoff: baseMs=1000, maxMs=60000, jitter=true
          const delay = phiBackoff(attempt, 1000, 60_000, true);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw lastErr;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare Worker scheduled handler factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a Cron Trigger handler that runs incremental sync.
 * Usage in the main worker's scheduled() handler:
 *
 * @example
 * import { createSyncScheduledHandler } from './modules/vectorize-sync.js';
 * export default { scheduled: createSyncScheduledHandler() };
 *
 * @param {object} [options]
 * @param {boolean} [options.fullResyncOnSunday] - Run full resync on Sundays
 * @returns {Function}
 */
export function createSyncScheduledHandler(options = {}) {
  return async function scheduled(event, env, ctx) {
    const sync = new VectorizeSync({
      vectorize: env.VECTORIZE,
      kv: env.EDGE_CACHE_KV,
      pgHttpUrl: env.PG_HTTP_URL,
      pgApiKey: env.PG_API_KEY,
      indexName: env.VECTORIZE_INDEX_NAME ?? 'heady-vectors',
    });

    const isFullResyncDay = options.fullResyncOnSunday && new Date().getDay() === 0;

    ctx.waitUntil(
      sync.runIncrementalSync({ fullResync: isFullResyncDay })
        .then((result) => console.log('[VectorizeSync] scheduled sync complete:', result))
        .catch((err) => console.error('[VectorizeSync] scheduled sync failed:', err)),
    );
  };
}
