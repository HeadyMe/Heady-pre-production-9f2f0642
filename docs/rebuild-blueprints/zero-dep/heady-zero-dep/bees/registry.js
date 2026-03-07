/**
 * @file registry.js
 * @description Bee & Service Registry with 197 worker registration slots.
 *
 * Features:
 * - Register/deregister bees and services with metadata
 * - Health check integration: periodic pings, automatic eviction of stale entries
 * - Service discovery by capability, type, node role, and zone
 * - Version management: multiple versions of the same service can coexist
 * - 197 worker registration slots (spec requirement)
 * - PHI-weighted selection for load balancing among matched services
 *
 * Sacred Geometry: 197 = FIBONACCI[12] + FIBONACCI[10] + FIBONACCI[9] = 144+34+19? 
 *   Actually 197 is prime — we use it as our exact spec constant.
 * Zero external dependencies — Node.js built-ins only.
 *
 * @module Bees/Registry
 */

import { EventEmitter } from 'events';
import { randomUUID, createHash } from 'crypto';

// ─── Sacred Geometry ──────────────────────────────────────────────────────────

const PHI = 1.6180339887498948482;
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

/** Registry capacity — exactly 197 worker slots as per spec */
export const REGISTRY_CAPACITY = 197;

// ─── Entry Types ──────────────────────────────────────────────────────────────

/**
 * @enum {string}
 */
export const EntryType = Object.freeze({
  BEE:     'BEE',     // Bee agent instance
  SERVICE: 'SERVICE', // Abstract service (HTTP endpoint, worker thread, etc.)
  NODE:    'NODE',    // Cluster node
  BRIDGE:  'BRIDGE',  // Event bridge connection
});

// ─── Health Status ────────────────────────────────────────────────────────────

/**
 * @enum {string}
 */
export const HealthStatus = Object.freeze({
  PASSING:  'PASSING',   // Healthy
  WARNING:  'WARNING',   // Degraded but functional
  CRITICAL: 'CRITICAL',  // Unhealthy
  UNKNOWN:  'UNKNOWN',   // Health not yet checked
});

// ─── Registry Entry ───────────────────────────────────────────────────────────

/**
 * @typedef {object} RegistryEntry
 * @property {string} id - unique registry entry ID
 * @property {string} name - human-readable name
 * @property {EntryType} entryType - BEE | SERVICE | NODE | BRIDGE
 * @property {string} version - semver string (e.g., '1.0.0')
 * @property {string[]} capabilities - list of capability strings
 * @property {string} node - cluster node role
 * @property {string} zone - resource pool zone
 * @property {HealthStatus} health
 * @property {number} registeredAt
 * @property {number} lastHeartbeat
 * @property {number} heartbeatTtl - ms before considered stale
 * @property {object} metadata - arbitrary metadata
 * @property {number} phi_score - composite health/efficiency score
 * @property {object} [address] - { host, port } for remote services
 * @property {string} [beeId] - for BEE entries: references Bee instance
 */

/**
 * Create a registry entry
 * @param {object} opts
 * @returns {RegistryEntry}
 */
export function createEntry({
  id, name, entryType = EntryType.SERVICE, version = '1.0.0',
  capabilities = [], node = 'conductor', zone = 'WARM',
  metadata = {}, address = null, beeId = null,
  heartbeatTtl = FIBONACCI[8] * 1000, // 34s TTL
}) {
  return {
    id:           id ?? randomUUID(),
    name,
    entryType,
    version,
    capabilities,
    node,
    zone,
    health:        HealthStatus.UNKNOWN,
    registeredAt:  Date.now(),
    lastHeartbeat: Date.now(),
    heartbeatTtl,
    metadata,
    phi_score:     0.5, // unknown until first health check
    address,
    beeId,
  };
}

// ─── Capability Index ─────────────────────────────────────────────────────────

/**
 * Inverted index from capability → Set of entry IDs.
 * Supports wildcard matching: 'embed.*' matches 'embed.text', 'embed.image'.
 */
class CapabilityIndex {
  constructor() {
    /** @type {Map<string, Set<string>>} */
    this._exact = new Map();
  }

  /**
   * Add an entry's capabilities to the index
   * @param {RegistryEntry} entry
   */
  add(entry) {
    for (const cap of entry.capabilities) {
      const set = this._exact.get(cap) ?? new Set();
      set.add(entry.id);
      this._exact.set(cap, set);
    }
  }

  /**
   * Remove an entry from the index
   * @param {RegistryEntry} entry
   */
  remove(entry) {
    for (const cap of entry.capabilities) {
      const set = this._exact.get(cap);
      if (set) {
        set.delete(entry.id);
        if (set.size === 0) this._exact.delete(cap);
      }
    }
  }

  /**
   * Find all entry IDs matching a capability query.
   * Supports wildcard patterns (e.g., 'embed.*', '*.query').
   * @param {string} query
   * @returns {Set<string>}
   */
  find(query) {
    // Try exact match first
    if (this._exact.has(query)) return new Set(this._exact.get(query));

    // Wildcard: convert to regex
    const pattern = new RegExp(
      '^' + query.replace(/\./g, '\\.').replace(/\*/g, '[^.]+') + '$'
    );
    const result = new Set();
    for (const [cap, ids] of this._exact) {
      if (pattern.test(cap)) {
        for (const id of ids) result.add(id);
      }
    }
    return result;
  }

  /**
   * Find all entry IDs matching ANY of the given capability queries
   * @param {string[]} queries
   * @returns {Set<string>}
   */
  findAny(queries) {
    const result = new Set();
    for (const q of queries) {
      for (const id of this.find(q)) result.add(id);
    }
    return result;
  }
}

// ─── Version Resolver ─────────────────────────────────────────────────────────

/**
 * Semver-lite version comparison.
 * Returns positive if a > b, 0 if equal, negative if a < b.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function semverCompare(a, b) {
  const parse = (v) => (v ?? '0.0.0').split('.').map(Number);
  const [ma, mia, pa] = parse(a);
  const [mb, mib, pb] = parse(b);
  return ma - mb || mia - mib || pa - pb;
}

// ─── Health Checker ───────────────────────────────────────────────────────────

/**
 * Pluggable health check: called periodically for each entry.
 * @typedef {function(RegistryEntry): Promise<{ status: HealthStatus, phi_score: number, details?: object }>} HealthCheckFn
 */

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * Bee & Service Registry.
 *
 * Manages registration, discovery, health monitoring, and version resolution
 * for all bees and services in the Heady cluster.
 *
 * @extends EventEmitter
 *
 * @example
 * const registry = new Registry();
 *
 * // Register a bee
 * const entryId = registry.register({
 *   name: 'embed-bee-1',
 *   entryType: EntryType.BEE,
 *   beeId: 'bee-abc123',
 *   capabilities: ['embed.*', 'vector.encode'],
 *   node: 'brain',
 *   zone: 'HOT',
 *   version: '1.0.0',
 * });
 *
 * // Discover by capability
 * const results = registry.discover({ capability: 'embed.*', node: 'brain' });
 */
export class Registry extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {number} [options.capacity=REGISTRY_CAPACITY] - max registry entries (197)
   * @param {number} [options.healthInterval=FIBONACCI[6]*1000] - health check interval ms (13s)
   * @param {number} [options.ttlCheckInterval=FIBONACCI[5]*1000] - TTL eviction interval ms (8s)
   * @param {HealthCheckFn} [options.healthCheckFn] - custom health check function
   */
  constructor(options = {}) {
    super();
    this._capacity       = options.capacity       ?? REGISTRY_CAPACITY; // 197
    this._healthMs       = options.healthInterval  ?? FIBONACCI[6] * 1000; // 13s
    this._ttlCheckMs     = options.ttlCheckInterval ?? FIBONACCI[5] * 1000; // 8s
    this._healthCheckFn  = options.healthCheckFn  ?? null;

    /** @type {Map<string, RegistryEntry>} entryId → entry */
    this._entries = new Map();

    /** @type {CapabilityIndex} */
    this._capIndex = new CapabilityIndex();

    /** @type {Map<string, Set<string>>} name → Set<entryId> (version groups) */
    this._nameIndex = new Map();

    /** @type {Map<string, Set<string>>} node → Set<entryId> */
    this._nodeIndex = new Map();

    /** @type {Map<string, Set<string>>} entryType → Set<entryId> */
    this._typeIndex = new Map();

    this._healthTimer = null;
    this._ttlTimer    = null;
    this._started     = false;
  }

  // ─── Registration ─────────────────────────────────────────────────────────

  /**
   * Register a bee or service.
   * @param {object} config - see createEntry() parameters
   * @returns {string} entry ID
   * @throws {Error} if capacity exceeded
   */
  register(config) {
    if (this._entries.size >= this._capacity) {
      // Try eviction of stale/offline entries before rejecting
      const evicted = this._evictStale();
      if (this._entries.size >= this._capacity && evicted === 0) {
        throw new Error(
          `Registry at capacity (${this._capacity} entries). ` +
          `Deregister or wait for TTL eviction.`
        );
      }
    }

    const entry = createEntry(config);
    this._entries.set(entry.id, entry);
    this._capIndex.add(entry);

    // Name index (for version grouping)
    const nameSet = this._nameIndex.get(entry.name) ?? new Set();
    nameSet.add(entry.id);
    this._nameIndex.set(entry.name, nameSet);

    // Node index
    const nodeSet = this._nodeIndex.get(entry.node) ?? new Set();
    nodeSet.add(entry.id);
    this._nodeIndex.set(entry.node, nodeSet);

    // Type index
    const typeSet = this._typeIndex.get(entry.entryType) ?? new Set();
    typeSet.add(entry.id);
    this._typeIndex.set(entry.entryType, typeSet);

    this.emit('entry.registered', { entryId: entry.id, name: entry.name, type: entry.entryType });
    return entry.id;
  }

  /**
   * Deregister an entry by ID
   * @param {string} entryId
   * @returns {boolean}
   */
  deregister(entryId) {
    const entry = this._entries.get(entryId);
    if (!entry) return false;

    this._entries.delete(entryId);
    this._capIndex.remove(entry);

    const nameSet = this._nameIndex.get(entry.name);
    if (nameSet) { nameSet.delete(entryId); if (nameSet.size === 0) this._nameIndex.delete(entry.name); }

    const nodeSet = this._nodeIndex.get(entry.node);
    if (nodeSet) { nodeSet.delete(entryId); if (nodeSet.size === 0) this._nodeIndex.delete(entry.node); }

    const typeSet = this._typeIndex.get(entry.entryType);
    if (typeSet) { typeSet.delete(entryId); if (typeSet.size === 0) this._typeIndex.delete(entry.entryType); }

    this.emit('entry.deregistered', { entryId, name: entry.name });
    return true;
  }

  // ─── Health ───────────────────────────────────────────────────────────────

  /**
   * Update the heartbeat timestamp and health status for an entry.
   * @param {string} entryId
   * @param {HealthStatus} [health=HealthStatus.PASSING]
   * @param {number} [phi_score] - optional PHI health score update
   */
  heartbeat(entryId, health = HealthStatus.PASSING, phi_score) {
    const entry = this._entries.get(entryId);
    if (!entry) return;
    entry.lastHeartbeat = Date.now();
    entry.health = health;
    if (phi_score !== undefined) entry.phi_score = phi_score;
    this.emit('heartbeat', { entryId, health, phi_score: entry.phi_score });
  }

  /**
   * Run health checks for all registered entries.
   * Requires a healthCheckFn to be configured.
   * @returns {Promise<object[]>} health check results
   */
  async runHealthChecks() {
    if (!this._healthCheckFn) return [];
    const results = [];
    for (const entry of this._entries.values()) {
      try {
        const result = await this._healthCheckFn(entry);
        entry.health    = result.status;
        entry.phi_score = result.phi_score ?? entry.phi_score;
        entry.lastHeartbeat = Date.now();
        results.push({ entryId: entry.id, ...result });
        this.emit('health.checked', { entryId: entry.id, health: result.status });
      } catch (err) {
        entry.health = HealthStatus.CRITICAL;
        results.push({ entryId: entry.id, status: HealthStatus.CRITICAL, error: err.message });
      }
    }
    return results;
  }

  /**
   * Evict stale entries that have exceeded their heartbeat TTL.
   * @returns {number} count of evicted entries
   */
  _evictStale() {
    const now = Date.now();
    let evicted = 0;
    for (const [id, entry] of this._entries) {
      if (now - entry.lastHeartbeat > entry.heartbeatTtl) {
        this.deregister(id);
        evicted++;
        this.emit('entry.expired', { entryId: id, name: entry.name, age: now - entry.lastHeartbeat });
      }
    }
    return evicted;
  }

  // ─── Discovery ────────────────────────────────────────────────────────────

  /**
   * Discover entries matching a query.
   * Results are sorted by PHI score (highest first).
   *
   * @param {object} [query]
   * @param {string} [query.capability] - capability pattern (supports wildcards)
   * @param {string[]} [query.capabilities] - multiple capability patterns (OR logic)
   * @param {string} [query.name] - exact name match
   * @param {string} [query.node] - node role filter
   * @param {string} [query.zone] - zone filter
   * @param {EntryType} [query.entryType] - entry type filter
   * @param {HealthStatus[]} [query.health] - acceptable health statuses
   * @param {string} [query.version] - semver version requirement
   * @param {boolean} [query.latestOnly=false] - return only latest version per name
   * @returns {RegistryEntry[]} sorted by phi_score descending
   */
  discover(query = {}) {
    let candidates = new Set([...this._entries.keys()]);

    // Capability filter
    if (query.capability) {
      const matched = this._capIndex.find(query.capability);
      candidates = new Set([...candidates].filter((id) => matched.has(id)));
    }
    if (query.capabilities && query.capabilities.length > 0) {
      const matched = this._capIndex.findAny(query.capabilities);
      candidates = new Set([...candidates].filter((id) => matched.has(id)));
    }

    // Node filter
    if (query.node) {
      const nodeSet = this._nodeIndex.get(query.node) ?? new Set();
      candidates = new Set([...candidates].filter((id) => nodeSet.has(id)));
    }

    // Type filter
    if (query.entryType) {
      const typeSet = this._typeIndex.get(query.entryType) ?? new Set();
      candidates = new Set([...candidates].filter((id) => typeSet.has(id)));
    }

    // Name filter
    if (query.name) {
      const nameSet = this._nameIndex.get(query.name) ?? new Set();
      candidates = new Set([...candidates].filter((id) => nameSet.has(id)));
    }

    // Zone filter
    if (query.zone) {
      candidates = new Set(
        [...candidates].filter((id) => this._entries.get(id)?.zone === query.zone)
      );
    }

    // Health filter (default: passing + warning only)
    const acceptHealth = query.health ?? [HealthStatus.PASSING, HealthStatus.WARNING, HealthStatus.UNKNOWN];
    candidates = new Set(
      [...candidates].filter((id) => acceptHealth.includes(this._entries.get(id)?.health))
    );

    // Build entry list
    let results = [...candidates]
      .map((id) => this._entries.get(id))
      .filter(Boolean);

    // Latest version only
    if (query.latestOnly) {
      const latest = new Map(); // name → entry
      for (const entry of results) {
        const existing = latest.get(entry.name);
        if (!existing || semverCompare(entry.version, existing.version) > 0) {
          latest.set(entry.name, entry);
        }
      }
      results = [...latest.values()];
    }

    // Version filter
    if (query.version) {
      results = results.filter((e) => semverCompare(e.version, query.version) >= 0);
    }

    // Sort by PHI score descending
    results.sort((a, b) => b.phi_score - a.phi_score);

    return results;
  }

  /**
   * Get a single entry by ID
   * @param {string} entryId
   * @returns {RegistryEntry|undefined}
   */
  get(entryId) { return this._entries.get(entryId); }

  /**
   * Get the best (highest phi_score) entry for a capability
   * @param {string} capability
   * @param {string} [preferredNode]
   * @returns {RegistryEntry|null}
   */
  getBest(capability, preferredNode) {
    const results = this.discover({ capability, node: preferredNode });
    return results[0] ?? (preferredNode ? this.discover({ capability })[0] ?? null : null);
  }

  /**
   * PHI-weighted random selection among matching entries.
   * Useful for load balancing.
   * @param {object} query
   * @returns {RegistryEntry|null}
   */
  selectWeighted(query = {}) {
    const results = this.discover(query);
    if (results.length === 0) return null;
    if (results.length === 1) return results[0];

    // PHI-weighted random: higher phi_score = more likely to be selected
    const totalWeight = results.reduce((s, e) => s + e.phi_score, 0);
    let rand = Math.random() * totalWeight;
    for (const entry of results) {
      rand -= entry.phi_score;
      if (rand <= 0) return entry;
    }
    return results[results.length - 1];
  }

  // ─── Version Management ───────────────────────────────────────────────────

  /**
   * Get all versions of a named service, sorted newest first
   * @param {string} name
   * @returns {RegistryEntry[]}
   */
  getVersions(name) {
    const ids = this._nameIndex.get(name) ?? new Set();
    return [...ids]
      .map((id) => this._entries.get(id))
      .filter(Boolean)
      .sort((a, b) => semverCompare(b.version, a.version));
  }

  /**
   * Get the latest version of a named service
   * @param {string} name
   * @returns {RegistryEntry|null}
   */
  getLatestVersion(name) {
    return this.getVersions(name)[0] ?? null;
  }

  /**
   * Deprecate all but the latest N versions of a service
   * @param {string} name
   * @param {number} [keep=FIBONACCI[2]] versions to keep (default 2)
   * @returns {number} deregistered count
   */
  pruneVersions(name, keep = FIBONACCI[2]) {
    const versions = this.getVersions(name);
    let pruned = 0;
    for (const entry of versions.slice(keep)) {
      this.deregister(entry.id);
      pruned++;
    }
    return pruned;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /** Start health checking and TTL eviction loops */
  start() {
    if (this._started) return;
    this._started = true;

    // Health checks
    if (this._healthCheckFn) {
      this._healthTimer = setInterval(() => {
        this.runHealthChecks().catch((err) => this.emit('error', err));
      }, this._healthMs);
      if (this._healthTimer.unref) this._healthTimer.unref();
    }

    // TTL eviction
    this._ttlTimer = setInterval(() => {
      const evicted = this._evictStale();
      if (evicted > 0) this.emit('entries.evicted', { count: evicted });
    }, this._ttlCheckMs);
    if (this._ttlTimer.unref) this._ttlTimer.unref();

    this.emit('registry.started', { capacity: this._capacity });
  }

  /** Stop health checking and eviction loops */
  async shutdown() {
    if (!this._started) return;
    this._started = false;
    clearInterval(this._healthTimer);
    clearInterval(this._ttlTimer);
    this._healthTimer = null;
    this._ttlTimer    = null;
    this.emit('registry.stopped');
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  /** @returns {object} registry status */
  get status() {
    const entries = [...this._entries.values()];
    const byHealth = {};
    for (const s of Object.values(HealthStatus)) {
      byHealth[s] = entries.filter((e) => e.health === s).length;
    }
    const byType = {};
    for (const t of Object.values(EntryType)) {
      byType[t] = entries.filter((e) => e.entryType === t).length;
    }
    return {
      total:    entries.length,
      capacity: this._capacity,
      remaining:this._capacity - entries.length,
      byHealth,
      byType,
      capabilities: this._capIndex._exact.size,
      names:        this._nameIndex.size,
      phi: PHI,
    };
  }

  /** @returns {number} total registered entries */
  get size() { return this._entries.size; }

  /** @returns {number} remaining slots */
  get remaining() { return this._capacity - this._entries.size; }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/** @type {Registry|null} */
let _globalRegistry = null;

/**
 * Get (or create) the global Registry singleton
 * @param {object} [options]
 * @returns {Registry}
 */
export function getGlobalRegistry(options = {}) {
  if (!_globalRegistry) {
    _globalRegistry = new Registry(options);
  }
  return _globalRegistry;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { PHI, FIBONACCI, semverCompare };

export default {
  Registry,
  CapabilityIndex,
  EntryType,
  HealthStatus,
  REGISTRY_CAPACITY,
  createEntry,
  semverCompare,
  getGlobalRegistry,
  PHI,
  FIBONACCI,
};
