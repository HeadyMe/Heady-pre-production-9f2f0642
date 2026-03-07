'use strict';

/**
 * test-semantic-constraints.js
 * Tests for SemanticConstraint, ConstraintSet, SemanticConstraintViolation.
 * Uses inline mocks for CSL, PhiScale, logger.
 * Run: node tests/semantic-routing/test-semantic-constraints.js
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

/** Build a Float32Array biased toward a specific index. */
function biasedVec(dim, idx, strength = 0.99) {
  const v = new Float32Array(dim).fill(0.001);
  v[idx % dim] = strength;
  return normalize(v);
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCSL = {
  cosine_similarity(a, b) { return Math.max(-1, Math.min(1, dot(a, b))); },
  soft_gate(score, threshold = 0.5, steepness = 20) {
    return 1 / (1 + Math.exp(-steepness * (score - threshold)));
  },
  normalize,
};

const mockLogger = {
  info() {}, debug() {}, warn() {}, error() {},
};

// ─── Patch require ────────────────────────────────────────────────────────────

const originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === '../core/semantic-logic') return '__SC_CSL__';
  if (request === '../core/phi-scales')     return '__SC_PHI__';
  if (request === '../utils/logger')        return '__SC_LOGGER__';
  return originalResolve(request, parent, ...rest);
};

require.cache['__SC_CSL__']    = { id: '__SC_CSL__',    filename: '__SC_CSL__',    loaded: true, exports: mockCSL };
require.cache['__SC_PHI__']    = {
  id: '__SC_PHI__', filename: '__SC_PHI__', loaded: true,
  exports: {
    PhiScale: class { constructor(o={}) { this.value = o.baseValue ?? PHI_INVERSE; } },
    PHI: 1.618033988749895,
    PHI_INVERSE,
  },
};
require.cache['__SC_LOGGER__'] = { id: '__SC_LOGGER__', filename: '__SC_LOGGER__', loaded: true, exports: mockLogger };

delete require.cache[require.resolve('../../src/scripting/semantic-constraints')];
const {
  SemanticConstraint,
  SemanticConstraintViolation,
  ConstraintSet,
} = require('../../src/scripting/semantic-constraints');

// ─── Tests ────────────────────────────────────────────────────────────────────

function test_require_passes() {
  // Provide a custom embedFn that returns a biased vector for the constraint,
  // then check with the IDENTICAL vector (similarity = 1.0) → should pass
  const constraintVec = biasedVec(DIM, 50, 0.99);
  const embedFn = () => constraintVec;

  const result = SemanticConstraint.require(
    'System must be healthy and operational',
    constraintVec,          // pass same vector as context
    { minSimilarity: 0.5, enforcement: 'soft', embedFn }
  );

  assert.ok(result.passed === true, 'identical vector should pass a 0.5 minSimilarity constraint');
  assert.ok(result.similarity > 0.99, `similarity should be ~1.0, got ${result.similarity}`);
}

function test_require_hard_fails() {
  // Build two nearly orthogonal vectors
  const constraintVec = biasedVec(DIM, 10, 0.99);
  const contextVec    = biasedVec(DIM, 200, 0.99); // different direction
  const embedFn = () => constraintVec;

  assert.throws(
    () => SemanticConstraint.require(
      'Constraint that is impossible to satisfy',
      contextVec,
      { minSimilarity: 0.99, enforcement: 'hard', embedFn }
    ),
    (err) => err instanceof SemanticConstraintViolation,
    'Hard enforcement with low similarity should throw SemanticConstraintViolation'
  );
}

function test_require_soft_fails() {
  // Orthogonal vectors → low similarity → soft fail
  const constraintVec = biasedVec(DIM, 10, 0.99);
  const contextVec    = biasedVec(DIM, 200, 0.99);
  const embedFn = () => constraintVec;

  let result;
  assert.doesNotThrow(
    () => {
      result = SemanticConstraint.require(
        'Soft constraint that will not be met',
        contextVec,
        { minSimilarity: 0.99, enforcement: 'soft', embedFn }
      );
    },
    'Soft enforcement should NOT throw'
  );

  assert.strictEqual(result.passed, false, 'soft fail should return passed=false');
  assert.ok(typeof result.similarity === 'number', 'should still return similarity');
}

function test_require_advisory() {
  const constraintVec = biasedVec(DIM, 10, 0.99);
  const contextVec    = biasedVec(DIM, 200, 0.99);
  const embedFn = () => constraintVec;

  let result;
  assert.doesNotThrow(
    () => {
      result = SemanticConstraint.require(
        'Advisory constraint, low match',
        contextVec,
        { minSimilarity: 0.99, enforcement: 'advisory', embedFn }
      );
    },
    'Advisory enforcement should never throw'
  );
  // Advisory returns a result object (passed may be false but no throw)
  assert.ok(typeof result === 'object', 'advisory should return a result object');
}

function test_and_composition() {
  // Create constraints where c1 passes but c2 fails
  const vecA = biasedVec(DIM, 10, 0.99);
  const vecB = biasedVec(DIM, 200, 0.99);

  const c1 = new SemanticConstraint('Constraint 1 passes', {
    minSimilarity: 0.5,
    enforcement: 'soft',
    embedFn: () => vecA,  // will match vecA with sim ~1.0 → passes
  });
  const c2 = new SemanticConstraint('Constraint 2 fails', {
    minSimilarity: 0.99,
    enforcement: 'soft',
    embedFn: () => vecB,  // will match vecA with low sim → fails
  });

  const result = SemanticConstraint.and([c1, c2], vecA);

  assert.ok(typeof result === 'object', 'and() should return an object');
  assert.ok('passed' in result, 'should have passed field');
  assert.ok('similarity' in result, 'should have similarity field');
  assert.ok(Array.isArray(result.results), 'should have results array');
  assert.strictEqual(result.results.length, 2, 'should have 2 sub-results');

  // AND: all must pass → c2 fails → overall fails
  assert.strictEqual(result.passed, false, 'AND with one failing constraint should fail');
}

function test_or_composition() {
  const vecA = biasedVec(DIM, 10, 0.99);
  const vecB = biasedVec(DIM, 200, 0.99);

  const c1 = new SemanticConstraint('OR constraint 1 (fails)', {
    minSimilarity: 0.99,
    enforcement: 'soft',
    embedFn: () => vecB,  // low match
  });
  const c2 = new SemanticConstraint('OR constraint 2 (passes)', {
    minSimilarity: 0.5,
    enforcement: 'soft',
    embedFn: () => vecA,  // high match
  });

  const result = SemanticConstraint.or([c1, c2], vecA);

  assert.ok(typeof result === 'object', 'or() should return an object');
  assert.ok('passed' in result, 'should have passed field');
  assert.ok('similarity' in result, 'should have similarity field');
  assert.ok(Array.isArray(result.results), 'should have results array');

  // OR: at least one must pass → c2 passes → overall passes
  assert.strictEqual(result.passed, true, 'OR with one passing constraint should pass');
}

function test_not_composition() {
  const constraintVec = biasedVec(DIM, 10, 0.99);
  const contextVec    = biasedVec(DIM, 200, 0.99); // near-orthogonal

  const c = new SemanticConstraint('Something forbidden', {
    minSimilarity: 0.5,
    enforcement: 'soft',
    embedFn: () => constraintVec,
  });

  const result = SemanticConstraint.not(c, contextVec);

  assert.ok(typeof result === 'object', 'not() should return an object');
  assert.ok('passed' in result, 'should have passed field');
  assert.ok('similarity' in result, 'should have similarity field');
  assert.ok('invertedSimilarity' in result, 'should have invertedSimilarity field');

  // NOT: similarity = 1 - raw_sim; since contextVec is orthogonal, raw_sim is low
  // → inverted similarity is high → should pass
  assert.ok(result.similarity >= 0 && result.similarity <= 2,
    'inverted similarity should be in valid range');
}

function test_semantic_inertia() {
  const constraintVec = biasedVec(DIM, 50, 0.99);
  const c = new SemanticConstraint('Inertia test constraint', {
    minSimilarity: 0.85,
    enforcement: 'soft',
    embedFn: () => constraintVec,
    inertiaWindow: 3,
  });

  // Record enough checks to trigger inertia
  const passingVec = constraintVec; // sim ~1.0
  for (let i = 0; i < 5; i++) {
    c.check(passingVec);
  }

  assert.ok(typeof c.accumulatedConfidence === 'number',
    'accumulatedConfidence should be a number');
  assert.ok(c.accumulatedConfidence >= 0 && c.accumulatedConfidence <= 1,
    `accumulatedConfidence should be in [0,1], got ${c.accumulatedConfidence}`);
  assert.ok(c._history.length > 0, 'history should be recorded');
}

function test_constraint_set() {
  const vecA = biasedVec(DIM, 10, 0.99);
  const vecB = biasedVec(DIM, 200, 0.99);

  const cs = new ConstraintSet('TestSet');
  assert.strictEqual(cs.size, 0, 'empty set should have size 0');

  const c1 = new SemanticConstraint('Must be like vecA', {
    minSimilarity: 0.5,
    enforcement: 'soft',
    embedFn: () => vecA,
  });
  const c2 = new SemanticConstraint('Must be like vecB', {
    minSimilarity: 0.5,
    enforcement: 'soft',
    embedFn: () => vecB,
  });

  cs.add('cstr_a', c1);
  cs.add('cstr_b', c2);
  assert.strictEqual(cs.size, 2, 'set should have 2 constraints');

  // Check all with vecA — c1 will pass, c2 will fail
  const { allPassed, results, violationCount } = cs.checkAll(vecA);
  assert.ok(results instanceof Map, 'results should be a Map');
  assert.strictEqual(results.size, 2, 'results should have 2 entries');
  assert.ok(typeof violationCount === 'number', 'violationCount should be a number');
  // c1 (vecA vs vecA) should pass; c2 (vecB vs vecA) should fail
  assert.strictEqual(allPassed, false, 'not all constraints pass (c2 fails)');
  assert.ok(violationCount >= 1, 'should have at least 1 violation');
}

function test_constraint_set_get_violations() {
  const vecA = biasedVec(DIM, 10, 0.99);
  const vecB = biasedVec(DIM, 200, 0.99);

  const cs = new ConstraintSet('ViolationTest');

  const failing = new SemanticConstraint('Always fails with vecA as context', {
    minSimilarity: 0.99,
    enforcement: 'soft',
    embedFn: () => vecB,  // low sim when context is vecA
  });
  cs.add('fail_me', failing);

  cs.checkAll(vecA); // run to build history

  const violations = cs.getViolations();
  assert.ok(Array.isArray(violations), 'getViolations should return array');
  assert.ok(violations.length >= 1, 'should have at least 1 violation after failed check');
  const v = violations[0];
  assert.ok('name' in v, 'violation should have name');
  assert.ok('similarity' in v, 'violation should have similarity');
  assert.ok('description' in v, 'violation should have description');
}

function test_violation_error() {
  const err = new SemanticConstraintViolation(
    'Must be safe before deployment',
    0.45,
    0.85,
    { context: 'test' }
  );

  assert.ok(err instanceof Error, 'SemanticConstraintViolation should extend Error');
  assert.ok(err instanceof SemanticConstraintViolation, 'should be violation instance');
  assert.strictEqual(err.name, 'SemanticConstraintViolation', 'name should be correct');
  assert.strictEqual(err.similarity, 0.45, 'similarity should be preserved');
  assert.strictEqual(err.minSimilarity, 0.85, 'minSimilarity should be preserved');
  assert.strictEqual(err.constraintDescription, 'Must be safe before deployment');
  assert.deepStrictEqual(err.context, { context: 'test' });
  assert.ok(typeof err.message === 'string' && err.message.length > 0,
    'error message should be non-empty');
  assert.ok(err.message.includes('0.4500') || err.message.includes('0.45'),
    'message should contain similarity value');
}

// ─── Runner ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function runTests() {
  const tests = [
    test_require_passes,
    test_require_hard_fails,
    test_require_soft_fails,
    test_require_advisory,
    test_and_composition,
    test_or_composition,
    test_not_composition,
    test_semantic_inertia,
    test_constraint_set,
    test_constraint_set_get_violations,
    test_violation_error,
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
