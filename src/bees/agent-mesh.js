'use strict';

/**
 * @file agent-mesh.js
 * @description Agent Mesh Network — inter-agent pub/sub, broadcast, and topology-aware routing.
 *
 * CHANGE LOG (vs current agent-orchestrator.js):
 *  - NEW FILE. AgentOrchestrator.dispatch(task, agentName) requires the caller to know the exact
 *    target agent name. This mesh layer adds:
 *      • Topic-based pub/sub so agents don't need to know each other's names
 *      • Capability-based routing: publish to a skill/capability and the mesh finds the right agent
 *      • Broadcast fan-out for system-wide events (alerts, config changes, shutdown)
 *      • Multi-hop routing with a lightweight topology graph (Dijkstra-based)
 *      • Message delivery guarantees: at-least-once with dedup window, dead-letter queue
 *      • Observable via EventEmitter hooks for telemetry-bee integration
 *
 * ARCHITECTURE:
 *   AgentMesh
 *     ├─ TopologyGraph        – tracks agent nodes and directed edges (latency-weighted)
 *     ├─ SubscriptionRegistry – maps topic → Set<{agentId, handler}>
 *     ├─ CapabilityIndex      – maps capability string → Set<agentId>
 *     ├─ MessageBus           – async delivery with ack, retry, and DLQ
 *     └─ MeshMetrics          – per-agent send/recv counters, latency histograms
 *
 * USAGE:
 *   const { AgentMesh, KNOWN_AGENTS } = require('./agent-mesh');
 *   const mesh = new AgentMesh();
 *   mesh.registerAgent('JULES', { capabilities: ['code', 'review'] });
 *   mesh.subscribe('JULES', 'code.review.requested', async (msg) => { ... });
 *   await mesh.publish('MUSE', 'code.review.requested', { prUrl: '...' });
 *   await mesh.sendTo('MUSE', 'JULES', { type: 'ping' });
 *   await mesh.broadcast('SENTINEL', { type: 'alert', severity: 'warn', text: '...' });
 */

const EventEmitter = require('events');

// ---------------------------------------------------------------------------
// Known agents — sourced from agent-orchestrator.js KNOWN_AGENTS array
// ---------------------------------------------------------------------------

/** @type {string[]} All recognised agent IDs in the Heady platform */
const KNOWN_AGENTS = [
  'JULES', 'BUILDER', 'OBSERVER', 'MURPHY', 'ATLAS',
  'PYTHIA', 'BRIDGE', 'MUSE', 'SENTINEL', 'NOVA',
  'JANITOR', 'SOPHIA', 'CIPHER', 'LENS',
];

/** Default capability catalogue inferred from agent names and analysis */
const DEFAULT_CAPABILITIES = {
  JULES:    ['code', 'review', 'refactor', 'test'],
  BUILDER:  ['build', 'compile', 'deploy', 'ci'],
  OBSERVER: ['monitor', 'observe', 'trace', 'log'],
  MURPHY:   ['chaos', 'test', 'fault-injection', 'resilience'],
  ATLAS:    ['map', 'topology', 'graph', 'discovery'],
  PYTHIA:   ['forecast', 'predict', 'analytics', 'insight'],
  BRIDGE:   ['integrate', 'transform', 'bridge', 'etl'],
  MUSE:     ['create', 'design', 'content', 'generate'],
  SENTINEL: ['alert', 'security', 'policy', 'audit'],
  NOVA:     ['experiment', 'ab-test', 'feature-flag', 'rollout'],
  JANITOR:  ['cleanup', 'gc', 'archive', 'purge'],
  SOPHIA:   ['learn', 'adapt', 'train', 'improve'],
  CIPHER:   ['encrypt', 'decrypt', 'secret', 'auth'],
  LENS:     ['search', 'query', 'retrieve', 'index'],
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Lightweight Dijkstra shortest-path for the topology graph.
 * @param {Map<string, Map<string, number>>} graph  adjacency map (node → neighbor → weight)
 * @param {string} src
 * @param {string} dst
 * @returns {string[]} ordered path including src and dst, empty if no path
 */
function dijkstra(graph, src, dst) {
  const dist = new Map();
  const prev = new Map();
  const visited = new Set();
  const queue = [{ id: src, d: 0 }]; // min-heap approximated with sort

  for (const node of graph.keys()) dist.set(node, Infinity);
  dist.set(src, 0);

  while (queue.length > 0) {
    queue.sort((a, b) => a.d - b.d);
    const { id } = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    if (id === dst) break;

    const neighbours = graph.get(id) || new Map();
    for (const [nbr, w] of neighbours) {
      const alt = dist.get(id) + w;
      if (alt < (dist.get(nbr) ?? Infinity)) {
        dist.set(nbr, alt);
        prev.set(nbr, id);
        queue.push({ id: nbr, d: alt });
      }
    }
  }

  if (!prev.has(dst) && src !== dst) return []; // no path
  const path = [];
  let cur = dst;
  while (cur !== undefined) { path.unshift(cur); cur = prev.get(cur); }
  return path;
}

/**
 * Generate a short collision-resistant message ID.
 * @returns {string}
 */
function msgId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// TopologyGraph
// ---------------------------------------------------------------------------

/**
 * Maintains a directed weighted graph of agent-to-agent edges.
 * Weights represent observed average latency in ms (lower = preferred).
 */
class TopologyGraph {
  constructor() {
    /** @type {Map<string, Map<string, number>>} node → neighbor → latency */
    this._edges = new Map();
    /** @type {Map<string, object>} agent metadata */
    this._nodes = new Map();
  }

  /**
   * Register an agent node with optional metadata.
   * @param {string} agentId
   * @param {object} [meta={}]
   */
  addNode(agentId, meta = {}) {
    if (!this._edges.has(agentId)) this._edges.set(agentId, new Map());
    this._nodes.set(agentId, { ...meta, registeredAt: Date.now() });
  }

  /**
   * Remove an agent node and all its edges.
   * @param {string} agentId
   */
  removeNode(agentId) {
    this._edges.delete(agentId);
    this._nodes.delete(agentId);
    for (const neighbours of this._edges.values()) {
      neighbours.delete(agentId);
    }
  }

  /**
   * Record or update a directed edge.
   * @param {string} from
   * @param {string} to
   * @param {number} [latencyMs=1]
   */
  addEdge(from, to, latencyMs = 1) {
    if (!this._edges.has(from)) this._edges.set(from, new Map());
    this._edges.get(from).set(to, latencyMs);
  }

  /**
   * Update edge weight with an exponential moving average.
   * @param {string} from
   * @param {string} to
   * @param {number} observedMs
   * @param {number} [alpha=0.2]  EMA smoothing factor
   */
  updateLatency(from, to, observedMs, alpha = 0.2) {
    const nbrs = this._edges.get(from);
    if (!nbrs) return;
    const prev = nbrs.get(to) ?? observedMs;
    nbrs.set(to, prev * (1 - alpha) + observedMs * alpha);
  }

  /**
   * Find the shortest (lowest latency) path between two agents.
   * @param {string} src
   * @param {string} dst
   * @returns {string[]}
   */
  shortestPath(src, dst) {
    return dijkstra(this._edges, src, dst);
  }

  /**
   * Export a plain-object snapshot of the topology for inspection.
   * @returns {object}
   */
  snapshot() {
    const nodes = {};
    for (const [id, meta] of this._nodes) nodes[id] = meta;
    const edges = {};
    for (const [from, nbrs] of this._edges) {
      edges[from] = Object.fromEntries(nbrs);
    }
    return { nodes, edges, snapshotAt: new Date().toISOString() };
  }
}

// ---------------------------------------------------------------------------
// CapabilityIndex
// ---------------------------------------------------------------------------

/**
 * Inverted index from capability string to the set of agents that declare it.
 * Supports fuzzy matching via token overlap (Jaccard similarity on word tokens).
 */
class CapabilityIndex {
  constructor() {
    /** @type {Map<string, Set<string>>} capability → agentIds */
    this._index = new Map();
    /** @type {Map<string, string[]>} agentId → declared capabilities */
    this._agentCaps = new Map();
  }

  /**
   * Register capabilities for an agent.
   * @param {string} agentId
   * @param {string[]} capabilities
   */
  register(agentId, capabilities) {
    const normalised = capabilities.map(c => c.toLowerCase().trim());
    this._agentCaps.set(agentId, normalised);
    for (const cap of normalised) {
      if (!this._index.has(cap)) this._index.set(cap, new Set());
      this._index.get(cap).add(agentId);
    }
  }

  /**
   * Deregister an agent from the capability index.
   * @param {string} agentId
   */
  deregister(agentId) {
    const caps = this._agentCaps.get(agentId) || [];
    for (const cap of caps) {
      const s = this._index.get(cap);
      if (s) { s.delete(agentId); if (s.size === 0) this._index.delete(cap); }
    }
    this._agentCaps.delete(agentId);
  }

  /**
   * Find agents with an exact capability.
   * @param {string} capability
   * @returns {string[]}
   */
  exactMatch(capability) {
    const cap = capability.toLowerCase().trim();
    return Array.from(this._index.get(cap) || []);
  }

  /**
   * Find agents with overlapping capabilities using Jaccard token similarity.
   * @param {string} query
   * @param {number} [threshold=0.3]  minimum Jaccard score to include
   * @returns {{ agentId: string, score: number }[]}  sorted descending by score
   */
  fuzzyMatch(query, threshold = 0.3) {
    const qTokens = new Set(query.toLowerCase().split(/[\s\-_.]+/).filter(Boolean));
    const results = [];

    for (const [agentId, caps] of this._agentCaps) {
      const aTokens = new Set(caps.flatMap(c => c.split(/[\s\-_.]+/).filter(Boolean)));
      const intersection = [...qTokens].filter(t => aTokens.has(t)).length;
      const union = new Set([...qTokens, ...aTokens]).size;
      const score = union > 0 ? intersection / union : 0;
      if (score >= threshold) results.push({ agentId, score });
    }

    return results.sort((a, b) => b.score - a.score);
  }
}

// ---------------------------------------------------------------------------
// MessageBus
// ---------------------------------------------------------------------------

/** @typedef {{ id: string, from: string, topic: string, payload: any, ts: number, ttl: number, attempt: number }} MeshMessage */

/**
 * Async delivery engine with acknowledgement tracking, retry, and a dead-letter queue (DLQ).
 * Dedup window prevents the same message from being delivered twice within `dedupWindowMs`.
 */
class MessageBus extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {number} [opts.maxRetries=3]         max delivery attempts per subscriber
   * @param {number} [opts.retryBaseMs=200]      base backoff delay (doubles each retry)
   * @param {number} [opts.dedupWindowMs=5000]   dedup window in ms
   * @param {number} [opts.defaultTtlMs=30000]   message TTL after which it is dropped
   * @param {number} [opts.dlqMaxSize=500]        max dead-letter entries retained
   */
  constructor(opts = {}) {
    super();
    this._maxRetries    = opts.maxRetries    ?? 3;
    this._retryBaseMs   = opts.retryBaseMs   ?? 200;
    this._dedupWindowMs = opts.dedupWindowMs ?? 5_000;
    this._defaultTtlMs  = opts.defaultTtlMs  ?? 30_000;
    this._dlqMaxSize    = opts.dlqMaxSize    ?? 500;

    /** @type {Map<string, number>} msgId → deliveredAt for dedup */
    this._delivered = new Map();
    /** @type {MeshMessage[]} dead-letter queue */
    this._dlq = [];

    // Periodically prune the dedup window
    this._dedupTimer = setInterval(() => this._pruneDedup(), this._dedupWindowMs);
    if (this._dedupTimer.unref) this._dedupTimer.unref();
  }

  /**
   * Deliver a message to a handler with retry on failure.
   * @param {MeshMessage} msg
   * @param {Function} handler  async (msg) => void
   * @returns {Promise<boolean>}  true if delivered, false if DLQ'd
   */
  async deliver(msg, handler) {
    // TTL check
    if (Date.now() - msg.ts > (msg.ttl ?? this._defaultTtlMs)) {
      this._toDlq(msg, 'ttl_expired');
      return false;
    }

    // Dedup check
    if (this._delivered.has(msg.id)) return true; // already delivered

    let attempt = 0;
    while (attempt <= this._maxRetries) {
      try {
        await handler(msg);
        this._delivered.set(msg.id, Date.now());
        this.emit('delivered', { msgId: msg.id, attempt, agentHandler: handler.name });
        return true;
      } catch (err) {
        attempt++;
        if (attempt > this._maxRetries) {
          this._toDlq(msg, err.message);
          this.emit('dlq', { msgId: msg.id, reason: err.message });
          return false;
        }
        const delay = this._retryBaseMs * Math.pow(2, attempt - 1);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    return false;
  }

  /** @private */
  _toDlq(msg, reason) {
    this._dlq.push({ ...msg, dlqReason: reason, dlqAt: Date.now() });
    if (this._dlq.length > this._dlqMaxSize) this._dlq.shift();
  }

  /** @private */
  _pruneDedup() {
    const cutoff = Date.now() - this._dedupWindowMs;
    for (const [id, ts] of this._delivered) {
      if (ts < cutoff) this._delivered.delete(id);
    }
  }

  /**
   * Drain the dead-letter queue (returns and clears all entries).
   * @returns {MeshMessage[]}
   */
  drainDlq() {
    const items = [...this._dlq];
    this._dlq = [];
    return items;
  }

  /** Clean up timers. */
  destroy() {
    clearInterval(this._dedupTimer);
    this.removeAllListeners();
  }
}

// ---------------------------------------------------------------------------
// MeshMetrics
// ---------------------------------------------------------------------------

/**
 * Per-agent, per-direction message counters and latency histograms.
 * Lightweight — no external deps.
 */
class MeshMetrics {
  constructor() {
    /** @type {Map<string, { sent: number, recv: number, errors: number, latencies: number[] }>} */
    this._agents = new Map();
  }

  /** @private */
  _ensure(agentId) {
    if (!this._agents.has(agentId)) {
      this._agents.set(agentId, { sent: 0, recv: 0, errors: 0, latencies: [] });
    }
    return this._agents.get(agentId);
  }

  recordSend(agentId) { this._ensure(agentId).sent++; }
  recordRecv(agentId) { this._ensure(agentId).recv++; }
  recordError(agentId) { this._ensure(agentId).errors++; }

  /**
   * Record an observed end-to-end latency for an agent.
   * Keeps only the last 200 samples per agent.
   * @param {string} agentId
   * @param {number} ms
   */
  recordLatency(agentId, ms) {
    const m = this._ensure(agentId);
    m.latencies.push(ms);
    if (m.latencies.length > 200) m.latencies.shift();
  }

  /**
   * Compute a percentile over the stored latency samples.
   * @param {string} agentId
   * @param {number} pct  0–100
   * @returns {number|null}
   */
  percentile(agentId, pct) {
    const m = this._agents.get(agentId);
    if (!m || m.latencies.length === 0) return null;
    const sorted = [...m.latencies].sort((a, b) => a - b);
    const idx = Math.ceil((pct / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  /**
   * Return a snapshot of all agent metrics.
   * @returns {object}
   */
  snapshot() {
    const out = {};
    for (const [id, m] of this._agents) {
      out[id] = {
        sent: m.sent,
        recv: m.recv,
        errors: m.errors,
        p50Latency: this.percentile(id, 50),
        p95Latency: this.percentile(id, 95),
        sampleCount: m.latencies.length,
      };
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// SubscriptionRegistry
// ---------------------------------------------------------------------------

/**
 * Maps topics → ordered list of { agentId, handler } entries.
 * Topic wildcards: '*' matches one segment, '**' matches one or more.
 * Example: 'code.*' matches 'code.review', 'code.deploy' but not 'code.review.requested'.
 *          'code.**' matches all of the above.
 */
class SubscriptionRegistry {
  constructor() {
    /** @type {Map<string, Array<{ agentId: string, handler: Function }>>} */
    this._subs = new Map();
  }

  /**
   * @param {string} agentId
   * @param {string} topic
   * @param {Function} handler  async (msg) => void
   */
  subscribe(agentId, topic, handler) {
    if (!this._subs.has(topic)) this._subs.set(topic, []);
    // Prevent duplicate subscriptions for same agent+topic
    const existing = this._subs.get(topic);
    if (!existing.find(s => s.agentId === agentId)) {
      existing.push({ agentId, handler });
    }
  }

  /**
   * @param {string} agentId
   * @param {string} topic
   */
  unsubscribe(agentId, topic) {
    const subs = this._subs.get(topic);
    if (!subs) return;
    const filtered = subs.filter(s => s.agentId !== agentId);
    if (filtered.length === 0) this._subs.delete(topic);
    else this._subs.set(topic, filtered);
  }

  /**
   * Remove all subscriptions for a given agent.
   * @param {string} agentId
   */
  unsubscribeAll(agentId) {
    for (const [topic, subs] of this._subs) {
      const filtered = subs.filter(s => s.agentId !== agentId);
      if (filtered.length === 0) this._subs.delete(topic);
      else this._subs.set(topic, filtered);
    }
  }

  /**
   * Return all handlers whose topic pattern matches the given concrete topic string.
   * @param {string} topic  concrete topic (no wildcards)
   * @returns {Array<{ agentId: string, handler: Function }>}
   */
  matching(topic) {
    const results = [];
    for (const [pattern, subs] of this._subs) {
      if (this._matches(pattern, topic)) results.push(...subs);
    }
    return results;
  }

  /**
   * Glob-style topic matching.
   * @private
   * @param {string} pattern
   * @param {string} topic
   * @returns {boolean}
   */
  _matches(pattern, topic) {
    if (pattern === topic) return true;
    if (pattern === '**') return true;
    // Convert pattern to regex
    const re = '^' + pattern
      .split('.')
      .map(seg => {
        if (seg === '**') return '(?:[^.]+\\.)*[^.]+';  // one or more segments
        if (seg === '*')  return '[^.]+';                 // exactly one segment
        return seg.replace(/[$()+?[\\\]^{|}]/g, '\\$&'); // escape regex chars
      })
      .join('\\.') + '$';
    return new RegExp(re).test(topic);
  }
}

// ---------------------------------------------------------------------------
// AgentMesh  (main class)
// ---------------------------------------------------------------------------

/**
 * Agent Mesh Network — the central communication fabric for all Heady agents.
 *
 * @extends EventEmitter
 *
 * @example
 * const mesh = new AgentMesh();
 * mesh.registerAgent('JULES', { capabilities: ['code', 'review'] });
 * mesh.registerAgent('MUSE',  { capabilities: ['create', 'content'] });
 *
 * mesh.subscribe('JULES', 'code.review.requested', async (msg) => {
 *   console.log('JULES got review request:', msg.payload);
 * });
 *
 * // MUSE requests a code review without knowing JULES exists
 * await mesh.publish('MUSE', 'code.review.requested', { prUrl: 'https://...' });
 *
 * // Direct message
 * await mesh.sendTo('MUSE', 'JULES', { type: 'ping' });
 *
 * // System broadcast
 * await mesh.broadcast('SENTINEL', { type: 'shutdown', reason: 'maintenance' });
 */
class AgentMesh extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {number} [opts.maxRetries=3]       message delivery retries
   * @param {number} [opts.retryBaseMs=200]    base backoff ms
   * @param {number} [opts.dedupWindowMs=5000] duplicate message window
   * @param {number} [opts.defaultTtlMs=30000] message time-to-live
   * @param {boolean} [opts.autoRegisterKnown=true] pre-register KNOWN_AGENTS on init
   */
  constructor(opts = {}) {
    super();
    this._topology    = new TopologyGraph();
    this._capabilities = new CapabilityIndex();
    this._subscriptions = new SubscriptionRegistry();
    this._bus         = new MessageBus(opts);
    this._metrics     = new MeshMetrics();

    /** @type {Map<string, object>} agentId → registration metadata */
    this._agents = new Map();

    // Forward bus events for observability
    this._bus.on('delivered', e => this.emit('message:delivered', e));
    this._bus.on('dlq',       e => this.emit('message:dlq', e));

    if (opts.autoRegisterKnown !== false) {
      for (const id of KNOWN_AGENTS) {
        this.registerAgent(id, { capabilities: DEFAULT_CAPABILITIES[id] || [] });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Agent Registration
  // -------------------------------------------------------------------------

  /**
   * Register an agent with the mesh.
   * @param {string} agentId
   * @param {object} [opts]
   * @param {string[]}  [opts.capabilities=[]]  skill/capability tokens
   * @param {object}    [opts.meta={}]           arbitrary metadata
   * @param {Function}  [opts.dispatchFn]        optional fn(task)=>Promise to integrate with AgentOrchestrator
   */
  registerAgent(agentId, opts = {}) {
    const caps = opts.capabilities || DEFAULT_CAPABILITIES[agentId] || [];
    const meta = opts.meta || {};

    this._topology.addNode(agentId, { capabilities: caps, ...meta });
    this._capabilities.register(agentId, caps);
    this._agents.set(agentId, {
      agentId,
      capabilities: caps,
      meta,
      dispatchFn: opts.dispatchFn || null,
      registeredAt: Date.now(),
    });

    // Add bidirectional edges with default latency for known topology connections
    for (const other of this._agents.keys()) {
      if (other !== agentId) {
        this._topology.addEdge(agentId, other, 1);
        this._topology.addEdge(other, agentId, 1);
      }
    }

    this.emit('agent:registered', { agentId, capabilities: caps });
    return this;
  }

  /**
   * Deregister an agent and clean up all its subscriptions and edges.
   * @param {string} agentId
   */
  deregisterAgent(agentId) {
    this._topology.removeNode(agentId);
    this._capabilities.deregister(agentId);
    this._subscriptions.unsubscribeAll(agentId);
    this._agents.delete(agentId);
    this.emit('agent:deregistered', { agentId });
    return this;
  }

  // -------------------------------------------------------------------------
  // Pub/Sub
  // -------------------------------------------------------------------------

  /**
   * Subscribe an agent to a topic (supports wildcards: '*', '**').
   * @param {string} agentId
   * @param {string} topic
   * @param {Function} handler  async (msg: MeshMessage) => void
   */
  subscribe(agentId, topic, handler) {
    this._subscriptions.subscribe(agentId, topic, handler);
    this.emit('subscription:added', { agentId, topic });
    return this;
  }

  /**
   * Unsubscribe an agent from a topic.
   * @param {string} agentId
   * @param {string} topic
   */
  unsubscribe(agentId, topic) {
    this._subscriptions.unsubscribe(agentId, topic);
    this.emit('subscription:removed', { agentId, topic });
    return this;
  }

  /**
   * Publish a message to a topic. All matching subscribers will receive it
   * via the message bus (with retry and dedup).
   *
   * @param {string} fromAgentId  sender agent ID
   * @param {string} topic        concrete topic string (no wildcards)
   * @param {any}    payload      arbitrary payload
   * @param {object} [opts]
   * @param {number} [opts.ttl]   TTL override in ms
   * @returns {Promise<{ delivered: number, failed: number }>}
   */
  async publish(fromAgentId, topic, payload, opts = {}) {
    const msg = {
      id:      msgId(),
      from:    fromAgentId,
      topic,
      payload,
      ts:      Date.now(),
      ttl:     opts.ttl,
    };

    const subscribers = this._subscriptions.matching(topic);
    if (subscribers.length === 0) {
      this.emit('publish:no_subscribers', { topic, from: fromAgentId });
    }

    let delivered = 0, failed = 0;
    const t0 = Date.now();

    await Promise.all(subscribers.map(async ({ agentId, handler }) => {
      this._metrics.recordSend(fromAgentId);
      this._metrics.recordRecv(agentId);
      const ok = await this._bus.deliver(msg, handler);
      if (ok) {
        delivered++;
        this._metrics.recordLatency(agentId, Date.now() - t0);
        this._topology.updateLatency(fromAgentId, agentId, Date.now() - t0);
      } else {
        failed++;
        this._metrics.recordError(agentId);
      }
    }));

    this.emit('publish:complete', { topic, from: fromAgentId, delivered, failed });
    return { delivered, failed };
  }

  // -------------------------------------------------------------------------
  // Direct Messaging
  // -------------------------------------------------------------------------

  /**
   * Send a direct point-to-point message from one agent to another.
   * Uses the topology graph to find the shortest path; intermediate hops
   * are logged but not actually re-routed (reserved for future multi-hop relay).
   *
   * @param {string} fromAgentId
   * @param {string} toAgentId
   * @param {any}    payload
   * @param {object} [opts]
   * @param {number} [opts.ttl]
   * @returns {Promise<boolean>} true if delivered
   */
  async sendTo(fromAgentId, toAgentId, payload, opts = {}) {
    if (!this._agents.has(toAgentId)) {
      throw new Error(`AgentMesh.sendTo: unknown target agent "${toAgentId}"`);
    }

    const path = this._topology.shortestPath(fromAgentId, toAgentId);
    const msg = {
      id:      msgId(),
      from:    fromAgentId,
      to:      toAgentId,
      topic:   `direct.${toAgentId}`,
      payload,
      ts:      Date.now(),
      ttl:     opts.ttl,
      path,
    };

    // Route via direct topic subscription (agents can subscribe to 'direct.<id>')
    const subscribers = this._subscriptions.matching(`direct.${toAgentId}`);

    // Also try dispatching via registered dispatchFn if no subscription exists
    if (subscribers.length === 0) {
      const reg = this._agents.get(toAgentId);
      if (reg?.dispatchFn) {
        try {
          await reg.dispatchFn(msg);
          this._metrics.recordSend(fromAgentId);
          this._metrics.recordRecv(toAgentId);
          return true;
        } catch (err) {
          this._metrics.recordError(toAgentId);
          throw err;
        }
      }
      // No subscriber and no dispatchFn — emit warning
      this.emit('sendTo:no_handler', { from: fromAgentId, to: toAgentId });
      return false;
    }

    this._metrics.recordSend(fromAgentId);
    const t0 = Date.now();
    let ok = false;
    for (const { agentId, handler } of subscribers) {
      ok = await this._bus.deliver(msg, handler);
      this._metrics.recordRecv(agentId);
      if (ok) {
        this._metrics.recordLatency(agentId, Date.now() - t0);
        this._topology.updateLatency(fromAgentId, agentId, Date.now() - t0);
      } else {
        this._metrics.recordError(agentId);
      }
    }
    return ok;
  }

  // -------------------------------------------------------------------------
  // Broadcast
  // -------------------------------------------------------------------------

  /**
   * Fan-out a message to ALL registered agents except the sender.
   * Uses the 'mesh.broadcast' topic — agents interested in all system broadcasts
   * should subscribe to 'mesh.broadcast' or 'mesh.**'.
   *
   * @param {string} fromAgentId
   * @param {any}    payload
   * @param {object} [opts]
   * @param {number} [opts.ttl]
   * @param {string[]} [opts.exclude]  agent IDs to skip (default: [fromAgentId])
   * @returns {Promise<{ delivered: number, failed: number, agentCount: number }>}
   */
  async broadcast(fromAgentId, payload, opts = {}) {
    const exclude = new Set(opts.exclude || [fromAgentId]);
    const targets = [...this._agents.keys()].filter(id => !exclude.has(id));

    const msg = {
      id:      msgId(),
      from:    fromAgentId,
      topic:   'mesh.broadcast',
      payload,
      ts:      Date.now(),
      ttl:     opts.ttl,
      isBroadcast: true,
    };

    let delivered = 0, failed = 0;

    await Promise.all(targets.map(async (agentId) => {
      // Deliver to all subscribers on 'mesh.broadcast' that belong to this agent
      const subscribers = this._subscriptions
        .matching('mesh.broadcast')
        .filter(s => s.agentId === agentId);

      // Fallback: if no subscription but agent has a dispatchFn, use that
      if (subscribers.length === 0) {
        const reg = this._agents.get(agentId);
        if (reg?.dispatchFn) {
          try {
            await reg.dispatchFn({ ...msg, to: agentId });
            delivered++;
          } catch { failed++; }
        }
        return;
      }

      for (const { handler } of subscribers) {
        const ok = await this._bus.deliver({ ...msg, to: agentId }, handler);
        if (ok) delivered++; else failed++;
      }
    }));

    this.emit('broadcast:complete', { from: fromAgentId, delivered, failed, agentCount: targets.length });
    return { delivered, failed, agentCount: targets.length };
  }

  // -------------------------------------------------------------------------
  // Capability Routing
  // -------------------------------------------------------------------------

  /**
   * Route a message to the best agent for a given capability.
   * Uses fuzzy matching if no exact match is found.
   * Picks the agent with the lowest p50 latency among candidates.
   *
   * @param {string} fromAgentId
   * @param {string} capability
   * @param {any}    payload
   * @param {object} [opts]
   * @returns {Promise<{ agentId: string, delivered: boolean }>}
   */
  async routeByCapability(fromAgentId, capability, payload, opts = {}) {
    let candidates = this._capabilities.exactMatch(capability);

    if (candidates.length === 0) {
      const fuzzy = this._capabilities.fuzzyMatch(capability, 0.25);
      candidates = fuzzy.map(f => f.agentId);
    }

    if (candidates.length === 0) {
      this.emit('route:no_candidates', { capability, from: fromAgentId });
      return { agentId: null, delivered: false };
    }

    // Pick candidate with best (lowest) p50 latency; fall back to first if no data
    const best = candidates.reduce((chosen, id) => {
      const p50 = this._metrics.percentile(id, 50) ?? Infinity;
      const bestP50 = this._metrics.percentile(chosen, 50) ?? Infinity;
      return p50 < bestP50 ? id : chosen;
    });

    const delivered = await this.sendTo(fromAgentId, best, payload, opts);
    return { agentId: best, delivered };
  }

  // -------------------------------------------------------------------------
  // Introspection
  // -------------------------------------------------------------------------

  /**
   * Return the full mesh topology snapshot.
   * @returns {object}
   */
  getTopology() {
    return {
      topology:    this._topology.snapshot(),
      agents:      Object.fromEntries(
        [...this._agents.entries()].map(([id, reg]) => [id, {
          capabilities: reg.capabilities,
          registeredAt: reg.registeredAt,
          hasDispatchFn: !!reg.dispatchFn,
        }])
      ),
      metrics:     this._metrics.snapshot(),
      dlqSize:     this._bus._dlq.length,
      timestamp:   new Date().toISOString(),
    };
  }

  /**
   * List all agents that can handle a given capability.
   * @param {string} capability
   * @returns {{ exact: string[], fuzzy: { agentId: string, score: number }[] }}
   */
  findAgentsForCapability(capability) {
    return {
      exact: this._capabilities.exactMatch(capability),
      fuzzy: this._capabilities.fuzzyMatch(capability, 0.2),
    };
  }

  /**
   * Drain and return dead-lettered messages.
   * @returns {MeshMessage[]}
   */
  drainDlq() {
    return this._bus.drainDlq();
  }

  /**
   * Gracefully shut down the mesh (clears timers, listeners).
   */
  destroy() {
    this._bus.destroy();
    this.removeAllListeners();
  }
}

// ---------------------------------------------------------------------------
// Singleton export (backward-compatible pattern used across the codebase)
// ---------------------------------------------------------------------------

/** @type {AgentMesh} */
let _singleton = null;

/**
 * Return the global AgentMesh singleton, creating it if necessary.
 * @param {object} [opts]  only used on first call
 * @returns {AgentMesh}
 */
function getAgentMesh(opts) {
  if (!_singleton) _singleton = new AgentMesh(opts);
  return _singleton;
}

module.exports = {
  AgentMesh,
  TopologyGraph,
  CapabilityIndex,
  MessageBus,
  MeshMetrics,
  SubscriptionRegistry,
  KNOWN_AGENTS,
  DEFAULT_CAPABILITIES,
  getAgentMesh,
};
