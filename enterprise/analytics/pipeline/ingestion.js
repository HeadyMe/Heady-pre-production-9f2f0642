'use strict';
/**
 * @module analytics-ingestion
 * @description Usage analytics ingestion pipeline for HeadySystems
 *
 * Flow:
 *   POST /analytics/events
 *   → Zod schema validation
 *   → In-memory buffer (batch size fib(12)=144)
 *   → Flush to DuckDB (analytics store)
 *   → Forward to warehouse (BigQuery/Postgres)
 *   → Deduplication by eventId
 *
 * φ = 1.618033988749895
 * Batch size: fib(12) = 144
 */

const EventEmitter = require('events');
const crypto       = require('crypto');
const { z }        = require('zod');

// ─────────────────────────────────────────────────────────────────────────────
// φ constants
// ─────────────────────────────────────────────────────────────────────────────
const PHI  = 1.618033988749895;
const FIB  = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

const BATCH_SIZE       = FIB[12];          // 144 events per batch
const FLUSH_INTERVAL_MS = FIB[10] * 1000;  // fib(10)=55s auto-flush
const MAX_BUFFER_SIZE  = FIB[14];          // fib(14)=377 max buffered before back-pressure
const DEDUP_WINDOW_MS  = FIB[10] * 1000;  // 55s deduplication window
const DEDUP_MAX_SIZE   = FIB[13];         // fib(13)=233 dedup cache entries
const RETRY_MAX        = FIB[5];           // 5 flush retries

// ─────────────────────────────────────────────────────────────────────────────
// Zod Schema — Event Envelope
// ─────────────────────────────────────────────────────────────────────────────

const ContextSchema = z.object({
  ip:         z.string().optional(),
  userAgent:  z.string().optional(),
  locale:     z.string().optional(),
  timezone:   z.string().optional(),
  platform:   z.enum(['web', 'mobile', 'cli', 'server']).optional(),
  appVersion: z.string().optional(),
}).passthrough();

const EventEnvelopeSchema = z.object({
  event:      z.string().min(1).max(100).regex(/^[a-z][a-z0-9._]+$/,
                'event name must be snake_case with dots'),
  eventId:    z.string().uuid('eventId must be a valid UUID'),
  timestamp:  z.string().datetime({ offset: true }),
  userId:     z.string().nullable().optional(),
  sessionId:  z.string().min(1),
  orgId:      z.string().nullable().optional(),
  version:    z.string().default('1.0'),
  source:     z.enum(['web', 'api', 'sdk', 'agent', 'system']),
  properties: z.record(z.unknown()).default({}),
  context:    ContextSchema.optional(),
});

/** Batch schema — accepts array of events */
const EventBatchSchema = z.array(EventEnvelopeSchema).min(1).max(BATCH_SIZE);

// ─────────────────────────────────────────────────────────────────────────────
// Event-specific property schemas (partial validation)
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_SCHEMAS = {
  'user.signup':        z.object({ method: z.string(), plan: z.string(), isTrial: z.boolean() }),
  'user.login':         z.object({ method: z.string(), mfaUsed: z.boolean() }),
  'agent.created':      z.object({ agentId: z.string(), agentType: z.string(), memoryEnabled: z.boolean() }),
  'agent.invoked':      z.object({ agentId: z.string(), taskId: z.string(), cslScore: z.number().min(0).max(1) }),
  'task.submitted':     z.object({ taskId: z.string(), agentId: z.string(), priority: z.number() }),
  'task.completed':     z.object({ taskId: z.string(), status: z.string(), durationMs: z.number().nonnegative() }),
  'mcp.tool.called':    z.object({ toolName: z.string(), agentId: z.string(), success: z.boolean() }),
  'memory.stored':      z.object({ memoryId: z.string(), agentId: z.string() }),
  'memory.searched':    z.object({ agentId: z.string(), queryType: z.string() }),
  'billing.upgraded':   z.object({ fromPlan: z.string(), toPlan: z.string(), mrr: z.number().nonnegative() }),
  'feedback.submitted': z.object({ feedbackType: z.string() }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Deduplication Cache
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class EventDeduplicator
 * Deduplicates events by eventId within a rolling time window.
 * Uses LRU eviction to bound memory (fib(13)=233 entries).
 */
class EventDeduplicator {
  constructor() {
    this._seen    = new Map();   // eventId → timestamp
    this._maxSize = DEDUP_MAX_SIZE;
    this._windowMs = DEDUP_WINDOW_MS;
  }

  /**
   * Check if event is a duplicate.
   * @param {string} eventId
   * @returns {boolean} true if duplicate
   */
  isDuplicate(eventId) {
    const seen = this._seen.get(eventId);
    if (!seen) return false;
    if (Date.now() - seen > this._windowMs) {
      this._seen.delete(eventId);
      return false;
    }
    return true;
  }

  /**
   * Mark event as seen.
   * @param {string} eventId
   */
  markSeen(eventId) {
    // Evict oldest if at capacity
    if (this._seen.size >= this._maxSize) {
      const oldest = this._seen.keys().next().value;
      this._seen.delete(oldest);
    }
    this._seen.set(eventId, Date.now());
  }

  /** Clean expired entries */
  cleanup() {
    const cutoff = Date.now() - this._windowMs;
    for (const [id, ts] of this._seen) {
      if (ts < cutoff) this._seen.delete(id);
    }
  }

  get size() { return this._seen.size; }
}

// ─────────────────────────────────────────────────────────────────────────────
// DuckDB Writer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class DuckDBWriter
 * Writes batches of events to DuckDB for fast OLAP analytics.
 */
class DuckDBWriter {
  /**
   * @param {Object} opts
   * @param {string} [opts.dbPath='./analytics.duckdb']
   */
  constructor(opts = {}) {
    this.dbPath  = opts.dbPath ?? './analytics.duckdb';
    this._db     = null;
    this._conn   = null;
  }

  async init() {
    try {
      const duckdb = require('duckdb');
      this._db   = new duckdb.Database(this.dbPath);
      this._conn = this._db.connect();
      await this._ensureTable();
    } catch (err) {
      // DuckDB optional — log and continue
      console.warn('[DuckDB] Not available:', err.message);
    }
  }

  async _ensureTable() {
    if (!this._conn) return;
    await this._run(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        event_id      VARCHAR PRIMARY KEY,
        event_name    VARCHAR NOT NULL,
        timestamp     TIMESTAMP NOT NULL,
        user_id       VARCHAR,
        session_id    VARCHAR NOT NULL,
        org_id        VARCHAR,
        source        VARCHAR NOT NULL,
        version       VARCHAR NOT NULL,
        properties    JSON,
        context       JSON,
        ingested_at   TIMESTAMP DEFAULT now(),
        batch_id      VARCHAR,
        phi           DOUBLE DEFAULT ${PHI}
      )
    `);
  }

  async _run(sql, params = []) {
    if (!this._conn) return;
    return new Promise((resolve, reject) => {
      this._conn.run(sql, params, (err, result) => {
        err ? reject(err) : resolve(result);
      });
    });
  }

  /**
   * Write a batch of validated events to DuckDB.
   * @param {Object[]} events
   * @param {string} batchId
   * @returns {Promise<number>} Number of rows inserted
   */
  async writeBatch(events, batchId) {
    if (!this._conn || events.length === 0) return 0;

    const placeholders = events.map(() => '(?,?,?,?,?,?,?,?,?,?,?)').join(',');
    const values = events.flatMap(e => [
      e.eventId,
      e.event,
      new Date(e.timestamp).toISOString(),
      e.userId ?? null,
      e.sessionId,
      e.orgId ?? null,
      e.source,
      e.version,
      JSON.stringify(e.properties),
      JSON.stringify(e.context ?? {}),
      batchId,
    ]);

    try {
      await this._run(
        `INSERT OR IGNORE INTO analytics_events
         (event_id, event_name, timestamp, user_id, session_id, org_id, source, version, properties, context, batch_id)
         VALUES ${placeholders}`,
        values
      );
      return events.length;
    } catch (err) {
      console.error('[DuckDB] Batch write error:', err.message);
      return 0;
    }
  }

  async close() {
    if (this._conn) this._conn.close();
    if (this._db)   this._db.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Warehouse Forwarder (BigQuery / Postgres)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class WarehouseForwarder
 * Forwards event batches to the configured data warehouse.
 * Supports BigQuery (via @google-cloud/bigquery) and Postgres.
 */
class WarehouseForwarder {
  /**
   * @param {Object} opts
   * @param {'bigquery'|'postgres'|'none'} opts.type
   * @param {Object} [opts.config]   - Warehouse-specific config
   */
  constructor(opts = {}) {
    this.type    = opts.type ?? 'none';
    this.config  = opts.config ?? {};
    this._client = null;
  }

  async init() {
    if (this.type === 'bigquery') {
      try {
        const { BigQuery } = require('@google-cloud/bigquery');
        this._client = new BigQuery({ projectId: this.config.projectId });
      } catch (_) {
        console.warn('[Warehouse] BigQuery client not available');
      }
    } else if (this.type === 'postgres') {
      try {
        const { Pool } = require('pg');
        this._client = new Pool(this.config);
        await this._ensurePostgresTable();
      } catch (_) {
        console.warn('[Warehouse] Postgres client not available');
      }
    }
  }

  async _ensurePostgresTable() {
    if (!this._client) return;
    await this._client.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        event_id    UUID PRIMARY KEY,
        event_name  TEXT NOT NULL,
        timestamp   TIMESTAMPTZ NOT NULL,
        user_id     TEXT,
        session_id  TEXT NOT NULL,
        org_id      TEXT,
        source      TEXT NOT NULL,
        version     TEXT NOT NULL DEFAULT '1.0',
        properties  JSONB DEFAULT '{}',
        context     JSONB DEFAULT '{}',
        batch_id    TEXT,
        ingested_at TIMESTAMPTZ DEFAULT now()
      )
    `);
  }

  /**
   * Forward a batch to the warehouse.
   * @param {Object[]} events
   * @param {string} batchId
   * @returns {Promise<number>}
   */
  async forward(events, batchId) {
    if (!this._client || events.length === 0) return 0;

    if (this.type === 'bigquery') {
      return this._forwardBigQuery(events, batchId);
    } else if (this.type === 'postgres') {
      return this._forwardPostgres(events, batchId);
    }
    return 0;
  }

  async _forwardBigQuery(events, batchId) {
    try {
      const dataset = this._client.dataset(this.config.dataset ?? 'heady_analytics');
      const table   = dataset.table(this.config.table ?? 'events');
      const rows    = events.map(e => ({
        event_id:    e.eventId,
        event_name:  e.event,
        timestamp:   new Date(e.timestamp).toISOString(),
        user_id:     e.userId ?? null,
        session_id:  e.sessionId,
        org_id:      e.orgId ?? null,
        source:      e.source,
        version:     e.version,
        properties:  JSON.stringify(e.properties),
        context:     JSON.stringify(e.context ?? {}),
        batch_id:    batchId,
      }));
      await table.insert(rows, { skipInvalidRows: false, ignoreUnknownValues: false });
      return rows.length;
    } catch (err) {
      console.error('[BigQuery] Insert error:', err.message);
      return 0;
    }
  }

  async _forwardPostgres(events, batchId) {
    const client = await this._client.connect();
    try {
      await client.query('BEGIN');
      let inserted = 0;
      for (const e of events) {
        await client.query(
          `INSERT INTO analytics_events
           (event_id, event_name, timestamp, user_id, session_id, org_id, source, version, properties, context, batch_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (event_id) DO NOTHING`,
          [e.eventId, e.event, new Date(e.timestamp), e.userId ?? null, e.sessionId,
           e.orgId ?? null, e.source, e.version, e.properties, e.context ?? {}, batchId]
        );
        inserted++;
      }
      await client.query('COMMIT');
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[Postgres] Batch insert error:', err.message);
      return 0;
    } finally {
      client.release();
    }
  }

  async close() {
    if (this._client?.end) await this._client.end();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics Ingestion Pipeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class AnalyticsIngestionPipeline
 * Main ingestion pipeline: receive → validate → buffer → flush.
 *
 * @extends EventEmitter
 *
 * Events:
 *   ingested({event, batchSize})
 *   batch-flushed({batchId, count, duckdb, warehouse, durationMs})
 *   validation-error({error, raw})
 *   duplicate-dropped({eventId})
 *   back-pressure()
 */
class AnalyticsIngestionPipeline extends EventEmitter {
  /**
   * @param {Object} opts
   * @param {DuckDBWriter}      [opts.duckdb]
   * @param {WarehouseForwarder} [opts.warehouse]
   * @param {number} [opts.batchSize=144]        - fib(12)
   * @param {number} [opts.flushIntervalMs=55000] - fib(10)×1000
   */
  constructor(opts = {}) {
    super();
    this.batchSize       = opts.batchSize       ?? BATCH_SIZE;
    this.flushIntervalMs = opts.flushIntervalMs ?? FLUSH_INTERVAL_MS;
    this._buffer         = [];
    this._dedup          = new EventDeduplicator();
    this._duckdb         = opts.duckdb    ?? new DuckDBWriter();
    this._warehouse      = opts.warehouse ?? new WarehouseForwarder({ type: 'none' });
    this._flushTimer     = null;
    this._flushing       = false;
    this._stats          = {
      received:    0,
      validated:   0,
      deduplicated: 0,
      buffered:    0,
      flushed:     0,
      failed:      0,
      batches:     0,
    };
  }

  async init() {
    await this._duckdb.init();
    await this._warehouse.init();
    this._startFlushTimer();
    // Periodic dedup cleanup every fib(9)=34s
    setInterval(() => this._dedup.cleanup(), FIB[9] * 1000).unref();
    return this;
  }

  // ───────────────────────────────────────────────
  // Ingest
  // ───────────────────────────────────────────────

  /**
   * Ingest a single event or array of events.
   * @param {Object|Object[]} rawEvents
   * @returns {{ accepted: number, rejected: number, duplicates: number }}
   */
  ingest(rawEvents) {
    const events  = Array.isArray(rawEvents) ? rawEvents : [rawEvents];
    let accepted = 0, rejected = 0, duplicates = 0;

    for (const raw of events) {
      this._stats.received++;

      // Back-pressure: refuse if buffer too full
      if (this._buffer.length >= MAX_BUFFER_SIZE) {
        this.emit('back-pressure');
        rejected++;
        continue;
      }

      // Validate envelope
      const envelope = EventEnvelopeSchema.safeParse(raw);
      if (!envelope.success) {
        this.emit('validation-error', { error: envelope.error.issues, raw });
        this._stats.failed++;
        rejected++;
        continue;
      }

      const event = envelope.data;

      // Validate event-specific properties
      const propSchema = EVENT_SCHEMAS[event.event];
      if (propSchema) {
        const propResult = propSchema.safeParse(event.properties);
        if (!propResult.success) {
          this.emit('validation-error', {
            error: propResult.error.issues,
            event: event.event,
            eventId: event.eventId,
          });
          this._stats.failed++;
          rejected++;
          continue;
        }
      }

      // Deduplication
      if (this._dedup.isDuplicate(event.eventId)) {
        this.emit('duplicate-dropped', { eventId: event.eventId });
        this._stats.deduplicated++;
        duplicates++;
        continue;
      }

      this._dedup.markSeen(event.eventId);
      this._buffer.push(event);
      this._stats.validated++;
      this._stats.buffered++;
      accepted++;
      this.emit('ingested', { event, bufferSize: this._buffer.length });

      // Auto-flush when batch size reached
      if (this._buffer.length >= this.batchSize) {
        setImmediate(() => this.flush());
      }
    }

    return { accepted, rejected, duplicates };
  }

  // ───────────────────────────────────────────────
  // Flush
  // ───────────────────────────────────────────────

  /**
   * Flush the current buffer to DuckDB and warehouse.
   * @returns {Promise<Object>} Flush result
   */
  async flush() {
    if (this._flushing || this._buffer.length === 0) return { count: 0 };
    this._flushing = true;

    const batch   = this._buffer.splice(0, this.batchSize);
    const batchId = crypto.randomUUID();
    const start   = Date.now();
    let attempt   = 0;

    while (attempt < RETRY_MAX) {
      try {
        const [duckdbCount, warehouseCount] = await Promise.allSettled([
          this._duckdb.writeBatch(batch, batchId),
          this._warehouse.forward(batch, batchId),
        ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : 0));

        const durationMs = Date.now() - start;
        this._stats.flushed  += batch.length;
        this._stats.batches  ++;
        this._stats.buffered -= batch.length;
        this._flushing = false;

        const result = { batchId, count: batch.length, duckdb: duckdbCount, warehouse: warehouseCount, durationMs };
        this.emit('batch-flushed', result);
        return result;

      } catch (err) {
        attempt++;
        if (attempt >= RETRY_MAX) {
          // Re-queue events at front of buffer
          this._buffer.unshift(...batch);
          this._flushing = false;
          this.emit('flush-error', { batchId, error: err.message, attempts: attempt });
          return { batchId, count: 0, error: err.message };
        }
        const backoff = Math.round(1000 * Math.pow(PHI, attempt));
        await new Promise(r => setTimeout(r, backoff));
      }
    }

    this._flushing = false;
    return { count: 0 };
  }

  // ───────────────────────────────────────────────
  // Express Route Handler
  // ───────────────────────────────────────────────

  /**
   * Express route handler for POST /analytics/events
   * @returns {Function} Express middleware
   */
  routeHandler() {
    return async (req, res) => {
      const body = req.body;
      if (!body) return res.status(400).json({ error: 'Empty body' });

      const rawEvents = Array.isArray(body) ? body : [body];

      // Max batch size enforcement
      if (rawEvents.length > BATCH_SIZE) {
        return res.status(413).json({
          error:    `Batch too large (max fib(12)=${BATCH_SIZE})`,
          received: rawEvents.length,
          max:      BATCH_SIZE,
        });
      }

      const result = this.ingest(rawEvents);

      const status = result.accepted > 0 ? 200
                   : result.duplicates > 0 ? 200
                   : 400;

      return res.status(status).json({
        accepted:   result.accepted,
        rejected:   result.rejected,
        duplicates: result.duplicates,
        bufferSize: this._buffer.length,
        batchSize:  this.batchSize,
        phi:        PHI,
      });
    };
  }

  // ───────────────────────────────────────────────
  // Metrics
  // ───────────────────────────────────────────────

  metrics() {
    return {
      timestamp:   new Date().toISOString(),
      phi:         PHI,
      buffer: {
        size:      this._buffer.length,
        max:       MAX_BUFFER_SIZE,
        fillRatio: Number((this._buffer.length / MAX_BUFFER_SIZE).toFixed(4)),
      },
      dedup: {
        windowMs:  DEDUP_WINDOW_MS,
        cacheSize: this._dedup.size,
        maxSize:   DEDUP_MAX_SIZE,
      },
      stats:       { ...this._stats },
      batchSize:   this.batchSize,             // 144 (fib12)
      flushInterval: this.flushIntervalMs,    // 55000 (fib10)
    };
  }

  // ───────────────────────────────────────────────
  // Lifecycle
  // ───────────────────────────────────────────────

  _startFlushTimer() {
    this._flushTimer = setInterval(() => this.flush(), this.flushIntervalMs).unref();
  }

  async shutdown() {
    clearInterval(this._flushTimer);
    // Final flush
    while (this._buffer.length > 0) {
      await this.flush();
    }
    await this._duckdb.close();
    await this._warehouse.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  AnalyticsIngestionPipeline,
  DuckDBWriter,
  WarehouseForwarder,
  EventDeduplicator,
  EventEnvelopeSchema,
  EventBatchSchema,
  EVENT_SCHEMAS,
  BATCH_SIZE,
  FLUSH_INTERVAL_MS,
  MAX_BUFFER_SIZE,
  PHI,
  FIB,
};
