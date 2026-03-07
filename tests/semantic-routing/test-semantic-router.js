'use strict';

/**
 * test-semantic-router.js
 * Tests for SemanticRouter — uses inline mocks for CSL, PhiScale, and logger.
 * Run: node tests/semantic-routing/test-semantic-router.js
 */

const assert = require('assert');
const path   = require('path');
const Module = require('module');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PHI_INVERSE = 0.618033988749895;
const DIM = 384;

/** Generate a deterministic normalised Float32Array from a seed integer. */
function makeVec(seed, dim = DIM) {
  const vec = new Float32Array(dim);
  let s = (seed >>> 0) || 1;
  for (let i = 0; i < dim; i++) {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    vec[i] = (s / 0xFFFFFFFF) * 2 - 1;
  }
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < dim; i++) vec[i] /= norm;
  return vec;
}

/** Compute dot product of two Float32Arrays. */
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock CSL
const mockCSL = {
  cosine_similarity(a, b) { return Math.max(-1, Math.min(1, dot(a, b))); },
  multi_resonance(target, candidates, threshold) {
    return candidates
      .map((c, i) => {
        const score = this.cosine_similarity(target, c);
        return { index: i, score, open: score > threshold };
      })
      .sort((a, b) => b.score - a.score);
  },
  soft_gate(score, threshold = 0.5, steepness = 20) {
    return 1 / (1 + Math.exp(-steepness * (score - threshold)));
  },
  normalize(v) {
    let norm = 0;
    for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
    norm = Math.sqrt(norm);
    const out = new Float32Array(v.length);
    if (norm > 0) for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
    return out;
  },
};

// Mock PhiScale — minimal, returns baseValue from value getter
class MockPhiScale {
  constructor(opts = {}) {
    this._base = opts.baseValue != null ? opts.baseValue : PHI_INVERSE;
    this._value = this._base;
    this.name = opts.name || 'mock';
  }
  get value() { return this._value; }
  adjust(metrics) {
    // Simulate a small nudge
    if (metrics && metrics.value != null) {
      this._value = this._value * 0.95 + metrics.value * 0.05;
    }
  }
  stats() { return { mean: this._value, n: 1 }; }
  snapshot() { return { v: this._value }; }
  restore(snap) { if (snap && snap.v != null) this._value = snap.v; }
}

const mockLogger = {
  info() {}, debug() {}, warn() {}, error() {},
};

// Patch require for the module under test
const originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === '../core/semantic-logic') return '__MOCK_CSL__';
  if (request === '../core/phi-scales')     return '__MOCK_PHI__';
  if (request === '../utils/logger')        return '__MOCK_LOGGER__';
  return originalResolve(request, parent, ...rest);
};

// Install mock modules
require.cache['__MOCK_CSL__']    = { id: '__MOCK_CSL__',    filename: '__MOCK_CSL__',    loaded: true, exports: mockCSL };
require.cache['__MOCK_PHI__']    = {
  id: '__MOCK_PHI__', filename: '__MOCK_PHI__', loaded: true,
  exports: {
    PhiScale: MockPhiScale,
    PhiRange: class { constructor() {} },
    PHI: 1.618033988749895,
    PHI_INVERSE,
    PHI_SQUARED: 2.618033988749895,
  },
};
require.cache['__MOCK_LOGGER__'] = { id: '__MOCK_LOGGER__', filename: '__MOCK_LOGGER__', loaded: true, exports: mockLogger };

// Require the real module under test
const { SemanticRouter } = require('../../src/routing/semantic-router');

// ─── Test functions ───────────────────────────────────────────────────────────

function test_constructor_defaults() {
  const router = new SemanticRouter();
  assert.strictEqual(typeof router._config.defaultThreshold, 'number',
    'defaultThreshold should be a number');
  assert.ok(router._config.defaultThreshold > 0 && router._config.defaultThreshold < 1,
    'defaultThreshold should be in (0,1)');
  assert.strictEqual(router._config.embeddingDimension, 384,
    'default embedding dimension should be 384');
  assert.strictEqual(router._config.adaptiveThreshold, true,
    'adaptiveThreshold should default to true');
  assert.ok(typeof router._config.ambiguityGap === 'number',
    'ambiguityGap should be a number');
}

function test_register_anchor() {
  const router = new SemanticRouter();
  const anchor = router.registerAnchor('custom_test', 'A test anchor for unit testing');
  assert.strictEqual(anchor.id, 'custom_test');
  assert.strictEqual(anchor.description, 'A test anchor for unit testing');
  assert.ok(anchor.vector instanceof Float32Array, 'vector should be Float32Array');
  assert.strictEqual(anchor.vector.length, 384, 'vector should be 384-dim');
  assert.ok(router.getAnchor('custom_test') !== undefined, 'should be retrievable');
}

function test_remove_anchor() {
  const router = new SemanticRouter();
  router.registerAnchor('to_remove', 'Anchor that will be removed');
  assert.ok(router.getAnchor('to_remove') !== undefined, 'should exist before removal');
  const removed = router.removeAnchor('to_remove');
  assert.strictEqual(removed, true, 'removeAnchor should return true');
  assert.strictEqual(router.getAnchor('to_remove'), undefined, 'should be gone after removal');
  const removedAgain = router.removeAnchor('to_remove');
  assert.strictEqual(removedAgain, false, 'removing non-existent returns false');
}

function test_route_basic() {
  const router = new SemanticRouter();
  // Register a single test anchor so we have a clean, known environment
  const anchorVec = makeVec(42);
  router._anchors.clear(); // clear defaults for isolation
  router.registerAnchor('test_anchor', 'test', anchorVec);

  const results = router.route(anchorVec);
  assert.ok(Array.isArray(results), 'route() should return an array');
  assert.strictEqual(results.length, 1, 'should have one result per anchor');
  const top = results[0];
  assert.ok('anchor' in top,     'result should have anchor field');
  assert.ok('similarity' in top, 'result should have similarity field');
  assert.ok('activated' in top,  'result should have activated field');
  assert.ok('activation' in top, 'result should have activation field');
  assert.strictEqual(top.anchor, 'test_anchor', 'top anchor should be test_anchor');
  assert.ok(top.similarity > 0.99, `similarity of anchor to itself should be ~1, got ${top.similarity}`);
}

function test_route_multi_activation() {
  const router = new SemanticRouter();
  router._anchors.clear();
  // Two nearly identical anchors; route with a vector similar to both
  const vecA = makeVec(10);
  const vecB = makeVec(10); // same seed → identical
  router.registerAnchor('anchorA', 'A', vecA);
  router.registerAnchor('anchorB', 'B', vecB);

  // Use a very low threshold to force both to activate
  router._thresholdScale._value = 0.0;
  const results = router.route(makeVec(10));
  const activated = results.filter(r => r.activated);
  assert.ok(activated.length >= 1, 'at least one anchor should activate');
}

function test_detect_ambiguity() {
  const router = new SemanticRouter();
  router._anchors.clear();
  // Build two anchors that will produce very close cosine similarity to a query
  const vecA = makeVec(100);
  const vecB = makeVec(101);
  router.registerAnchor('a1', 'alpha', vecA);
  router.registerAnchor('a2', 'beta',  vecB);

  const query = mockCSL.normalize(new Float32Array(DIM).map(() => 0.5));
  const results = router.route(query);
  const ambiguity = router.detectAmbiguity(results);

  assert.ok(typeof ambiguity.ambiguous === 'boolean', 'ambiguous should be boolean');
  assert.ok(typeof ambiguity.gap === 'number',        'gap should be a number');
  assert.ok(Array.isArray(ambiguity.topCandidates),   'topCandidates should be array');

  // Force an ambiguous scenario by injecting identical similarity scores
  const fakeResults = [
    { anchor: 'a1', similarity: 0.800, activated: true,  activation: 0.9 },
    { anchor: 'a2', similarity: 0.798, activated: true,  activation: 0.9 },
    { anchor: 'a3', similarity: 0.500, activated: false, activation: 0.3 },
  ];
  const amb = router.detectAmbiguity(fakeResults);
  assert.strictEqual(amb.ambiguous, true, 'gap of 0.002 < ambiguityGap of 0.05 → ambiguous');
  assert.strictEqual(amb.topCandidates.length, 2, 'ambiguous result should have 2 top candidates');

  // Non-ambiguous scenario
  const clearResults = [
    { anchor: 'a1', similarity: 0.9,  activated: true,  activation: 0.99 },
    { anchor: 'a2', similarity: 0.5,  activated: false, activation: 0.3 },
  ];
  const noAmb = router.detectAmbiguity(clearResults);
  assert.strictEqual(noAmb.ambiguous, false, 'gap of 0.4 > ambiguityGap → not ambiguous');
}

function test_adaptive_threshold() {
  const router = new SemanticRouter({ adaptiveThreshold: true });
  const initialThreshold = router._thresholdScale.value;

  // Register a known anchor
  router.registerAnchor('adapt_target', 'Adaptive threshold test anchor');

  // Record several outcomes
  router.recordRoutingOutcome('adapt_target', 0.75, true);
  router.recordRoutingOutcome('adapt_target', 0.80, true);
  router.recordRoutingOutcome('adapt_target', 0.90, false);

  // Stats outcome history should grow
  assert.ok(router._stats.outcomeHistory.length >= 3,
    'outcome history should accumulate entries');

  // Threshold value should be a number in [0.3, 0.95]
  assert.ok(typeof router._thresholdScale.value === 'number',
    'threshold should remain a number after adjustments');
}

function test_route_batch() {
  const router = new SemanticRouter();
  router._anchors.clear();
  router.registerAnchor('batch_a', 'Batch anchor A', makeVec(200));
  router.registerAnchor('batch_b', 'Batch anchor B', makeVec(201));

  const vectors = [makeVec(200), makeVec(201), makeVec(202)];
  const batchResults = router.routeBatch(vectors);

  assert.ok(Array.isArray(batchResults), 'routeBatch should return array');
  assert.strictEqual(batchResults.length, 3, 'should return one result per input');
  batchResults.forEach((r, i) => {
    assert.ok(Array.isArray(r), `result[${i}] should be an array of route results`);
    assert.ok(r.length > 0, `result[${i}] should have at least one entry`);
  });
}

function test_route_with_fallback() {
  const router = new SemanticRouter();
  router._anchors.clear();
  router.registerAnchor('main_anchor', 'Main anchor', makeVec(300));
  router.registerAnchor('fallback',    'Fallback anchor', makeVec(301));

  // Use a very high threshold to ensure nothing activates naturally
  router._thresholdScale._value = 0.9999;

  const { results, usedFallback, fallbackAnchor } =
    router.routeWithFallback(makeVec(500), 'fallback');

  assert.ok(Array.isArray(results), 'results should be an array');
  assert.strictEqual(usedFallback, true, 'should have used fallback since nothing activates at 0.9999');
  assert.strictEqual(fallbackAnchor, 'fallback', 'fallbackAnchor should be "fallback"');

  // The fallback entry should be activated
  const fb = results.find(r => r.anchor === 'fallback');
  assert.ok(fb, 'fallback entry should exist in results');
  assert.strictEqual(fb.activated, true, 'fallback entry should be activated');
}

function test_route_with_fallback_no_fallback_needed() {
  const router = new SemanticRouter();
  router._anchors.clear();
  const vec = makeVec(400);
  router.registerAnchor('strong_match', 'Strong match anchor', vec);
  router.registerAnchor('fallback_anchor', 'Fallback', makeVec(401));

  // Low threshold so the exact vector always activates
  router._thresholdScale._value = 0.0;

  const { usedFallback } = router.routeWithFallback(vec, 'fallback_anchor');
  assert.strictEqual(usedFallback, false, 'fallback should not be used when match activates');
}

function test_similarity_matrix() {
  const router = new SemanticRouter();
  router._anchors.clear();
  router.registerAnchor('mx_a', 'Matrix anchor A', makeVec(600));
  router.registerAnchor('mx_b', 'Matrix anchor B', makeVec(601));
  router.registerAnchor('mx_c', 'Matrix anchor C', makeVec(602));

  const { matrix, anchors, overlaps, gaps } = router.computeSimilarityMatrix();

  assert.ok(Array.isArray(matrix), 'matrix should be an array');
  assert.strictEqual(matrix.length, 3, 'matrix should be NxN (3x3)');
  assert.strictEqual(matrix[0].length, 3, 'each row should have N columns');
  assert.strictEqual(anchors.length, 3, 'anchors list should have 3 entries');

  // Diagonal must be 1.0
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(matrix[i][i] - 1.0) < 1e-6,
      `diagonal[${i}][${i}] should be 1.0, got ${matrix[i][i]}`);
  }

  // Matrix should be symmetric
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      assert.ok(Math.abs(matrix[i][j] - matrix[j][i]) < 1e-6,
        `matrix should be symmetric at [${i}][${j}]`);
    }
  }

  assert.ok(Array.isArray(overlaps), 'overlaps should be an array');
  assert.ok(Array.isArray(gaps),     'gaps should be an array');
}

function test_snapshot_restore() {
  const router = new SemanticRouter();
  router._anchors.clear();
  router.registerAnchor('snap_a', 'Snapshot anchor A', makeVec(700));
  router.registerAnchor('snap_b', 'Snapshot anchor B', makeVec(701));

  // Simulate some routing to build up stats
  router._stats.totalRoutes = 5;
  router._stats.totalAmbiguous = 2;
  router._stats.totalFallbacks = 1;
  router._stats.similaritySum = 3.5;

  const snap = router.snapshot();

  assert.ok(snap, 'snapshot should be truthy');
  assert.strictEqual(snap.version, 1, 'snapshot version should be 1');
  assert.ok(Array.isArray(snap.anchors), 'snapshot should contain anchors array');
  assert.strictEqual(snap.anchors.length, 2, 'snapshot should have 2 anchors');

  // Create a fresh router and restore into it
  const router2 = new SemanticRouter();
  router2._anchors.clear();
  router2.restore(snap);

  assert.strictEqual(router2._anchors.size, 2, 'restored router should have 2 anchors');
  assert.ok(router2.getAnchor('snap_a') !== undefined, 'snap_a should be restored');
  assert.ok(router2.getAnchor('snap_b') !== undefined, 'snap_b should be restored');
  assert.strictEqual(router2._stats.totalRoutes, 5, 'totalRoutes should be restored');
  assert.strictEqual(router2._stats.totalAmbiguous, 2, 'totalAmbiguous should be restored');
}

function test_stats() {
  const router = new SemanticRouter();
  router._anchors.clear();
  router.registerAnchor('stat_a', 'Stats anchor A', makeVec(800));

  // Initially zero routes
  const statsBefore = router.getStats();
  assert.strictEqual(statsBefore.totalRoutes, 0);
  assert.strictEqual(statsBefore.totalAmbiguous, 0);
  assert.strictEqual(statsBefore.totalFallbacks, 0);

  // Route once
  router.route(makeVec(800));
  const statsAfter = router.getStats();
  assert.strictEqual(statsAfter.totalRoutes, 1, 'totalRoutes should increment to 1');
  assert.ok(typeof statsAfter.avgTopSimilarity === 'number', 'avgTopSimilarity should be a number');
  assert.ok(typeof statsAfter.currentThreshold === 'number', 'currentThreshold should be a number');
  assert.ok(typeof statsAfter.ambiguityRate === 'number', 'ambiguityRate should be a number');
  assert.strictEqual(statsAfter.anchorCount, 1, 'anchorCount should be 1');
}

// ─── Runner ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function runTests() {
  const tests = [
    test_constructor_defaults,
    test_register_anchor,
    test_remove_anchor,
    test_route_basic,
    test_route_multi_activation,
    test_detect_ambiguity,
    test_adaptive_threshold,
    test_route_batch,
    test_route_with_fallback,
    test_route_with_fallback_no_fallback_needed,
    test_similarity_matrix,
    test_snapshot_restore,
    test_stats,
  ];

  for (const test of tests) {
    try {
      await test();
      console.log(`  ✓ ${test.name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${test.name}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nTests complete: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

runTests();
