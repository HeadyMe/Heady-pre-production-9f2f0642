'use strict';

/**
 * test-meaning-types.js
 * Tests for MeaningType and MeaningTypeCollection — uses inline mocks for CSL, PhiScale, logger.
 * Run: node tests/semantic-routing/test-meaning-types.js
 */

const assert = require('assert');
const Module = require('module');

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI_INVERSE = 0.618033988749895;
const DIM = 384;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function normalize(v) {
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm);
  const out = new Float32Array(v.length);
  if (norm > 0) for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
}

/** Build a Float32Array that is biased in a specific direction by 'strength'. */
function biasedVec(dim, offset, strength = 0.8) {
  const base = new Float32Array(dim).fill(0);
  base[offset % dim] = strength;
  base[(offset + 1) % dim] = strength * 0.5;
  return normalize(base);
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCSL = {
  cosine_similarity(a, b) { return Math.max(-1, Math.min(1, dot(a, b))); },
  soft_gate(score, threshold = 0.5, steepness = 20) {
    return 1 / (1 + Math.exp(-steepness * (score - threshold)));
  },
  resonance_gate(a, b, threshold = PHI_INVERSE) {
    const score = this.cosine_similarity(a, b);
    return { score, open: score >= threshold };
  },
  weighted_superposition(a, b, alpha = 0.5) {
    const out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = alpha * a[i] + (1 - alpha) * b[i];
    return normalize(out);
  },
  orthogonal_gate(target, reject) {
    const proj = dot(target, reject);
    const out = new Float32Array(target.length);
    for (let i = 0; i < target.length; i++) out[i] = target[i] - proj * reject[i];
    return normalize(out);
  },
  consensus_superposition(vectors) {
    if (!vectors || vectors.length === 0) return new Float32Array(DIM);
    const acc = new Float32Array(vectors[0].length);
    for (const v of vectors) for (let i = 0; i < acc.length; i++) acc[i] += v[i] / vectors.length;
    return normalize(acc);
  },
  route_gate(target, candidates, threshold = 0) {
    const scores = candidates.map(c => this.cosine_similarity(target, c));
    const best = scores.reduce((bi, s, i) => (s > scores[bi] ? i : bi), 0);
    return { best, scores, fallback: false };
  },
  normalize,
};

const mockLogger = {
  info() {}, debug() {}, warn() {}, error() {},
};

// ─── Patch require ────────────────────────────────────────────────────────────

const originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === '../core/semantic-logic') return '__MT_CSL__';
  if (request === '../core/phi-scales')     return '__MT_PHI__';
  if (request === '../utils/logger')        return '__MT_LOGGER__';
  return originalResolve(request, parent, ...rest);
};

require.cache['__MT_CSL__']    = { id: '__MT_CSL__',    filename: '__MT_CSL__',    loaded: true, exports: mockCSL };
require.cache['__MT_PHI__']    = {
  id: '__MT_PHI__', filename: '__MT_PHI__', loaded: true,
  exports: {
    PhiScale: class { constructor(o={}) { this.value = o.baseValue ?? PHI_INVERSE; } },
    PHI: 1.618033988749895,
    PHI_INVERSE,
  },
};
require.cache['__MT_LOGGER__'] = { id: '__MT_LOGGER__', filename: '__MT_LOGGER__', loaded: true, exports: mockLogger };

delete require.cache[require.resolve('../../src/scripting/meaning-types')];
const { MeaningType, MeaningTypeCollection } = require('../../src/scripting/meaning-types');

// ─── Tests ────────────────────────────────────────────────────────────────────

function test_create() {
  const mt = MeaningType.create('deployed', 'The software has been deployed to production');
  assert.ok(mt instanceof MeaningType, 'create() should return a MeaningType instance');
  assert.strictEqual(mt.value, 'deployed', 'value should be "deployed"');
  assert.strictEqual(mt.description, 'The software has been deployed to production');
  assert.ok(mt.vector instanceof Float32Array, 'vector should be Float32Array');
  assert.strictEqual(mt.vector.length, 384, 'vector should be 384-dim');
}

function test_equals_similar() {
  // These will use the same LCG embedding; for "similar" we verify the
  // equals() method structure works — since the internal embedder is hash-based,
  // the actual similarity depends on the hash. We test with identical values.
  const mt1 = MeaningType.create('deployed', 'deployed released shipped pushed to production live');
  const mt2 = MeaningType.create('deployed', 'deployed released shipped pushed to production live');

  const result = mt1.equals(mt2);
  assert.ok(typeof result === 'object', 'equals() should return an object');
  assert.ok('match' in result, 'result should have match field');
  assert.ok('similarity' in result, 'result should have similarity field');
  assert.ok('activation' in result, 'result should have activation field');

  // Identical text → identical vector → similarity = 1.0
  assert.ok(result.similarity > 0.99, `identical MeaningTypes should have similarity ~1.0, got ${result.similarity}`);
  assert.strictEqual(result.match, true, 'identical MeaningTypes should match');
}

function test_equals_different() {
  // Two very different descriptions; since the embedder is hash-based,
  // different hashes should produce different vectors
  const mt1 = MeaningType.create('action_a', 'deployed pushed released software to production server cluster');
  const mt2 = MeaningType.create('action_b', 'deleted all data permanently removed erased destroyed');

  const result = mt1.equals(mt2);
  assert.ok(typeof result.similarity === 'number', 'similarity should be a number');
  assert.ok(result.similarity < 1.0, 'different descriptions should have similarity < 1.0');
  // They won't be an exact match
  assert.ok(result.similarity !== 1.0, 'completely different descriptions should not have sim=1.0');
}

function test_is_compatible() {
  const mt1 = MeaningType.create('compat_a', 'compat_a test for compatibility check method');
  const mt2 = MeaningType.create('compat_a', 'compat_a test for compatibility check method');

  const result = mt1.isCompatible(mt2);
  assert.ok(typeof result === 'object', 'isCompatible() should return an object');
  assert.ok('compatible' in result, 'should have compatible field');
  assert.ok('score' in result, 'should have score field');
  assert.ok('open' in result, 'should have open field');
  // Identical descriptions → same vector → score = 1.0 → open = true
  assert.strictEqual(result.compatible, true, 'identical MeaningTypes should be compatible');
  assert.ok(result.score > 0.99, 'score for identical should be ~1.0');
}

function test_distance() {
  const mt1 = MeaningType.create('dist_x', 'distance test x direction measurement');
  const mt2 = MeaningType.create('dist_x', 'distance test x direction measurement');
  const mt3 = MeaningType.create('dist_y', 'completely orthogonal concept in different semantic space');

  const distSelf = mt1.distance(mt2);
  assert.ok(Math.abs(distSelf) < 0.01, `distance to identical should be ~0, got ${distSelf}`);

  const distOther = mt1.distance(mt3);
  assert.ok(typeof distOther === 'number', 'distance should be a number');
  // distance = 1 - similarity, so it should be in [0, 2]
  assert.ok(distOther >= -0.01 && distOther <= 2.01,
    `distance should be in [0,2], got ${distOther}`);
  assert.ok(distOther > distSelf, 'distance to different concept should be greater than self-distance');
}

function test_combine() {
  const vec1 = biasedVec(DIM, 10);
  const vec2 = biasedVec(DIM, 200);
  const mt1 = new MeaningType('a', 'MeaningType A for combine test', vec1);
  const mt2 = new MeaningType('b', 'MeaningType B for combine test', vec2);

  const combined = mt1.combine(mt2, 0.5);
  assert.ok(combined instanceof MeaningType, 'combine() should return a MeaningType');
  assert.ok(combined.vector instanceof Float32Array, 'combined vector should be Float32Array');
  assert.strictEqual(combined.vector.length, DIM, 'combined vector should be 384-dim');

  // Combined vector should have unit norm (normalized)
  let norm = 0;
  for (let i = 0; i < combined.vector.length; i++) norm += combined.vector[i] * combined.vector[i];
  assert.ok(Math.abs(Math.sqrt(norm) - 1.0) < 1e-4, 'combined vector should be unit-length');

  // Description should mention both
  assert.ok(combined.description.includes('MeaningType A') || combined.description.includes('⊕'),
    'combined description should reference original types');
}

function test_exclude() {
  // Use two vectors with substantial, but NOT identical, overlap so exclusion is meaningful.
  // vec1 is biased toward index 10; vec2 is biased toward index 50 (partial overlap via fill noise).
  const mt1 = new MeaningType('main', 'Main concept about deployment',
    MeaningType._generateEmbedding('main concept about deployment release push'));
  const mt2 = new MeaningType('excl', 'Excluded concept about deletion',
    MeaningType._generateEmbedding('excluded concept about deletion removal erasing data'));

  const excluded = mt1.exclude(mt2);
  assert.ok(excluded instanceof MeaningType, 'exclude() should return a MeaningType');
  assert.ok(excluded.vector instanceof Float32Array, 'excluded vector should be Float32Array');
  assert.strictEqual(excluded.vector.length, DIM, 'excluded vector should be 384-dim');
  // After orthogonal exclusion, the similarity to the excluded concept should be reduced
  // compared to the original similarity
  const simBefore = mockCSL.cosine_similarity(mt1.vector, mt2.vector);
  const simAfter  = mockCSL.cosine_similarity(excluded.vector, mt2.vector);
  assert.ok(simAfter <= simBefore + 0.01,
    `excluded vector should not have higher similarity to excluded concept than original; before=${simBefore.toFixed(4)} after=${simAfter.toFixed(4)}`);
  // Description should include the exclusion operator symbol
  assert.ok(excluded.description.includes('⊖') || excluded.description.includes('exclude') ||
            excluded.description.includes('Main concept'),
    'excluded description should reference original type');
}

function test_consensus() {
  const mt1 = MeaningType.create('c1', 'First consensus member alpha beta gamma');
  const mt2 = MeaningType.create('c2', 'Second consensus member delta epsilon zeta');
  const mt3 = MeaningType.create('c3', 'Third consensus member eta theta iota');

  const consensus = MeaningType.consensus([mt1, mt2, mt3]);
  assert.ok(consensus instanceof MeaningType, 'consensus() should return a MeaningType');
  assert.ok(consensus.vector instanceof Float32Array, 'consensus vector should be Float32Array');
  assert.ok(Array.isArray(consensus.value), 'consensus value should be an array of source values');
  assert.strictEqual(consensus.value.length, 3, 'consensus value array should have 3 items');
}

function test_classify() {
  const subject = MeaningType.create('subject', 'classification test subject vector');
  const catA = MeaningType.create('cat_a', 'Category A deployment production release');
  const catB = MeaningType.create('cat_b', 'Category B testing verification quality');
  const catC = MeaningType.create('cat_c', 'Category C documentation writing text');

  const results = subject.classify([catA, catB, catC]);
  assert.ok(Array.isArray(results), 'classify() should return an array');
  assert.strictEqual(results.length, 3, 'should have 3 classification results');

  // Results should be sorted by similarity descending
  for (let i = 0; i < results.length - 1; i++) {
    assert.ok(results[i].similarity >= results[i + 1].similarity,
      `results should be sorted descending at index ${i}`);
  }

  // Each result should have required fields
  results.forEach((r, i) => {
    assert.ok('category' in r, `result[${i}] should have category`);
    assert.ok('similarity' in r, `result[${i}] should have similarity`);
    assert.ok('activation' in r, `result[${i}] should have activation`);
    assert.ok('rank' in r, `result[${i}] should have rank`);
    assert.strictEqual(r.rank, i + 1, `rank should be ${i + 1}`);
  });
}

function test_to_json_from_json() {
  const mt = MeaningType.create('json_test', 'JSON serialisation test for MeaningType');

  const json = mt.toJSON();
  assert.ok(typeof json === 'object', 'toJSON() should return an object');
  assert.strictEqual(json.value, 'json_test', 'JSON value should be preserved');
  assert.strictEqual(json.description, 'JSON serialisation test for MeaningType');
  assert.ok(Array.isArray(json.vector), 'JSON vector should be a plain array');
  assert.strictEqual(json.vector.length, 384, 'JSON vector should have 384 elements');
  assert.ok(typeof json.type === 'string', 'JSON should have type field');

  // Round-trip: fromJSON
  const restored = MeaningType.fromJSON(json);
  assert.ok(restored instanceof MeaningType, 'fromJSON() should return a MeaningType');
  assert.strictEqual(restored.value, 'json_test', 'value should be restored');
  assert.ok(restored.vector instanceof Float32Array, 'restored vector should be Float32Array');

  // Vectors should be identical
  for (let i = 0; i < 384; i++) {
    assert.ok(Math.abs(restored.vector[i] - mt.vector[i]) < 1e-6,
      `Vector element ${i} should be preserved after round-trip`);
  }
}

function test_collection_find_closest() {
  const col = new MeaningTypeCollection();
  const mt1 = MeaningType.create('col_a', 'First collection member alpha');
  const mt2 = MeaningType.create('col_b', 'Second collection member beta');
  const mt3 = MeaningType.create('col_c', 'Third collection member gamma');

  col.add(mt1).add(mt2).add(mt3);
  assert.strictEqual(col.size, 3, 'collection should have 3 items');

  // findClosest with a MeaningType that is identical to mt1 should return mt1
  const query = MeaningType.create('col_a', 'First collection member alpha');
  const result = col.findClosest(query);

  assert.ok(result !== null, 'findClosest should find a result');
  assert.ok('item' in result, 'result should have item field');
  assert.ok('similarity' in result, 'result should have similarity field');
  assert.ok('index' in result, 'result should have index field');
  assert.strictEqual(result.item.value, 'col_a',
    'closest to col_a should be col_a (self-match)');
  assert.ok(result.similarity > 0.99, 'self-similarity should be ~1.0');

  // findClosest with a string query
  const strResult = col.findClosest('First collection member alpha');
  assert.ok(strResult !== null, 'string query should work');
  assert.ok(typeof strResult.similarity === 'number', 'string result should have similarity');
}

// ─── Runner ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function runTests() {
  const tests = [
    test_create,
    test_equals_similar,
    test_equals_different,
    test_is_compatible,
    test_distance,
    test_combine,
    test_exclude,
    test_consensus,
    test_classify,
    test_to_json_from_json,
    test_collection_find_closest,
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
