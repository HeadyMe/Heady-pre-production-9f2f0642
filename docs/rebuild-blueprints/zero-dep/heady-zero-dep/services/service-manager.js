/**
 * @file service-manager.js
 * @description Service lifecycle manager with dependency graph, health scheduling,
 * service discovery, and configuration hot-reload.
 *
 * Features:
 * - Start/stop/restart individual services or groups
 * - Topological sort for dependency-ordered startup/shutdown
 * - Scheduled health checks with PHI-scaled intervals
 * - Service discovery by name, tag, or status
 * - Configuration hot-reload via file watch or explicit signal
 * - Graceful shutdown with PHI-scaled drain periods
 *
 * Zero external dependencies — events, fs, path, crypto, child_process (Node built-ins).
 * Sacred Geometry: PHI-scaled health intervals, Fibonacci timeouts.
 *
 * @module HeadyServices/ServiceManager
 */

import { EventEmitter }              from 'events';
import { existsSync, readFileSync,
         watchFile, unwatchFile }    from 'fs';
import { resolve }                   from 'path';
import { randomUUID }                from 'crypto';

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
const PHI      = 1.6180339887498948482;
const PHI_INV  = 1 / PHI;
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];

const phiDelay = (n, base = 1_000) => Math.round(base * Math.pow(PHI, n));

// ─── Service States ───────────────────────────────────────────────────────────
export const ServiceState = Object.freeze({
  REGISTERED: 'REGISTERED',
  STARTING:   'STARTING',
  RUNNING:    'RUNNING',
  STOPPING:   'STOPPING',
  STOPPED:    'STOPPED',
  FAILED:     'FAILED',
  RESTARTING: 'RESTARTING',
  DEGRADED:   'DEGRADED',
});

// ─── Service Definition ───────────────────────────────────────────────────────
/**
 * @typedef {object} ServiceDef
 * @property {string}   name           Unique name
 * @property {string[]} [deps]         Names of services that must start before this
 * @property {string[]} [tags]         Discovery tags
 * @property {Function} start          async () → void
 * @property {Function} stop           async () → void
 * @property {Function} [health]       async () → { healthy, detail }
 * @property {Function} [reload]       async (config) → void  — hot-reload handler
 * @property {number}   [healthIntervalMs]
 * @property {object}   [config]       Initial config blob
 */

// ─── Dependency Graph ─────────────────────────────────────────────────────────
class DependencyGraph {
  constructor() {
    this._graph = new Map();  // name → Set<name>  (name depends on these)
  }

  add(name, deps = []) {
    if (!this._graph.has(name)) this._graph.set(name, new Set());
    for (const d of deps) this._graph.get(name).add(d);
  }

  remove(name) {
    this._graph.delete(name);
    for (const deps of this._graph.values()) deps.delete(name);
  }

  /** Topological sort (Kahn's algorithm). Returns ordered array. */
  topologicalSort() {
    const inDegree = new Map();
    const nodes    = [...this._graph.keys()];

    // Initialize in-degrees
    for (const n of nodes) inDegree.set(n, 0);
    for (const [, deps] of this._graph) {
      for (const d of deps) {
        if (inDegree.has(d)) inDegree.set(d, (inDegree.get(d) ?? 0) + 1);
      }
    }
    // Nodes not in graph (deps that haven't been registered)
    for (const [, deps] of this._graph) {
      for (const d of deps) {
        if (!inDegree.has(d)) inDegree.set(d, 0);
      }
    }

    const queue  = [...inDegree.entries()].filter(([, v]) => v === 0).map(([k]) => k);
    const result = [];

    while (queue.length) {
      const n = queue.shift();
      result.push(n);

      for (const [node, deps] of this._graph) {
        if (deps.has(n)) {
          const deg = (inDegree.get(node) ?? 1) - 1;
          inDegree.set(node, deg);
          if (deg === 0) queue.push(node);
        }
      }
    }

    if (result.length !== inDegree.size) {
      throw new Error('DependencyGraph: circular dependency detected');
    }

    return result;
  }

  /** Reverse topological order (for shutdown) */
  reverseOrder() {
    return [...this.topologicalSort()].reverse();
  }

  dependents(name) {
    return [...this._graph.entries()]
      .filter(([, deps]) => deps.has(name))
      .map(([n]) => n);
  }
}

// ─── Service Instance ─────────────────────────────────────────────────────────
class ServiceInstance {
  constructor(def) {
    this.id           = randomUUID();
    this.name         = def.name;
    this.deps         = def.deps ?? [];
    this.tags         = new Set(def.tags ?? []);
    this._start       = def.start;
    this._stop        = def.stop;
    this._health      = def.health ?? null;
    this._reload      = def.reload ?? null;
    this.config       = def.config ?? {};
    this.healthIntervalMs = def.healthIntervalMs ?? Math.round(1000 * PHI * PHI * PHI * PHI); // ~11s

    this.state       = ServiceState.REGISTERED;
    this.startedAt   = null;
    this.stoppedAt   = null;
    this.lastHealthAt = null;
    this.healthy     = null;
    this.healthDetail = null;
    this.errors      = [];
    this.restarts    = 0;
    this._healthTimer = null;
  }

  addError(err) {
    this.errors.push({ ts: new Date().toISOString(), message: err.message ?? String(err) });
    if (this.errors.length > 13) this.errors.shift();
  }

  toJSON() {
    return {
      id:            this.id,
      name:          this.name,
      state:         this.state,
      deps:          this.deps,
      tags:          [...this.tags],
      healthy:       this.healthy,
      healthDetail:  this.healthDetail,
      startedAt:     this.startedAt,
      stoppedAt:     this.stoppedAt,
      lastHealthAt:  this.lastHealthAt,
      restarts:      this.restarts,
      errors:        this.errors,
    };
  }
}

// ─── ServiceManager ───────────────────────────────────────────────────────────
export class ServiceManager extends EventEmitter {
  /**
   * @param {object} opts
   * @param {string}  [opts.configPath]      JSON config file to watch for hot-reload
   * @param {number}  [opts.shutdownTimeout] Graceful shutdown drain ms (default PHI^4 * 1s)
   */
  constructor(opts = {}) {
    super();
    this._services    = new Map();   // name → ServiceInstance
    this._depGraph    = new DependencyGraph();
    this._configPath  = opts.configPath ?? null;
    this._config      = {};
    this._shutdownTimeout = opts.shutdownTimeout ?? Math.round(1000 * Math.pow(PHI, 4)); // ~11s
    this._watchUnsubscribe = null;

    if (this._configPath) this._watchConfig();
  }

  // ─── Registration ─────────────────────────────────────────────────────

  /**
   * Register a service definition.
   * @param {ServiceDef} def
   * @returns {ServiceInstance}
   */
  register(def) {
    if (!def.name)    throw new Error('ServiceManager: service must have a name');
    if (!def.start)   throw new Error(`ServiceManager: ${def.name} must have a start() function`);
    if (!def.stop)    throw new Error(`ServiceManager: ${def.name} must have a stop() function`);

    if (this._services.has(def.name)) {
      throw new Error(`ServiceManager: service '${def.name}' already registered`);
    }

    const svc = new ServiceInstance(def);
    this._services.set(def.name, svc);
    this._depGraph.add(def.name, def.deps ?? []);

    this.emit('registered', svc.toJSON());
    return svc;
  }

  deregister(name) {
    const svc = this._services.get(name);
    if (!svc) return;
    svc._healthTimer && clearInterval(svc._healthTimer);
    this._services.delete(name);
    this._depGraph.remove(name);
    this.emit('deregistered', { name });
  }

  // ─── Start ────────────────────────────────────────────────────────────

  /**
   * Start a service (and its dependencies in order).
   * @param {string} name
   */
  async start(name) {
    const svc = this._services.get(name);
    if (!svc) throw new Error(`ServiceManager: unknown service '${name}'`);
    if ([ServiceState.RUNNING, ServiceState.STARTING].includes(svc.state)) return;

    // Start deps first
    for (const dep of svc.deps) {
      const depSvc = this._services.get(dep);
      if (depSvc && depSvc.state !== ServiceState.RUNNING) {
        await this.start(dep);
      }
    }

    svc.state = ServiceState.STARTING;
    this.emit('starting', svc.toJSON());

    try {
      await svc._start(svc.config);
      svc.state     = ServiceState.RUNNING;
      svc.startedAt = new Date().toISOString();
      svc.healthy   = true;
      this._scheduleHealthChecks(svc);
      this.emit('started', svc.toJSON());
    } catch (err) {
      svc.state = ServiceState.FAILED;
      svc.addError(err);
      this.emit('startFailed', { name, error: err.message });
      throw err;
    }
  }

  /**
   * Start all registered services in dependency order.
   */
  async startAll() {
    let order;
    try { order = this._depGraph.topologicalSort(); }
    catch (e) { throw Object.assign(e, { code: 'CIRCULAR_DEPENDENCY' }); }

    for (const name of order) {
      const svc = this._services.get(name);
      if (!svc || svc.state === ServiceState.RUNNING) continue;
      await this.start(name);
    }
  }

  // ─── Stop ─────────────────────────────────────────────────────────────

  async stop(name) {
    const svc = this._services.get(name);
    if (!svc || svc.state === ServiceState.STOPPED) return;

    // Stop dependents first (reverse dep order)
    const dependents = this._depGraph.dependents(name);
    for (const dep of dependents) {
      const depSvc = this._services.get(dep);
      if (depSvc && depSvc.state === ServiceState.RUNNING) {
        await this.stop(dep);
      }
    }

    svc.state = ServiceState.STOPPING;
    this.emit('stopping', svc.toJSON());

    // Cancel health timer
    if (svc._healthTimer) { clearInterval(svc._healthTimer); svc._healthTimer = null; }

    // Drain period
    await this._sleep(Math.round(this._shutdownTimeout * PHI_INV));

    try {
      await svc._stop();
      svc.state    = ServiceState.STOPPED;
      svc.stoppedAt = new Date().toISOString();
      this.emit('stopped', svc.toJSON());
    } catch (err) {
      svc.state = ServiceState.FAILED;
      svc.addError(err);
      this.emit('stopFailed', { name, error: err.message });
    }
  }

  /**
   * Stop all services in reverse dependency order.
   */
  async stopAll() {
    const order = this._depGraph.reverseOrder();
    for (const name of order) {
      const svc = this._services.get(name);
      if (svc && svc.state === ServiceState.RUNNING) {
        await this.stop(name);
      }
    }
    if (this._watchUnsubscribe) this._watchUnsubscribe();
  }

  // ─── Restart ──────────────────────────────────────────────────────────

  async restart(name) {
    const svc = this._services.get(name);
    if (!svc) throw new Error(`Unknown service: ${name}`);

    svc.state    = ServiceState.RESTARTING;
    svc.restarts += 1;
    this.emit('restarting', { name, restarts: svc.restarts });

    await this.stop(name);
    // PHI-scaled restart delay based on restart count
    await this._sleep(phiDelay(Math.min(svc.restarts - 1, 8)));
    await this.start(name);
  }

  // ─── Health Checks ────────────────────────────────────────────────────

  _scheduleHealthChecks(svc) {
    if (!svc._health || svc._healthTimer) return;

    const check = async () => {
      try {
        const result = await svc._health();
        svc.healthy      = result.healthy;
        svc.healthDetail = result.detail ?? null;
        svc.lastHealthAt = new Date().toISOString();

        if (!result.healthy && svc.state === ServiceState.RUNNING) {
          svc.state = ServiceState.DEGRADED;
          this.emit('degraded', { name: svc.name, detail: svc.healthDetail });
        } else if (result.healthy && svc.state === ServiceState.DEGRADED) {
          svc.state = ServiceState.RUNNING;
          this.emit('recovered', svc.toJSON());
        }
      } catch (err) {
        svc.healthy = false;
        svc.addError(err);
      }
    };

    // Initial check after PHI-scaled offset
    const offset = Math.round(svc.healthIntervalMs * PHI_INV);
    setTimeout(check, offset);

    svc._healthTimer = setInterval(check, svc.healthIntervalMs);
    if (svc._healthTimer.unref) svc._healthTimer.unref();
  }

  // ─── Discovery ────────────────────────────────────────────────────────

  /**
   * Discover services matching query.
   * @param {object} query  { name, tag, state, healthy }
   * @returns {ServiceInstance[]}
   */
  discover(query = {}) {
    let svcs = [...this._services.values()];
    if (query.name)    svcs = svcs.filter(s => s.name.includes(query.name));
    if (query.tag)     svcs = svcs.filter(s => s.tags.has(query.tag));
    if (query.state)   svcs = svcs.filter(s => s.state === query.state);
    if (query.healthy !== undefined) svcs = svcs.filter(s => s.healthy === query.healthy);
    return svcs;
  }

  get(name) { return this._services.get(name) ?? null; }

  // ─── Config hot-reload ────────────────────────────────────────────────

  _watchConfig() {
    if (!existsSync(this._configPath)) return;

    const doReload = () => {
      try {
        const raw = readFileSync(this._configPath, 'utf8');
        const newConfig = JSON.parse(raw);
        this._config = newConfig;
        this.emit('configChanged', { path: this._configPath });
        this._reloadServices(newConfig);
      } catch (e) {
        this.emit('configReloadFailed', { error: e.message });
      }
    };

    watchFile(this._configPath, { interval: Math.round(1000 * PHI * PHI) }, doReload);
    this._watchUnsubscribe = () => unwatchFile(this._configPath);
    doReload();  // Load initial config
  }

  async _reloadServices(config) {
    for (const svc of this._services.values()) {
      if (svc._reload && svc.state === ServiceState.RUNNING) {
        try {
          await svc._reload(config[svc.name] ?? config);
          this.emit('reloaded', { name: svc.name });
        } catch (e) {
          this.emit('reloadFailed', { name: svc.name, error: e.message });
        }
      }
    }
  }

  /**
   * Trigger a hot-reload manually (e.g., on SIGHUP).
   * @param {object} [config]  New config; defaults to re-reading configPath
   */
  async reload(config) {
    const cfg = config ?? (this._configPath ? JSON.parse(readFileSync(this._configPath, 'utf8')) : {});
    this._config = cfg;
    await this._reloadServices(cfg);
    this.emit('manualReload', { ts: new Date().toISOString() });
  }

  // ─── Status ───────────────────────────────────────────────────────────

  status() {
    const svcs = [...this._services.values()];
    return {
      ts:       new Date().toISOString(),
      total:    svcs.length,
      running:  svcs.filter(s => s.state === ServiceState.RUNNING).length,
      failed:   svcs.filter(s => s.state === ServiceState.FAILED).length,
      stopped:  svcs.filter(s => s.state === ServiceState.STOPPED).length,
      services: svcs.map(s => s.toJSON()),
    };
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
let _manager = null;

export function getServiceManager(opts = {}) {
  if (!_manager) _manager = new ServiceManager(opts);
  return _manager;
}

export default ServiceManager;
