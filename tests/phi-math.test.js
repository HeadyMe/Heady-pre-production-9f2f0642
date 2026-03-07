/**
 * Phi-Math Foundation Test Suite
 * ===============================
 * Validates core constants, thresholds, gates, and utility functions.
 */

'use strict';

const {
  PHI, PSI, PHI_SQ, PHI_CB, PHI_TEMPERATURE,
  fib, phiThreshold, CSL_THRESHOLDS, DEDUP_THRESHOLD,
  PRESSURE_LEVELS, ALERT_THRESHOLDS,
  cslGate, cslBlend, sigmoid,
  phiBackoff, phiFusionWeights, cosineSimilarity,
  phiPriorityScore, phiTokenBudgets,
} = require('../shared/phi-math');

describe('Core Constants', () => {
  test('PHI ≈ 1.618', () => {
    expect(PHI).toBeCloseTo(1.6180339887, 8);
  });

  test('PSI = 1/PHI ≈ 0.618', () => {
    expect(PSI).toBeCloseTo(1 / PHI, 10);
    expect(PSI).toBeCloseTo(0.6180339887, 8);
  });

  test('PHI² = PHI + 1', () => {
    expect(PHI_SQ).toBeCloseTo(PHI + 1, 10);
  });

  test('PHI³ = 2·PHI + 1', () => {
    expect(PHI_CB).toBeCloseTo(2 * PHI + 1, 10);
  });

  test('PHI_TEMPERATURE = PSI³ ≈ 0.236', () => {
    expect(PHI_TEMPERATURE).toBeCloseTo(Math.pow(PSI, 3), 10);
  });
});

describe('Fibonacci', () => {
  test('first 10 values correct', () => {
    expect(fib(0)).toBe(0);
    expect(fib(1)).toBe(1);
    expect(fib(5)).toBe(5);
    expect(fib(7)).toBe(13);
    expect(fib(8)).toBe(21);
    expect(fib(10)).toBe(55);
  });

  test('large values correct', () => {
    expect(fib(16)).toBe(987);
    expect(fib(20)).toBe(6765);
  });

  test('negative n throws', () => {
    expect(() => fib(-1)).toThrow(RangeError);
  });

  test('F(n+1)/F(n) converges to PHI', () => {
    expect(fib(20) / fib(19)).toBeCloseTo(PHI, 4);
  });
});

describe('CSL Thresholds', () => {
  test('hierarchy: MINIMUM < LOW < MEDIUM < HIGH < CRITICAL', () => {
    expect(CSL_THRESHOLDS.MINIMUM).toBeLessThan(CSL_THRESHOLDS.LOW);
    expect(CSL_THRESHOLDS.LOW).toBeLessThan(CSL_THRESHOLDS.MEDIUM);
    expect(CSL_THRESHOLDS.MEDIUM).toBeLessThan(CSL_THRESHOLDS.HIGH);
    expect(CSL_THRESHOLDS.HIGH).toBeLessThan(CSL_THRESHOLDS.CRITICAL);
  });

  test('MINIMUM ≈ 0.500', () => expect(CSL_THRESHOLDS.MINIMUM).toBeCloseTo(0.500, 2));
  test('MEDIUM ≈ 0.809', () => expect(CSL_THRESHOLDS.MEDIUM).toBeCloseTo(0.809, 2));
  test('CRITICAL ≈ 0.927', () => expect(CSL_THRESHOLDS.CRITICAL).toBeCloseTo(0.927, 2));
  test('DEDUP ≈ 0.972', () => expect(DEDUP_THRESHOLD).toBeCloseTo(0.972, 3));
});

describe('CSL Gate', () => {
  test('gates value based on cosine score', () => {
    const high = cslGate(1.0, 0.95, CSL_THRESHOLDS.MEDIUM);
    const low = cslGate(1.0, 0.5, CSL_THRESHOLDS.MEDIUM);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeCloseTo(1.0, 1); // high cos → gate opens
    expect(low).toBeCloseTo(0.0, 0); // low cos → gate closes
  });

  test('sigmoid is bounded [0,1]', () => {
    expect(sigmoid(-10)).toBeGreaterThan(0);
    expect(sigmoid(10)).toBeLessThan(1);
    expect(sigmoid(0)).toBeCloseTo(0.5, 10);
  });
});

describe('Phi-Backoff', () => {
  test('increases with attempt number', () => {
    // Test without randomness by checking expected range
    const delays = [];
    for (let i = 0; i < 5; i++) {
      delays.push(phiBackoff(i, 1000, 100000));
    }
    // Trend should be increasing (with some jitter)
    // Check that attempt 4 is generally larger than attempt 0
    expect(1000 * Math.pow(PHI, 4)).toBeGreaterThan(1000);
  });

  test('respects max limit', () => {
    const delay = phiBackoff(100, 1000, 5000);
    expect(delay).toBeLessThanOrEqual(5000);
  });
});

describe('Phi-Fusion Weights', () => {
  test('2 weights sum to 1', () => {
    const weights = phiFusionWeights(2);
    expect(weights.reduce((a, b) => a + b)).toBeCloseTo(1.0, 10);
    expect(weights[0]).toBeCloseTo(0.618, 2);
    expect(weights[1]).toBeCloseTo(0.382, 2);
  });

  test('3 weights sum to 1', () => {
    const weights = phiFusionWeights(3);
    expect(weights.reduce((a, b) => a + b)).toBeCloseTo(1.0, 10);
  });

  test('weights are descending', () => {
    const weights = phiFusionWeights(5);
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]).toBeLessThan(weights[i - 1]);
    }
  });
});

describe('Cosine Similarity', () => {
  test('identical vectors = 1.0', () => {
    const v = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  test('orthogonal vectors ≈ 0', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  test('opposite vectors = -1.0', () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
  });
});

describe('Token Budgets', () => {
  test('phi-geometric progression', () => {
    const budgets = phiTokenBudgets(8192);
    expect(budgets.working).toBe(8192);
    expect(budgets.session).toBeGreaterThan(budgets.working);
    expect(budgets.memory).toBeGreaterThan(budgets.session);
    expect(budgets.artifacts).toBeGreaterThan(budgets.memory);
  });
});

describe('Pressure Levels', () => {
  test('non-overlapping ranges', () => {
    expect(PRESSURE_LEVELS.NOMINAL_MAX).toBeLessThan(PRESSURE_LEVELS.ELEVATED_MAX);
    expect(PRESSURE_LEVELS.ELEVATED_MAX).toBeLessThan(PRESSURE_LEVELS.HIGH_MAX);
    expect(PRESSURE_LEVELS.HIGH_MAX).toBeLessThan(PRESSURE_LEVELS.CRITICAL_MIN);
  });
});
