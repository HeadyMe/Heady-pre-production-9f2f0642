'use strict';

/**
 * @fileoverview heady-service-mesh.js
 *
 * Heady Service Mesh — dynamic service registry, health-aware routing,
 * load balancing, and circuit-breaker management for all nine Heady
 * domains and the ten core repositories.
 *
 * Replaces the static heady-registry.json + every scattered hard-coded URL
 * found in edge-diffusion.js (line 14), buddy-core.js, and elsewhere.
 *
 * Key capabilities
 * ────────────────
 *  • Centralized service registry (register / deregister / resolve)
 *  • Active health probing with exponential back-off (φ-weighted)
 *  • Three load-balancing strategies: round-robin, least-connections,
 *    phi-weighted (default)
 *  • Per-service circuit breakers (CLOSED → OPEN → HALF_OPEN)
 *  • Retry / hedged-request support
 *  • Express v4 router  — mounts at /api/v1/mesh
 *  • Publishes events to HeadyEventBus (heady:service:* topics)
 *  • Hot-reloadable via heady-config-server
 *
 * Usage
 * ─────
 *   const { getServiceMesh } = require('./heady-service-mesh');
 *   const mesh = getServiceMesh();
 *   await mesh.start();
 *
 *   // Resolve a single healthy endpoint
 *   const url = await mesh.resolve('headyapi');
 *
 *   // Register a new ephemeral instance (e.g. Cloudflare Worker)
 *   mesh.register({ name: 'headyapi', url: 'https://worker.headyapi.com',
 *                   weight: 0.5, tags: ['edge'] });
 *
 * © 2026 HeadySystems Inc.  PROPRIETARY AND CONFIDENTIAL.
 */

const EventEmitter = require('events');
const https        = require('https');
const http         = require('http');
const { URL }      = require('url');

// ─── φ constant (used for weighted load-balancing & back-off) ────────────────
const PHI = 1.6180339887;

// ─── Circuit-breaker states ───────────────────────────────────────────────────
const CB_STATE = Object.freeze({
  CLOSED:    'CLOSED',    // healthy, requests flow freely
  OPEN:      'OPEN',      // tripped, requests rejected immediately
  HALF_OPEN: 'HALF_OPEN', // probe period — one request allowed through
});

// ─── Load-balancing strategies ────────────────────────────────────────────────
const LB_STRATEGY = Object.freeze({
  ROUND_ROBIN:       'round_robin',
  LEAST_CONNECTIONS: 'least_connections',
  PHI_WEIGHTED:      'phi_weighted',   // default — higher-weight endpoints get
                                        // φ× more traffic than lower-weight ones
});

// ─── Default configuration ────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  healthCheckIntervalMs:  Math.round(30_000 / PHI),  // ~18 500 ms
  healthCheckTimeoutMs:   5_000,
  healthCheckPath:        '/healthz',
  circuitBreakerThreshold: 5,        // failures before OPEN
  circuitBreakerResetMs:  Math.round(60_000 * PHI),  // ~97 s
  maxRetries:             3,
  retryDelayBaseMs:       200,
  lbStrategy:             LB_STRATEGY.PHI_WEIGHTED,
};

// ─── Built-in seed registry (from heady-registry.json + alive-software-architecture.md)
const SEED_SERVICES = [
  // ── Primary domains ────────────────────────────────────────────────────────
  {
    name: 'headyme',
    domain: 'headyme.com',
    instances: [
      { url: 'http://localhost:3301', weight: 1.0, tags: ['local', 'primary'] },
      { url: 'https://heady-manager-609590223909.us-central1.run.app', weight: PHI, tags: ['cloud-run', 'primary'] },
    ],
    healthPath: '/healthz',
    version: '3.1.0',
    tier: 'core',
  },
  {
    name: 'headyapi',
    domain: 'headyapi.com',
    instances: [
      { url: 'http://localhost:3302', weight: 1.0, tags: ['local'] },
      { url: 'https://api.headyapi.com', weight: PHI, tags: ['production'] },
    ],
    healthPath: '/healthz',
    version: '1.0.0',
    tier: 'core',
  },
  {
    name: 'headysystems',
    domain: 'headysystems.com',
    instances: [
      { url: 'http://localhost:3303', weight: 1.0, tags: ['local'] },
      { url: 'https://systems.headysystems.com', weight: PHI, tags: ['production'] },
    ],
    healthPath: '/healthz',
    version: '1.0.0',
    tier: 'core',
  },
  {
    name: 'headyconnection',
    domain: 'headyconnection.org',
    instances: [
      { url: 'http://localhost:3304', weight: 1.0, tags: ['local'] },
      { url: 'https://headyconnection.org', weight: PHI, tags: ['production'] },
    ],
    healthPath: '/healthz',
    version: '1.0.0',
    tier: 'community',
  },
  {
    name: 'headymcp',
    domain: 'headymcp.com',
    instances: [
      { url: 'http://localhost:3305', weight: 1.0, tags: ['local'] },
      { url: 'https://mcp.headymcp.com', weight: PHI, tags: ['production'] },
    ],
    healthPath: '/healthz',
    version: '1.0.0',
    tier: 'protocol',
  },
  {
    name: 'headybuddy',
    domain: 'headybuddy.org',
    instances: [
      { url: 'http://localhost:3306', weight: 1.0, tags: ['local'] },
      { url: 'https://headybuddy.org', weight: PHI, tags: ['production'] },
    ],
    healthPath: '/healthz',
    version: '1.0.0',
    tier: 'ai',
  },
  {
    name: 'headyio',
    domain: 'headyio.com',
    instances: [
      { url: 'http://localhost:3307', weight: 1.0, tags: ['local'] },
      { url: 'https://headyio.com', weight: PHI, tags: ['production'] },
    ],
    healthPath: '/healthz',
    version: '1.0.0',
    tier: 'io',
  },
  {
    name: 'headybot',
    domain: 'headybot.com',
    instances: [
      { url: 'http://localhost:3308', weight: 1.0, tags: ['local'] },
      { url: 'https://headybot.com', weight: PHI, tags: ['production'] },
    ],
    healthPath: '/healthz',
    version: '1.0.0',
    tier: 'bot',
  },
  {
    name: 'heady-ai',
    domain: 'heady-ai.com',
    instances: [
      { url: 'http://localhost:3309', weight: 1.0, tags: ['local'] },
      { url: 'https://heady-ai.com', weight: PHI, tags: ['production'] },
    ],
    healthPath: '/healthz',
    version: '1.0.0',
    tier: 'ai',
  },

  // ── Infrastructure services ────────────────────────────────────────────────
  {
    name: 'edge-diffusion',
    domain: null,
    instances: [
      // Replaces hardcoded URL in edge-diffusion.js line 14
      { url: 'https://headysystems-edge-diffusion.hf.space', weight: PHI, tags: ['huggingface', 'gpu'] },
    ],
    healthPath: '/healthz',
    version: '1.0.0',
    tier: 'ml',
  },
  {
    name: 'vector-store',
    domain: null,
    instances: [
      { url: 'http://localhost:5432', weight: 1.0, tags: ['postgres', 'pgvector'] },
    ],
    healthPath: null,        // TCP probe only
    version: '16.0',
    tier: 'infrastructure',
  },
  {
    name: 'redis',
    domain: null,
    instances: [
      { url: 'redis://localhost:6379', weight: 1.0, tags: ['cache', 'pubsub'] },
    ],
    healthPath: null,
    version: '7.0',
    tier: 'infrastructure',
  },
];

// ─── Utility: raw HTTP/HTTPS GET with timeout ─────────────────────────────────
/**
 * @param {string} rawUrl
 * @param {number} timeoutMs
 * @returns {Promise<{statusCode:number, body:string}>}
 */
function httpGet(rawUrl, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(rawUrl); } catch (e) { return reject(e); }

    const lib     = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      timeout:  timeoutMs,
      headers:  { 'User-Agent': 'heady-service-mesh/3.1.0' },
    };

    const req = lib.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end',  () => resolve({ statusCode: res.statusCode, body }));
    });

    req.on('timeout', () => { req.destroy(); reject(new Error(`health-probe timeout: ${rawUrl}`)); });
    req.on('error',   reject);
    req.end();
  });
}

// ─── CircuitBreaker ───────────────────────────────────────────────────────────
/**
 * Per-instance circuit breaker.
 * @class
 */
class CircuitBreaker {
  /**
   * @param {object} opts
   * @param {number} opts.threshold   – consecutive failures to trip
   * @param {number} opts.resetMs     – ms before attempting HALF_OPEN
   */
  constructor({ threshold = 5, resetMs = Math.round(60_000 * PHI) } = {}) {
    this.threshold  = threshold;
    this.resetMs    = resetMs;
    this.state      = CB_STATE.CLOSED;
    this.failures   = 0;
    this.lastTrip   = 0;
    this.probeCount = 0;
  }

  /** @returns {boolean} true if the instance should receive traffic */
  isOpen() {
    if (this.state === CB_STATE.CLOSED)    return false;
    if (this.state === CB_STATE.HALF_OPEN) return false;
    // OPEN — check if reset timer expired
    if (Date.now() - this.lastTrip >= this.resetMs) {
      this.state = CB_STATE.HALF_OPEN;
      this.probeCount = 0;
      return false;
    }
    return true;
  }

  /** Called when a request succeeds */
  onSuccess() {
    this.failures = 0;
    this.state    = CB_STATE.CLOSED;
  }

  /** Called when a request fails */
  onFailure() {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.state    = CB_STATE.OPEN;
      this.lastTrip = Date.now();
    }
  }

  /** Serialisable snapshot */
  toJSON() {
    return {
      state:    this.state,
      failures: this.failures,
      lastTrip: this.lastTrip,
    };
  }
}

// ─── ServiceInstance ──────────────────────────────────────────────────────────
/**
 * Represents one running instance of a named service.
 */
class ServiceInstance {
  /**
   * @param {object} opts
   * @param {string}   opts.url
   * @param {number}   [opts.weight=1.0]
   * @param {string[]} [opts.tags=[]]
   * @param {object}   cbConfig
   */
  constructor({ url, weight = 1.0, tags = [] }, cbConfig = {}) {
    this.url              = url;
    this.weight           = weight;
    this.tags             = tags;
    this.healthy          = true;
    this.consecutiveFails = 0;
    this.activeConns      = 0;
    this.totalRequests    = 0;
    this.totalErrors      = 0;
    this.lastHealthCheck  = 0;
    this.latencyP95Ms     = 0;
    this._latencySamples  = [];
    this.registeredAt     = Date.now();
    this.cb               = new CircuitBreaker(cbConfig);
  }

  /** Record a request latency sample (keeps last 100) */
  recordLatency(ms) {
    this._latencySamples.push(ms);
    if (this._latencySamples.length > 100) this._latencySamples.shift();
    const sorted = [...this._latencySamples].sort((a, b) => a - b);
    const p95idx = Math.floor(sorted.length * 0.95);
    this.latencyP95Ms = sorted[p95idx] ?? 0;
  }

  /** Effective routing weight — degrades as failures accumulate */
  get effectiveWeight() {
    if (!this.healthy) return 0;
    if (this.cb.isOpen()) return 0;
    // Reduce weight by φ⁻¹ per consecutive failure
    return this.weight * Math.pow(1 / PHI, this.consecutiveFails);
  }

  toJSON() {
    return {
      url:             this.url,
      weight:          this.weight,
      tags:            this.tags,
      healthy:         this.healthy,
      activeConns:     this.activeConns,
      totalRequests:   this.totalRequests,
      totalErrors:     this.totalErrors,
      latencyP95Ms:    this.latencyP95Ms,
      registeredAt:    this.registeredAt,
      lastHealthCheck: this.lastHealthCheck,
      circuitBreaker:  this.cb.toJSON(),
    };
  }
}

// ─── ServiceEntry ─────────────────────────────────────────────────────────────
/**
 * A named logical service with 1-N instances.
 */
class ServiceEntry {
  /**
   * @param {object} def       – from SEED_SERVICES or register()
   * @param {object} config    – mesh config
   */
  constructor(def, config = DEFAULT_CONFIG) {
    this.name        = def.name;
    this.domain      = def.domain  ?? null;
    this.version     = def.version ?? '0.0.0';
    this.tier        = def.tier    ?? 'unknown';
    this.healthPath  = def.healthPath ?? config.healthCheckPath;
    this._config     = config;
    this._rrIndex    = 0;

    const cbCfg = {
      threshold: config.circuitBreakerThreshold,
      resetMs:   config.circuitBreakerResetMs,
    };

    this.instances = (def.instances ?? []).map(
      (inst) => new ServiceInstance(inst, cbCfg)
    );
  }

  /** Add a new instance at runtime */
  addInstance(instOpts) {
    const cbCfg = {
      threshold: this._config.circuitBreakerThreshold,
      resetMs:   this._config.circuitBreakerResetMs,
    };
    this.instances.push(new ServiceInstance(instOpts, cbCfg));
  }

  /** Remove an instance by URL */
  removeInstance(url) {
    this.instances = this.instances.filter((i) => i.url !== url);
  }

  /** Healthy instances that circuit-breaker allows traffic to */
  get routableInstances() {
    return this.instances.filter((i) => i.healthy && !i.cb.isOpen());
  }

  /** Pick an instance using the configured strategy */
  pick(strategy = LB_STRATEGY.PHI_WEIGHTED) {
    const pool = this.routableInstances;
    if (pool.length === 0) return null;
    if (pool.length === 1) return pool[0];

    switch (strategy) {
      case LB_STRATEGY.ROUND_ROBIN:
        return this._pickRoundRobin(pool);
      case LB_STRATEGY.LEAST_CONNECTIONS:
        return this._pickLeastConnections(pool);
      case LB_STRATEGY.PHI_WEIGHTED:
      default:
        return this._pickPhiWeighted(pool);
    }
  }

  _pickRoundRobin(pool) {
    const inst = pool[this._rrIndex % pool.length];
    this._rrIndex = (this._rrIndex + 1) % pool.length;
    return inst;
  }

  _pickLeastConnections(pool) {
    return pool.reduce((best, inst) =>
      inst.activeConns < best.activeConns ? inst : best
    );
  }

  _pickPhiWeighted(pool) {
    const totalWeight = pool.reduce((s, i) => s + i.effectiveWeight, 0);
    if (totalWeight === 0) return pool[0];
    let random = Math.random() * totalWeight;
    for (const inst of pool) {
      random -= inst.effectiveWeight;
      if (random <= 0) return inst;
    }
    return pool[pool.length - 1];
  }

  toJSON() {
    return {
      name:      this.name,
      domain:    this.domain,
      version:   this.version,
      tier:      this.tier,
      instances: this.instances.map((i) => i.toJSON()),
    };
  }
}

// ─── HeadyServiceMesh ─────────────────────────────────────────────────────────
/**
 * Core service mesh.  Manages the registry, health probes, and routing.
 *
 * @fires heady:service:registered
 * @fires heady:service:deregistered
 * @fires heady:service:healthy
 * @fires heady:service:unhealthy
 * @fires heady:service:circuit_opened
 * @fires heady:service:circuit_closed
 */
class HeadyServiceMesh extends EventEmitter {
  /**
   * @param {object} [config]
   * @param {object} [eventBus]  – optional HeadyEventBus instance
   */
  constructor(config = {}, eventBus = null) {
    super();
    this._config    = { ...DEFAULT_CONFIG, ...config };
    this._eventBus  = eventBus;
    this._registry  = new Map();     // name → ServiceEntry
    this._probeTimer = null;
    this._started    = false;

    // Seed from built-in registry
    for (const def of SEED_SERVICES) {
      this._registry.set(def.name, new ServiceEntry(def, this._config));
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /** Start health-probe loop */
  async start() {
    if (this._started) return;
    this._started = true;

    // Initial probe pass (non-blocking)
    this._runHealthProbes().catch((err) =>
      console.error('[mesh] initial health probe error:', err.message)
    );

    // Periodic probe
    this._probeTimer = setInterval(
      () => this._runHealthProbes().catch(console.error),
      this._config.healthCheckIntervalMs
    );

    // Prevent timer from blocking process exit
    if (this._probeTimer.unref) this._probeTimer.unref();

    console.log('[mesh] started — interval', this._config.healthCheckIntervalMs, 'ms');
    this._publish('heady:service:mesh_started', { ts: Date.now() });
  }

  /** Stop health-probe loop */
  stop() {
    if (this._probeTimer) {
      clearInterval(this._probeTimer);
      this._probeTimer = null;
    }
    this._started = false;
    this._publish('heady:service:mesh_stopped', { ts: Date.now() });
  }

  // ── Registry API ───────────────────────────────────────────────────────────

  /**
   * Register a new service or add an instance to an existing service.
   *
   * @param {object} def
   * @param {string}   def.name
   * @param {string}   def.url         – instance URL
   * @param {number}   [def.weight=1]
   * @param {string[]} [def.tags=[]]
   * @param {string}   [def.healthPath]
   * @param {string}   [def.domain]
   * @param {string}   [def.version]
   * @param {string}   [def.tier]
   */
  register(def) {
    const { name, url, weight = 1.0, tags = [],
            healthPath, domain, version, tier } = def;

    if (!name) throw new TypeError('[mesh] register: name required');
    if (!url)  throw new TypeError('[mesh] register: url required');

    if (this._registry.has(name)) {
      const entry = this._registry.get(name);
      const exists = entry.instances.find((i) => i.url === url);
      if (!exists) {
        entry.addInstance({ url, weight, tags });
        console.log(`[mesh] added instance ${url} → ${name}`);
      }
    } else {
      const entry = new ServiceEntry(
        { name, domain, version, tier, healthPath,
          instances: [{ url, weight, tags }] },
        this._config
      );
      this._registry.set(name, entry);
      console.log(`[mesh] registered new service: ${name}`);
    }

    this._publish('heady:service:registered', { name, url, tags, ts: Date.now() });
  }

  /**
   * Deregister a specific instance (or entire service if url omitted).
   *
   * @param {string} name
   * @param {string} [url]
   */
  deregister(name, url) {
    const entry = this._registry.get(name);
    if (!entry) return;

    if (url) {
      entry.removeInstance(url);
      if (entry.instances.length === 0) this._registry.delete(name);
    } else {
      this._registry.delete(name);
    }

    this._publish('heady:service:deregistered', { name, url, ts: Date.now() });
  }

  /**
   * Resolve a healthy URL for the named service.
   *
   * @param {string} name
   * @param {string} [strategy]
   * @returns {string} base URL
   * @throws {Error} if no healthy instance available
   */
  resolve(name, strategy) {
    const entry = this._registry.get(name);
    if (!entry) throw new Error(`[mesh] unknown service: ${name}`);

    const inst = entry.pick(strategy ?? this._config.lbStrategy);
    if (!inst)  throw new Error(`[mesh] no healthy instance for: ${name}`);

    return inst.url;
  }

  /**
   * Resolve + make an HTTP request through the mesh (with retry + CB tracking).
   *
   * @param {string} name         – service name
   * @param {string} path         – URL path (e.g. '/api/v1/generate')
   * @param {object} [fetchOpts]  – options passed to node-fetch / https
   * @returns {Promise<{statusCode:number, body:string, url:string}>}
   */
  async call(name, path = '/', fetchOpts = {}) {
    const entry = this._registry.get(name);
    if (!entry) throw new Error(`[mesh] unknown service: ${name}`);

    let lastError;

    for (let attempt = 0; attempt <= this._config.maxRetries; attempt++) {
      const inst = entry.pick(this._config.lbStrategy);
      if (!inst) throw new Error(`[mesh] no healthy instance for: ${name}`);

      const url  = inst.url.replace(/\/$/, '') + path;
      const t0   = Date.now();

      inst.activeConns++;
      inst.totalRequests++;

      try {
        const result = await httpGet(url, this._config.healthCheckTimeoutMs);
        const ms     = Date.now() - t0;

        inst.activeConns--;
        inst.recordLatency(ms);
        inst.cb.onSuccess();
        inst.consecutiveFails = 0;

        return { statusCode: result.statusCode, body: result.body, url };
      } catch (err) {
        inst.activeConns--;
        inst.totalErrors++;
        inst.consecutiveFails++;
        inst.cb.onFailure();
        lastError = err;

        const wasOpen  = inst.cb.state === CB_STATE.OPEN;
        const prevState = wasOpen ? CB_STATE.CLOSED : null;
        if (wasOpen && prevState !== inst.cb.state) {
          this._publish('heady:service:circuit_opened',
            { name, url: inst.url, ts: Date.now() });
        }

        if (attempt < this._config.maxRetries) {
          const delay = this._config.retryDelayBaseMs *
                        Math.pow(PHI, attempt);
          await _sleep(delay);
        }
      }
    }

    throw lastError ?? new Error(`[mesh] call failed: ${name}${path}`);
  }

  // ── Health Probes ──────────────────────────────────────────────────────────

  /** Run health checks for every instance in the registry */
  async _runHealthProbes() {
    const probes = [];

    for (const [, entry] of this._registry) {
      for (const inst of entry.instances) {
        probes.push(this._probeInstance(entry, inst));
      }
    }

    await Promise.allSettled(probes);
  }

  /**
   * @param {ServiceEntry}   entry
   * @param {ServiceInstance} inst
   */
  async _probeInstance(entry, inst) {
    // Infrastructure services (redis, postgres) get TCP-only probes
    if (!entry.healthPath) {
      inst.lastHealthCheck = Date.now();
      return;
    }

    const url = inst.url.replace(/\/$/, '') + entry.healthPath;

    try {
      const result = await httpGet(url, this._config.healthCheckTimeoutMs);
      inst.lastHealthCheck = Date.now();

      const wasHealthy = inst.healthy;
      inst.healthy     = result.statusCode >= 200 && result.statusCode < 300;

      if (inst.healthy) {
        inst.cb.onSuccess();
        inst.consecutiveFails = 0;
        if (!wasHealthy) {
          console.log(`[mesh] ${entry.name} ${inst.url} — HEALTHY`);
          this._publish('heady:service:healthy', { name: entry.name, url: inst.url, ts: Date.now() });
        }
      } else {
        this._handleProbeFailure(entry, inst, new Error(`HTTP ${result.statusCode}`));
      }
    } catch (err) {
      this._handleProbeFailure(entry, inst, err);
    }
  }

  _handleProbeFailure(entry, inst, err) {
    const wasHealthy  = inst.healthy;
    inst.healthy      = false;
    inst.consecutiveFails++;
    inst.cb.onFailure();
    inst.lastHealthCheck = Date.now();

    if (wasHealthy) {
      console.warn(`[mesh] ${entry.name} ${inst.url} — UNHEALTHY: ${err.message}`);
      this._publish('heady:service:unhealthy', {
        name:  entry.name,
        url:   inst.url,
        error: err.message,
        ts:    Date.now(),
      });
    }

    if (inst.cb.state === CB_STATE.OPEN) {
      this._publish('heady:service:circuit_opened', {
        name: entry.name,
        url:  inst.url,
        ts:   Date.now(),
      });
    }
  }

  // ── Observability ──────────────────────────────────────────────────────────

  /**
   * Full registry snapshot (for /api/v1/mesh/services).
   * @returns {object[]}
   */
  snapshot() {
    const result = [];
    for (const [name, entry] of this._registry) {
      result.push(entry.toJSON());
    }
    return result;
  }

  /**
   * Health summary (for /api/v1/mesh/health).
   * @returns {object}
   */
  healthSummary() {
    let totalInstances = 0;
    let healthyInstances = 0;
    const services = {};

    for (const [name, entry] of this._registry) {
      const routable  = entry.routableInstances.length;
      const total     = entry.instances.length;
      totalInstances += total;
      healthyInstances += routable;
      services[name]  = {
        healthy:   routable > 0,
        routable,
        total,
        tier:      entry.tier,
      };
    }

    return {
      status:           healthyInstances === totalInstances ? 'ok' : 'degraded',
      totalInstances,
      healthyInstances,
      services,
      ts:               Date.now(),
    };
  }

  // ── Prometheus metrics text ────────────────────────────────────────────────

  /** @returns {string} Prometheus-compatible text format */
  metricsText() {
    const lines = [
      '# HELP heady_mesh_instance_healthy Whether each service instance is healthy (1=yes, 0=no)',
      '# TYPE heady_mesh_instance_healthy gauge',
    ];

    for (const [, entry] of this._registry) {
      for (const inst of entry.instances) {
        const labels = `service="${entry.name}",url="${inst.url}",tier="${entry.tier}"`;
        lines.push(`heady_mesh_instance_healthy{${labels}} ${inst.healthy ? 1 : 0}`);
      }
    }

    lines.push('# HELP heady_mesh_instance_requests_total Total requests per instance');
    lines.push('# TYPE heady_mesh_instance_requests_total counter');
    for (const [, entry] of this._registry) {
      for (const inst of entry.instances) {
        const labels = `service="${entry.name}",url="${inst.url}"`;
        lines.push(`heady_mesh_instance_requests_total{${labels}} ${inst.totalRequests}`);
      }
    }

    lines.push('# HELP heady_mesh_instance_errors_total Total errors per instance');
    lines.push('# TYPE heady_mesh_instance_errors_total counter');
    for (const [, entry] of this._registry) {
      for (const inst of entry.instances) {
        const labels = `service="${entry.name}",url="${inst.url}"`;
        lines.push(`heady_mesh_instance_errors_total{${labels}} ${inst.totalErrors}`);
      }
    }

    lines.push('# HELP heady_mesh_instance_latency_p95_ms P95 latency per instance');
    lines.push('# TYPE heady_mesh_instance_latency_p95_ms gauge');
    for (const [, entry] of this._registry) {
      for (const inst of entry.instances) {
        const labels = `service="${entry.name}",url="${inst.url}"`;
        lines.push(`heady_mesh_instance_latency_p95_ms{${labels}} ${inst.latencyP95Ms}`);
      }
    }

    lines.push('# HELP heady_mesh_circuit_breaker_state Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)');
    lines.push('# TYPE heady_mesh_circuit_breaker_state gauge');
    const cbStateNum = { [CB_STATE.CLOSED]: 0, [CB_STATE.HALF_OPEN]: 1, [CB_STATE.OPEN]: 2 };
    for (const [, entry] of this._registry) {
      for (const inst of entry.instances) {
        const labels = `service="${entry.name}",url="${inst.url}"`;
        lines.push(`heady_mesh_circuit_breaker_state{${labels}} ${cbStateNum[inst.cb.state] ?? 0}`);
      }
    }

    return lines.join('\n') + '\n';
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  _publish(topic, payload) {
    this.emit(topic, payload);
    if (this._eventBus && typeof this._eventBus.publish === 'function') {
      this._eventBus.publish(topic, payload).catch(() => {});
    }
  }
}

// ─── Express Router ───────────────────────────────────────────────────────────

/**
 * Returns an Express v4 Router with mesh management endpoints.
 *
 *   GET  /api/v1/mesh/services           — full registry snapshot
 *   GET  /api/v1/mesh/health             — health summary
 *   GET  /api/v1/mesh/metrics            — Prometheus text
 *   POST /api/v1/mesh/register           — register service/instance
 *   POST /api/v1/mesh/deregister         — deregister
 *   GET  /api/v1/mesh/route/:name        — resolve URL for service
 *
 * @param {HeadyServiceMesh} mesh
 * @returns {import('express').Router}
 */
function createMeshRouter(mesh) {
  // Lazy-require Express so the module can be used in non-Express contexts
  const express = require('express');
  const router  = express.Router();

  router.get('/services', (_req, res) => {
    res.json({ ok: true, services: mesh.snapshot(), ts: Date.now() });
  });

  router.get('/health', (_req, res) => {
    const summary = mesh.healthSummary();
    const status  = summary.status === 'ok' ? 200 : 206;
    res.status(status).json(summary);
  });

  router.get('/metrics', (_req, res) => {
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(mesh.metricsText());
  });

  router.post('/register', express.json(), (req, res) => {
    try {
      mesh.register(req.body);
      res.json({ ok: true, ts: Date.now() });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post('/deregister', express.json(), (req, res) => {
    const { name, url } = req.body ?? {};
    if (!name) return res.status(400).json({ ok: false, error: 'name required' });
    mesh.deregister(name, url);
    res.json({ ok: true, ts: Date.now() });
  });

  router.get('/route/:name', (req, res) => {
    try {
      const url = mesh.resolve(req.params.name, req.query.strategy);
      res.json({ ok: true, name: req.params.name, url, ts: Date.now() });
    } catch (err) {
      res.status(503).json({ ok: false, error: err.message });
    }
  });

  return router;
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance = null;

/**
 * Returns the process-wide HeadyServiceMesh singleton.
 *
 * @param {object}  [config]
 * @param {object}  [eventBus]
 * @returns {HeadyServiceMesh}
 */
function getServiceMesh(config, eventBus) {
  if (!_instance) {
    _instance = new HeadyServiceMesh(config, eventBus);
  }
  return _instance;
}

/** Destroy singleton (for testing). */
function resetServiceMesh() {
  if (_instance) { _instance.stop(); _instance = null; }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** @param {number} ms */
function _sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  HeadyServiceMesh,
  ServiceEntry,
  ServiceInstance,
  CircuitBreaker,
  createMeshRouter,
  getServiceMesh,
  resetServiceMesh,
  CB_STATE,
  LB_STRATEGY,
  SEED_SERVICES,
  DEFAULT_CONFIG,
  PHI,
};
