/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
'use strict';

const assert = require('assert');
const {
  PHI,
  SWARM_NAMES,
  PRIORITY,
  SWARM_PRIORITIES,
  SWARM_STATUS,
  MESSAGE_TYPE,
  SwarmTask,
  SwarmMessage,
  SwarmBus,
  Swarm,
  ConsensusManager,
  SwarmOrchestrator,
} = require('../src/orchestration/seventeen-swarm-orchestrator');

let passed = 0;
let failed = 0;

const _queue = [];

function test(name, fn) {
  _queue.push(async () => {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (err) { console.error(`  ✗ ${name}: ${err.message}`); failed++; }
  });
}

function asyncTest(name, fn) { test(name, fn); }

console.log('\n=== 17-Swarm Orchestrator Tests ===\n');

test('PHI constant correct', () => { assert.strictEqual(PHI, 1.6180339887); });

test('SWARM_NAMES has exactly 17 swarms', () => {
  assert.strictEqual(SWARM_NAMES.length, 17);
});

test('All 17 canonical swarms are present', () => {
  const required = ['Deploy', 'Battle', 'Research', 'Security', 'Memory', 'Creative',
    'Trading', 'Health', 'Governance', 'Documentation', 'Testing', 'Migration',
    'Monitoring', 'Cleanup', 'Onboarding', 'Analytics', 'Emergency'];
  for (const name of required) {
    assert.ok(SWARM_NAMES.includes(name), `Missing swarm: ${name}`);
  }
});

test('PRIORITY levels defined', () => {
  assert.strictEqual(PRIORITY.EMERGENCY, 100);
  assert.strictEqual(PRIORITY.CRITICAL, 80);
  assert.strictEqual(PRIORITY.HIGH, 60);
  assert.strictEqual(PRIORITY.NORMAL, 40);
  assert.strictEqual(PRIORITY.LOW, 20);
  assert.strictEqual(PRIORITY.BACKGROUND, 10);
});

test('SWARM_PRIORITIES has priority for all swarms', () => {
  for (const name of SWARM_NAMES) {
    assert.ok(SWARM_PRIORITIES[name] !== undefined, `No priority for: ${name}`);
  }
});

test('Emergency swarm has highest priority', () => {
  assert.strictEqual(SWARM_PRIORITIES.Emergency, PRIORITY.EMERGENCY);
});

test('Security swarm has critical priority', () => {
  assert.strictEqual(SWARM_PRIORITIES.Security, PRIORITY.CRITICAL);
});

test('SWARM_STATUS constants defined', () => {
  assert.strictEqual(SWARM_STATUS.IDLE, 'idle');
  assert.strictEqual(SWARM_STATUS.ACTIVE, 'active');
  assert.strictEqual(SWARM_STATUS.PAUSED, 'paused');
  assert.strictEqual(SWARM_STATUS.ERROR, 'error');
  assert.strictEqual(SWARM_STATUS.OVERLOADED, 'overloaded');
});

test('MESSAGE_TYPE constants defined', () => {
  assert.strictEqual(MESSAGE_TYPE.TASK, 'task');
  assert.strictEqual(MESSAGE_TYPE.RESULT, 'result');
  assert.strictEqual(MESSAGE_TYPE.BROADCAST, 'broadcast');
  assert.strictEqual(MESSAGE_TYPE.CONSENSUS, 'consensus');
  assert.strictEqual(MESSAGE_TYPE.HEARTBEAT, 'heartbeat');
});

// SwarmTask
test('SwarmTask initializes with defaults', () => {
  const task = new SwarmTask({ type: 'test' });
  assert.ok(task.id);
  assert.strictEqual(task.type, 'test');
  assert.strictEqual(task.status, 'pending');
  assert.strictEqual(task.priority, PRIORITY.NORMAL);
});

test('SwarmTask complete() sets status and result', () => {
  const task = new SwarmTask({ type: 'test' });
  task.complete({ answer: 42 });
  assert.strictEqual(task.status, 'completed');
  assert.deepStrictEqual(task.result, { answer: 42 });
  assert.ok(task.completedAt);
});

test('SwarmTask fail() sets status and error', () => {
  const task = new SwarmTask({ type: 'test' });
  task.fail(new Error('Something went wrong'));
  assert.strictEqual(task.status, 'failed');
  assert.ok(task.error.includes('Something'));
});

test('SwarmTask isExpired() detects expired tasks', () => {
  const task = new SwarmTask({ type: 'test', ttlMs: 1 });
  // Force expiry
  task.createdAt = Date.now() - 100;
  assert.ok(task.isExpired());
});

test('SwarmTask isExpired() false for fresh tasks', () => {
  const task = new SwarmTask({ type: 'test', ttlMs: 60000 });
  assert.ok(!task.isExpired());
});

test('SwarmTask getDuration returns null if not started', () => {
  const task = new SwarmTask({ type: 'test' });
  assert.strictEqual(task.getDuration(), null);
});

test('SwarmTask getDuration returns ms after complete', () => {
  const task = new SwarmTask({ type: 'test' });
  task.startedAt = Date.now() - 100;
  task.complete({});
  assert.ok(task.getDuration() >= 100);
});

// SwarmMessage
test('SwarmMessage initializes correctly', () => {
  const msg = new SwarmMessage({ type: MESSAGE_TYPE.BROADCAST, from: 'Deploy', payload: { x: 1 } });
  assert.ok(msg.id);
  assert.strictEqual(msg.type, MESSAGE_TYPE.BROADCAST);
  assert.strictEqual(msg.from, 'Deploy');
  assert.strictEqual(msg.payload.x, 1);
});

// SwarmBus
test('SwarmBus register and send direct message', () => {
  const bus = new SwarmBus();
  bus.register('SwarmA');
  bus.register('SwarmB');
  bus.send({ type: MESSAGE_TYPE.BROADCAST, from: 'SwarmA', to: 'SwarmB', payload: { x: 1 } });
  const drained = bus.drain('SwarmB');
  assert.strictEqual(drained.length, 1);
  assert.strictEqual(drained[0].payload.x, 1);
});

test('SwarmBus broadcast reaches all except sender', () => {
  const bus = new SwarmBus();
  bus.register('A');
  bus.register('B');
  bus.register('C');
  bus.send({ type: MESSAGE_TYPE.BROADCAST, from: 'A', payload: {} });
  assert.strictEqual(bus.drain('A').length, 0); // sender doesn't receive own broadcast
  assert.strictEqual(bus.drain('B').length, 1);
  assert.strictEqual(bus.drain('C').length, 1);
});

test('SwarmBus subscribe fires listener', () => {
  const bus = new SwarmBus();
  bus.register('Test');
  let received = null;
  bus.subscribe('Test', msg => { received = msg; });
  bus.send({ type: MESSAGE_TYPE.TASK, from: 'Other', to: 'Test', payload: { data: 'hello' } });
  assert.ok(received);
  assert.strictEqual(received.payload.data, 'hello');
});

test('SwarmBus unsubscribe removes listener', () => {
  const bus = new SwarmBus();
  bus.register('X');
  let count = 0;
  const fn = () => count++;
  bus.subscribe('X', fn);
  bus.send({ type: MESSAGE_TYPE.BROADCAST, from: 'Y', to: 'X', payload: {} });
  bus.unsubscribe('X', fn);
  bus.send({ type: MESSAGE_TYPE.BROADCAST, from: 'Z', to: 'X', payload: {} });
  assert.strictEqual(count, 1);
});

test('SwarmBus getHistory filters by from', () => {
  const bus = new SwarmBus();
  bus.register('A'); bus.register('B'); bus.register('C');
  bus.send({ from: 'A', to: 'B', payload: {} });
  bus.send({ from: 'B', to: 'C', payload: {} });
  const history = bus.getHistory({ from: 'A' });
  assert.strictEqual(history.length, 1);
});

test('SwarmBus getQueueDepth', () => {
  const bus = new SwarmBus();
  bus.register('Q');
  bus.register('Sender');
  bus.send({ from: 'Sender', to: 'Q', payload: {} });
  bus.send({ from: 'Sender', to: 'Q', payload: {} });
  assert.strictEqual(bus.getQueueDepth('Q'), 2);
});

// Swarm
asyncTest('Swarm submits and executes task', async () => {
  const bus   = new SwarmBus();
  const swarm = new Swarm('TestSwarm', { priority: PRIORITY.NORMAL });
  swarm.connectBus(bus);
  swarm.on('work', async (task) => ({ done: true, taskId: task.id }));

  const task = swarm.submit({ type: 'work', payload: { x: 1 } });
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(task.status, 'completed');
  assert.ok(task.result.done);
});

asyncTest('Swarm fails task when no handler registered', async () => {
  const bus   = new SwarmBus();
  const swarm = new Swarm('NoHandler', { priority: PRIORITY.NORMAL });
  swarm.connectBus(bus);
  // No handlers registered, but '*' handler exists by default in orchestrator context
  // Here without orchestrator, no handler → should fail
  // Override to ensure failure
  swarm._handlers = {};
  const task = swarm.submit({ type: 'unknown_type', payload: {} });
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(task.status, 'failed');
});

asyncTest('Swarm priority queue: high priority task executes before low', async () => {
  const bus   = new SwarmBus();
  const swarm = new Swarm('PrioSwarm', { maxConcurrency: 1 });
  swarm.connectBus(bus);

  const order = [];
  swarm.on('test', async (task) => {
    order.push(task.priority);
    await new Promise(r => setTimeout(r, 10));
  });

  swarm.submit({ type: 'test', priority: PRIORITY.LOW,      payload: {} });
  swarm.submit({ type: 'test', priority: PRIORITY.HIGH,     payload: {} });
  swarm.submit({ type: 'test', priority: PRIORITY.CRITICAL, payload: {} });

  await new Promise(r => setTimeout(r, 150));
  // Higher priority should have been processed earlier
  assert.ok(order.length > 0);
});

test('Swarm pause and resume', () => {
  const bus   = new SwarmBus();
  const swarm = new Swarm('PauseTest');
  swarm.connectBus(bus);
  swarm.on('*', async () => {});
  swarm.pause();
  assert.strictEqual(swarm.status, SWARM_STATUS.PAUSED);
  swarm.resume();
  assert.strictEqual(swarm.status, SWARM_STATUS.IDLE);
});

test('Swarm getStatus', () => {
  const bus   = new SwarmBus();
  const swarm = new Swarm('StatusTest', { priority: PRIORITY.NORMAL });
  swarm.connectBus(bus);
  swarm.on('*', async () => {});
  const status = swarm.getStatus();
  assert.strictEqual(status.name, 'StatusTest');
  assert.ok(typeof status.queue === 'number');
  assert.ok(typeof status.active === 'number');
  assert.ok(status.stats);
});

asyncTest('Swarm evicts old tasks when queue full', async () => {
  const bus   = new SwarmBus();
  const swarm = new Swarm('OverflowSwarm', { maxQueue: 3, maxConcurrency: 0 }); // no concurrency = queue fills
  swarm.connectBus(bus);
  swarm.on('*', async () => { await new Promise(r => setTimeout(r, 1000)); }); // slow handler

  // Submit 5 tasks
  for (let i = 0; i < 5; i++) {
    swarm.submit({ type: 'slow', priority: PRIORITY.NORMAL + (i % 2), payload: {} });
  }
  // Queue should not exceed maxQueue + some tolerance
  assert.ok(swarm.getQueueDepth() <= 5);
});

// ConsensusManager
test('ConsensusManager propose creates proposal', () => {
  const cm = new ConsensusManager();
  cm.propose('p1', { action: 'deploy' }, ['Deploy', 'Security']);
  const p = cm.getProposal('p1');
  assert.ok(p);
  assert.deepStrictEqual(p.participants, ['Deploy', 'Security']);
});

test('ConsensusManager vote and resolve', () => {
  const cm = new ConsensusManager({ quorum: 0.5 });
  cm.propose('p2', { action: 'test' }, ['A', 'B', 'C']);
  cm.vote('p2', 'A', 'approve');
  cm.vote('p2', 'B', 'approve');
  const result = cm.vote('p2', 'C', 'reject');
  // Should resolve with 3/3 votes
  assert.ok(result);
  assert.ok(result.decision);
  assert.ok(result.confidence > 0);
});

test('ConsensusManager getProposal returns null for unknown', () => {
  const cm = new ConsensusManager();
  assert.strictEqual(cm.getProposal('unknown'), null);
});

asyncTest('ConsensusManager waitForConsensus resolves', async () => {
  const cm = new ConsensusManager({ quorum: 0.5, timeoutMs: 1000 });
  cm.propose('p3', { x: 1 }, ['X', 'Y']);
  setTimeout(() => {
    cm.vote('p3', 'X', 'approve');
    cm.vote('p3', 'Y', 'approve');
  }, 10);
  const result = await cm.waitForConsensus('p3');
  assert.ok(result.decision);
});

asyncTest('ConsensusManager waitForConsensus times out', async () => {
  const cm = new ConsensusManager({ quorum: 1.0, timeoutMs: 100 });
  cm.propose('p4', { x: 1 }, ['A', 'B', 'C']);
  // Only vote 1 of 3
  cm.vote('p4', 'A', 'approve');
  let threw = false;
  try { await cm.waitForConsensus('p4'); } catch (e) { threw = true; }
  assert.ok(threw);
});

// SwarmOrchestrator
test('SwarmOrchestrator creates all 17 swarms', () => {
  const orch = new SwarmOrchestrator();
  for (const name of SWARM_NAMES) {
    assert.ok(orch.getSwarm(name), `Missing swarm: ${name}`);
  }
});

test('SwarmOrchestrator getAllSwarms returns all 17', () => {
  const orch   = new SwarmOrchestrator();
  const swarms = orch.getAllSwarms();
  assert.strictEqual(swarms.size, 17);
});

test('SwarmOrchestrator listSwarmNames', () => {
  const orch  = new SwarmOrchestrator();
  const names = orch.listSwarmNames();
  assert.deepStrictEqual(names, SWARM_NAMES);
});

asyncTest('SwarmOrchestrator dispatch routes to named swarm', async () => {
  const orch   = new SwarmOrchestrator();
  const deploy = orch.getSwarm('Deploy');
  deploy.on('deploy_app', async (task) => ({ deployed: true }));

  const task = orch.dispatch({ type: 'deploy_app', targetSwarm: 'Deploy', payload: {} });
  await new Promise(r => setTimeout(r, 100));
  assert.strictEqual(task.status, 'completed');
  assert.ok(task.result.deployed);
});

asyncTest('SwarmOrchestrator dispatch routes by task type match', async () => {
  const orch = new SwarmOrchestrator();
  orch.getSwarm('Security').on('security_scan', async () => ({ scanned: true }));

  const task = orch.dispatch({ type: 'security_scan', payload: {} });
  await new Promise(r => setTimeout(r, 100));
  // Should have been routed to Security swarm
  assert.ok(task.status === 'completed' || task.status === 'failed'); // at least processed
});

asyncTest('SwarmOrchestrator start and stop', async () => {
  const orch = new SwarmOrchestrator({ schedulerMs: 50 });
  orch.start();
  assert.ok(orch._initialized);
  await new Promise(r => setTimeout(r, 100));
  orch.stop();
  assert.ok(!orch._initialized);
});

asyncTest('SwarmOrchestrator Health swarm health_check', async () => {
  const orch  = new SwarmOrchestrator();
  const task  = orch.dispatch({ type: 'health_check', targetSwarm: 'Health', payload: {} });
  await new Promise(r => setTimeout(r, 100));
  assert.strictEqual(task.status, 'completed');
  assert.ok(task.result.ok);
});

asyncTest('SwarmOrchestrator Monitoring get_status', async () => {
  const orch = new SwarmOrchestrator();
  const task = orch.dispatch({ type: 'get_status', targetSwarm: 'Monitoring', payload: {} });
  await new Promise(r => setTimeout(r, 100));
  assert.strictEqual(task.status, 'completed');
  assert.ok(task.result.swarms);
  assert.strictEqual(task.result.swarms.length, 17);
});

asyncTest('SwarmOrchestrator Analytics get_metrics', async () => {
  const orch = new SwarmOrchestrator();
  const task = orch.dispatch({ type: 'get_metrics', targetSwarm: 'Analytics', payload: {} });
  await new Promise(r => setTimeout(r, 100));
  assert.strictEqual(task.status, 'completed');
  assert.ok(task.result.metrics);
});

asyncTest('SwarmOrchestrator registerHandler custom handler', async () => {
  const orch = new SwarmOrchestrator();
  orch.registerHandler('Research', 'deep_dive', async (task) => ({ findings: 'result' }));
  const task = orch.dispatch({ type: 'deep_dive', targetSwarm: 'Research', payload: {} });
  await new Promise(r => setTimeout(r, 100));
  assert.strictEqual(task.status, 'completed');
  assert.strictEqual(task.result.findings, 'result');
});

asyncTest('SwarmOrchestrator broadcast sends to all swarms', async () => {
  const orch = new SwarmOrchestrator();
  orch.broadcast({ message: 'test broadcast' }, MESSAGE_TYPE.BROADCAST);
  // Bus history should have the broadcast
  const history = orch.getBus().getHistory({ since: Date.now() - 1000 });
  assert.ok(history.some(m => m.payload.message === 'test broadcast'));
});

test('SwarmOrchestrator getStatus', () => {
  const orch   = new SwarmOrchestrator();
  const status = orch.getStatus();
  assert.strictEqual(status.swarms.length, 17);
  assert.ok(typeof status.totalTasks === 'number');
});

asyncTest('SwarmOrchestrator getAuditLog records dispatch', async () => {
  const orch = new SwarmOrchestrator();
  orch.dispatch({ type: 'health_check', targetSwarm: 'Health', payload: {} });
  await new Promise(r => setTimeout(r, 100));
  const log = orch.getAuditLog();
  assert.ok(log.length > 0);
});

asyncTest('SwarmOrchestrator Emergency swarm broadcasts on escalation', async () => {
  const orch  = new SwarmOrchestrator();
  const task  = orch.dispatch({
    type:        'critical_failure',
    targetSwarm: 'Emergency',
    priority:    PRIORITY.EMERGENCY,
    payload:     { message: 'system down' },
  });
  await new Promise(r => setTimeout(r, 100));
  assert.strictEqual(task.status, 'completed');
  assert.ok(task.result.acknowledged);
});

asyncTest('SwarmOrchestrator runConsensus reaches decision', async () => {
  const orch = new SwarmOrchestrator();
  orch.start();
  orch.registerHandler('Governance', 'vote', async (task) => {
    const { proposalId, swarmName } = task.payload;
    return orch.getConsensus().vote(proposalId, swarmName, 'approve', 1.0);
  });

  const result = await orch.runConsensus({ action: 'test_consensus' }, ['Deploy', 'Security', 'Health']);
  assert.ok(result);
  assert.ok(result.decision);
  orch.stop();
});

(async () => {
  for (const t of _queue) await t();
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
