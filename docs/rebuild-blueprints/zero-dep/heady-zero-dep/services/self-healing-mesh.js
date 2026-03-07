/**
 * @file self-healing-mesh.js
 * @description Mesh-based self-healing across 3 Colab nodes.
 *
 * Features:
 * - Node health monitoring (heartbeat + health endpoint polling)
 * - Automatic failover and role reassignment
 * - Quarantine → Diagnose → Heal → Verify lifecycle
 * - Incident correlation (dedup related failures)
 * - Recovery playbooks (configurable per-node / per-failure-type)
 *
 * Zero external dependencies — events, crypto (Node built-ins).
 * Sacred Geometry: PHI-scaled heal timeouts, Fibonacci retry counts.
 *
 * @module HeadyServices/SelfHealingMesh
 */

import { EventEmitter } from 'events';
import { randomUUID }   from 'crypto';

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
const PHI      = 1.6180339887498948482;
const PHI_INV  = 1 / PHI;
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377];

const phiDelay  = (n, base = 5_000) => Math.min(Math.round(base * Math.pow(PHI, n)), 600_000);

// ─── Node States ──────────────────────────────────────────────────────────────
export const NodeState = Object.freeze({
  HEALTHY:     'HEALTHY',
  DEGRADED:    'DEGRADED',
  QUARANTINED: 'QUARANTINED',
  DIAGNOSING:  'DIAGNOSING',
  HEALING:     'HEALING',
  VERIFYING:   'VERIFYING',
  DEAD:        'DEAD',
  RECOVERED:   'RECOVERED',
});

// ─── Incident ─────────────────────────────────────────────────────────────────
export class Incident {
  constructor({ nodeId, failureType, description, detail = {} }) {
    this.id          = randomUUID();
    this.nodeId      = nodeId;
    this.failureType = failureType;
    this.description = description;
    this.detail      = detail;
    this.createdAt   = new Date().toISOString();
    this.resolvedAt  = null;
    this.resolved    = false;
    this.correlated  = [];   // IDs of related incidents
    this.timeline    = [{ event: 'created', ts: this.createdAt }];
  }

  addEvent(event, detail = {}) {
    this.timeline.push({ event, ts: new Date().toISOString(), ...detail });
    return this;
  }

  resolve(reason = 'healed') {
    this.resolved   = true;
    this.resolvedAt = new Date().toISOString();
    this.addEvent('resolved', { reason });
    return this;
  }

  correlate(incidentId) {
    if (!this.correlated.includes(incidentId)) this.correlated.push(incidentId);
    return this;
  }

  toJSON() {
    return {
      id:          this.id,
      nodeId:      this.nodeId,
      failureType: this.failureType,
      description: this.description,
      createdAt:   this.createdAt,
      resolvedAt:  this.resolvedAt,
      resolved:    this.resolved,
      correlated:  this.correlated,
      timeline:    this.timeline,
    };
  }
}

// ─── Recovery Playbook ────────────────────────────────────────────────────────
/**
 * @typedef {object} Playbook
 * @property {string}   failureType
 * @property {Function} diagnose   async (node, incident) => { diagnosisCode, detail }
 * @property {Function} heal       async (node, incident, diagnosis) => { success, detail }
 * @property {Function} verify     async (node) => { pass, detail }
 */

// Default built-in playbooks
const DEFAULT_PLAYBOOKS = [
  {
    failureType: 'heartbeat_timeout',
    diagnose: async (node) => {
      // Try pinging the node URL
      try {
        const res = await fetch(`${node.url}/health`, {
          signal: AbortSignal.timeout(5_000),
        });
        return { diagnosisCode: res.ok ? 'REACHABLE' : 'HTTP_ERROR', detail: { status: res.status } };
      } catch (e) {
        return { diagnosisCode: 'UNREACHABLE', detail: { error: e.message } };
      }
    },
    heal: async (node, incident, diagnosis) => {
      if (diagnosis.diagnosisCode === 'REACHABLE') {
        return { success: true, detail: 'Node is reachable, heartbeat may have been transient' };
      }
      // Signal node to restart via mesh if possible
      return { success: false, detail: `Node unreachable (${diagnosis.diagnosisCode}), manual intervention needed` };
    },
    verify: async (node) => {
      try {
        const res = await fetch(`${node.url}/health`, { signal: AbortSignal.timeout(5_000) });
        return { pass: res.ok, detail: { status: res.status } };
      } catch (e) {
        return { pass: false, detail: { error: e.message } };
      }
    },
  },
  {
    failureType: 'high_memory',
    diagnose: async () => ({ diagnosisCode: 'HIGH_MEM', detail: {} }),
    heal: async (node) => {
      // Request GC + service migration signal
      try {
        await fetch(`${node.url}/admin/gc`, { method: 'POST', signal: AbortSignal.timeout(5_000) });
        return { success: true, detail: 'GC requested' };
      } catch {
        return { success: false, detail: 'Could not reach node for GC' };
      }
    },
    verify: async (node) => {
      try {
        const res = await fetch(`${node.url}/metrics`, { signal: AbortSignal.timeout(5_000) });
        if (!res.ok) return { pass: false, detail: { status: res.status } };
        const data = await res.json();
        return { pass: (data.memUsedPct ?? 100) < 90, detail: data };
      } catch (e) {
        return { pass: false, detail: { error: e.message } };
      }
    },
  },
  {
    failureType: 'service_crash',
    diagnose: async () => ({ diagnosisCode: 'CRASHED', detail: {} }),
    heal: async (node) => {
      try {
        await fetch(`${node.url}/admin/restart`, { method: 'POST', signal: AbortSignal.timeout(10_000) });
        return { success: true, detail: 'Restart signal sent' };
      } catch (e) {
        return { success: false, detail: e.message };
      }
    },
    verify: async (node) => {
      try {
        const res = await fetch(`${node.url}/health`, { signal: AbortSignal.timeout(8_000) });
        return { pass: res.ok, detail: { status: res.status } };
      } catch (e) {
        return { pass: false, detail: { error: e.message } };
      }
    },
  },
];

// ─── MeshNode (health model) ──────────────────────────────────────────────────
class MeshNodeHealth {
  constructor({ id, role, url }) {
    this.id           = id;
    this.role         = role;
    this.url          = url;
    this.state        = NodeState.HEALTHY;
    this.missedHeartbeats = 0;
    this.lastHeartbeat = Date.now();
    this.incidents    = [];
    this.healAttempts = 0;
    this.failoverRole = null;  // role this node assumed during failover
  }

  addIncident(incident) {
    this.incidents.push(incident);
    if (this.incidents.length > 34) this.incidents.shift();  // Fibonacci cap
  }

  openIncidents() {
    return this.incidents.filter(i => !i.resolved);
  }

  toJSON() {
    return {
      id:                this.id,
      role:              this.role,
      url:               this.url,
      state:             this.state,
      missedHeartbeats:  this.missedHeartbeats,
      lastHeartbeat:     new Date(this.lastHeartbeat).toISOString(),
      openIncidents:     this.openIncidents().length,
      healAttempts:      this.healAttempts,
      failoverRole:      this.failoverRole,
    };
  }
}

// ─── SelfHealingMesh ─────────────────────────────────────────────────────────
export class SelfHealingMesh extends EventEmitter {
  /**
   * @param {object} opts
   * @param {object[]}  opts.nodes            [{ id, role, url }]
   * @param {number}    [opts.heartbeatMs]    Heartbeat check interval (default 5000)
   * @param {number}    [opts.maxMissed]      Missed heartbeats before quarantine (default 3)
   * @param {Playbook[]} [opts.playbooks]     Custom playbooks
   * @param {number}    [opts.maxHealAttempts] Before marking DEAD (default 5)
   */
  constructor(opts = {}) {
    super();
    this._nodes      = new Map();
    this._playbooks  = [...(opts.playbooks ?? []), ...DEFAULT_PLAYBOOKS];
    this._heartbeatMs = opts.heartbeatMs ?? 5_000;
    this._maxMissed  = opts.maxMissed    ?? 3;
    this._maxHeal    = opts.maxHealAttempts ?? 5;
    this._healQueue  = new Map();  // nodeId → heal task in progress
    this._timer      = null;

    for (const n of (opts.nodes ?? [])) this.addNode(n);
  }

  // ─── Node management ──────────────────────────────────────────────────

  addNode(config) {
    const node = new MeshNodeHealth(config);
    this._nodes.set(node.id, node);
    this.emit('nodeAdded', node.toJSON());
    return node;
  }

  removeNode(id) {
    this._nodes.delete(id);
    this.emit('nodeRemoved', { id });
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────

  start() {
    this._timer = setInterval(() => this._heartbeatCycle(), this._heartbeatMs);
    if (this._timer.unref) this._timer.unref();
    this.emit('meshStarted', { nodeCount: this._nodes.size });
    return this;
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this.emit('meshStopped');
  }

  // ─── Heartbeat cycle ──────────────────────────────────────────────────

  async _heartbeatCycle() {
    await Promise.allSettled(
      [...this._nodes.values()].map(n => this._checkNode(n))
    );
  }

  async _checkNode(node) {
    // Already in heal pipeline — don't interrupt
    if ([NodeState.QUARANTINED, NodeState.DIAGNOSING,
         NodeState.HEALING,     NodeState.VERIFYING].includes(node.state)) {
      return;
    }

    try {
      const res = await fetch(`${node.url}/health`, {
        signal: AbortSignal.timeout(Math.round(this._heartbeatMs * PHI_INV)),
      });

      if (res.ok) {
        node.missedHeartbeats = 0;
        node.lastHeartbeat    = Date.now();
        if (node.state !== NodeState.HEALTHY) {
          node.state = NodeState.HEALTHY;
          this.emit('nodeHealthy', node.toJSON());
        }
      } else {
        this._recordMiss(node, `HTTP ${res.status}`);
      }
    } catch (e) {
      this._recordMiss(node, e.message);
    }
  }

  _recordMiss(node, reason) {
    node.missedHeartbeats++;
    this.emit('heartbeatMiss', { nodeId: node.id, count: node.missedHeartbeats, reason });

    if (node.missedHeartbeats >= this._maxMissed && node.state === NodeState.HEALTHY) {
      node.state = NodeState.DEGRADED;
      this.emit('nodeDegraded', { nodeId: node.id, reason });
    }

    if (node.missedHeartbeats >= this._maxMissed * PHI && node.state === NodeState.DEGRADED) {
      this._quarantine(node, reason);
    }
  }

  // ─── Quarantine → Diagnose → Heal → Verify ───────────────────────────

  async _quarantine(node, reason) {
    node.state = NodeState.QUARANTINED;
    const incident = new Incident({
      nodeId:      node.id,
      failureType: 'heartbeat_timeout',
      description: `Node missed ${node.missedHeartbeats} heartbeats`,
      detail:      { reason },
    });
    node.addIncident(incident);

    // Incident correlation: link to any recent open incidents
    for (const n of this._nodes.values()) {
      for (const existing of n.openIncidents()) {
        if (existing.id !== incident.id &&
            Date.now() - new Date(existing.createdAt).getTime() < 300_000) {
          incident.correlate(existing.id);
        }
      }
    }

    this.emit('nodeQuarantined', { nodeId: node.id, incidentId: incident.id, reason });

    // Trigger failover immediately (don't wait for heal)
    this._failover(node);

    // Start heal pipeline (async, non-blocking)
    if (!this._healQueue.has(node.id)) {
      this._healQueue.set(node.id, this._healPipeline(node, incident));
    }
  }

  async _healPipeline(node, incident) {
    const maxAttempts = this._maxHeal;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      node.healAttempts++;

      // ── DIAGNOSE ──────────────────────────────────────────────────────
      node.state = NodeState.DIAGNOSING;
      incident.addEvent('diagnosing', { attempt });
      this.emit('diagnosing', { nodeId: node.id, attempt, incidentId: incident.id });

      const playbook  = this._findPlaybook(incident.failureType);
      const diagnosis = playbook ? await playbook.diagnose(node, incident) : { diagnosisCode: 'UNKNOWN' };
      incident.addEvent('diagnosed', { ...diagnosis });

      // ── HEAL ──────────────────────────────────────────────────────────
      node.state = NodeState.HEALING;
      this.emit('healing', { nodeId: node.id, attempt, diagnosisCode: diagnosis.diagnosisCode });

      const healResult = playbook
        ? await playbook.heal(node, incident, diagnosis)
        : { success: false, detail: 'No playbook' };

      incident.addEvent('heal_attempt', { attempt, ...healResult });

      if (!healResult.success) {
        const delay = phiDelay(attempt);
        this.emit('healFailed', { nodeId: node.id, attempt, delay, detail: healResult.detail });
        await this._sleep(delay);
        continue;
      }

      // ── VERIFY ────────────────────────────────────────────────────────
      node.state = NodeState.VERIFYING;
      // Wait a PHI-scaled period before verifying
      await this._sleep(phiDelay(0, 2_000));

      const verifyResult = playbook
        ? await playbook.verify(node)
        : { pass: false, detail: 'No verify' };

      incident.addEvent('verify', verifyResult);

      if (verifyResult.pass) {
        node.state            = NodeState.HEALTHY;
        node.missedHeartbeats = 0;
        node.healAttempts     = 0;
        incident.resolve('healed');
        this._healQueue.delete(node.id);

        // Restore original role if in failover
        if (node.failoverRole) {
          node.failoverRole = null;
          this.emit('roleRestored', { nodeId: node.id });
        }

        this.emit('nodeRecovered', { nodeId: node.id, incidentId: incident.id, attempt });
        return;
      }

      await this._sleep(phiDelay(attempt));
    }

    // Exhausted heal attempts → DEAD
    node.state = NodeState.DEAD;
    incident.addEvent('marked_dead');
    this._healQueue.delete(node.id);
    this.emit('nodeDead', { nodeId: node.id, incidentId: incident.id, attempts: node.healAttempts });
  }

  // ─── Failover ─────────────────────────────────────────────────────────

  /**
   * Reassign the failed node's role to a healthy node.
   * BRAIN → CONDUCTOR can assume BRAIN; SENTINEL stays autonomous.
   */
  _failover(failedNode) {
    const candidates = [...this._nodes.values()]
      .filter(n => n.id !== failedNode.id && n.state === NodeState.HEALTHY);

    if (!candidates.length) {
      this.emit('noFailoverCandidate', { failedNodeId: failedNode.id });
      return;
    }

    // Prefer node with lowest incident count
    candidates.sort((a, b) => a.openIncidents().length - b.openIncidents().length);
    const target = candidates[0];

    target.failoverRole = failedNode.role;
    this.emit('failover', {
      from: failedNode.id,
      to:   target.id,
      role: failedNode.role,
    });
  }

  // ─── Manual triggers ──────────────────────────────────────────────────

  /**
   * Manually report a failure on a node.
   * @param {string} nodeId
   * @param {string} failureType
   * @param {string} description
   */
  async reportFailure(nodeId, failureType, description, detail = {}) {
    const node = this._nodes.get(nodeId);
    if (!node) throw new Error(`Unknown node: ${nodeId}`);

    const incident = new Incident({ nodeId, failureType, description, detail });
    node.addIncident(incident);
    node.state = NodeState.QUARANTINED;

    this.emit('failureReported', { nodeId, incidentId: incident.id, failureType });

    if (!this._healQueue.has(nodeId)) {
      this._healQueue.set(nodeId, this._healPipeline(node, incident));
    }

    return incident;
  }

  // ─── Playbook resolution ──────────────────────────────────────────────

  _findPlaybook(failureType) {
    return this._playbooks.find(p => p.failureType === failureType) ?? null;
  }

  addPlaybook(playbook) {
    this._playbooks.unshift(playbook);  // Custom playbooks take priority
    return this;
  }

  // ─── Status ───────────────────────────────────────────────────────────

  meshStatus() {
    return {
      ts:          new Date().toISOString(),
      nodes:       [...this._nodes.values()].map(n => n.toJSON()),
      healQueue:   [...this._healQueue.keys()],
      healthy:     [...this._nodes.values()].filter(n => n.state === NodeState.HEALTHY).length,
      total:       this._nodes.size,
    };
  }

  getNode(id) { return this._nodes.get(id) ?? null; }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
let _mesh = null;

export function getSelfHealingMesh(opts = {}) {
  if (_mesh) return _mesh;

  _mesh = new SelfHealingMesh({
    nodes: [
      { id: 'node-0', role: 'BRAIN',     url: process.env.NODE_0_URL ?? 'http://localhost:3000' },
      { id: 'node-1', role: 'CONDUCTOR', url: process.env.NODE_1_URL ?? 'http://localhost:3001' },
      { id: 'node-2', role: 'SENTINEL',  url: process.env.NODE_2_URL ?? 'http://localhost:3002' },
    ],
    ...opts,
  });

  return _mesh;
}

export default SelfHealingMesh;
