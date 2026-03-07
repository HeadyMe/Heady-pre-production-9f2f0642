'use strict';

/**
 * test-e2e-hdy-pipeline.js
 *
 * End-to-end tests: .hdy source string → parse → compile → load → execute → verify.
 * Uses mocks for CSL, PhiScale, MonteCarloEngine, and logger.
 *
 * Run: node tests/semantic-routing/test-e2e-hdy-pipeline.js
 */

const assert = require('assert');
const Module = require('module');

// ── Constants ──────────────────────────────────────────────────────────────

const PHI_INVERSE = 0.618033988749895;
const PHI         = 1.618033988749895;
const EMBED_DIM   = 384;

// ── Mock CSL ───────────────────────────────────────────────────────────────

function _normalize(v) {
    const out = new Float32Array(v.length);
    let norm  = 0;
    for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
    norm = Math.sqrt(norm);
    if (norm > 1e-9) for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
    return out;
}

function _cosSim(a, b) {
    let d = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) d += a[i] * b[i];
    return Math.max(-1, Math.min(1, d));
}

const mockCSL = {
    normalize: _normalize,
    cosine_similarity: _cosSim,
    dot_product(a, b) { return _cosSim(a, b); },
    norm(v) { let n=0; for(let i=0;i<v.length;i++) n+=v[i]*v[i]; return Math.sqrt(n); },
    resonance_gate(a, b, t=0.95) { const s=_cosSim(a,b); return { score:s, open:s>=t }; },
    multi_resonance(t, cs, th=0.95) {
        return cs.map((c,i) => ({ index:i, score:_cosSim(t,c), open:_cosSim(t,c)>=th }))
                 .sort((a,b)=>b.score-a.score);
    },
    superposition_gate(a, b) { const out=new Float32Array(a.length); for(let i=0;i<a.length;i++) out[i]=a[i]+b[i]; return _normalize(out); },
    weighted_superposition(a, b, alpha=0.5) { const out=new Float32Array(a.length); for(let i=0;i<a.length;i++) out[i]=a[i]*alpha+b[i]*(1-alpha); return _normalize(out); },
    consensus_superposition(vecs) {
        if (!vecs||vecs.length===0) return new Float32Array(EMBED_DIM);
        const sum=new Float32Array(vecs[0].length);
        for(const v of vecs) for(let i=0;i<v.length;i++) sum[i]+=v[i];
        return _normalize(sum);
    },
    orthogonal_gate(target, reject) {
        const dot=_cosSim(target,reject);
        const out=new Float32Array(target.length);
        for(let i=0;i<target.length;i++) out[i]=target[i]-dot*reject[i];
        return _normalize(out);
    },
    soft_gate(score, t=0.5, k=20) { return 1/(1+Math.exp(-k*(score-t))); },
    ternary_gate(score, rt=0.72, rp=0.35, k=15) {
        const rA=1/(1+Math.exp(-k*(score-rt)));
        const rR=1/(1+Math.exp(-k*(rp-score)));
        const state=score>=rt?'resonate':score<=rp?'repel':'neutral';
        return { state, resonanceActivation:rA, repelActivation:rR, raw:score };
    },
    risk_gate(current, limit, sens=0.8, k=12) {
        const prox=current/Math.max(limit,1e-9);
        const act=1/(1+Math.exp(-k*(prox-sens)));
        const level=prox>=sens?'high':prox>=PHI_INVERSE?'medium':'low';
        return { riskLevel:level, signal:act, proximity:prox, activation:act };
    },
    route_gate(intent, candidates, t=0.3) {
        const scores=candidates.map((c,i)=>({ index:i, score:_cosSim(intent,c) })).sort((a,b)=>b.score-a.score);
        return { best:scores[0], scores, fallback:scores[0]?.score<t };
    },
    getStats() { return {}; },
    resetStats() {},
};
mockCSL.CSL = mockCSL;

// ── Mock PhiScales ─────────────────────────────────────────────────────────

class MockPhiScale {
    constructor(o={}) {
        this._val = o.baseValue ?? PHI_INVERSE;
        this._min = o.min ?? 0;
        this._max = o.max ?? 1;
    }
    get value() { return this._val; }
    asMs()    { return Math.round(this._val); }
    asFloat(p=4) { return parseFloat(this._val.toFixed(p)); }
    adjust(m) {
        if (m && typeof m.errorRate === 'number') {
            this._val = Math.max(this._min, Math.min(this._max, this._val * 0.99));
        }
    }
    normalized() { return this._val; }
    snapshot() { return { val: this._val }; }
    restore(s) { this._val = s.val; }
}

const mockPhiScales = {
    PhiScale: MockPhiScale,
    PhiRange: class {},
    PHI, PHI_INVERSE,
    PHI_SQUARED: PHI*PHI, PHI_CUBED: PHI*PHI*PHI,
    SQRT_PHI: Math.sqrt(PHI), LOG_PHI: Math.log(PHI),
    TWO_PI_PHI: 2*Math.PI*PHI,
    FIBONACCI_SEQUENCE: [1,1,2,3,5,8,13,21,34,55,89,144,233],
};

// ── Mock MonteCarloEngine ──────────────────────────────────────────────────

class MockMonteCarloEngine {
    constructor(opts={}) { this._opts = opts; this._callCount = 0; }
    runSimulation(params, iterations=100) {
        this._callCount++;
        const successRate = 0.7 + Math.random() * 0.2;
        return {
            successRate, iterations,
            meanOutcome: successRate,
            p5: successRate - 0.1, p50: successRate, p95: successRate + 0.05,
            riskScore: 1 - successRate,
        };
    }
    quickReadiness(signals={}) {
        return { readiness: 0.75, grade: 'B', recommendation: 'proceed' };
    }
    analyseScenarios(scenarios=[]) {
        return scenarios.map(s => ({ name: s.name, result: this.runSimulation(s.params, s.iterations) }));
    }
    registerPipelineHook(name, fn) {}
    scoreRisk(factors) { return { score: 0.3, grade: 'C', expectedImpact: 0.3 }; }
}

const mockLogger = { debug() {}, info() {}, warn() {}, error() {} };

// ── Patch require resolution ───────────────────────────────────────────────

const origResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function(request, parent, ...rest) {
    if (request.endsWith('semantic-logic'))          return '__E2E_CSL__';
    if (request.endsWith('phi-scales'))              return '__E2E_PHI__';
    if (request.endsWith('monte-carlo-engine'))      return '__E2E_MC__';
    if (request.endsWith('utils/logger') || request.endsWith('logger')) return '__E2E_LOG__';
    return origResolve(request, parent, ...rest);
};

require.cache['__E2E_CSL__'] = { id:'__E2E_CSL__', filename:'__E2E_CSL__', loaded:true, exports: mockCSL };
require.cache['__E2E_PHI__'] = { id:'__E2E_PHI__', filename:'__E2E_PHI__', loaded:true, exports: mockPhiScales };
require.cache['__E2E_MC__']  = { id:'__E2E_MC__',  filename:'__E2E_MC__',  loaded:true,
    exports: { MonteCarloEngine: MockMonteCarloEngine, PHI, RISK_GRADE:{}, DISTRIBUTION:{}, OUTCOME_THRESHOLDS:{} }};
require.cache['__E2E_LOG__'] = { id:'__E2E_LOG__', filename:'__E2E_LOG__', loaded:true, exports: mockLogger };

// Clear cached modules that depend on our mocked deps
for (const key of Object.keys(require.cache)) {
    if (key.includes('hdy-') || key.includes('semantic-logic') || key.includes('phi-scales')) {
        delete require.cache[key];
    }
}

const { HDYParser }               = require('../../src/scripting/hdy-parser');
const { HDYCompiler, CompiledHDYScript } = require('../../src/scripting/hdy-compiler');
const { HDYRuntime }              = require('../../src/scripting/hdy-runtime');

// ── Fixture: deployment workflow .hdy ─────────────────────────────────────

const DEPLOY_WORKFLOW_HDY = `
schema: heady_semantic_logic_v1
name: deploy_workflow
version: 1.0.0
target_node: DeployAgent

semantic_states:
  - id: ready_to_deploy
    anchor: System is healthy and ready for deployment
    priority_weight: 0.9
  - id: tests_passing
    anchor: All automated tests pass with no failures
    priority_weight: 0.95
  - id: deployed
    anchor: Application is deployed and running in production
    priority_weight: 0.85

continuous_evaluation:
  method: cosine_similarity
  threshold_activation: phi_equilibrium
  fuzziness: 0.382
  evaluation_interval_ms: 100

execution_graph:
  - id: run_tests
    action: execute_tests
    weight_formula: soft_gate(0.8, 0.5)
    preconditions: [ready_to_deploy]
    postconditions: [tests_passing]
    timeout_ms: 2000
    retry: 1
  - id: build_artifact
    action: build_app
    weight_formula: threshold(0.7)
    preconditions: [tests_passing]
    postconditions: [tests_passing]
    timeout_ms: 3000
    retry: 0
  - id: deploy_to_production
    action: deploy_app
    weight_formula: soft_gate(0.9, 0.618)
    preconditions: [tests_passing]
    postconditions: [deployed]
    timeout_ms: 5000
    retry: 1
  - id: verify_health
    action: health_check
    weight_formula: resonance(deployed, tests_passing)
    preconditions: [deployed]
    postconditions: [deployed]
    timeout_ms: 1000
    retry: 2

guardrails:
  - id: no_deploy_on_degraded
    constraint: Deployment must not proceed when system is degraded or unhealthy
    enforcement: soft
    min_distance: 0.2
    message: Deployment blocked — system degraded

metadata:
  author: test_e2e
  created: 2026-01-01
  tags: [deploy, e2e]
`;

const GUARDRAIL_HDY = `
schema: heady_semantic_logic_v1
name: guarded_workflow
version: 1.0.0
target_node: SecureAgent

semantic_states:
  - id: pre_check
    anchor: System is being pre-checked for security and safety
    priority_weight: 0.95
  - id: executing
    anchor: System is executing the primary workload
    priority_weight: 0.85

continuous_evaluation:
  method: cosine_similarity
  threshold_activation: phi_equilibrium
  fuzziness: 0.382
  evaluation_interval_ms: 100

execution_graph:
  - id: security_scan
    action: run_security_scan
    weight_formula: soft_gate(0.8, 0.5)
    preconditions: [pre_check]
    postconditions: [executing]
    timeout_ms: 2000
    retry: 0
  - id: main_task
    action: execute_main
    weight_formula: threshold(0.7)
    preconditions: [executing]
    postconditions: [executing]
    timeout_ms: 3000
    retry: 0

guardrails:
  - id: security_guardrail
    constraint: All security scans must pass before main execution proceeds
    enforcement: soft
    min_distance: 0.1
    message: Security guardrail triggered

metadata:
  author: test_e2e
  created: 2026-01-01
  tags: [security, guardrail]
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

// ── Build a configured runtime with action handlers ────────────────────────

function buildRuntime(opts = {}) {
    const runtime = new HDYRuntime({
        maxCycles:            opts.maxCycles ?? 3,
        evaluationInterval:   100,
        enableMonteCarlo:     opts.mc        ?? false,
        enableSelfOptimization: opts.selfOpt ?? false,
    });
    return runtime;
}

function registerDefaultHandlers(runtime) {
    const calls = {};
    for (const action of ['execute_tests', 'build_app', 'deploy_app', 'health_check',
                           'run_security_scan', 'execute_main']) {
        calls[action] = 0;
        runtime.registerActionHandler(action, async (ctx, weight) => {
            calls[action]++;
            return { success: true, action, weight, timestamp: Date.now() };
        });
    }
    return calls;
}

// ── Tests ─────────────────────────────────────────────────────────────────

async function runTests() {
    console.log('\n[test-e2e-hdy-pipeline]');

    // ── test_full_pipeline ────────────────────────────────────────────────
    await runTest('test_full_pipeline', async () => {
        const parser   = new HDYParser();
        const parsed   = parser.parse(DEPLOY_WORKFLOW_HDY);

        assert.ok(parsed.semantic_states.length > 0, 'parsed has semantic_states');
        assert.ok(parsed.execution_graph.length  > 0, 'parsed has execution_graph');

        const runtime = buildRuntime({ maxCycles: 3 });
        runtime.loadScript(parsed);

        const calls = registerDefaultHandlers(runtime);

        const result = await runtime.execute({
            environment: 'staging',
            context:     'Running deployment workflow test',
        });

        assert.ok(result,                                        'execute returns result');
        assert.ok(result.hasOwnProperty('cycles'),              'result has cycles');
        assert.ok(result.hasOwnProperty('totalDuration'),       'result has totalDuration');
        assert.ok(result.hasOwnProperty('guardrailViolations'), 'result has guardrailViolations');
        assert.ok(result.hasOwnProperty('activatedStates'),     'result has activatedStates');
        assert.ok(typeof result.cycles === 'number',            'cycles is number');
        assert.ok(result.cycles >= 0,                           'cycles is non-negative');

        // At least one action should have been called
        const totalCalls = Object.values(calls).reduce((s, c) => s + c, 0);
        assert.ok(totalCalls >= 1, `At least 1 action called, got ${totalCalls}`);
    });

    // ── test_pipeline_with_guardrails ─────────────────────────────────────
    await runTest('test_pipeline_with_guardrails', async () => {
        const parser  = new HDYParser();
        const parsed  = parser.parse(GUARDRAIL_HDY);

        assert.ok(parsed.guardrails.length > 0, 'script has guardrails');

        const runtime = buildRuntime({ maxCycles: 2 });
        runtime.loadScript(parsed);
        registerDefaultHandlers(runtime);

        const result = await runtime.execute({ environment: 'production' });

        assert.ok(result.hasOwnProperty('guardrailViolations'), 'result has guardrailViolations');
        assert.ok(Array.isArray(result.guardrailViolations),    'guardrailViolations is array');
        // Script should complete (violations are soft, not hard stops in this test)
        assert.ok(result.hasOwnProperty('cycles'),    'result has cycles field');
        assert.ok(result.hasOwnProperty('totalDuration'), 'result has totalDuration field');
    });

    // ── test_pipeline_monte_carlo ─────────────────────────────────────────
    await runTest('test_pipeline_monte_carlo', async () => {
        const parser  = new HDYParser();
        const parsed  = parser.parse(DEPLOY_WORKFLOW_HDY);

        const runtime = buildRuntime({ maxCycles: 2, mc: true });
        runtime.loadScript(parsed);
        registerDefaultHandlers(runtime);

        const result = await runtime.execute({ environment: 'production' });

        // With MC enabled, execution still completes and returns results
        assert.ok(result, 'MC-enabled pipeline returns result');
        assert.ok(result.hasOwnProperty('cycles'), 'result has cycles');
        assert.ok(result.cycles >= 1,              'at least 1 cycle with MC enabled');
    });

    // ── test_pipeline_self_optimization ───────────────────────────────────
    await runTest('test_pipeline_self_optimization', async () => {
        const parser  = new HDYParser();
        const parsed  = parser.parse(DEPLOY_WORKFLOW_HDY);

        const runtime = buildRuntime({ maxCycles: 2, selfOpt: true });
        runtime.loadScript(parsed);
        registerDefaultHandlers(runtime);

        // Run multiple times — weights should be tracked
        const result1 = await runtime.execute({ run: 1, status: 'healthy' });
        const result2 = await runtime.execute({ run: 2, status: 'healthy' });
        const result3 = await runtime.execute({ run: 3, status: 'healthy' });

        assert.ok(result1, 'run 1 succeeds');
        assert.ok(result2, 'run 2 succeeds');
        assert.ok(result3, 'run 3 succeeds');

        // _actionStats should be tracking history
        assert.ok(runtime._actionStats instanceof Map, 'actionStats is Map');
        let anyStatTracked = false;
        for (const [id, stat] of runtime._actionStats) {
            if (stat.successCount > 0 || stat.failCount > 0) {
                anyStatTracked = true;
                assert.ok(typeof stat.successCount === 'number', `${id} has successCount`);
                assert.ok(Array.isArray(stat.weightHistory),      `${id} has weightHistory`);
            }
        }
        assert.ok(anyStatTracked, 'At least one action has tracked stats after 3 runs');
    });

    // ── test_compiled_vs_interpreted ──────────────────────────────────────
    await runTest('test_compiled_vs_interpreted', async () => {
        const parser   = new HDYParser();
        const compiler = new HDYCompiler();
        const parsed   = parser.parse(DEPLOY_WORKFLOW_HDY);

        // Direct parse + execute
        const runtime1 = buildRuntime({ maxCycles: 2 });
        runtime1.loadScript(parsed);
        const calls1 = registerDefaultHandlers(runtime1);
        const result1 = await runtime1.execute({ mode: 'interpreted' });

        // Compile then loadScript from parsedDoc embedded in CompiledHDYScript
        const compiled = compiler.compile(DEPLOY_WORKFLOW_HDY);
        const runtime2 = buildRuntime({ maxCycles: 2 });
        runtime2.loadScript(compiled.parsedDoc);  // load the same parsed structure
        const calls2 = registerDefaultHandlers(runtime2);
        const result2 = await runtime2.execute({ mode: 'compiled' });

        // Both should complete successfully
        assert.ok(result1.hasOwnProperty('cycles'),        'interpreted result has cycles');
        assert.ok(result1.hasOwnProperty('totalDuration'), 'interpreted result has totalDuration');
        assert.ok(result2.hasOwnProperty('cycles'),        'compiled result has cycles');
        assert.ok(result2.hasOwnProperty('totalDuration'), 'compiled result has totalDuration');

        // Both should execute at least some actions
        const total1 = Object.values(calls1).reduce((s,c)=>s+c, 0);
        const total2 = Object.values(calls2).reduce((s,c)=>s+c, 0);
        assert.ok(total1 >= 1, `interpreted: at least 1 action, got ${total1}`);
        assert.ok(total2 >= 1, `compiled: at least 1 action, got ${total2}`);
    });

    // ── test_pipeline_lifecycle ───────────────────────────────────────────
    await runTest('test_pipeline_lifecycle', async () => {
        const parser  = new HDYParser();
        const parsed  = parser.parse(DEPLOY_WORKFLOW_HDY);

        const runtime = buildRuntime({ maxCycles: 5 });
        runtime.loadScript(parsed);
        registerDefaultHandlers(runtime);

        // ── Direct execute() lifecycle ────────────────────────────────────
        // Initial status: idle
        assert.strictEqual(runtime._status, 'idle', 'initial status is idle');

        // execute() sets status=running then idle when complete
        const result = await runtime.execute({ environment: 'test-direct' });
        assert.ok(result.hasOwnProperty('cycles'),       'execute result has cycles');
        assert.ok(result.hasOwnProperty('totalDuration'),'execute result has totalDuration');
        // After execute completes, status returns to idle
        assert.strictEqual(runtime._status, 'idle', 'status=idle after execute()');

        // cycleCount was incremented by the execute() call
        assert.ok(runtime._cycleCount >= 0, `cycleCount is non-negative: ${runtime._cycleCount}`);

        // ── Background start/stop lifecycle ───────────────────────────────
        // start() sets status to running immediately, stop() sets it to stopped
        runtime.start({ environment: 'test-background' });
        // start() sets status before async tick fires
        const statusAfterStart = runtime._status;
        assert.ok(
            statusAfterStart === 'running' || statusAfterStart === 'idle',
            `status after start() is 'running' or 'idle', got '${statusAfterStart}'`
        );

        // stop() immediately sets status to stopped
        runtime.stop();
        assert.strictEqual(runtime._status, 'stopped', 'status=stopped after stop()');

        // ── Pause/resume state machine ────────────────────────────────────
        // Force to paused manually (direct state test without timing)
        runtime._status = 'running';
        runtime.pause();
        assert.strictEqual(runtime._status, 'paused', 'status=paused after pause()');

        // resume() from paused → running
        runtime.resume({ environment: 'test-resume' });
        // resume() calls start() which may trigger async execute → status transitions
        const statusAfterResume = runtime._status;
        assert.ok(
            statusAfterResume === 'running' || statusAfterResume === 'idle',
            `status after resume() is 'running' or 'idle', got '${statusAfterResume}'`
        );

        // Clean up
        runtime.stop();
        assert.strictEqual(runtime._status, 'stopped', 'status=stopped after final stop()');
    });

    // ── test_action_error_handling ────────────────────────────────────────
    await runTest('test_action_error_handling', async () => {
        const parser  = new HDYParser();
        const parsed  = parser.parse(DEPLOY_WORKFLOW_HDY);

        const runtime = buildRuntime({ maxCycles: 2 });
        runtime.loadScript(parsed);

        // Register a handler that throws on first call
        let callCount = 0;
        runtime.registerActionHandler('execute_tests', async (ctx, weight) => {
            callCount++;
            if (callCount === 1) throw new Error('Simulated test failure');
            return { success: true };
        });
        // Register remaining handlers normally
        for (const action of ['build_app', 'deploy_app', 'health_check']) {
            runtime.registerActionHandler(action, async () => ({ success: true }));
        }

        // Should not throw — runtime should handle action errors gracefully
        const result = await runtime.execute({ environment: 'test' });
        assert.ok(result, 'runtime completes even when action throws');
    });

    // ── test_no_handlers_fallback ─────────────────────────────────────────
    await runTest('test_no_handlers_fallback', async () => {
        const parser  = new HDYParser();
        const parsed  = parser.parse(DEPLOY_WORKFLOW_HDY);

        const runtime = buildRuntime({ maxCycles: 1 });
        runtime.loadScript(parsed);
        // Register NO action handlers

        // Should complete without crashing (unhandled actions produce null results)
        const result = await runtime.execute({ environment: 'test' });
        assert.ok(result, 'runtime completes with no handlers registered');
        assert.ok(result.hasOwnProperty('cycles'),       'result has cycles');
        assert.ok(result.hasOwnProperty('totalDuration'),'result has totalDuration');
    });
}

runTests().then(() => {
    console.log(`\nTests: ${passed} passed, ${failed} failed\n`);
    process.exitCode = failed > 0 ? 1 : 0;
});
