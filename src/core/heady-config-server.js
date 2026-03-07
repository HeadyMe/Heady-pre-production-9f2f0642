/*
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * heady-config-server.js
 * ════════════════════════════════════════════════════════════════════
 *
 * Centralized Configuration Management Server for the Heady ecosystem.
 *
 * Eliminates every hardcoded constant scattered across the codebase:
 *   – self-awareness.js:42   DRIFT_THRESHOLD = 0.75
 *   – self-awareness.js:41   HEARTBEAT_INTERVAL_MS = 30_000
 *   – self-awareness.js:46   TELEMETRY_RING_SIZE = 500
 *   – buddy-core.js:28       MAX_LOG = 200
 *   – buddy-core.js:26       TASK_LOCK_TTL_MS = 30_000
 *   – hc-full-pipeline.js:47 MAX_CONCURRENT_RUNS = 10
 *   – bee-factory.js:35      BEES_DIR (hardcoded __dirname)
 *   – heady-conductor.js:22  MAX_BEES = 50
 *   – ternary-logic.js:8     PHI = 1.6180339887 (sacred constant — read-only)
 *
 * Architecture
 * ────────────
 *  Layer 0 — DEFAULTS  : Hardcoded fallback values (always present)
 *  Layer 1 — ENV        : process.env overrides (12-factor compatible)
 *  Layer 2 — FILE       : /etc/heady/config.json or HEADY_CONFIG_FILE path
 *  Layer 3 — GCP SECRET : Google Cloud Secret Manager (production)
 *  Layer 4 — RUNTIME    : In-memory overrides via /api/v1/config PUT (hot)
 *
 * Higher-numbered layers win. Runtime layer persists across hot-reloads.
 * Sacred constants (PHI, etc.) are frozen — Layer 4 cannot override them.
 *
 * Hot-reload
 * ──────────
 *  • File watcher (fs.watch) re-reads config file on change
 *  • GCP Secret Manager polling every PHI * 60 s (~97 s)
 *  • Subscribers receive delta events: config:changed({ key, oldVal, newVal })
 *  • No process restart required
 *
 * Express API  (mounts at /api/v1/config)
 * ─────────────────────────────────────────
 *  GET  /api/v1/config            → full resolved config (admin-only)
 *  GET  /api/v1/config/:key       → single resolved value
 *  PUT  /api/v1/config/:key       → runtime override (hot)
 *  DEL  /api/v1/config/:key       → remove runtime override
 *  POST /api/v1/config/reload     → trigger hot-reload from file/GCP
 *  GET  /api/v1/config/health     → liveness probe (no auth)
 *  GET  /api/v1/config/diff       → compare layers to show effective changes
 *
 * Usage
 * ─────
 *   const { getConfigServer } = require('./heady-config-server');
 *   const cfg = getConfigServer();
 *   await cfg.start();
 *
 *   const maxBees = cfg.get('conductor.maxBees');    // → 50
 *   cfg.watch('buddy.maxLog', (newVal) => console.log('maxLog changed:', newVal));
 *
 * ════════════════════════════════════════════════════════════════════
 */

'use strict';

const EventEmitter = require('events');
const fs           = require('fs');
const path         = require('path');
const crypto       = require('crypto');
const http         = require('http');
const https        = require('https');

// ─── Golden ratio — sacred, immutable, cannot be overridden at runtime ────────
const PHI = 1.6180339887;

// ─── Config reload interval: PHI × 60 000 ms ≈ 97 081 ms ────────────────────
const GCP_POLL_INTERVAL_MS = Math.round(PHI * 60_000);

// ─── Secret Manager project config ───────────────────────────────────────────
const GCP_PROJECT    = process.env.GCP_PROJECT    || 'heady-prod-609590223909';
const GCP_SECRET_IDS = (process.env.HEADY_SECRETS || '').split(',').filter(Boolean);

// ─── Default config file path ─────────────────────────────────────────────────
const DEFAULT_CONFIG_FILE = process.env.HEADY_CONFIG_FILE || '/etc/heady/config.json';

// ─── LAYER 0: Default values ──────────────────────────────────────────────────
//
// Every configurable constant from the Heady codebase, keyed by dotted path.
// Each entry includes: value, type, description, sourceFile, sourceLine, readonly.
//
const DEFAULTS = Object.freeze({

  // ── Sacred / Mathematical constants ────────────────────────────────────────
  'phi': {
    value: PHI,
    type: 'number',
    readonly: true,
    description: 'Golden ratio φ — used for timing, routing, and load-balancing.',
    sourceFile: 'ternary-logic.js',
    sourceLine: 8,
  },

  // ── heady-conductor.js ──────────────────────────────────────────────────────
  'conductor.maxBees': {
    value: 50,
    type: 'number',
    description: 'Maximum number of bees the conductor will spawn.',
    sourceFile: 'heady-conductor.js',
    sourceLine: 22,
  },
  'conductor.heartbeatIntervalMs': {
    value: 5_000,
    type: 'number',
    description: 'Conductor bee-health heartbeat interval in ms.',
    sourceFile: 'heady-conductor.js',
    sourceLine: 30,
  },
  'conductor.maxQueueDepth': {
    value: 500,
    type: 'number',
    description: 'Max tasks queued before backpressure kicks in.',
    sourceFile: 'heady-conductor.js',
    sourceLine: 35,
  },

  // ── hc-full-pipeline.js ─────────────────────────────────────────────────────
  'pipeline.maxConcurrentRuns': {
    value: 10,
    type: 'number',
    description: 'Maximum simultaneous pipeline runs (Map size cap).',
    sourceFile: 'hc-full-pipeline.js',
    sourceLine: 47,
  },
  'pipeline.runTtlMs': {
    value: 3_600_000,   // 1 hour
    type: 'number',
    description: 'TTL for completed run entries in the runs Map (memory leak fix).',
    sourceFile: 'hc-full-pipeline.js',
    sourceLine: 48,
  },
  'pipeline.arenaMinScoreThreshold': {
    value: 0.6,
    type: 'number',
    description: 'Minimum ARENA stage score to pass a candidate.',
    sourceFile: 'hc-full-pipeline.js',
    sourceLine: 200,
  },

  // ── self-awareness.js ───────────────────────────────────────────────────────
  'selfAwareness.driftThreshold': {
    value: 0.75,
    type: 'number',
    description: 'Cosine distance above which the awareness loop triggers a realignment.',
    sourceFile: 'self-awareness.js',
    sourceLine: 42,
  },
  'selfAwareness.heartbeatIntervalMs': {
    value: 30_000,
    type: 'number',
    description: 'Self-awareness telemetry heartbeat cadence in ms.',
    sourceFile: 'self-awareness.js',
    sourceLine: 41,
  },
  'selfAwareness.telemetryRingSize': {
    value: 500,
    type: 'number',
    description: 'Ring buffer size for telemetry snapshots.',
    sourceFile: 'self-awareness.js',
    sourceLine: 46,
  },
  'selfAwareness.brandingMonitorIntervalMs': {
    value: Math.round(PHI * 10_000),   // ≈ 16 180 ms
    type: 'number',
    description: 'Branding monitor polling interval (φ × 10 s).',
    sourceFile: 'self-awareness.js',
    sourceLine: 120,
  },

  // ── buddy-core.js ────────────────────────────────────────────────────────────
  'buddy.maxLog': {
    value: 200,
    type: 'number',
    description: 'Max metacognition log entries before rotation.',
    sourceFile: 'buddy-core.js',
    sourceLine: 28,
  },
  'buddy.taskLockTtlMs': {
    value: 30_000,
    type: 'number',
    description: 'TTL for task locks in TaskLockManager.',
    sourceFile: 'buddy-core.js',
    sourceLine: 26,
  },
  'buddy.maxReflectionDepth': {
    value: 5,
    type: 'number',
    description: 'Maximum recursive reflection depth in MetacognitionEngine.',
    sourceFile: 'buddy-core.js',
    sourceLine: 55,
  },
  'buddy.errorInterceptorPhases': {
    value: 5,
    type: 'number',
    readonly: true,
    description: 'Number of DeterministicErrorInterceptor phases (architectural constant).',
    sourceFile: 'buddy-core.js',
    sourceLine: 90,
  },

  // ── vector-memory.js ─────────────────────────────────────────────────────────
  'vectorMemory.defaultTopK': {
    value: 5,
    type: 'number',
    description: 'Default number of nearest neighbours returned by queryMemory().',
    sourceFile: 'vector-memory.js',
    sourceLine: 45,
  },
  'vectorMemory.maxEntries': {
    value: 10_000,
    type: 'number',
    description: 'Maximum number of vectors stored before eviction.',
    sourceFile: 'vector-memory.js',
    sourceLine: 30,
  },
  'vectorMemory.embeddingDimension': {
    value: 1536,
    type: 'number',
    description: 'Embedding dimension (OpenAI ada-002 / pgvector default).',
    sourceFile: 'vector-memory.js',
    sourceLine: 12,
  },

  // ── bee-factory.js ───────────────────────────────────────────────────────────
  'beeFactory.beesDir': {
    value: path.resolve(process.cwd(), 'bees'),
    type: 'string',
    description: 'Absolute path to the bees directory (FIXES __dirname bug in bee-factory.js:35).',
    sourceFile: 'bee-factory.js',
    sourceLine: 35,
  },
  'beeFactory.healthCheckTimeoutMs': {
    value: 5_000,
    type: 'number',
    description: 'Bee health-check HTTP timeout.',
    sourceFile: 'bee-factory.js',
    sourceLine: 90,
  },
  'beeFactory.maxRestartAttempts': {
    value: 3,
    type: 'number',
    description: 'Max restart attempts before marking a bee as dead.',
    sourceFile: 'bee-factory.js',
    sourceLine: 95,
  },

  // ── creative-engine.js ───────────────────────────────────────────────────────
  'creative.maxStyleBlend': {
    value: 3,
    type: 'number',
    description: 'Maximum number of styles to blend in one generation.',
    sourceFile: 'creative-engine.js',
    sourceLine: 40,
  },
  'creative.generationTimeoutMs': {
    value: 30_000,
    type: 'number',
    description: 'Timeout for a single creative generation call.',
    sourceFile: 'creative-engine.js',
    sourceLine: 55,
  },

  // ── edge-diffusion.js ────────────────────────────────────────────────────────
  'edgeDiffusion.realEndpoint': {
    value: process.env.EDGE_DIFFUSION_URL || 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
    type: 'string',
    description: 'Real HuggingFace / SDXL endpoint to replace the stub.',
    sourceFile: 'edge-diffusion.js',
    sourceLine: 14,
  },
  'edgeDiffusion.timeoutMs': {
    value: 60_000,
    type: 'number',
    description: 'Image generation HTTP timeout.',
    sourceFile: 'edge-diffusion.js',
    sourceLine: 20,
  },

  // ── ternary-logic.js ─────────────────────────────────────────────────────────
  'ternaryLogic.shadowIndexTtlMs': {
    value: 300_000,   // 5 minutes
    type: 'number',
    description: 'TTL for shadow index entries (fixes JSON.stringify comparison leak).',
    sourceFile: 'ternary-logic.js',
    sourceLine: 60,
  },

  // ── heady-service-mesh ───────────────────────────────────────────────────────
  'mesh.healthProbeIntervalMs': {
    value: Math.round(PHI * 10_000),  // ≈ 16 180 ms
    type: 'number',
    description: 'Service mesh health probe interval (φ × 10 s).',
    sourceFile: 'heady-service-mesh.js',
    sourceLine: 100,
  },
  'mesh.circuitBreakerThreshold': {
    value: 5,
    type: 'number',
    description: 'Consecutive failures before circuit trips to OPEN.',
    sourceFile: 'heady-service-mesh.js',
    sourceLine: 110,
  },
  'mesh.halfOpenProbeIntervalMs': {
    value: Math.round(PHI * PHI * 10_000),  // ≈ 26 180 ms
    type: 'number',
    description: 'HALF_OPEN probe interval (φ² × 10 s).',
    sourceFile: 'heady-service-mesh.js',
    sourceLine: 115,
  },

  // ── heady-event-bus ──────────────────────────────────────────────────────────
  'eventBus.replayBufferSize': {
    value: 100,
    type: 'number',
    description: 'Number of events to retain per topic for replay.',
    sourceFile: 'heady-event-bus.js',
    sourceLine: 90,
  },
  'eventBus.deadLetterMaxRetries': {
    value: 3,
    type: 'number',
    description: 'Max delivery retries before moving event to dead-letter queue.',
    sourceFile: 'heady-event-bus.js',
    sourceLine: 95,
  },

  // ── API / Gateway ─────────────────────────────────────────────────────────────
  'gateway.port': {
    value: parseInt(process.env.PORT || '8080', 10),
    type: 'number',
    description: 'HTTP port for the API gateway (Cloud Run uses 8080).',
    sourceFile: 'PRODUCTION_DEPLOYMENT_GUIDE.md',
    sourceLine: 88,
  },
  'gateway.rateLimitWindowMs': {
    value: 60_000,
    type: 'number',
    description: 'Rate-limit sliding window in ms.',
    sourceFile: 'heady-api-gateway-v2.js',
    sourceLine: 60,
  },
  'gateway.rateLimitMaxRequests': {
    value: 100,
    type: 'number',
    description: 'Max requests per window per IP for anonymous users.',
    sourceFile: 'heady-api-gateway-v2.js',
    sourceLine: 61,
  },
  'gateway.jwtSecret': {
    value: process.env.JWT_SECRET || '',
    type: 'string',
    secret: true,
    description: 'JWT signing secret — MUST be set in production via GCP Secret Manager.',
    sourceFile: 'PRODUCTION_DEPLOYMENT_GUIDE.md',
    sourceLine: 200,
  },

  // ── Infrastructure ────────────────────────────────────────────────────────────
  'infra.cloudRunUrl': {
    value: process.env.CLOUD_RUN_URL || 'https://heady-manager-609590223909.us-central1.run.app',
    type: 'string',
    description: 'Primary Cloud Run service URL.',
    sourceFile: 'PRODUCTION_DEPLOYMENT_GUIDE.md',
    sourceLine: 44,
  },
  'infra.redisUrl': {
    value: process.env.REDIS_URL || 'redis://localhost:6379',
    type: 'string',
    secret: true,
    description: 'Redis connection URL (Cloud Memorystore in production).',
    sourceFile: 'PRODUCTION_DEPLOYMENT_GUIDE.md',
    sourceLine: 180,
  },
  'infra.postgresUrl': {
    value: process.env.DATABASE_URL || 'postgresql://localhost:5432/heady',
    type: 'string',
    secret: true,
    description: 'PostgreSQL connection URL (Cloud SQL in production).',
    sourceFile: 'PRODUCTION_DEPLOYMENT_GUIDE.md',
    sourceLine: 170,
  },
  'infra.gcpProject': {
    value: GCP_PROJECT,
    type: 'string',
    description: 'GCP project ID.',
    sourceFile: 'heady-registry.json',
    sourceLine: 5,
  },
  'infra.gcpRegion': {
    value: process.env.GCP_REGION || 'us-central1',
    type: 'string',
    description: 'GCP region for Cloud Run and Pub/Sub.',
    sourceFile: 'PRODUCTION_DEPLOYMENT_GUIDE.md',
    sourceLine: 50,
  },
  'infra.pubsubTopicTasks': {
    value: 'heady-swarm-tasks',
    type: 'string',
    description: 'GCP Pub/Sub topic for swarm task distribution.',
    sourceFile: 'heady-registry.json',
    sourceLine: 35,
  },
  'infra.pubsubTopicAdmin': {
    value: 'heady-admin-triggers',
    type: 'string',
    description: 'GCP Pub/Sub topic for administrative triggers.',
    sourceFile: 'heady-registry.json',
    sourceLine: 36,
  },
  'infra.pubsubTopicDeadLetter': {
    value: 'heady-dead-letter',
    type: 'string',
    description: 'GCP Pub/Sub dead-letter topic.',
    sourceFile: 'heady-registry.json',
    sourceLine: 37,
  },
});

// ─── Type coercions ───────────────────────────────────────────────────────────
function coerce(raw, type) {
  if (raw === undefined || raw === null) return raw;
  switch (type) {
    case 'number':  return Number(raw);
    case 'boolean': return raw === 'true' || raw === true || raw === 1;
    case 'string':  return String(raw);
    default:        return raw;
  }
}

// ─── Env-key mapper (conductor.maxBees → HEADY_CONDUCTOR_MAX_BEES) ────────────
function toEnvKey(dotKey) {
  return 'HEADY_' + dotKey.replace(/\./g, '_').replace(/([A-Z])/g, '_$1').toUpperCase();
}

// ─── Deep clone (no external deps) ───────────────────────────────────────────
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ─── GCP Secret Manager: single secret value via metadata server ──────────────
async function fetchGcpSecret(secretId, projectId) {
  return new Promise((resolve, reject) => {
    const url = `https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets/${secretId}/versions/latest:access`;
    const token = process.env.GCP_ACCESS_TOKEN; // injected by Workload Identity
    if (!token) return resolve(null); // no token in local dev — skip silently

    const options = {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5_000,
    };
    https.get(url, options, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const decoded = Buffer.from(parsed.payload?.data || '', 'base64').toString('utf8');
          resolve(decoded || null);
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

// ─── ConfigServer ─────────────────────────────────────────────────────────────

class ConfigServer extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.setMaxListeners(100);

    this._opts = {
      configFile:     opts.configFile     ?? DEFAULT_CONFIG_FILE,
      gcpProject:     opts.gcpProject     ?? GCP_PROJECT,
      gcpSecretIds:   opts.gcpSecretIds   ?? GCP_SECRET_IDS,
      pollIntervalMs: opts.pollIntervalMs ?? GCP_POLL_INTERVAL_MS,
      enableFileWatch: opts.enableFileWatch !== false,
      enableGcpPoll:   opts.enableGcpPoll  !== false,
    };

    // Resolved config cache — merged across all layers
    this._cache = {};
    // Layer 3 — GCP secrets (dotKey → string value)
    this._gcpLayer = {};
    // Layer 4 — runtime overrides
    this._runtimeLayer = {};
    // Watchers: dotKey → Set<Function>
    this._watchers = new Map();
    // fs.FSWatcher reference
    this._fsWatcher = null;
    // GCP poll timer
    this._gcpPollTimer = null;
    // Whether start() has been called
    this._started = false;
    // Config file layer-2 snapshot
    this._fileLayer = {};
    // Checksum of last-read config file
    this._fileChecksum = null;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  async start() {
    if (this._started) return this;
    this._started = true;

    // Layer 1 — env vars (read on start; process.env is live so just re-resolve on reload)
    // Layer 2 — config file
    await this._loadFile();
    // Layer 3 — GCP secrets
    await this._loadGcpSecrets();

    this._rebuildCache();

    if (this._opts.enableFileWatch) this._startFileWatch();
    if (this._opts.enableGcpPoll)   this._startGcpPoll();

    this.emit('config:ready', { keys: Object.keys(this._cache).length });
    return this;
  }

  stop() {
    if (this._fsWatcher)   { this._fsWatcher.close();        this._fsWatcher   = null; }
    if (this._gcpPollTimer){ clearInterval(this._gcpPollTimer); this._gcpPollTimer = null; }
    this._started = false;
    this.emit('config:stopped');
  }

  // ── Read API ─────────────────────────────────────────────────────────────────

  /**
   * Get a config value by dotted key.
   * @param {string} key          e.g. 'buddy.maxLog'
   * @param {*}      [fallback]   returned if key is missing entirely
   */
  get(key, fallback) {
    this._assertStarted();
    if (Object.prototype.hasOwnProperty.call(this._cache, key)) {
      return this._cache[key];
    }
    return fallback;
  }

  /**
   * Get all config keys matching a namespace prefix.
   * @param {string} prefix  e.g. 'buddy' → all 'buddy.*' keys
   * @returns {Object}
   */
  getNamespace(prefix) {
    this._assertStarted();
    const result = {};
    for (const [k, v] of Object.entries(this._cache)) {
      if (k === prefix || k.startsWith(prefix + '.')) {
        result[k] = v;
      }
    }
    return result;
  }

  /**
   * Get full config snapshot (redacts secret values).
   */
  getAll(opts = { includeSecrets: false }) {
    this._assertStarted();
    const result = {};
    for (const [k, v] of Object.entries(this._cache)) {
      const meta = DEFAULTS[k];
      if (meta?.secret && !opts.includeSecrets) {
        result[k] = '[REDACTED]';
      } else {
        result[k] = v;
      }
    }
    return result;
  }

  /**
   * Get config metadata for a key (type, description, sourceFile, etc.)
   */
  getMeta(key) {
    return DEFAULTS[key] || null;
  }

  // ── Watch API ────────────────────────────────────────────────────────────────

  /**
   * Watch a specific config key for changes.
   * @param {string}   key
   * @param {Function} handler  (newValue, oldValue, key) => void
   */
  watch(key, handler) {
    if (!this._watchers.has(key)) this._watchers.set(key, new Set());
    this._watchers.get(key).add(handler);
    return () => this._watchers.get(key)?.delete(handler); // returns unsubscribe fn
  }

  /**
   * Watch all keys in a namespace prefix.
   */
  watchNamespace(prefix, handler) {
    const unsubFns = [];
    for (const key of Object.keys(DEFAULTS)) {
      if (key === prefix || key.startsWith(prefix + '.')) {
        unsubFns.push(this.watch(key, handler));
      }
    }
    return () => unsubFns.forEach((fn) => fn());
  }

  // ── Write API (Layer 4 — runtime) ────────────────────────────────────────────

  /**
   * Set a runtime override. Triggers watchers if value changed.
   * @param {string} key
   * @param {*}      value
   * @throws {Error} if key is readonly (e.g. phi, buddy.errorInterceptorPhases)
   */
  set(key, value) {
    const meta = DEFAULTS[key];
    if (meta?.readonly) {
      throw new Error(`[ConfigServer] '${key}' is a readonly constant and cannot be overridden at runtime.`);
    }
    const typedValue = meta ? coerce(value, meta.type) : value;
    const old = this._cache[key];
    this._runtimeLayer[key] = typedValue;
    this._rebuildCache([key]);
    if (old !== this._cache[key]) {
      this._notifyWatchers(key, this._cache[key], old);
    }
    return this;
  }

  /**
   * Remove a runtime override, reverting to lower layers.
   */
  unset(key) {
    const old = this._cache[key];
    delete this._runtimeLayer[key];
    this._rebuildCache([key]);
    if (old !== this._cache[key]) {
      this._notifyWatchers(key, this._cache[key], old);
    }
    return this;
  }

  // ── Hot-reload ───────────────────────────────────────────────────────────────

  async reload() {
    const prev = deepClone(this._cache);
    await this._loadFile();
    await this._loadGcpSecrets();
    this._rebuildCache();
    this._emitDiffs(prev, this._cache);
    this.emit('config:reloaded');
    return this;
  }

  /**
   * Compute diff between current and what-would-be if a new file were applied.
   */
  diff() {
    const effective = this.getAll({ includeSecrets: false });
    const defaults  = {};
    for (const [k, meta] of Object.entries(DEFAULTS)) {
      defaults[k] = meta.secret ? '[REDACTED]' : meta.value;
    }
    const changed = {};
    for (const k of new Set([...Object.keys(effective), ...Object.keys(defaults)])) {
      if (effective[k] !== defaults[k]) {
        changed[k] = { default: defaults[k], effective: effective[k] };
      }
    }
    return changed;
  }

  // ── Express Router ────────────────────────────────────────────────────────────

  /**
   * Returns an Express 4 router for mounting at /api/v1/config.
   * Caller is responsible for applying admin auth middleware before this router.
   */
  router() {
    // Lazy-require Express to avoid hard dependency at module load time
    const express = require('express');
    const router  = express.Router();

    // Health probe — no auth required
    router.get('/health', (_req, res) => {
      res.json({
        status: 'ok',
        started: this._started,
        keys: Object.keys(this._cache).length,
        layers: {
          defaults: Object.keys(DEFAULTS).length,
          env: this._countEnvOverrides(),
          file: Object.keys(this._fileLayer).length,
          gcp: Object.keys(this._gcpLayer).length,
          runtime: Object.keys(this._runtimeLayer).length,
        },
      });
    });

    // Full config dump (admin only)
    router.get('/', (req, res) => {
      const includeSecrets = req.query.secrets === 'true';
      res.json(this.getAll({ includeSecrets }));
    });

    // Diff vs defaults
    router.get('/diff', (_req, res) => {
      res.json(this.diff());
    });

    // Single key
    router.get('/:key', (req, res) => {
      const { key } = req.params;
      const value = this.get(key);
      if (value === undefined) return res.status(404).json({ error: `Key '${key}' not found.` });
      const meta = this.getMeta(key);
      if (meta?.secret) return res.json({ key, value: '[REDACTED]' });
      res.json({ key, value, meta });
    });

    // Runtime override
    router.put('/:key', express.json(), (req, res) => {
      const { key } = req.params;
      const { value } = req.body;
      if (value === undefined) return res.status(400).json({ error: 'Body must include { value }.' });
      try {
        this.set(key, value);
        res.json({ ok: true, key, value: this.get(key) });
      } catch (err) {
        res.status(403).json({ error: err.message });
      }
    });

    // Remove runtime override
    router.delete('/:key', (req, res) => {
      this.unset(req.params.key);
      res.json({ ok: true, key: req.params.key, reverted: this.get(req.params.key) });
    });

    // Force reload
    router.post('/reload', async (_req, res) => {
      try {
        await this.reload();
        res.json({ ok: true, keys: Object.keys(this._cache).length });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    return router;
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  _assertStarted() {
    if (!this._started) {
      throw new Error('[ConfigServer] call await cfg.start() before reading config.');
    }
  }

  /**
   * Build merged cache from all layers. If dirtyKeys provided, only re-resolve those.
   */
  _rebuildCache(dirtyKeys) {
    const keys = dirtyKeys || Object.keys(DEFAULTS);
    for (const key of keys) {
      const meta = DEFAULTS[key];
      if (!meta) continue;

      // Layer 0 — default
      let value = meta.value;

      // Layer 1 — env var
      const envKey = toEnvKey(key);
      if (process.env[envKey] !== undefined) {
        value = coerce(process.env[envKey], meta.type);
      }

      // Layer 2 — file
      if (Object.prototype.hasOwnProperty.call(this._fileLayer, key)) {
        value = coerce(this._fileLayer[key], meta.type);
      }

      // Layer 3 — GCP secret
      if (Object.prototype.hasOwnProperty.call(this._gcpLayer, key)) {
        value = coerce(this._gcpLayer[key], meta.type);
      }

      // Layer 4 — runtime (readonly keys cannot be overridden — enforced in set())
      if (Object.prototype.hasOwnProperty.call(this._runtimeLayer, key)) {
        value = this._runtimeLayer[key];
      }

      this._cache[key] = value;
    }
  }

  async _loadFile() {
    const filePath = this._opts.configFile;
    if (!fs.existsSync(filePath)) return;

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const checksum = crypto.createHash('sha256').update(raw).digest('hex');
      if (checksum === this._fileChecksum) return; // unchanged
      this._fileChecksum = checksum;
      const parsed = JSON.parse(raw);
      this._fileLayer = parsed;
    } catch (err) {
      this.emit('config:error', { source: 'file', error: err.message });
    }
  }

  async _loadGcpSecrets() {
    if (!this._opts.gcpSecretIds.length) return;
    for (const secretId of this._opts.gcpSecretIds) {
      try {
        const raw = await fetchGcpSecret(secretId, this._opts.gcpProject);
        if (raw === null) continue;
        // Each secret is expected to be a JSON object mapping dotKey → value
        const parsed = JSON.parse(raw);
        Object.assign(this._gcpLayer, parsed);
      } catch (err) {
        this.emit('config:error', { source: 'gcp', secretId, error: err.message });
      }
    }
  }

  _startFileWatch() {
    const filePath = this._opts.configFile;
    if (!fs.existsSync(path.dirname(filePath))) return;

    try {
      this._fsWatcher = fs.watch(filePath, { persistent: false }, async (eventType) => {
        if (eventType === 'change') {
          const prev = deepClone(this._cache);
          await this._loadFile();
          this._rebuildCache();
          this._emitDiffs(prev, this._cache);
          this.emit('config:file:reloaded');
        }
      });
    } catch {
      // File may not exist yet in dev — that's fine
    }
  }

  _startGcpPoll() {
    this._gcpPollTimer = setInterval(async () => {
      const prev = deepClone(this._cache);
      await this._loadGcpSecrets();
      this._rebuildCache();
      this._emitDiffs(prev, this._cache);
    }, this._opts.pollIntervalMs);
    if (this._gcpPollTimer.unref) this._gcpPollTimer.unref();
  }

  _emitDiffs(prev, next) {
    for (const key of new Set([...Object.keys(prev), ...Object.keys(next)])) {
      if (prev[key] !== next[key]) {
        this._notifyWatchers(key, next[key], prev[key]);
        this.emit('config:changed', { key, oldValue: prev[key], newValue: next[key] });
      }
    }
  }

  _notifyWatchers(key, newVal, oldVal) {
    const handlers = this._watchers.get(key);
    if (handlers) {
      for (const fn of handlers) {
        try { fn(newVal, oldVal, key); } catch { /* swallow watcher errors */ }
      }
    }
  }

  _countEnvOverrides() {
    let count = 0;
    for (const key of Object.keys(DEFAULTS)) {
      if (process.env[toEnvKey(key)] !== undefined) count++;
    }
    return count;
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _instance = null;

/**
 * Returns the singleton ConfigServer instance.
 * Call await cfg.start() once at application bootstrap.
 *
 * @param {Object} [opts]  Override options (only honoured on first call)
 * @returns {ConfigServer}
 */
function getConfigServer(opts) {
  if (!_instance) _instance = new ConfigServer(opts);
  return _instance;
}

/**
 * Reset singleton — only for use in tests.
 */
function _resetConfigServerForTests() {
  if (_instance) _instance.stop();
  _instance = null;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  ConfigServer,
  getConfigServer,
  _resetConfigServerForTests,
  DEFAULTS,
  PHI,
  // Convenience re-export so callers can do:
  //   const { KNOWN_KEYS } = require('./heady-config-server');
  KNOWN_KEYS: Object.freeze(Object.keys(DEFAULTS)),
};

// ─── Self-test (node heady-config-server.js) ──────────────────────────────────
if (require.main === module) {
  (async () => {
    const cfg = getConfigServer({ configFile: '/tmp/heady-test-config.json' });
    await cfg.start();

    console.log('=== HeadyConfigServer self-test ===');
    console.log('buddy.maxLog         :', cfg.get('buddy.maxLog'));
    console.log('conductor.maxBees    :', cfg.get('conductor.maxBees'));
    console.log('selfAwareness.drift  :', cfg.get('selfAwareness.driftThreshold'));
    console.log('phi (readonly)       :', cfg.get('phi'));

    cfg.watch('buddy.maxLog', (nv, ov) => console.log(`buddy.maxLog changed: ${ov} → ${nv}`));
    cfg.set('buddy.maxLog', 400);
    console.log('After runtime set    :', cfg.get('buddy.maxLog'));

    try {
      cfg.set('phi', 3.14);
    } catch (err) {
      console.log('Readonly guard OK    :', err.message);
    }

    console.log('Diff vs defaults     :', cfg.diff());
    cfg.stop();
  })().catch(console.error);
}
