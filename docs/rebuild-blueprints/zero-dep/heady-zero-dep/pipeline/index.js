/**
 * @file index.js
 * @description Heady Pipeline Layer — Unified Exports.
 *
 * Combines:
 * - HCFullPipeline: 12-stage cognitive pipeline (INTAKE→…→LEARN)
 * - PoolManager: Hot/Warm/Cold/Reserve/Governance resource pools
 *
 * Sacred Geometry: PHI ratios for all sizing and timing.
 * Zero external dependencies.
 *
 * @module Pipeline
 * @example
 * import Pipeline, { HCFullPipeline, PoolManager } from './pipeline/index.js';
 * const layer = Pipeline.createPipelineLayer({ capacity: 610 });
 * const run = await layer.pipeline.run({ query: 'compute phi allocation' });
 */

// ─── HCFullPipeline ───────────────────────────────────────────────────────────

export {
  HCFullPipeline,
  PipelineRegistry,
  PipelineStage,
  STAGE_ORDER,
  RunStatus,
  createRun,
  getGlobalPipeline,
  phiBackoff as pipelinePhiBackoff,
} from './pipeline-core.js';

// ─── Pipeline Pools ───────────────────────────────────────────────────────────

export {
  PoolManager,
  Pool,
  PoolType,
  POOL_ORDER,
  getGlobalPoolManager,
} from './pipeline-pools.js';

// ─── Direct imports for factory ───────────────────────────────────────────────

import { HCFullPipeline, PipelineRegistry, PipelineStage, STAGE_ORDER, RunStatus, getGlobalPipeline } from './pipeline-core.js';
import { PoolManager, PoolType, POOL_ORDER, getGlobalPoolManager } from './pipeline-pools.js';

// ─── Sacred Geometry ──────────────────────────────────────────────────────────

export const PHI = 1.6180339887498948482;
export const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

// ─── Pipeline Layer Factory ───────────────────────────────────────────────────

/**
 * @typedef {object} PipelineLayerOptions
 * @property {string} [id='main'] - pipeline identifier
 * @property {number} [capacity=FIBONACCI[14]] - total capacity units (610)
 * @property {boolean} [autoStart=true] - auto-start pool manager
 * @property {object} [pipelineOptions] - passed to HCFullPipeline
 * @property {object} [poolOptions] - passed to PoolManager
 * @property {boolean} [wired=true] - wire pipeline → pools integration
 */

/**
 * @typedef {object} PipelineLayer
 * @property {HCFullPipeline} pipeline
 * @property {PoolManager} pools
 * @property {PipelineRegistry} registry
 * @property {Function} start - start all subsystems
 * @property {Function} shutdown - stop all subsystems
 * @property {Function} status - aggregate status
 */

/**
 * Create a wired pipeline + pool management layer.
 *
 * Integration:
 * - EXECUTE stage automatically acquires a HOT slot from the pool manager
 * - On stage completion, slot is released back to the pool
 * - Pool spill events trigger conductor slow-down hints
 *
 * @param {PipelineLayerOptions} [options]
 * @returns {PipelineLayer}
 */
export function createPipelineLayer(options = {}) {
  const id = options.id ?? 'main';

  const pipeline = new HCFullPipeline({
    id,
    ...(options.pipelineOptions ?? {}),
  });

  const pools = new PoolManager({
    totalCapacity: options.capacity ?? FIBONACCI[14],
    ...(options.poolOptions ?? {}),
  });

  const registry = new PipelineRegistry();
  registry.register(id, pipeline);

  // ── Wire pipeline events to pool management ──────────────────────────
  if (options.wired !== false) {
    // When EXECUTE stage starts, acquire a pool slot
    pipeline.on('stage.started', ({ stage, runId }) => {
      const run = pipeline.getRun(runId);
      if (!run) return;

      // Determine target pool based on task priority hint in run.state
      const poolHint = run.state.poolHint ?? 'WARM';
      if (stage === 'EXECUTE' || stage === 'MONTE_CARLO' || stage === 'ARENA') {
        const permit = pools.acquire(runId, poolHint);
        if (permit) {
          // Store release function in run state for cleanup
          run.state[`_pool_release_${stage}`] = permit.release;
          run.state[`_pool_slot_${stage}`]    = permit.pool;
        }
      }
    });

    // Release pool slots on stage completion or failure
    const releaseStageSlot = (stage, runId) => {
      const run = pipeline.getRun(runId);
      if (!run) return;
      const releaser = run.state[`_pool_release_${stage}`];
      if (releaser) {
        releaser();
        delete run.state[`_pool_release_${stage}`];
        delete run.state[`_pool_slot_${stage}`];
      }
    };

    pipeline.on('stage.completed', ({ stage, runId }) => releaseStageSlot(stage, runId));
    pipeline.on('stage.failed',    ({ stage, runId }) => releaseStageSlot(stage, runId));

    // On pool exhaustion, pause the pipeline run
    pools.on('pool.exhausted', ({ occupantId }) => {
      pipeline.pause(occupantId);
      // Resume after PHI-scaled delay (give pools time to free up)
      setTimeout(() => pipeline.resume(occupantId), Math.floor(PHI * PHI * 1000)); // ~2.6s
    });
  }

  // ── Aggregate start ────────────────────────────────────────────────────
  const start = async () => {
    pools.start();
    return { id, started: true, phi: PHI };
  };

  // ── Aggregate shutdown ─────────────────────────────────────────────────
  const shutdown = async () => {
    await pools.shutdown();
    return { id, stopped: true };
  };

  // ── Aggregate status ───────────────────────────────────────────────────
  const status = () => ({
    pipeline: pipeline.status,
    pools:    pools.status,
    registry: registry.list(),
    phi:      PHI,
  });

  if (options.autoStart !== false) {
    start().catch(() => {}); // non-blocking
  }

  return { pipeline, pools, registry, start, shutdown, status };
}

// ─── Version ──────────────────────────────────────────────────────────────────

export const VERSION = '1.0.0';

export const PIPELINE_INFO = Object.freeze({
  version: VERSION,
  stages:  STAGE_ORDER,
  stageCount: STAGE_ORDER.length,
  pools:   POOL_ORDER,
  sacredGeometry: {
    phi:            PHI,
    hotPool:        '34% (FIBONACCI[8]=34)',
    warmPool:       '21% (FIBONACCI[7]=21)',
    coldPool:       '13% (FIBONACCI[6]=13)',
    reservePool:    '8%  (FIBONACCI[5]=8)',
    governancePool: '5%  (FIBONACCI[4]=5)',
    totalCapacity:  FIBONACCI[14],
  },
});

// ─── Default Export ───────────────────────────────────────────────────────────

export default {
  createPipelineLayer,

  // ── Classes ────────────────────────────────────────────────────────────
  HCFullPipeline,
  PoolManager,
  PipelineRegistry,

  // ── Singletons ─────────────────────────────────────────────────────────
  getGlobalPipeline,
  getGlobalPoolManager,

  // ── Enums ──────────────────────────────────────────────────────────────
  PipelineStage,
  STAGE_ORDER,
  RunStatus,
  PoolType,
  POOL_ORDER,

  // ── Sacred Geometry ────────────────────────────────────────────────────
  PHI,
  FIBONACCI,

  // ── Metadata ───────────────────────────────────────────────────────────
  VERSION,
  PIPELINE_INFO,
};
