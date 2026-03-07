/**
 * @file liquid-colab-services.js
 * @description Liquid service management across 3 Colab instances.
 *
 * Features:
 * - Service discovery across BRAIN / CONDUCTOR / SENTINEL nodes
 * - Dynamic port allocation with conflict avoidance
 * - Service migration between nodes (liquid droplet model)
 * - Load-aware task placement (PHI-weighted scoring)
 * - Resource-aware scheduling with Fibonacci capacity tiers
 *
 * Transport: native fetch() for cross-node mesh HTTP calls.
 * Zero external dependencies — events, crypto, net (built-ins only).
 * Sacred Geometry: PHI-weighted load scoring, Fibonacci capacity tiers.
 *
 * @module HeadyRuntime/LiquidColabServices
 */

import { EventEmitter } from 'events';
import { randomUUID }   from 'crypto';
import { createServer } from 'net';

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
const PHI     = 1.6180339887498948482;
const PHI_INV = 1 / PHI;

const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377];

// Capacity tiers (% of node resources)
const CAPACITY_TIERS = Object.freeze({
  HOT:  34,  // F(9)  — latency-critical
  WARM: 21,  // F(8)  — background
  COLD: 13,  // F(7)  — batch/idle
});

// ─── Port Finder ──────────────────────────────────────────────────────────────
/**
 * Find a free TCP port on the local machine.
 * @param {number} [start]  Start of range (default 3000)
 * @param {number} [end]    End of range (default 9999)
 * @returns {Promise<number>}
 */
export function findFreePort(start = 3000, end = 9999) {
  return new Promise((resolve, reject) => {
    let port = start;

    const tryPort = (p) => {
      if (p > end) { reject(new Error(`No free port in range ${start}–${end}`)); return; }
      const server = createServer();
      server.once('error', () => tryPort(p + 1));
      server.once('listening', () => { server.close(() => resolve(p)); });
      server.listen(p, '127.0.0.1');
    };

    tryPort(port);
  });
}

// ─── Service Descriptor ───────────────────────────────────────────────────────
/**
 * @typedef {object} ServiceDescriptor
 * @property {string}   id           UUID
 * @property {string}   name         Human-readable name
 * @property {string}   nodeId       Node where this service lives
 * @property {string}   nodeUrl      Base URL of node
 * @property {number}   port         Listening port
 * @property {string}   tier         HOT | WARM | COLD
 * @property {string}   status       STARTING | RUNNING | DRAINING | STOPPED | FAILED
 * @property {string}   registeredAt ISO timestamp
 * @property {string}   [tunnelUrl]  Public tunnel URL if available
 * @property {object}   [meta]       Arbitrary metadata
 */

export const ServiceStatus = Object.freeze({
  STARTING:  'STARTING',
  RUNNING:   'RUNNING',
  DRAINING:  'DRAINING',
  STOPPED:   'STOPPED',
  FAILED:    'FAILED',
});

export const ServiceTier = Object.freeze({ ...CAPACITY_TIERS, ...{ HOT: 'HOT', WARM: 'WARM', COLD: 'COLD' } });

// ─── Node Registry ────────────────────────────────────────────────────────────
/**
 * Represents one of the 3 Colab nodes in the mesh.
 */
export class MeshNode {
  constructor({ id, role, url, capacityPct = 34 }) {
    this.id          = id;
    this.role        = role;
    this.url         = url;
    this.capacityPct = capacityPct;
    this.services    = new Map();   // serviceId → ServiceDescriptor
    this.loadScore   = 0;          // 0–1 normalized load
    this.healthy     = true;
    this.lastSeen    = Date.now();
  }

  get serviceCount() { return this.services.size; }

  /**
   * PHI-weighted load score.
   * Higher = more overloaded.
   * score = (serviceCount / capacity) * PHI
   */
  computeLoad() {
    const usedPct = (this.serviceCount / Math.max(1, this.capacityPct)) * 100;
    this.loadScore = Math.min(1, usedPct * PHI_INV);
    return this.loadScore;
  }

  register(svc) {
    this.services.set(svc.id, svc);
    this.computeLoad();
  }

  deregister(id) {
    this.services.delete(id);
    this.computeLoad();
  }

  toJSON() {
    return {
      id:           this.id,
      role:         this.role,
      url:          this.url,
      capacityPct:  this.capacityPct,
      serviceCount: this.serviceCount,
      loadScore:    this.loadScore,
      healthy:      this.healthy,
      lastSeen:     new Date(this.lastSeen).toISOString(),
    };
  }
}

// ─── Load-Aware Scheduler ─────────────────────────────────────────────────────
export class LoadAwareScheduler {
  /**
   * Select the best node for a new service, given tier requirement.
   * Uses PHI-weighted scoring: prefers nodes with lower load.
   *
   * @param {MeshNode[]} nodes
   * @param {string}     tier   HOT | WARM | COLD
   * @param {string}     [affinityNodeId]  Prefer this node if load allows
   * @returns {MeshNode|null}
   */
  selectNode(nodes, tier = 'WARM', affinityNodeId = null) {
    const healthy = nodes.filter(n => n.healthy);
    if (!healthy.length) return null;

    // Update load scores
    healthy.forEach(n => n.computeLoad());

    // Affinity check: if preferred node is under PHI_INV load, use it
    if (affinityNodeId) {
      const preferred = healthy.find(n => n.id === affinityNodeId);
      if (preferred && preferred.loadScore < PHI_INV) return preferred;
    }

    // Score each node: lower load is better; PHI-scale the inverse
    const scored = healthy.map(n => ({
      node:  n,
      score: Math.pow(1 - n.loadScore, PHI),  // higher score = better placement
    }));

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.node ?? null;
  }

  /**
   * Compute task placement recommendation.
   * @param {MeshNode[]} nodes
   * @param {object}     task   { cpuHint, memHint, gpuRequired, priority }
   * @returns {{ nodeId, tier, reason }}
   */
  recommend(nodes, task = {}) {
    const { gpuRequired = false, priority = 'normal' } = task;

    const tier = priority === 'high'   ? 'HOT'  :
                 priority === 'normal' ? 'WARM'  : 'COLD';

    // GPU tasks must go to nodes that have GPU
    const candidates = gpuRequired
      ? nodes.filter(n => n.healthy && n.role === 'BRAIN')
      : nodes.filter(n => n.healthy);

    const selected = this.selectNode(candidates, tier);
    if (!selected) return { nodeId: null, tier, reason: 'no-healthy-nodes' };

    return {
      nodeId: selected.id,
      tier,
      score:  selected.loadScore,
      reason: `load-score=${selected.loadScore.toFixed(3)} tier=${tier}`,
    };
  }
}

// ─── Service Registry ─────────────────────────────────────────────────────────
export class ServiceRegistry extends EventEmitter {
  constructor() {
    super();
    this._services = new Map();   // serviceId → ServiceDescriptor
    this._nodes    = new Map();   // nodeId → MeshNode
    this._scheduler = new LoadAwareScheduler();

    // Port allocation tracking (per node)
    this._allocatedPorts = new Map();  // nodeId → Set<port>
  }

  // ─── Node management ──────────────────────────────────────────────────

  addNode(nodeConfig) {
    const node = new MeshNode(nodeConfig);
    this._nodes.set(node.id, node);
    this._allocatedPorts.set(node.id, new Set());
    this.emit('nodeAdded', node.toJSON());
    return node;
  }

  removeNode(nodeId) {
    const node = this._nodes.get(nodeId);
    if (!node) return;
    // Mark all services on this node as FAILED
    for (const svc of node.services.values()) {
      svc.status = ServiceStatus.FAILED;
      this.emit('serviceFailed', svc);
    }
    this._nodes.delete(nodeId);
    this.emit('nodeRemoved', { nodeId });
  }

  markNodeUnhealthy(nodeId) {
    const node = this._nodes.get(nodeId);
    if (node) { node.healthy = false; this.emit('nodeUnhealthy', { nodeId }); }
  }

  markNodeHealthy(nodeId) {
    const node = this._nodes.get(nodeId);
    if (node) { node.healthy = true; node.lastSeen = Date.now(); }
  }

  nodes() { return [...this._nodes.values()]; }
  getNode(id) { return this._nodes.get(id) ?? null; }

  // ─── Port allocation ──────────────────────────────────────────────────

  /**
   * Allocate a free port on a specific node.
   * @param {string} nodeId
   * @param {number} [preferred]  Preferred port
   * @returns {Promise<number>}
   */
  async allocatePort(nodeId, preferred) {
    const used = this._allocatedPorts.get(nodeId) ?? new Set();

    if (preferred && !used.has(preferred)) {
      used.add(preferred);
      this._allocatedPorts.set(nodeId, used);
      return preferred;
    }

    // Find next available port (local check only for same-node)
    const port = await findFreePort(3000, 9999);
    used.add(port);
    this._allocatedPorts.set(nodeId, used);
    return port;
  }

  freePort(nodeId, port) {
    this._allocatedPorts.get(nodeId)?.delete(port);
  }

  // ─── Service registration ─────────────────────────────────────────────

  /**
   * Register a service.
   * @param {object} config
   * @returns {ServiceDescriptor}
   */
  register(config) {
    const svc = {
      id:           config.id           ?? randomUUID(),
      name:         config.name         ?? 'unknown',
      nodeId:       config.nodeId,
      nodeUrl:      config.nodeUrl      ?? '',
      port:         config.port         ?? 0,
      tier:         config.tier         ?? 'WARM',
      status:       ServiceStatus.STARTING,
      registeredAt: new Date().toISOString(),
      tunnelUrl:    config.tunnelUrl    ?? null,
      meta:         config.meta         ?? {},
    };

    this._services.set(svc.id, svc);

    const node = this._nodes.get(svc.nodeId);
    if (node) node.register(svc);

    this.emit('serviceRegistered', svc);
    return svc;
  }

  updateStatus(serviceId, status) {
    const svc = this._services.get(serviceId);
    if (!svc) return;
    svc.status = status;
    this.emit('serviceStatusChanged', { serviceId, status });
  }

  deregister(serviceId) {
    const svc = this._services.get(serviceId);
    if (!svc) return;
    const node = this._nodes.get(svc.nodeId);
    if (node) {
      node.deregister(serviceId);
      this.freePort(svc.nodeId, svc.port);
    }
    this._services.delete(serviceId);
    this.emit('serviceDeregistered', { serviceId, name: svc.name });
  }

  // ─── Discovery ────────────────────────────────────────────────────────

  /**
   * Discover services by name pattern or node.
   * @param {object} query
   * @param {string} [query.name]      Substring match
   * @param {string} [query.nodeId]
   * @param {string} [query.tier]
   * @param {string} [query.status]
   * @returns {ServiceDescriptor[]}
   */
  discover(query = {}) {
    let svcs = [...this._services.values()];
    if (query.name)   svcs = svcs.filter(s => s.name.includes(query.name));
    if (query.nodeId) svcs = svcs.filter(s => s.nodeId === query.nodeId);
    if (query.tier)   svcs = svcs.filter(s => s.tier   === query.tier);
    if (query.status) svcs = svcs.filter(s => s.status === query.status);
    return svcs;
  }

  getService(id) { return this._services.get(id) ?? null; }

  // ─── Service migration ────────────────────────────────────────────────

  /**
   * Migrate a service from its current node to a target node.
   * The actual process migration is application-layer; this updates registry.
   *
   * @param {string} serviceId
   * @param {string} targetNodeId
   * @param {object} [opts]
   * @returns {{ service, oldNodeId, newNodeId }}
   */
  async migrate(serviceId, targetNodeId, opts = {}) {
    const svc       = this._services.get(serviceId);
    if (!svc)       throw new Error(`Unknown service: ${serviceId}`);
    const target    = this._nodes.get(targetNodeId);
    if (!target)    throw new Error(`Unknown target node: ${targetNodeId}`);
    if (!target.healthy) throw new Error(`Target node ${targetNodeId} is unhealthy`);

    const oldNodeId = svc.nodeId;
    const oldNode   = this._nodes.get(oldNodeId);

    // Drain old service
    svc.status = ServiceStatus.DRAINING;
    this.emit('serviceDraining', { serviceId, oldNodeId, targetNodeId });

    // Await drain (application configurable drain wait)
    const drainMs = opts.drainMs ?? Math.round(1000 * PHI);
    await new Promise(r => setTimeout(r, drainMs));

    // Allocate port on new node
    const newPort = await this.allocatePort(targetNodeId, opts.preferPort);

    // Deregister from old node
    if (oldNode) {
      oldNode.deregister(serviceId);
      this.freePort(oldNodeId, svc.port);
    }

    // Update service descriptor
    svc.nodeId   = targetNodeId;
    svc.nodeUrl  = target.url;
    svc.port     = newPort;
    svc.status   = ServiceStatus.STARTING;
    svc.meta     = { ...svc.meta, migratedAt: new Date().toISOString(), migratedFrom: oldNodeId };

    // Register on new node
    target.register(svc);

    this.emit('serviceMigrated', { serviceId, oldNodeId, newNodeId: targetNodeId, newPort });
    return { service: svc, oldNodeId, newNodeId: targetNodeId };
  }

  // ─── Placement recommendation ─────────────────────────────────────────

  recommend(task = {}) {
    return this._scheduler.recommend(this.nodes(), task);
  }

  // ─── Status snapshot ──────────────────────────────────────────────────

  snapshot() {
    return {
      ts:       new Date().toISOString(),
      nodes:    this.nodes().map(n => n.toJSON()),
      services: [...this._services.values()],
    };
  }
}

// ─── Cluster Bootstrap (3-node defaults) ─────────────────────────────────────
export function bootstrapCluster(config = {}) {
  const registry = new ServiceRegistry();

  registry.addNode({
    id:          config.brainId    ?? 'node-0',
    role:        'BRAIN',
    url:         config.node0Url   ?? process.env.NODE_0_URL ?? 'http://localhost:3000',
    capacityPct: CAPACITY_TIERS.HOT,
  });

  registry.addNode({
    id:          config.conductorId ?? 'node-1',
    role:        'CONDUCTOR',
    url:         config.node1Url    ?? process.env.NODE_1_URL ?? 'http://localhost:3001',
    capacityPct: CAPACITY_TIERS.WARM + CAPACITY_TIERS.COLD,
  });

  registry.addNode({
    id:          config.sentinelId ?? 'node-2',
    role:        'SENTINEL',
    url:         config.node2Url   ?? process.env.NODE_2_URL ?? 'http://localhost:3002',
    capacityPct: 8 + 5,  // reserve + governance
  });

  return registry;
}

// ─── Singleton ────────────────────────────────────────────────────────────────
let _registry = null;

export function getServiceRegistry(config = {}) {
  if (!_registry) _registry = bootstrapCluster(config);
  return _registry;
}

export { LoadAwareScheduler as Scheduler };
export default ServiceRegistry;
