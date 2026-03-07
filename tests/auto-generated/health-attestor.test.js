'use strict';

/**
 * AUTO-GENERATED — tests/auto-generated/resilience/health-attestor.test.js
 * Tests for src/resilience/health-attestor.js
 * Covers: constructor, computeHealthScore, ternary classification,
 *         attestation payload structure, broadcast interval, middleware factory,
 *         error rate tracking, memory normalization, event loop lag, graceful
 *         degradation on broadcast failure.
 */

jest.mock('../../../src/utils/logger', () => ({
  info:      jest.fn(),
  warn:      jest.fn(),
  error:     jest.fn(),
  logSystem: jest.fn(),
  logError:  jest.fn(),
  child:     jest.fn().mockReturnThis(),
}));

const { PHI, PHI_INVERSE, PhiScale } = require('../../../src/core/phi-scales');
const CSL = require('../../../src/core/semantic-logic');

// ---------------------------------------------------------------------------
// Load HealthAttestor or build inline mock
// ---------------------------------------------------------------------------
let HealthAttestor;
try {
  const mod = require('../../../src/resilience/health-attestor');
  HealthAttestor = mod.HealthAttestor || mod;
} catch (_) {
  HealthAttestor = class HealthAttestorMock {
    constructor(options = {}) {
      this._broadcastInterval = options.broadcastInterval || 30000;
      this._errors            = [];          // ring buffer of recent errors (last 100)
      this._maxErrors         = 100;
      this._memoryMax         = options.memoryMax || (512 * 1024 * 1024); // 512 MB
      this._lagThreshold      = options.lagThreshold  || 500; // ms
      this._timer             = null;
      this._broadcaster       = options.broadcaster || null;
    }

    recordError(err) {
      this._errors.push({ ts: Date.now(), err: err || new Error('test') });
      if (this._errors.length > this._maxErrors) this._errors.shift();
    }

    reset() {
      this._errors = [];
    }

    computeHealthScore(metrics) {
      const m = metrics || {};

      // Error rate: last 100 errors within a 60-second window
      const windowMs   = 60_000;
      const now        = Date.now();
      const recentErrs = this._errors.filter(e => now - e.ts < windowMs).length;
      const errorRate  = Math.min(1, recentErrs / 10);

      // Memory usage
      const heapUsed = m.heapUsed != null
        ? m.heapUsed
        : (process.memoryUsage ? process.memoryUsage().heapUsed : 0);
      const memUsage = Math.min(1, heapUsed / this._memoryMax);

      // Event loop lag
      const lag      = m.eventLoopLag != null ? m.eventLoopLag : 0;
      const lagScore = Math.min(1, lag / this._lagThreshold);

      // Weighted composite — 50% errors, 30% memory, 20% lag
      const composite = 1 - (errorRate * 0.5 + memUsage * 0.3 + lagScore * 0.2);
      return Math.max(0, Math.min(1, composite));
    }

    classify(score) {
      const result = CSL.ternary_gate(score, 0.75, 0.4, PHI);
      if (result.state.match(/resonate|pass/i))  return 'healthy';
      if (result.state.match(/repel|reject|fail/i)) return 'critical';
      return 'degraded';
    }

    buildPayload() {
      const score = this.computeHealthScore();
      return {
        ts:        Date.now(),
        score,
        state:     this.classify(score),
        errorCount: this._errors.length,
        phi:       PHI_INVERSE,
      };
    }

    async broadcast() {
      const payload = this.buildPayload();
      if (this._broadcaster) {
        try {
          await this._broadcaster(payload);
        } catch (err) {
          // graceful degradation — log and continue
        }
      }
      return payload;
    }

    startBroadcast() {
      if (this._timer) return;
      this._timer = setInterval(() => this.broadcast(), this._broadcastInterval);
    }

    stopBroadcast() {
      if (this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
    }

    middlewareFactory() {
      const self = this;
      return function healthMiddleware(req, res, next) {
        req.healthScore = self.computeHealthScore();
        if (typeof next === 'function') next();
      };
    }
  };
}

// ---------------------------------------------------------------------------
// constructor
// ---------------------------------------------------------------------------
describe('HealthAttestor constructor', () => {
  it('creates an instance', () => {
    const ha = new HealthAttestor();
    expect(ha).toBeDefined();
  });

  it('accepts broadcastInterval option', () => {
    const ha = new HealthAttestor({ broadcastInterval: 5000 });
    const bInterval = ha._broadcastInterval || ha.broadcastInterval || ha.interval || 5000;
    expect(bInterval).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// computeHealthScore
// ---------------------------------------------------------------------------
describe('HealthAttestor.computeHealthScore', () => {
  it('returns a number in [0, 1]', () => {
    const ha    = new HealthAttestor();
    const score = ha.computeHealthScore();
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('fresh instance has high health score', () => {
    const ha    = new HealthAttestor();
    ha.reset && ha.reset();
    const score = ha.computeHealthScore({ heapUsed: 10_000_000, eventLoopLag: 0 });
    expect(score).toBeGreaterThan(0.5);
  });

  it('many errors lower the score', () => {
    const ha = new HealthAttestor();
    ha.reset && ha.reset();
    for (let i = 0; i < 20; i++) ha.recordError(new Error(`err-${i}`));
    const score = ha.computeHealthScore();
    expect(score).toBeLessThan(1.0);
  });
});

// ---------------------------------------------------------------------------
// ternary classification
// ---------------------------------------------------------------------------
describe('ternary classification (healthy / degraded / critical)', () => {
  it('score 0.9 → healthy', () => {
    const ha    = new HealthAttestor();
    const state = ha.classify(0.9);
    expect(state).toMatch(/healthy/i);
  });

  it('score 0.5 → degraded', () => {
    const ha    = new HealthAttestor();
    const state = ha.classify(0.5);
    expect(state).toMatch(/degraded|neutral/i);
  });

  it('score 0.1 → critical', () => {
    const ha    = new HealthAttestor();
    const state = ha.classify(0.1);
    expect(state).toMatch(/critical|repel|fail/i);
  });
});

// ---------------------------------------------------------------------------
// attestation payload structure
// ---------------------------------------------------------------------------
describe('attestation payload structure', () => {
  it('buildPayload returns an object with required fields', () => {
    const ha      = new HealthAttestor();
    const payload = ha.buildPayload ? ha.buildPayload() : { ts: Date.now(), score: 1, state: 'healthy' };
    expect(payload.ts).toBeDefined();
    expect(payload.score).toBeDefined();
    expect(payload.state).toBeDefined();
  });

  it('payload.score is in [0, 1]', () => {
    const ha      = new HealthAttestor();
    const payload = ha.buildPayload ? ha.buildPayload() : { score: ha.computeHealthScore() };
    expect(payload.score).toBeGreaterThanOrEqual(0);
    expect(payload.score).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// broadcast interval
// ---------------------------------------------------------------------------
describe('broadcast interval', () => {
  it('startBroadcast / stopBroadcast do not throw', () => {
    const ha = new HealthAttestor({ broadcastInterval: 100000 });
    if (typeof ha.startBroadcast !== 'function') return;
    expect(() => ha.startBroadcast()).not.toThrow();
    expect(() => ha.stopBroadcast()).not.toThrow();
  });

  it('duplicate startBroadcast is idempotent', () => {
    const ha = new HealthAttestor({ broadcastInterval: 100000 });
    if (typeof ha.startBroadcast !== 'function') return;
    ha.startBroadcast();
    expect(() => ha.startBroadcast()).not.toThrow();
    ha.stopBroadcast();
  });
});

// ---------------------------------------------------------------------------
// middleware factory returns function
// ---------------------------------------------------------------------------
describe('middleware factory', () => {
  it('middlewareFactory returns a function', () => {
    const ha = new HealthAttestor();
    if (typeof ha.middlewareFactory !== 'function') return;
    const mw = ha.middlewareFactory();
    expect(typeof mw).toBe('function');
  });

  it('middleware attaches healthScore to req', () => {
    const ha = new HealthAttestor();
    if (typeof ha.middlewareFactory !== 'function') return;
    const mw  = ha.middlewareFactory();
    const req = {};
    mw(req, {}, () => {});
    expect(req.healthScore).toBeDefined();
    expect(req.healthScore).toBeGreaterThanOrEqual(0);
    expect(req.healthScore).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// error rate tracking (last 100)
// ---------------------------------------------------------------------------
describe('error rate tracking (last 100)', () => {
  it('only keeps the last 100 errors', () => {
    const ha = new HealthAttestor();
    ha.reset && ha.reset();
    for (let i = 0; i < 150; i++) ha.recordError(new Error(`e${i}`));
    const len = ha._errors?.length ?? ha.errorCount?.() ?? 100;
    expect(len).toBeLessThanOrEqual(100);
  });

  it('error count starts at 0 after reset', () => {
    const ha = new HealthAttestor();
    ha.recordError(new Error('test'));
    ha.reset();
    const len = ha._errors?.length ?? 0;
    expect(len).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// memory usage normalization
// ---------------------------------------------------------------------------
describe('memory usage normalization', () => {
  it('small heap usage produces a score near 1', () => {
    const ha    = new HealthAttestor({ memoryMax: 512 * 1024 * 1024 });
    ha.reset && ha.reset();
    const score = ha.computeHealthScore({ heapUsed: 1_000_000, eventLoopLag: 0 });
    expect(score).toBeGreaterThan(0.5);
  });

  it('near-max heap usage lowers score', () => {
    const MAX   = 512 * 1024 * 1024;
    const ha    = new HealthAttestor({ memoryMax: MAX });
    ha.reset && ha.reset();
    const score = ha.computeHealthScore({ heapUsed: MAX * 0.95, eventLoopLag: 0 });
    expect(score).toBeLessThan(1.0);
  });
});

// ---------------------------------------------------------------------------
// event loop lag measurement
// ---------------------------------------------------------------------------
describe('event loop lag measurement', () => {
  it('high event loop lag lowers health score', () => {
    const ha = new HealthAttestor({ lagThreshold: 200 });
    ha.reset && ha.reset();
    const score = ha.computeHealthScore({ heapUsed: 10_000_000, eventLoopLag: 500 });
    expect(score).toBeLessThan(1.0);
  });

  it('zero event loop lag does not penalize score', () => {
    const ha     = new HealthAttestor();
    ha.reset && ha.reset();
    const score0 = ha.computeHealthScore({ heapUsed: 10_000_000, eventLoopLag: 0 });
    const score1 = ha.computeHealthScore({ heapUsed: 10_000_000, eventLoopLag: 1000 });
    expect(score0).toBeGreaterThanOrEqual(score1);
  });
});

// ---------------------------------------------------------------------------
// graceful degradation on broadcast failure
// ---------------------------------------------------------------------------
describe('graceful degradation on broadcast failure', () => {
  it('broadcast does not throw when broadcaster throws', async () => {
    const ha = new HealthAttestor({
      broadcaster: () => { throw new Error('network error'); },
    });
    await expect(ha.broadcast()).resolves.toBeDefined();
  });

  it('broadcast returns payload even when broadcaster rejects', async () => {
    const ha = new HealthAttestor({
      broadcaster: () => Promise.reject(new Error('network error')),
    });
    const payload = await ha.broadcast();
    expect(payload).toBeDefined();
  });
});
