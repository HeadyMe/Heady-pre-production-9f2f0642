/**
 * external-api-breakers.js
 * Master registry — creates and manages circuit breakers for ALL external services
 * in the Heady platform (heady-systems v3.1.0).
 *
 * @module enterprise-hardening/circuit-breaker/external-api-breakers
 */
'use strict';

const { CircuitBreaker, STATES } = require('../../circuit-breaker');
const { EventEmitter } = require('events');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PHI = 1.618;

/**
 * Canonical service definitions.
 * failureThreshold — consecutive failures before OPEN
 * recoveryTimeout  — ms to wait before probing in HALF_OPEN
 * halfOpenMaxCalls — probe calls allowed in HALF_OPEN before re-evaluating
 */
const SERVICE_CONFIGS = {
  'openai': {
    failureThreshold: 5,
    recoveryTimeout: 30_000,
    halfOpenMaxCalls: 3,
    baseUrl: 'https://api.openai.com/v1',
    healthPath: '/models',
    timeoutMs: 30_000,
  },
  'anthropic': {
    failureThreshold: 5,
    recoveryTimeout: 30_000,
    halfOpenMaxCalls: 3,
    baseUrl: 'https://api.anthropic.com/v1',
    healthPath: '/models',
    timeoutMs: 30_000,
  },
  'google-genai': {
    failureThreshold: 5,
    recoveryTimeout: 30_000,
    halfOpenMaxCalls: 3,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    healthPath: '/models',
    timeoutMs: 30_000,
  },
  'groq': {
    failureThreshold: 3,
    recoveryTimeout: 15_000,
    halfOpenMaxCalls: 2,
    baseUrl: 'https://api.groq.com/openai/v1',
    healthPath: '/models',
    timeoutMs: 20_000,
  },
  'huggingface': {
    failureThreshold: 5,
    recoveryTimeout: 45_000,
    halfOpenMaxCalls: 3,
    baseUrl: 'https://api-inference.huggingface.co',
    healthPath: '/status',
    timeoutMs: 60_000,
  },
  'cloudflare-ai': {
    failureThreshold: 3,
    recoveryTimeout: 20_000,
    halfOpenMaxCalls: 2,
    baseUrl: 'https://api.cloudflare.com/client/v4',
    healthPath: '/user/tokens/verify',
    timeoutMs: 15_000,
  },
  'github-api': {
    failureThreshold: 10,
    recoveryTimeout: 60_000,
    halfOpenMaxCalls: 5,
    baseUrl: 'https://api.github.com',
    healthPath: '/rate_limit',
    timeoutMs: 10_000,
  },
  'postgresql-neon': {
    failureThreshold: 3,
    recoveryTimeout: 10_000,
    halfOpenMaxCalls: 2,
    baseUrl: null,          // TCP, no HTTP health endpoint
    healthPath: null,
    timeoutMs: 5_000,
  },
  'redis': {
    failureThreshold: 3,
    recoveryTimeout: 10_000,
    halfOpenMaxCalls: 2,
    baseUrl: null,
    healthPath: null,
    timeoutMs: 2_000,
  },
  'mcp-sdk': {
    failureThreshold: 5,
    recoveryTimeout: 30_000,
    halfOpenMaxCalls: 3,
    baseUrl: null,
    healthPath: null,
    timeoutMs: 10_000,
  },
};

// ---------------------------------------------------------------------------
// EnhancedCircuitBreaker
// Wraps the base CircuitBreaker and layers on:
//   - call/failure counters
//   - state history ring-buffer (last 100 transitions)
//   - p99 latency tracking (sliding window of last 1 000 samples)
// ---------------------------------------------------------------------------
class EnhancedCircuitBreaker extends EventEmitter {
  /**
   * @param {string} name    Logical service name
   * @param {object} config  SERVICE_CONFIGS entry
   * @param {object} [overrides]  Optional runtime overrides
   */
  constructor(name, config, overrides = {}) {
    super();
    this.name = name;
    this.config = { ...config, ...overrides };

    this._breaker = new CircuitBreaker({
      failureThreshold: this.config.failureThreshold,
      recoveryTimeout:  this.config.recoveryTimeout,
      halfOpenMaxCalls: this.config.halfOpenMaxCalls,
    });

    // Metrics
    this._totalCalls = 0;
    this._totalFailures = 0;
    this._lastFailureTime = null;
    this._lastFailureError = null;

    // State history (ring buffer, max 100 entries)
    this._stateHistory = [];

    // Latency sliding window (max 1 000 samples for p99 calc)
    this._latencySamples = [];
    this._latencyWindowSize = 1_000;

    // Snapshot of previous state for transition detection
    this._prevState = STATES.CLOSED;
  }

  // -------------------------------------------------------------------------
  // Core execute wrapper
  // -------------------------------------------------------------------------
  async execute(fn) {
    const start = Date.now();
    this._totalCalls++;

    try {
      const result = await this._breaker.execute(fn);
      this._recordLatency(Date.now() - start);
      this._checkStateTransition();
      return result;
    } catch (err) {
      this._totalFailures++;
      this._lastFailureTime = Date.now();
      this._lastFailureError = err.message;
      this._recordLatency(Date.now() - start);
      this._checkStateTransition();
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // State transition detection
  // -------------------------------------------------------------------------
  _checkStateTransition() {
    const current = this._breaker.state;
    if (current !== this._prevState) {
      const entry = {
        from: this._prevState,
        to: current,
        at: new Date().toISOString(),
        totalCalls: this._totalCalls,
        totalFailures: this._totalFailures,
      };
      this._stateHistory.push(entry);
      if (this._stateHistory.length > 100) this._stateHistory.shift();
      this._prevState = current;
      this.emit('stateChange', { service: this.name, ...entry });
    }
  }

  // -------------------------------------------------------------------------
  // Latency tracking
  // -------------------------------------------------------------------------
  _recordLatency(ms) {
    this._latencySamples.push(ms);
    if (this._latencySamples.length > this._latencyWindowSize) {
      this._latencySamples.shift();
    }
  }

  /** Returns the p99 latency in milliseconds based on sliding window. */
  get p99LatencyMs() {
    if (this._latencySamples.length === 0) return 0;
    const sorted = [...this._latencySamples].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.99);
    return sorted[Math.min(idx, sorted.length - 1)];
  }

  /** Returns median (p50) latency. */
  get p50LatencyMs() {
    if (this._latencySamples.length === 0) return 0;
    const sorted = [...this._latencySamples].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.5)];
  }

  // -------------------------------------------------------------------------
  // Dashboard snapshot
  // -------------------------------------------------------------------------
  snapshot() {
    const inner = this._breaker.getState();
    return {
      service:          this.name,
      state:            inner.state,
      totalCalls:       this._totalCalls,
      totalFailures:    this._totalFailures,
      currentFailures:  inner.failures,
      successCount:     inner.successes,
      failureThreshold: this.config.failureThreshold,
      recoveryTimeout:  this.config.recoveryTimeout,
      lastFailureTime:  this._lastFailureTime,
      lastFailureError: this._lastFailureError,
      p50LatencyMs:     this.p50LatencyMs,
      p99LatencyMs:     this.p99LatencyMs,
      stateHistory:     [...this._stateHistory],
      isHealthy:        inner.state === STATES.CLOSED,
    };
  }

  // -------------------------------------------------------------------------
  // Delegated helpers
  // -------------------------------------------------------------------------
  get state() { return this._breaker.state; }
  reset() {
    this._breaker.reset();
    this._totalCalls = 0;
    this._totalFailures = 0;
    this._lastFailureTime = null;
    this._lastFailureError = null;
    this._stateHistory = [];
    this._latencySamples = [];
    this._prevState = STATES.CLOSED;
  }
}

// ---------------------------------------------------------------------------
// BreakerRegistry
// ---------------------------------------------------------------------------
class BreakerRegistry extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, EnhancedCircuitBreaker>} */
    this._breakers = new Map();

    // Initialise all canonical services
    for (const [name, cfg] of Object.entries(SERVICE_CONFIGS)) {
      this._register(name, cfg);
    }
  }

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------
  _register(name, config, overrides = {}) {
    const breaker = new EnhancedCircuitBreaker(name, config, overrides);

    // Bubble stateChange events up to the registry
    breaker.on('stateChange', (event) => {
      this.emit('stateChange', event);
    });

    this._breakers.set(name, breaker);
    return breaker;
  }

  /**
   * Returns the EnhancedCircuitBreaker for a named service.
   * Throws if unknown service is requested.
   * @param {string} name
   * @returns {EnhancedCircuitBreaker}
   */
  get(name) {
    const b = this._breakers.get(name);
    if (!b) throw new Error(`No circuit breaker registered for service: "${name}"`);
    return b;
  }

  /**
   * Execute a function through the named service's circuit breaker.
   * @param {string} service
   * @param {Function} fn
   */
  execute(service, fn) {
    return this.get(service).execute(fn);
  }

  // -------------------------------------------------------------------------
  // Dashboard
  // -------------------------------------------------------------------------
  /**
   * Returns all breaker states as a plain JSON-serialisable object.
   * Suitable for direct res.json() in an Express handler.
   */
  dashboard() {
    const breakers = {};
    for (const [name, breaker] of this._breakers.entries()) {
      breakers[name] = breaker.snapshot();
    }

    const states = Object.values(breakers);
    return {
      timestamp: new Date().toISOString(),
      summary: {
        total:    states.length,
        closed:   states.filter(s => s.state === STATES.CLOSED).length,
        open:     states.filter(s => s.state === STATES.OPEN).length,
        halfOpen: states.filter(s => s.state === STATES.HALF_OPEN).length,
      },
      breakers,
    };
  }

  // -------------------------------------------------------------------------
  // Bulk health check
  // -------------------------------------------------------------------------
  /**
   * Probes all services that have a baseUrl + healthPath in parallel.
   * Services without HTTP endpoints (PostgreSQL, Redis, MCP) are reported
   * using their current breaker state only.
   *
   * @param {object} [headers]  Extra headers (e.g. Authorization tokens)
   * @returns {Promise<object>}
   */
  async bulkHealthCheck(headers = {}) {
    const results = await Promise.allSettled(
      [...this._breakers.entries()].map(([name, breaker]) =>
        this._probeService(name, breaker, headers)
      )
    );

    const checks = {};
    let allHealthy = true;

    for (const result of results) {
      const data = result.status === 'fulfilled'
        ? result.value
        : { service: 'unknown', healthy: false, error: String(result.reason) };

      checks[data.service] = data;
      if (!data.healthy) allHealthy = false;
    }

    return {
      timestamp: new Date().toISOString(),
      allHealthy,
      checks,
    };
  }

  async _probeService(name, breaker, headers) {
    const cfg = breaker.config;
    const base = { service: name, state: breaker.state };

    if (!cfg.baseUrl || !cfg.healthPath) {
      // TCP services — report breaker state as health proxy
      return {
        ...base,
        healthy: breaker.state === STATES.CLOSED,
        method: 'breaker-state',
      };
    }

    const url = `${cfg.baseUrl}${cfg.healthPath}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    const start = Date.now();

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', ...headers },
        signal: controller.signal,
      });
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      return {
        ...base,
        healthy: res.status < 500,
        httpStatus: res.status,
        latencyMs,
        method: 'http-probe',
      };
    } catch (err) {
      clearTimeout(timer);
      return {
        ...base,
        healthy: false,
        error: err.message,
        latencyMs: Date.now() - start,
        method: 'http-probe',
      };
    }
  }

  // -------------------------------------------------------------------------
  // Express route handler factories
  // -------------------------------------------------------------------------
  /**
   * Returns an Express handler for GET /api/circuit-breakers
   * Usage: app.get('/api/circuit-breakers', registry.dashboardHandler());
   */
  dashboardHandler() {
    return (_req, res) => {
      res.json(this.dashboard());
    };
  }

  /**
   * Returns an Express handler for GET /api/circuit-breakers/health
   * Performs live HTTP probes of all services.
   */
  healthCheckHandler(authHeaders = {}) {
    return async (_req, res) => {
      try {
        const result = await this.bulkHealthCheck(authHeaders);
        const status = result.allHealthy ? 200 : 207;
        res.status(status).json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    };
  }

  /**
   * Reset a single breaker via POST /api/circuit-breakers/:service/reset
   */
  resetHandler() {
    return (req, res) => {
      const { service } = req.params;
      try {
        this.get(service).reset();
        res.json({ service, reset: true, timestamp: new Date().toISOString() });
      } catch (err) {
        res.status(404).json({ error: err.message });
      }
    };
  }

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------
  /** Register breakers with an Express app under /api/circuit-breakers */
  registerRoutes(app) {
    app.get('/api/circuit-breakers',             this.dashboardHandler());
    app.get('/api/circuit-breakers/health',      this.healthCheckHandler());
    app.post('/api/circuit-breakers/:service/reset', this.resetHandler());
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------
const registry = new BreakerRegistry();

module.exports = {
  registry,
  BreakerRegistry,
  EnhancedCircuitBreaker,
  SERVICE_CONFIGS,
  PHI,
};
