/**
 * HeadySystems v3.2.2 — Synthetic Monitoring
 * @module @heady-ai/synthetic-monitor
 *
 * Performs active availability and latency checks against all public endpoints.
 * Runs every fib(5)=5 minutes. Reports status code, latency, and response body hash.
 * Alerts on failure via configured notification channels.
 *
 * Monitored endpoints:
 *   Health endpoints: /health/live, /health/ready
 *   API endpoints: /api/brain/status, /api/mcp/health
 *   9 domain homepages: headyme.com + 8 others
 *
 * All numeric parameters derive from φ=1.618033988749895 and Fibonacci sequences.
 */

'use strict';

const https = require('https');
const http  = require('http');
const crypto = require('crypto');
const { performance } = require('perf_hooks');
const { createLogger } = require('../logging/structured-logging');

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

/** Check interval: fib(5)=5 minutes in milliseconds */
const CHECK_INTERVAL_MS = FIB[4] * 60 * 1000; // 5 × 60000 = 300000ms

/** HTTP request timeout: fib(8)=21 seconds in milliseconds */
const REQUEST_TIMEOUT_MS = FIB[7] * 1000; // 21000ms

/** Max consecutive failures before alerting: fib(3)=2 */
const FAILURE_THRESHOLD = FIB[2]; // 2

/** Max response body to hash (bytes): fib(12)=144 KB */
const BODY_HASH_MAX_BYTES = FIB[11] * 1024; // 147456 bytes

/** Retry backoff base (ms): 1000ms × φ^n */
const RETRY_BASE_MS = 1000;

/** Max retries per check: fib(3)=2 */
const MAX_RETRIES = FIB[2]; // 2

/** SLA latency thresholds (ms) derived from φ */
const LATENCY_THRESHOLDS = {
  OK:      Math.round(PHI ** 2 * 200),   // ≈ 524ms → round to 500ms
  WARNING: Math.round(PHI ** 3 * 200),   // ≈ 848ms → round to 800ms
  CRITICAL: 1000,                         // 1000ms = φ^2 × 382ms ≈ 1000ms
};

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All endpoints to monitor.
 * @type {Array<{id: string, url: string, method: string, expectedStatus: number, group: string, critical: boolean}>}
 */
const ENDPOINTS = [
  // ── Health endpoints (internal service health checks) ─────────────────────
  {
    id: 'health-live',
    url: process.env.API_BASE_URL ? `${process.env.API_BASE_URL}/health/live` : 'http://localhost:8080/health/live',
    method: 'GET',
    expectedStatus: 200,
    group: 'health',
    critical: true,
    expectedBodyContains: 'ok',
    slaMs: 500,
  },
  {
    id: 'health-ready',
    url: process.env.API_BASE_URL ? `${process.env.API_BASE_URL}/health/ready` : 'http://localhost:8080/health/ready',
    method: 'GET',
    expectedStatus: 200,
    group: 'health',
    critical: true,
    slaMs: 500,
  },

  // ── API endpoints ──────────────────────────────────────────────────────────
  {
    id: 'api-brain-status',
    url: process.env.API_BASE_URL ? `${process.env.API_BASE_URL}/api/brain/status` : 'http://localhost:8080/api/brain/status',
    method: 'GET',
    expectedStatus: 200,
    group: 'api',
    critical: true,
    slaMs: LATENCY_THRESHOLDS.OK,
  },
  {
    id: 'api-mcp-health',
    url: process.env.MCP_BASE_URL ? `${process.env.MCP_BASE_URL}/api/mcp/health` : 'http://localhost:8081/api/mcp/health',
    method: 'GET',
    expectedStatus: 200,
    group: 'api',
    critical: true,
    slaMs: LATENCY_THRESHOLDS.OK,
  },

  // ── 9 Domain homepages ────────────────────────────────────────────────────
  {
    id: 'domain-headyme',
    url: 'https://headyme.com',
    method: 'GET',
    expectedStatus: 200,
    group: 'domains',
    critical: false,
    slaMs: LATENCY_THRESHOLDS.WARNING,
  },
  {
    id: 'domain-headyconnection-com',
    url: 'https://headyconnection.com',
    method: 'GET',
    expectedStatus: 200,
    group: 'domains',
    critical: false,
    slaMs: LATENCY_THRESHOLDS.WARNING,
  },
  {
    id: 'domain-headyconnection-org',
    url: 'https://headyconnection.org',
    method: 'GET',
    expectedStatus: 200,
    group: 'domains',
    critical: false,
    slaMs: LATENCY_THRESHOLDS.WARNING,
  },
  {
    id: 'domain-headyos',
    url: 'https://headyos.com',
    method: 'GET',
    expectedStatus: 200,
    group: 'domains',
    critical: false,
    slaMs: LATENCY_THRESHOLDS.WARNING,
  },
  {
    id: 'domain-heady-exchange',
    url: 'https://heady.exchange',
    method: 'GET',
    expectedStatus: 200,
    group: 'domains',
    critical: false,
    slaMs: LATENCY_THRESHOLDS.WARNING,
  },
  {
    id: 'domain-heady-investments',
    url: 'https://heady.investments',
    method: 'GET',
    expectedStatus: 200,
    group: 'domains',
    critical: false,
    slaMs: LATENCY_THRESHOLDS.WARNING,
  },
  {
    id: 'domain-headysystems',
    url: 'https://headysystems.com',
    method: 'GET',
    expectedStatus: 200,
    group: 'domains',
    critical: false,
    slaMs: LATENCY_THRESHOLDS.WARNING,
  },
  {
    id: 'domain-headyai',
    url: 'https://headyai.com',
    method: 'GET',
    expectedStatus: 200,
    group: 'domains',
    critical: false,
    slaMs: LATENCY_THRESHOLDS.WARNING,
  },
  {
    id: 'domain-admin-portal',
    url: process.env.ADMIN_PORTAL_URL || 'https://admin.headyme.com',
    method: 'GET',
    expectedStatus: 200,
    group: 'domains',
    critical: false,
    slaMs: LATENCY_THRESHOLDS.WARNING,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CHECK RESULT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} CheckResult
 * @property {string} id - Endpoint ID.
 * @property {string} url - Endpoint URL.
 * @property {string} group - Endpoint group.
 * @property {boolean} success - Overall check success.
 * @property {number} statusCode - HTTP status code (0 on connection failure).
 * @property {number} latencyMs - Response time in milliseconds.
 * @property {string} bodyHash - SHA-256 of first BODY_HASH_MAX_BYTES of response body.
 * @property {string} latencyStatus - 'OK' | 'WARNING' | 'CRITICAL'.
 * @property {string|null} error - Error message if request failed.
 * @property {string} timestamp - ISO 8601 check timestamp.
 * @property {boolean} slaViolation - True if latency exceeded slaMs.
 */

// ─────────────────────────────────────────────────────────────────────────────
// HTTP PROBE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Perform a single HTTP probe with timeout and retry.
 * @param {Object} endpoint - Endpoint definition.
 * @returns {Promise<CheckResult>} Check result.
 */
const probe = (endpoint) => new Promise((resolve) => {
  const { id, url, method, expectedStatus, slaMs = LATENCY_THRESHOLDS.OK } = endpoint;
  const startMs = performance.now();
  const timestamp = new Date().toISOString();

  let settled = false;
  const done = (result) => {
    if (!settled) {
      settled = true;
      resolve(result);
    }
  };

  const urlObj = new URL(url);
  const transport = urlObj.protocol === 'https:' ? https : http;

  const options = {
    hostname: urlObj.hostname,
    port:     urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
    path:     urlObj.pathname + urlObj.search,
    method:   method,
    headers: {
      'User-Agent': `HeadySystems-SyntheticMonitor/3.2.2 (φ=${PHI})`,
      'Accept':     '*/*',
      'X-Synthetic-Monitor': 'true',
    },
    timeout: REQUEST_TIMEOUT_MS,
  };

  const req = transport.request(options, (res) => {
    const chunks = [];
    let bytesRead = 0;

    res.on('data', (chunk) => {
      bytesRead += chunk.length;
      if (bytesRead <= BODY_HASH_MAX_BYTES) {
        chunks.push(chunk);
      }
    });

    res.on('end', () => {
      const latencyMs = Math.round(performance.now() - startMs);
      const body = Buffer.concat(chunks);
      const bodyHash = crypto.createHash('sha256').update(body).digest('hex');

      const statusOk = res.statusCode === expectedStatus;
      const bodyOk = endpoint.expectedBodyContains
        ? body.toString().includes(endpoint.expectedBodyContains)
        : true;

      const latencyStatus =
        latencyMs > LATENCY_THRESHOLDS.CRITICAL ? 'CRITICAL' :
        latencyMs > LATENCY_THRESHOLDS.WARNING  ? 'WARNING'  : 'OK';

      done({
        id,
        url,
        group:         endpoint.group,
        success:       statusOk && bodyOk,
        statusCode:    res.statusCode,
        latencyMs,
        bodyHash,
        latencyStatus,
        slaViolation:  latencyMs > slaMs,
        error:         (!statusOk || !bodyOk)
          ? `Expected status ${expectedStatus}, got ${res.statusCode}` + (!bodyOk ? '. Body assertion failed.' : '')
          : null,
        timestamp,
        phi:           PHI,
      });
    });

    res.on('error', (err) => {
      done({
        id, url, group: endpoint.group,
        success: false, statusCode: 0,
        latencyMs: Math.round(performance.now() - startMs),
        bodyHash: '', latencyStatus: 'CRITICAL', slaViolation: true,
        error: `Response error: ${err.message}`, timestamp, phi: PHI,
      });
    });
  });

  req.on('timeout', () => {
    req.destroy();
    done({
      id, url, group: endpoint.group,
      success: false, statusCode: 0,
      latencyMs: REQUEST_TIMEOUT_MS,
      bodyHash: '', latencyStatus: 'CRITICAL', slaViolation: true,
      error: `Timeout after ${REQUEST_TIMEOUT_MS}ms (fib(8)=21s)`, timestamp, phi: PHI,
    });
  });

  req.on('error', (err) => {
    done({
      id, url, group: endpoint.group,
      success: false, statusCode: 0,
      latencyMs: Math.round(performance.now() - startMs),
      bodyHash: '', latencyStatus: 'CRITICAL', slaViolation: true,
      error: `Connection error: ${err.message}`, timestamp, phi: PHI,
    });
  });

  req.end();
});

/**
 * Probe with φ^n exponential retry backoff.
 * Retry backoff: 1000ms × φ^0, φ^1, φ^2 = 1000ms, 1618ms, 2618ms
 * @param {Object} endpoint
 * @param {number} [attempt=0]
 * @returns {Promise<CheckResult>}
 */
const probeWithRetry = async (endpoint, attempt = 0) => {
  const result = await probe(endpoint);
  if (!result.success && attempt < MAX_RETRIES) {
    const backoffMs = Math.round(RETRY_BASE_MS * (PHI ** attempt));
    await new Promise(r => setTimeout(r, backoffMs));
    return probeWithRetry(endpoint, attempt + 1);
  }
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// ALERTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Alert manager — tracks failure counts and fires alerts when threshold crossed.
 */
class AlertManager {
  constructor(logger) {
    this._logger = logger;
    /** @type {Map<string, number>} Consecutive failure counts per endpoint */
    this._failureCounts  = new Map();
    /** @type {Map<string, string>} Last known body hash per endpoint */
    this._lastBodyHashes = new Map();
    /** @type {Map<string, boolean>} Alert firing state per endpoint */
    this._alertFiring    = new Map();
  }

  /**
   * Process a check result and fire/resolve alerts as needed.
   * @param {CheckResult} result
   */
  process(result) {
    const { id, success, latencyMs, statusCode, bodyHash, slaViolation } = result;

    if (!success || slaViolation) {
      const count = (this._failureCounts.get(id) || 0) + 1;
      this._failureCounts.set(id, count);

      if (count >= FAILURE_THRESHOLD && !this._alertFiring.get(id)) {
        this._alertFiring.set(id, true);
        this._fireAlert(result, count);
      }
    } else {
      // Successful — resolve alert if firing
      if (this._alertFiring.get(id)) {
        this._alertFiring.set(id, false);
        this._resolveAlert(result);
      }
      this._failureCounts.set(id, 0);

      // Detect body hash changes (potential deployment or content change)
      const prevHash = this._lastBodyHashes.get(id);
      if (prevHash && prevHash !== bodyHash) {
        this._logger.info('Synthetic: response body hash changed', {
          endpointId: id,
          url: result.url,
          prevHash,
          newHash: bodyHash,
          event: 'BODY_HASH_CHANGED',
        });
      }
      this._lastBodyHashes.set(id, bodyHash);
    }
  }

  /** @private */
  _fireAlert(result, failureCount) {
    const endpoint = ENDPOINTS.find(e => e.id === result.id);
    const level = endpoint?.critical ? 'error' : 'warn';

    this._logger[level]('SYNTHETIC ALERT: Endpoint check failing', {
      endpointId:   result.id,
      url:          result.url,
      group:        result.group,
      statusCode:   result.statusCode,
      latencyMs:    result.latencyMs,
      latencyStatus: result.latencyStatus,
      slaViolation: result.slaViolation,
      failureCount,
      failureThreshold: FAILURE_THRESHOLD,  // fib(3)=2
      error:        result.error,
      alertType:    'SYNTHETIC_FAILURE',
      critical:     endpoint?.critical,
      timestamp:    result.timestamp,
    });

    // Emit to status page / incident system
    this._emitStatusEvent({
      type:      'ALERT',
      component: result.id,
      status:    'degraded',
      message:   `Endpoint ${result.url} failing: ${result.error}`,
    });
  }

  /** @private */
  _resolveAlert(result) {
    this._logger.info('SYNTHETIC RESOLVED: Endpoint check recovered', {
      endpointId: result.id,
      url:        result.url,
      latencyMs:  result.latencyMs,
      statusCode: result.statusCode,
      alertType:  'SYNTHETIC_RESOLVED',
      timestamp:  result.timestamp,
    });

    this._emitStatusEvent({
      type:      'RESOLVE',
      component: result.id,
      status:    'operational',
      message:   `Endpoint ${result.url} recovered`,
    });
  }

  /** @private */
  _emitStatusEvent(event) {
    // Status page integration point — emit to configured webhook
    const webhookUrl = process.env.STATUS_PAGE_WEBHOOK_URL;
    if (!webhookUrl) return;

    const payload = JSON.stringify({
      ...event,
      timestamp: new Date().toISOString(),
      source:    'synthetic-monitor',
      version:   '3.2.2',
    });

    // Fire-and-forget webhook call
    try {
      const urlObj = new URL(webhookUrl);
      const transport = urlObj.protocol === 'https:' ? https : http;
      const req = transport.request({
        hostname: urlObj.hostname,
        port:     urlObj.port,
        path:     urlObj.pathname,
        method:   'POST',
        headers:  {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: FIB[4] * 1000, // fib(5)=5s timeout for webhooks
      });
      req.on('error', () => {}); // Suppress errors — webhook is best-effort
      req.write(payload);
      req.end();
    } catch { /* Suppress */ }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MONITOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Synthetic monitor orchestrator.
 * Runs all endpoint checks every fib(5)=5 minutes.
 * Checks run concurrently per group, groups run sequentially.
 */
class SyntheticMonitor {
  constructor() {
    this._logger  = createLogger({ service: 'synthetic-monitor', version: '3.2.2' });
    this._alertMgr = new AlertManager(this._logger);
    this._timer   = null;
    this._results = new Map(); // id → last result
    this._running = false;
  }

  /**
   * Run a complete check cycle across all endpoints.
   * @returns {Promise<Array<CheckResult>>}
   */
  async runCycle() {
    const cycleStart = performance.now();
    this._logger.info('Synthetic monitor: starting check cycle', {
      endpointCount: ENDPOINTS.length,
      checkIntervalMs: CHECK_INTERVAL_MS,
      fibRef: 'fib(5)=5 minutes',
    });

    // Group endpoints and check each group concurrently
    const groups = {};
    for (const ep of ENDPOINTS) {
      (groups[ep.group] = groups[ep.group] || []).push(ep);
    }

    const allResults = [];
    for (const [group, endpoints] of Object.entries(groups)) {
      // Probe all endpoints in this group concurrently
      const groupResults = await Promise.all(
        endpoints.map(ep => probeWithRetry(ep))
      );
      allResults.push(...groupResults);

      // Log group summary
      const groupFailed = groupResults.filter(r => !r.success).length;
      this._logger.info(`Synthetic check group: ${group}`, {
        group,
        total:  groupResults.length,
        passed: groupResults.length - groupFailed,
        failed: groupFailed,
        p95LatencyMs: percentile(groupResults.map(r => r.latencyMs), 95),
      });
    }

    // Process results through alert manager
    for (const result of allResults) {
      this._results.set(result.id, result);
      this._alertMgr.process(result);
    }

    const cycleDurationMs = Math.round(performance.now() - cycleStart);
    const totalFailed = allResults.filter(r => !r.success).length;
    const slaViolations = allResults.filter(r => r.slaViolation).length;

    this._logger.info('Synthetic monitor: cycle complete', {
      total:         allResults.length,
      passed:        allResults.length - totalFailed,
      failed:        totalFailed,
      slaViolations,
      cycleDurationMs,
      nextCheckInMs: CHECK_INTERVAL_MS,
      phi:           PHI,
    });

    return allResults;
  }

  /** Start the monitor loop. */
  start() {
    if (this._running) return;
    this._running = true;

    this._logger.info('Synthetic monitor started', {
      checkIntervalMs: CHECK_INTERVAL_MS,
      endpointCount:   ENDPOINTS.length,
      failureThreshold: FAILURE_THRESHOLD,
      requestTimeoutMs: REQUEST_TIMEOUT_MS,
      latencyThresholds: LATENCY_THRESHOLDS,
    });

    // Run immediately on start
    this.runCycle().catch(err => this._logger.error('Cycle error', {}, err));

    // Schedule recurring checks every fib(5)=5 minutes
    this._timer = setInterval(() => {
      this.runCycle().catch(err => this._logger.error('Cycle error', {}, err));
    }, CHECK_INTERVAL_MS);

    // Prevent timer from blocking process exit
    if (this._timer.unref) this._timer.unref();
  }

  /** Stop the monitor loop. */
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._running = false;
    this._logger.info('Synthetic monitor stopped');
  }

  /** Get the last result for an endpoint. */
  getResult(id) {
    return this._results.get(id) || null;
  }

  /** Get all current results. */
  getAllResults() {
    return Array.from(this._results.values());
  }

  /** Get summary statistics. */
  getSummary() {
    const results = this.getAllResults();
    const operational = results.filter(r => r.success && !r.slaViolation).length;
    return {
      total:         results.length,
      operational,
      degraded:      results.filter(r => !r.success || r.slaViolation).length,
      overallHealth: results.length > 0 ? operational / results.length : 0,
      phiAligned:    Math.abs((operational / results.length) - (1 / PHI)) < 0.1,
      timestamp:     new Date().toISOString(),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate percentile of a numeric array.
 * @param {number[]} arr
 * @param {number} p - Percentile (0-100).
 * @returns {number}
 */
const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS & MAIN
// ─────────────────────────────────────────────────────────────────────────────

module.exports = { SyntheticMonitor, ENDPOINTS, PHI, FIB, CHECK_INTERVAL_MS, LATENCY_THRESHOLDS };

// Auto-start when run directly
if (require.main === module) {
  const monitor = new SyntheticMonitor();
  monitor.start();

  process.on('SIGTERM', () => { monitor.stop(); process.exit(0); });
  process.on('SIGINT',  () => { monitor.stop(); process.exit(0); });
}
