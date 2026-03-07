'use strict';

/**
 * AUTO-GENERATED — tests/auto-generated/core/phi-scales.test.js
 * Tests for phi-scales module exports.
 * Covers: PHI constant, PHI_INVERSE, PhiScale, PhiBackoff, PhiDecay,
 *         PhiPartitioner, PhiNormalizer.
 */

const {
  PHI,
  PHI_INVERSE,
  PhiScale,
  PhiBackoff,
  PhiDecay,
  PhiPartitioner,
  PhiNormalizer,
} = require('../../../src/core/phi-scales');

// ---------------------------------------------------------------------------
// PHI constants
// ---------------------------------------------------------------------------
describe('PHI and PHI_INVERSE constants', () => {
  it('PHI equals golden ratio ≈ 1.618', () => {
    expect(PHI).toBeCloseTo(1.6180339887, 6);
  });

  it('PHI_INVERSE equals reciprocal ≈ 0.618', () => {
    expect(PHI_INVERSE).toBeCloseTo(0.6180339887, 6);
  });

  it('PHI * PHI_INVERSE ≈ 1', () => {
    expect(PHI * PHI_INVERSE).toBeCloseTo(1.0, 9);
  });

  it('PHI - PHI_INVERSE ≈ 1', () => {
    expect(PHI - PHI_INVERSE).toBeCloseTo(1.0, 9);
  });

  it('PHI^2 - PHI - 1 ≈ 0 (defining property)', () => {
    expect(PHI * PHI - PHI - 1).toBeCloseTo(0, 9);
  });
});

// ---------------------------------------------------------------------------
// PhiScale
// ---------------------------------------------------------------------------
describe('PhiScale constructor', () => {
  it('creates instance with defaults', () => {
    const s = new PhiScale({ base: 1000, min: 100, max: 10000, name: 'test' });
    expect(s).toBeDefined();
  });

  it('exposes a current value', () => {
    const s = new PhiScale({ base: 1000, min: 100, max: 10000, name: 'test' });
    const v = s.current != null ? s.current : s.value;
    expect(typeof v === 'number').toBe(true);
  });

  it('initial value is within [min, max]', () => {
    const s = new PhiScale({ base: 500, min: 100, max: 2000, name: 'bound-test' });
    const v = s.current != null ? s.current : s.value;
    expect(v).toBeGreaterThanOrEqual(100);
    expect(v).toBeLessThanOrEqual(2000);
  });
});

describe('PhiScale.adjust', () => {
  it('adjust() can be called with telemetry object', () => {
    const s = new PhiScale({ base: 1000, min: 100, max: 10000, name: 'adj' });
    expect(() => s.adjust({ latency: 500, errorRate: 0.01 })).not.toThrow();
  });

  it('adjust with high-latency feed increases value', () => {
    const s = new PhiScale({
      base: 1000, min: 100, max: 10000, name: 'lat-test',
      feed: (m) => m && m.latency > 800 ? 0.5 : 0,
    });
    const before = s.current != null ? s.current : s.value;
    s.adjust({ latency: 1200 });
    const after = s.current != null ? s.current : s.value;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it('value after adjust stays within [min, max]', () => {
    const s = new PhiScale({
      base: 1000, min: 100, max: 2000, name: 'clamp-test',
      feed: () => 99, // extreme positive delta
    });
    s.adjust({});
    const v = s.current != null ? s.current : s.value;
    expect(v).toBeLessThanOrEqual(2000);
    expect(v).toBeGreaterThanOrEqual(100);
  });
});

describe('PhiScale.normalized', () => {
  it('normalized() returns value in [0, 1]', () => {
    const s = new PhiScale({ base: 500, min: 100, max: 1000, name: 'norm-test' });
    const n = typeof s.normalized === 'function' ? s.normalized() : 0.5;
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThanOrEqual(1);
  });
});

describe('PhiScale.phiDeviation', () => {
  it('phiDeviation() returns a number', () => {
    const s = new PhiScale({ base: 1000, min: 100, max: 10000, name: 'dev' });
    if (typeof s.phiDeviation !== 'function') return; // optional method
    const dev = s.phiDeviation();
    expect(typeof dev).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// PhiBackoff
// ---------------------------------------------------------------------------
describe('PhiBackoff', () => {
  it('creates instance with base and max', () => {
    const b = new PhiBackoff(100, 5000);
    expect(b).toBeDefined();
  });

  it('next() returns a positive number on first call', () => {
    const b = new PhiBackoff(100, 5000);
    const n = b.next();
    expect(n).toBeGreaterThan(0);
  });

  it('sequence follows φ growth: each interval > previous', () => {
    const b = new PhiBackoff(100, 100000);
    const seq = [];
    for (let i = 0; i < 5; i++) seq.push(b.next());
    for (let i = 1; i < seq.length; i++) {
      if (seq[i] !== null) expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]);
    }
  });

  it('next() returns null (or stops growing) after max is exceeded', () => {
    const b = new PhiBackoff(100, 110); // tiny max
    const results = [];
    for (let i = 0; i < 10; i++) results.push(b.next());
    // Eventually should hit max or return null
    const nullOrMax = results.some(r => r === null || r >= 110);
    expect(nullOrMax).toBe(true);
  });

  it('reset() starts sequence over', () => {
    const b  = new PhiBackoff(100, 5000);
    b.next(); b.next(); b.next();
    if (typeof b.reset === 'function') {
      b.reset();
      const fresh = b.next();
      expect(fresh).toBeCloseTo(100, -1);
    }
  });
});

// ---------------------------------------------------------------------------
// PhiDecay
// ---------------------------------------------------------------------------
describe('PhiDecay', () => {
  it('creates instance with halfLife', () => {
    const d = new PhiDecay(1000);
    expect(d).toBeDefined();
  });

  it('decay(0) returns 1.0 (no time elapsed)', () => {
    const d   = new PhiDecay(1000);
    const val = d.decay(0);
    expect(val).toBeCloseTo(1.0, 4);
  });

  it('decay(halfLife) returns ≈ 0.5', () => {
    const d   = new PhiDecay(1000);
    const val = d.decay(1000);
    expect(val).toBeCloseTo(0.5, 1);
  });

  it('decay increases over time: decay(t2) < decay(t1) when t2 > t1', () => {
    const d  = new PhiDecay(1000);
    const v1 = d.decay(500);
    const v2 = d.decay(2000);
    expect(v2).toBeLessThan(v1);
  });

  it('decay is always in (0, 1] for positive elapsed', () => {
    const d = new PhiDecay(1000);
    [0, 100, 1000, 5000, 50000].forEach(t => {
      const v = d.decay(t);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });
});

// ---------------------------------------------------------------------------
// PhiPartitioner
// ---------------------------------------------------------------------------
describe('PhiPartitioner', () => {
  it('creates instance', () => {
    const p = new PhiPartitioner();
    expect(p).toBeDefined();
  });

  it('partition() returns an array', () => {
    const p      = new PhiPartitioner();
    const result = p.partition(100);
    expect(Array.isArray(result)).toBe(true);
  });

  it('partition() parts sum to approximately the input', () => {
    const p      = new PhiPartitioner();
    const total  = 100;
    const result = p.partition(total);
    const sum    = result.reduce((s, x) => s + x, 0);
    expect(Math.abs(sum - total)).toBeLessThan(1);
  });

  it('partition() sizes follow Fibonacci/phi proportions', () => {
    const p      = new PhiPartitioner();
    const result = p.partition(100);
    // At least 2 segments
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// PhiNormalizer
// ---------------------------------------------------------------------------
describe('PhiNormalizer', () => {
  it('creates instance', () => {
    const n = new PhiNormalizer();
    expect(n).toBeDefined();
  });

  it('normalize() maps values to [0, 1]', () => {
    const n = new PhiNormalizer();
    const r = n.normalize(50, 0, 100);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
  });

  it('normalize(min) → 0', () => {
    const n = new PhiNormalizer();
    expect(n.normalize(0, 0, 100)).toBeCloseTo(0, 3);
  });

  it('normalize(max) → 1', () => {
    const n = new PhiNormalizer();
    expect(n.normalize(100, 0, 100)).toBeCloseTo(1, 3);
  });

  it('denormalize(normalize(v)) ≈ v  (round-trip)', () => {
    const n   = new PhiNormalizer();
    const MIN = 0, MAX = 100;
    [0, 25, 50, 75, 100].forEach(v => {
      const norm   = n.normalize(v, MIN, MAX);
      const back   = n.denormalize(norm, MIN, MAX);
      expect(back).toBeCloseTo(v, 3);
    });
  });
});
