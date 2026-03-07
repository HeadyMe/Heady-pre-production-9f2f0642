/**
 * @file index.js
 * @description Heady Orchestration Layer — Unified Exports.
 *
 * Combines all orchestration modules:
 * - HeadyConductor: Federated liquid routing hub
 * - SwarmIntelligence: Swarm coordination + Fibonacci allocation
 * - SwarmConsensus: Raft-like distributed consensus
 * - HeadyBuddy: Conversational assistant core
 * - SelfAwareness: System self-monitoring + HeadyAutobiographer
 * - CognitiveRuntimeGovernor: CPU/memory/GPU budget enforcement
 *
 * Sacred Geometry: PHI(φ=1.618) governs all allocation, timing, and thresholds.
 * Zero external dependencies — Node.js built-ins only.
 *
 * @module Orchestration
 * @example
 * import Orchestration, { HeadyConductor, SwarmIntelligence } from './orchestration/index.js';
 * const orch = Orchestration.createOrchestrationLayer({ nodeId: 'conductor' });
 * await orch.start();
 */

// ─── HeadyConductor ───────────────────────────────────────────────────────────

export {
  HeadyConductor,
  createTask,
  PoolZone,
  NodeRole,
  TaskPriority,
  getGlobalConductor,
  PhiPriorityQueue,
  RoutingTable,
  phiBackoff as conductorPhiBackoff,
} from './heady-conductor.js';

// ─── SwarmIntelligence ────────────────────────────────────────────────────────

export {
  SwarmIntelligence,
  SwarmMemory,
  EmergentBehaviorDetector,
  NodeAllocation,
  getGlobalSwarm,
  phiBackoff as swarmPhiBackoff,
} from './swarm-intelligence.js';

// ─── SwarmConsensus ───────────────────────────────────────────────────────────

export {
  SwarmConsensus,
  RaftLog,
  RaftState,
  createLocalCluster  as createConsensusCluster,
  startLocalCluster   as startConsensusCluster,
  shutdownLocalCluster as shutdownConsensusCluster,
  electionTimeout,
} from './swarm-consensus.js';

// ─── HeadyBuddy ───────────────────────────────────────────────────────────────

export {
  HeadyBuddy,
  BuddySession,
  ContextWindow,
  SessionStore,
  MessageRole,
  DEFAULT_PERSONA,
  createMessage,
  estimateTokens,
  getGlobalBuddy,
} from './buddy-core.js';

// ─── SelfAwareness ────────────────────────────────────────────────────────────

export {
  SelfAwareness,
  HeadyAutobiographer,
  CoherenceScorer,
  embedState,
  cosineSimilarity,
  getGlobalSelfAwareness,
  DRIFT_THRESHOLD,
  COHERENCE_DEGRADED,
  COHERENCE_CRITICAL,
} from './self-awareness.js';

// ─── CognitiveRuntimeGovernor ─────────────────────────────────────────────────

export {
  CognitiveRuntimeGovernor,
  DegradationMode,
  ResourceZone,
  PhiSlidingWindow,
  sampleResources,
  getZone,
  getGlobalGovernor,
} from './cognitive-runtime-governor.js';

// ─── Direct imports for factory function ─────────────────────────────────────

import { HeadyConductor, getGlobalConductor, NodeRole, TaskPriority } from './heady-conductor.js';
import { SwarmIntelligence, getGlobalSwarm } from './swarm-intelligence.js';
import { SwarmConsensus } from './swarm-consensus.js';
import { HeadyBuddy, getGlobalBuddy } from './buddy-core.js';
import { SelfAwareness, getGlobalSelfAwareness } from './self-awareness.js';
import { CognitiveRuntimeGovernor, getGlobalGovernor } from './cognitive-runtime-governor.js';

// ─── Sacred Geometry ──────────────────────────────────────────────────────────

export const PHI = 1.6180339887498948482;
export const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

// ─── Orchestration Layer Factory ──────────────────────────────────────────────

/**
 * @typedef {object} OrchestrationLayerOptions
 * @property {string} [nodeId='orchestration'] - cluster node identifier
 * @property {string} [nodeRole='conductor'] - NodeRole
 * @property {boolean} [autoStart=true] - auto-start all subsystems
 * @property {object} [conductorOptions] - options for HeadyConductor
 * @property {object} [swarmOptions] - options for SwarmIntelligence
 * @property {object} [consensusOptions] - options for SwarmConsensus (requires peers)
 * @property {string[]} [consensusPeers=['brain','sentinel']] - Raft peer node IDs
 * @property {object} [buddyOptions] - options for HeadyBuddy
 * @property {object} [selfAwarenessOptions] - options for SelfAwareness
 * @property {object} [governorOptions] - options for CognitiveRuntimeGovernor
 */

/**
 * @typedef {object} OrchestrationLayer
 * @property {HeadyConductor} conductor
 * @property {SwarmIntelligence} swarm
 * @property {SwarmConsensus} consensus
 * @property {HeadyBuddy} buddy
 * @property {SelfAwareness} selfAwareness
 * @property {CognitiveRuntimeGovernor} governor
 * @property {Function} start - start all subsystems
 * @property {Function} shutdown - gracefully stop all subsystems
 * @property {Function} status - get aggregate status
 */

/**
 * Create and wire a complete orchestration layer.
 *
 * All subsystems are configured with Sacred Geometry defaults and wired
 * together so that:
 * - The Governor throttles the Conductor's dispatch concurrency
 * - Self-awareness monitors the Conductor and Swarm state
 * - The Buddy has access to status tools for all subsystems
 *
 * @param {OrchestrationLayerOptions} [options]
 * @returns {OrchestrationLayer}
 */
export function createOrchestrationLayer(options = {}) {
  const nodeId   = options.nodeId   ?? 'orchestration';
  const nodeRole = options.nodeRole ?? 'conductor';

  // ── Instantiate subsystems ─────────────────────────────────────────────
  const conductor = new HeadyConductor({
    nodeId: `${nodeId}-conductor`,
    ...(options.conductorOptions ?? {}),
  });

  const swarm = new SwarmIntelligence({
    nodeId: `${nodeId}-swarm`,
    ...(options.swarmOptions ?? {}),
  });

  const consensusPeers = options.consensusPeers ?? ['brain', 'sentinel'];
  const consensus = new SwarmConsensus(
    nodeRole,
    consensusPeers,
    options.consensusOptions ?? {}
  );

  const buddy = new HeadyBuddy({
    ...(options.buddyOptions ?? {}),
  });

  const selfAwareness = new SelfAwareness({
    nodeId: `${nodeId}-self`,
    ...(options.selfAwarenessOptions ?? {}),
  });

  const governor = new CognitiveRuntimeGovernor({
    nodeId: `${nodeId}-governor`,
    ...(options.governorOptions ?? {}),
  });

  // ── Wire governor → conductor ─────────────────────────────────────────
  governor.on('degradation.changed', ({ to }) => {
    // Adjust conductor concurrency based on degradation mode
    const modeCapacity = {
      FULL:       FIBONACCI[7],   // 21
      SEQUENTIAL: 1,
      CACHED:     FIBONACCI[5],   // 8
      MINIMAL:    FIBONACCI[4],   // 5
      REJECT:     1,
    };
    conductor._concurrency = modeCapacity[to] ?? FIBONACCI[7];
  });

  // ── Wire self-awareness state provider ───────────────────────────────
  selfAwareness.setStateProvider(() => ({
    nodeId,
    nodeRole,
    conductor: {
      queueSize:    conductor.status.queueSize,
      activeDispatches: conductor.status.activeDispatches,
      nodeCount:    conductor._nodes.size,
    },
    swarm: {
      agentCount: swarm._agents.size,
      memoryVersion: swarm._memory.version,
    },
    consensus: {
      state: consensus._state,
      term:  consensus._currentTerm,
    },
    governor: {
      mode:       governor.mode,
      activeTasks:governor.status.activeTasks,
      cpu:        governor.status.cpu.smooth,
      mem:        governor.status.mem.smooth,
    },
    ts: Date.now(),
  }));

  // ── Register buddy tools ───────────────────────────────────────────────
  buddy.registerGlobalTool({
    name: 'conductor_status',
    description: 'Get the HeadyConductor routing hub status',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => conductor.status,
  });

  buddy.registerGlobalTool({
    name: 'swarm_status',
    description: 'Get SwarmIntelligence cluster status',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => swarm.status,
  });

  buddy.registerGlobalTool({
    name: 'consensus_status',
    description: 'Get SwarmConsensus Raft node status',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => consensus.status,
  });

  buddy.registerGlobalTool({
    name: 'governor_status',
    description: 'Get CognitiveRuntimeGovernor resource status',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => governor.status,
  });

  buddy.registerGlobalTool({
    name: 'self_awareness_status',
    description: 'Get SelfAwareness monitoring status and recent narrative',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({
      ...selfAwareness.status,
      narrative: selfAwareness.getNarrative(FIBONACCI[3]),
    }),
  });

  buddy.registerGlobalTool({
    name: 'compute_allocation',
    description: 'Compute Fibonacci-based resource allocation for N units',
    inputSchema: {
      type: 'object',
      properties: { totalUnits: { type: 'number', description: 'Total resource units' } },
      required: ['totalUnits'],
    },
    handler: async ({ totalUnits }) => swarm.computeSwarmAllocation(totalUnits),
  });

  // ── Aggregate start ────────────────────────────────────────────────────
  const start = async () => {
    governor.start();
    conductor.start();
    swarm.start();
    consensus.start();
    selfAwareness.start();
    // Buddy has no explicit start() — it's ready immediately
    return { nodeId, nodeRole, started: true, phi: PHI };
  };

  // ── Aggregate shutdown ─────────────────────────────────────────────────
  const shutdown = async () => {
    await selfAwareness.shutdown();
    await buddy.shutdown();
    await consensus.shutdown();
    await swarm.shutdown();
    await conductor.shutdown();
    await governor.shutdown();
    return { nodeId, stopped: true };
  };

  // ── Aggregate status ───────────────────────────────────────────────────
  const status = () => ({
    nodeId,
    nodeRole,
    conductor: conductor.status,
    swarm:     swarm.status,
    consensus: consensus.status,
    buddy:     buddy.status,
    selfAwareness: selfAwareness.status,
    governor:  governor.status,
    phi:       PHI,
  });

  if (options.autoStart !== false) {
    start().catch(() => {}); // non-blocking auto-start
  }

  return { conductor, swarm, consensus, buddy, selfAwareness, governor, start, shutdown, status };
}

// ─── Version ──────────────────────────────────────────────────────────────────

export const VERSION = '1.0.0';

export const ORCHESTRATION_INFO = Object.freeze({
  version: VERSION,
  modules: {
    'heady-conductor':             'Federated liquid routing hub with PHI-weighted priority queue',
    'swarm-intelligence':          'Swarm coordination with Fibonacci resource allocation',
    'swarm-consensus':             'Raft-like distributed consensus for 3-node cluster',
    'buddy-core':                  'Conversational assistant with tool calling and session management',
    'self-awareness':              'Continuous state embedding, drift detection, coherence scoring',
    'cognitive-runtime-governor':  'CPU/memory budget enforcement with graceful degradation',
  },
  sacredGeometry: {
    phi: PHI,
    hotPool:       '34% (FIBONACCI[8])',
    warmPool:      '21% (FIBONACCI[7])',
    coldPool:      '13% (FIBONACCI[6])',
    reservePool:   '8%  (FIBONACCI[5])',
    governancePool:'5%  (FIBONACCI[4])',
    driftThreshold: 0.75,
    coherenceDegraded: 1 / PHI,
    coherenceCritical: 1 / (PHI * PHI),
  },
});

// ─── Default Export ───────────────────────────────────────────────────────────

export default {
  // ── Factories ──────────────────────────────────────────────────────────
  createOrchestrationLayer,

  // ── Classes ────────────────────────────────────────────────────────────
  HeadyConductor,
  SwarmIntelligence,
  SwarmConsensus,
  HeadyBuddy,
  SelfAwareness,
  HeadyAutobiographer,
  CognitiveRuntimeGovernor,

  // ── Singletons ─────────────────────────────────────────────────────────
  getGlobalConductor,
  getGlobalSwarm,
  getGlobalBuddy,
  getGlobalSelfAwareness,
  getGlobalGovernor,

  // ── Sacred Geometry ────────────────────────────────────────────────────
  PHI,
  FIBONACCI,

  // ── Metadata ───────────────────────────────────────────────────────────
  VERSION,
  ORCHESTRATION_INFO,
};

// Bring in classes that weren't already exported above, for the default export
import { HeadyAutobiographer } from './self-awareness.js';
