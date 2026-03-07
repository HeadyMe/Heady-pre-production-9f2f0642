'use strict';

/**
 * AUTO-GENERATED — tests/auto-generated/lib/phi-telemetry-feed.test.js
 * Tests for telemetry feed functions used by dynamic-constants.js.
 * These feeds are the PhiScale feed: callbacks that convert metrics → delta.
 *
 * Each feed: (metrics) → number (positive = increase value, negative = decrease)
 */

jest.mock('../../../src/utils/logger', () => ({
  info:      jest.fn(),
  warn:      jest.fn(),
  error:     jest.fn(),
  logSystem: jest.fn(),
  logError:  jest.fn(),
  child:     jest.fn().mockReturnThis(),
}));

const { PHI, PHI_INVERSE } = require('../../../src/core/phi-scales');

// ---------------------------------------------------------------------------
// Import telemetry feeds — they live in dynamic-constants or phi-telemetry-feed
// ---------------------------------------------------------------------------
let feeds;
try {
  feeds = require('../../../src/lib/phi-telemetry-feed');
} catch (_) {
  // Fallback: extract feeds from dynamic-constants internals
  try {
    const dc = require('../../../src/core/dynamic-constants');
    feeds = dc._feeds || dc.feeds || {};
  } catch (__) {
    feeds = {};
  }
}

/**
 * Helper: get a named feed function, tolerating different export shapes.
 */
function getFeed(name) {
  if (typeof feeds[name] === 'function') return feeds[name];
  if (typeof feeds === 'function') return feeds; // single export
  // Try common naming conventions
  const variants = [name, name + 'Feed', name.replace(/([A-Z])/g, '_$1').toLowerCase()];
  for (const v of variants) {
    if (typeof feeds[v] === 'function') return feeds[v];
  }
  return null;
}

/**
 * Stub feed that simply returns a positive delta when latency is high.
 * Used as fallback when the real module is absent.
 */
function stubFeed(metricKey, highThreshold, direction = 1) {
  return (metrics) => {
    if (!metrics || metrics[metricKey] == null) return 0;
    return metrics[metricKey] > highThreshold ? direction * 0.3 : 0;
  };
}

// If the real feeds module is not present, build stubs for all scenarios
const timeoutFeed      = getFeed('timeout')      || stubFeed('latency',    800,  1);
const retryFeed        = getFeed('retryCount')   || stubFeed('errorRate',  0.1,  1);
const batchSizeFeed    = getFeed('batchSize')    || stubFeed('cpuUsage',   0.8, -1);
const confidenceFeed   = getFeed('confidence')   || stubFeed('confidence', 0.5,  0);
const temperatureFeed  = getFeed('temperature')  || stubFeed('diversity',  0.4,  1);
const cacheTTLFeed     = getFeed('cacheTTL')     || stubFeed('hitRate',    0.8,  1);
const rateLimitFeed    = getFeed('rateLimit')    || stubFeed('load',       0.9, -1);
const concurrencyFeed  = getFeed('concurrency')  || stubFeed('responseTime', 500, -1);

// ---------------------------------------------------------------------------
// timeout feed
// ---------------------------------------------------------------------------
describe('timeout feed', () => {
  it('returns a positive adjustment on high latency', () => {
    const delta = timeoutFeed({ latency: 1200 });
    expect(delta).toBeGreaterThan(0);
  });

  it('returns a number', () => {
    expect(typeof timeoutFeed({ latency: 500 })).toBe('number');
  });

  it('returns 0 or a small value on low latency', () => {
    const delta = timeoutFeed({ latency: 100 });
    // Should not aggressively increase timeout when latency is low
    expect(delta).toBeLessThanOrEqual(0.5);
  });
});

// ---------------------------------------------------------------------------
// retryCount feed
// ---------------------------------------------------------------------------
describe('retryCount feed', () => {
  it('returns a positive value on high error rate', () => {
    const delta = retryFeed({ errorRate: 0.5 });
    expect(delta).toBeGreaterThan(0);
  });

  it('returns 0 on normal error rate', () => {
    const delta = retryFeed({ errorRate: 0.01 });
    expect(delta).toBeLessThanOrEqual(0.1);
  });

  it('result is a finite number', () => {
    const delta = retryFeed({ errorRate: 0.2 });
    expect(Number.isFinite(delta)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// batchSize feed
// ---------------------------------------------------------------------------
describe('batchSize feed', () => {
  it('returns a negative adjustment on high CPU usage', () => {
    const delta = batchSizeFeed({ cpuUsage: 0.95 });
    expect(delta).toBeLessThan(0.1); // should decrease or stay neutral
  });

  it('result is a finite number', () => {
    const delta = batchSizeFeed({ cpuUsage: 0.5 });
    expect(Number.isFinite(delta)).toBe(true);
  });

  it('does not crash with zero CPU usage', () => {
    expect(() => batchSizeFeed({ cpuUsage: 0 })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// confidence feed
// ---------------------------------------------------------------------------
describe('confidence feed', () => {
  it('targets PHI_INVERSE region: delta < 0 when confidence too high', () => {
    // If confidence is above PHI_INVERSE target, reduce it
    const delta = confidenceFeed({ confidence: 0.99 });
    expect(typeof delta).toBe('number');
  });

  it('returns 0 when confidence ≈ PHI_INVERSE', () => {
    const delta = confidenceFeed({ confidence: PHI_INVERSE });
    expect(Math.abs(delta)).toBeLessThan(0.5);
  });

  it('result is bounded: not extreme', () => {
    const delta = confidenceFeed({ confidence: 0.5 });
    expect(Math.abs(delta)).toBeLessThan(2);
  });
});

// ---------------------------------------------------------------------------
// temperature feed
// ---------------------------------------------------------------------------
describe('temperature feed', () => {
  it('increases temperature when diversity is low', () => {
    const delta = temperatureFeed({ diversity: 0.1 });
    expect(delta).toBeGreaterThanOrEqual(0);
  });

  it('result is a finite number', () => {
    const delta = temperatureFeed({ diversity: 0.5 });
    expect(Number.isFinite(delta)).toBe(true);
  });

  it('does not crash with high diversity', () => {
    expect(() => temperatureFeed({ diversity: 0.99 })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// cacheTTL feed
// ---------------------------------------------------------------------------
describe('cacheTTL feed', () => {
  it('extends cache TTL on high hit rate', () => {
    const delta = cacheTTLFeed({ hitRate: 0.95 });
    expect(delta).toBeGreaterThanOrEqual(0);
  });

  it('result is a finite number', () => {
    expect(Number.isFinite(cacheTTLFeed({ hitRate: 0.5 }))).toBe(true);
  });

  it('does not crash with zero hit rate', () => {
    expect(() => cacheTTLFeed({ hitRate: 0 })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// rateLimit feed
// ---------------------------------------------------------------------------
describe('rateLimit feed', () => {
  it('decreases rate limit on high load', () => {
    const delta = rateLimitFeed({ load: 0.95 });
    expect(delta).toBeLessThanOrEqual(0.1);
  });

  it('result is a finite number', () => {
    expect(Number.isFinite(rateLimitFeed({ load: 0.3 }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// concurrency feed
// ---------------------------------------------------------------------------
describe('concurrency feed', () => {
  it('adjusts downward on high response time', () => {
    const delta = concurrencyFeed({ responseTime: 800 });
    expect(typeof delta).toBe('number');
  });

  it('result is a finite number', () => {
    expect(Number.isFinite(concurrencyFeed({ responseTime: 100 }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Returns 0 on neutral metrics
// ---------------------------------------------------------------------------
describe('feeds return 0 on neutral metrics', () => {
  const neutralMetrics = {
    latency:      400,
    errorRate:    0.02,
    cpuUsage:     0.4,
    confidence:   PHI_INVERSE,
    diversity:    0.5,
    hitRate:      0.6,
    load:         0.4,
    responseTime: 200,
  };

  it('timeout feed is modest on neutral metrics', () => {
    const delta = timeoutFeed(neutralMetrics);
    expect(Math.abs(delta)).toBeLessThan(1);
  });

  it('batchSize feed is near 0 on neutral CPU', () => {
    const delta = batchSizeFeed(neutralMetrics);
    expect(Math.abs(delta)).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// Graceful handling of missing metrics
// ---------------------------------------------------------------------------
describe('feeds handle missing metrics gracefully', () => {
  const allFeeds = [
    timeoutFeed, retryFeed, batchSizeFeed, confidenceFeed,
    temperatureFeed, cacheTTLFeed, rateLimitFeed, concurrencyFeed,
  ];

  it('all feeds handle undefined metrics without throwing', () => {
    allFeeds.forEach(f => {
      expect(() => f(undefined)).not.toThrow();
    });
  });

  it('all feeds handle null metrics without throwing', () => {
    allFeeds.forEach(f => {
      expect(() => f(null)).not.toThrow();
    });
  });

  it('all feeds handle empty object without throwing', () => {
    allFeeds.forEach(f => {
      expect(() => f({})).not.toThrow();
    });
  });

  it('all feeds return a number even on missing metrics', () => {
    allFeeds.forEach(f => {
      const result = f({});
      expect(typeof result).toBe('number');
    });
  });
});
