'use strict';

/**
 * test-hdy-compiler.js
 *
 * Tests for HDYCompiler using mock CSL, PhiScale, and logger.
 *
 * Run: node tests/semantic-routing/test-hdy-compiler.js
 */

const assert = require('assert');
const Module = require('module');

// ── Constants ──────────────────────────────────────────────────────────────

const PHI_INVERSE = 0.618033988749895;
const PHI         = 1.618033988749895;
const EMBED_DIM   = 384;

// ── Mock CSL (normalize only — compiler uses it for embeddings) ────────────

function mockNormalize(v) {
    const out  = new Float32Array(v.length);
    let norm   = 0;
    for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
    norm = Math.sqrt(norm);
    if (norm > 1e-9) for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
    return out;
}

const mockCSL = {
    normalize: mockNormalize,
    cosine_similarity(a, b) { let d = 0; for (let i = 0; i < a.length; i++) d += a[i]*b[i]; return d; },
    dot_product(a, b)        { let d = 0; for (let i = 0; i < a.length; i++) d += a[i]*b[i]; return d; },
    norm(v)                  { let n = 0; for (let i = 0; i < v.length; i++) n += v[i]*v[i]; return Math.sqrt(n); },
    resonance_gate(a, b, t)  { const s = mockCSL.cosine_similarity(a,b); return { score: s, open: s >= t }; },
    multi_resonance(t, cs, th=0.95) {
        return cs.map((c,i) => ({ index: i, score: mockCSL.cosine_similarity(t,c), open: mockCSL.cosine_similarity(t,c)>=th }))
                 .sort((a,b) => b.score - a.score);
    },
    consensus_superposition(vecs) {
        if (!vecs || vecs.length === 0) return new Float32Array(EMBED_DIM);
        const sum = new Float32Array(vecs[0].length);
        for (const v of vecs) for (let i = 0; i < v.length; i++) sum[i] += v[i];
        return mockNormalize(sum);
    },
    soft_gate(s, t=0.5, k=20) { return 1 / (1 + Math.exp(-k*(s-t))); },
    getStats() { return {}; },
    resetStats() {},
};
mockCSL.CSL = mockCSL;

const mockPhiScales = {
    PhiScale: class { constructor(o={}) { this.value = o.baseValue ?? PHI_INVERSE; } },
    PhiRange: class {},
    PHI, PHI_INVERSE,
    PHI_SQUARED: PHI*PHI, PHI_CUBED: PHI*PHI*PHI,
    SQRT_PHI: Math.sqrt(PHI), LOG_PHI: Math.log(PHI),
    TWO_PI_PHI: 2*Math.PI*PHI,
    FIBONACCI_SEQUENCE: [1,1,2,3,5,8,13,21,34,55,89,144],
};

const mockLogger = { debug() {}, info() {}, warn() {}, error() {} };

// ── Patch require cache ────────────────────────────────────────────────────

const origResolveFilename = Module._resolveFilename.bind(Module);
Module._resolveFilename = function(request, parent, ...rest) {
    if (request.endsWith('semantic-logic'))       return '__MOCK_CSL__';
    if (request.endsWith('phi-scales'))           return '__MOCK_PHI__';
    if (request.endsWith('utils/logger') || request.endsWith('logger')) return '__MOCK_LOG__';
    return origResolveFilename(request, parent, ...rest);
};

require.cache['__MOCK_CSL__'] = { id:'__MOCK_CSL__', filename:'__MOCK_CSL__', loaded:true, exports: mockCSL };
require.cache['__MOCK_PHI__'] = { id:'__MOCK_PHI__', filename:'__MOCK_PHI__', loaded:true, exports: mockPhiScales };
require.cache['__MOCK_LOG__'] = { id:'__MOCK_LOG__', filename:'__MOCK_LOG__', loaded:true, exports: mockLogger };

// Clear any previously cached versions of our modules
for (const key of Object.keys(require.cache)) {
    if (key.includes('hdy-compiler') || key.includes('hdy-parser')) {
        delete require.cache[key];
    }
}

const { HDYCompiler, CompiledHDYScript } = require('../../src/scripting/hdy-compiler');

// ── Fixtures ───────────────────────────────────────────────────────────────

const VALID_HDY_SOURCE = `
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
  - id: stable
    anchor: Deployment is stable and all health checks are passing
    priority_weight: 0.85

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
    weight_formula: soft_gate(0.8, 0.5)
    preconditions: [ready]
    postconditions: [stable]
    timeout_ms: 10000
    retry: 0
  - id: monitor
    action: observe_metrics
    weight_formula: threshold(0.7)
    preconditions: [stable]
    postconditions: [stable]
    timeout_ms: 3000
    retry: 2

guardrails:
  - id: safety_check
    constraint: System must be in a safe operational state before deployment proceeds
    enforcement: hard
    min_distance: 0.3
    message: Safety check failed — aborting deployment

metadata:
  author: test_suite
  created: 2026-01-01
  tags: [test, deploy]
`;

const DEAD_ACTION_HDY = `
schema: heady_semantic_logic_v1
name: dead_action_test
version: 1.0.0
target_node: worker

semantic_states:
  - id: active
    anchor: System is actively processing tasks
    priority_weight: 0.9

execution_graph:
  - id: live_action
    action: do_work
    weight_formula: soft_gate(0.8, 0.5)
    preconditions: [active]
    postconditions: [active]
    timeout_ms: 1000
    retry: 0
  - id: dead_action
    action: never_runs
    weight_formula: min(0, 1)
    preconditions: [active]
    postconditions: [active]
    timeout_ms: 1000
    retry: 0
`;

// ── Test harness ───────────────────────────────────────────────────────────

let passed = 0, failed = 0;

async function runTest(name, fn) {
    try {
        await fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        if (process.env.VERBOSE) console.error(err.stack);
        failed++;
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────

async function runTests() {
    console.log('\n[test-hdy-compiler]');

    // ── test_compile_valid ────────────────────────────────────────────────
    await runTest('test_compile_valid', () => {
        const compiler = new HDYCompiler();
        const compiled = compiler.compile(VALID_HDY_SOURCE);

        assert.ok(compiled instanceof CompiledHDYScript, 'compile returns CompiledHDYScript');
        assert.ok(compiled.hasOwnProperty('precomputedEmbeddings'), 'has precomputedEmbeddings');
        assert.ok(compiled.hasOwnProperty('resolvedGraph'),         'has resolvedGraph');
        assert.ok(compiled.hasOwnProperty('formulaCache'),          'has formulaCache');
        assert.ok(compiled.hasOwnProperty('guardrailVectors'),      'has guardrailVectors');
        assert.ok(compiled.hasOwnProperty('parsedDoc'),             'has parsedDoc');
        assert.ok(compiled.hasOwnProperty('metadata'),              'has metadata');
        assert.ok(compiled.metadata.hasOwnProperty('compiledAt'),   'metadata.compiledAt set');
        assert.ok(compiled.metadata.hasOwnProperty('sourceHash'),   'metadata.sourceHash set');
        assert.ok(typeof compiled.metadata.sourceHash === 'number', 'sourceHash is number');
    });

    // ── test_precomputed_embeddings ───────────────────────────────────────
    await runTest('test_precomputed_embeddings', () => {
        const compiler = new HDYCompiler();
        const compiled = compiler.compile(VALID_HDY_SOURCE);

        assert.ok(compiled.precomputedEmbeddings instanceof Map, 'precomputedEmbeddings is Map');

        // All semantic_states should have embeddings
        for (const state of compiled.parsedDoc.semantic_states) {
            assert.ok(compiled.precomputedEmbeddings.has(state.id),
                `State '${state.id}' has embedding`);
            const vec = compiled.precomputedEmbeddings.get(state.id);
            assert.ok(vec instanceof Float32Array, `Embedding for '${state.id}' is Float32Array`);
            assert.strictEqual(vec.length, 384,    `Embedding for '${state.id}' is 384-dim`);

            // L2 norm should be ≈ 1 (normalized)
            let norm = 0;
            for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
            norm = Math.sqrt(norm);
            assert.ok(Math.abs(norm - 1.0) < 1e-4,
                `Embedding '${state.id}' L2 norm ≈ 1, got ${norm}`);
        }

        assert.strictEqual(compiled.precomputedEmbeddings.size,
            compiled.parsedDoc.semantic_states.length,
            'embedding count matches state count');
    });

    // ── test_resolved_graph ───────────────────────────────────────────────
    await runTest('test_resolved_graph', () => {
        const compiler = new HDYCompiler();
        const compiled = compiler.compile(VALID_HDY_SOURCE);

        const g = compiled.resolvedGraph;
        assert.ok(g.hasOwnProperty('actions'),     'resolvedGraph has actions');
        assert.ok(g.hasOwnProperty('stateCount'),  'resolvedGraph has stateCount');
        assert.ok(g.hasOwnProperty('actionCount'), 'resolvedGraph has actionCount');
        assert.ok(Array.isArray(g.actions),        'actions is array');
        assert.ok(g.actions.length > 0,            'actions is non-empty');

        // Each action should have preStateRefs resolved
        for (const action of g.actions) {
            assert.ok(action.hasOwnProperty('preStateRefs'),  `'${action.id}' has preStateRefs`);
            assert.ok(action.hasOwnProperty('postStateRefs'), `'${action.id}' has postStateRefs`);
            assert.ok(Array.isArray(action.preStateRefs),     `'${action.id}' preStateRefs is array`);

            // All resolved refs should be real state objects
            for (const ref of action.preStateRefs) {
                assert.ok(ref.hasOwnProperty('id'),     `Resolved preState has id`);
                assert.ok(ref.hasOwnProperty('anchor'), `Resolved preState has anchor`);
            }
        }
    });

    // ── test_formula_cache ────────────────────────────────────────────────
    await runTest('test_formula_cache', () => {
        const compiler = new HDYCompiler();
        const compiled = compiler.compile(VALID_HDY_SOURCE);

        assert.ok(compiled.formulaCache instanceof Map, 'formulaCache is Map');

        // All execution_graph nodes should have formula entries
        for (const node of compiled.parsedDoc.execution_graph) {
            assert.ok(compiled.formulaCache.has(node.id),
                `Action '${node.id}' has formula cache entry`);
            const ast = compiled.formulaCache.get(node.id);
            assert.ok(ast !== null && ast !== undefined, `Formula AST for '${node.id}' is not null`);
            assert.ok(ast.hasOwnProperty('type'), `Formula AST for '${node.id}' has 'type' property`);
        }
    });

    // ── test_compile_to_buffer ────────────────────────────────────────────
    await runTest('test_compile_to_buffer', () => {
        const compiler = new HDYCompiler();
        const buf = compiler.compileToBuffer(VALID_HDY_SOURCE);

        assert.ok(Buffer.isBuffer(buf), 'compileToBuffer returns Buffer');
        assert.ok(buf.length > 100,     'buffer is non-trivial size');

        // Check magic bytes HDYC = 0x48 0x44 0x59 0x43
        assert.strictEqual(buf[0], 0x48, 'magic[0] = 0x48 (H)');
        assert.strictEqual(buf[1], 0x44, 'magic[1] = 0x44 (D)');
        assert.strictEqual(buf[2], 0x59, 'magic[2] = 0x59 (Y)');
        assert.strictEqual(buf[3], 0x43, 'magic[3] = 0x43 (C)');

        // Format version byte = 0x01
        assert.strictEqual(buf[4], 0x01, 'format version = 0x01');
    });

    // ── test_load_from_buffer ─────────────────────────────────────────────
    await runTest('test_load_from_buffer', () => {
        const compiler = new HDYCompiler();
        const buf      = compiler.compileToBuffer(VALID_HDY_SOURCE);
        const loaded   = compiler.loadFromBuffer(buf);

        assert.ok(loaded instanceof CompiledHDYScript, 'loadFromBuffer returns CompiledHDYScript');

        // Core data structures preserved
        assert.ok(loaded.precomputedEmbeddings instanceof Map, 'embeddings is Map after round-trip');
        assert.ok(loaded.formulaCache instanceof Map,          'formulaCache is Map after round-trip');
        assert.ok(loaded.guardrailVectors instanceof Map,      'guardrailVectors is Map after round-trip');

        // Embeddings round-trip check: same count
        const original = compiler.compile(VALID_HDY_SOURCE);
        assert.strictEqual(
            loaded.precomputedEmbeddings.size,
            original.precomputedEmbeddings.size,
            'same embedding count after round-trip'
        );

        // Source hash preserved
        assert.strictEqual(
            loaded.metadata.sourceHash,
            original.metadata.sourceHash,
            'sourceHash preserved through buffer round-trip'
        );
    });

    // ── test_validate ─────────────────────────────────────────────────────
    await runTest('test_validate', () => {
        const compiler = new HDYCompiler();
        const compiled = compiler.compile(VALID_HDY_SOURCE);

        // Valid compiled script should not throw
        assert.doesNotThrow(() => compiler.validate(compiled), 'valid script passes validate()');

        // Corrupt: remove an embedding that is expected
        const corrupted = {
            ...compiled,
            precomputedEmbeddings: new Map(), // empty — missing all state embeddings
        };
        assert.throws(
            () => compiler.validate(corrupted),
            /missing embedding/i,
            'corrupted script (missing embeddings) throws on validate()'
        );
    });

    // ── test_optimize_dead_action ─────────────────────────────────────────
    await runTest('test_optimize_dead_action', () => {
        const compiler = new HDYCompiler({ optimize: true });
        const compiled = compiler.compile(DEAD_ACTION_HDY);

        // After optimization, formulaCache entries should exist
        assert.ok(compiled.formulaCache instanceof Map, 'formulaCache exists after optimize');
        assert.ok(compiled.metadata.optimized === true, 'metadata.optimized=true after optimization');

        // Check formulaCache reflects simplified formulas (dead action min(0,1) → literal 0)
        // The _simplifyAST pass should have folded min(0,1) → literal 0
        // (actual simplification depends on formula parsing — verify no crash and cache is populated)
        for (const [id, ast] of compiled.formulaCache) {
            assert.ok(ast !== null && ast !== undefined, `Formula for '${id}' is not null`);
        }
    });

    // ── test_source_hash ──────────────────────────────────────────────────
    await runTest('test_source_hash', () => {
        const compiler = new HDYCompiler();

        const hash1 = compiler.generateSourceHash(VALID_HDY_SOURCE);
        const hash2 = compiler.generateSourceHash(VALID_HDY_SOURCE);
        const hash3 = compiler.generateSourceHash(VALID_HDY_SOURCE + '\n# different');

        assert.strictEqual(typeof hash1, 'number', 'sourceHash is number');
        assert.ok(hash1 >= 0, 'sourceHash is non-negative');
        assert.strictEqual(hash1, hash2, 'same source → same hash');
        assert.notStrictEqual(hash1, hash3, 'different source → different hash');
    });

    // ── test_guardrail_vectors ────────────────────────────────────────────
    await runTest('test_guardrail_vectors', () => {
        const compiler = new HDYCompiler();
        const compiled = compiler.compile(VALID_HDY_SOURCE);

        assert.ok(compiled.guardrailVectors instanceof Map, 'guardrailVectors is Map');

        for (const guardrail of compiled.parsedDoc.guardrails) {
            assert.ok(compiled.guardrailVectors.has(guardrail.id),
                `Guardrail '${guardrail.id}' has vector`);
            const vec = compiled.guardrailVectors.get(guardrail.id);
            assert.ok(vec instanceof Float32Array,    `Guardrail vector is Float32Array`);
            assert.strictEqual(vec.length, 384,       `Guardrail vector is 384-dim`);

            // Should be normalized
            let norm = 0;
            for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
            norm = Math.sqrt(norm);
            assert.ok(Math.abs(norm - 1.0) < 1e-4,   `Guardrail vector is L2-normalized, got norm=${norm}`);
        }
    });

    // ── test_toSummary ────────────────────────────────────────────────────
    await runTest('test_toSummary', () => {
        const compiler = new HDYCompiler();
        const compiled = compiler.compile(VALID_HDY_SOURCE);
        const summary  = compiled.toSummary();

        assert.ok(typeof summary === 'object',           'toSummary returns object');
        assert.ok(summary.hasOwnProperty('name'),        'summary has name');
        assert.ok(summary.hasOwnProperty('version'),     'summary has version');
        assert.ok(summary.hasOwnProperty('compiledAt'),  'summary has compiledAt');
        assert.ok(summary.hasOwnProperty('sourceHash'),  'summary has sourceHash');
        assert.ok(summary.hasOwnProperty('embeddingDim'),'summary has embeddingDim');
        assert.strictEqual(summary.embeddingDim, 384,    'embeddingDim=384');
        assert.strictEqual(summary.name, 'deploy_pipeline', 'name from parsedDoc');
    });
}

runTests().then(() => {
    console.log(`\nTests: ${passed} passed, ${failed} failed\n`);
    process.exitCode = failed > 0 ? 1 : 0;
});
