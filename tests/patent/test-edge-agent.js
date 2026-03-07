/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
'use strict';

const assert = require('assert');
const {
  PHI,
  evaluateCslGate,
  StateManager,
  EdgeHealthProbe,
  DurableAgent,
  EdgeAgentRuntime,
} = require('../src/edge/durable-edge-agent');

let passed = 0;
let failed = 0;

// Queue of test promises — all are awaited in sequence at the end
const queue = [];

function test(name, fn) {
  queue.push(async () => {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
      failed++;
    }
  });
}

// asyncTest is an alias — same queue mechanism
function asyncTest(name, fn) {
  test(name, fn);
}

console.log('\n=== Edge Durable Agent Tests ===\n');

test('PHI constant is correct', () => {
  assert.strictEqual(PHI, 1.6180339887);
});

// evaluateCslGate
test('evaluateCslGate: eq passes', () => {
  assert.strictEqual(evaluateCslGate({ field: 'status', op: 'eq', value: 'active' }, { status: 'active' }), true);
});
test('evaluateCslGate: eq fails', () => {
  assert.strictEqual(evaluateCslGate({ field: 'status', op: 'eq', value: 'active' }, { status: 'inactive' }), false);
});
test('evaluateCslGate: neq', () => {
  assert.strictEqual(evaluateCslGate({ field: 'x', op: 'neq', value: 5 }, { x: 3 }), true);
});
test('evaluateCslGate: gt', () => {
  assert.strictEqual(evaluateCslGate({ field: 'count', op: 'gt', value: 3 }, { count: 5 }), true);
});
test('evaluateCslGate: gte', () => {
  assert.strictEqual(evaluateCslGate({ field: 'count', op: 'gte', value: 5 }, { count: 5 }), true);
});
test('evaluateCslGate: lt', () => {
  assert.strictEqual(evaluateCslGate({ field: 'count', op: 'lt', value: 10 }, { count: 3 }), true);
});
test('evaluateCslGate: lte', () => {
  assert.strictEqual(evaluateCslGate({ field: 'count', op: 'lte', value: 5 }, { count: 5 }), true);
});
test('evaluateCslGate: in', () => {
  assert.strictEqual(evaluateCslGate({ field: 'role', op: 'in', value: ['admin', 'user'] }, { role: 'admin' }), true);
});
test('evaluateCslGate: in fails', () => {
  assert.strictEqual(evaluateCslGate({ field: 'role', op: 'in', value: ['admin'] }, { role: 'guest' }), false);
});
test('evaluateCslGate: exists', () => {
  assert.strictEqual(evaluateCslGate({ field: 'key', op: 'exists' }, { key: 'value' }), true);
});
test('evaluateCslGate: exists fails', () => {
  assert.strictEqual(evaluateCslGate({ field: 'key', op: 'exists' }, {}), false);
});
test('evaluateCslGate: null gate returns true', () => {
  assert.strictEqual(evaluateCslGate(null, {}), true);
});
test('evaluateCslGate: unknown op returns false', () => {
  assert.strictEqual(evaluateCslGate({ field: 'x', op: 'UNKNOWN', value: 1 }, { x: 1 }), false);
});

// StateManager
asyncTest('StateManager set and get', async () => {
  const sm = new StateManager();
  await sm.set('foo', 'bar');
  const val = await sm.get('foo');
  assert.strictEqual(val, 'bar');
});

asyncTest('StateManager get returns null for missing key', async () => {
  const sm = new StateManager();
  const val = await sm.get('nonexistent');
  assert.strictEqual(val, null);
});

asyncTest('StateManager delete', async () => {
  const sm = new StateManager();
  await sm.set('k', 'v');
  await sm.delete('k');
  const val = await sm.get('k');
  assert.strictEqual(val, null);
});

asyncTest('StateManager getAll', async () => {
  const sm = new StateManager();
  await sm.set('a', 1);
  await sm.set('b', 2);
  const all = await sm.getAll(['a', 'b', 'c']);
  assert.strictEqual(all.a, 1);
  assert.strictEqual(all.b, 2);
  assert.strictEqual(all.c, null);
});

asyncTest('StateManager setAll', async () => {
  const sm = new StateManager();
  await sm.setAll({ x: 10, y: 20 });
  assert.strictEqual(await sm.get('x'), 10);
  assert.strictEqual(await sm.get('y'), 20);
});

asyncTest('StateManager snapshot and restore', async () => {
  const sm = new StateManager();
  await sm.set('a', 42);
  const snap = await sm.snapshot('test-snap');
  assert.strictEqual(snap.label, 'test-snap');
  assert.strictEqual(snap.data.a, 42);

  await sm.set('a', 99);
  await sm.restore('test-snap');
  const val = await sm.get('a');
  assert.strictEqual(val, 42);
});

asyncTest('StateManager restore throws for unknown snapshot', async () => {
  const sm = new StateManager();
  let threw = false;
  try { await sm.restore('nope'); } catch (e) { threw = true; }
  assert.ok(threw);
});

asyncTest('StateManager onChange fires', async () => {
  const sm = new StateManager();
  let fired = false;
  sm.onChange(() => { fired = true; });
  await sm.set('x', 1);
  assert.ok(fired);
});

asyncTest('StateManager getDirtyKeys', async () => {
  const sm = new StateManager();
  await sm.set('a', 1);
  await sm.set('b', 2);
  const dirty = sm.getDirtyKeys();
  assert.ok(dirty.includes('a'));
  assert.ok(dirty.includes('b'));
  sm.clearDirty();
  assert.strictEqual(sm.getDirtyKeys().length, 0);
});

asyncTest('StateManager migrateToEdge', async () => {
  const sm1 = new StateManager();
  await sm1.set('key1', 'value1');
  await sm1.set('key2', 'value2');
  const sm2 = new StateManager();
  const result = await sm1.migrateToEdge(sm2);
  assert.ok(result.migrated >= 2);
  assert.strictEqual(await sm2.get('key1'), 'value1');
});

// EdgeHealthProbe
test('EdgeHealthProbe initializes as healthy', () => {
  const probe = new EdgeHealthProbe({ agentId: 'test-agent' });
  assert.ok(probe.isHealthy());
});

test('EdgeHealthProbe getStats includes agentId', () => {
  const probe = new EdgeHealthProbe({ agentId: 'agent-123' });
  const stats = probe.getStats();
  assert.strictEqual(stats.agentId, 'agent-123');
  assert.strictEqual(stats.beatCount, 0);
});

asyncTest('EdgeHealthProbe fires onBeat callback', async () => {
  const probe = new EdgeHealthProbe({ baseMs: 50, maxMs: 100 });
  let beatFired = false;
  probe.onBeat(() => { beatFired = true; });
  probe.start();
  await new Promise(r => setTimeout(r, 200));
  probe.stop();
  assert.ok(beatFired);
});

asyncTest('EdgeHealthProbe stop prevents further beats', async () => {
  const probe = new EdgeHealthProbe({ baseMs: 50 });
  let count = 0;
  probe.onBeat(() => count++);
  probe.start();
  await new Promise(r => setTimeout(r, 80));
  probe.stop();
  const countAfterStop = count;
  await new Promise(r => setTimeout(r, 150));
  assert.strictEqual(count, countAfterStop);
});

// DurableAgent
asyncTest('DurableAgent initializes with agentId', async () => {
  const storage = new Map();
  const agent   = new DurableAgent({ id: 'test-agent', storage });
  assert.strictEqual(agent.getAgentId(), 'test-agent');
});

asyncTest('DurableAgent fetch /health returns ok', async () => {
  const storage = new Map();
  const agent   = new DurableAgent({ id: 'agent-1', storage });
  const req     = { method: 'GET', url: 'http://edge/health' };
  const res     = await agent.fetch(req);
  const body    = JSON.parse(await (res.text ? res.text() : res.body));
  assert.ok(typeof body.ok !== 'undefined');
  agent.stop();
});

asyncTest('DurableAgent fetch /state returns state', async () => {
  const storage = new Map();
  const agent   = new DurableAgent({ id: 'agent-2', storage });
  const req     = { method: 'GET', url: 'http://edge/state' };
  const res     = await agent.fetch(req);
  const body    = JSON.parse(await res.text());
  assert.ok(body.agentId);
  agent.stop();
});

asyncTest('DurableAgent fetch unknown path returns 404', async () => {
  const storage = new Map();
  const agent   = new DurableAgent({ id: 'agent-3', storage });
  const req     = { method: 'GET', url: 'http://edge/unknown-path' };
  const res     = await agent.fetch(req);
  assert.strictEqual(res.status, 404);
  agent.stop();
});

asyncTest('DurableAgent registerAction and POST /action', async () => {
  const storage = new Map();
  const agent   = new DurableAgent({ id: 'agent-4', storage });
  agent.registerAction('ping', async () => ({ pong: true }));

  const req = {
    method: 'POST',
    url:    'http://edge/action',
    json:   async () => ({ action: 'ping', payload: {} }),
  };
  const res  = await agent.fetch(req);
  const body = JSON.parse(await res.text());
  assert.ok(body.ok);
  assert.ok(body.result.pong);
  agent.stop();
});

asyncTest('DurableAgent CSL gate blocks request when condition fails', async () => {
  const storage = new Map();
  const agent   = new DurableAgent(
    { id: 'agent-5', storage },
    { cslGates: [{ field: 'status', op: 'eq', value: 'open' }] }
  );
  // status defaults to 'active', gate requires 'open'
  const req = { method: 'GET', url: 'http://edge/state' };
  const res = await agent.fetch(req);
  assert.strictEqual(res.status, 403);
  agent.stop();
});

// EdgeAgentRuntime
asyncTest('EdgeAgentRuntime creates agents on demand', async () => {
  const runtime = new EdgeAgentRuntime();
  const agent   = runtime.getOrCreate('rt-agent-1');
  assert.ok(agent);
  assert.strictEqual(agent.getAgentId(), 'rt-agent-1');
  runtime.stop();
});

asyncTest('EdgeAgentRuntime returns same agent for same ID', async () => {
  const runtime = new EdgeAgentRuntime();
  const a1 = runtime.getOrCreate('same-id');
  const a2 = runtime.getOrCreate('same-id');
  assert.strictEqual(a1, a2);
  runtime.stop();
});

asyncTest('EdgeAgentRuntime lists agent IDs', async () => {
  const runtime = new EdgeAgentRuntime();
  runtime.getOrCreate('rt-a');
  runtime.getOrCreate('rt-b');
  const ids = runtime.listAgentIds();
  assert.ok(ids.includes('rt-a'));
  assert.ok(ids.includes('rt-b'));
  runtime.stop();
});

asyncTest('EdgeAgentRuntime getAgentCount', async () => {
  const runtime = new EdgeAgentRuntime();
  runtime.getOrCreate('c1');
  runtime.getOrCreate('c2');
  runtime.getOrCreate('c3');
  assert.strictEqual(runtime.getAgentCount(), 3);
  runtime.stop();
});

asyncTest('EdgeAgentRuntime evicts oldest when maxAgents exceeded', async () => {
  const runtime = new EdgeAgentRuntime({ maxAgents: 2 });
  runtime.getOrCreate('e1');
  runtime.getOrCreate('e2');
  runtime.getOrCreate('e3'); // should evict e1
  assert.strictEqual(runtime.getAgentCount(), 2);
  runtime.stop();
});

asyncTest('EdgeAgentRuntime migrateAgent returns migration info', async () => {
  const runtime = new EdgeAgentRuntime();
  const agent   = runtime.getOrCreate('migrate-me');
  await agent._initialize();
  const result  = await runtime.migrateAgent('migrate-me', 'us-west-2');
  assert.strictEqual(result.agentId, 'migrate-me');
  assert.strictEqual(result.to, 'us-west-2');
  runtime.stop();
});

// ─── Run all queued tests sequentially then exit ───────────────────────────────
(async () => {
  for (const t of queue) await t();
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
