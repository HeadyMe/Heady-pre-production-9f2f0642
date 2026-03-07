/**
 * HeadySystems™ — Orchestration Pattern Tests
 * Tests all 8 resilience patterns implemented in src/orchestration/index.js
 */

'use strict';

const {
    HeadyOrchestrator,
    CircuitBreaker,
    BulkheadIsolation,
    SagaOrchestrator,
    EventStore,
    CQRSHandler,
    SkillRouter,
    AutoTuner,
    HotColdPathRouter,
    CircuitState,
    PHI,
} = require('../../src/orchestration/index');

// ─── CircuitBreaker ──────────────────────────────────────────────

describe('CircuitBreaker', () => {
    test('starts in CLOSED state', () => {
        const cb = new CircuitBreaker('test');
        expect(cb.state).toBe(CircuitState.CLOSED);
    });

    test('executes function successfully', async () => {
        const cb = new CircuitBreaker('test');
        const result = await cb.execute(() => Promise.resolve('ok'));
        expect(result).toBe('ok');
    });

    test('opens after threshold failures', async () => {
        const cb = new CircuitBreaker('test', { failureThreshold: 3 });
        for (let i = 0; i < 3; i++) {
            await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => { });
        }
        expect(cb.state).toBe(CircuitState.OPEN);
    });

    test('rejects requests when OPEN', async () => {
        const cb = new CircuitBreaker('test', { failureThreshold: 1 });
        await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => { });
        await expect(cb.execute(() => Promise.resolve('ok'))).rejects.toThrow('OPEN');
    });
});

// ─── BulkheadIsolation ───────────────────────────────────────────

describe('BulkheadIsolation', () => {
    test('allows execution under limit', async () => {
        const bh = new BulkheadIsolation('test', 5);
        const result = await bh.execute(() => Promise.resolve('ok'));
        expect(result).toBe('ok');
        expect(bh.active).toBe(0);
    });

    test('reports correct status', () => {
        const bh = new BulkheadIsolation('test', 5);
        const status = bh.getStatus();
        expect(status.name).toBe('test');
        expect(status.max).toBe(5);
    });
});

// ─── SagaOrchestrator ────────────────────────────────────────────

describe('SagaOrchestrator', () => {
    test('completes all steps successfully', async () => {
        const saga = new SagaOrchestrator();
        saga.addStep('step1', (ctx) => 'result1', (ctx) => { });
        saga.addStep('step2', (ctx) => 'result2', (ctx) => { });
        const result = await saga.run();
        expect(result.step1).toBe('result1');
        expect(result.step2).toBe('result2');
    });

    test('compensates on failure', async () => {
        const compensated = [];
        const saga = new SagaOrchestrator();
        saga.addStep('step1', () => 'ok', () => compensated.push('comp1'));
        saga.addStep('step2', () => { throw new Error('boom'); }, () => compensated.push('comp2'));

        await expect(saga.run()).rejects.toThrow('Saga failed at step "step2"');
        expect(compensated).toEqual(['comp1']);
    });
});

// ─── EventStore ──────────────────────────────────────────────────

describe('EventStore', () => {
    test('appends and retrieves events', () => {
        const store = new EventStore();
        store.append('stream1', { type: 'CREATED', data: { name: 'test' } });
        store.append('stream1', { type: 'UPDATED', data: { name: 'test2' } });
        const stream = store.getStream('stream1');
        expect(stream.length).toBe(2);
        expect(stream[0].type).toBe('CREATED');
    });

    test('replays events through reducer', () => {
        const store = new EventStore();
        store.append('counter', { type: 'INCREMENT', data: { amount: 1 } });
        store.append('counter', { type: 'INCREMENT', data: { amount: 5 } });
        const state = store.replay('counter', (state, event) => {
            if (event.type === 'INCREMENT') return { count: (state.count || 0) + event.data.amount };
            return state;
        });
        expect(state.count).toBe(6);
    });

    test('snapshots and replays from snapshot', () => {
        const store = new EventStore();
        store.append('s1', { type: 'A', data: {} });
        store.append('s1', { type: 'B', data: {} });
        store.snapshot('s1', { total: 2 });
        store.append('s1', { type: 'C', data: {} });
        const snap = store.getSnapshot('s1');
        expect(snap.state.total).toBe(2);
    });
});

// ─── CQRSHandler ─────────────────────────────────────────────────

describe('CQRSHandler', () => {
    test('executes commands and queries', async () => {
        const store = new EventStore();
        const cqrs = new CQRSHandler(store);

        cqrs.registerCommand('CREATE_TASK', (payload) => {
            return [{ type: 'TASK_CREATED', data: payload }];
        });
        cqrs.registerQuery('GET_TASKS', (params, readModels) => {
            return readModels.get('tasks') || [];
        });

        const events = await cqrs.executeCommand('CREATE_TASK', { id: 1, name: 'test' });
        expect(events.length).toBe(1);

        cqrs.updateReadModel('tasks', [{ id: 1, name: 'test' }]);
        const tasks = await cqrs.executeQuery('GET_TASKS', {});
        expect(tasks.length).toBe(1);
    });
});

// ─── SkillRouter ─────────────────────────────────────────────────

describe('SkillRouter', () => {
    test('routes to best matching agent', () => {
        const router = new SkillRouter();
        router.registerAgent('agent-a', ['code', 'analysis'], 1.0);
        router.registerAgent('agent-b', ['chat', 'memory'], 1.0);

        const route = router.route({ type: 'code', id: 't1' });
        expect(route.agentId).toBe('agent-a');
    });

    test('applies φ-weighted scoring', () => {
        const router = new SkillRouter();
        router.registerAgent('agent-a', ['code', 'analysis'], 1.0);
        const route = router.route({ type: 'code', id: 't2' });
        expect(route.score).toBeGreaterThan(0);
    });

    test('releases agent load', () => {
        const router = new SkillRouter();
        router.registerAgent('agent-a', ['code'], 1.0);
        router.route({ type: 'code', id: 't1' });
        expect(router.getAgentStats()[0].status).toBe('busy');
        router.releaseAgent('agent-a', 0.1);
        expect(router.getAgentStats()[0].status).toBe('idle');
    });
});

// ─── AutoTuner ───────────────────────────────────────────────────

describe('AutoTuner', () => {
    test('records metrics and returns params', () => {
        const tuner = new AutoTuner({ poolSize: 10, timeout: 5000 });
        tuner.record('latency', 50);
        tuner.record('latency', 60);
        expect(tuner.getParams().poolSize).toBe(10);
    });

    test('φ-scales pool size on high latency', () => {
        const tuner = new AutoTuner({ poolSize: 10 });
        for (let i = 0; i < 10; i++) tuner.record('latency', 150);
        tuner.tune();
        expect(tuner.getParams().poolSize).toBe(Math.ceil(10 * PHI));
    });
});

// ─── HotColdPathRouter ──────────────────────────────────────────

describe('HotColdPathRouter', () => {
    test('routes high priority to hot path', () => {
        const router = new HotColdPathRouter();
        const result = router.route({ priority: 0.9, id: 't1' });
        expect(result.path).toBe('hot');
    });

    test('routes low priority to cold path', () => {
        const router = new HotColdPathRouter();
        const result = router.route({ priority: 0.3, id: 't2' });
        expect(result.path).toBe('cold');
    });
});

// ─── HeadyOrchestrator (integration) ───────────────────────────

describe('HeadyOrchestrator', () => {
    let orchestrator;

    beforeEach(() => {
        orchestrator = new HeadyOrchestrator();
        orchestrator.registerAgent('coder', ['code', 'analysis'], 1.0);
        orchestrator.registerAgent('buddy', ['chat', 'memory'], 1.0);
    });

    afterEach(() => orchestrator.shutdown());

    test('assigns task through full pipeline', async () => {
        const result = await orchestrator.assignTask({ id: 't1', type: 'code', priority: 0.8 });
        expect(result.agentId).toBe('coder');
        expect(result.status).toBe('completed');
    });

    test('returns system health report', () => {
        const health = orchestrator.getSystemHealth();
        expect(health.agents.length).toBe(2);
        expect(health.totalTasks).toBe(0);
    });

    test('creates saga instances', () => {
        const saga = orchestrator.createSaga();
        expect(saga).toBeInstanceOf(SagaOrchestrator);
    });
});
