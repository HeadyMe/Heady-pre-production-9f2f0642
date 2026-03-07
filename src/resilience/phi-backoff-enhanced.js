/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
// RTP: Phi-Exponential Backoff with Sacred Geometry Timing

'use strict';

const PHI = 1.6180339887;

// Sacred geometry interval multipliers
const SACRED_MULTIPLIERS = {
  phi:     PHI,                        // 1.618...
  sqrt2:   Math.SQRT2,                 // 1.414...
  sqrt3:   Math.sqrt(3),               // 1.732...
  pi:      Math.PI,                    // 3.141...
  e:       Math.E,                     // 2.718...
  sqrt5:   Math.sqrt(5),               // 2.236...
  phi2:    PHI * PHI,                  // 2.618...
  phiInv:  1 / PHI,                    // 0.618...
};

// ─── CircuitBreaker ───────────────────────────────────────────────────────────

const CB_CLOSED    = 'closed';
const CB_OPEN      = 'open';
const CB_HALF_OPEN = 'half_open';

class CircuitBreaker {
  /**
   * Classic circuit breaker with φ-scaled recovery timing.
   */
  constructor(opts = {}) {
    this._failureThreshold  = opts.failureThreshold  || 5;
    this._successThreshold  = opts.successThreshold  || 2;
    this._halfOpenTimeout   = opts.halfOpenTimeoutMs  || 30000;
    this._state             = CB_CLOSED;
    this._failures          = 0;
    this._successes         = 0;
    this._lastFailureTs     = null;
    this._lastStateChange   = Date.now();
    this._openedAt          = null;
    this._callbacks         = { open: [], close: [], halfOpen: [] };
    this._stats             = { total: 0, successes: 0, failures: 0, rejections: 0, trips: 0 };
  }

  get state() { return this._state; }

  /**
   * Check if the circuit allows a request.
   */
  canProceed() {
    if (this._state === CB_CLOSED)    return true;
    if (this._state === CB_OPEN) {
      const elapsed = Date.now() - this._openedAt;
      // φ-modulated: recovery time increases by φ on repeated failures
      const timeout = this._halfOpenTimeout * Math.pow(PHI, this._stats.trips - 1);
      if (elapsed >= Math.min(timeout, 300000)) {
        this._transition(CB_HALF_OPEN);
        return true;
      }
      return false;
    }
    return true; // HALF_OPEN: allow probe
  }

  /**
   * Record a success.
   */
  recordSuccess() {
    this._stats.total++;
    this._stats.successes++;
    this._failures = 0;

    if (this._state === CB_HALF_OPEN) {
      this._successes++;
      if (this._successes >= this._successThreshold) {
        this._transition(CB_CLOSED);
      }
    }
  }

  /**
   * Record a failure.
   */
  recordFailure(err) {
    this._stats.total++;
    this._stats.failures++;
    this._failures++;
    this._lastFailureTs = Date.now();
    this._successes = 0;

    if (this._state === CB_HALF_OPEN || this._failures >= this._failureThreshold) {
      this._transition(CB_OPEN);
    }
  }

  _transition(newState) {
    const old = this._state;
    this._state         = newState;
    this._lastStateChange = Date.now();

    if (newState === CB_OPEN) {
      this._openedAt = Date.now();
      this._stats.trips++;
      for (const fn of this._callbacks.open) fn(old, newState);
    } else if (newState === CB_CLOSED) {
      this._openedAt  = null;
      this._failures  = 0;
      this._successes = 0;
      for (const fn of this._callbacks.close) fn(old, newState);
    } else if (newState === CB_HALF_OPEN) {
      this._successes = 0;
      for (const fn of this._callbacks.halfOpen) fn(old, newState);
    }
  }

  /**
   * Wrap an async function with circuit breaker protection.
   */
  async execute(fn) {
    if (!this.canProceed()) {
      this._stats.rejections++;
      const err = new Error(`Circuit breaker is OPEN (${this._stats.trips} trips). Retry after ${Math.round((this._halfOpenTimeout - (Date.now() - this._openedAt)) / 1000)}s`);
      err.code = 'CIRCUIT_OPEN';
      throw err;
    }
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure(err);
      throw err;
    }
  }

  onOpen(fn)     { this._callbacks.open.push(fn);     return this; }
  onClose(fn)    { this._callbacks.close.push(fn);    return this; }
  onHalfOpen(fn) { this._callbacks.halfOpen.push(fn); return this; }

  reset() {
    this._state    = CB_CLOSED;
    this._failures = 0;
    this._successes = 0;
    this._openedAt  = null;
    return this;
  }

  getStats() {
    return {
      state:            this._state,
      failures:         this._failures,
      successes:        this._successes,
      openedAt:         this._openedAt,
      lastStateChange:  this._lastStateChange,
      ...this._stats,
    };
  }
}

// ─── BackpressureDetector ─────────────────────────────────────────────────────

class BackpressureDetector {
  /**
   * Detect backpressure by monitoring queue depth and response latency.
   */
  constructor(opts = {}) {
    this._maxQueueDepth = opts.maxQueueDepth || 100;
    this._latencyWindow = opts.latencyWindowMs || 10000;
    this._latencyThresh = opts.latencyThresholdMs || 2000;
    this._latencies     = [];
    this._queueDepth    = 0;
  }

  recordLatency(ms) {
    const now = Date.now();
    this._latencies.push({ ms, ts: now });
    // Trim window
    this._latencies = this._latencies.filter(l => now - l.ts < this._latencyWindow);
    return this;
  }

  setQueueDepth(depth) { this._queueDepth = depth; return this; }

  /**
   * Returns a backpressure signal in [0, 1].
   * 0 = no pressure, 1 = maximum pressure.
   */
  getPressure() {
    const queuePressure = Math.min(1, this._queueDepth / this._maxQueueDepth);

    let latencyPressure = 0;
    if (this._latencies.length > 0) {
      const avgLatency = this._latencies.reduce((s, l) => s + l.ms, 0) / this._latencies.length;
      latencyPressure  = Math.min(1, avgLatency / this._latencyThresh);
    }

    // φ-weighted combination: each component weighted by 1/φ ≈ 0.618
    return Math.min(1, queuePressure * (1 / PHI) + latencyPressure * (1 / PHI));
  }

  isUnderPressure() { return this.getPressure() > 0.5; }
  getAvgLatency() {
    if (this._latencies.length === 0) return 0;
    return this._latencies.reduce((s, l) => s + l.ms, 0) / this._latencies.length;
  }
}

// ─── HealthMonitor ────────────────────────────────────────────────────────────

class HealthMonitor {
  /**
   * Track health score of a downstream dependency.
   * Health-aware retry: skip retries if health < threshold.
   */
  constructor(opts = {}) {
    this._score      = opts.initialScore || 1.0;
    this._minScore   = opts.minHealthScore || 0.2;
    this._window     = opts.windowSize || 20;
    this._results    = [];
    this._decayAlpha = opts.decayAlpha || 1 / PHI;
  }

  /**
   * Record the outcome of a call.
   */
  record(success, latencyMs = 0) {
    this._results.push({ success, latencyMs, ts: Date.now() });
    if (this._results.length > this._window) this._results.shift();

    // Exponential moving average
    const signal = success ? 1.0 : 0.0;
    this._score  = this._score * (1 - this._decayAlpha) + signal * this._decayAlpha;
    return this;
  }

  /**
   * Returns health score in [0, 1].
   */
  getScore() { return this._score; }

  isHealthy(threshold = null) {
    return this._score >= (threshold || this._minScore);
  }

  getSuccessRate() {
    if (this._results.length === 0) return 1;
    return this._results.filter(r => r.success).length / this._results.length;
  }

  getAvgLatency() {
    if (this._results.length === 0) return 0;
    return this._results.reduce((s, r) => s + r.latencyMs, 0) / this._results.length;
  }

  reset() { this._score = 1.0; this._results = []; return this; }
}

// ─── Core phi delay ───────────────────────────────────────────────────────────

function normalizePositiveNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

/**
 * Compute a φ-exponential delay with sacred geometry timing.
 * @param {number} attempt - 0-indexed attempt number
 * @param {number} baseMs - base delay
 * @param {number} maxMs - cap
 * @param {number} jitterFactor - randomness fraction
 * @param {string} geometry - which sacred multiplier to use ('phi' default)
 */
function phiDelay(attempt, baseMs = 1000, maxMs = 30000, jitterFactor = 0.25, geometry = 'phi') {
  const safeAttempt   = Math.max(0, Math.floor(Number(attempt) || 0));
  const safeBaseMs    = normalizePositiveNumber(baseMs, 1000);
  const safeMaxMs     = Math.max(1, Math.floor(normalizePositiveNumber(maxMs, 30000)));
  const safeJitter    = Math.min(1, Math.max(0, Number(jitterFactor) || 0));
  const multiplier    = SACRED_MULTIPLIERS[geometry] || PHI;

  const raw    = safeBaseMs * Math.pow(multiplier, safeAttempt);
  const jitter = raw * safeJitter * (2 * Math.random() - 1);
  const delayed = Math.round(raw + jitter);

  return Math.max(1, Math.min(delayed, safeMaxMs));
}

/**
 * Thundering herd prevention: spread retries across a time window.
 * Multiple callers will get different retry times within [0, windowMs].
 */
function thunderingHerdJitter(baseDelayMs, windowMs = 1000) {
  // Stagger: random offset within window, but φ-distributed not uniform
  const phi_rand = (Math.random() + Math.random() / PHI + Math.random() / (PHI * PHI)) / (1 + 1 / PHI + 1 / (PHI * PHI));
  return Math.round(baseDelayMs + phi_rand * windowMs);
}

// ─── EnhancedBackoff ──────────────────────────────────────────────────────────

class EnhancedBackoff {
  constructor(opts = {}) {
    this._baseMs          = opts.baseMs           || 1000;
    this._maxMs           = opts.maxDelayMs        || 30000;
    this._maxRetries      = opts.maxRetries         || 5;
    this._jitterFactor    = opts.jitterFactor       || 0.25;
    this._geometry        = opts.geometry           || 'phi';
    this._herdWindowMs    = opts.herdWindowMs       || 500;
    this._healthThreshold = opts.healthThreshold    || 0.3;
    this._onRetry         = opts.onRetry            || null;
    this._onGiveUp        = opts.onGiveUp           || null;
    this._shouldRetry     = opts.shouldRetry        || (() => true);

    this._circuitBreaker  = opts.circuitBreaker     || null;
    this._backpressure    = opts.backpressureDetector || null;
    this._health          = opts.healthMonitor       || null;

    this._attempt         = 0;
    this._lastError       = null;
  }

  /**
   * Get the delay for the current attempt, applying all modifiers.
   */
  getDelay(attempt) {
    let delay = phiDelay(attempt, this._baseMs, this._maxMs, this._jitterFactor, this._geometry);

    // Thundering herd prevention
    delay = thunderingHerdJitter(delay, this._herdWindowMs);
    delay = Math.min(delay, this._maxMs);

    // Backpressure: increase delay proportional to pressure
    if (this._backpressure) {
      const pressure = this._backpressure.getPressure();
      if (pressure > 0.5) delay = Math.round(delay * (1 + pressure));
    }

    return Math.max(1, Math.min(delay, this._maxMs));
  }

  /**
   * Execute fn with full enhanced backoff.
   */
  async execute(fn) {
    const safeRetries = Math.max(0, Math.floor(Number(this._maxRetries) || 0));
    let lastError;

    for (let attempt = 0; attempt <= safeRetries; attempt++) {
      // Health check: if health is too low, skip retry
      if (attempt > 0 && this._health && !this._health.isHealthy(this._healthThreshold)) {
        const healthErr = new Error(`Skipping retry: health score ${this._health.getScore().toFixed(3)} < threshold ${this._healthThreshold}`);
        healthErr.code = 'HEALTH_BELOW_THRESHOLD';
        if (this._onGiveUp) this._onGiveUp(healthErr, attempt);
        throw healthErr;
      }

      // Circuit breaker
      const execFn = async () => {
        const start  = Date.now();
        try {
          const result = await fn(attempt);
          if (this._health)  this._health.record(true, Date.now() - start);
          if (this._backpressure) this._backpressure.recordLatency(Date.now() - start);
          return result;
        } catch (err) {
          if (this._health)  this._health.record(false, Date.now() - start);
          throw err;
        }
      };

      try {
        if (this._circuitBreaker) {
          return await this._circuitBreaker.execute(execFn);
        }
        return await execFn();
      } catch (err) {
        lastError = err;

        // Don't retry if circuit is open
        if (err.code === 'CIRCUIT_OPEN') {
          if (this._onGiveUp) this._onGiveUp(err, attempt);
          throw err;
        }

        if (!this._shouldRetry(err)) throw err;
        if (attempt >= safeRetries) break;

        const delay = this.getDelay(attempt);
        if (this._onRetry) this._onRetry(attempt + 1, delay, err);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (this._onGiveUp) this._onGiveUp(lastError, safeRetries + 1);
    throw lastError;
  }
}

/**
 * Convenience wrapper: create and run enhanced backoff.
 */
async function withEnhancedBackoff(fn, opts = {}) {
  const eb = new EnhancedBackoff(opts);
  return eb.execute(fn);
}

/**
 * Generate a delay table showing φ-scaled intervals.
 */
function delayTable(maxAttempts = 8, baseMs = 1000, geometry = 'phi') {
  const safeAttempts = Math.max(0, Math.floor(Number(maxAttempts) || 0));
  const safeBaseMs   = normalizePositiveNumber(baseMs, 1000);
  const multiplier   = SACRED_MULTIPLIERS[geometry] || PHI;

  return Array.from({ length: safeAttempts }, (_, i) => {
    const raw = Math.round(safeBaseMs * Math.pow(multiplier, i));
    return {
      attempt:  i,
      delayMs:  raw,
      delaySec: +(raw / 1000).toFixed(2),
      formula:  `${safeBaseMs} × ${geometry}^${i}`,
      geometry,
      multiplier: +multiplier.toFixed(6),
    };
  });
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  PHI,
  SACRED_MULTIPLIERS,
  CB_CLOSED,
  CB_OPEN,
  CB_HALF_OPEN,
  normalizePositiveNumber,
  phiDelay,
  thunderingHerdJitter,
  CircuitBreaker,
  BackpressureDetector,
  HealthMonitor,
  EnhancedBackoff,
  withEnhancedBackoff,
  delayTable,
};
