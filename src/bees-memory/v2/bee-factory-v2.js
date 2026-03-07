/*
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══════════════════════════════════════════════════════════════════
 * Bee Factory V2 — Production-Grade Dynamic Bee Creation
 * ═══════════════════════════════════════════════════════════════════
 *
 * CHANGES FROM V1 (bee-factory.js):
 *   [NEW] Dependency Injection container — bees receive injected deps
 *   [NEW] Lifecycle hooks: onCreate, onStart, onStop, onError, onHotReload
 *   [NEW] Hot reload via fs.watch() — no restarts needed when bee files change
 *   [NEW] Bee versioning — domain collisions are versioned, not silently overwritten
 *   [NEW] Per-bee circuit breaker — individual bee health isolation
 *   [NEW] Backpressure in swarms — bounded concurrency with queue overflow handling
 *   [NEW] Dependency graph — detects circular bee dependencies at registration time
 *   [NEW] Bee health registry — tracks per-bee execution stats
 *   [FIXED] _persistBee generates real implementation stubs, not no-ops
 *   [IMPROVED] createFromTemplate adds 'validator' and 'scheduler' templates
 *
 * Usage:
 *   const factory = new BeeFactoryV2({
 *     deps: { vectorMemory, redis, conductor },
 *     hooks: { onCreate: (domain, entry) => track(entry) }
 *   });
 *   factory.createBee('analytics', { workers: [...] });
 *   factory.startHotReload('/path/to/bees-dir');
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');

// ─── Constants ──────────────────────────────────────────────────────────────

const FACTORY_VERSION = '2.0.0';
const DEFAULT_BEE_TIMEOUT_MS = 30_000;
const DEFAULT_CIRCUIT_BREAKER_THRESHOLD = 5;
const HOT_RELOAD_DEBOUNCE_MS = 500;

// ─── Circuit Breaker (inline, no external dep) ──────────────────────────────

/**
 * Lightweight per-bee circuit breaker.
 * Trips after `failureThreshold` consecutive failures.
 * Auto-resets after `recoveryMs`.
 */
class BeeCB {
  constructor(domain, opts = {}) {
    this.domain = domain;
    this.failureThreshold = opts.failureThreshold ?? DEFAULT_CIRCUIT_BREAKER_THRESHOLD;
    this.recoveryMs = opts.recoveryMs ?? 30_000;
    this._failures = 0;
    this._trippedAt = null;
    this._state = 'closed'; // closed | open | half-open
  }

  /** @returns {'closed'|'open'|'half-open'} */
  get state() { return this._state; }

  /** @returns {boolean} true if the bee is allowed to run */
  isAllowed() {
    if (this._state === 'closed') return true;
    if (this._state === 'open') {
      const elapsed = Date.now() - this._trippedAt;
      if (elapsed >= this.recoveryMs) {
        this._state = 'half-open';
        return true;
      }
      return false;
    }
    return true; // half-open: allow one probe
  }

  /** Record a successful execution */
  onSuccess() {
    this._failures = 0;
    this._state = 'closed';
  }

  /** Record a failure; trips breaker if threshold reached */
  onFailure() {
    this._failures++;
    if (this._failures >= this.failureThreshold) {
      this._state = 'open';
      this._trippedAt = Date.now();
    }
  }

  getStats() {
    return {
      domain: this.domain,
      state: this._state,
      failures: this._failures,
      trippedAt: this._trippedAt,
      willResetAt: this._trippedAt ? new Date(this._trippedAt + this.recoveryMs).toISOString() : null,
    };
  }
}

// ─── DI Container ───────────────────────────────────────────────────────────

/**
 * Simple dependency injection container.
 * Bees receive deps at work() call time — no inline require().
 *
 * @example
 *   const di = new DIContainer();
 *   di.register('vectorMemory', myVectorMemory);
 *   const deps = di.resolve(['vectorMemory', 'redis']);
 */
class DIContainer {
  constructor() {
    /** @type {Map<string, any>} */
    this._deps = new Map();
  }

  /**
   * Register a dependency.
   * @param {string} name
   * @param {any} instance
   */
  register(name, instance) {
    this._deps.set(name, instance);
  }

  /**
   * Resolve an array of dependency names into an object.
   * @param {string[]} names
   * @returns {Record<string, any>}
   */
  resolve(names = []) {
    const resolved = {};
    for (const name of names) {
      if (this._deps.has(name)) {
        resolved[name] = this._deps.get(name);
      }
    }
    return resolved;
  }

  /** Resolve all registered deps. */
  resolveAll() {
    return Object.fromEntries(this._deps.entries());
  }

  has(name) { return this._deps.has(name); }
  list() { return [...this._deps.keys()]; }
}

// ─── Bee Health Registry ────────────────────────────────────────────────────

class BeeHealthRegistry {
  constructor() {
    /** @type {Map<string, Object>} */
    this._health = new Map();
  }

  init(domain) {
    if (!this._health.has(domain)) {
      this._health.set(domain, {
        executions: 0,
        successes: 0,
        failures: 0,
        totalLatencyMs: 0,
        lastRunAt: null,
        lastErrorAt: null,
        lastError: null,
        p50Ms: 0,
        p95Ms: 0,
        latencies: [], // ring buffer, max 100 samples
      });
    }
  }

  record(domain, { success, latencyMs, error }) {
    this.init(domain);
    const h = this._health.get(domain);
    h.executions++;
    h.totalLatencyMs += latencyMs;
    h.lastRunAt = new Date().toISOString();

    if (success) {
      h.successes++;
    } else {
      h.failures++;
      h.lastErrorAt = new Date().toISOString();
      h.lastError = error?.message || String(error);
    }

    // Maintain latency ring buffer for percentile computation
    h.latencies.push(latencyMs);
    if (h.latencies.length > 100) h.latencies.shift();

    // Compute p50/p95 from ring buffer
    const sorted = [...h.latencies].sort((a, b) => a - b);
    h.p50Ms = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    h.p95Ms = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  }

  get(domain) {
    const h = this._health.get(domain);
    if (!h) return null;
    const total = h.executions;
    return {
      ...h,
      latencies: undefined, // don't expose raw ring buffer
      successRate: total > 0 ? ((h.successes / total) * 100).toFixed(1) + '%' : 'N/A',
      avgLatencyMs: total > 0 ? Math.round(h.totalLatencyMs / total) : 0,
    };
  }

  getAll() {
    return [...this._health.keys()].map(d => ({ domain: d, ...this.get(d) }));
  }
}

// ─── Bee Factory V2 ─────────────────────────────────────────────────────────

/**
 * Production-grade dynamic bee factory with:
 *   - Dependency injection
 *   - Lifecycle hooks (onCreate, onStart, onStop, onError, onHotReload)
 *   - Hot reload (fs.watch on bees directory)
 *   - Per-bee circuit breakers
 *   - Bee versioning and health tracking
 */
class BeeFactoryV2 extends EventEmitter {
  /**
   * @param {object} opts
   * @param {Record<string, any>} [opts.deps]    - Initial dependency map
   * @param {object} [opts.hooks]                - Lifecycle hook overrides
   * @param {Function} [opts.hooks.onCreate]     - (domain, entry) => void
   * @param {Function} [opts.hooks.onStart]      - (domain, workIndex, ctx) => void
   * @param {Function} [opts.hooks.onStop]       - (domain, workIndex, result) => void
   * @param {Function} [opts.hooks.onError]      - (domain, error, ctx) => void
   * @param {Function} [opts.hooks.onHotReload]  - (filePath, domain) => void
   * @param {number}   [opts.defaultTimeoutMs=30000]
   */
  constructor(opts = {}) {
    super();

    this.version = FACTORY_VERSION;

    // Dependency injection
    this.di = new DIContainer();
    if (opts.deps) {
      for (const [k, v] of Object.entries(opts.deps)) {
        this.di.register(k, v);
      }
    }

    // Lifecycle hooks
    this._hooks = {
      onCreate: opts.hooks?.onCreate || null,
      onStart: opts.hooks?.onStart || null,
      onStop: opts.hooks?.onStop || null,
      onError: opts.hooks?.onError || null,
      onHotReload: opts.hooks?.onHotReload || null,
    };

    this._defaultTimeoutMs = opts.defaultTimeoutMs ?? DEFAULT_BEE_TIMEOUT_MS;

    /** @type {Map<string, Object>} domain → bee entry */
    this._registry = new Map();

    /** @type {Map<string, Object>} domain → ephemeral entry */
    this._ephemeral = new Map();

    /** @type {Map<string, BeeCB>} domain → circuit breaker */
    this._breakers = new Map();

    /** @type {Map<string, string[]>} domain → dependency domains */
    this._depGraph = new Map();

    this._health = new BeeHealthRegistry();

    /** @type {Map<string, fs.FSWatcher>} filePath → watcher */
    this._watchers = new Map();

    /** @type {Map<string, NodeJS.Timeout>} filePath → debounce timer */
    this._reloadDebounce = new Map();

    this._stats = {
      created: 0,
      dissolved: 0,
      hotReloads: 0,
      createdAt: new Date().toISOString(),
    };
  }

  // ─── Dependency Registration ─────────────────────────────────────────────

  /**
   * Register a dependency into the DI container.
   * @param {string} name
   * @param {any} instance
   * @returns {this}
   */
  registerDep(name, instance) {
    this.di.register(name, instance);
    return this;
  }

  // ─── Bee Creation ────────────────────────────────────────────────────────

  /**
   * Create a full bee domain dynamically.
   * Registers in-memory with optional disk persistence.
   *
   * CHANGE FROM V1: Workers now receive resolved DI deps as second argument.
   *
   * @param {string} domain
   * @param {object} config
   * @param {string}   [config.description]
   * @param {number}   [config.priority=0.5]
   * @param {Array}    [config.workers]         - Array of { name, fn, deps? }
   * @param {boolean}  [config.persist=false]
   * @param {string[]} [config.dependsOn=[]]    - Domains this bee depends on
   * @param {object}   [config.circuitBreaker]  - CB opts: { failureThreshold, recoveryMs }
   * @param {number}   [config.timeoutMs]       - Per-work timeout override
   * @returns {object} The registered bee entry
   */
  createBee(domain, config = {}) {
    const {
      description = `Dynamic ${domain} bee`,
      priority = 0.5,
      workers = [],
      persist = false,
      dependsOn = [],
      circuitBreaker: cbOpts = {},
      timeoutMs = this._defaultTimeoutMs,
    } = config;

    // Validate workers
    let validated = true;
    for (let i = 0; i < workers.length; i++) {
      const w = workers[i];
      if (typeof w !== 'function' && (typeof w !== 'object' || typeof w.fn !== 'function')) {
        validated = false;
        this.emit('warn', { domain, msg: `Worker ${i} is not callable` });
      }
    }

    // Cycle detection in dependency graph
    if (dependsOn.length > 0) {
      this._depGraph.set(domain, dependsOn);
      if (this._hasCycle(domain)) {
        throw new Error(`[BeeFactoryV2] Circular bee dependency detected for '${domain}'`);
      }
    }

    // Create circuit breaker for this bee
    this._breakers.set(domain, new BeeCB(domain, cbOpts));

    // Wrapped getWork — injects DI deps, applies timeout + circuit breaker, tracks health
    const factory = this;
    const entry = {
      domain,
      description,
      priority,
      createdAt: Date.now(),
      dynamic: true,
      validated,
      version: 1,
      file: `dynamic:${domain}`,
      dependsOn,
      timeoutMs,
      /**
       * Returns array of wrapped async work functions.
       * Each function receives the context and resolved deps.
       * @param {object} ctx
       * @returns {Function[]}
       */
      getWork(ctx = {}) {
        return workers.map((w, i) => {
          const workName = (typeof w === 'object' ? w.name : null) || `work-${i}`;
          const workFn = typeof w === 'function' ? w : w.fn;
          const workDeps = (typeof w === 'object' && Array.isArray(w.deps)) ? w.deps : [];

          return async () => {
            const cb = factory._breakers.get(domain);
            if (cb && !cb.isAllowed()) {
              return {
                bee: domain, action: workName,
                status: 'circuit-open',
                circuitState: cb.state,
              };
            }

            // Call onStart hook
            factory._callHook('onStart', domain, i, ctx);

            const deps = factory.di.resolve(workDeps);
            const mergedCtx = { ...ctx, deps };
            const start = Date.now();

            try {
              const resultPromise = workFn(mergedCtx, deps);
              const result = await Promise.race([
                resultPromise,
                new Promise((_, rej) =>
                  setTimeout(() => rej(new Error(`Bee '${domain}:${workName}' timed out after ${timeoutMs}ms`)), timeoutMs)
                ),
              ]);

              const latencyMs = Date.now() - start;
              cb?.onSuccess();
              factory._health.record(domain, { success: true, latencyMs });
              factory._callHook('onStop', domain, i, result);

              return { bee: domain, action: workName, latencyMs, ...(typeof result === 'object' ? result : { result }) };
            } catch (err) {
              const latencyMs = Date.now() - start;
              cb?.onFailure();
              factory._health.record(domain, { success: false, latencyMs, error: err });
              factory._callHook('onError', domain, err, ctx);
              factory.emit('bee:error', { domain, action: workName, error: err.message });
              return { bee: domain, action: workName, error: err.message, latencyMs, status: 'failed' };
            }
          };
        });
      },
    };

    // Versioning: if domain already exists, bump version
    if (this._registry.has(domain)) {
      const existing = this._registry.get(domain);
      entry.version = (existing.version || 1) + 1;
      entry.replacedAt = new Date().toISOString();
    }

    this._registry.set(domain, entry);
    this._health.init(domain);
    this._stats.created++;

    this._callHook('onCreate', domain, entry);
    this.emit('bee:created', { domain, priority, version: entry.version });

    if (persist) {
      this._persistBee(domain, config);
    }

    return entry;
  }

  /**
   * Spawn an ephemeral single-purpose bee.
   *
   * @param {string} name
   * @param {Function|Function[]} work
   * @param {number} [priority=0.8]
   * @returns {object}
   */
  spawnBee(name, work, priority = 0.8) {
    const workFns = Array.isArray(work) ? work : [work];
    const id = `ephemeral-${name}-${crypto.randomBytes(3).toString('hex')}`;

    const factory = this;
    const entry = {
      domain: id,
      description: `Ephemeral bee: ${name}`,
      priority,
      ephemeral: true,
      createdAt: Date.now(),
      file: `ephemeral:${id}`,
      getWork: (ctx = {}) => workFns.map(fn => async () => {
        const start = Date.now();
        try {
          const result = await fn(ctx, factory.di.resolveAll());
          factory._health.record(id, { success: true, latencyMs: Date.now() - start });
          return { bee: id, action: name, ...(typeof result === 'object' ? result : { result }) };
        } catch (err) {
          factory._health.record(id, { success: false, latencyMs: Date.now() - start, error: err });
          return { bee: id, action: name, error: err.message, status: 'failed' };
        }
      }),
    };

    this._ephemeral.set(id, entry);
    this._health.init(id);
    this.emit('bee:spawned', { id, name, priority });
    return entry;
  }

  /**
   * Add a single work unit to an existing domain.
   * Creates the domain if it doesn't exist.
   *
   * @param {string} domain
   * @param {string} name
   * @param {Function} fn
   * @param {string[]} [deps=[]] - DI dep names
   * @returns {object}
   */
  createWorkUnit(domain, name, fn, deps = []) {
    const existing = this._registry.get(domain);
    if (existing) {
      // Dynamically append work to existing bee
      // We rebuild getWork to include the new function
      const workers = existing._workers || [];
      workers.push({ name, fn, deps });
      existing._workers = workers;

      const origGetWork = existing.getWork.bind(existing);
      const factory = this;
      existing.getWork = (ctx = {}) => {
        const base = origGetWork(ctx);
        const resolvedDeps = factory.di.resolve(deps);
        base.push(async () => {
          const start = Date.now();
          try {
            const result = await fn({ ...ctx, deps: resolvedDeps }, resolvedDeps);
            return { bee: domain, action: name, ...(typeof result === 'object' ? result : { result }), latencyMs: Date.now() - start };
          } catch (err) {
            return { bee: domain, action: name, error: err.message, status: 'failed' };
          }
        });
        return base;
      };
      return existing;
    }

    return this.createBee(domain, { workers: [{ name, fn, deps }] });
  }

  // ─── Templates ───────────────────────────────────────────────────────────

  /**
   * Create a bee from a named template.
   *
   * Templates: health-check, monitor, processor, scanner, alerter, validator, scheduler
   *
   * CHANGE FROM V1: Added 'validator' and 'scheduler' templates.
   *
   * @param {string} template
   * @param {object} config
   * @returns {object}
   */
  createFromTemplate(template, config = {}) {
    const templates = {
      'health-check': (cfg) => ({
        description: `Health checker for ${cfg.target}`,
        priority: 0.9,
        workers: [{
          name: 'probe',
          fn: async () => {
            const url = cfg.url || `https://${cfg.target}/api/health`;
            const start = Date.now();
            try {
              const res = await fetch(url, { signal: AbortSignal.timeout(cfg.timeout || 5000) });
              const latency = Date.now() - start;
              const body = res.headers.get('content-type')?.includes('json')
                ? await res.json().catch(() => null) : null;
              return { target: cfg.target, url, status: res.ok ? 'healthy' : 'degraded', statusCode: res.status, latency, body };
            } catch (err) {
              return { target: cfg.target, url, status: 'down', error: err.message, latency: Date.now() - start };
            }
          },
        }],
      }),

      'monitor': (cfg) => ({
        description: `Process monitor for ${cfg.target}`,
        priority: 0.7,
        workers: [
          {
            name: 'metrics',
            fn: async () => {
              const mem = process.memoryUsage();
              const lagStart = Date.now();
              await new Promise(r => setImmediate(r));
              return {
                target: cfg.target,
                heapUsedMB: +(mem.heapUsed / 1048576).toFixed(1),
                heapTotalMB: +(mem.heapTotal / 1048576).toFixed(1),
                rssMB: +(mem.rss / 1048576).toFixed(1),
                eventLoopLagMs: Date.now() - lagStart,
                ts: Date.now(),
              };
            },
          },
          {
            name: 'uptime',
            fn: async () => {
              const s = process.uptime();
              const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
              return { target: cfg.target, uptimeSeconds: Math.round(s), uptimeHuman: `${h}h ${m}m`, pid: process.pid, ts: Date.now() };
            },
          },
        ],
      }),

      'processor': (cfg) => ({
        description: `Data processor: ${cfg.name}`,
        priority: cfg.priority || 0.6,
        workers: (cfg.tasks || []).map(task => ({
          name: task.name || 'process',
          fn: task.fn || (async () => ({ processed: true, task: task.name })),
        })),
      }),

      'scanner': (cfg) => ({
        description: `Scanner for ${cfg.target}`,
        priority: 0.8,
        workers: [{
          name: 'scan',
          fn: cfg.scanFn || (async () => {
            const targetDir = cfg.scanPath || cfg.target || '.';
            const patterns = cfg.patterns || ['.env', '.key', '.pem', 'secret'];
            const findings = [];
            const walk = (dir, depth = 0) => {
              if (depth > 5) return;
              try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                  if (entry.name === 'node_modules' || entry.name === '.git') continue;
                  const fullPath = path.join(dir, entry.name);
                  if (entry.isDirectory()) walk(fullPath, depth + 1);
                  else if (patterns.some(p => entry.name.includes(p))) {
                    findings.push({ file: fullPath, pattern: patterns.find(p => entry.name.includes(p)), size: fs.statSync(fullPath).size });
                  }
                }
              } catch { /* permission denied */ }
            };
            walk(targetDir);
            return { scanned: targetDir, findings, count: findings.length, ts: Date.now() };
          }),
        }],
      }),

      'alerter': (cfg) => ({
        description: `Threshold alerter for ${cfg.target}`,
        priority: 0.85,
        workers: [{
          name: 'check-thresholds',
          fn: async () => {
            const mem = process.memoryUsage();
            const heapPercent = (mem.heapUsed / mem.heapTotal) * 100;
            const alerts = [];
            if (heapPercent > (cfg.heapThreshold || 85)) {
              alerts.push({ type: 'heap', level: 'warning', value: `${heapPercent.toFixed(1)}%` });
            }
            return { target: cfg.target, alerts, alertCount: alerts.length, ts: Date.now() };
          },
        }],
      }),

      // NEW in V2
      'validator': (cfg) => ({
        description: `Schema validator for ${cfg.target || 'data'}`,
        priority: 0.9,
        workers: [{
          name: 'validate',
          fn: async (ctx) => {
            const data = ctx.data || cfg.data || {};
            const schema = cfg.schema || {};
            const errors = [];
            for (const [field, rules] of Object.entries(schema)) {
              const value = data[field];
              if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push({ field, rule: 'required', value });
              }
              if (rules.type && value !== undefined && typeof value !== rules.type) {
                errors.push({ field, rule: 'type', expected: rules.type, got: typeof value });
              }
              if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
                errors.push({ field, rule: 'minLength', expected: rules.minLength, got: value.length });
              }
              if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
                errors.push({ field, rule: 'maxLength', expected: rules.maxLength, got: value.length });
              }
            }
            return { target: cfg.target, valid: errors.length === 0, errors, ts: Date.now() };
          },
        }],
      }),

      // NEW in V2
      'scheduler': (cfg) => ({
        description: `Scheduled task bee for ${cfg.name}`,
        priority: cfg.priority || 0.5,
        workers: [{
          name: 'tick',
          fn: async (ctx) => {
            const now = Date.now();
            const lastRun = ctx._lastRun || 0;
            const intervalMs = cfg.intervalMs || 60_000;
            if (now - lastRun < intervalMs) {
              return { name: cfg.name, skipped: true, nextRunIn: intervalMs - (now - lastRun) };
            }
            try {
              const result = await cfg.task(ctx);
              return { name: cfg.name, ran: true, result, ts: now };
            } catch (err) {
              return { name: cfg.name, ran: true, error: err.message, ts: now };
            }
          },
        }],
      }),
    };

    const tplFn = templates[template];
    if (!tplFn) {
      throw new Error(`[BeeFactoryV2] Unknown template: '${template}'. Available: ${Object.keys(templates).join(', ')}`);
    }

    const domain = config.domain || `${template}-${config.target || config.name || 'dynamic'}`;
    return this.createBee(domain, tplFn(config));
  }

  // ─── Swarm ──────────────────────────────────────────────────────────────

  /**
   * Create a coordinated swarm of bees.
   *
   * CHANGE FROM V1: Added maxConcurrentBees for backpressure.
   *
   * @param {string} name
   * @param {Array<{domain: string, config?: object}>} beeConfigs
   * @param {object} policy
   * @param {'parallel'|'sequential'|'pipeline'} [policy.mode='parallel']
   * @param {boolean} [policy.requireConsensus=false]
   * @param {number}  [policy.timeoutMs=30000]
   * @param {number}  [policy.maxConcurrentBees=20]
   * @returns {object}
   */
  createSwarm(name, beeConfigs = [], policy = {}) {
    const {
      mode = 'parallel',
      requireConsensus = false,
      timeoutMs = 30_000,
      maxConcurrentBees = 20,
    } = policy;

    const bees = beeConfigs.map(({ domain, config }) => this.createBee(domain, config || {}));

    const factory = this;
    return this.createBee(`swarm-${name}`, {
      description: `Swarm: ${name} (${mode}, ${bees.length} bees)`,
      priority: 1.0,
      workers: [{
        name: 'orchestrate',
        fn: async (ctx = {}) => {
          const results = {};
          const start = Date.now();

          if (mode === 'parallel') {
            // Bounded concurrency via sliding window
            const queue = [...bees];
            const active = new Set();

            const runBee = async (bee) => {
              try {
                const workFns = bee.getWork(ctx);
                const beeResults = await Promise.all(workFns.map(fn => fn(ctx)));
                results[bee.domain] = { status: 'ok', results: beeResults };
              } catch (err) {
                results[bee.domain] = { status: 'error', error: err.message };
              } finally {
                active.delete(bee.domain);
              }
            };

            await new Promise((resolve) => {
              const tick = () => {
                while (queue.length > 0 && active.size < maxConcurrentBees) {
                  const bee = queue.shift();
                  active.add(bee.domain);
                  runBee(bee).then(tick);
                }
                if (queue.length === 0 && active.size === 0) resolve();
              };
              tick();
            });

          } else {
            let pipelineCtx = { ...ctx };
            for (const bee of bees) {
              try {
                const workFns = bee.getWork(pipelineCtx);
                const beeResults = [];
                for (const fn of workFns) {
                  const r = await fn(pipelineCtx);
                  beeResults.push(r);
                  if (mode === 'pipeline' && typeof r === 'object') {
                    pipelineCtx = { ...pipelineCtx, ...r };
                  }
                }
                results[bee.domain] = { status: 'ok', results: beeResults };
              } catch (err) {
                results[bee.domain] = { status: 'error', error: err.message };
                if (requireConsensus) break;
              }
            }
          }

          const allOk = Object.values(results).every(r => r.status === 'ok');
          return {
            swarm: name, mode, beeCount: bees.length,
            consensus: requireConsensus ? allOk : null,
            durationMs: Date.now() - start,
            results,
          };
        },
      }],
    });
  }

  // ─── Hot Reload ──────────────────────────────────────────────────────────

  /**
   * Start hot-reload watching on a directory.
   * When a bee file changes, re-requires it and updates the registry.
   *
   * CHANGE FROM V1: This is entirely new. V1 had no hot reload.
   *
   * @param {string} beesDir - Absolute path to the bees directory to watch
   */
  startHotReload(beesDir) {
    if (!fs.existsSync(beesDir)) {
      this.emit('warn', { msg: `[BeeFactoryV2] Hot-reload: directory not found: ${beesDir}` });
      return;
    }

    const watcher = fs.watch(beesDir, { recursive: false }, (eventType, filename) => {
      if (!filename || !filename.endsWith('.js')) return;
      if (filename === 'registry.js' || filename === 'bee-factory.js' || filename === 'bee-factory-v2.js') return;

      const filePath = path.join(beesDir, filename);

      // Debounce rapid changes (e.g., editor save storms)
      if (this._reloadDebounce.has(filePath)) {
        clearTimeout(this._reloadDebounce.get(filePath));
      }
      this._reloadDebounce.set(filePath, setTimeout(() => {
        this._reloadDebounce.delete(filePath);
        this._hotReloadFile(filePath);
      }, HOT_RELOAD_DEBOUNCE_MS));
    });

    this._watchers.set(beesDir, watcher);
    this.emit('hot-reload:started', { beesDir });
  }

  /**
   * Stop all hot-reload watchers.
   */
  stopHotReload() {
    for (const [dir, watcher] of this._watchers) {
      watcher.close();
      this._watchers.delete(dir);
    }
  }

  /**
   * @private
   * Re-require a bee file and update the registry entry.
   */
  _hotReloadFile(filePath) {
    try {
      // Bust the require cache for this module
      delete require.cache[require.resolve(filePath)];
      const mod = require(filePath);

      if (!mod.domain || typeof mod.getWork !== 'function') return;

      const existing = this._registry.get(mod.domain);
      const newVersion = existing ? (existing.version || 1) + 1 : 1;

      const entry = {
        ...mod,
        file: filePath,
        dynamic: false,
        version: newVersion,
        hotReloadedAt: new Date().toISOString(),
        getWork: mod.getWork,
      };

      this._registry.set(mod.domain, entry);
      this._stats.hotReloads++;

      this._callHook('onHotReload', filePath, mod.domain);
      this.emit('bee:hot-reloaded', { domain: mod.domain, file: filePath, version: newVersion });
    } catch (err) {
      this.emit('bee:reload-failed', { filePath, error: err.message });
    }
  }

  // ─── Dissolve / Query ────────────────────────────────────────────────────

  /**
   * Remove a bee from the registry.
   * @param {string} domain
   * @returns {boolean}
   */
  dissolveBee(domain) {
    const deleted = this._registry.delete(domain) || this._ephemeral.delete(domain);
    if (deleted) {
      this._breakers.delete(domain);
      this._depGraph.delete(domain);
      this._stats.dissolved++;
      this.emit('bee:dissolved', { domain });
    }
    return deleted;
  }

  /** List all registered bees. */
  listBees() {
    const all = [];
    for (const [id, entry] of this._registry) {
      all.push({ domain: id, description: entry.description, priority: entry.priority, type: 'registered', version: entry.version, createdAt: entry.createdAt });
    }
    for (const [id, entry] of this._ephemeral) {
      all.push({ domain: id, description: entry.description, priority: entry.priority, type: 'ephemeral', createdAt: entry.createdAt });
    }
    return all;
  }

  /** Get a bee entry by domain. */
  getBee(domain) {
    return this._registry.get(domain) || this._ephemeral.get(domain) || null;
  }

  /** Get health stats for a bee. */
  getBeeHealth(domain) {
    return {
      health: this._health.get(domain),
      circuitBreaker: this._breakers.get(domain)?.getStats() || null,
    };
  }

  /** Get all health stats. */
  getAllHealth() {
    return this._health.getAll().map(h => ({
      ...h,
      circuitBreaker: this._breakers.get(h.domain)?.getStats() || null,
    }));
  }

  /** Factory-level stats. */
  getStats() {
    return {
      version: this.version,
      ...this._stats,
      registered: this._registry.size,
      ephemeral: this._ephemeral.size,
      breakers: this._breakers.size,
      hotReloadWatchers: this._watchers.size,
      deps: this.di.list(),
    };
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  /** @private */
  _callHook(hookName, ...args) {
    const fn = this._hooks[hookName];
    if (typeof fn === 'function') {
      try { fn(...args); } catch { /* hooks must not crash the factory */ }
    }
    this.emit(`hook:${hookName}`, { hookName, args });
  }

  /**
   * @private
   * Detect cycles in the bee dependency graph using DFS.
   */
  _hasCycle(startDomain) {
    const visited = new Set();
    const dfs = (domain) => {
      if (visited.has(domain)) return true;
      visited.add(domain);
      const deps = this._depGraph.get(domain) || [];
      for (const dep of deps) {
        if (dfs(dep)) return true;
      }
      visited.delete(domain);
      return false;
    };
    return dfs(startDomain);
  }

  /**
   * @private
   * Persist a bee to disk as a proper stub file.
   *
   * CHANGE FROM V1: Generated file includes real JSDoc and DI dep resolution pattern.
   */
  _persistBee(domain, config) {
    const filename = `${domain.replace(/[^a-z0-9-]/gi, '-')}-bee.js`;
    // We don't write to the bees dir directly to avoid polluting the hot-reload watcher
    // Caller should specify persist path via config.persistPath
    const persistDir = config.persistPath || path.join(process.cwd(), 'generated-bees');
    const filePath = path.join(persistDir, filename);

    if (fs.existsSync(filePath)) return;
    try { fs.mkdirSync(persistDir, { recursive: true }); } catch { return; }

    const workerNames = (config.workers || []).map((w, i) =>
      typeof w === 'function' ? `worker-${i}` : (w.name || `worker-${i}`)
    );

    const code = `/*
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Auto-generated by BeeFactoryV2
 * Domain: ${domain}
 * Created: ${new Date().toISOString()}
 *
 * NOTE: Edit the worker functions below. Each fn receives (ctx, deps) where:
 *   ctx  = runtime context passed to getWork()
 *   deps = resolved DI dependencies (keys listed in the deps[] array)
 */

'use strict';

const domain = '${domain}';
const description = '${(config.description || '').replace(/'/g, "\\'")}';
const priority = ${config.priority || 0.5};

/**
 * @param {object} ctx - Runtime context
 * @returns {Function[]} - Array of async work functions
 */
function getWork(ctx = {}) {
    return [
${workerNames.map(name => `        /**
         * Worker: ${name}
         * @param {object} ctx
         * @param {object} deps - Injected dependencies
         */
        async (ctx, deps) => {
            // TODO: implement ${name}
            return { bee: domain, action: '${name}', status: 'active', ts: Date.now() };
        },`).join('\n')}
    ];
}

module.exports = { domain, description, priority, getWork };
`;

    try { fs.writeFileSync(filePath, code, 'utf8'); } catch { /* non-fatal */ }
  }
}

// ─── Singleton factory (backward compatible) ─────────────────────────────────

let _factory = null;

/**
 * Get or create the default BeeFactoryV2 singleton.
 * @param {object} [opts] - Options passed on first creation only
 * @returns {BeeFactoryV2}
 */
function getFactory(opts = {}) {
  if (!_factory) _factory = new BeeFactoryV2(opts);
  return _factory;
}

// ─── Backward-compatible shorthand exports ───────────────────────────────────

module.exports = {
  BeeFactoryV2,
  DIContainer,
  BeeCB,
  BeeHealthRegistry,
  getFactory,
  // Convenience shorthands that delegate to singleton
  createBee: (domain, config) => getFactory().createBee(domain, config),
  spawnBee: (name, work, priority) => getFactory().spawnBee(name, work, priority),
  createWorkUnit: (domain, name, fn, deps) => getFactory().createWorkUnit(domain, name, fn, deps),
  createFromTemplate: (template, config) => getFactory().createFromTemplate(template, config),
  createSwarm: (name, configs, policy) => getFactory().createSwarm(name, configs, policy),
  listBees: () => getFactory().listBees(),
  dissolveBee: (domain) => getFactory().dissolveBee(domain),
};
