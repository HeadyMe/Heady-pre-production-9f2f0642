/**
 * HeadyAutoComplete Engine — Unit Tests
 * Tests the core task completion engine, DAG builder, verification engine,
 * execution sandbox, and task state store.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── Module imports ───────────────────────────────────────────────────────────

const { TaskDAGBuilder, TaskDAG, DAGNode } = require('../src/services/task-dag-builder');
const { VerificationEngine } = require('../src/services/verification-engine');
const { ExecutionSandbox } = require('../src/services/execution-sandbox');
const { TaskStateStore } = require('../src/services/task-state-store');
const { HeadyAutoComplete, TASK_STATUS, SUBTASK_TYPE } = require('../src/services/heady-autocomplete');

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
    try {
        fn();
        passed++;
        results.push(`  ✅ ${name}`);
    } catch (err) {
        failed++;
        results.push(`  ❌ ${name}: ${err.message}`);
    }
}

async function testAsync(name, fn) {
    try {
        await fn();
        passed++;
        results.push(`  ✅ ${name}`);
    } catch (err) {
        failed++;
        results.push(`  ❌ ${name}: ${err.message}`);
    }
}

// ═══════════════════════════════════════════════════════════════
// 1. TaskDAGBuilder Tests
// ═══════════════════════════════════════════════════════════════

console.log('\n📐 TaskDAGBuilder Tests');

test('DAGNode creates with correct properties', () => {
    const node = new DAGNode({
        id: 'st1', name: 'Research', type: 'research',
        depends_on: [], verification: { type: 'not_empty' },
    });
    assert.strictEqual(node.id, 'st1');
    assert.strictEqual(node.type, 'research');
    assert.deepStrictEqual(node.dependsOn, []);
});

test('TaskDAG adds nodes and tracks count', () => {
    const dag = new TaskDAG();
    dag.addNode(new DAGNode({ id: '1', name: 'A', type: 'research', depends_on: [] }));
    dag.addNode(new DAGNode({ id: '2', name: 'B', type: 'code_gen', depends_on: ['1'] }));
    assert.strictEqual(dag.nodeCount, 2);
});

test('TaskDAG.getReadyNodes returns nodes with satisfied deps', () => {
    const dag = new TaskDAG();
    dag.addNode(new DAGNode({ id: '1', name: 'A', type: 'research', depends_on: [] }));
    dag.addNode(new DAGNode({ id: '2', name: 'B', type: 'code_gen', depends_on: ['1'] }));
    dag.addNode(new DAGNode({ id: '3', name: 'C', type: 'test', depends_on: [] }));

    const readyInitial = dag.getReadyNodes(new Set());
    assert.strictEqual(readyInitial.length, 2); // A and C are ready
    assert.ok(readyInitial.some(n => n.id === '1'));
    assert.ok(readyInitial.some(n => n.id === '3'));

    const readyAfterA = dag.getReadyNodes(new Set(['1']));
    assert.ok(readyAfterA.some(n => n.id === '2')); // B is now ready
});

test('TaskDAG.topologicalSort detects cycles', () => {
    const dag = new TaskDAG();
    dag.addNode(new DAGNode({ id: '1', name: 'A', type: 'research', depends_on: ['2'] }));
    dag.addNode(new DAGNode({ id: '2', name: 'B', type: 'code_gen', depends_on: ['1'] }));
    assert.throws(() => dag.topologicalSort(), /Cycle detected/);
});

test('TaskDAG.topologicalSort returns valid order', () => {
    const dag = new TaskDAG();
    dag.addNode(new DAGNode({ id: '1', name: 'A', type: 'research', depends_on: [] }));
    dag.addNode(new DAGNode({ id: '2', name: 'B', type: 'code_gen', depends_on: ['1'] }));
    dag.addNode(new DAGNode({ id: '3', name: 'C', type: 'test', depends_on: ['2'] }));
    const sorted = dag.topologicalSort();
    const ids = sorted.map(n => n.id);
    assert.ok(ids.indexOf('1') < ids.indexOf('2'));
    assert.ok(ids.indexOf('2') < ids.indexOf('3'));
});

test('TaskDAG.serialize/deserialize roundtrip', () => {
    const dag = new TaskDAG();
    dag.addNode(new DAGNode({ id: '1', name: 'A', type: 'research', depends_on: [] }));
    dag.addNode(new DAGNode({ id: '2', name: 'B', type: 'code_gen', depends_on: ['1'] }));
    const serialized = dag.serialize();
    const restored = TaskDAG.deserialize(serialized);
    assert.strictEqual(restored.nodeCount, 2);
    assert.ok(restored.getNode('1'));
    assert.ok(restored.getNode('2'));
});

test('TaskDAG.maxParallelism calculates correctly', () => {
    const dag = new TaskDAG();
    dag.addNode(new DAGNode({ id: '1', name: 'A', type: 'research', depends_on: [] }));
    dag.addNode(new DAGNode({ id: '2', name: 'B', type: 'code_gen', depends_on: [] }));
    dag.addNode(new DAGNode({ id: '3', name: 'C', type: 'test', depends_on: [] }));
    dag.addNode(new DAGNode({ id: '4', name: 'D', type: 'deploy', depends_on: ['1', '2', '3'] }));
    assert.strictEqual(dag.maxParallelism(), 3);
});

// ═══════════════════════════════════════════════════════════════
// 2. VerificationEngine Tests
// ═══════════════════════════════════════════════════════════════

console.log('\n🔍 VerificationEngine Tests');

const verifier = new VerificationEngine();

(async () => {
    await testAsync('verify not_empty passes on non-empty string', async () => {
        const result = await verifier.verify({ type: 'not_empty' }, 'hello');
        assert.strictEqual(result.passed, true);
    });

    await testAsync('verify not_empty fails on empty string', async () => {
        const result = await verifier.verify({ type: 'not_empty' }, '');
        assert.strictEqual(result.passed, false);
    });

    await testAsync('verify json_valid passes on valid JSON', async () => {
        const result = await verifier.verify({ type: 'json_valid' }, '{"foo":"bar"}');
        assert.strictEqual(result.passed, true);
    });

    await testAsync('verify json_valid fails on invalid JSON', async () => {
        const result = await verifier.verify({ type: 'json_valid' }, '{broken');
        assert.strictEqual(result.passed, false);
    });

    await testAsync('verify contains passes when substring found', async () => {
        const result = await verifier.verify({ type: 'contains', substring: 'world' }, 'hello world');
        assert.strictEqual(result.passed, true);
    });

    await testAsync('verify contains fails when substring missing', async () => {
        const result = await verifier.verify({ type: 'contains', substring: 'xyz' }, 'hello world');
        assert.strictEqual(result.passed, false);
    });

    await testAsync('verify file_exists passes for existing file', async () => {
        const result = await verifier.verify({ type: 'file_exists', path: __filename }, null);
        assert.strictEqual(result.passed, true);
    });

    await testAsync('verify file_exists fails for missing file', async () => {
        const result = await verifier.verify({ type: 'file_exists', path: '/nonexistent/file.txt' }, null);
        assert.strictEqual(result.passed, false);
    });

    await testAsync('verify command passes for echo', async () => {
        const result = await verifier.verify({ type: 'command', command: 'echo ok' }, null);
        assert.strictEqual(result.passed, true);
    });

    await testAsync('verify null contract passes', async () => {
        const result = await verifier.verify(null, 'anything');
        assert.strictEqual(result.passed, true);
    });

    // ═══════════════════════════════════════════════════════════════
    // 3. ExecutionSandbox Tests
    // ═══════════════════════════════════════════════════════════════

    console.log('\n📦 ExecutionSandbox Tests');

    const sandbox = new ExecutionSandbox({
        baseDir: path.join(os.tmpdir(), 'heady-test-sandbox'),
    });

    await testAsync('sandbox creates an isolated directory', async () => {
        const ctx = await sandbox.create({
            taskId: 'test_task', subtaskId: 'sub1', type: 'code_gen',
        });
        assert.ok(fs.existsSync(ctx.cwd));
        await ctx.cleanup();
    });

    await testAsync('sandbox run executes function with env', async () => {
        const ctx = await sandbox.create({
            taskId: 'test_task', subtaskId: 'sub2', type: 'test',
        });
        const result = await ctx.run(async (env) => {
            env.writeFile('test.txt', 'hello');
            return env.readFile('test.txt');
        });
        assert.strictEqual(result, 'hello');
        await ctx.cleanup();
    });

    await testAsync('sandbox cleanup removes directory', async () => {
        const ctx = await sandbox.create({
            taskId: 'test_task', subtaskId: 'sub3', type: 'test',
        });
        const dir = ctx.cwd;
        await ctx.cleanup();
        assert.strictEqual(fs.existsSync(dir), false);
    });

    // ═══════════════════════════════════════════════════════════════
    // 4. TaskStateStore Tests
    // ═══════════════════════════════════════════════════════════════

    console.log('\n💾 TaskStateStore Tests');

    const stateDir = path.join(os.tmpdir(), 'heady-test-state');
    const store = new TaskStateStore({ stateDir });

    await testAsync('store saves and loads state', async () => {
        await store.save('test1', { status: 'executing', goal: 'Build a thing' });
        const loaded = await store.load('test1');
        assert.strictEqual(loaded.status, 'executing');
        assert.strictEqual(loaded.goal, 'Build a thing');
    });

    await testAsync('store merges state on update', async () => {
        await store.save('test2', { status: 'pending', step: 1 });
        await store.save('test2', { status: 'executing' });
        const loaded = await store.load('test2');
        assert.strictEqual(loaded.status, 'executing');
        assert.strictEqual(loaded.step, 1); // Previous data preserved
    });

    await testAsync('store lists states', async () => {
        const list = await store.list();
        assert.ok(list.length >= 2);
    });

    await testAsync('store deletes state', async () => {
        await store.save('test_del', { status: 'failed' });
        await store.delete('test_del');
        const loaded = await store.load('test_del');
        assert.strictEqual(loaded, null);
    });

    // ═══════════════════════════════════════════════════════════════
    // 5. HeadyAutoComplete Integration Smoke Test
    // ═══════════════════════════════════════════════════════════════

    console.log('\n🚀 HeadyAutoComplete Smoke Tests');

    test('HeadyAutoComplete instantiates with stats', () => {
        const engine = new HeadyAutoComplete({});
        const stats = engine.getStats();
        assert.strictEqual(stats.totalTasks, 0);
        assert.strictEqual(stats.completed, 0);
        assert.strictEqual(stats.activeTasks, 0);
    });

    test('TASK_STATUS has all expected values', () => {
        assert.ok(TASK_STATUS.PENDING);
        assert.ok(TASK_STATUS.PLANNING);
        assert.ok(TASK_STATUS.DECOMPOSING);
        assert.ok(TASK_STATUS.EXECUTING);
        assert.ok(TASK_STATUS.VERIFYING);
        assert.ok(TASK_STATUS.COMPLETED);
        assert.ok(TASK_STATUS.FAILED);
        assert.ok(TASK_STATUS.ESCALATED);
    });

    test('SUBTASK_TYPE has all expected values', () => {
        assert.ok(SUBTASK_TYPE.RESEARCH);
        assert.ok(SUBTASK_TYPE.PLANNING);
        assert.ok(SUBTASK_TYPE.CODE_GEN);
        assert.ok(SUBTASK_TYPE.VERIFY);
        assert.ok(SUBTASK_TYPE.DEBUG);
    });

    // ─── Cleanup ────────────────────────────────────────────────────

    // Cleanup test artifacts
    try {
        fs.rmSync(path.join(os.tmpdir(), 'heady-test-sandbox'), { recursive: true, force: true });
        fs.rmSync(stateDir, { recursive: true, force: true });
    } catch { /* ignore */ }

    // ─── Results ────────────────────────────────────────────────────

    console.log('\n═══════════════════════════════════════');
    console.log('  HeadyAutoComplete Test Results');
    console.log('═══════════════════════════════════════');
    results.forEach(r => console.log(r));
    console.log(`\n  Total: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
    console.log('═══════════════════════════════════════\n');

    process.exit(failed > 0 ? 1 : 0);
})();
