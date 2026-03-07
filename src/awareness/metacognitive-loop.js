/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Metacognitive Self-Awareness Loop
 * Patent Reference: HS-061
 * "Metacognitive Self-Awareness Loop for Autonomous AI Systems with
 *  First-Person Operational State Introspection"
 *
 * Implements ALL 7 patent claims:
 *   Claim 1 — Ring buffer of telemetry events, rolling error rates, confidence
 *              score, natural-language context, prompt injection
 *   Claim 2 — Confidence formula: 1.0 - (errorRate1m * w1) - (errorRate5m * w2)
 *   Claim 3 — Recommendations ("defer to human review", "reduce inference
 *              temperature", "increase monitoring frequency")
 *   Claim 4 — Critical event penalty applied to confidence score
 *   Claim 5 — Configurable ring buffer size with eviction of oldest event
 *   Claim 6 — Multi-domain branding awareness monitoring
 *   Claim 7 — Full system
 *
 * PHI = 1.6180339887
 */

'use strict';

const crypto = require('crypto');
const http   = require('http');
const https  = require('https');

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI = 1.6180339887;

const SEVERITY = Object.freeze({
  INFO:     'info',
  WARN:     'warn',
  ERROR:    'error',
  CRITICAL: 'critical',
});

const ERROR_SEVERITIES = new Set([SEVERITY.ERROR, SEVERITY.CRITICAL]);

/**
 * Default confidence formula weights.
 * RTP: HS-061 Claim 2 — w1=2, w2=0.5
 */
const DEFAULT_WEIGHTS = Object.freeze({
  w1: 2.0,   // 1-minute error rate weight
  w2: 0.5,   // 5-minute error rate weight
});

const DEFAULT_RING_BUFFER_SIZE     = 500;
const DEFAULT_CRITICAL_PENALTY     = 0.1;   // per critical event in last 5 min
const DEFAULT_MAX_CRITICAL_PENALTY = 0.4;   // maximum total critical penalty
const WINDOW_1_MIN_MS              = 60_000;
const WINDOW_5_MIN_MS              = 300_000;

/** Confidence thresholds that govern recommendation generation. */
const CONFIDENCE_THRESHOLDS = Object.freeze({
  HEALTHY:         0.90,  // >= 0.90 → proceed normally
  REDUCE_TEMP:     0.75,  // < 0.90 → reduce inference temperature
  INCREASE_MON:    0.60,  // < 0.75 → increase monitoring
  DEFER_HUMAN:     0.45,  // < 0.60 → defer to human review
  CRITICAL:        0.30,  // < 0.45 → critical — halt high-stakes actions
});

// ─── TelemetryRingBuffer ──────────────────────────────────────────────────────

/**
 * Fixed-size ring buffer of operational telemetry events.
 * When full, the oldest event is evicted (circular overwrite).
 *
 * RTP: HS-061 Claim 1 — "maintaining a ring buffer of operational telemetry events,
 *                        each containing a severity classification and timestamp"
 * RTP: HS-061 Claim 5 — "configurable fixed size and evicts the oldest event when
 *                        full, creating a bounded sliding window of operational memory"
 */
class TelemetryRingBuffer {
  /**
   * @param {number} [size=DEFAULT_RING_BUFFER_SIZE] - Maximum number of events
   */
  constructor(size = DEFAULT_RING_BUFFER_SIZE) {
    if (!Number.isInteger(size) || size < 1) {
      throw new RangeError(`Ring buffer size must be a positive integer, got: ${size}`);
    }
    this._size     = size;
    this._buffer   = new Array(size).fill(null);
    this._head     = 0;   // index of the next write slot
    this._count    = 0;   // total events written (may exceed size)
    this._occupied = 0;   // entries currently in buffer (min(count, size))
  }

  /**
   * Ingest a new telemetry event into the ring buffer.
   * If the buffer is full, the oldest event is silently evicted.
   *
   * RTP: HS-061 Claim 5 — "evicts the oldest event when full"
   *
   * @param {object} event
   * @param {string} event.type      - e.g. 'pipeline_failure', 'api_error', 'successful_inference'
   * @param {string} event.summary   - Human-readable one-line description
   * @param {object} [event.data]    - Structured payload
   * @param {string} event.severity  - SEVERITY constant
   * @param {number} [event.timestamp] - Unix ms (defaults to Date.now())
   * @returns {object} Normalised event as stored
   */
  push(event) {
    const normalised = {
      id:        crypto.randomBytes(4).toString('hex'),
      type:      event.type      || 'unknown',
      summary:   event.summary   || '',
      data:      event.data      || {},
      severity:  event.severity  || SEVERITY.INFO,
      timestamp: event.timestamp || Date.now(),
    };

    this._buffer[this._head] = normalised;
    this._head     = (this._head + 1) % this._size;
    this._count++;
    this._occupied = Math.min(this._count, this._size);

    return normalised;
  }

  /**
   * Return all events currently in the buffer, ordered oldest → newest.
   * @returns {Array<object>}
   */
  toArray() {
    if (this._occupied === 0) return [];

    if (this._count <= this._size) {
      // Buffer not yet full — elements are contiguous from slot 0
      return this._buffer.slice(0, this._occupied).filter(Boolean);
    }

    // Buffer has wrapped — reconstruct chronological order
    const result = [];
    for (let i = 0; i < this._size; i++) {
      const slot = (this._head + i) % this._size;
      if (this._buffer[slot] !== null) result.push(this._buffer[slot]);
    }
    return result;
  }

  /**
   * Return events within a time window ending at `now`.
   * @param {number} windowMs - Window size in milliseconds
   * @param {number} [now=Date.now()]
   * @returns {Array<object>}
   */
  getInWindow(windowMs, now) {
    const cutoff = (now || Date.now()) - windowMs;
    return this.toArray().filter(e => e.timestamp >= cutoff);
  }

  /**
   * Current number of events stored in the buffer.
   * @returns {number}
   */
  get size() { return this._occupied; }

  /**
   * Maximum capacity of the buffer.
   * @returns {number}
   */
  get capacity() { return this._size; }

  /**
   * Total events ever ingested (including evicted ones).
   * @returns {number}
   */
  get totalIngested() { return this._count; }

  /**
   * Ring buffer statistics.
   * @returns {object}
   */
  stats() {
    return {
      capacity:       this._size,
      occupied:       this._occupied,
      totalIngested:  this._count,
      utilizationPct: +(this._occupied / this._size * 100).toFixed(1),
    };
  }
}

// ─── ErrorRateComputer ────────────────────────────────────────────────────────

/**
 * Computes rolling error rates over configurable time windows from a ring buffer.
 *
 * RTP: HS-061 Claim 1 — "computing rolling error rates over configurable time windows"
 * RTP: HS-061 Claim 2 — window-based error rate computation
 */
class ErrorRateComputer {
  /**
   * @param {TelemetryRingBuffer} ringBuffer
   */
  constructor(ringBuffer) {
    this._ringBuffer = ringBuffer;
  }

  /**
   * Compute the error rate within a specific time window.
   * Formula: errors_in_window / total_in_window (or 0 if window is empty).
   *
   * @param {number} windowMs - Window size in milliseconds
   * @param {number} [now=Date.now()]
   * @returns {{ errorRate: number, errorCount: number, totalCount: number }}
   */
  compute(windowMs, now) {
    const nowMs  = now || Date.now();
    const events = this._ringBuffer.getInWindow(windowMs, nowMs);

    const totalCount = events.length;
    const errorCount = events.filter(e => ERROR_SEVERITIES.has(e.severity)).length;
    const errorRate  = totalCount === 0 ? 0 : errorCount / totalCount;

    return { errorRate: +errorRate.toFixed(6), errorCount, totalCount };
  }

  /**
   * Compute error rates for both the 1-minute and 5-minute windows.
   * RTP: HS-061 Claim 1 — "1-minute error rate" and "5-minute error rate"
   *
   * @param {number} [now=Date.now()]
   * @returns {{ rate1m: object, rate5m: object }}
   */
  computeBoth(now) {
    const nowMs = now || Date.now();
    return {
      rate1m: this.compute(WINDOW_1_MIN_MS,  nowMs),
      rate5m: this.compute(WINDOW_5_MIN_MS,  nowMs),
    };
  }

  /**
   * Count critical-severity events within a window.
   * RTP: HS-061 Claim 4 — used for critical event penalty
   *
   * @param {number} [windowMs=WINDOW_5_MIN_MS]
   * @param {number} [now=Date.now()]
   * @returns {number}
   */
  countCritical(windowMs, now) {
    const wMs    = windowMs || WINDOW_5_MIN_MS;
    const nowMs  = now      || Date.now();
    const events = this._ringBuffer.getInWindow(wMs, nowMs);
    return events.filter(e => e.severity === SEVERITY.CRITICAL).length;
  }
}

// ─── StateAssessmentModule ────────────────────────────────────────────────────

/**
 * Computes the first-person confidence score and generates a natural-language
 * context string describing the system's current operational state.
 *
 * RTP: HS-061 Claim 1 — "(c) computing a first-person confidence score" and
 *                        "(d) generating a natural-language context string"
 * RTP: HS-061 Claim 2 — confidence formula
 * RTP: HS-061 Claim 4 — critical event penalty
 */
class StateAssessmentModule {
  /**
   * @param {TelemetryRingBuffer} ringBuffer
   * @param {ErrorRateComputer} errorRateComputer
   * @param {object} [opts]
   * @param {number} [opts.w1]               - Weight for 1m error rate (default: 2.0)
   * @param {number} [opts.w2]               - Weight for 5m error rate (default: 0.5)
   * @param {number} [opts.criticalPenalty]  - Per-event penalty for criticals (default: 0.1)
   * @param {number} [opts.maxCriticalPenalty] - Max total critical penalty (default: 0.4)
   */
  constructor(ringBuffer, errorRateComputer, opts = {}) {
    this._ringBuffer         = ringBuffer;
    this._errorRateComputer  = errorRateComputer;
    this._w1                 = opts.w1                !== undefined ? opts.w1 : DEFAULT_WEIGHTS.w1;
    this._w2                 = opts.w2                !== undefined ? opts.w2 : DEFAULT_WEIGHTS.w2;
    this._criticalPenalty    = opts.criticalPenalty   !== undefined ? opts.criticalPenalty : DEFAULT_CRITICAL_PENALTY;
    this._maxCriticalPenalty = opts.maxCriticalPenalty !== undefined ? opts.maxCriticalPenalty : DEFAULT_MAX_CRITICAL_PENALTY;
    this._assessmentHistory  = [];
  }

  /**
   * Perform a full first-person state assessment.
   *
   * RTP: HS-061 Claim 1(c,d) — full assessment with confidence + natural language
   * RTP: HS-061 Claim 2       — confidence formula
   * RTP: HS-061 Claim 4       — critical event penalty
   *
   * @param {number} [now=Date.now()]
   * @returns {{
   *   confidence: number,
   *   errorRate1m: number,
   *   errorRate5m: number,
   *   criticalCount: number,
   *   criticalPenalty: number,
   *   contextString: string,
   *   recentErrors: Array<object>,
   *   assessedAt: number,
   *   weights: { w1: number, w2: number },
   * }}
   */
  assessSystemState(now) {
    const nowMs  = now || Date.now();
    const { rate1m, rate5m } = this._errorRateComputer.computeBoth(nowMs);

    // RTP: HS-061 Claim 2 — confidence formula
    // confidence = 1.0 − (errorRate1m × w1) − (errorRate5m × w2)
    let confidence = 1.0
      - (rate1m.errorRate * this._w1)
      - (rate5m.errorRate * this._w2);

    // RTP: HS-061 Claim 4 — apply penalty for critical events in last 5 min
    const criticalCount   = this._errorRateComputer.countCritical(WINDOW_5_MIN_MS, nowMs);
    const criticalPenalty = Math.min(
      criticalCount * this._criticalPenalty,
      this._maxCriticalPenalty
    );
    confidence = Math.max(0, Math.min(1, confidence - criticalPenalty));
    confidence = +confidence.toFixed(4);

    // Extract recent errors for the context string
    const recentErrors = this._ringBuffer.getInWindow(WINDOW_5_MIN_MS, nowMs)
      .filter(e => ERROR_SEVERITIES.has(e.severity))
      .slice(-5)
      .map(e => ({ type: e.type, summary: e.summary, severity: e.severity }));

    // RTP: HS-061 Claim 1(d) — natural-language context string
    const contextString = this._buildContextString(
      confidence, rate5m.errorCount, criticalCount, nowMs
    );

    const assessment = {
      confidence,
      errorRate1m:     rate1m.errorRate,
      errorRate5m:     rate5m.errorRate,
      totalEvents1m:   rate1m.totalCount,
      totalEvents5m:   rate5m.totalCount,
      criticalCount,
      criticalPenalty: +criticalPenalty.toFixed(4),
      contextString,
      recentErrors,
      assessedAt:      nowMs,
      weights:         { w1: this._w1, w2: this._w2 },
    };

    this._assessmentHistory.push({
      confidence,
      errorRate1m:  rate1m.errorRate,
      errorRate5m:  rate5m.errorRate,
      criticalCount,
      assessedAt:   nowMs,
    });

    return assessment;
  }

  /**
   * Build a human-readable, first-person context string.
   * @private
   */
  _buildContextString(confidence, errorCount5m, criticalCount, nowMs) {
    const pct = Math.round(confidence * 100);

    if (confidence >= CONFIDENCE_THRESHOLDS.HEALTHY) {
      return `System healthy — ${errorCount5m} error(s) in last 5 minutes, confidence ${confidence.toFixed(2)}`;
    }
    if (confidence >= CONFIDENCE_THRESHOLDS.REDUCE_TEMP) {
      return `System slightly degraded — ${errorCount5m} error(s) and ${criticalCount} critical event(s) in last 5 minutes. Confidence ${confidence.toFixed(2)} (${pct}%). Operating with reduced certainty.`;
    }
    if (confidence >= CONFIDENCE_THRESHOLDS.INCREASE_MON) {
      return `System under stress — ${errorCount5m} error(s) detected. Confidence at ${confidence.toFixed(2)} (${pct}%). Elevated monitoring recommended.`;
    }
    if (confidence >= CONFIDENCE_THRESHOLDS.DEFER_HUMAN) {
      return `System reliability compromised — confidence ${confidence.toFixed(2)} (${pct}%). ${criticalCount} critical event(s) recorded. Human oversight strongly advised for high-stakes operations.`;
    }
    return `CRITICAL: System severely degraded — confidence ${confidence.toFixed(2)} (${pct}%). ${errorCount5m} error(s), ${criticalCount} critical event(s). Halting autonomous high-stakes actions.`;
  }

  /**
   * Return assessment history.
   * @param {number} [limit=50]
   * @returns {Array<object>}
   */
  getHistory(limit = 50) {
    return this._assessmentHistory.slice(-limit);
  }
}

// ─── RecommendationEngine ─────────────────────────────────────────────────────

/**
 * Generates operational recommendations based on the current confidence score.
 *
 * RTP: HS-061 Claim 3 — "generating one or more operational recommendations
 *                        based on the confidence score, including at least one of:
 *                        'defer to human review', 'reduce inference temperature',
 *                        or 'increase monitoring frequency'"
 */
class RecommendationEngine {
  /**
   * Generate recommendations from an assessment object.
   * RTP: HS-061 Claim 3
   *
   * @param {object} assessment - Output of StateAssessmentModule.assessSystemState()
   * @returns {Array<{ code: string, message: string, priority: string }>}
   */
  generateRecommendations(assessment) {
    const { confidence, criticalCount, errorRate1m, errorRate5m } = assessment;
    const recommendations = [];

    if (confidence < CONFIDENCE_THRESHOLDS.DEFER_HUMAN) {
      // RTP: HS-061 Claim 3 — "defer to human review"
      recommendations.push({
        code:     'DEFER_TO_HUMAN_REVIEW',
        message:  'Defer to human review — system confidence is critically low. Do not execute autonomous high-stakes actions.',
        priority: 'critical',
      });
    }

    if (confidence < CONFIDENCE_THRESHOLDS.HEALTHY && confidence >= CONFIDENCE_THRESHOLDS.DEFER_HUMAN) {
      // RTP: HS-061 Claim 3 — "reduce inference temperature"
      // Fires for any confidence below the HEALTHY threshold (0.90) down to DEFER_HUMAN (0.45)
      recommendations.push({
        code:     'REDUCE_INFERENCE_TEMPERATURE',
        message:  'Reduce inference temperature — elevated error rate detected. Generate more conservative (lower-temperature) responses.',
        priority: 'high',
      });
    }

    if (confidence < CONFIDENCE_THRESHOLDS.INCREASE_MON) {
      // RTP: HS-061 Claim 3 — "increase monitoring frequency"
      recommendations.push({
        code:     'INCREASE_MONITORING_FREQUENCY',
        message:  'Increase monitoring frequency — confidence below 60%. Shorten telemetry poll intervals and alert thresholds.',
        priority: 'high',
      });
    }

    if (criticalCount > 0) {
      recommendations.push({
        code:     'CRITICAL_EVENT_REVIEW',
        message:  `Review ${criticalCount} critical event(s) recorded in the last 5 minutes before proceeding.`,
        priority: 'critical',
      });
    }

    if (errorRate1m > 0.2) {
      recommendations.push({
        code:     'HIGH_1M_ERROR_RATE',
        message:  `1-minute error rate is ${(errorRate1m * 100).toFixed(1)}% — pause non-essential operations until rate normalises.`,
        priority: 'high',
      });
    }

    if (confidence >= CONFIDENCE_THRESHOLDS.HEALTHY) {
      recommendations.push({
        code:     'PROCEED_NORMALLY',
        message:  'Proceed with standard confidence — system operational state is healthy.',
        priority: 'info',
      });
    }

    return recommendations;
  }
}

// ─── PromptInjectionModule ────────────────────────────────────────────────────

/**
 * Formats confidence assessment output and injects it into AI inference prompts
 * as a system context block.
 *
 * RTP: HS-061 Claim 1(e) — "injecting said confidence score and context string
 *                           into subsequent AI inference prompts as system context"
 */
class PromptInjectionModule {
  /**
   * @param {StateAssessmentModule} assessmentModule
   * @param {RecommendationEngine} recommendationEngine
   */
  constructor(assessmentModule, recommendationEngine) {
    this._assessmentModule    = assessmentModule;
    this._recommendationEngine = recommendationEngine;
  }

  /**
   * Generate the self-assessment system context block for prompt injection.
   * RTP: HS-061 Claim 1(e)
   *
   * @param {object} [opts]
   * @param {boolean} [opts.includeRecommendations=true]
   * @param {boolean} [opts.includeRecentErrors=true]
   * @returns {string} The formatted context block to prepend to any AI prompt
   */
  buildContextBlock(opts = {}) {
    const { includeRecommendations = true, includeRecentErrors = true } = opts;
    const assessment      = this._assessmentModule.assessSystemState();
    const recommendations = includeRecommendations
      ? this._recommendationEngine.generateRecommendations(assessment)
      : [];

    const lines = [
      '[System Self-Assessment]',
      `Confidence: ${assessment.confidence.toFixed(2)}`,
      `Recent errors (1m): ${assessment.totalEvents1m > 0 ? Math.round(assessment.errorRate1m * 100) : 0}% (${assessment.errorRate1m > 0 ? Math.round(assessment.errorRate1m * assessment.totalEvents1m) : 0} of ${assessment.totalEvents1m} events)`,
      `Recent errors (5m): ${Math.round(assessment.errorRate5m * 100)}% (${assessment.errorRate5m > 0 ? Math.round(assessment.errorRate5m * assessment.totalEvents5m) : 0} of ${assessment.totalEvents5m} events)`,
      `Critical events (5m): ${assessment.criticalCount}`,
      `State: ${assessment.contextString}`,
    ];

    if (includeRecommendations && recommendations.length > 0) {
      lines.push(`Recommendation: ${recommendations[0].message}`);
      if (recommendations.length > 1) {
        lines.push(`Additional: ${recommendations.slice(1).map(r => r.code).join(', ')}`);
      }
    }

    if (includeRecentErrors && assessment.recentErrors.length > 0) {
      lines.push(`Recent error types: ${assessment.recentErrors.map(e => e.type).join(', ')}`);
    }

    lines.push('[End Self-Assessment]');
    return lines.join('\n');
  }

  /**
   * Inject the self-assessment context block into a prompt string.
   * Prepends the block as a system context prefix.
   *
   * RTP: HS-061 Claim 1(e)
   *
   * @param {string} prompt - The original AI inference prompt
   * @param {object} [opts]
   * @returns {string} The augmented prompt with self-assessment context
   */
  injectIntoPrompt(prompt, opts = {}) {
    const contextBlock = this.buildContextBlock(opts);
    return `${contextBlock}\n\n${prompt}`;
  }

  /**
   * Return a structured injection payload (for non-string prompt formats).
   *
   * @param {object} [opts]
   * @returns {{ role: string, content: string }}
   */
  buildSystemMessage(opts = {}) {
    return {
      role:    'system',
      content: this.buildContextBlock(opts),
    };
  }
}

// ─── BrandingMonitor ──────────────────────────────────────────────────────────

/**
 * Monitors the system's external digital presence across multiple domains —
 * checking HTTP responsiveness and branding element presence.
 *
 * RTP: HS-061 Claim 6 — "multi-domain branding awareness monitoring that scans
 *                        registered domains for HTTP responsiveness and branding
 *                        element presence, integrating brand health into the
 *                        system introspection report"
 */
class BrandingMonitor {
  /**
   * @param {object} [opts]
   * @param {number} [opts.timeoutMs=5000] - HTTP request timeout
   */
  constructor(opts = {}) {
    this._domains     = new Map();
    this._timeoutMs   = opts.timeoutMs || 5000;
    this._checkHistory = [];
  }

  /**
   * Register a domain for branding health monitoring.
   * RTP: HS-061 Claim 6
   *
   * @param {string} domainId      - Internal identifier
   * @param {string} url           - URL to check
   * @param {string[]} [brandingElements=[]] - Substrings to verify are present in response
   * @returns {object} Registered domain descriptor
   */
  registerDomain(domainId, url, brandingElements = []) {
    const descriptor = {
      id:               domainId,
      url,
      brandingElements,
      lastChecked:      null,
      lastStatus:       'unknown',
      lastStatusCode:   null,
      lastLatencyMs:    null,
      brandingFound:    [],
      brandingMissing:  [],
      errorCount:       0,
      checkCount:       0,
    };
    this._domains.set(domainId, descriptor);
    return descriptor;
  }

  /**
   * Perform an HTTP health check for a single registered domain.
   * RTP: HS-061 Claim 6 — "scanning each registered domain for HTTP responsiveness
   *                        and verifying branding elements"
   *
   * @param {string} domainId
   * @returns {Promise<object>}
   */
  async checkDomain(domainId) {
    const descriptor = this._domains.get(domainId);
    if (!descriptor) throw new Error(`Domain not registered: ${domainId}`);

    const start = Date.now();
    let statusCode = null;
    let body       = '';
    let error      = null;

    try {
      body       = await this._httpGet(descriptor.url);
      statusCode = 200; // If no throw, assume 200-class
    } catch (err) {
      error      = err.message;
      statusCode = null;
    }

    const latency = Date.now() - start;

    // Check branding elements
    const brandingFound   = [];
    const brandingMissing = [];

    for (const element of descriptor.brandingElements) {
      if (body.includes(element)) {
        brandingFound.push(element);
      } else {
        brandingMissing.push(element);
      }
    }

    const status = error
      ? 'down'
      : brandingMissing.length > 0
        ? 'degraded'
        : 'healthy';

    descriptor.lastChecked     = Date.now();
    descriptor.lastStatus      = status;
    descriptor.lastStatusCode  = statusCode;
    descriptor.lastLatencyMs   = latency;
    descriptor.brandingFound   = brandingFound;
    descriptor.brandingMissing = brandingMissing;
    descriptor.checkCount++;
    if (error) descriptor.errorCount++;

    const result = {
      domainId, url: descriptor.url, status, statusCode,
      latencyMs: latency, brandingFound, brandingMissing, error,
      checkedAt: descriptor.lastChecked,
    };

    this._checkHistory.push(result);
    return result;
  }

  /**
   * Check all registered domains.
   * RTP: HS-061 Claim 6
   *
   * @returns {Promise<Array<object>>}
   */
  async checkAll() {
    const results = await Promise.allSettled(
      Array.from(this._domains.keys()).map(id => this.checkDomain(id))
    );
    return results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message });
  }

  /**
   * Build a brand health report for integration into the system introspection report.
   * RTP: HS-061 Claim 6 — "integrating brand health into the system introspection report"
   *
   * @returns {object}
   */
  brandHealthReport() {
    const domains = Array.from(this._domains.values());
    const healthy = domains.filter(d => d.lastStatus === 'healthy').length;
    const total   = domains.length;

    return {
      totalDomains:   total,
      healthyDomains: healthy,
      healthRatio:    total > 0 ? +(healthy / total).toFixed(3) : 1,
      domains: domains.map(d => ({
        id:            d.id,
        url:           d.url,
        status:        d.lastStatus,
        lastChecked:   d.lastChecked,
        latencyMs:     d.lastLatencyMs,
        brandingFound: d.brandingFound,
        brandingMissing: d.brandingMissing,
        checkCount:    d.checkCount,
        errorCount:    d.errorCount,
      })),
    };
  }

  /**
   * Deregister a domain.
   * @param {string} domainId
   * @returns {boolean}
   */
  deregisterDomain(domainId) {
    return this._domains.delete(domainId);
  }

  /**
   * Minimal HTTP GET helper (no external dependencies).
   * @private
   */
  _httpGet(url) {
    return new Promise((resolve, reject) => {
      const lib     = url.startsWith('https') ? https : http;
      const timeout = setTimeout(() => reject(new Error('timeout')), this._timeoutMs);

      lib.get(url, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          clearTimeout(timeout);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}`));
          } else {
            resolve(data);
          }
        });
      }).on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }
}

// ─── MetacognitiveLoop ────────────────────────────────────────────────────────

/**
 * Full Metacognitive Self-Awareness Loop — composes all modules into the
 * complete HS-061 system.
 *
 * RTP: HS-061 Claim 7 — Full system comprising:
 *   (a) telemetry ring buffer
 *   (b) error rate computation module
 *   (c) state assessment module
 *   (d) prompt injection module
 *   (e) recommendation engine
 * Plus Claim 6: BrandingMonitor
 */
class MetacognitiveLoop {
  /**
   * @param {object} [opts]
   * @param {number} [opts.ringBufferSize]     - Ring buffer capacity (default: 500)
   * @param {number} [opts.w1]                 - 1m error rate weight (default: 2.0)
   * @param {number} [opts.w2]                 - 5m error rate weight (default: 0.5)
   * @param {number} [opts.criticalPenalty]    - Per-critical-event penalty
   * @param {number} [opts.maxCriticalPenalty] - Max total critical penalty
   */
  constructor(opts = {}) {
    // (a) Telemetry ring buffer — RTP: HS-061 Claim 5
    this.ringBuffer = new TelemetryRingBuffer(opts.ringBufferSize || DEFAULT_RING_BUFFER_SIZE);

    // (b) Error rate computer — RTP: HS-061 Claim 1
    this.errorRateComputer = new ErrorRateComputer(this.ringBuffer);

    // (c) State assessment — RTP: HS-061 Claim 2, 4
    this.stateAssessment = new StateAssessmentModule(this.ringBuffer, this.errorRateComputer, {
      w1:                opts.w1,
      w2:                opts.w2,
      criticalPenalty:   opts.criticalPenalty,
      maxCriticalPenalty: opts.maxCriticalPenalty,
    });

    // (e) Recommendation engine — RTP: HS-061 Claim 3
    this.recommendationEngine = new RecommendationEngine();

    // (d) Prompt injection module — RTP: HS-061 Claim 1(e)
    this.promptInjection = new PromptInjectionModule(this.stateAssessment, this.recommendationEngine);

    // Claim 6 — branding monitor
    this.brandingMonitor = new BrandingMonitor(opts.brandingOpts || {});

    this._createdAt = Date.now();
  }

  /**
   * Ingest a telemetry event into the ring buffer.
   * @param {object} event
   * @returns {object} Normalised event
   */
  ingest(event) {
    return this.ringBuffer.push(event);
  }

  /**
   * Assess the system's current state (confidence score + context + recommendations).
   * This is the primary entry point before any high-stakes decision.
   *
   * @returns {{ assessment: object, recommendations: Array }}
   */
  assess() {
    const assessment      = this.stateAssessment.assessSystemState();
    const recommendations = this.recommendationEngine.generateRecommendations(assessment);
    return { assessment, recommendations };
  }

  /**
   * Inject self-awareness context into an AI inference prompt.
   * RTP: HS-061 Claim 1(e)
   *
   * @param {string} prompt
   * @param {object} [opts]
   * @returns {string}
   */
  injectPrompt(prompt, opts) {
    return this.promptInjection.injectIntoPrompt(prompt, opts);
  }

  /**
   * Full system status report including branding health.
   * RTP: HS-061 Claim 6 — integrating brand health
   *
   * @returns {object}
   */
  fullReport() {
    const { assessment, recommendations } = this.assess();
    return {
      confidence:       assessment.confidence,
      contextString:    assessment.contextString,
      errorRate1m:      assessment.errorRate1m,
      errorRate5m:      assessment.errorRate5m,
      criticalCount:    assessment.criticalCount,
      recommendations,
      ringBuffer:       this.ringBuffer.stats(),
      branding:         this.brandingMonitor.brandHealthReport(),
      phi:              PHI,
      assessedAt:       assessment.assessedAt,
    };
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Core classes
  TelemetryRingBuffer,
  ErrorRateComputer,
  StateAssessmentModule,
  PromptInjectionModule,
  RecommendationEngine,
  BrandingMonitor,
  MetacognitiveLoop,

  // Constants
  PHI,
  SEVERITY,
  CONFIDENCE_THRESHOLDS,
  DEFAULT_WEIGHTS,
  DEFAULT_RING_BUFFER_SIZE,
  WINDOW_1_MIN_MS,
  WINDOW_5_MIN_MS,
};
