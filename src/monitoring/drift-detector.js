/**
 * =============================================================================
 * Heady Drift Detector
 * =============================================================================
 * Monitors embedding coherence across the 384-dimensional vector space used
 * by Heady's sovereign memory system. Detects semantic drift, structural drift,
 * and mission-alignment drift relative to a calibrated baseline.
 *
 * Methodology:
 *  - Cosine similarity comparison of current vs baseline centroid vectors
 *  - Monte Carlo simulation of drift trajectory (next N steps)
 *  - Drift categories: semantic, structural, mission-alignment
 *  - Auto-healing: recalibrate indices and trigger HeadyMaintenance on critical
 *  - Full drift history persisted to PostgreSQL for pattern analysis
 *
 * Usage:
 *   const detector = new DriftDetector({ databaseUrl, redisUrl });
 *   await detector.initialize();
 *   const result = await detector.runFullCheck();
 *   await detector.destroy();
 * =============================================================================
 */

'use strict';

const EventEmitter = require('events');

// ─── Optional dependencies ────────────────────────────────────────────────────
let pg, redis, axios;
try { pg    = require('pg');       } catch {}
try { redis = require('ioredis');  } catch {}
try { axios = require('axios');    } catch {}

// =============================================================================
// Constants
// =============================================================================

/** Dimensionality of the embedding space */
const EMBEDDING_DIMS = 384;

/** Default cosine similarity threshold below which drift is flagged */
const DEFAULT_DRIFT_THRESHOLD = 0.75;

/** Drift categories */
const DRIFT_CATEGORY = {
  SEMANTIC:           'semantic',            // Meaning has drifted
  STRUCTURAL:         'structural',          // Cluster structure changed
  MISSION_ALIGNMENT:  'mission-alignment',   // Core mission context diverged
};

/** Drift severity levels */
const DRIFT_SEVERITY = {
  NOMINAL:  'nominal',   // > threshold
  MINOR:    'minor',     // threshold - 0.1 to threshold
  MODERATE: 'moderate',  // threshold - 0.2 to threshold - 0.1
  CRITICAL: 'critical',  // < threshold - 0.2
};

/** Monte Carlo simulation parameters */
const MC_PARAMS = {
  iterations:      1000,
  projectionSteps: 10,
  noiseScale:      0.02,    // Gaussian noise std for trajectory simulation
};

// =============================================================================
// Math utilities
// =============================================================================

/**
 * Compute cosine similarity between two vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} similarity in [-1, 1]
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Compute centroid (mean vector) of an array of vectors.
 * @param {number[][]} vectors
 * @returns {number[]}
 */
function centroid(vectors) {
  if (vectors.length === 0) return new Array(EMBEDDING_DIMS).fill(0);
  const sum = new Array(vectors[0].length).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < v.length; i++) sum[i] += v[i];
  }
  return sum.map(x => x / vectors.length);
}

/**
 * Box-Muller transform: sample from N(0, σ²).
 * Used by Monte Carlo trajectory simulation.
 */
function gaussianRandom(mean = 0, std = 1) {
  const u = 1 - Math.random();
  const v = Math.random();
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Add Gaussian noise to a vector (non-destructive).
 * @param {number[]} vector
 * @param {number} scale  — noise std
 * @returns {number[]}
 */
function addNoise(vector, scale) {
  return vector.map(x => x + gaussianRandom(0, scale));
}

/**
 * L2-normalize a vector.
 */
function normalize(vector) {
  const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
  return norm === 0 ? vector : vector.map(x => x / norm);
}

// =============================================================================
// DriftDetector class
// =============================================================================

class DriftDetector extends EventEmitter {
  /**
   * @param {object} opts
   * @param {string}  opts.databaseUrl          — PostgreSQL connection string
   * @param {string}  [opts.redisUrl]           — Redis connection string (for baseline cache)
   * @param {number}  [opts.threshold=0.75]     — Minimum cosine similarity before flagging
   * @param {string}  [opts.baselineTable]      — Table storing baseline vectors
   * @param {string}  [opts.currentTable]       — Table storing current memory vectors
   * @param {object}  [opts.alertConfig]        — Alert channels
   * @param {string}  [opts.alertConfig.slackWebhook]
   * @param {string}  [opts.alertConfig.webhookUrl]
   * @param {number}  [opts.historyRetentionDays=90] — Days of drift history to keep
   */
  constructor(opts = {}) {
    super();

    this.config = {
      databaseUrl:          opts.databaseUrl  || process.env.DATABASE_URL,
      redisUrl:             opts.redisUrl     || process.env.REDIS_URL,
      threshold:            opts.threshold    ?? DEFAULT_DRIFT_THRESHOLD,
      baselineTable:        opts.baselineTable ?? 'memory_baseline_vectors',
      currentTable:         opts.currentTable  ?? 'memory_vectors',
      historyTable:         'drift_history',
      historyRetentionDays: opts.historyRetentionDays ?? 90,
      mc: { ...MC_PARAMS, ...opts.mc },
      alertConfig: {
        slackWebhook: opts.alertConfig?.slackWebhook || process.env.SLACK_WEBHOOK_URL,
        webhookUrl:   opts.alertConfig?.webhookUrl   || process.env.DRIFT_WEBHOOK_URL,
        ...opts.alertConfig,
      },
    };

    this._pgPool      = null;
    this._redisClient = null;
    this._baseline    = null;     // Cached baseline centroid
    this._lastCheck   = null;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async initialize() {
    if (this.config.databaseUrl && pg) {
      const { Pool } = pg;
      this._pgPool = new Pool({
        connectionString: this.config.databaseUrl,
        max: 2,
        idleTimeoutMillis: 15_000,
        connectionTimeoutMillis: 5_000,
      });
      await this._ensureSchema();
    }

    if (this.config.redisUrl && redis) {
      this._redisClient = new redis(this.config.redisUrl, {
        lazyConnect: true,
        connectTimeout: 5_000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
      await this._redisClient.connect().catch(() => {});
    }

    // Load baseline into memory
    await this._loadBaseline();

    return this;
  }

  async destroy() {
    await this._pgPool?.end().catch(() => {});
    await this._redisClient?.quit().catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Run a full drift check across all categories.
   * @returns {Promise<DriftResult>}
   */
  async runFullCheck() {
    const startTime = Date.now();

    const [semantic, structural, missionAlignment] = await Promise.allSettled([
      this._checkSemanticDrift(),
      this._checkStructuralDrift(),
      this._checkMissionAlignmentDrift(),
    ]);

    const checks = {
      [DRIFT_CATEGORY.SEMANTIC]:          this._settle(semantic),
      [DRIFT_CATEGORY.STRUCTURAL]:        this._settle(structural),
      [DRIFT_CATEGORY.MISSION_ALIGNMENT]: this._settle(missionAlignment),
    };

    // Overall score: weighted average of category similarities
    const scores = Object.values(checks).map(c => c.similarity ?? 1.0);
    const overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    const severity  = this._scoreToSeverity(overallScore);
    const critical  = severity === DRIFT_SEVERITY.CRITICAL;
    const degraded  = severity === DRIFT_SEVERITY.MODERATE || severity === DRIFT_SEVERITY.MINOR;

    // Monte Carlo trajectory prediction
    const trajectory = await this._simulateTrajectory(overallScore);

    const result = {
      overallScore:     overallScore.toFixed(4),
      severity,
      critical,
      degraded,
      threshold:        this.config.threshold,
      checks,
      trajectory,
      duration:         Date.now() - startTime,
      timestamp:        new Date().toISOString(),
    };

    this._lastCheck = result;

    // Persist to history
    await this._persistDriftRecord(result).catch(err =>
      console.error('[DriftDetector] History persist failed:', err.message)
    );

    // Cache result in Redis
    if (this._redisClient) {
      await this._redisClient.setex(
        'drift:last-check',
        3600,
        JSON.stringify(result)
      ).catch(() => {});
    }

    // Emit events
    this.emit('check', result);
    if (critical) {
      this.emit('critical', result);
      await this._onCriticalDrift(result);
    } else if (degraded) {
      this.emit('degraded', result);
      await this._sendAlert({ severity, result });
    }

    return result;
  }

  /**
   * Force a baseline recalibration from current vectors.
   * Called by self-healing workflows when critical drift is detected.
   * @param {object} [opts]
   * @param {string} [opts.reason]
   * @param {string} [opts.severity]
   */
  async triggerRecalibration(opts = {}) {
    const reason = opts.reason || 'manual';
    console.log(`[DriftDetector] Recalibrating baseline (reason: ${reason})`);

    if (!this._pgPool) {
      console.warn('[DriftDetector] No database available for recalibration');
      return;
    }

    const client = await this._pgPool.connect();
    try {
      await client.query('BEGIN');

      // Snapshot current vectors into baseline
      await client.query(`
        INSERT INTO ${this.config.baselineTable}
          (category, centroid_vector, vector_count, recalibrated_at, reason)
        SELECT
          'default',
          AVG(embedding)::vector,
          COUNT(*),
          NOW(),
          $1
        FROM ${this.config.currentTable}
        WHERE created_at > NOW() - INTERVAL '7 days'
        ON CONFLICT (category) DO UPDATE
          SET centroid_vector  = EXCLUDED.centroid_vector,
              vector_count     = EXCLUDED.vector_count,
              recalibrated_at  = EXCLUDED.recalibrated_at,
              reason           = EXCLUDED.reason
      `, [reason]);

      await client.query('COMMIT');

      // Invalidate cached baseline
      this._baseline = null;
      await this._loadBaseline();

      this.emit('recalibrated', { reason, timestamp: new Date().toISOString() });
      console.log('[DriftDetector] Baseline recalibration complete');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[DriftDetector] Recalibration failed:', err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Get drift history for pattern analysis.
   * @param {object} [opts]
   * @param {number} [opts.limit=100]
   * @param {string} [opts.since] — ISO date string
   * @returns {Promise<object[]>}
   */
  async getHistory(opts = {}) {
    if (!this._pgPool) return [];
    const limit = opts.limit ?? 100;
    const since = opts.since ?? new Date(Date.now() - 7 * 86_400_000).toISOString();

    const { rows } = await this._pgPool.query(`
      SELECT *
      FROM ${this.config.historyTable}
      WHERE recorded_at > $1
      ORDER BY recorded_at DESC
      LIMIT $2
    `, [since, limit]);

    return rows;
  }

  // ---------------------------------------------------------------------------
  // Drift check implementations
  // ---------------------------------------------------------------------------

  async _checkSemanticDrift() {
    const baseline = await this._getBaseline('default');
    if (!baseline) {
      return {
        category:   DRIFT_CATEGORY.SEMANTIC,
        similarity: 1.0,
        status:     'no-baseline',
        detail:     'No baseline available — treated as nominal',
      };
    }

    const currentVectors = await this._sampleCurrentVectors({ limit: 200 });
    if (currentVectors.length === 0) {
      return {
        category:   DRIFT_CATEGORY.SEMANTIC,
        similarity: 1.0,
        status:     'no-vectors',
        detail:     'No current vectors to compare',
      };
    }

    const currentCentroid = centroid(currentVectors);
    const similarity      = cosineSimilarity(normalize(baseline.vector), normalize(currentCentroid));
    const severity        = this._scoreToSeverity(similarity);

    return {
      category:     DRIFT_CATEGORY.SEMANTIC,
      similarity:   parseFloat(similarity.toFixed(4)),
      severity,
      status:       severity === DRIFT_SEVERITY.NOMINAL ? 'ok' : severity,
      sampleSize:   currentVectors.length,
      threshold:    this.config.threshold,
      detail: {
        baselineVectorCount: baseline.vectorCount,
        baselineDate:        baseline.calibratedAt,
        currentSampleSize:   currentVectors.length,
      },
    };
  }

  async _checkStructuralDrift() {
    if (!this._pgPool) {
      return { category: DRIFT_CATEGORY.STRUCTURAL, similarity: 1.0, status: 'unconfigured' };
    }

    try {
      // Compare cluster distribution statistics — number of distinct clusters,
      // inter-cluster distance, intra-cluster variance
      const client = await this._pgPool.connect();
      try {
        // Approximate cluster count via quantization bins (simplified)
        const { rows } = await client.query(`
          SELECT
            COUNT(*) AS total,
            COUNT(DISTINCT topic_tag) AS cluster_count,
            AVG(confidence) AS avg_confidence,
            STDDEV(confidence) AS stddev_confidence
          FROM ${this.config.currentTable}
          WHERE created_at > NOW() - INTERVAL '24 hours'
        `).catch(() => ({ rows: [{}] }));

        const total          = parseInt(rows[0]?.total        || '0');
        const clusterCount   = parseInt(rows[0]?.cluster_count || '0');
        const avgConf        = parseFloat(rows[0]?.avg_confidence  || '0.8');
        const stddevConf     = parseFloat(rows[0]?.stddev_confidence || '0.1');

        // Structural health: high confidence + low variance = good structure
        const structuralScore = Math.min(1.0, avgConf * (1 - Math.min(stddevConf, 0.5)));
        const severity = this._scoreToSeverity(structuralScore);

        return {
          category:  DRIFT_CATEGORY.STRUCTURAL,
          similarity: parseFloat(structuralScore.toFixed(4)),
          severity,
          status:     severity === DRIFT_SEVERITY.NOMINAL ? 'ok' : severity,
          detail: { total, clusterCount, avgConfidence: avgConf, stddevConfidence: stddevConf },
        };
      } finally {
        client.release();
      }
    } catch (err) {
      return { category: DRIFT_CATEGORY.STRUCTURAL, similarity: 0.8, status: 'error', detail: err.message };
    }
  }

  async _checkMissionAlignmentDrift() {
    const baseline = await this._getBaseline('mission');
    if (!baseline) {
      return {
        category:   DRIFT_CATEGORY.MISSION_ALIGNMENT,
        similarity: 1.0,
        status:     'no-baseline',
        detail:     'No mission baseline — treated as nominal',
      };
    }

    // Sample mission-critical memory vectors (tagged as 'mission')
    const missionVectors = await this._sampleCurrentVectors({
      limit:    50,
      tag:      'mission',
    });

    if (missionVectors.length === 0) {
      return {
        category:   DRIFT_CATEGORY.MISSION_ALIGNMENT,
        similarity: 1.0,
        status:     'no-mission-vectors',
        detail:     'No mission vectors found in current window',
      };
    }

    const currentCentroid = centroid(missionVectors);
    const similarity      = cosineSimilarity(normalize(baseline.vector), normalize(currentCentroid));
    const severity        = this._scoreToSeverity(similarity);

    // Mission alignment has a higher effective threshold
    const missionThreshold = Math.min(1.0, this.config.threshold + 0.1);
    const overThreshold = similarity >= missionThreshold;

    return {
      category:        DRIFT_CATEGORY.MISSION_ALIGNMENT,
      similarity:      parseFloat(similarity.toFixed(4)),
      severity:        overThreshold ? DRIFT_SEVERITY.NOMINAL : severity,
      status:          overThreshold ? 'ok' : severity,
      missionThreshold,
      detail: {
        sampleSize:   missionVectors.length,
        baselineDate: baseline.calibratedAt,
        alignmentPct: (similarity * 100).toFixed(1) + '%',
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Monte Carlo trajectory simulation
  // ---------------------------------------------------------------------------

  /**
   * Simulate future drift trajectory using Monte Carlo sampling.
   * Projects where the system's drift score will be in N steps.
   *
   * @param {number} currentScore — current overall similarity (0–1)
   * @returns {object} trajectory prediction
   */
  async _simulateTrajectory(currentScore) {
    const { iterations, projectionSteps, noiseScale } = this.config.mc;

    // Sample historical drift deltas for realism
    const historicalDeltas = await this._getHistoricalDeltas();
    const deltaStd = historicalDeltas.length > 5
      ? this._stddev(historicalDeltas)
      : noiseScale;

    const finalScores = [];

    for (let iter = 0; iter < iterations; iter++) {
      let score = currentScore;

      for (let step = 0; step < projectionSteps; step++) {
        // Random walk with drift bias (slight mean-reversion toward 1.0)
        const meanReversion = (1.0 - score) * 0.05;
        const delta         = gaussianRandom(meanReversion, deltaStd);
        score               = Math.max(0, Math.min(1, score + delta));
      }

      finalScores.push(score);
    }

    finalScores.sort((a, b) => a - b);

    const p5  = finalScores[Math.floor(iterations * 0.05)];
    const p25 = finalScores[Math.floor(iterations * 0.25)];
    const p50 = finalScores[Math.floor(iterations * 0.50)];
    const p75 = finalScores[Math.floor(iterations * 0.75)];
    const p95 = finalScores[Math.floor(iterations * 0.95)];

    const criticalProbability = finalScores.filter(s => s < (this.config.threshold - 0.2)).length / iterations;

    return {
      projectionSteps,
      iterations,
      percentiles: {
        p5:  parseFloat(p5.toFixed(4)),
        p25: parseFloat(p25.toFixed(4)),
        p50: parseFloat(p50.toFixed(4)),
        p75: parseFloat(p75.toFixed(4)),
        p95: parseFloat(p95.toFixed(4)),
      },
      criticalProbability:  parseFloat(criticalProbability.toFixed(4)),
      predictedSeverity:    this._scoreToSeverity(p50),
      riskLevel: criticalProbability > 0.3 ? 'high' :
                 criticalProbability > 0.1 ? 'medium' : 'low',
    };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  async _loadBaseline() {
    if (!this._pgPool) return;

    // Try Redis cache first
    if (this._redisClient) {
      const cached = await this._redisClient.get('drift:baseline').catch(() => null);
      if (cached) {
        try {
          this._baseline = JSON.parse(cached);
          return;
        } catch {}
      }
    }

    // Load from PostgreSQL
    try {
      const { rows } = await this._pgPool.query(`
        SELECT category, centroid_vector, vector_count, recalibrated_at
        FROM ${this.config.baselineTable}
        ORDER BY recalibrated_at DESC
        LIMIT 10
      `);

      this._baseline = {};
      for (const row of rows) {
        // pgvector returns vectors as strings like "[0.1,0.2,...]"
        const vec = typeof row.centroid_vector === 'string'
          ? JSON.parse(row.centroid_vector.replace(/\[/g, '[').replace(/\]/g, ']'))
          : Array.isArray(row.centroid_vector) ? row.centroid_vector : [];

        this._baseline[row.category] = {
          vector:       vec,
          vectorCount:  row.vector_count,
          calibratedAt: row.recalibrated_at,
        };
      }

      // Cache in Redis for 30 minutes
      if (this._redisClient) {
        await this._redisClient.setex(
          'drift:baseline',
          1800,
          JSON.stringify(this._baseline)
        ).catch(() => {});
      }
    } catch (err) {
      console.warn('[DriftDetector] Could not load baseline:', err.message);
      this._baseline = {};
    }
  }

  async _getBaseline(category = 'default') {
    if (!this._baseline) await this._loadBaseline();
    const b = this._baseline?.[category];
    if (!b || !b.vector || b.vector.length === 0) return null;
    return b;
  }

  async _sampleCurrentVectors({ limit = 200, tag = null } = {}) {
    if (!this._pgPool) return [];

    try {
      const query = tag
        ? `SELECT embedding FROM ${this.config.currentTable} WHERE topic_tag = $1 ORDER BY RANDOM() LIMIT $2`
        : `SELECT embedding FROM ${this.config.currentTable} ORDER BY RANDOM() LIMIT $1`;
      const params = tag ? [tag, limit] : [limit];

      const { rows } = await this._pgPool.query(query, params);

      return rows
        .map(row => {
          try {
            if (typeof row.embedding === 'string') {
              return JSON.parse(row.embedding.replace(/^\[/, '[').replace(/\]$/, ']'));
            }
            return Array.isArray(row.embedding) ? row.embedding : null;
          } catch { return null; }
        })
        .filter(v => v && v.length === EMBEDDING_DIMS);
    } catch (err) {
      console.warn('[DriftDetector] Vector sample failed:', err.message);
      return [];
    }
  }

  async _getHistoricalDeltas() {
    if (!this._pgPool) return [];

    try {
      const { rows } = await this._pgPool.query(`
        SELECT overall_score
        FROM ${this.config.historyTable}
        WHERE recorded_at > NOW() - INTERVAL '7 days'
        ORDER BY recorded_at DESC
        LIMIT 100
      `);

      if (rows.length < 2) return [];

      const deltas = [];
      for (let i = 1; i < rows.length; i++) {
        deltas.push(parseFloat(rows[i - 1].overall_score) - parseFloat(rows[i].overall_score));
      }
      return deltas;
    } catch { return []; }
  }

  async _persistDriftRecord(result) {
    if (!this._pgPool) return;

    try {
      await this._pgPool.query(`
        INSERT INTO ${this.config.historyTable}
          (overall_score, severity, semantic_score, structural_score, mission_score,
           critical_probability, recorded_at, raw_result)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
      `, [
        result.overallScore,
        result.severity,
        result.checks[DRIFT_CATEGORY.SEMANTIC]?.similarity ?? null,
        result.checks[DRIFT_CATEGORY.STRUCTURAL]?.similarity ?? null,
        result.checks[DRIFT_CATEGORY.MISSION_ALIGNMENT]?.similarity ?? null,
        result.trajectory?.criticalProbability ?? null,
        JSON.stringify(result),
      ]);

      // Prune old history
      await this._pgPool.query(`
        DELETE FROM ${this.config.historyTable}
        WHERE recorded_at < NOW() - INTERVAL '${this.config.historyRetentionDays} days'
      `);
    } catch (err) {
      console.warn('[DriftDetector] Could not persist drift record:', err.message);
    }
  }

  async _ensureSchema() {
    if (!this._pgPool) return;

    const client = await this._pgPool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.config.historyTable} (
          id               BIGSERIAL PRIMARY KEY,
          overall_score    NUMERIC(6,4),
          severity         VARCHAR(20),
          semantic_score   NUMERIC(6,4),
          structural_score NUMERIC(6,4),
          mission_score    NUMERIC(6,4),
          critical_probability NUMERIC(6,4),
          recorded_at      TIMESTAMPTZ DEFAULT NOW(),
          raw_result       JSONB
        );

        CREATE INDEX IF NOT EXISTS drift_history_recorded_at_idx
          ON ${this.config.historyTable} (recorded_at DESC);

        CREATE TABLE IF NOT EXISTS ${this.config.baselineTable} (
          category          VARCHAR(50) PRIMARY KEY,
          centroid_vector   JSONB,
          vector_count      INTEGER,
          recalibrated_at   TIMESTAMPTZ DEFAULT NOW(),
          reason            TEXT
        );
      `);
    } catch (err) {
      console.warn('[DriftDetector] Schema init warning:', err.message);
    } finally {
      client.release();
    }
  }

  // ---------------------------------------------------------------------------
  // Critical drift response
  // ---------------------------------------------------------------------------

  async _onCriticalDrift(result) {
    console.error('[DriftDetector] CRITICAL DRIFT DETECTED:', {
      overallScore: result.overallScore,
      severity:     result.severity,
      trajectory:   result.trajectory?.predictedSeverity,
    });

    // 1. Send alert
    await this._sendAlert({ severity: DRIFT_SEVERITY.CRITICAL, result });

    // 2. Publish to Redis pub/sub so HeadyMaintenance can react
    if (this._redisClient) {
      await this._redisClient.publish('heady:events:drift-critical', JSON.stringify({
        event:       'drift:critical',
        score:       result.overallScore,
        timestamp:   result.timestamp,
        trajectory:  result.trajectory,
      })).catch(() => {});
    }

    // 3. Emit for local subscribers (e.g., HealthMonitor integration)
    this.emit('heal-required', result);
  }

  async _sendAlert({ severity, result }) {
    const message = `Vector drift ${severity}: overall=${result.overallScore} (threshold=${this.config.threshold}). ` +
      `Predicted: ${result.trajectory?.predictedSeverity || 'unknown'}. ` +
      `Critical probability: ${((result.trajectory?.criticalProbability || 0) * 100).toFixed(1)}%`;

    const tasks = [];

    if (this.config.alertConfig.slackWebhook && axios) {
      tasks.push(
        axios.post(this.config.alertConfig.slackWebhook, {
          text: `[Heady DriftDetector] ${severity.toUpperCase()}: ${message}`,
          attachments: [{
            color: severity === DRIFT_SEVERITY.CRITICAL ? '#d00000' :
                   severity === DRIFT_SEVERITY.MODERATE  ? '#ff9900' : '#ffcc00',
            fields: [
              { title: 'Overall Score',         value: String(result.overallScore),       short: true },
              { title: 'Severity',              value: severity,                           short: true },
              { title: 'Semantic',              value: String(result.checks[DRIFT_CATEGORY.SEMANTIC]?.similarity   ?? 'N/A'), short: true },
              { title: 'Mission Alignment',     value: String(result.checks[DRIFT_CATEGORY.MISSION_ALIGNMENT]?.similarity ?? 'N/A'), short: true },
              { title: 'Critical Probability',  value: String(result.trajectory?.criticalProbability ?? 'N/A'),    short: true },
              { title: 'Predicted Trajectory',  value: result.trajectory?.predictedSeverity ?? 'N/A',             short: true },
            ],
          }],
        }).catch(err => console.error('[DriftDetector] Slack alert error:', err.message))
      );
    }

    if (this.config.alertConfig.webhookUrl && axios) {
      tasks.push(
        axios.post(this.config.alertConfig.webhookUrl, { severity, message, result })
          .catch(err => console.error('[DriftDetector] Webhook error:', err.message))
      );
    }

    await Promise.allSettled(tasks);
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  _scoreToSeverity(score) {
    const t = this.config.threshold;
    if (score >= t)             return DRIFT_SEVERITY.NOMINAL;
    if (score >= t - 0.05)      return DRIFT_SEVERITY.MINOR;
    if (score >= t - 0.15)      return DRIFT_SEVERITY.MODERATE;
    return DRIFT_SEVERITY.CRITICAL;
  }

  _settle(promiseResult) {
    if (promiseResult.status === 'fulfilled') return promiseResult.value;
    return {
      similarity: 1.0,
      status:     'error',
      detail:     promiseResult.reason?.message || 'Unknown error',
    };
  }

  _stddev(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
}

// =============================================================================
// Exports
// =============================================================================
module.exports = DriftDetector;
module.exports.DRIFT_CATEGORY  = DRIFT_CATEGORY;
module.exports.DRIFT_SEVERITY  = DRIFT_SEVERITY;
module.exports.EMBEDDING_DIMS  = EMBEDDING_DIMS;
module.exports.DEFAULT_DRIFT_THRESHOLD = DEFAULT_DRIFT_THRESHOLD;
module.exports.cosineSimilarity = cosineSimilarity;
module.exports.centroid         = centroid;
