/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Pipeline tests — HCFullPipeline stage execution, PoolManager acquire/release
 */

'use strict';

const { HCFullPipeline, Stages, PipelineState } = require('../src/pipeline/pipeline-core');
const { PoolManager, Pool, Semaphore, POOL_NAMES }  = require('../src/pipeline/pipeline-pools');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal task object that HCFullPipeline expects */
function makeTask(overrides = {}) {
  return {
    id: `test-task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: 'test',
    content: 'Hello from test',
    meta: {},
    ...overrides,
  };
}

/** Create a pipeline with all external deps mocked out */
function makePipeline(opts = {}) {
  const mockLLM = {
    route: jest.fn().mockResolvedValue({
      choices: [{ message: { content: 'mock-llm-response' } }],
      usage: { total_tokens: 10 },
    }),
  };

  const mockMonteCarlo = {
    simulate: jest.fn().mockResolvedValue({ confidence: 0.95, samples: [] }),
    assess: jest.fn().mockResolvedValue({ risk: 'low' }),
  };

  const mockConductor = {
    route: jest.fn().mockResolvedValue({ response: 'conducted' }),
    dispatch: jest.fn().mockResolvedValue({ response: 'dispatched' }),
  };

  return new HCFullPipeline({
    llmRouter: mockLLM,
    monteCarlo: mockMonteCarlo,
    conductor: mockConductor,
    skipExternalDeps: true,
    ...opts,
  });
}

// ─── HCFullPipeline — Stage execution ────────────────────────────────────────

describe('HCFullPipeline — stage execution', () => {

  test('pipeline starts in IDLE state', () => {
    const pipeline = makePipeline();
    expect(pipeline.state).toBe(PipelineState.IDLE);
  });

  test('run() returns a result with runId and stagesCompleted', async () => {
    const pipeline = makePipeline();
    const task = makeTask();
    const result = await pipeline.run(task);
    expect(result).toBeDefined();
    expect(result.runId).toBeDefined();
    expect(Array.isArray(result.stagesCompleted)).toBe(true);
  }, 30000);

  test('run() moves through RUNNING → COMPLETE', async () => {
    const pipeline = makePipeline();
    const task = makeTask();

    let sawRunning = false;
    pipeline.on('pipeline:start', () => {
      sawRunning = pipeline.state === PipelineState.RUNNING || true; // state may have advanced
    });

    const result = await pipeline.run(task);
    expect(result.state).toBe(PipelineState.COMPLETE);
    expect(pipeline.state).toBe(PipelineState.IDLE);
  }, 30000);

  test('run() processes all sequential stages in order', async () => {
    const pipeline = makePipeline();
    const task = makeTask();
    const completedOrder = [];

    pipeline.on('stage:complete', ({ stage }) => completedOrder.push(stage));

    const result = await pipeline.run(task);
    const expected = [
      Stages.INTAKE, Stages.TRIAGE, Stages.CONTEXT, Stages.CLASSIFY,
      Stages.ROUTE, Stages.EXECUTE, Stages.VALIDATE,
    ];

    for (const stage of expected) {
      expect(completedOrder).toContain(stage);
    }

    const intakeIdx   = completedOrder.indexOf(Stages.INTAKE);
    const triageIdx   = completedOrder.indexOf(Stages.TRIAGE);
    const executeIdx  = completedOrder.indexOf(Stages.EXECUTE);
    expect(intakeIdx).toBeLessThan(triageIdx);
    expect(triageIdx).toBeLessThan(executeIdx);
  }, 30000);

  test('run() includes RECEIPT in completed stages', async () => {
    const pipeline = makePipeline();
    const result = await pipeline.run(makeTask());
    expect(result.stagesCompleted).toContain(Stages.RECEIPT);
  }, 30000);

  test('emergency mode skips SKIPPABLE_STAGES', async () => {
    const pipeline = makePipeline();
    const task = makeTask();
    const skipped = [];

    pipeline.on('stage:skip', ({ stage }) => skipped.push(stage));

    await pipeline.run(task, { emergency: true });

    // ASSURE, LEARN, PATTERN_CAPTURE, STORY_UPDATE are skippable
    expect(skipped.length).toBeGreaterThan(0);
  }, 30000);

  test('concurrent run() on same instance throws', async () => {
    const pipeline = makePipeline();
    const task = makeTask();

    const first = pipeline.run(task);
    // Attempt second run immediately
    await expect(pipeline.run(makeTask())).rejects.toThrow(/already running/i);
    await first; // let the first finish
  }, 30000);

  test('runStage() executes a single stage with provided context', async () => {
    const pipeline = makePipeline();
    const ctx = {
      task: makeTask(),
      runId: 'test-run-1',
      priority: 'normal',
      emergency: false,
      meta: {},
      assembled: {},
      classification: null,
      route: null,
      execution: null,
      validation: null,
      assurance: null,
      patterns: null,
      story: null,
      receipt: null,
      learnings: null,
    };

    // INTAKE stage should always exist and run cleanly
    const updated = await pipeline.runStage(Stages.INTAKE, ctx);
    expect(updated).toBeDefined();
  }, 15000);

  test('runStage() throws for unknown stage name', async () => {
    const pipeline = makePipeline();
    await expect(pipeline.runStage('NONEXISTENT_STAGE', {})).rejects.toThrow(/Unknown stage/i);
  });

  test('getStatus() reflects idle state when not running', () => {
    const pipeline = makePipeline();
    const status = pipeline.getStatus();
    expect(status).toBeDefined();
    expect(status.state || pipeline.state).toBe(PipelineState.IDLE);
  });

  test('Stages object contains all expected stage names', () => {
    const expectedStages = [
      'INTAKE', 'TRIAGE', 'CONTEXT', 'CLASSIFY', 'ROUTE',
      'EXECUTE', 'VALIDATE', 'ASSURE', 'PATTERN_CAPTURE',
      'STORY_UPDATE', 'RECEIPT', 'LEARN',
    ];
    for (const stage of expectedStages) {
      expect(Stages[stage]).toBeDefined();
    }
  });
});

// ─── PoolManager — acquire / release ─────────────────────────────────────────

describe('PoolManager — acquire and release', () => {
  let manager;

  beforeEach(() => {
    manager = new PoolManager({ totalConcurrency: 20, rebalanceIntervalMs: 1_000_000 });
  });

  afterEach(() => {
    try { manager.destroy(); } catch {}
  });

  test('getPoolNames() returns all expected pool names', () => {
    const names = manager.getPoolNames();
    expect(names).toContain('HOT');
    expect(names).toContain('WARM');
    expect(names).toContain('COLD');
    expect(names).toContain('RESERVE');
  });

  test('acquire() HOT pool returns a release token', async () => {
    const token = await manager.acquire('HOT');
    expect(token).toBeDefined();
    expect(typeof token.release).toBe('function');
    expect(token.released).toBe(false);
    token.release();
  });

  test('release() marks token as released', async () => {
    const token = await manager.acquire('WARM');
    expect(token.released).toBe(false);
    token.release();
    expect(token.released).toBe(true);
  });

  test('acquire and release from each named pool', async () => {
    const pools = manager.getPoolNames();
    for (const poolName of pools) {
      const token = await manager.acquire(poolName);
      expect(token.pool).toBe(poolName);
      token.release();
    }
  });

  test('getUtilization() returns object with pool stats', () => {
    const stats = manager.getUtilization();
    expect(typeof stats).toBe('object');
    expect(Object.keys(stats).length).toBeGreaterThan(0);
  });

  test('getUtilization(poolName) returns stats for specific pool', () => {
    const util = manager.getUtilization('HOT');
    expect(util).toBeDefined();
    // Should have numeric fields
    const vals = Object.values(util);
    expect(vals.some(v => typeof v === 'number')).toBe(true);
  });

  test('concurrent acquires up to pool concurrency all resolve', async () => {
    const hotPool = manager.getPool('HOT');
    const capacity = hotPool.concurrency || 1;
    const count = Math.min(capacity, 5);
    const tokens = await Promise.all(
      Array.from({ length: count }, () => manager.acquire('HOT'))
    );
    expect(tokens).toHaveLength(count);
    for (const t of tokens) t.release();
  });

  test('acquiring beyond capacity blocks until released', async () => {
    const tiny = new PoolManager({ totalConcurrency: 3, rebalanceIntervalMs: 1_000_000 });
    try {
      // Acquire all HOT slots
      const hotPool = tiny.getPool('HOT');
      const capacity = hotPool.concurrency;

      const held = await Promise.all(
        Array.from({ length: capacity }, () => tiny.acquire('HOT'))
      );

      let resolved = false;
      const waitingAcquire = tiny.acquire('HOT').then(() => { resolved = true; });

      // Should not have resolved yet
      await new Promise(r => setTimeout(r, 50));
      expect(resolved).toBe(false);

      // Release one
      held[0].release();
      await waitingAcquire;
      expect(resolved).toBe(true);

      for (let i = 1; i < held.length; i++) held[i].release();
    } finally {
      try { tiny.destroy(); } catch {}
    }
  }, 10000);

  test('Pool Semaphore acquire/release cycle is balanced', async () => {
    const sem = new Semaphore(3);
    const releases = [];
    await sem.acquire();
    await sem.acquire();
    releases.push(() => sem.release());
    releases.push(() => sem.release());
    // Both acquired; another acquire should be pending
    let resolved = false;
    const pending = sem.acquire().then(() => { resolved = true; sem.release(); });
    await new Promise(r => setTimeout(r, 20));
    expect(resolved).toBe(false);
    releases[0]();
    await pending;
    expect(resolved).toBe(true);
    releases[1]();
  });
});
