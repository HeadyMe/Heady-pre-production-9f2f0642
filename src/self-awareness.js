/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

/**
 * Self-Awareness Telemetry Loop.
 * Maintains a 384-dimensional system-state embedding, monitors coherence
 * against a baseline, and exposes an Operational Readiness Score (ORS)
 * via Monte Carlo quickReadiness.
 */

const os = require('os');
const { cosineSimilarity, EMBEDDING_DIM } = require('./vector-space-ops');
const { EmbeddingProvider } = require('./embedding-provider');
const { MonteCarloEngine } = require('./monte-carlo');
const logger = require('./utils/logger');

const COHERENCE_THRESHOLD = 0.75;

class SelfAwareness {
  /**
   * @param {object} [opts]
   * @param {string} [opts.systemId='heady-system']  identifier for this system instance
   * @param {number} [opts.defaultIntervalMs=30000]  default heartbeat interval
   */
  constructor(opts = {}) {
    this._systemId = opts.systemId || 'heady-system';
    this._defaultIntervalMs = opts.defaultIntervalMs || 30000;
    this._embeddingProvider = new EmbeddingProvider({ providerChain: ['local'] });
    this._monte = new MonteCarloEngine();

    /** @type {Float64Array|null} */
    this._baselineEmbedding = null;
    /** @type {Float64Array|null} */
    this._currentEmbedding = null;
    /** @type {Array<{ from: string, to: string, reason: string, ts: number }>} */
    this._stateTransitions = [];
    /** @type {Array<{ ts: number, coherence: number, alert: boolean }>} */
    this._heartbeatLog = [];

    this._intervalHandle = null;
    this._startedAt = Date.now();

    logger.info({ component: 'SelfAwareness', systemId: this._systemId }, 'SelfAwareness initialised');
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  /**
   * Build a text snapshot of the current system state for embedding.
   * @returns {string}
   */
  _systemStateText() {
    const mem = process.memoryUsage();
    const uptime = process.uptime();
    const load = os.loadavg()[0];
    const freeMem = os.freemem();
    return [
      `systemId:${this._systemId}`,
      `uptime:${Math.round(uptime)}`,
      `heapUsed:${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
      `rss:${Math.round(mem.rss / 1024 / 1024)}MB`,
      `loadAvg1m:${load.toFixed(2)}`,
      `freeMemMB:${Math.round(freeMem / 1024 / 1024)}`,
      `timestamp:${Date.now()}`,
    ].join(' ');
  }

  // ─── Heartbeat ──────────────────────────────────────────────────────────────

  /**
   * Re-embed the current system state and check coherence vs baseline.
   * @returns {Promise<{ embedding: Float64Array, coherence: number|null, alert: boolean }>}
   */
  async heartbeat() {
    const stateText = this._systemStateText();
    try {
      const embedding = await this._embeddingProvider.generateEmbedding(stateText);
      this._currentEmbedding = embedding;

      // Set baseline on first heartbeat
      if (!this._baselineEmbedding) {
        this._baselineEmbedding = embedding;
        logger.info({ component: 'SelfAwareness' }, 'SelfAwareness: baseline set');
      }

      const { coherence, alert } = this.coherenceCheck();
      this._heartbeatLog.push({ ts: Date.now(), coherence, alert });

      if (alert) {
        logger.warn({ coherence, threshold: COHERENCE_THRESHOLD }, 'SelfAwareness: coherence below threshold');
      }

      logger.debug({ coherence }, 'SelfAwareness: heartbeat');
      return { embedding, coherence, alert };
    } catch (err) {
      logger.error({ err: err.message }, 'SelfAwareness: heartbeat failed');
      throw err;
    }
  }

  /**
   * Check coherence of current embedding vs baseline.
   * @returns {{ coherence: number|null, alert: boolean }}
   */
  coherenceCheck() {
    if (!this._baselineEmbedding || !this._currentEmbedding) {
      return { coherence: null, alert: false };
    }
    const coherence = cosineSimilarity(this._baselineEmbedding, this._currentEmbedding);
    const alert = coherence < COHERENCE_THRESHOLD;
    return { coherence, alert };
  }

  // ─── Identity ───────────────────────────────────────────────────────────────

  /**
   * Return the current system identity embedding and metadata.
   * @returns {{ systemId: string, embedding: Float64Array|null, baseline: Float64Array|null, coherence: number|null, uptime: number }}
   */
  getSystemIdentity() {
    const { coherence } = this.coherenceCheck();
    return {
      systemId: this._systemId,
      embedding: this._currentEmbedding,
      baseline: this._baselineEmbedding,
      coherence,
      uptime: process.uptime(),
    };
  }

  // ─── State transitions ──────────────────────────────────────────────────────

  /**
   * Log a state transition (for the autobiographer / audit trail).
   * @param {string} from  prior state label
   * @param {string} to    new state label
   * @param {string} reason
   */
  logStateTransition(from, to, reason) {
    const entry = { from, to, reason, ts: Date.now() };
    this._stateTransitions.push(entry);
    logger.info(entry, 'SelfAwareness: state transition');
  }

  /**
   * Return all logged state transitions.
   * @returns {Array<{ from: string, to: string, reason: string, ts: number }>}
   */
  getStateTransitions() {
    return [...this._stateTransitions];
  }

  // ─── ORS ────────────────────────────────────────────────────────────────────

  /**
   * Operational Readiness Score using MonteCarloEngine.quickReadiness.
   * Derives signals from live process/OS metrics.
   * @returns {{ score: number, grade: string, breakdown: object }}
   */
  getORS() {
    const util = this.getResourceUtilization();
    const { coherence } = this.coherenceCheck();

    const signals = {
      errorRate: 0,                                // no direct error-rate signal here
      lastDeploySuccess: true,
      cpuPressure: Math.min(1, util.loadAvg1m / os.cpus().length),
      memoryPressure: util.memUsedRatio,
      serviceHealthRatio: coherence !== null ? Math.max(0, coherence) : 1,
      openIncidents: 0,
    };

    return this._monte.quickReadiness(signals);
  }

  // ─── Resource utilization ───────────────────────────────────────────────────

  /**
   * Current resource utilization snapshot.
   * @returns {{ cpuCount: number, loadAvg1m: number, memTotalMB: number, memFreeMB: number, memUsedRatio: number, heapUsedMB: number, heapTotalMB: number, uptime: number }}
   */
  getResourceUtilization() {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    return {
      cpuCount: os.cpus().length,
      loadAvg1m: os.loadavg()[0],
      memTotalMB: Math.round(totalMem / 1024 / 1024),
      memFreeMB: Math.round(freeMem / 1024 / 1024),
      memUsedRatio: 1 - freeMem / totalMem,
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      uptime: process.uptime(),
    };
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Start the periodic heartbeat loop.
   * @param {number} [intervalMs]  defaults to constructor option
   * @returns {this}
   */
  start(intervalMs) {
    const ms = intervalMs || this._defaultIntervalMs;
    if (this._intervalHandle) {
      logger.warn({ component: 'SelfAwareness' }, 'SelfAwareness: already running');
      return this;
    }
    // Run immediately, then repeat
    this.heartbeat().catch(err => logger.error({ err: err.message }, 'SelfAwareness: initial heartbeat error'));
    this._intervalHandle = setInterval(() => {
      this.heartbeat().catch(err => logger.error({ err: err.message }, 'SelfAwareness: heartbeat error'));
    }, ms);
    if (this._intervalHandle.unref) this._intervalHandle.unref(); // don't block process exit
    logger.info({ intervalMs: ms }, 'SelfAwareness: started');
    return this;
  }

  /**
   * Stop the heartbeat loop.
   * @returns {this}
   */
  stop() {
    if (this._intervalHandle) {
      clearInterval(this._intervalHandle);
      this._intervalHandle = null;
      logger.info({ component: 'SelfAwareness' }, 'SelfAwareness: stopped');
    }
    return this;
  }

  /**
   * Heartbeat log (last N entries).
   * @param {number} [limit=50]
   * @returns {Array<{ ts: number, coherence: number, alert: boolean }>}
   */
  getHeartbeatLog(limit = 50) {
    return this._heartbeatLog.slice(-limit);
  }
}

module.exports = { SelfAwareness, COHERENCE_THRESHOLD };
