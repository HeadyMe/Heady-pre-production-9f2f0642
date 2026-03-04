/*
 * Tests for Liquid Colab Services — vector-native component execution.
 * Run: node tests/liquid-colab-services.test.js
 */

const { LiquidColabEngine, EXECUTORS } = require('../src/liquid-colab-services');

let passed = 0;
let failed = 0;
function assert(cond, msg) {
    if (cond) { passed++; console.log('  ✅ ' + msg); }
    else { failed++; console.log('  ❌ FAIL: ' + msg); }
}

async function runTests() {
    console.log('─── EXECUTORS Registry ───');
    const expectedComponents = [
        'lens', 'brain', 'soul', 'conductor', 'battle', 'vinci', 'patterns',
        'notion', 'ops', 'maintenance', 'auto-success', 'stream', 'buddy', 'cloud',
    ];
    assert(Object.keys(EXECUTORS).length === 14, '14 executors registered');
    for (const name of expectedComponents) {
        assert(typeof EXECUTORS[name] === 'function', `${name} executor is a function`);
    }

    console.log('─── LiquidColabEngine ───');
    const engine = new LiquidColabEngine();
    assert(engine.totalExecutions === 0, 'starts at 0 executions');
    assert(engine.allocator !== null, 'allocator is initialized');

    const health = engine.getHealth();
    assert(health.status === 'ACTIVE', 'health status is ACTIVE');
    assert(health.mode === 'vector-native', 'mode is vector-native');
    assert(health.components === 14, 'reports 14 components');
    assert(health.allocator.registeredComponents === 14, 'allocator has 14 components');

    console.log('─── Execute: Unknown Component ───');
    const unknownResult = await engine.execute('nonexistent', {});
    assert(unknownResult.ok === false, 'unknown component returns ok=false');
    assert(Array.isArray(unknownResult.available), 'returns available components list');
    assert(unknownResult.available.length === 14, 'available list has 14 entries');

    console.log('─── Execute: Conductor ───');
    const conductorResult = await engine.execute('conductor', {});
    assert(conductorResult.ok === true, 'conductor executes ok');
    assert(conductorResult.component === 'conductor', 'result has component=conductor');
    assert(conductorResult.action === 'orchestrate', 'action is orchestrate');
    assert(conductorResult.systemState !== undefined, 'has systemState');
    assert(typeof conductorResult.durationMs === 'number', 'has durationMs');

    console.log('─── Execute: Patterns ───');
    const patternsResult = await engine.execute('patterns', {});
    assert(patternsResult.ok === true, 'patterns executes ok');
    assert(patternsResult.component === 'patterns', 'result has component=patterns');
    assert(patternsResult.resilience !== undefined, 'has resilience data');
    assert(patternsResult.decay !== undefined, 'has decay data');

    console.log('─── Execute: Ops ───');
    const opsResult = await engine.execute('ops', {});
    assert(opsResult.ok === true, 'ops executes ok');
    assert(opsResult.health !== undefined, 'has health data');
    assert(opsResult.health.shards !== undefined, 'has shard info');

    console.log('─── Execute: Stream ───');
    const streamResult = await engine.execute('stream', { channel: 'canvas' });
    assert(streamResult.ok === true, 'stream executes ok');
    assert(streamResult.component === 'stream', 'result has component=stream');
    assert(streamResult.projection !== undefined, 'has projection data');

    console.log('─── Execute: Cloud ───');
    const cloudResult = await engine.execute('cloud', { channel: 'public-api' });
    assert(cloudResult.ok === true, 'cloud executes ok');
    assert(cloudResult.projection.profile === 'spherical', 'cloud uses spherical profile');

    console.log('─── Execution Log ───');
    assert(engine.totalExecutions >= 5, `totalExecutions >= 5 (got ${engine.totalExecutions})`);
    const log = engine.getExecutionLog(3);
    assert(log.length === 3, 'getExecutionLog respects limit');
    assert(log[0].component !== undefined, 'log entries have component');
    assert(log[0].durationMs !== undefined, 'log entries have durationMs');

    console.log('─── Event Emission ───');
    let emitted = null;
    engine.on('execution:complete', (e) => { emitted = e; });
    await engine.execute('conductor', {});
    assert(emitted !== null, 'execution:complete event emitted');
    assert(emitted.component === 'conductor', 'event has correct component');

    console.log('─── Smart Execute ───');
    const smartResult = await engine.smartExecute({ type: 'chat', speed: true });
    assert(smartResult.ok === true, 'smart execute returns ok');
    assert(smartResult.flow !== undefined, 'has flow from allocator');
    assert(smartResult.results.length > 0, 'executed at least 1 component');
    assert(smartResult.results[0].affinity !== undefined, 'results include affinity score');

    console.log('');
    console.log(`Results: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
});
