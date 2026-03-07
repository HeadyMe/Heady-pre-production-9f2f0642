'use strict';

/**
 * test-anchor-registry.js
 * Tests for AnchorRegistry — uses inline mocks for CSL, PhiScale, logger.
 * Run: node tests/semantic-routing/test-anchor-registry.js
 */

const assert = require('assert');
const Module = require('module');

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI_INVERSE = 0.618033988749895;
const DIM = 384;

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/** dot product of two Float32Arrays */
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function normalize(v) {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n);
  const out = new Float32Array(v.length);
  if (n > 0) for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCSL = {
  cosine_similarity(a, b) {
    return Math.max(-1, Math.min(1, dot(a, b)));
  },
  multi_resonance(target, candidates, threshold) {
    return candidates
      .map((c, i) => {
        const score = this.cosine_similarity(target, c);
        return { index: i, score, open: score > threshold };
      })
      .sort((a, b) => b.score - a.score);
  },
  superposition_gate(a, b) {
    const out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = (a[i] + b[i]) * 0.5;
    return normalize(out);
  },
  orthogonal_gate(target, reject) {
    const proj = dot(target, reject);
    const out = new Float32Array(target.length);
    for (let i = 0; i < target.length; i++) out[i] = target[i] - proj * reject[i];
    return normalize(out);
  },
  batch_orthogonal(target, rejects) {
    let cur = new Float32Array(target);
    for (const r of rejects) {
      cur = this.orthogonal_gate(cur, r);
    }
    return cur;
  },
  normalize,
  soft_gate(score, threshold = 0.5, steepness = 20) {
    return 1 / (1 + Math.exp(-steepness * (score - threshold)));
  },
};

class MockPhiScale {
  constructor(opts = {}) {
    this._value = opts.baseValue != null ? opts.baseValue : PHI_INVERSE;
    this.name = opts.name || 'mock';
  }
  get value() { return this._value; }
  adjust() {}
  stats()    { return { mean: this._value }; }
  snapshot() { return { v: this._value }; }
  restore(s) { if (s && s.v != null) this._value = s.v; }
}

class MockPhiBackoff {
  constructor(base = 1000) { this._base = base; this._n = 0; }
  next() { this._n++; return this._base * this._n; }
  reset() { this._n = 0; }
}

const mockLogger = {
  info() {}, debug() {}, warn() {}, error() {},
};

// ─── Patch require ────────────────────────────────────────────────────────────

const originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === '../core/semantic-logic') return '__AR_CSL__';
  if (request === '../core/phi-scales')     return '__AR_PHI__';
  if (request === '../utils/logger')        return '__AR_LOGGER__';
  return originalResolve(request, parent, ...rest);
};

require.cache['__AR_CSL__']    = { id: '__AR_CSL__',    filename: '__AR_CSL__',    loaded: true, exports: mockCSL };
require.cache['__AR_PHI__']    = {
  id: '__AR_PHI__', filename: '__AR_PHI__', loaded: true,
  exports: {
    PhiScale: MockPhiScale,
    PhiBackoff: MockPhiBackoff,
    PhiRange: class { constructor() {} },
    PHI: 1.618033988749895,
    PHI_INVERSE,
    PHI_SQUARED: 2.618033988749895,
  },
};
require.cache['__AR_LOGGER__'] = { id: '__AR_LOGGER__', filename: '__AR_LOGGER__', loaded: true, exports: mockLogger };

// Reset singleton before requiring
delete require.cache[require.resolve('../../src/routing/semantic-anchor-registry')];
const { AnchorRegistry } = require('../../src/routing/semantic-anchor-registry');

// Helper: reset singleton between tests
function freshRegistry() {
  AnchorRegistry._instance = null;
  return AnchorRegistry.getInstance();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function test_singleton() {
  const a = freshRegistry();
  const b = AnchorRegistry.getInstance();
  assert.strictEqual(a, b, 'getInstance() should return the same instance');
}

async function test_register_anchor() {
  const reg = freshRegistry();
  const entry = await reg.registerAnchor(
    'test_reg',
    'A comprehensive test anchor description for unit testing',
    { category: 'testing', metadata: { priority: 1 } }
  );

  assert.strictEqual(entry.id, 'test_reg');
  assert.strictEqual(entry.description, 'A comprehensive test anchor description for unit testing');
  assert.ok(entry.vector instanceof Float32Array, 'vector should be Float32Array');
  assert.strictEqual(entry.vector.length, 384, 'vector should be 384-dim');
  assert.strictEqual(entry.category, 'testing');
  assert.deepStrictEqual(entry.metadata, { priority: 1 });
  assert.strictEqual(entry.version, 1);
  assert.ok(typeof entry.createdAt === 'number', 'createdAt should be a number');
  assert.ok(typeof entry.updatedAt === 'number', 'updatedAt should be a number');

  const fetched = reg.getAnchor('test_reg');
  assert.ok(fetched !== undefined, 'getAnchor should return the registered entry');
  assert.strictEqual(fetched.id, 'test_reg');
}

async function test_update_anchor() {
  const reg = freshRegistry();
  await reg.registerAnchor('upd_anchor', 'Original description v1');
  const v1 = reg.getAnchor('upd_anchor');
  assert.strictEqual(v1.version, 1, 'initial version should be 1');

  const v2 = await reg.updateAnchor('upd_anchor', 'Updated description v2', { extra: true });
  assert.strictEqual(v2.version, 2, 'version should increment to 2 after update');
  assert.strictEqual(v2.description, 'Updated description v2', 'description should be updated');
  assert.strictEqual(v2.metadata.extra, true, 'metadata should be merged');
  assert.ok(v2.vector instanceof Float32Array, 'updated entry should still have Float32Array vector');
}

async function test_deterministic_embedding() {
  const reg = freshRegistry();
  const text = 'The quick brown fox jumps over the lazy dog';
  const v1 = reg.generateDeterministicEmbedding(text, 384);
  const v2 = reg.generateDeterministicEmbedding(text, 384);

  assert.ok(v1 instanceof Float32Array, 'should return Float32Array');
  assert.strictEqual(v1.length, 384, 'should be 384-dim');

  // Exact bit-for-bit equality (deterministic)
  for (let i = 0; i < 384; i++) {
    assert.strictEqual(v1[i], v2[i],
      `Deterministic embedding should produce identical results at index ${i}`);
  }
}

async function test_embedding_dimension() {
  const reg = freshRegistry();
  const vec = reg.generateDeterministicEmbedding('dimension test', 384);
  assert.strictEqual(vec.length, 384, 'generated embedding should be exactly 384-dim');
  assert.ok(vec instanceof Float32Array, 'should be Float32Array');
}

async function test_embedding_normalized() {
  const reg = freshRegistry();
  const vec = reg.generateDeterministicEmbedding('normalisation test text', 384);

  // Compute L2 norm
  let norm = 0;
  for (let i = 0; i < 384; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);

  assert.ok(Math.abs(norm - 1.0) < 1e-4,
    `L2 norm should be ~1.0 (unit vector), got ${norm}`);
}

async function test_find_similar() {
  const reg = freshRegistry();

  // Register two anchors with very different descriptions
  await reg.registerAnchor('deploy_anchor', 'deploy release publish software production environment');
  await reg.registerAnchor('cook_anchor', 'cooking recipe kitchen food ingredients temperature');

  // The deploy anchor's own vector should find itself as most similar
  const deployEntry = reg.getAnchor('deploy_anchor');
  const results = reg.findSimilarAnchors(deployEntry.vector, 2, 0.0);

  assert.ok(Array.isArray(results), 'findSimilarAnchors should return an array');
  assert.ok(results.length >= 1, 'should find at least 1 result');
  assert.ok(typeof results[0].score === 'number', 'result should have score');
  assert.ok(results[0].anchor !== undefined, 'result should have anchor');

  // The most similar to deploy_anchor should be itself
  assert.strictEqual(results[0].anchor.id, 'deploy_anchor',
    'most similar anchor to itself should be itself');

  // Self-similarity should be ~1.0
  assert.ok(results[0].score > 0.99,
    `self-similarity should be ~1.0, got ${results[0].score}`);
}

async function test_pairwise_matrix() {
  const reg = freshRegistry();
  await reg.registerAnchor('pm_a', 'Alpha description for pairwise testing');
  await reg.registerAnchor('pm_b', 'Beta description for pairwise testing');
  await reg.registerAnchor('pm_c', 'Gamma description for pairwise testing');

  const { matrix, anchors, overlaps, gaps } = reg.computePairwiseMatrix();

  assert.strictEqual(matrix.length, 3, 'matrix should be 3 rows');
  matrix.forEach(row => assert.strictEqual(row.length, 3, 'each row should have 3 cols'));
  assert.strictEqual(anchors.length, 3, 'anchors array should list 3 ids');

  // Diagonal should be 1.0
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(matrix[i][i] - 1.0) < 1e-5,
      `diagonal[${i}][${i}] should be 1.0, got ${matrix[i][i]}`);
  }

  // Symmetry
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      assert.ok(Math.abs(matrix[i][j] - matrix[j][i]) < 1e-5,
        `matrix should be symmetric at [${i}][${j}]`);
    }
  }

  assert.ok(Array.isArray(overlaps), 'overlaps should be array');
  assert.ok(Array.isArray(gaps), 'gaps should be array');
}

async function test_merge_anchors() {
  const reg = freshRegistry();
  await reg.registerAnchor('merge_a', 'First anchor for merge test', { category: 'test' });
  await reg.registerAnchor('merge_b', 'Second anchor for merge test', { category: 'test' });

  const merged = await reg.mergeAnchors('merge_a', 'merge_b', 'merged_ab');

  assert.strictEqual(merged.id, 'merged_ab', 'merged anchor should have new id');
  assert.ok(merged.vector instanceof Float32Array, 'merged vector should be Float32Array');
  assert.strictEqual(merged.metadata.mergedFrom[0], 'merge_a');
  assert.strictEqual(merged.metadata.mergedFrom[1], 'merge_b');

  // Source anchors should be removed
  assert.strictEqual(reg.getAnchor('merge_a'), undefined, 'merge_a should be removed');
  assert.strictEqual(reg.getAnchor('merge_b'), undefined, 'merge_b should be removed');

  // Merged anchor should exist
  assert.ok(reg.getAnchor('merged_ab') !== undefined, 'merged_ab should exist');
}

async function test_export_import() {
  const reg = freshRegistry();
  await reg.registerAnchor('exp_a', 'Export anchor alpha', { category: 'exp', metadata: { x: 1 } });
  await reg.registerAnchor('exp_b', 'Export anchor beta',  { category: 'exp', metadata: { x: 2 } });

  const exported = reg.export();

  assert.strictEqual(exported.formatVersion, 1, 'format version should be 1');
  assert.ok(typeof exported.exportedAt === 'number', 'exportedAt should be a number');
  assert.ok(Array.isArray(exported.anchors), 'anchors should be array');
  assert.strictEqual(exported.anchors.length, 2, 'should have 2 anchors');

  // Import into a fresh registry
  const reg2 = freshRegistry();
  reg2.import(exported);

  assert.strictEqual(reg2.listAnchors().length, 2, 'imported registry should have 2 anchors');
  const a = reg2.getAnchor('exp_a');
  assert.ok(a !== undefined, 'exp_a should be importable');
  assert.strictEqual(a.category, 'exp', 'category should be preserved');
  assert.strictEqual(a.metadata.x, 1, 'metadata should be preserved');
  assert.ok(a.vector instanceof Float32Array, 'vector should be restored as Float32Array');
  assert.strictEqual(a.vector.length, 384, 'restored vector should be 384-dim');
}

async function test_list_anchors() {
  const reg = freshRegistry();
  await reg.registerAnchor('list_x', 'X anchor', { category: 'cat_x' });
  await reg.registerAnchor('list_y', 'Y anchor', { category: 'cat_y' });
  await reg.registerAnchor('list_z', 'Z anchor', { category: 'cat_x' });

  const all = reg.listAnchors();
  assert.strictEqual(all.length, 3, 'should list all 3 anchors');

  const catX = reg.listAnchors({ category: 'cat_x' });
  assert.strictEqual(catX.length, 2, 'cat_x should have 2 anchors');
  assert.ok(catX.every(a => a.category === 'cat_x'), 'all returned anchors should be cat_x');

  const catY = reg.listAnchors({ category: 'cat_y' });
  assert.strictEqual(catY.length, 1, 'cat_y should have 1 anchor');
  assert.strictEqual(catY[0].id, 'list_y');
}

// ─── Runner ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function runTests() {
  const tests = [
    test_singleton,
    test_register_anchor,
    test_update_anchor,
    test_deterministic_embedding,
    test_embedding_dimension,
    test_embedding_normalized,
    test_find_similar,
    test_pairwise_matrix,
    test_merge_anchors,
    test_export_import,
    test_list_anchors,
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
