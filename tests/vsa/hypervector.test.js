/**
 * @fileoverview Hypervector tests
 */

const { Hypervector, DEFAULT_DIMENSIONALITY } = require('../src/vsa/hypervector');

describe('Hypervector', () => {
  test('creates random hypervector with correct dimensionality', () => {
    const hv = Hypervector.random(1000);
    expect(hv.dimensionality).toBe(1000);
    expect(hv.values.length).toBe(1000);
  });

  test('creates seeded hypervector reproducibly', () => {
    const hv1 = Hypervector.random(1000, 42);
    const hv2 = Hypervector.random(1000, 42);
    expect(hv1.similarity(hv2)).toBeCloseTo(1.0, 3);
  });

  test('random hypervectors are approximately orthogonal', () => {
    const hv1 = Hypervector.random(4096);
    const hv2 = Hypervector.random(4096);
    const sim = hv1.similarity(hv2);
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(0.6);
  });

  test('binding creates orthogonal vector', () => {
    const a = Hypervector.random(2048);
    const b = Hypervector.random(2048);
    const ab = a.bind(b);

    expect(ab.similarity(a)).toBeLessThan(0.6);
    expect(ab.similarity(b)).toBeLessThan(0.6);
  });

  test('bundling preserves similarity to constituents', () => {
    const a = Hypervector.random(2048);
    const b = Hypervector.random(2048);
    const c = Hypervector.random(2048);
    const bundle = a.bundle([b, c]);

    expect(bundle.similarity(a)).toBeGreaterThan(0.4);
    expect(bundle.similarity(b)).toBeGreaterThan(0.4);
    expect(bundle.similarity(c)).toBeGreaterThan(0.4);
  });

  test('permutation is invertible', () => {
    const hv = Hypervector.random(1000);
    const permuted = hv.permute(5);
    const restored = permuted.permute(-5);

    expect(hv.similarity(restored)).toBeGreaterThan(0.99);
  });

  test('toPhiScale returns value in [0, φ]', () => {
    const hv = Hypervector.random(2048);
    const phiValue = hv.toPhiScale();
    const PHI = (1 + Math.sqrt(5)) / 2;

    expect(phiValue).toBeGreaterThanOrEqual(0);
    expect(phiValue).toBeLessThanOrEqual(PHI);
  });

  test('toTruthValue returns value in [0, 1]', () => {
    const hv = Hypervector.random(2048);
    const truthValue = hv.toTruthValue();

    expect(truthValue).toBeGreaterThanOrEqual(0);
    expect(truthValue).toBeLessThanOrEqual(1);
  });

  test('JSON serialization roundtrip', () => {
    const hv = Hypervector.random(512);
    const json = hv.toJSON();
    const restored = Hypervector.fromJSON(json);

    expect(hv.similarity(restored)).toBeCloseTo(1.0, 5);
  });
});
