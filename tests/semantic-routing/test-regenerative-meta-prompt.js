'use strict';

/**
 * test-regenerative-meta-prompt.js
 * Tests for RegenerativePrompt — uses inline mocks for CSL, PhiScale, logger.
 * Run: node tests/semantic-routing/test-regenerative-meta-prompt.js
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

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCSL = {
  cosine_similarity(a, b) { return Math.max(-1, Math.min(1, dot(a, b))); },
  normalize,
  norm(v) {
    let s = 0;
    for (let i = 0; i < v.length; i++) s += v[i] * v[i];
    return Math.sqrt(s);
  },
  superposition_gate(a, b) {
    const out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = (a[i] + b[i]) * 0.5;
    return normalize(out);
  },
  consensus_superposition(vectors) {
    if (!vectors || vectors.length === 0) return new Float32Array(DIM);
    const acc = new Float32Array(vectors[0].length);
    for (const v of vectors) for (let i = 0; i < acc.length; i++) acc[i] += v[i] / vectors.length;
    return normalize(acc);
  },
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
  snapshot() { return { v: this._value }; }
  restore(s) { if (s && s.v != null) this._value = s.v; }
}

const mockLogger = {
  info() {}, debug() {}, warn() {}, error() {},
};

// ─── Patch require ────────────────────────────────────────────────────────────

const originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === '../core/semantic-logic') return '__RMP_CSL__';
  if (request === '../core/phi-scales')     return '__RMP_PHI__';
  if (request === '../utils/logger')        return '__RMP_LOGGER__';
  return originalResolve(request, parent, ...rest);
};

require.cache['__RMP_CSL__']    = { id: '__RMP_CSL__',    filename: '__RMP_CSL__',    loaded: true, exports: mockCSL };
require.cache['__RMP_PHI__']    = {
  id: '__RMP_PHI__', filename: '__RMP_PHI__', loaded: true,
  exports: {
    PhiScale: MockPhiScale,
    PhiRange: class { constructor() {} },
    PHI: 1.618033988749895,
    PHI_INVERSE,
    PHI_SQUARED: 2.618033988749895,
  },
};
require.cache['__RMP_LOGGER__'] = { id: '__RMP_LOGGER__', filename: '__RMP_LOGGER__', loaded: true, exports: mockLogger };

delete require.cache[require.resolve('../../src/prompts/regenerative-meta-prompt')];
const { RegenerativePrompt } = require('../../src/prompts/regenerative-meta-prompt');

// ─── Helpers for building prompts ─────────────────────────────────────────────

function makePrompt(overrides = {}) {
  return new RegenerativePrompt(Object.assign({
    name:        'test-prompt',
    version:     '1.0.0',
    description: 'Test regenerative meta-prompt',
    targetNode:  'test_node',
  }, overrides));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

function test_constructor() {
  const p = makePrompt();
  assert.strictEqual(p.name, 'test-prompt', 'name should be stored');
  assert.strictEqual(p.version, '1.0.0', 'version should be stored');
  assert.strictEqual(p.description, 'Test regenerative meta-prompt');
  assert.strictEqual(p.targetNode, 'test_node');
  assert.ok(Array.isArray(p.semanticAnchors), 'semanticAnchors should be array');
  assert.ok(Array.isArray(p.toolRegistrations), 'toolRegistrations should be array');
  assert.ok(Array.isArray(p.systemPrerequisites), 'systemPrerequisites should be array');
  assert.ok(Array.isArray(p.contextRequirements), 'contextRequirements should be array');
  assert.strictEqual(p.embeddingDimension, 384, 'default embedding dimension should be 384');
}

async function test_bootstrap_all_pass() {
  const p = makePrompt({ name: 'bootstrap-pass' });

  // Add anchors (no external endpoint probing needed for anchors)
  p.semanticAnchors = [
    { id: 'anchor_a', description: 'Alpha anchor for bootstrap test' },
    { id: 'anchor_b', description: 'Beta anchor for bootstrap test' },
  ];
  p.executionGraph = { node1: { description: 'First node', type: 'action' } };
  // No tools or prereqs — so skip checks trivially pass

  const result = await p.bootstrap({ skipToolChecks: true, skipPrereqChecks: true });

  assert.ok(result, 'bootstrap should return a result');
  assert.ok('ready' in result, 'result should have ready field');
  assert.ok('confidence' in result, 'result should have confidence field');
  assert.ok('missingRequirements' in result, 'result should have missingRequirements');
  assert.ok('failedPrerequisites' in result, 'result should have failedPrerequisites');
  assert.ok('bootstrapTime' in result, 'result should have bootstrapTime');

  assert.ok(typeof result.confidence === 'number', 'confidence should be a number');
  assert.ok(result.confidence >= 0 && result.confidence <= 1,
    `confidence should be in [0,1], got ${result.confidence}`);
}

async function test_bootstrap_missing_tool() {
  const p = makePrompt({ name: 'bootstrap-fail' });

  // Add a tool with a DEAD endpoint (mock returns reachable=false for 'DEAD' URLs)
  p.toolRegistrations = [
    { name: 'broken-tool', type: 'api', endpoint: 'http://DEAD-endpoint.internal/api', authRequired: false },
  ];

  const result = await p.bootstrap({ skipPrereqChecks: true, timeoutMs: 200 });

  assert.ok(result, 'bootstrap should still return a result (not throw)');
  assert.ok(Array.isArray(result.failedPrerequisites), 'should have failedPrerequisites array');
  // The DEAD endpoint should be in failedPrerequisites
  assert.ok(result.failedPrerequisites.length > 0,
    'Should report failed prerequisites for unreachable tools');
  assert.ok(result.failedPrerequisites.some(p => p.includes('broken-tool')),
    'broken-tool should appear in failedPrerequisites');
}

function test_serialize_deserialize() {
  const p = makePrompt({ name: 'ser-deser-test', version: '2.0.0', description: 'Serialization test prompt' });
  p.semanticAnchors = [
    { id: 'anch1', description: 'First anchor for serialization', vector: new Float32Array(384).fill(0.1) },
    { id: 'anch2', description: 'Second anchor for serialization', vector: new Float32Array(384).fill(0.2) },
  ];
  p.toolRegistrations   = [{ name: 'tool_a', type: 'api', endpoint: 'http://api.example.com', authRequired: false }];
  p.contextRequirements = [{ key: 'env', description: 'Target environment', required: true }];
  p.systemPrerequisites = [{ service: 'postgres', minVersion: '14.0', healthEndpoint: 'http://db:5432/health' }];

  const serialized = p.serialize();
  assert.ok(serialized, 'serialize() should return an object');
  assert.strictEqual(serialized._type, 'RegenerativePrompt', '_type should be set');
  assert.strictEqual(serialized._schemaVersion, '1.0.0', '_schemaVersion should be set');
  assert.strictEqual(serialized.name, 'ser-deser-test', 'name should be preserved');
  assert.ok(Array.isArray(serialized.semanticAnchors), 'anchors should be array');
  // Vectors should be plain arrays in serialized form
  assert.ok(Array.isArray(serialized.semanticAnchors[0].vector),
    'vector should be plain array in serialized form');

  const restored = RegenerativePrompt.deserialize(serialized);
  assert.ok(restored instanceof RegenerativePrompt, 'deserialized should be RegenerativePrompt');
  assert.strictEqual(restored.name, 'ser-deser-test', 'name should be preserved');
  assert.strictEqual(restored.version, '2.0.0', 'version should be preserved');
  assert.strictEqual(restored.semanticAnchors.length, 2, 'anchors should be preserved');
  assert.ok(restored.semanticAnchors[0].vector instanceof Float32Array,
    'deserialized vector should be Float32Array');
  assert.strictEqual(restored.toolRegistrations.length, 1, 'tools should be preserved');
  assert.strictEqual(restored.systemPrerequisites.length, 1, 'prereqs should be preserved');
  assert.strictEqual(restored.contextRequirements.length, 1, 'requirements should be preserved');
}

function test_to_prompt_text() {
  const p = makePrompt({ name: 'text-test', description: 'Prompt text generation test' });
  p.semanticAnchors = [
    { id: 'deploy', description: 'Deploy to production', vector: new Float32Array(384).fill(0.01) },
  ];
  p.toolRegistrations   = [{ name: 'deployer', type: 'api', endpoint: 'http://deploy.svc', authRequired: true }];
  p.systemPrerequisites = [{ service: 'k8s', minVersion: '1.28', healthEndpoint: 'http://k8s:8080' }];
  p.contextRequirements = [{ key: 'environment', description: 'Target environment', required: true }];

  const text = p.toPromptText();
  assert.ok(typeof text === 'string', 'toPromptText() should return a string');
  assert.ok(text.length > 100, 'prompt text should be non-trivially long');
  assert.ok(text.includes('text-test'), 'prompt text should contain name');
  assert.ok(text.includes('deploy'), 'should mention anchor id');
  assert.ok(text.includes('deployer') || text.includes('Required Tools'), 'should mention tools section');
  assert.ok(text.includes('Bootstrap'), 'should contain Bootstrap Instructions section');
}

function test_validate_valid() {
  const p = makePrompt({ name: 'valid-prompt', version: '1.2.3' });
  p.semanticAnchors = [
    { id: 'anchor1', description: 'Valid anchor one',   vector: new Float32Array(384).fill(0.01) },
    { id: 'anchor2', description: 'Valid anchor two', vector: new Float32Array(384).fill(0.02) },
  ];
  p.toolRegistrations = [
    { name: 'api-tool', type: 'api', endpoint: 'http://api.internal', authRequired: false },
  ];

  const result = p.validate();
  assert.ok(typeof result === 'object', 'validate() should return an object');
  assert.ok('valid' in result, 'should have valid field');
  assert.ok('errors' in result, 'should have errors array');
  assert.ok('warnings' in result, 'should have warnings array');
  assert.strictEqual(result.valid, true,
    `valid prompt should pass validation, errors: ${JSON.stringify(result.errors)}`);
  assert.strictEqual(result.errors.length, 0, 'valid prompt should have no errors');
}

function test_validate_invalid() {
  // Missing name
  const p = new RegenerativePrompt({ version: '1.0.0' });
  p.name = '';   // force empty name
  const result = p.validate();
  assert.strictEqual(result.valid, false, 'prompt with no name should fail validation');
  assert.ok(result.errors.length > 0, 'should have at least one error');
  assert.ok(result.errors.some(e => e.includes('name')),
    'error should mention "name"');

  // Duplicate anchor IDs
  const p2 = makePrompt({ name: 'dup-test' });
  p2.semanticAnchors = [
    { id: 'dup_id', description: 'First anchor' },
    { id: 'dup_id', description: 'Second anchor with same id' },
  ];
  const r2 = p2.validate();
  assert.strictEqual(r2.valid, false, 'duplicate anchor IDs should fail validation');
  assert.ok(r2.errors.some(e => e.includes('duplicate')),
    'error should mention "duplicate"');
}

function test_merge() {
  const p1 = makePrompt({ name: 'prompt-a', targetNode: 'node_x' });
  p1.semanticAnchors = [
    { id: 'anchor_shared', description: 'Shared anchor description A', vector: new Float32Array(DIM).fill(0.1) },
    { id: 'anchor_only_a', description: 'Only in prompt A',            vector: new Float32Array(DIM).fill(0.2) },
  ];
  p1.toolRegistrations = [{ name: 'tool_a', type: 'api', endpoint: 'http://a.svc', authRequired: false }];

  const p2 = makePrompt({ name: 'prompt-b', targetNode: 'node_x' });
  p2.semanticAnchors = [
    { id: 'anchor_shared', description: 'Shared anchor description B', vector: new Float32Array(DIM).fill(0.15) },
    { id: 'anchor_only_b', description: 'Only in prompt B',            vector: new Float32Array(DIM).fill(0.3) },
  ];
  p2.toolRegistrations = [{ name: 'tool_b', type: 'api', endpoint: 'http://b.svc', authRequired: false }];

  const merged = p1.merge(p2);

  assert.ok(merged instanceof RegenerativePrompt, 'merge() should return a RegenerativePrompt');
  assert.ok(merged.name.includes('prompt-a') || merged.name.includes('+'),
    'merged name should contain both names');

  // Should have 3 unique anchors (shared merged to 1, plus 2 unique ones)
  assert.strictEqual(merged.semanticAnchors.length, 3,
    'merged should have 3 anchors (shared deduplicated)');

  // Tools should be union
  assert.strictEqual(merged.toolRegistrations.length, 2, 'merged should have 2 tools');
  assert.ok(merged.toolRegistrations.some(t => t.name === 'tool_a'), 'tool_a should be present');
  assert.ok(merged.toolRegistrations.some(t => t.name === 'tool_b'), 'tool_b should be present');
}

function test_diff() {
  const p1 = makePrompt({ name: 'diff-a' });
  p1.semanticAnchors = [
    { id: 'common',   description: 'Common anchor in both',   vector: new Float32Array(DIM).fill(0.1) },
    { id: 'only_in_a', description: 'Only in A',             vector: new Float32Array(DIM).fill(0.2) },
  ];
  p1.toolRegistrations = [{ name: 'shared-tool', type: 'api', endpoint: 'http://svc', authRequired: false }];

  const p2 = makePrompt({ name: 'diff-b' });
  p2.semanticAnchors = [
    { id: 'common',   description: 'Common anchor in both',   vector: new Float32Array(DIM).fill(0.1) },
    { id: 'only_in_b', description: 'Only in B',             vector: new Float32Array(DIM).fill(0.3) },
  ];
  p2.toolRegistrations = [
    { name: 'shared-tool', type: 'api', endpoint: 'http://svc', authRequired: false },
    { name: 'extra-tool',  type: 'api', endpoint: 'http://extra', authRequired: false },
  ];

  const diffResult = p1.diff(p2);

  assert.ok(diffResult, 'diff() should return a result');
  assert.ok('anchors' in diffResult, 'should have anchors section');
  assert.ok('tools' in diffResult, 'should have tools section');
  assert.ok('prereqs' in diffResult, 'should have prereqs section');

  // Anchors: only_in_b added, only_in_a removed
  assert.ok(Array.isArray(diffResult.anchors.added), 'anchors.added should be array');
  assert.ok(Array.isArray(diffResult.anchors.removed), 'anchors.removed should be array');
  assert.ok(diffResult.anchors.added.includes('only_in_b'),
    'only_in_b should be in added');
  assert.ok(diffResult.anchors.removed.includes('only_in_a'),
    'only_in_a should be in removed');

  // Tools: extra-tool added, nothing removed
  assert.ok(diffResult.tools.added.includes('extra-tool'),
    'extra-tool should appear in tools.added');
}

// ─── Runner ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function runTests() {
  const tests = [
    test_constructor,
    test_bootstrap_all_pass,
    test_bootstrap_missing_tool,
    test_serialize_deserialize,
    test_to_prompt_text,
    test_validate_valid,
    test_validate_invalid,
    test_merge,
    test_diff,
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
