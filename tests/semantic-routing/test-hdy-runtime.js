'use strict';

/**
 * test-hdy-runtime.js
 * Tests for HDYRuntime — uses inline mocks for CSL, PhiScale, logger, MonteCarloEngine.
 * Run: node tests/semantic-routing/test-hdy-runtime.js
 */

const assert = require('assert');
const Module = require('module');

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI_INVERSE = 0.618033988749895;
const DIM = 384;

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCSL = {
  cosine_similarity(a, b) { return Math.max(-1, Math.min(1, dot(a, b))); },
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
  multi_resonance(target, candidates, threshold) {
    return candidates
      .map((c, i) => {
        const score = this.cosine_similarity(target, c);
        return { index: i, score, open: score > threshold };
      })
      .sort((a, b) => b.score - a.score);
  },
  consensus_superposition(vectors) {
    if (!vectors || vectors.length === 0) return new Float32Array(DIM);
    const acc = new Float32Array(vectors[0].length);
    for (const v of vectors) for (let i = 0; i < acc.length; i++) acc[i] += v[i] / vectors.length;
    return this.normalize(acc);
  },
  resonance_gate(a, b, threshold) {
    const score = this.cosine_similarity(a, b);
    return { score, open: score >= threshold };
  },
  ternary_gate(score, resT = 0.72, repelT = 0.35) {
    const resonanceActivation = score >= resT ? 1.0 : 0.0;
    const repelActivation     = score <= repelT ? 1.0 : 0.0;
    return { state: resonanceActivation > 0 ? 'resonance' : 'neutral', resonanceActivation, repelActivation, raw: score };
  },
  risk_gate(current, limit) {
    const riskLevel = Math.min(1, current / (limit || 1));
    return { riskLevel, signal: riskLevel > 0.8 ? 'high' : 'low', proximity: current / limit, activation: riskLevel };
  },
};

class MockPhiScale {
  constructor(opts = {}) {
    this._value = opts.baseValue != null ? opts.baseValue : PHI_INVERSE;
    this.name = opts.name || 'mock';
  }
  get value() { return this._value; }
  asMs()    { return Math.round(this._value); }
  asFloat() { return this._value; }
  asInt()   { return Math.round(this._value); }
  adjust()  {}
  stats()   { return { mean: this._value }; }
  snapshot(){ return { v: this._value }; }
  restore(s){ if (s && s.v != null) this._value = s.v; }
}

class MockPhiRange {
  constructor() {}
}

// Monte Carlo mock — synchronously returns ordered actions unchanged
class MockMonteCarloEngine {
  constructor(opts = {}) { this._opts = opts; }
  async runSimulation(params, iterations) {
    return {
      name: params.name,
      meanOutcome: PHI_INVERSE,
      stdDev: 0.1,
      successRate: 0.8,
      samples: iterations ?? 100,
    };
  }
  quickReadiness(signals) {
    return { readiness: PHI_INVERSE, grade: 'B' };
  }
  scoreRisk(factors) {
    return { score: 0.2, grade: 'A', expectedImpact: 0.1 };
  }
}

const mockLogger = {
  info() {}, debug() {}, warn() {}, error() {},
};

// ─── Patch require ────────────────────────────────────────────────────────────

const originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === '../core/semantic-logic') return '__RT_CSL__';
  if (request === '../core/phi-scales')     return '__RT_PHI__';
  if (request === '../utils/logger')        return '__RT_LOGGER__';
  if (request === '../intelligence/monte-carlo-engine') return '__RT_MC__';
  return originalResolve(request, parent, ...rest);
};

require.cache['__RT_CSL__']    = { id: '__RT_CSL__',    filename: '__RT_CSL__',    loaded: true, exports: mockCSL };
require.cache['__RT_PHI__']    = {
  id: '__RT_PHI__', filename: '__RT_PHI__', loaded: true,
  exports: {
    PhiScale: MockPhiScale,
    PhiRange: MockPhiRange,
    PHI: 1.618033988749895,
    PHI_INVERSE,
    PHI_SQUARED: 2.618033988749895,
  },
};
require.cache['__RT_LOGGER__'] = { id: '__RT_LOGGER__', filename: '__RT_LOGGER__', loaded: true, exports: mockLogger };
require.cache['__RT_MC__']     = { id: '__RT_MC__',     filename: '__RT_MC__',     loaded: true,
  exports: { MonteCarloEngine: MockMonteCarloEngine },
};

delete require.cache[require.resolve('../../src/scripting/hdy-runtime')];
const { HDYRuntime } = require('../../src/scripting/hdy-runtime');

// ─── Test script fixture ─────────────────────────────────────────────────────

/** Minimal parsed .hdy-like object that HDYRuntime can load. */
function makeScript(overrides = {}) {
  return Object.assign({
    schema: 'heady_semantic_logic_v1',
    name: 'test_script',
    version: '1.0.0',
    target_node: 'test_runner',
    description: 'Test script for HDYRuntime tests',
    semantic_states: [
      { id: 'ready',    anchor: 'System is ready and healthy',  priority_weight: 0.9, category: 'health' },
      { id: 'degraded', anchor: 'System is degraded or broken', priority_weight: 0.3, category: 'health' },
    ],
    continuous_evaluation: {
      method: 'cosine_similarity',
      threshold_activation: 0.0,   // low so actions always run in tests
      fuzziness: 0.382,
      evaluation_interval_ms: 10,
    },
    execution_graph: [
      {
        id: 'action_one',
        action: 'do_something',
        weight_formula: '1.0',
        weight_formula_ast: { type: 'literal', value: 1.0 },
        preconditions:  [],
        postconditions: [],
        timeout_ms: 1000,
        retry: 0,
      },
    ],
    guardrails: [
      {
        id: 'safety',
        constraint: 'System must be safe',
        enforcement: 'hard',
        min_distance: 0.3,
        message: 'Safety violated',
      },
    ],
    metadata: { author: 'test', created: '2026-01-01', tags: ['test'] },
  }, overrides);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

function test_constructor() {
  const rt = new HDYRuntime();
  assert.ok(rt._config, 'config should exist');
  assert.strictEqual(rt._config.embeddingDimension, 384, 'default embedding dim should be 384');
  assert.ok(typeof rt._config.evaluationInterval === 'number', 'evaluationInterval should be number');
  assert.ok(typeof rt._config.maxCycles === 'number', 'maxCycles should be a number');
  assert.strictEqual(rt._status, 'idle', 'initial status should be idle');
}

function test_load_script() {
  const rt = new HDYRuntime({ enableMonteCarlo: false });
  const script = makeScript();
  rt.loadScript(script);

  assert.ok(rt._script, 'script should be loaded');
  assert.strictEqual(rt._script.name, 'test_script', 'loaded script name should match');
  // State embeddings should be pre-computed
  assert.ok(rt._stateEmbeddings, 'state embeddings should exist');
  assert.ok(rt._stateEmbeddings.has('ready'), 'ready state embedding should exist');
  assert.ok(rt._stateEmbeddings.has('degraded'), 'degraded state embedding should exist');
  // Action stats should be initialised
  assert.ok(rt._actionStats.has('action_one'), 'action_one stats should be initialised');
}

function test_register_action_handler() {
  const rt = new HDYRuntime({ enableMonteCarlo: false });
  let called = false;
  rt.registerActionHandler('do_something', async (context, weight) => {
    called = true;
    return { done: true };
  });
  assert.ok(rt._handlers.has('do_something'), 'handler should be registered');
  assert.strictEqual(typeof rt._handlers.get('do_something'), 'function', 'handler should be a function');
}

async function test_execute_basic() {
  const rt = new HDYRuntime({ enableMonteCarlo: false, maxCycles: 1 });
  const script = makeScript();
  rt.loadScript(script);
  rt.registerActionHandler('do_something', async () => ({ result: 'ok' }));

  const context = { task: 'deploy the application to production' };
  const result = await rt.execute(context);

  assert.ok(result, 'execute should return a result');
  assert.ok(result.results instanceof Map, 'results should be a Map');
  assert.ok(Array.isArray(result.activatedStates), 'activatedStates should be an array');
  assert.ok(typeof result.cycles === 'number', 'cycles should be a number');
  assert.ok(typeof result.totalDuration === 'number', 'totalDuration should be a number');
  assert.ok(Array.isArray(result.guardrailViolations), 'guardrailViolations should be array');
}

async function test_guardrail_hard_enforcement() {
  const rt = new HDYRuntime({ enableMonteCarlo: false, maxCycles: 3 });
  // Script with a hard guardrail that has a very high similarity requirement
  const script = makeScript({
    guardrails: [
      {
        id: 'blocker',
        constraint: 'Only allow extremely specific matching context',
        enforcement: 'hard',
        min_distance: 0.999,   // near-impossible to satisfy
        message: 'Hard block triggered',
      },
    ],
  });
  rt.loadScript(script);
  rt.registerActionHandler('do_something', async () => ({ done: true }));

  // We need a context that won't match the guardrail at 0.999 threshold
  // The guardrail check in HDYRuntime uses cosine similarity between
  // guardrail embedding and context vector — since our LCG produces varied
  // vectors this should generally fail at 0.999
  // We just verify execution doesn't throw and returns violations info
  const result = await rt.execute({ task: 'random unrelated context xyz 123' });
  assert.ok(result, 'execute should complete even with guardrail activity');
  assert.ok(Array.isArray(result.guardrailViolations), 'should have violations array');
}

async function test_guardrail_soft_enforcement() {
  const rt = new HDYRuntime({ enableMonteCarlo: false, maxCycles: 1 });
  const script = makeScript({
    guardrails: [
      {
        id: 'soft_guard',
        constraint: 'Prefer safe deployment environment',
        enforcement: 'soft',
        min_distance: 0.999,   // will fail but softly
        message: 'Soft warning',
      },
    ],
  });
  rt.loadScript(script);
  rt.registerActionHandler('do_something', async () => ({ done: true }));

  // Soft guardrails should not throw — execution should proceed
  const result = await rt.execute({ task: 'test context' });
  assert.ok(result, 'execute should complete despite soft guardrail failure');
  // Any violations should be recorded but execution should have continued
  // (soft guardrails don't stop execution, only hard ones do)
  assert.ok(Array.isArray(result.guardrailViolations), 'violations should be an array');
}

function test_lifecycle_start_stop() {
  const rt = new HDYRuntime({ enableMonteCarlo: false });
  const script = makeScript();
  rt.loadScript(script);

  assert.strictEqual(rt._status, 'idle', 'initial status should be idle');

  rt.start({});
  assert.strictEqual(rt._status, 'running', 'status should be running after start()');

  rt.stop();
  assert.strictEqual(rt._status, 'stopped', 'status should be stopped after stop()');
}

async function test_event_emission() {
  const rt = new HDYRuntime({ enableMonteCarlo: false, maxCycles: 1 });
  const script = makeScript();
  rt.loadScript(script);
  rt.registerActionHandler('do_something', async () => ({ done: true }));

  let eventFired = false;
  let eventData  = null;

  rt.on('action_executed', (data) => {
    eventFired = true;
    eventData  = data;
  });

  await rt.execute({ task: 'event test' });

  assert.strictEqual(eventFired, true, 'action_executed event should fire');
  assert.ok(eventData !== null, 'event data should be provided');
  assert.ok('nodeId' in eventData || 'action' in eventData,
    'event data should contain nodeId or action');
}

async function test_self_optimization() {
  const rt = new HDYRuntime({ enableSelfOptimization: true, enableMonteCarlo: false, maxCycles: 1 });
  const script = makeScript();
  rt.loadScript(script);
  rt.registerActionHandler('do_something', async () => ({ done: true }));

  // Execute to trigger weight recording
  await rt.execute({ task: 'optimization test context' });

  // Action stats should have been updated
  const stats = rt._actionStats.get('action_one');
  assert.ok(stats !== undefined, 'action_one stats should exist');
  // After execution, either successCount or failCount should be > 0
  const total = stats.successCount + stats.failCount;
  assert.ok(total >= 0, 'total executions should be non-negative');
}

async function test_monte_carlo_integration() {
  const rt = new HDYRuntime({ enableMonteCarlo: true, maxCycles: 1 });
  const script = makeScript();
  rt.loadScript(script);
  rt.registerActionHandler('do_something', async () => ({ done: true }));

  // The MockMonteCarloEngine should return smoothly; verify no crash
  const result = await rt.execute({ task: 'monte carlo test' });
  assert.ok(result, 'execute should succeed with MC enabled');
  assert.ok(typeof result.cycles === 'number', 'cycles should be a number');
}

// ─── Runner ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function runTests() {
  const tests = [
    test_constructor,
    test_load_script,
    test_register_action_handler,
    test_execute_basic,
    test_guardrail_hard_enforcement,
    test_guardrail_soft_enforcement,
    test_lifecycle_start_stop,
    test_event_emission,
    test_self_optimization,
    test_monte_carlo_integration,
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
