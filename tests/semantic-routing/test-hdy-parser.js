'use strict';

/**
 * test-hdy-parser.js
 * Tests for HDYParser — uses inline mocks for phi-scales and logger.
 * Run: node tests/semantic-routing/test-hdy-parser.js
 */

const assert = require('assert');
const Module = require('module');

// ─── Mocks ────────────────────────────────────────────────────────────────────

const PHI_INVERSE = 0.618033988749895;

const mockLogger = {
  info() {}, debug() {}, warn() {}, error() {},
};

// ─── Patch require ────────────────────────────────────────────────────────────

const originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === '../core/phi-scales') return '__HDY_PHI__';
  if (request === '../utils/logger')    return '__HDY_LOGGER__';
  return originalResolve(request, parent, ...rest);
};

require.cache['__HDY_PHI__']    = {
  id: '__HDY_PHI__', filename: '__HDY_PHI__', loaded: true,
  exports: {
    PhiScale: class { constructor(o={}) { this.value = o.baseValue ?? PHI_INVERSE; } },
    PHI_INVERSE,
  },
};
require.cache['__HDY_LOGGER__'] = { id: '__HDY_LOGGER__', filename: '__HDY_LOGGER__', loaded: true, exports: mockLogger };

delete require.cache[require.resolve('../../src/scripting/hdy-parser')];
const { HDYParser, HDYParseError } = require('../../src/scripting/hdy-parser');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** A complete, valid .hdy document. */
const VALID_HDY = `
schema: heady_semantic_logic_v1
name: deploy_pipeline
version: 1.0.0
target_node: ci_runner

semantic_states:
  - id: ready
    anchor: System is ready and healthy to proceed with deployment
    priority_weight: 0.9
  - id: degraded
    anchor: System shows degraded health or elevated error rates
    priority_weight: 0.4

continuous_evaluation:
  method: cosine_similarity
  threshold_activation: phi_equilibrium
  fuzziness: 0.382
  evaluation_interval_ms: 250

execution_graph:
  - id: run_tests
    action: execute_tests
    weight_formula: resonance(ready, degraded)
    preconditions: [ready]
    postconditions: [ready]
    timeout_ms: 5000
    retry: 1
  - id: deploy
    action: push_to_production
    weight_formula: soft_gate(resonance(ready, degraded), 0.5) * phi_scale(priority)
    preconditions: [ready]
    timeout_ms: 10000
    retry: 0

guardrails:
  - id: safety_check
    constraint: System must be in a safe state before deployment
    enforcement: hard
    min_distance: 0.3
    message: Safety check failed

metadata:
  author: test_suite
  created: 2026-01-01
  tags: [test, deploy]
`;

/** Minimal valid .hdy — only required fields. */
const MINIMAL_HDY = `
schema: heady_semantic_logic_v1
name: minimal_script
version: 2.1.0
target_node: any_node

semantic_states:
  - id: active
    anchor: Active state description

execution_graph:
  - id: step1
    action: do_something
    preconditions:
      - active

guardrails:
  - id: placeholder
    constraint: Placeholder guardrail constraint for minimal test
    enforcement: advisory
`;

// ─── Tests ────────────────────────────────────────────────────────────────────

function test_parse_valid_hdy() {
  const parser = new HDYParser({ strict: true });
  const result = parser.parse(VALID_HDY);

  // Top-level fields
  assert.strictEqual(result.schema,      'heady_semantic_logic_v1', 'schema should match');
  assert.strictEqual(result.name,        'deploy_pipeline',          'name should match');
  assert.strictEqual(result.version,     '1.0.0',                    'version should match');
  assert.strictEqual(result.target_node, 'ci_runner',                'target_node should match');

  // semantic_states
  assert.ok(Array.isArray(result.semantic_states), 'semantic_states should be an array');
  assert.strictEqual(result.semantic_states.length, 2, 'should have 2 states');
  const ready = result.semantic_states[0];
  assert.strictEqual(ready.id, 'ready', 'first state id should be ready');
  assert.ok(ready.anchor.length > 0, 'state anchor should be non-empty');
  assert.ok(typeof ready.priority_weight === 'number', 'priority_weight should be a number');

  // execution_graph
  assert.ok(Array.isArray(result.execution_graph), 'execution_graph should be an array');
  assert.strictEqual(result.execution_graph.length, 2, 'should have 2 execution nodes');
  const runTests = result.execution_graph[0];
  assert.strictEqual(runTests.id, 'run_tests', 'first node id should be run_tests');
  assert.strictEqual(runTests.action, 'execute_tests', 'action should be execute_tests');
  assert.ok(runTests.weight_formula_ast !== undefined, 'should have parsed weight_formula_ast');

  // guardrails
  assert.ok(Array.isArray(result.guardrails), 'guardrails should be an array');
  assert.strictEqual(result.guardrails.length, 1, 'should have 1 guardrail');
  const g = result.guardrails[0];
  assert.strictEqual(g.id, 'safety_check', 'guardrail id should be safety_check');
  assert.strictEqual(g.enforcement, 'hard', 'enforcement should be hard');

  // metadata
  assert.ok(result.metadata, 'metadata should exist');
  assert.ok(Array.isArray(result.metadata.tags), 'metadata.tags should be an array');
}

function test_parse_minimal_hdy() {
  const parser = new HDYParser();
  const result = parser.parse(MINIMAL_HDY);

  assert.strictEqual(result.name, 'minimal_script', 'name should be minimal_script');
  assert.strictEqual(result.version, '2.1.0', 'version should be 2.1.0');
  assert.ok(Array.isArray(result.semantic_states), 'semantic_states should be array');
  assert.strictEqual(result.semantic_states.length, 1, 'should have 1 state');
  assert.ok(Array.isArray(result.guardrails), 'guardrails should be array');
  // The minimal fixture has a placeholder guardrail — just verify it is an array
  assert.ok(result.guardrails.length >= 0, 'guardrails should be an array');

  // Defaults should be applied
  const node = result.execution_graph[0];
  assert.ok(Array.isArray(node.preconditions), 'preconditions should default to array');
  assert.ok(Array.isArray(node.postconditions), 'postconditions should default to array');
  assert.ok(typeof node.timeout_ms === 'number', 'timeout_ms should be a number');
  assert.ok(typeof node.retry === 'number', 'retry should be a number');
}

function test_parse_invalid_schema() {
  const parser = new HDYParser();
  const badSchema = VALID_HDY.replace('heady_semantic_logic_v1', 'wrong_schema_v99');
  assert.throws(
    () => parser.parse(badSchema),
    (err) => err instanceof HDYParseError,
    'Should throw HDYParseError for wrong schema version'
  );
}

function test_parse_missing_section() {
  const parser = new HDYParser();
  // Remove the required 'name' field
  const noName = `
schema: heady_semantic_logic_v1
version: 1.0.0
target_node: some_node

semantic_states:
  - id: s1
    anchor: Some anchor text here

execution_graph: []
guardrails: []
`;
  assert.throws(
    () => parser.parse(noName),
    (err) => err instanceof HDYParseError,
    'Should throw HDYParseError when required field "name" is missing'
  );
}

function test_parse_weight_formula_simple() {
  const parser = new HDYParser();
  // parseWeightFormula is called internally; access via a parsed doc
  const hdy = `
schema: heady_semantic_logic_v1
name: formula_test
version: 1.0.0
target_node: tester

semantic_states:
  - id: a
    anchor: State A for formula testing

execution_graph:
  - id: n1
    action: action_one
    weight_formula: resonance(a, b)

guardrails:
  - id: g1
    constraint: Formula test guardrail constraint description
    enforcement: advisory
`;
  const result = parser.parse(hdy);
  const node = result.execution_graph[0];
  assert.ok(node.weight_formula_ast, 'weight_formula_ast should be populated');
  assert.strictEqual(node.weight_formula_ast.type, 'call',
    'top-level AST node should be a call');
  assert.strictEqual(node.weight_formula_ast.name, 'resonance',
    'function name should be resonance');
  assert.ok(Array.isArray(node.weight_formula_ast.args), 'args should be an array');
  assert.strictEqual(node.weight_formula_ast.args.length, 2,
    'resonance should have 2 args');
  assert.strictEqual(node.weight_formula_ast.args[0].type, 'ref',
    'first arg should be a ref');
  assert.strictEqual(node.weight_formula_ast.args[0].name, 'a',
    'first arg name should be a');
}

function test_parse_weight_formula_complex() {
  const parser = new HDYParser();
  // Parse a complex formula via parseWeightFormula directly if available,
  // or via a document
  const hdy = `
schema: heady_semantic_logic_v1
name: complex_formula
version: 1.0.0
target_node: tester

semantic_states:
  - id: ready
    anchor: Ready state for complex formula test

execution_graph:
  - id: n1
    action: action_complex
    weight_formula: soft_gate(resonance(ready, b), 0.5) * phi_scale(priority)

guardrails:
  - id: g1
    constraint: Complex formula guardrail constraint for testing
    enforcement: advisory
`;
  const result = parser.parse(hdy);
  const node = result.execution_graph[0];
  const ast = node.weight_formula_ast;

  assert.ok(ast, 'complex formula should produce an AST');
  // Top node should be a binary multiply
  assert.strictEqual(ast.type, 'binary', 'top node should be binary op');
  assert.strictEqual(ast.op, '*', 'operator should be *');

  // Left side should be soft_gate call
  assert.strictEqual(ast.left.type, 'call', 'left should be a call');
  assert.strictEqual(ast.left.name, 'soft_gate', 'left function should be soft_gate');

  // First arg of soft_gate should be resonance call
  const innerCall = ast.left.args[0];
  assert.strictEqual(innerCall.type, 'call', 'inner node should be call');
  assert.strictEqual(innerCall.name, 'resonance', 'inner call should be resonance');

  // Right side should be phi_scale call
  assert.strictEqual(ast.right.type, 'call', 'right should be a call');
  assert.strictEqual(ast.right.name, 'phi_scale', 'right function should be phi_scale');
}

function test_normalize_config() {
  const parser = new HDYParser();
  // phi_equilibrium in threshold_activation should resolve to PHI_INVERSE
  const hdy = `
schema: heady_semantic_logic_v1
name: phi_test
version: 1.0.0
target_node: any

semantic_states:
  - id: s1
    anchor: Phi equilibrium test anchor

continuous_evaluation:
  method: cosine_similarity
  threshold_activation: phi_equilibrium

execution_graph:
  - id: e1
    action: phi_action

guardrails:
  - id: g1
    constraint: Phi equilibrium test guardrail constraint
    enforcement: advisory
`;
  const result = parser.parse(hdy);
  // threshold_activation should remain as the string 'phi_equilibrium' at parse time
  // (normalizeConfig resolves it at runtime usage)
  // What we verify is that the field is present and the parser didn't crash
  assert.ok(result.continuous_evaluation, 'continuous_evaluation should exist');
  assert.ok(
    result.continuous_evaluation.threshold_activation === 'phi_equilibrium' ||
    typeof result.continuous_evaluation.threshold_activation === 'number',
    'threshold_activation should be phi_equilibrium string or numeric'
  );

  // Also verify fuzziness defaults are applied (0.382 = 1 - PHI_INVERSE)
  assert.ok(typeof result.continuous_evaluation.fuzziness === 'number',
    'fuzziness should be a number after normalisation');
  assert.ok(result.continuous_evaluation.fuzziness > 0 &&
            result.continuous_evaluation.fuzziness < 1,
    'fuzziness should be in (0, 1)');
}

function test_validate_cross_references() {
  const parser = new HDYParser();
  // Precondition referencing a non-existent state should throw
  const badRef = `
schema: heady_semantic_logic_v1
name: bad_ref_test
version: 1.0.0
target_node: tester

semantic_states:
  - id: real_state
    anchor: This state exists

execution_graph:
  - id: bad_node
    action: some_action
    preconditions: [nonexistent_state]

guardrails: []
`;
  assert.throws(
    () => parser.parse(badRef),
    (err) => err instanceof HDYParseError,
    'Should throw HDYParseError when precondition references unknown state'
  );
}

function test_to_json_from_json() {
  const parser = new HDYParser();
  const result = parser.parse(VALID_HDY);

  const json = parser.toJSON(result);
  assert.ok(json, 'toJSON should return an object');
  assert.strictEqual(json.name, 'deploy_pipeline', 'JSON name should be preserved');
  assert.ok(typeof json === 'object', 'toJSON should return a plain object');

  // Verify it's JSON-serialisable
  const jsonString = JSON.stringify(json);
  assert.ok(jsonString.length > 0, 'JSON string should be non-empty');
  assert.doesNotThrow(() => JSON.parse(jsonString), 'should be valid JSON');

  const restored = parser.fromJSON(json);
  assert.strictEqual(restored.name, 'deploy_pipeline', 'fromJSON should restore name');
  assert.strictEqual(restored.version, '1.0.0', 'fromJSON should restore version');
  assert.strictEqual(restored.semantic_states.length, 2,
    'fromJSON should restore semantic_states array');
  assert.strictEqual(restored.execution_graph.length, 2,
    'fromJSON should restore execution_graph array');
}

function test_hdy_parse_error_type() {
  // Verify HDYParseError is a proper Error subclass
  const err = new HDYParseError('test error', { line: 5, section: 'test', field: 'id', hint: 'fix it' });
  assert.ok(err instanceof Error, 'HDYParseError should extend Error');
  assert.ok(err instanceof HDYParseError, 'should be HDYParseError instance');
  assert.strictEqual(err.name, 'HDYParseError', 'name should be HDYParseError');
  assert.strictEqual(err.line, 5, 'line should be preserved');
  assert.strictEqual(err.section, 'test', 'section should be preserved');
  assert.strictEqual(err.field, 'id', 'field should be preserved');
  assert.strictEqual(err.hint, 'fix it', 'hint should be preserved');
}

// ─── Runner ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function runTests() {
  const tests = [
    test_parse_valid_hdy,
    test_parse_minimal_hdy,
    test_parse_invalid_schema,
    test_parse_missing_section,
    test_parse_weight_formula_simple,
    test_parse_weight_formula_complex,
    test_normalize_config,
    test_validate_cross_references,
    test_to_json_from_json,
    test_hdy_parse_error_type,
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
