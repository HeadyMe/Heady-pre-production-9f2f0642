/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Tests: Dynamic Bee Factory Enhanced (HS-060)
 * Covers all 9 patent claims.
 */

'use strict';

const assert = require('assert');
const {
  DynamicBeeFactory,
  BeeRegistry,
  SwarmCoordinator,
  DissolutionModule,
  WorkInjector,
  PHI,
  AGENT_TYPES,
  SWARM_POLICY_MODES,
  DISSOLUTION_REASONS,
} = require('../src/agents/dynamic-bee-factory-enhanced');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${name}`);
    console.error(`       ${err.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${name}`);
    console.error(`       ${err.message}`);
    failed++;
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

console.log('\n── Constants ─────────────────────────────────────────────────────');

test('PHI equals 1.6180339887', () => {
  assert.strictEqual(PHI, 1.6180339887);
});

test('AGENT_TYPES includes all expected types', () => {
  assert(AGENT_TYPES.DYNAMIC);
  assert(AGENT_TYPES.EPHEMERAL);
  assert(AGENT_TYPES.TEMPLATE);
  assert(AGENT_TYPES.SWARM);
});

test('SWARM_POLICY_MODES includes parallel, sequential, pipeline', () => {
  assert(SWARM_POLICY_MODES.PARALLEL === 'parallel');
  assert(SWARM_POLICY_MODES.SEQUENTIAL === 'sequential');
  assert(SWARM_POLICY_MODES.PIPELINE === 'pipeline');
});

// ─── Claim 1: Runtime Creation with SHA-256 Identity ─────────────────────────

console.log('\n── Claim 1: Runtime agent creation with SHA-256 identity ────────');

test('createAgent returns an entry with id and domain', () => {
  const factory = new DynamicBeeFactory();
  const entry   = factory.createAgent('test-domain', { description: 'Test', priority: 0.7 });
  assert.strictEqual(entry.domain, 'test-domain');
  assert(entry.id, 'Expected a SHA-256 id');
});

test('createAgent SHA-256 identity is 64-char hex', () => {
  const factory = new DynamicBeeFactory();
  const entry   = factory.createAgent('crypto-test', { priority: 0.5 });
  assert.match(entry.id, /^[a-f0-9]{64}$/, `Expected 64-char hex, got: ${entry.id}`);
});

test('createAgent registers in persistent registry', () => {
  const factory = new DynamicBeeFactory();
  factory.createAgent('reg-test', { priority: 0.5 });
  const found = factory.registry.get('reg-test');
  assert(found, 'Expected entry in registry');
});

test('createAgent stores getWork function', () => {
  const factory = new DynamicBeeFactory();
  const workFn  = async () => ({ result: 42 });
  const entry   = factory.createAgent('work-test', { workers: [{ name: 'compute', fn: workFn }] });
  assert(typeof entry.getWork === 'function');
  const fns = entry.getWork();
  assert(fns.length === 1);
});

test('createAgent sets priority and description', () => {
  const factory = new DynamicBeeFactory();
  const entry   = factory.createAgent('priority-test', { description: 'Desc', priority: 0.9 });
  assert.strictEqual(entry.priority, 0.9);
  assert.strictEqual(entry.description, 'Desc');
});

// ─── Claim 2: Template-Based Creation ────────────────────────────────────────

console.log('\n── Claim 2: Template-based creation ────────────────────────────');

test('createFromTemplate("health-check") creates a health bee', () => {
  const factory = new DynamicBeeFactory();
  const entry   = factory.createFromTemplate('health-check', { target: 'api-service', url: 'https://example.com' });
  assert(entry.domain.includes('health'), `Expected health in domain: ${entry.domain}`);
  assert(typeof entry.getWork === 'function');
});

test('createFromTemplate("monitor") creates a monitor bee', () => {
  const factory = new DynamicBeeFactory();
  const entry   = factory.createFromTemplate('monitor', { target: 'process' });
  assert(entry.domain.includes('monitor'));
});

test('createFromTemplate("processor") accepts task array', () => {
  const factory = new DynamicBeeFactory();
  const entry   = factory.createFromTemplate('processor', {
    name: 'data-pipe',
    tasks: [{ name: 'step1', fn: async () => ({ step: 1 }) }],
  });
  assert(entry.domain.includes('processor'));
  const fns = entry.getWork();
  assert.strictEqual(fns.length, 1);
});

test('createFromTemplate("scanner") creates a scanner bee', () => {
  const factory = new DynamicBeeFactory();
  const entry   = factory.createFromTemplate('scanner', { target: 'repo', scanPath: '/tmp' });
  assert(entry.domain.includes('scanner'));
  const fns = entry.getWork();
  assert.strictEqual(fns.length, 2); // scan + report
});

test('createFromTemplate throws on unknown template', () => {
  const factory = new DynamicBeeFactory();
  assert.throws(() => factory.createFromTemplate('unknown-template'));
});

// ─── Claim 3: Ephemeral Spawn ─────────────────────────────────────────────────

console.log('\n── Claim 3: Ephemeral spawn ──────────────────────────────────────');

test('spawnEphemeral registers in ephemeral registry', () => {
  const factory = new DynamicBeeFactory();
  const entry   = factory.spawnEphemeral('quick-task', async () => ({ done: true }));
  assert.strictEqual(entry.ephemeral, true);
  assert(entry.domain.includes('ephemeral'));
});

test('spawnEphemeral has SHA-256 identity', () => {
  const factory = new DynamicBeeFactory();
  const entry   = factory.spawnEphemeral('anon-work', async () => ({}));
  assert.match(entry.id, /^[a-f0-9]{64}$/);
});

test('spawnEphemeral with array of work functions', () => {
  const factory = new DynamicBeeFactory();
  const entry   = factory.spawnEphemeral('multi', [
    async () => ({ step: 1 }),
    async () => ({ step: 2 }),
  ]);
  const fns = entry.getWork();
  assert.strictEqual(fns.length, 2);
});

// ─── Claim 4: Persistent to Disk ─────────────────────────────────────────────

console.log('\n── Claim 4: Persistent to disk ──────────────────────────────────');

test('createAgent with persist=false does NOT create a file', () => {
  const fs = require('fs');
  const factory = new DynamicBeeFactory({ beesDir: '/tmp/heady-test-bees' });
  factory.createAgent('no-persist-domain', { persist: false, priority: 0.5 });
  const filePath = `/tmp/heady-test-bees/no-persist-domain-bee.js`;
  assert(!fs.existsSync(filePath), 'File should not be created when persist=false');
});

test('createAgent with persist=true creates a bee file', () => {
  const fs   = require('fs');
  const path = require('path');
  const beesDir = `/tmp/heady-test-bees-${Date.now()}`;
  const factory = new DynamicBeeFactory({ beesDir });
  factory.createAgent('persist-test-domain', {
    description: 'Persisted bee',
    priority: 0.7,
    persist: true,
    workers: [{ name: 'work1', fn: async () => ({}) }],
  });
  const filePath = path.join(beesDir, 'persist-test-domain-bee.js');
  const exists = fs.existsSync(filePath);
  if (exists) fs.rmSync(beesDir, { recursive: true, force: true });
  assert(exists, `Expected file at ${filePath}`);
});

// ─── Claim 5 + 6: Swarm Formation ────────────────────────────────────────────

console.log('\n── Claims 5+6: Swarm formation and consensus ────────────────────');

(async () => {

await testAsync('createSwarm forms a swarm with two agents', async () => {
  const factory = new DynamicBeeFactory();
  factory.createAgent('bee-alpha', { workers: [{ name: 'w', fn: async () => ({ ok: true }) }] });
  factory.createAgent('bee-beta',  { workers: [{ name: 'w', fn: async () => ({ ok: true }) }] });
  const { swarm } = await factory.createSwarm('test-swarm', [
    { domain: 'bee-alpha' },
    { domain: 'bee-beta' },
  ], { mode: 'parallel', requireConsensus: false });
  assert.strictEqual(swarm.agentCount, 2);
  assert(swarm.swarmId.includes('test-swarm'));
});

await testAsync('executeSwarm returns per-agent results', async () => {
  const factory = new DynamicBeeFactory();
  factory.createAgent('agent-1', { workers: [{ name: 'run', fn: async () => ({ value: 1 }) }] });
  factory.createAgent('agent-2', { workers: [{ name: 'run', fn: async () => ({ value: 2 }) }] });
  const { swarm } = await factory.createSwarm('exec-swarm', [
    { domain: 'agent-1' },
    { domain: 'agent-2' },
  ]);
  const exec = await factory.swarmCoordinator.executeSwarm(swarm.swarmId);
  assert.strictEqual(exec.agentCount, 2);
  assert(Array.isArray(exec.results));
  assert.strictEqual(exec.results.length, 2);
});

await testAsync('requireConsensus=true reports failure when an agent fails', async () => {
  const factory = new DynamicBeeFactory();
  factory.createAgent('good-agent', { workers: [{ name: 'run', fn: async () => ({ ok: true }) }] });
  factory.createAgent('bad-agent',  { workers: [{ name: 'run', fn: async () => { throw new Error('intentional failure'); } }] });
  const { swarm } = await factory.createSwarm('consensus-swarm', [
    { domain: 'good-agent' },
    { domain: 'bad-agent' },
  ], { requireConsensus: true, mode: 'parallel' });
  const exec = await factory.swarmCoordinator.executeSwarm(swarm.swarmId);
  assert.strictEqual(exec.requireConsensus, true);
  assert.strictEqual(exec.consensus, false);
});

await testAsync('sequential mode executes agents one at a time', async () => {
  const factory = new DynamicBeeFactory();
  const order = [];
  factory.createAgent('seq-a', { workers: [{ name: 'r', fn: async () => { order.push('a'); return {}; } }] });
  factory.createAgent('seq-b', { workers: [{ name: 'r', fn: async () => { order.push('b'); return {}; } }] });
  const { swarm } = await factory.createSwarm('seq-swarm', [
    { domain: 'seq-a' },
    { domain: 'seq-b' },
  ], { mode: 'sequential' });
  await factory.swarmCoordinator.executeSwarm(swarm.swarmId);
  assert.deepStrictEqual(order, ['a', 'b']);
});

await testAsync('swarm timeout per agent is enforced', async () => {
  const factory = new DynamicBeeFactory();
  factory.createAgent('slow-agent', {
    workers: [{ name: 'run', fn: async () => {
      await new Promise(r => setTimeout(r, 500));
      return { done: true };
    } }],
  });
  const { swarm } = await factory.createSwarm('timeout-swarm', [
    { domain: 'slow-agent' },
  ], { timeoutMs: 50, requireConsensus: true });
  const exec = await factory.swarmCoordinator.executeSwarm(swarm.swarmId);
  assert.strictEqual(exec.failureCount, 1);
});

// ─── Claim 7: Dissolution Protocol ────────────────────────────────────────────

console.log('\n── Claim 7: Dissolution protocol ────────────────────────────────');

test('dissolve removes agent from registry', () => {
  const factory = new DynamicBeeFactory();
  factory.createAgent('to-dissolve');
  assert(factory.registry.get('to-dissolve'), 'Should exist before dissolution');
  factory.dissolve('to-dissolve', { deleteDisk: false });
  assert(!factory.registry.get('to-dissolve'), 'Should be gone after dissolution');
});

test('dissolve returns dissolution record', () => {
  const factory = new DynamicBeeFactory();
  factory.createAgent('dissolve-me');
  const rec = factory.dissolve('dissolve-me', { reason: DISSOLUTION_REASONS.TASK_DONE, deleteDisk: false });
  assert.strictEqual(rec.domain, 'dissolve-me');
  assert.strictEqual(rec.removed, true);
  assert.strictEqual(rec.reason, DISSOLUTION_REASONS.TASK_DONE);
});

test('dissolveWhere removes all matching agents', () => {
  const factory = new DynamicBeeFactory();
  factory.createAgent('dw-temp-1', { priority: 0.1 });
  factory.createAgent('dw-temp-2', { priority: 0.1 });
  factory.createAgent('dw-keep-1', { priority: 0.9 });
  // Each createAgent registers under both id (hex) and domain string,
  // so dissolveWhere sees 2 entries per agent that match the filter.
  // We verify that after dissolution, the named domains are gone.
  factory.dissolutionModule.dissolveWhere(
    e => e.priority === 0.1,
    { deleteDisk: false }
  );
  assert(!factory.registry.get('dw-temp-1'), 'dw-temp-1 should be dissolved');
  assert(!factory.registry.get('dw-temp-2'), 'dw-temp-2 should be dissolved');
  assert(factory.registry.get('dw-keep-1'),  'dw-keep-1 should still exist');
});

// ─── Claim 8: Work Injection ──────────────────────────────────────────────────

console.log('\n── Claim 8: Work function injection ─────────────────────────────');

test('injectWork adds a work function to an existing agent', () => {
  const factory = new DynamicBeeFactory();
  factory.createAgent('inject-target', { workers: [{ name: 'original', fn: async () => ({}) }] });
  factory.injectWork('inject-target', 'injected', async () => ({ injected: true }));
  const entry = factory.registry.get('inject-target');
  const fns   = entry.getWork();
  assert.strictEqual(fns.length, 2);
});

await testAsync('injected work function executes correctly', async () => {
  const factory = new DynamicBeeFactory();
  factory.createAgent('exec-inject', {});
  factory.injectWork('exec-inject', 'new-work', async () => ({ magic: 42 }));
  const entry = factory.registry.get('exec-inject');
  const fns   = entry.getWork();
  const res   = await fns[0]();
  assert.strictEqual(res.magic, 42);
});

test('injectWork creates a new agent if domain does not exist', () => {
  const factory = new DynamicBeeFactory();
  const result  = factory.injectWork('brand-new-domain', 'w1', async () => ({}));
  assert.strictEqual(result.created, true);
  assert(factory.registry.get('brand-new-domain'));
});

// ─── Claim 9: Full System ─────────────────────────────────────────────────────

console.log('\n── Claim 9: Full system ──────────────────────────────────────────');

test('DynamicBeeFactory exposes all required subsystems', () => {
  const factory = new DynamicBeeFactory();
  assert(factory.registry         instanceof BeeRegistry);
  assert(factory.dissolutionModule instanceof DissolutionModule);
  assert(factory.swarmCoordinator  instanceof SwarmCoordinator);
  assert(factory.workInjector      instanceof WorkInjector);
});

test('listAgents returns all registered agents', () => {
  const factory = new DynamicBeeFactory();
  factory.createAgent('list-a');
  factory.createAgent('list-b');
  factory.spawnEphemeral('ephemeral-list', async () => ({}));
  const agents = factory.listAgents();
  assert(agents.length >= 3, `Expected at least 3 agents, got ${agents.length}`);
});

test('factory.status() includes phi and registry stats', () => {
  const factory = new DynamicBeeFactory();
  const status  = factory.status();
  assert.strictEqual(status.phi, PHI);
  assert(status.registry);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n── Results ──────────────────────────────────────────────────────`);
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total:  ${passed + failed}`);

if (failed > 0) process.exit(1);

})();
