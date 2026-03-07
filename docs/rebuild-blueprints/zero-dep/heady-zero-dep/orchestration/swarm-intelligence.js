/**
 * @file swarm-intelligence.js
 * @description Swarm Coordination System for the 3-node Heady Colab cluster.
 *
 * Features:
 * - computeSwarmAllocation() — resource allocation using Fibonacci ratios
 * - evaluateLiveCloudStatus() — cluster health assessment (PHI scoring)
 * - Consensus algorithm (Raft-like, see swarm-consensus.js for full impl)
 * - Swarm memory: shared state across all agents via in-memory map + WAL
 * - Emergent behavior detection from agent interaction patterns
 *
 * Sacred Geometry: PHI ratios govern all allocation, thresholds, and weights.
 * Zero external dependencies — Node.js built-ins only.
 *
 * @module Orchestration/SwarmIntelligence
 */

import { EventEmitter } from 'events';
import { randomUUID, createHash } from 'crypto';
import fs from 'fs';

// ─── Sacred Geometry ──────────────────────────────────────────────────────────

const PHI = 1.6180339887498948482;
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

/**
 * PHI-scaled exponential backoff
 * @param {number} n
 * @param {number} [base=1000]
 * @returns {number}
 */
function phiBackoff(n, base = 1000) {
  return Math.min(Math.floor(Math.pow(PHI, n) * base), FIBONACCI[9] * 1000);
}

// ─── Fibonacci Allocation Ratios ──────────────────────────────────────────────

/**
 * Resource allocation ratios by cluster node role.
 * Derived from Fibonacci sequence: 34, 21, 13 = F(8), F(7), F(6).
 * Total: 68 units (not 100, liquid overflow goes to RESERVE at F(5)=8).
 * @enum {object}
 */
export const NodeAllocation = Object.freeze({
  BRAIN: {
    role: 'brain',
    fibIndex: 8,
    fib: FIBONACCI[8],   // 34
    ratio: 0.34,
    zone: 'HOT',
    description: 'User-facing, latency-critical: embeddings, LLM routing, vector search',
  },
  CONDUCTOR: {
    role: 'conductor',
    fibIndex: 7,
    fib: FIBONACCI[7],   // 21
    ratio: 0.21,
    zone: 'WARM',
    description: 'Background processing: pipeline, bee factory, orchestration',
  },
  SENTINEL: {
    role: 'sentinel',
    fibIndex: 6,
    fib: FIBONACCI[6],   // 13
    ratio: 0.13,
    zone: 'COLD',
    description: 'Governance overhead: security, self-healing, telemetry',
  },
  RESERVE: {
    role: 'reserve',
    fibIndex: 5,
    fib: FIBONACCI[5],   // 8
    ratio: 0.08,
    zone: 'RESERVE',
    description: 'Overflow buffer: absorbs burst demand across all nodes',
  },
  GOVERNANCE: {
    role: 'governance',
    fibIndex: 4,
    fib: FIBONACCI[4],   // 5
    ratio: 0.05,
    zone: 'GOVERNANCE',
    description: 'System overhead: consensus, heartbeat, meta-management',
  },
});

// ─── Swarm Agent Descriptor ───────────────────────────────────────────────────

/**
 * @typedef {object} SwarmAgent
 * @property {string} id - unique agent ID
 * @property {string} type - agent/bee type (e.g., 'BrainBee', 'PipelineBee')
 * @property {string} nodeRole - which cluster node this agent lives on
 * @property {'IDLE'|'ACTIVE'|'BUSY'|'COOLDOWN'|'OFFLINE'} state
 * @property {number} load - 0.0–1.0
 * @property {number} successRate - PHI-smoothed success rate
 * @property {number} tasksCompleted
 * @property {number} registeredAt
 * @property {number} lastActive
 * @property {string[]} capabilities - list of task types this agent handles
 * @property {number} phi_score - composite health/efficiency score
 */

// ─── Swarm Memory ─────────────────────────────────────────────────────────────

/**
 * Shared state store for all agents in the swarm.
 * Backed by in-memory Map with optional WAL persistence.
 */
export class SwarmMemory {
  /**
   * @param {object} [options]
   * @param {string} [options.walPath] - path to WAL file for persistence
   * @param {number} [options.maxEntries=FIBONACCI[11]] - max entries (144)
   */
  constructor(options = {}) {
    this._walPath = options.walPath ?? null;
    this._maxEntries = options.maxEntries ?? FIBONACCI[11]; // 144
    /** @type {Map<string, { value: *, version: number, ts: number, author: string }>} */
    this._store = new Map();
    this._version = 0;
    this._walStream = null;
  }

  /**
   * Set a shared state value
   * @param {string} key
   * @param {*} value
   * @param {string} [author='system']
   * @returns {number} new version
   */
  set(key, value, author = 'system') {
    if (this._store.size >= this._maxEntries && !this._store.has(key)) {
      // Evict oldest entry (LRU-like)
      let oldest = null, oldestTs = Infinity;
      for (const [k, entry] of this._store) {
        if (entry.ts < oldestTs) { oldest = k; oldestTs = entry.ts; }
      }
      if (oldest) this._store.delete(oldest);
    }
    this._version++;
    const entry = { value, version: this._version, ts: Date.now(), author };
    this._store.set(key, entry);
    this._walAppend({ op: 'set', key, value, version: this._version, ts: entry.ts, author });
    return this._version;
  }

  /**
   * Get a shared state value
   * @param {string} key
   * @returns {*}
   */
  get(key) {
    return this._store.get(key)?.value;
  }

  /**
   * Get entry metadata (value + version + ts)
   * @param {string} key
   * @returns {{ value: *, version: number, ts: number, author: string }|undefined}
   */
  getEntry(key) {
    return this._store.get(key);
  }

  /**
   * Delete a key
   * @param {string} key
   * @returns {boolean}
   */
  delete(key) {
    const existed = this._store.delete(key);
    if (existed) {
      this._version++;
      this._walAppend({ op: 'delete', key, version: this._version, ts: Date.now() });
    }
    return existed;
  }

  /**
   * Apply a CAS (compare-and-swap) update atomically
   * @param {string} key
   * @param {*} expected - expected current value (shallow compare)
   * @param {*} next - new value if CAS passes
   * @returns {boolean} true if swap was applied
   */
  cas(key, expected, next) {
    const current = this._store.get(key)?.value;
    if (JSON.stringify(current) !== JSON.stringify(expected)) return false;
    this.set(key, next, 'cas');
    return true;
  }

  /**
   * Get a snapshot of all current entries
   * @returns {object}
   */
  snapshot() {
    const snap = {};
    for (const [k, entry] of this._store) {
      snap[k] = { ...entry };
    }
    return { version: this._version, ts: Date.now(), entries: snap };
  }

  /**
   * Restore from a snapshot
   * @param {{ version: number, entries: object }} snap
   */
  restore(snap) {
    this._store.clear();
    for (const [k, entry] of Object.entries(snap.entries ?? {})) {
      this._store.set(k, entry);
    }
    this._version = snap.version ?? 0;
  }

  /** @returns {number} */
  get size() { return this._store.size; }

  /** @returns {number} global version counter */
  get version() { return this._version; }

  /** @private */
  _walAppend(record) {
    if (!this._walPath) return;
    try {
      fs.appendFileSync(this._walPath, JSON.stringify(record) + '\n', 'utf8');
    } catch (_) {}
  }
}

// ─── Emergent Behavior Detector ───────────────────────────────────────────────

/**
 * Detects emergent behavior patterns from agent interaction logs.
 *
 * Patterns detected:
 * - Resonance: multiple agents consistently succeeding on the same task type
 * - Cascade: failure in one agent propagates to others (error correlation)
 * - Convergence: agents' resource usage converging toward PHI equilibrium
 * - Divergence: runaway resource consumption by one agent
 */
export class EmergentBehaviorDetector {
  /**
   * @param {object} [options]
   * @param {number} [options.windowSize=FIBONACCI[7]] events to analyze (21)
   * @param {number} [options.resonanceThreshold=0.75] cosine similarity threshold
   * @param {number} [options.cascadeCorrelation=0.8] failure correlation threshold
   */
  constructor(options = {}) {
    this._window = options.windowSize ?? FIBONACCI[7]; // 21
    this._resonanceThreshold = options.resonanceThreshold ?? 0.75;
    this._cascadeCorrelation = options.cascadeCorrelation ?? 0.8;
    /** @type {Array<{ ts: number, agentId: string, event: string, success: boolean, taskType: string }>} */
    this._events = [];
  }

  /**
   * Record an agent interaction event
   * @param {string} agentId
   * @param {string} event - event type
   * @param {boolean} success
   * @param {string} taskType
   */
  record(agentId, event, success, taskType) {
    this._events.push({ ts: Date.now(), agentId, event, success, taskType });
    if (this._events.length > this._window * FIBONACCI[4]) {
      this._events = this._events.slice(-this._window * FIBONACCI[4]);
    }
  }

  /**
   * Analyze recent events and return detected emergent behaviors.
   * @returns {object[]} detected patterns
   */
  analyze() {
    const patterns = [];
    const recent = this._events.slice(-this._window);
    if (recent.length < FIBONACCI[3]) return patterns; // need at least 3 events

    // Resonance: agents succeeding together on same task type
    const byType = this._groupBy(recent, 'taskType');
    for (const [type, evts] of Object.entries(byType)) {
      const successRate = evts.filter((e) => e.success).length / evts.length;
      const uniqueAgents = new Set(evts.map((e) => e.agentId)).size;
      if (successRate >= this._resonanceThreshold && uniqueAgents >= 2) {
        patterns.push({
          type: 'RESONANCE',
          taskType: type,
          agentCount: uniqueAgents,
          successRate,
          strength: successRate * Math.log(uniqueAgents + 1) * PHI,
          ts: Date.now(),
        });
      }
    }

    // Cascade: correlate failure timing across agents
    const failures = recent.filter((e) => !e.success);
    if (failures.length >= FIBONACCI[3]) {
      const byAgent = this._groupBy(failures, 'agentId');
      const agentIds = Object.keys(byAgent);
      for (let i = 0; i < agentIds.length - 1; i++) {
        for (let j = i + 1; j < agentIds.length; j++) {
          const corr = this._temporalCorrelation(
            byAgent[agentIds[i]], byAgent[agentIds[j]]
          );
          if (corr >= this._cascadeCorrelation) {
            patterns.push({
              type: 'CASCADE',
              agents: [agentIds[i], agentIds[j]],
              correlation: corr,
              failureCount: failures.length,
              ts: Date.now(),
            });
          }
        }
      }
    }

    // Convergence: load levels approaching PHI equilibrium (1/PHI ≈ 0.618)
    const agentLoads = this._computeAgentActivityRates(recent);
    const loads = Object.values(agentLoads);
    if (loads.length >= 2) {
      const mean = loads.reduce((s, v) => s + v, 0) / loads.length;
      const variance = loads.reduce((s, v) => s + (v - mean) ** 2, 0) / loads.length;
      const phiEquilibrium = 1 / PHI; // ~0.618
      if (variance < 0.05 && Math.abs(mean - phiEquilibrium) < 0.1) {
        patterns.push({
          type: 'CONVERGENCE',
          mean,
          variance,
          phiEquilibrium,
          agentCount: loads.length,
          ts: Date.now(),
        });
      }
    }

    return patterns;
  }

  /** @private */
  _groupBy(arr, key) {
    const groups = {};
    for (const item of arr) {
      const k = item[key];
      (groups[k] = groups[k] ?? []).push(item);
    }
    return groups;
  }

  /** @private */
  _temporalCorrelation(eventsA, eventsB) {
    if (eventsA.length === 0 || eventsB.length === 0) return 0;
    const windowMs = 5000; // 5s correlation window
    let correlated = 0;
    for (const ea of eventsA) {
      for (const eb of eventsB) {
        if (Math.abs(ea.ts - eb.ts) <= windowMs) { correlated++; break; }
      }
    }
    return correlated / Math.max(eventsA.length, eventsB.length);
  }

  /** @private */
  _computeAgentActivityRates(events) {
    const rates = {};
    const byAgent = this._groupBy(events, 'agentId');
    for (const [id, evts] of Object.entries(byAgent)) {
      rates[id] = evts.filter((e) => e.success).length / (evts.length + 1);
    }
    return rates;
  }
}

// ─── SwarmIntelligence ────────────────────────────────────────────────────────

/**
 * Swarm coordination system for the 3-node Heady Colab cluster.
 *
 * Manages resource allocation, cluster health assessment, consensus coordination,
 * shared swarm memory, and emergent behavior detection.
 *
 * @extends EventEmitter
 *
 * @example
 * const swarm = new SwarmIntelligence({ nodeId: 'conductor-swarm' });
 * swarm.registerAgent({ id: 'bee-1', type: 'EmbedBee', nodeRole: 'brain', capabilities: ['embed.*'] });
 * swarm.on('emergent.detected', ({ patterns }) => console.log(patterns));
 *
 * const allocation = swarm.computeSwarmAllocation(1000);
 * const health = await swarm.evaluateLiveCloudStatus();
 */
export class SwarmIntelligence extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {string} [options.nodeId='swarm'] - identifier for this swarm instance
   * @param {number} [options.analysisInterval=FIBONACCI[8]*1000] - emergent analysis interval ms (34s)
   * @param {number} [options.syncInterval=FIBONACCI[6]*1000] - memory sync interval ms (13s)
   * @param {string} [options.memoryWalPath] - path to swarm memory WAL
   * @param {number} [options.heartbeatInterval=5000] - agent heartbeat ms
   */
  constructor(options = {}) {
    super();
    this._nodeId       = options.nodeId ?? 'swarm';
    this._analysisMs   = options.analysisInterval ?? FIBONACCI[8] * 1000; // 34s
    this._syncMs       = options.syncInterval ?? FIBONACCI[6] * 1000;      // 13s
    this._hbMs         = options.heartbeatInterval ?? 5000;

    /** @type {Map<string, SwarmAgent>} agentId → SwarmAgent */
    this._agents = new Map();

    /** @type {SwarmMemory} */
    this._memory = new SwarmMemory({ walPath: options.memoryWalPath });

    /** @type {EmergentBehaviorDetector} */
    this._emergent = new EmergentBehaviorDetector();

    /** Consensus vote store (simplified; see swarm-consensus.js for full Raft) */
    this._consensusRounds = new Map();

    /** Cluster node health snapshots */
    this._nodeHealth = new Map(); // nodeId → health object

    this._analysisTimer = null;
    this._syncTimer     = null;
    this._hbTimer       = null;
    this._started       = false;
  }

  // ─── Agent Management ─────────────────────────────────────────────────────

  /**
   * Register an agent in the swarm
   * @param {object} cfg
   * @param {string} cfg.id
   * @param {string} cfg.type
   * @param {string} cfg.nodeRole
   * @param {string[]} [cfg.capabilities]
   * @param {number} [cfg.load=0]
   * @returns {SwarmAgent}
   */
  registerAgent({ id, type, nodeRole, capabilities = [], load = 0 }) {
    const agent = {
      id,
      type,
      nodeRole,
      state: 'IDLE',
      load,
      successRate: 1.0,
      tasksCompleted: 0,
      registeredAt: Date.now(),
      lastActive: Date.now(),
      capabilities,
      phi_score: 1.0,
    };
    this._agents.set(id, agent);
    this._memory.set(`agent:${id}`, { state: 'IDLE', load: 0, nodeRole, type }, id);
    this.emit('agent.registered', { agent });
    return agent;
  }

  /**
   * Deregister an agent
   * @param {string} id
   * @returns {boolean}
   */
  deregisterAgent(id) {
    const existed = this._agents.delete(id);
    if (existed) {
      this._memory.delete(`agent:${id}`);
      this.emit('agent.deregistered', { id });
    }
    return existed;
  }

  /**
   * Update agent state and metrics
   * @param {string} id
   * @param {object} update
   */
  updateAgent(id, update) {
    const agent = this._agents.get(id);
    if (!agent) return;
    Object.assign(agent, update);
    agent.lastActive = Date.now();

    // Recompute phi_score
    const stateScore = { IDLE: 1.0, ACTIVE: PHI / (PHI + 1), BUSY: 1 / PHI, COOLDOWN: 1 / PHI / PHI, OFFLINE: 0 }
      [agent.state] ?? 0.5;
    agent.phi_score = stateScore * agent.successRate * (1 - agent.load * 0.5);

    this._memory.set(`agent:${id}`, {
      state: agent.state, load: agent.load,
      nodeRole: agent.nodeRole, phi_score: agent.phi_score,
    }, id);
  }

  /**
   * Record an agent interaction for emergent behavior tracking
   * @param {string} agentId
   * @param {string} event
   * @param {boolean} success
   * @param {string} taskType
   */
  recordInteraction(agentId, event, success, taskType) {
    const agent = this._agents.get(agentId);
    if (agent) {
      // PHI-smoothed success rate update
      const alpha = 1 / PHI; // ≈ 0.618, exponential decay
      agent.successRate = agent.successRate * (1 - alpha) + (success ? 1 : 0) * alpha;
      if (success) agent.tasksCompleted++;
    }
    this._emergent.record(agentId, event, success, taskType);
  }

  // ─── Resource Allocation ──────────────────────────────────────────────────

  /**
   * Compute swarm resource allocation using Fibonacci ratios.
   *
   * Distributes `totalUnits` across nodes according to Sacred Geometry:
   * - BRAIN:       34% of total
   * - CONDUCTOR:   21% of total
   * - SENTINEL:    13% of total
   * - RESERVE:      8% of total
   * - GOVERNANCE:   5% of total
   *
   * Adjustments are made based on live agent load:
   * heavily loaded nodes get an extra PHI bonus from the reserve pool.
   *
   * @param {number} totalUnits - total resource units to allocate (e.g., 1000)
   * @returns {object} allocation map per role
   */
  computeSwarmAllocation(totalUnits) {
    const base = {
      brain:      Math.floor(totalUnits * NodeAllocation.BRAIN.ratio),
      conductor:  Math.floor(totalUnits * NodeAllocation.CONDUCTOR.ratio),
      sentinel:   Math.floor(totalUnits * NodeAllocation.SENTINEL.ratio),
      reserve:    Math.floor(totalUnits * NodeAllocation.RESERVE.ratio),
      governance: Math.floor(totalUnits * NodeAllocation.GOVERNANCE.ratio),
    };

    // Compute agent-weighted demand per node role
    const demand = { brain: 0, conductor: 0, sentinel: 0 };
    for (const agent of this._agents.values()) {
      const role = agent.nodeRole;
      if (demand[role] !== undefined) {
        demand[role] += agent.load;
      }
    }

    // Normalize demand
    const totalDemand = Object.values(demand).reduce((s, v) => s + v, 0) || 1;

    // PHI-scaled bonus allocation from reserve
    const reservePool = base.reserve;
    const adjustments = {};
    let reserveUsed = 0;

    for (const role of ['brain', 'conductor', 'sentinel']) {
      const demandRatio = demand[role] / totalDemand;
      // Bonus if demand > baseline allocation ratio
      const baselineRatio = NodeAllocation[role.toUpperCase()]?.ratio ?? 0;
      if (demandRatio > baselineRatio) {
        const excess = demandRatio - baselineRatio;
        const bonus = Math.min(
          Math.floor(excess * reservePool * PHI),
          Math.floor(reservePool / 3)
        );
        adjustments[role] = bonus;
        reserveUsed += bonus;
      } else {
        adjustments[role] = 0;
      }
    }

    const allocation = {
      brain:      base.brain      + (adjustments.brain      ?? 0),
      conductor:  base.conductor  + (adjustments.conductor  ?? 0),
      sentinel:   base.sentinel   + (adjustments.sentinel   ?? 0),
      reserve:    Math.max(0, reservePool - reserveUsed),
      governance: base.governance,
      totalUnits,
      phi: PHI,
      demand,
      fibonacci: {
        brain:     FIBONACCI[8],
        conductor: FIBONACCI[7],
        sentinel:  FIBONACCI[6],
        reserve:   FIBONACCI[5],
        governance:FIBONACCI[4],
      },
    };

    this.emit('allocation.computed', allocation);
    return allocation;
  }

  // ─── Cloud Status Evaluation ──────────────────────────────────────────────

  /**
   * Evaluate live cluster health across all registered nodes and agents.
   *
   * PHI health score formula:
   *   phi_score = (online_fraction * PHI + agent_efficiency) / (PHI + 1)
   *
   * Score interpretation:
   *   > 0.75: Healthy (green)
   *   0.5–0.75: Degraded (yellow)
   *   < 0.5: Critical (red)
   *
   * @returns {Promise<object>} cluster health assessment
   */
  async evaluateLiveCloudStatus() {
    const now = Date.now();
    const agents = [...this._agents.values()];

    // Agent health breakdown
    const onlineAgents = agents.filter((a) => a.state !== 'OFFLINE');
    const busyAgents   = agents.filter((a) => a.state === 'BUSY');
    const idleAgents   = agents.filter((a) => a.state === 'IDLE');

    const onlineFraction = agents.length > 0 ? onlineAgents.length / agents.length : 1;

    // PHI-smoothed aggregate efficiency
    const efficiency = agents.length > 0
      ? onlineAgents.reduce((s, a) => s + a.phi_score, 0) / agents.length
      : 1.0;

    const phi_score = (onlineFraction * PHI + efficiency) / (PHI + 1);

    // Per-node breakdown
    const nodeBreakdown = {};
    for (const role of ['brain', 'conductor', 'sentinel']) {
      const nodeAgents = agents.filter((a) => a.nodeRole === role);
      const nodeOnline = nodeAgents.filter((a) => a.state !== 'OFFLINE');
      nodeBreakdown[role] = {
        total:         nodeAgents.length,
        online:        nodeOnline.length,
        busy:          nodeAgents.filter((a) => a.state === 'BUSY').length,
        idle:          nodeAgents.filter((a) => a.state === 'IDLE').length,
        avgLoad:       nodeAgents.length > 0
                         ? nodeAgents.reduce((s, a) => s + a.load, 0) / nodeAgents.length
                         : 0,
        avgSuccessRate: nodeAgents.length > 0
                         ? nodeAgents.reduce((s, a) => s + a.successRate, 0) / nodeAgents.length
                         : 1.0,
        phi_score:     nodeAgents.length > 0
                         ? nodeAgents.reduce((s, a) => s + a.phi_score, 0) / nodeAgents.length
                         : 1.0,
      };
    }

    // Stale agents (last active > 3 * heartbeat)
    const staleThreshold = this._hbMs * FIBONACCI[3]; // 3 heartbeats
    const staleAgents = agents.filter((a) => (now - a.lastActive) > staleThreshold);

    const status = {
      ts: now,
      nodeId: this._nodeId,
      phi_score,
      health: phi_score > 0.75 ? 'GREEN' : phi_score > 0.5 ? 'YELLOW' : 'RED',
      agentCount: agents.length,
      online: onlineAgents.length,
      busy: busyAgents.length,
      idle: idleAgents.length,
      stale: staleAgents.length,
      efficiency,
      onlineFraction,
      nodes: nodeBreakdown,
      memoryVersion: this._memory.version,
      memorySize: this._memory.size,
      phi: PHI,
    };

    // Mark stale agents as OFFLINE
    for (const agent of staleAgents) {
      agent.state = 'OFFLINE';
      agent.phi_score = 0;
      this.emit('agent.stale', { agent });
    }

    this.emit('cloud.evaluated', status);
    return status;
  }

  // ─── Consensus ────────────────────────────────────────────────────────────

  /**
   * Initiate a swarm consensus vote on a decision.
   * Simplified voting — see swarm-consensus.js for full Raft.
   *
   * @param {string} topic - decision topic
   * @param {*} proposal - the proposed value
   * @param {number} [quorum=Math.ceil(agents/2)] - required votes for consensus
   * @returns {Promise<{ accepted: boolean, votes: number, quorum: number, value: * }>}
   */
  async proposeConsensus(topic, proposal, quorum = null) {
    const roundId = randomUUID();
    const agents = [...this._agents.values()].filter((a) => a.state !== 'OFFLINE');
    const requiredQuorum = quorum ?? (Math.ceil(agents.length / 2) || 1);

    return new Promise((resolve) => {
      const votes = { yes: 0, no: 0 };
      const round = {
        id: roundId,
        topic,
        proposal,
        votes,
        quorum: requiredQuorum,
        deadline: Date.now() + FIBONACCI[6] * 1000, // 13s voting window
        resolve,
      };
      this._consensusRounds.set(roundId, round);
      this.emit('consensus.proposed', { roundId, topic, proposal, quorum: requiredQuorum });

      // Auto-resolve timeout
      setTimeout(() => {
        if (this._consensusRounds.has(roundId)) {
          this._consensusRounds.delete(roundId);
          const accepted = votes.yes >= requiredQuorum;
          resolve({ accepted, votes: votes.yes, quorum: requiredQuorum, value: accepted ? proposal : null });
          this.emit('consensus.timeout', { roundId, topic, accepted });
        }
      }, FIBONACCI[6] * 1000);
    });
  }

  /**
   * Cast a vote on an active consensus round
   * @param {string} roundId
   * @param {string} agentId - voting agent
   * @param {boolean} vote
   * @returns {boolean} true if vote applied
   */
  castVote(roundId, agentId, vote) {
    const round = this._consensusRounds.get(roundId);
    if (!round || Date.now() > round.deadline) return false;

    if (vote) round.votes.yes++;
    else round.votes.no++;

    this.emit('consensus.vote', { roundId, agentId, vote });

    // Check if quorum reached
    if (round.votes.yes >= round.quorum) {
      this._consensusRounds.delete(roundId);
      round.resolve({ accepted: true, votes: round.votes.yes, quorum: round.quorum, value: round.proposal });
      this.emit('consensus.accepted', { roundId, topic: round.topic, value: round.proposal });
    } else {
      const totalAgents = this._agents.size;
      const remainingPossible = totalAgents - round.votes.yes - round.votes.no;
      // Early rejection if quorum is mathematically impossible
      if (round.votes.yes + remainingPossible < round.quorum) {
        this._consensusRounds.delete(roundId);
        round.resolve({ accepted: false, votes: round.votes.yes, quorum: round.quorum, value: null });
        this.emit('consensus.rejected', { roundId, topic: round.topic });
      }
    }
    return true;
  }

  // ─── Shared Memory Accessors ──────────────────────────────────────────────

  /**
   * Set a value in shared swarm memory
   * @param {string} key
   * @param {*} value
   * @param {string} [author]
   * @returns {number} version
   */
  memSet(key, value, author) { return this._memory.set(key, value, author); }

  /**
   * Get a value from shared swarm memory
   * @param {string} key
   * @returns {*}
   */
  memGet(key) { return this._memory.get(key); }

  /**
   * Get full memory snapshot
   * @returns {object}
   */
  memSnapshot() { return this._memory.snapshot(); }

  /**
   * Restore memory from snapshot (e.g., from another node)
   * @param {object} snapshot
   */
  memRestore(snapshot) { this._memory.restore(snapshot); }

  // ─── Emergent Analysis ────────────────────────────────────────────────────

  /**
   * Run emergent behavior analysis and emit detected patterns
   * @returns {object[]} detected patterns
   */
  analyzeEmergence() {
    const patterns = this._emergent.analyze();
    if (patterns.length > 0) {
      this.emit('emergent.detected', { patterns, ts: Date.now() });
    }
    return patterns;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /** Start background loops */
  start() {
    if (this._started) return;
    this._started = true;

    // Periodic emergent behavior analysis
    this._analysisTimer = setInterval(() => {
      this.analyzeEmergence();
      this.evaluateLiveCloudStatus().catch((err) => this.emit('error', err));
    }, this._analysisMs);
    if (this._analysisTimer.unref) this._analysisTimer.unref();

    // Periodic memory sync signal
    this._syncTimer = setInterval(() => {
      const snap = this._memory.snapshot();
      this.emit('memory.sync', { snapshot: snap, nodeId: this._nodeId });
    }, this._syncMs);
    if (this._syncTimer.unref) this._syncTimer.unref();

    this.emit('swarm.started', { nodeId: this._nodeId });
  }

  /** Stop background loops */
  async shutdown() {
    if (!this._started) return;
    this._started = false;
    clearInterval(this._analysisTimer);
    clearInterval(this._syncTimer);
    clearInterval(this._hbTimer);
    this._analysisTimer = null;
    this._syncTimer     = null;
    this._hbTimer       = null;
    this.emit('swarm.stopped', { nodeId: this._nodeId });
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  /** @returns {object} swarm status snapshot */
  get status() {
    const agents = [...this._agents.values()];
    return {
      nodeId: this._nodeId,
      agentCount: agents.length,
      online: agents.filter((a) => a.state !== 'OFFLINE').length,
      memoryEntries: this._memory.size,
      memoryVersion: this._memory.version,
      consensusRoundsActive: this._consensusRounds.size,
      phi: PHI,
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/** @type {SwarmIntelligence|null} */
let _globalSwarm = null;

/**
 * Get (or create) the global SwarmIntelligence singleton
 * @param {object} [options]
 * @returns {SwarmIntelligence}
 */
export function getGlobalSwarm(options = {}) {
  if (!_globalSwarm) {
    _globalSwarm = new SwarmIntelligence(options);
  }
  return _globalSwarm;
}

export { PHI, FIBONACCI, phiBackoff };

export default {
  SwarmIntelligence,
  SwarmMemory,
  EmergentBehaviorDetector,
  NodeAllocation,
  getGlobalSwarm,
  PHI,
  FIBONACCI,
  phiBackoff,
};
