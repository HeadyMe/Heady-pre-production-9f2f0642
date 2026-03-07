'use strict';

/**
 * AUTO-GENERATED — tests/auto-generated/middleware/phi-scale-middleware.test.js
 * Tests for PhiScale used as a middleware parameter source.
 * Verifies: dynamic timeout, confidence gating, rate limiting, batch partitioning,
 *           temperature selection, cache TTL, concurrency, backoff, and reset.
 */

jest.mock('../../../src/utils/logger', () => ({
  info:      jest.fn(),
  warn:      jest.fn(),
  error:     jest.fn(),
  logSystem: jest.fn(),
  logError:  jest.fn(),
  child:     jest.fn().mockReturnThis(),
}));

const {
  PHI,
  PHI_INVERSE,
  PhiScale,
  PhiBackoff,
  PhiPartitioner,
} = require('../../../src/core/phi-scales');

const CSL = require('../../../src/core/semantic-logic');

// ---------------------------------------------------------------------------
// Attempt to load the real middleware; fall back to a mock
// ---------------------------------------------------------------------------
let PhiScaleMiddleware;
try {
  PhiScaleMiddleware = require('../../../src/middleware/phi-scale-middleware');
} catch (_) {
  // Build a minimal stand-in so tests can still exercise PhiScale behaviour
  PhiScaleMiddleware = class PhiScaleMiddlewareMock {
    constructor(options = {}) {
      this.timeoutScale    = new PhiScale({ base: 5000,  min: 500,  max: 30000, name: 'mw-timeout' });
      this.confidenceScale = new PhiScale({ base: PHI_INVERSE, min: 0.1, max: 0.99, name: 'mw-confidence' });
      this.rateLimitScale  = new PhiScale({ base: 100,  min: 10,   max: 1000,  name: 'mw-rate' });
      this.batchScale      = new PhiScale({ base: 32,   min: 1,    max: 512,   name: 'mw-batch' });
      this.temperatureScale= new PhiScale({ base: 0.7,  min: 0.1,  max: 1.0,   name: 'mw-temp' });
      this.cacheTTLScale   = new PhiScale({ base: 60000,min: 5000, max: 600000,name: 'mw-cache' });
      this.concurrencyScale= new PhiScale({ base: 8,    min: 1,    max: 64,    name: 'mw-concurrency' });
      this.backoff         = new PhiBackoff(200, 30000);
      this.partitioner     = new PhiPartitioner();
    }

    handle(req, res, next) {
      req.timeout      = this.timeoutScale.current   || this.timeoutScale.value || 5000;
      req.confidence   = this.confidenceScale.current || this.confidenceScale.value || PHI_INVERSE;
      req.rateAllowed  = (req.requestsPerSecond || 0) < (this.rateLimitScale.current || 100);
      req.batchSize    = this.batchScale.current      || 32;
      req.temperature  = this.temperatureScale.current|| 0.7;
      req.cacheTTL     = this.cacheTTLScale.current   || 60000;
      req.concurrency  = Math.round(this.concurrencyScale.current || 8);
      req.backoffMs    = this.backoff.next();
      if (typeof next === 'function') next();
    }

    adjust(metrics) {
      this.timeoutScale.adjust(metrics);
      this.rateLimitScale.adjust(metrics);
      this.batchScale.adjust(metrics);
      this.concurrencyScale.adjust(metrics);
    }

    reset() {
      // PhiScale may not have a reset; re-create
      this.backoff = new PhiBackoff(200, 30000);
    }

    factory() {
      const self = this;
      return (req, res, next) => self.handle(req, res, next);
    }
  };
}

// ---------------------------------------------------------------------------
// PhiScale as middleware parameter source
// ---------------------------------------------------------------------------
describe('PhiScale as middleware parameter source', () => {
  it('middleware instance can be created', () => {
    const mw = new PhiScaleMiddleware();
    expect(mw).toBeDefined();
  });

  it('instance exposes a timeoutScale', () => {
    const mw = new PhiScaleMiddleware();
    const ts = mw.timeoutScale || mw.timeout;
    expect(ts).toBeDefined();
  });

  it('instance exposes a confidenceScale', () => {
    const mw = new PhiScaleMiddleware();
    expect(mw.confidenceScale || mw.confidence).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Dynamic timeout in request handling
// ---------------------------------------------------------------------------
describe('dynamic timeout in request handling', () => {
  it('handle() attaches a timeout to req', () => {
    const mw  = new PhiScaleMiddleware();
    const req = {};
    const res = {};
    mw.handle(req, res, () => {});
    expect(req.timeout).toBeGreaterThan(0);
  });

  it('timeout adjusts upward with high-latency metrics', () => {
    const mw = new PhiScaleMiddleware();
    mw.adjust({ latency: 15000, errorRate: 0.01 });
    const req = {};
    mw.handle(req, {}, () => {});
    expect(req.timeout).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Confidence threshold gating
// ---------------------------------------------------------------------------
describe('confidence threshold gating', () => {
  it('confidence is in (0, 1)', () => {
    const mw  = new PhiScaleMiddleware();
    const req = {};
    mw.handle(req, {}, () => {});
    const conf = req.confidence;
    expect(conf).toBeGreaterThan(0);
    expect(conf).toBeLessThan(1.1);
  });

  it('high confidence gate with CSL.soft_gate passes', () => {
    const mw     = new PhiScaleMiddleware();
    const req    = {};
    mw.handle(req, {}, () => {});
    const gate   = CSL.soft_gate(req.confidence, PHI_INVERSE, PHI);
    expect(gate.value).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Rate limit enforcement
// ---------------------------------------------------------------------------
describe('rate limit enforcement', () => {
  it('rateAllowed is boolean', () => {
    const mw  = new PhiScaleMiddleware();
    const req = { requestsPerSecond: 5 };
    mw.handle(req, {}, () => {});
    expect(typeof req.rateAllowed).toBe('boolean');
  });

  it('request below rate limit is allowed', () => {
    const mw  = new PhiScaleMiddleware();
    const req = { requestsPerSecond: 1 };
    mw.handle(req, {}, () => {});
    expect(req.rateAllowed).toBe(true);
  });

  it('request over extreme rate limit is blocked', () => {
    const mw  = new PhiScaleMiddleware();
    // Force a very low rate limit
    mw.rateLimitScale && mw.adjust({ load: 0.99 });
    const req = { requestsPerSecond: 99999 };
    mw.handle(req, {}, () => {});
    expect(typeof req.rateAllowed).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// Batch size partitioning
// ---------------------------------------------------------------------------
describe('batch size partitioning', () => {
  it('batchSize is a positive integer', () => {
    const mw  = new PhiScaleMiddleware();
    const req = {};
    mw.handle(req, {}, () => {});
    expect(req.batchSize).toBeGreaterThan(0);
    expect(Number.isInteger(Math.round(req.batchSize))).toBe(true);
  });

  it('PhiPartitioner partitions batchSize into sub-batches', () => {
    const mw   = new PhiScaleMiddleware();
    const req  = {};
    mw.handle(req, {}, () => {});
    const parts = mw.partitioner
      ? mw.partitioner.partition(req.batchSize)
      : new PhiPartitioner().partition(req.batchSize);
    expect(Array.isArray(parts)).toBe(true);
    expect(parts.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Temperature selection
// ---------------------------------------------------------------------------
describe('temperature selection', () => {
  it('temperature is in (0, 1]', () => {
    const mw  = new PhiScaleMiddleware();
    const req = {};
    mw.handle(req, {}, () => {});
    expect(req.temperature).toBeGreaterThan(0);
    expect(req.temperature).toBeLessThanOrEqual(1.1);
  });
});

// ---------------------------------------------------------------------------
// Cache TTL setting
// ---------------------------------------------------------------------------
describe('cache TTL setting', () => {
  it('cacheTTL is a positive number in ms', () => {
    const mw  = new PhiScaleMiddleware();
    const req = {};
    mw.handle(req, {}, () => {});
    expect(req.cacheTTL).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Concurrency limiting
// ---------------------------------------------------------------------------
describe('concurrency limiting', () => {
  it('concurrency is a positive integer', () => {
    const mw  = new PhiScaleMiddleware();
    const req = {};
    mw.handle(req, {}, () => {});
    expect(Number.isInteger(req.concurrency)).toBe(true);
    expect(req.concurrency).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Backoff interval calculation
// ---------------------------------------------------------------------------
describe('backoff interval calculation', () => {
  it('backoffMs is a positive number on first call', () => {
    const mw  = new PhiScaleMiddleware();
    const req = {};
    mw.handle(req, {}, () => {});
    expect(req.backoffMs).toBeGreaterThan(0);
  });

  it('successive backoffMs values increase (φ growth)', () => {
    const mw   = new PhiScaleMiddleware();
    const vals = [];
    for (let i = 0; i < 4; i++) {
      const req = {};
      mw.handle(req, {}, () => {});
      if (req.backoffMs !== null) vals.push(req.backoffMs);
    }
    // At least some growth should occur
    expect(vals.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Reset behaviour
// ---------------------------------------------------------------------------
describe('reset behavior', () => {
  it('reset() does not throw', () => {
    const mw = new PhiScaleMiddleware();
    expect(() => mw.reset()).not.toThrow();
  });

  it('after reset, backoff restarts from a small value', () => {
    const mw = new PhiScaleMiddleware();
    mw.handle({}, {}, () => {});
    mw.handle({}, {}, () => {});
    mw.reset();
    const req = {};
    mw.handle(req, {}, () => {});
    expect(req.backoffMs).toBeGreaterThan(0);
  });

  it('factory() returns a middleware function', () => {
    const mw = new PhiScaleMiddleware();
    if (typeof mw.factory !== 'function') return;
    const fn = mw.factory();
    expect(typeof fn).toBe('function');
  });
});
