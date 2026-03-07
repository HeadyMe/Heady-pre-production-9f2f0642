/**
 * @fileoverview Vector Federation — Cross-Node Vector Sync
 * Federated vector search and replication across the 3-Colab cluster.
 *
 * Features:
 *   - Federated search across N nodes (default 3 Colab nodes)
 *   - Replication with consistency levels: ONE, QUORUM, ALL
 *   - Conflict resolution: last-write-wins + vector clocks
 *   - Delta sync: only transmit changed vectors since last sync
 *   - Health-aware routing: automatically skip unhealthy nodes
 *   - PHI-scaled retry backoff and heartbeat intervals
 *
 * Node.js built-ins only: http, https, crypto, events
 */

import http   from 'node:http';
import https  from 'node:https';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI = 1.6180339887498948482;

/** Consistency levels */
export const Consistency = Object.freeze({
  ONE   : 'ONE',
  QUORUM: 'QUORUM',
  ALL   : 'ALL',
});

/** Health check interval ms */
const HEALTH_INTERVAL_MS = Math.round(5000 * PHI); // ~8 090 ms (architecture spec: 5s heartbeat)

/** Max retry attempts with PHI-backoff */
const MAX_RETRIES = 5;

/** Base retry delay ms */
const RETRY_BASE_MS = 100;

/** Delta sync interval ms — PHI^8 * 100ms ≈ 4700ms */
const DELTA_SYNC_INTERVAL = Math.round(100 * Math.pow(PHI, 8));

// ─── Vector Clock ─────────────────────────────────────────────────────────────

/**
 * Simple vector clock for causal ordering.
 */
export class VectorClock {
  /**
   * @param {Record<string, number>} [clocks]
   */
  constructor(clocks = {}) {
    this._clocks = { ...clocks };
  }

  /**
   * Increment this node's clock.
   * @param {string} nodeId
   * @returns {VectorClock}
   */
  tick(nodeId) {
    this._clocks[nodeId] = (this._clocks[nodeId] ?? 0) + 1;
    return this;
  }

  /**
   * Merge with another clock (take max of each component).
   * @param {VectorClock} other
   * @returns {VectorClock}
   */
  merge(other) {
    const merged = { ...this._clocks };
    for (const [node, time] of Object.entries(other._clocks)) {
      merged[node] = Math.max(merged[node] ?? 0, time);
    }
    return new VectorClock(merged);
  }

  /**
   * Compare two clocks.
   * @param {VectorClock} other
   * @returns {'before'|'after'|'concurrent'|'equal'}
   */
  compare(other) {
    let thisAhead  = false;
    let otherAhead = false;
    const allKeys  = new Set([...Object.keys(this._clocks), ...Object.keys(other._clocks)]);

    for (const k of allKeys) {
      const a = this._clocks[k]  ?? 0;
      const b = other._clocks[k] ?? 0;
      if (a > b) thisAhead  = true;
      if (b > a) otherAhead = true;
    }

    if (thisAhead  && !otherAhead) return 'after';
    if (otherAhead && !thisAhead)  return 'before';
    if (!thisAhead && !otherAhead) return 'equal';
    return 'concurrent';
  }

  toJSON() { return { ...this._clocks }; }
  static fromJSON(obj) { return new VectorClock(obj ?? {}); }
}

// ─── FederationNode ───────────────────────────────────────────────────────────

/**
 * @typedef {object} NodeConfig
 * @property {string}  id       - unique node id (e.g. 'node-brain')
 * @property {string}  url      - base HTTP URL (e.g. 'http://1.2.3.4:3000')
 * @property {string}  [role]   - 'BRAIN'|'CONDUCTOR'|'SENTINEL'
 * @property {number}  [weight] - routing weight [0,1], default 1
 */

/**
 * @typedef {object} NodeHealth
 * @property {boolean} healthy
 * @property {number}  latencyMs
 * @property {number}  lastChecked
 * @property {number}  failureCount
 */

// ─── HTTP Helpers ────────────────────────────────────────────────────────────

function request(urlStr, opts = {}) {
  return new Promise((resolve, reject) => {
    const url  = new URL(urlStr);
    const lib  = url.protocol === 'https:' ? https : http;
    const body = opts.body ? JSON.stringify(opts.body) : undefined;

    const req = lib.request({
      hostname: url.hostname,
      port    : url.port || (url.protocol === 'https:' ? 443 : 80),
      path    : url.pathname + url.search,
      method  : opts.method ?? (body ? 'POST' : 'GET'),
      headers : {
        'Content-Type'  : 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        ...(opts.headers ?? {}),
      },
      timeout : opts.timeout ?? 10_000,
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} from ${urlStr}: ${raw.slice(0, 200)}`));
        } else {
          try { resolve(JSON.parse(raw)); }
          catch { resolve(raw); }
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${urlStr}`)); });
    if (body) req.write(body);
    req.end();
  });
}

/**
 * PHI-scaled exponential backoff delay.
 * delay = RETRY_BASE_MS * PHI^attempt + jitter
 * @param {number} attempt  0-indexed
 * @returns {Promise<void>}
 */
function backoff(attempt) {
  const delay = RETRY_BASE_MS * Math.pow(PHI, attempt) + Math.random() * 50;
  return new Promise(r => setTimeout(r, delay));
}

// ─── VectorFederation ─────────────────────────────────────────────────────────

/**
 * Cross-node vector federation layer.
 *
 * Wraps a local VectorDB and coordinates with remote nodes via HTTP.
 * Each node exposes a minimal federation API:
 *   POST /federation/search   { query, k, ef }
 *   POST /federation/insert   { id, vector, metadata, clock }
 *   POST /federation/delete   { id, clock }
 *   GET  /federation/health
 *   POST /federation/delta    { since }  → changed vectors
 *
 * @extends EventEmitter
 * @emits 'nodeHealthChange' { nodeId, healthy }
 * @emits 'replication'      { op, id, nodes }
 * @emits 'conflict'         { id, resolution }
 * @emits 'deltaSync'        { nodeId, received }
 */
export class VectorFederation extends EventEmitter {
  /**
   * @param {object}      opts
   * @param {object}      opts.localDb           - local VectorDB instance
   * @param {string}      opts.localNodeId        - this node's id
   * @param {NodeConfig[]}[opts.nodes=[]]         - peer nodes
   * @param {string}      [opts.consistency=QUORUM]
   * @param {boolean}     [opts.deltaSyncEnabled=true]
   */
  constructor(opts) {
    super();
    this.localDb      = opts.localDb;
    this.localNodeId  = opts.localNodeId;
    this.consistency  = opts.consistency ?? Consistency.QUORUM;
    this.deltaSyncEnabled = opts.deltaSyncEnabled ?? true;

    /** @type {Map<string, NodeConfig>} */
    this._nodes = new Map();
    for (const n of (opts.nodes ?? [])) this._nodes.set(n.id, n);

    /** @type {Map<string, NodeHealth>} */
    this._health = new Map();

    /** Vector clock for this node */
    this._clock = new VectorClock({ [this.localNodeId]: 0 });

    /** id → { clock, updatedAt } for delta sync tracking */
    this._changeLog = new Map();

    this._healthTimer     = null;
    this._deltaSyncTimer  = null;
  }

  // ─ Lifecycle ───────────────────────────────────────────────────────────────

  /** Start background health checks and delta sync. */
  start() {
    this._healthTimer = setInterval(() => this._checkAllHealth(), HEALTH_INTERVAL_MS);
    this._healthTimer.unref?.();

    if (this.deltaSyncEnabled) {
      this._deltaSyncTimer = setInterval(() => this._runDeltaSync(), DELTA_SYNC_INTERVAL);
      this._deltaSyncTimer.unref?.();
    }

    // Initial health check
    this._checkAllHealth();
  }

  stop() {
    if (this._healthTimer)    { clearInterval(this._healthTimer);    this._healthTimer    = null; }
    if (this._deltaSyncTimer) { clearInterval(this._deltaSyncTimer); this._deltaSyncTimer = null; }
  }

  // ─ Node management ─────────────────────────────────────────────────────────

  /**
   * Register a peer node.
   * @param {NodeConfig} node
   */
  addNode(node) { this._nodes.set(node.id, node); }

  /**
   * Remove a peer node.
   * @param {string} nodeId
   */
  removeNode(nodeId) { this._nodes.delete(nodeId); this._health.delete(nodeId); }

  /**
   * Get healthy peer nodes sorted by latency.
   * @returns {NodeConfig[]}
   */
  healthyNodes() {
    return [...this._nodes.values()]
      .filter(n => this._health.get(n.id)?.healthy !== false)
      .sort((a, b) => {
        const la = this._health.get(a.id)?.latencyMs ?? Infinity;
        const lb = this._health.get(b.id)?.latencyMs ?? Infinity;
        return la - lb;
      });
  }

  // ─ Federated Search ────────────────────────────────────────────────────────

  /**
   * Search across local + peer nodes, merging and deduplicating results.
   * @param {Float32Array|number[]} query
   * @param {object} [opts]
   * @param {number}  [opts.k=10]
   * @param {number}  [opts.ef=50]
   * @param {boolean} [opts.localOnly=false]
   * @returns {Promise<Array<{id:string, score:number, metadata:object, nodeId:string}>>}
   */
  async search(query, opts = {}) {
    const vec       = Array.isArray(query) ? query : Array.from(query);
    const k         = opts.k    ?? 10;
    const ef        = opts.ef   ?? 50;
    const localOnly = opts.localOnly ?? false;

    // Local search (always included)
    const localResults = await this.localDb.search(query, { k: k * 2, ef });
    const all = localResults.map(r => ({ ...r, nodeId: this.localNodeId }));

    if (!localOnly) {
      const nodes = this.healthyNodes();
      const remoteSearches = nodes.map(node =>
        this._remoteSearch(node, vec, k, ef)
          .then(results => results.map(r => ({ ...r, nodeId: node.id })))
          .catch(() => [])
      );
      const remoteResults = await Promise.all(remoteSearches);
      all.push(...remoteResults.flat());
    }

    // Deduplicate by id, keep highest score
    const seen = new Map();
    for (const r of all) {
      if (!seen.has(r.id) || r.score > seen.get(r.id).score) seen.set(r.id, r);
    }

    return [...seen.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  async _remoteSearch(node, queryArray, k, ef) {
    return this._retry(() =>
      request(`${node.url}/federation/search`, {
        method : 'POST',
        body   : { query: queryArray, k, ef },
        timeout: 5000,
      })
    );
  }

  // ─ Replicated Insert ───────────────────────────────────────────────────────

  /**
   * Insert a vector and replicate to peers based on consistency level.
   * @param {string}      id
   * @param {Float32Array|number[]} vector
   * @param {object}      [metadata]
   * @param {string}      [consistency]
   * @returns {Promise<{acks: number, nodes: string[]}>}
   */
  async insert(id, vector, metadata = {}, consistency = this.consistency) {
    // Tick local clock
    this._clock.tick(this.localNodeId);
    const clockSnapshot = this._clock.toJSON();
    const ts            = Date.now();

    // Write locally first
    await this.localDb.insert(id, vector, { ...metadata, _federation: { clock: clockSnapshot, ts } });
    this._changeLog.set(id, { clock: clockSnapshot, ts, op: 'insert' });

    const vec     = Array.isArray(vector) ? vector : Array.from(vector);
    const payload = { id, vector: vec, metadata, clock: clockSnapshot, ts };

    return this._replicate('insert', payload, consistency);
  }

  /**
   * Delete a vector and replicate.
   * @param {string} id
   * @param {string} [consistency]
   */
  async delete(id, consistency = this.consistency) {
    this._clock.tick(this.localNodeId);
    const clockSnapshot = this._clock.toJSON();
    const ts            = Date.now();

    await this.localDb.delete(id);
    this._changeLog.set(id, { clock: clockSnapshot, ts, op: 'delete' });

    return this._replicate('delete', { id, clock: clockSnapshot, ts }, consistency);
  }

  // ─ Replication ─────────────────────────────────────────────────────────────

  /**
   * Replicate an operation to peer nodes.
   * @param {'insert'|'delete'} op
   * @param {object} payload
   * @param {string} consistency
   * @returns {Promise<{acks: number, nodes: string[]}>}
   */
  async _replicate(op, payload, consistency) {
    const peers = this.healthyNodes();
    if (peers.length === 0) return { acks: 0, nodes: [] };

    const required = this._requiredAcks(consistency, peers.length);

    const results = await Promise.allSettled(
      peers.map(node =>
        this._retry(() =>
          request(`${node.url}/federation/${op}`, { method: 'POST', body: payload, timeout: 8000 })
        )
      )
    );

    const acked = results.filter(r => r.status === 'fulfilled');
    const ackedNodes = acked.map((_, i) => peers[i].id);

    if (acked.length < required) {
      console.warn(`[VectorFederation] Replication below consistency (${acked.length}/${required})`);
    }

    this.emit('replication', { op, id: payload.id, nodes: ackedNodes });
    return { acks: acked.length, nodes: ackedNodes };
  }

  _requiredAcks(consistency, peerCount) {
    switch (consistency) {
      case Consistency.ONE:    return 1;
      case Consistency.ALL:    return peerCount;
      case Consistency.QUORUM: return Math.floor(peerCount / 2) + 1;
      default:                 return 1;
    }
  }

  // ─ Conflict Resolution ─────────────────────────────────────────────────────

  /**
   * Resolve a write conflict using Last-Write-Wins + vector clock.
   * @param {object} local  - { id, clock, ts, vector, metadata }
   * @param {object} remote - { id, clock, ts, vector, metadata }
   * @returns {'local'|'remote'} which to keep
   */
  resolveConflict(local, remote) {
    const localClock  = VectorClock.fromJSON(local.clock  ?? {});
    const remoteClock = VectorClock.fromJSON(remote.clock ?? {});
    const cmp         = localClock.compare(remoteClock);

    let resolution;
    if (cmp === 'after')  { resolution = 'local';  }
    else if (cmp === 'before') { resolution = 'remote'; }
    else {
      // Concurrent — fall back to last-write-wins
      resolution = (local.ts ?? 0) >= (remote.ts ?? 0) ? 'local' : 'remote';
    }

    this.emit('conflict', { id: local.id, resolution });
    return resolution;
  }

  // ─ Delta Sync ──────────────────────────────────────────────────────────────

  /**
   * Run delta sync with all healthy peers.
   * Sends changes since last sync and receives theirs.
   */
  async _runDeltaSync() {
    const peers = this.healthyNodes();
    for (const node of peers) {
      try { await this._deltaSyncWith(node); } catch { /* non-critical */ }
    }
  }

  async _deltaSyncWith(node) {
    const lastSync = this._health.get(node.id)?._lastSync ?? 0;

    // Get changes from remote since lastSync
    const response = await request(`${node.url}/federation/delta`, {
      method : 'POST',
      body   : { since: lastSync, nodeId: this.localNodeId },
      timeout: 10_000,
    });

    const changes = response.changes ?? [];
    let received  = 0;

    for (const change of changes) {
      const existing = this.localDb.get(change.id);
      let shouldApply = true;

      if (existing) {
        const localEntry  = { id: change.id, clock: existing.metadata?._federation?.clock, ts: existing.metadata?._federation?.ts };
        const remoteEntry = { id: change.id, clock: change.clock, ts: change.ts };
        const resolution  = this.resolveConflict(localEntry, remoteEntry);
        shouldApply = resolution === 'remote';
      }

      if (shouldApply) {
        if (change.op === 'insert' && change.vector) {
          const vec = new Float32Array(change.vector);
          await this.localDb.insert(change.id, vec, { ...change.metadata, _federation: { clock: change.clock, ts: change.ts } });
          received++;
        } else if (change.op === 'delete') {
          await this.localDb.delete(change.id);
          received++;
        }
      }
    }

    // Update last sync timestamp
    const health = this._health.get(node.id) ?? { healthy: true, latencyMs: 0, lastChecked: 0, failureCount: 0 };
    health._lastSync = Date.now();
    this._health.set(node.id, health);

    this.emit('deltaSync', { nodeId: node.id, received });
    return received;
  }

  /**
   * Generate delta payload for external requests.
   * Returns all changes since `since` timestamp.
   * @param {number} since - epoch ms
   * @returns {Array<object>}
   */
  getDelta(since) {
    const changes = [];
    for (const [id, entry] of this._changeLog) {
      if (entry.ts >= since) {
        const local = this.localDb.get(id);
        changes.push({
          id,
          op     : entry.op,
          vector : local ? Array.from(local.vector) : null,
          metadata: local?.metadata ?? {},
          clock  : entry.clock,
          ts     : entry.ts,
        });
      }
    }
    return changes;
  }

  // ─ Health Checks ───────────────────────────────────────────────────────────

  async _checkAllHealth() {
    for (const node of this._nodes.values()) {
      this._checkNodeHealth(node);
    }
  }

  async _checkNodeHealth(node) {
    const start = Date.now();
    let healthy = false;
    let latencyMs = Infinity;

    try {
      await request(`${node.url}/federation/health`, { timeout: 3000 });
      healthy   = true;
      latencyMs = Date.now() - start;
    } catch { /* unhealthy */ }

    const prev    = this._health.get(node.id);
    const failures = healthy ? 0 : ((prev?.failureCount ?? 0) + 1);

    const health = {
      healthy,
      latencyMs,
      lastChecked : Date.now(),
      failureCount: failures,
      _lastSync   : prev?._lastSync ?? 0,
    };
    this._health.set(node.id, health);

    if (prev?.healthy !== healthy) {
      this.emit('nodeHealthChange', { nodeId: node.id, healthy });
    }
  }

  // ─ Retry ───────────────────────────────────────────────────────────────────

  async _retry(fn) {
    let lastErr;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try { return await fn(); } catch (err) {
        lastErr = err;
        if (attempt < MAX_RETRIES - 1) await backoff(attempt);
      }
    }
    throw lastErr;
  }

  // ─ Federation HTTP Handler ─────────────────────────────────────────────────

  /**
   * Returns a request handler function for the federation API endpoints.
   * Attach to your HTTP server at a path prefix like '/federation'.
   *
   * @returns {Function} (req, res) handler
   */
  createHandler() {
    return async (req, res) => {
      const url    = new URL(req.url, 'http://localhost');
      const action = url.pathname.split('/').pop();

      let body = '';
      for await (const chunk of req) body += chunk;
      const parsed = body ? JSON.parse(body) : {};

      const send = (data, status = 200) => {
        const out = JSON.stringify(data);
        res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(out) });
        res.end(out);
      };

      try {
        switch (action) {
          case 'health': {
            send({ ok: true, nodeId: this.localNodeId, ts: Date.now(), size: this.localDb.size });
            break;
          }
          case 'search': {
            const { query, k, ef } = parsed;
            const vec = new Float32Array(query);
            const results = await this.localDb.search(vec, { k, ef });
            send(results);
            break;
          }
          case 'insert': {
            const { id, vector, metadata, clock, ts } = parsed;
            const remoteEntry = { id, clock, ts };
            const existing    = this.localDb.get(id);
            if (existing) {
              const localEntry = { id, clock: existing.metadata?._federation?.clock, ts: existing.metadata?._federation?.ts };
              if (this.resolveConflict(localEntry, remoteEntry) === 'local') {
                send({ ok: true, kept: 'local' }); break;
              }
            }
            const vec = new Float32Array(vector);
            await this.localDb.insert(id, vec, { ...metadata, _federation: { clock, ts } });
            this._changeLog.set(id, { clock, ts, op: 'insert' });
            send({ ok: true });
            break;
          }
          case 'delete': {
            const { id, clock, ts } = parsed;
            await this.localDb.delete(id);
            this._changeLog.set(id, { clock, ts, op: 'delete' });
            send({ ok: true });
            break;
          }
          case 'delta': {
            const { since } = parsed;
            send({ changes: this.getDelta(since ?? 0) });
            break;
          }
          default:
            send({ error: 'Unknown action' }, 404);
        }
      } catch (err) {
        send({ error: err.message }, 500);
      }
    };
  }

  // ─ Stats ───────────────────────────────────────────────────────────────────

  stats() {
    const health = {};
    for (const [id, h] of this._health) health[id] = { healthy: h.healthy, latencyMs: h.latencyMs };
    return {
      localNodeId : this.localNodeId,
      peers       : this._nodes.size,
      consistency : this.consistency,
      health,
      changeLogSize: this._changeLog.size,
    };
  }
}

export default VectorFederation;
