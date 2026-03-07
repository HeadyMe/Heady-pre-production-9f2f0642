/**
 * @file heady-system.js
 * @description Heady Zero-Dependency Master System Integration
 *
 * The single entry point that wires all 13 layers together into one
 * cohesive system.  Provides:
 *
 *   - HeadySystem.boot(role?)  — starts the full system for this node role
 *   - HeadySystem.shutdown()   — graceful LIFO teardown of all layers
 *   - HeadySystem.health()     — aggregated health across all subsystems
 *   - HeadySystem.status       — live system status object
 *
 * Role-based initialization — only the services appropriate for this
 * node's role are started, keeping each Colab instance lean:
 *
 *   BRAIN     → core + memory + intelligence + providers + services (LLM)
 *   CONDUCTOR → core + orchestration + pipeline + bees
 *   SENTINEL  → core + resilience + security + telemetry + governance
 *   STANDALONE→ all layers (development / single-machine mode)
 *
 * Sacred Geometry:
 *   PHI (φ = 1.618…) governs all timing, backoff, retry, and pool sizing.
 *   The 3-node cluster maps to: BRAIN (hub) → CONDUCTOR (ring) → SENTINEL (shell)
 *
 * Zero external dependencies — Node.js 22 built-ins only.
 *
 * @module HeadySystem
 * @version 1.0.0
 * @example
 * // Start the full system for this node's role (from HEADY_NODE_ROLE env var)
 * import { HeadySystem } from './heady-system.js';
 * const system = await HeadySystem.boot();
 * console.log(system.status);
 *
 * @example
 * // Start a specific role explicitly
 * import { HeadySystem } from './heady-system.js';
 * const system = await HeadySystem.boot('brain');
 * await system.shutdown();
 */

// ─── Node.js version guard ────────────────────────────────────────────────────

const [major] = process.versions.node.split('.').map(Number);
if (major < 22) {
  console.error(`[HeadySystem] Node.js 22+ required. Found: ${process.version}`);
  process.exit(1);
}

// ─── Sacred Geometry Constants ────────────────────────────────────────────────

/** Golden ratio φ = (1 + √5) / 2 */
export const PHI = 1.6180339887498948482;

/** First 15 Fibonacci numbers */
export const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

/**
 * PHI-scaled exponential backoff
 * @param {number} n - attempt index (0-based)
 * @param {number} [base=1000] - base delay ms
 * @returns {number}
 */
export function phiBackoff(n, base = 1000) {
  return Math.floor(Math.pow(PHI, n) * base);
}

/** @type {string} */
export const VERSION = '1.0.0';

// ─── Layer Imports ────────────────────────────────────────────────────────────
// All imports are lazy (dynamic) so unused layers never load on disk.
// Static imports are only for the types used at module-level.

/**
 * Lazy-import a layer module.
 * @param {string} specifier
 * @returns {Promise<object>}
 */
async function importLayer(specifier) {
  try {
    return await import(specifier);
  } catch (err) {
    throw new Error(`[HeadySystem] Failed to import layer "${specifier}": ${err.message}`);
  }
}

// ─── Role Definitions ─────────────────────────────────────────────────────────

/**
 * Layers loaded per node role.
 * Order matters — dependencies must be loaded before consumers.
 */
const ROLE_LAYERS = {
  /** BRAIN: Central hub — vector memory, embeddings, LLM routing */
  brain: [
    'config',
    'utils',
    'core',
    'memory',
    'intelligence',
    'providers',
    'services',
  ],

  /** CONDUCTOR: Inner ring — task routing, pipelines, bees, swarm */
  conductor: [
    'config',
    'utils',
    'core',
    'orchestration',
    'pipeline',
    'bees',
  ],

  /** SENTINEL: Governance shell — security, resilience, telemetry, governance */
  sentinel: [
    'config',
    'utils',
    'core',
    'resilience',
    'security',
    'telemetry',
    'governance',
  ],

  /** STANDALONE: All layers (local dev / single-machine testing) */
  standalone: [
    'config',
    'utils',
    'core',
    'memory',
    'orchestration',
    'pipeline',
    'bees',
    'resilience',
    'security',
    'intelligence',
    'governance',
    'services',
    'telemetry',
    'runtime',
    'providers',
  ],
};

// ─── Port Map ──────────────────────────────────────────────────────────────────

const PORT_MAP = {
  brain:     3001,
  conductor: 3002,
  sentinel:  3003,
  standalone: 3000,
};

const BRIDGE_PORT_MAP = {
  brain:     9101,
  conductor: 9102,
  sentinel:  9103,
  standalone: 9100,
};

// ─── HeadySystem ──────────────────────────────────────────────────────────────

/**
 * Master system orchestrator for the Heady Zero-Dep architecture.
 *
 * Instantiate via the static `boot()` factory method rather than
 * directly calling `new HeadySystem()`.
 *
 * @class
 */
export class HeadySystem {
  /**
   * @param {object} opts
   * @param {string} opts.role
   * @param {string} opts.nodeId
   * @param {number} opts.port
   * @param {number} opts.bridgePort
   * @param {string} opts.dataDir
   */
  constructor(opts) {
    /** @type {string} */
    this.role = opts.role;

    /** @type {string} */
    this.nodeId = opts.nodeId;

    /** @type {number} */
    this.port = opts.port;

    /** @type {number} */
    this.bridgePort = opts.bridgePort;

    /** @type {string} */
    this.dataDir = opts.dataDir;

    /** @type {boolean} */
    this.booted = false;

    /** @type {Map<string, object>} loaded layer modules */
    this._layers = new Map();

    /** @type {Array<{name: string, instance: object}>} started services in start order */
    this._started = [];

    /** @type {object|null} */
    this._runtime = null;   // HeadyCore Runtime

    /** @type {object|null} */
    this._memory = null;    // MemorySystem

    /** @type {object|null} */
    this._orchestration = null; // OrchestrationLayer

    /** @type {object|null} */
    this._pipeline = null;

    /** @type {object|null} */
    this._bees = null;

    /** @type {object|null} */
    this._resilience = null;

    /** @type {object|null} */
    this._security = null;

    /** @type {object|null} */
    this._intelligence = null;

    /** @type {object|null} */
    this._governance = null;

    /** @type {object|null} */
    this._telemetry = null;

    /** @type {object|null} */
    this._services = null;

    /** @type {object|null} */
    this._colabRuntime = null;

    /** @type {number} */
    this._bootedAt = 0;

    this._healthTimer = null;
  }

  // ─── Static Factory ──────────────────────────────────────────────────────────

  /**
   * Boot the Heady system.
   *
   * Reads HEADY_NODE_ROLE from the environment (or `role` parameter),
   * loads all appropriate layers, wires them together, and starts the
   * HTTP/WebSocket server.
   *
   * @param {string} [role] - Override role (default: HEADY_NODE_ROLE env var or 'standalone')
   * @param {object} [opts] - Additional options
   * @param {number} [opts.port] - HTTP port override
   * @param {string} [opts.dataDir] - Data directory override
   * @param {boolean} [opts.startBridge] - Start EventBridge server (default: true)
   * @returns {Promise<HeadySystem>}
   */
  static async boot(role, opts = {}) {
    const resolvedRole = (role || process.env.HEADY_NODE_ROLE || 'standalone').toLowerCase();

    if (!ROLE_LAYERS[resolvedRole]) {
      throw new Error(
        `[HeadySystem] Unknown role "${resolvedRole}". ` +
        `Valid roles: ${Object.keys(ROLE_LAYERS).join(', ')}`
      );
    }

    const envPort = parseInt(process.env.HEADY_PORT || '') || PORT_MAP[resolvedRole];
    const port = opts.port != null ? opts.port : envPort;
    const bridgePort = parseInt(process.env.HEADY_BRIDGE_PORT || '') || BRIDGE_PORT_MAP[resolvedRole];
    const nodeId = process.env.HEADY_NODE_ID || `heady-${resolvedRole}-${process.pid}`;
    const dataDir = opts.dataDir ?? process.env.HEADY_DATA_DIR ?? `./data/${resolvedRole}`;

    const system = new HeadySystem({ role: resolvedRole, nodeId, port, bridgePort, dataDir });

    await system._boot(opts);
    return system;
  }

  // ─── Boot Sequence ────────────────────────────────────────────────────────────

  /**
   * Internal boot sequence.
   * @private
   * @param {object} opts
   */
  async _boot(opts = {}) {
    const t0 = Date.now();
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  HEADY SYSTEM  ✦  ${this.role.toUpperCase()}  (v${VERSION})`);
    console.log(`  φ = ${PHI}  │  Zero Dependencies`);
    console.log(`${'═'.repeat(60)}\n`);

    const layers = ROLE_LAYERS[this.role];
    console.log(`[HeadySystem] Loading layers for role "${this.role}": ${layers.join(', ')}\n`);

    // ── 1. Load all layer modules ──────────────────────────────────────────
    for (const layer of layers) {
      await this._loadLayer(layer);
    }

    // ── 2. Initialize Core Runtime ────────────────────────────────────────
    if (this._layers.has('core')) {
      await this._initCore(opts);
    }

    // ── 3. Initialize Memory (BRAIN / STANDALONE) ─────────────────────────
    if (this._layers.has('memory')) {
      await this._initMemory();
    }

    // ── 4. Initialize Orchestration (CONDUCTOR / STANDALONE) ──────────────
    if (this._layers.has('orchestration')) {
      await this._initOrchestration();
    }

    // ── 5. Initialize Pipeline (CONDUCTOR / STANDALONE) ───────────────────
    if (this._layers.has('pipeline')) {
      await this._initPipeline();
    }

    // ── 6. Initialize Bees (CONDUCTOR / STANDALONE) ───────────────────────
    if (this._layers.has('bees')) {
      await this._initBees();
    }

    // ── 7. Initialize Resilience (SENTINEL / STANDALONE) ──────────────────
    if (this._layers.has('resilience')) {
      await this._initResilience();
    }

    // ── 8. Initialize Security (SENTINEL / STANDALONE) ────────────────────
    if (this._layers.has('security')) {
      await this._initSecurity();
    }

    // ── 9. Initialize Intelligence (BRAIN / STANDALONE) ───────────────────
    if (this._layers.has('intelligence')) {
      await this._initIntelligence();
    }

    // ── 10. Initialize Governance (SENTINEL / STANDALONE) ─────────────────
    if (this._layers.has('governance')) {
      await this._initGovernance();
    }

    // ── 11. Initialize Telemetry (SENTINEL / STANDALONE) ──────────────────
    if (this._layers.has('telemetry')) {
      await this._initTelemetry();
    }

    // ── 12. Initialize Services (BRAIN / STANDALONE) ──────────────────────
    if (this._layers.has('services')) {
      await this._initServices();
    }

    // ── 13. Initialize Colab Runtime (always) ────────────────────────────
    if (this._layers.has('runtime')) {
      await this._initColabRuntime();
    }

    // ── 14. Wire inter-node mesh ──────────────────────────────────────────
    await this._wireMesh();

    // ── 15. Register health endpoint ─────────────────────────────────────
    this._registerHealthEndpoint();

    // ── 16. Start PHI-scaled health monitor ──────────────────────────────
    this._startHealthMonitor();

    // ── 17. Register graceful shutdown handlers ───────────────────────────
    this._registerShutdownHandlers();

    this.booted = true;
    this._bootedAt = t0;

    const elapsed = Date.now() - t0;
    console.log(`\n[HeadySystem] ✓ Boot complete in ${elapsed}ms`);
    console.log(`[HeadySystem]   Role: ${this.role.toUpperCase()}`);
    console.log(`[HeadySystem]   Node: ${this.nodeId}`);
    console.log(`[HeadySystem]   Port: ${this.port}`);
    console.log(`[HeadySystem]   PHI-pulse: ${Math.floor(Math.pow(PHI, 5) * 1000)}ms\n`);
  }

  // ─── Layer Loaders ────────────────────────────────────────────────────────────

  /**
   * Load a layer by name and cache it in `_layers`.
   * @private
   * @param {string} name
   */
  async _loadLayer(name) {
    const specifier = `./${name}/index.js`;
    console.log(`[HeadySystem]   ↓ ${name}`);
    const mod = await importLayer(new URL(specifier, import.meta.url).pathname);
    this._layers.set(name, mod);
  }

  // ─── Service Initializers ─────────────────────────────────────────────────────

  /** @private */
  async _initCore(opts) {
    const { Runtime, createClusterNode } = this._layers.get('core');
    console.log(`[HeadySystem] Starting Core Runtime on port ${this.port}…`);

    const runtime = createClusterNode(this.role === 'standalone' ? 'brain' : this.role, {
      port: this.port,
      nodeId: this.nodeId,
      bridgePort: this.bridgePort,
      startBridge: opts.startBridge !== false,
      walPath: `${this.dataDir}/events.wal`,
    });

    const info = await runtime.start();
    this._runtime = runtime;
    this._started.push({ name: 'core-runtime', instance: runtime });
    console.log(`[HeadySystem]   ✓ Core Runtime: port=${info.port} nodeId=${info.nodeId}`);
  }

  /** @private */
  async _initMemory() {
    const { createMemorySystem } = this._layers.get('memory');
    console.log(`[HeadySystem] Starting Memory System…`);

    this._memory = await createMemorySystem({
      dataDir: `${this.dataDir}/memory`,
      nodeId: this.nodeId,
      metric: 'cosine',
      sharding: true,
      autoDream: true,
      embedding: {
        provider: process.env.HEADY_EMBED_MODEL || 'local',
        batchSize: parseInt(process.env.HEADY_EMBED_BATCH_SIZE || '32'),
      },
    });

    this._started.push({ name: 'memory', instance: this._memory });
    const stats = this._memory.stats();
    console.log(`[HeadySystem]   ✓ Memory: vectorDb=${stats.vectorDb?.size ?? 0} vectors`);
  }

  /** @private */
  async _initOrchestration() {
    const { createOrchestrationLayer } = this._layers.get('orchestration');
    console.log(`[HeadySystem] Starting Orchestration Layer…`);

    this._orchestration = await createOrchestrationLayer({
      nodeId: this.nodeId,
      maxBees: parseInt(process.env.HEADY_MAX_BEES || '13'),
      brainUrl: process.env.HEADY_BRAIN_URL,
    });

    await this._orchestration.start?.();
    this._started.push({ name: 'orchestration', instance: this._orchestration });
    console.log(`[HeadySystem]   ✓ Orchestration: conductor + swarm + buddy`);
  }

  /** @private */
  async _initPipeline() {
    const pipelineMod = this._layers.get('pipeline');
    console.log(`[HeadySystem] Starting Pipeline…`);

    // Pipeline core
    if (pipelineMod.PipelineCore) {
      this._pipeline = new pipelineMod.PipelineCore({
        concurrency: parseInt(process.env.HEADY_PIPELINE_CONCURRENCY || '5'),
        timeoutMs: parseInt(process.env.HEADY_PIPELINE_TIMEOUT_MS || '30000'),
        nodeId: this.nodeId,
        brainUrl: process.env.HEADY_BRAIN_URL,
      });
      await this._pipeline.init?.();
      this._started.push({ name: 'pipeline', instance: this._pipeline });
      console.log(`[HeadySystem]   ✓ Pipeline: concurrency=${process.env.HEADY_PIPELINE_CONCURRENCY || 5}`);
    } else {
      console.log(`[HeadySystem]   ℹ Pipeline module has no PipelineCore export — skipping`);
    }
  }

  /** @private */
  async _initBees() {
    const beesMod = this._layers.get('bees');
    console.log(`[HeadySystem] Starting Bee Factory…`);

    if (beesMod.BeeFactory) {
      this._bees = new beesMod.BeeFactory({
        maxBees: parseInt(process.env.HEADY_MAX_BEES || '13'),
        brainUrl: process.env.HEADY_BRAIN_URL,
        nodeId: this.nodeId,
      });
      await this._bees.init?.();
      this._started.push({ name: 'bees', instance: this._bees });
      console.log(`[HeadySystem]   ✓ Bee Factory: max=${process.env.HEADY_MAX_BEES || 13} bees`);
    } else {
      console.log(`[HeadySystem]   ℹ Bees module has no BeeFactory export — skipping`);
    }
  }

  /** @private */
  async _initResilience() {
    const { CircuitBreaker } = this._layers.get('resilience');
    console.log(`[HeadySystem] Starting Resilience Layer…`);

    // Circuit breaker for each peer node
    const peerUrls = {
      brain:     process.env.HEADY_BRAIN_URL,
      conductor: process.env.HEADY_CONDUCTOR_URL,
    };

    this._resilience = { circuitBreakers: {}, peerUrls };
    for (const [peer, url] of Object.entries(peerUrls)) {
      if (url) {
        this._resilience.circuitBreakers[peer] = new CircuitBreaker({
          name: `${peer}-circuit`,
          failureThreshold: parseInt(process.env.HEADY_CB_FAILURE_THRESHOLD || '5'),
          successThreshold: parseInt(process.env.HEADY_CB_SUCCESS_THRESHOLD || '2'),
          timeout: parseInt(process.env.HEADY_CB_TIMEOUT_MS || '17944'),
        });
      }
    }

    this._started.push({ name: 'resilience', instance: this._resilience });
    console.log(`[HeadySystem]   ✓ Resilience: circuit breakers for [${Object.keys(peerUrls).filter(k => peerUrls[k]).join(', ')}]`);
  }

  /** @private */
  async _initSecurity() {
    const secMod = this._layers.get('security');
    console.log(`[HeadySystem] Starting Security Layer…`);

    const securityMode = process.env.HEADY_SECURITY_MODE || 'strict';

    // Env validation
    if (secMod.EnvValidator) {
      const validator = new secMod.EnvValidator({ strict: securityMode === 'strict' });
      const issues = await validator.validate?.() ?? [];
      if (issues.length > 0) {
        issues.forEach(i => console.warn(`[HeadySystem]   ⚠ Security: ${i}`));
      }
    }

    // PQC handshake setup
    if (secMod.PQCHandshake) {
      this._security = new secMod.PQCHandshake({ nodeId: this.nodeId });
      await this._security.init?.();
    } else {
      this._security = { initialized: true };
    }

    this._started.push({ name: 'security', instance: this._security });
    console.log(`[HeadySystem]   ✓ Security: mode=${securityMode} pqc=${!!secMod.PQCHandshake}`);
  }

  /** @private */
  async _initIntelligence() {
    const intMod = this._layers.get('intelligence');
    console.log(`[HeadySystem] Starting Intelligence Layer…`);

    if (intMod.AnalyticsEngine) {
      this._intelligence = new intMod.AnalyticsEngine({ nodeId: this.nodeId });
      await this._intelligence.init?.();
      this._started.push({ name: 'intelligence', instance: this._intelligence });
      console.log(`[HeadySystem]   ✓ Intelligence: analytics + monte-carlo + patterns`);
    } else {
      console.log(`[HeadySystem]   ℹ Intelligence: no AnalyticsEngine export`);
    }
  }

  /** @private */
  async _initGovernance() {
    const { createGovernanceLayer } = this._layers.get('governance');
    console.log(`[HeadySystem] Starting Governance Layer…`);

    this._governance = createGovernanceLayer({ nodeId: this.nodeId });
    this._started.push({ name: 'governance', instance: this._governance });
    console.log(`[HeadySystem]   ✓ Governance: approval gates + audit trail`);
  }

  /** @private */
  async _initTelemetry() {
    const telMod = this._layers.get('telemetry');
    console.log(`[HeadySystem] Starting Telemetry…`);

    if (telMod.HeadyTelemetry) {
      this._telemetry = new telMod.HeadyTelemetry({
        nodeId: this.nodeId,
        role: this.role,
        flushIntervalMs: parseInt(process.env.HEADY_TELEMETRY_FLUSH_S || '11') * 1000,
        bufferSize: FIBONACCI[8],  // 34
      });
      await this._telemetry.init?.();
      this._started.push({ name: 'telemetry', instance: this._telemetry });
      console.log(`[HeadySystem]   ✓ Telemetry: flush=${process.env.HEADY_TELEMETRY_FLUSH_S || 11}s`);
    } else {
      console.log(`[HeadySystem]   ℹ Telemetry: no HeadyTelemetry export`);
    }
  }

  /** @private */
  async _initServices() {
    const svcMod = this._layers.get('services');
    console.log(`[HeadySystem] Starting Services…`);

    // LLM Router
    if (svcMod.LLMRouter) {
      const enabledProviders = (process.env.HEADY_LLM_PROVIDERS || 'openai,anthropic,google').split(',').map(s => s.trim());
      this._services = {
        llmRouter: new svcMod.LLMRouter({
          providers: enabledProviders,
          nodeId: this.nodeId,
        }),
      };
      await this._services.llmRouter.init?.();
    }

    // Budget tracker
    if (svcMod.BudgetTracker) {
      this._services = this._services || {};
      this._services.budgetTracker = new svcMod.BudgetTracker({ nodeId: this.nodeId });
    }

    this._started.push({ name: 'services', instance: this._services });
    const svcNames = Object.keys(this._services || {}).join(', ');
    console.log(`[HeadySystem]   ✓ Services: ${svcNames || 'initialized'}`);
  }

  /** @private */
  async _initColabRuntime() {
    const rtMod = this._layers.get('runtime');
    console.log(`[HeadySystem] Starting Colab Runtime Layer…`);

    if (rtMod.ColabRuntime) {
      this._colabRuntime = new rtMod.ColabRuntime({
        nodeId: this.nodeId,
        role: this.role,
      });
      await this._colabRuntime.init?.();
      this._started.push({ name: 'runtime', instance: this._colabRuntime });
      console.log(`[HeadySystem]   ✓ Colab Runtime: edge-compatible service registry`);
    }
  }

  // ─── Mesh Wiring ──────────────────────────────────────────────────────────────

  /**
   * Connect this node to peer nodes via the EventBridge.
   * @private
   */
  async _wireMesh() {
    if (!this._runtime?.bridge) return;

    const peers = {
      brain:     { url: process.env.HEADY_BRAIN_URL,     port: 9101 },
      conductor: { url: process.env.HEADY_CONDUCTOR_URL, port: 9102 },
      sentinel:  { url: process.env.HEADY_SENTINEL_URL,  port: 9103 },
    };

    console.log(`[HeadySystem] Wiring inter-node mesh…`);
    for (const [role, { url }] of Object.entries(peers)) {
      if (role === this.role || !url) continue;
      try {
        const parsed = new URL(url);
        const bridgePortMap = { brain: 9101, conductor: 9102, sentinel: 9103 };
        const bridgePort = bridgePortMap[role] || 9100;
        await this._runtime.bridge.connect(parsed.hostname, bridgePort, role);
        console.log(`[HeadySystem]   ✓ Mesh: connected to ${role} at ${parsed.hostname}:${bridgePort}`);
      } catch (err) {
        console.warn(`[HeadySystem]   ⚠ Mesh: could not connect to ${role}: ${err.message}`);
      }
    }
  }

  // ─── Health Endpoint ──────────────────────────────────────────────────────────

  /**
   * Register /health and /status endpoints on the HTTP server.
   * @private
   */
  _registerHealthEndpoint() {
    if (!this._runtime?.http) return;

    // GET /health — simple liveness probe
    this._runtime.http.get('/health', (req, res) => {
      res.json(this._buildHealthPayload(false));
    });

    // GET /status — full system status
    this._runtime.http.get('/status', (req, res) => {
      res.json(this._buildHealthPayload(true));
    });

    // GET /governance/status — governance-specific endpoint (SENTINEL)
    if (this._governance) {
      this._runtime.http.get('/governance/status', (req, res) => {
        res.json({
          ok: true,
          nodeId: this.nodeId,
          role: this.role,
          gates: this._governance?.gates?.status?.() ?? {},
          ts: Date.now(),
        });
      });
    }
  }

  /**
   * Build the health/status response payload.
   * @private
   * @param {boolean} full - Include verbose subsystem details
   * @returns {object}
   */
  _buildHealthPayload(full) {
    const base = {
      ok: this.booted,
      status: this.booted ? 'ok' : 'starting',
      nodeId: this.nodeId,
      role: this.role,
      version: VERSION,
      uptime: process.uptime(),
      ts: Date.now(),
      phi: PHI,
    };

    if (!full) return base;

    return {
      ...base,
      port: this.port,
      layers: [...this._layers.keys()],
      memory: this._memory?.stats?.() ?? null,
      orchestration: this._orchestration?.status?.() ?? null,
      pipeline: this._pipeline?.status?.() ?? null,
      bees: this._bees?.status?.() ?? null,
      telemetry: this._telemetry?.status?.() ?? null,
      runtime: this._runtime?.status ?? null,
      sacredGeometry: {
        phi: PHI,
        fibonacci5: FIBONACCI.slice(0, 5),
        clusterRole: this.role,
        poolAllocation: {
          brain:     '34% hot',
          conductor: '21%+13% warm+cold',
          sentinel:  '8%+5% reserve+governance',
        }[this.role] ?? 'n/a',
      },
    };
  }

  // ─── Health Monitor ───────────────────────────────────────────────────────────

  /**
   * Start the PHI-scaled health pulse loop.
   * Emits 'system.pulse' on the event bus every φ^5 seconds (~11s).
   * @private
   */
  _startHealthMonitor() {
    const interval = Math.floor(Math.pow(PHI, 5) * 1000);  // ~11,090ms
    this._healthTimer = setInterval(() => {
      if (!this.booted || !this._runtime) return;
      const payload = this._buildHealthPayload(false);
      this._runtime.bus?.publish('system.pulse', payload, { priority: 'background' }).catch(() => {});

      // Forward telemetry
      if (this._telemetry?.record) {
        this._telemetry.record('system.pulse', payload).catch?.(() => {});
      }
    }, interval);

    if (this._healthTimer?.unref) this._healthTimer.unref();
  }

  // ─── Shutdown ─────────────────────────────────────────────────────────────────

  /**
   * Register OS signal handlers for graceful shutdown.
   * @private
   */
  _registerShutdownHandlers() {
    const handler = async (signal) => {
      console.log(`\n[HeadySystem] Received ${signal} — initiating graceful shutdown…`);
      await this.shutdown();
      process.exit(0);
    };

    process.once('SIGTERM', () => handler('SIGTERM'));
    process.once('SIGINT',  () => handler('SIGINT'));
  }

  /**
   * Gracefully shut down all services in LIFO order.
   *
   * Services are stopped in reverse startup order to respect dependencies:
   * last-started is first-stopped.
   *
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (!this.booted) return;
    this.booted = false;

    if (this._healthTimer) {
      clearInterval(this._healthTimer);
      this._healthTimer = null;
    }

    console.log(`[HeadySystem] Shutting down ${this.role.toUpperCase()} (${this._started.length} services, LIFO)…`);

    // LIFO: reverse the start order
    const toStop = [...this._started].reverse();
    for (const { name, instance } of toStop) {
      try {
        if (instance?.shutdown) await instance.shutdown();
        else if (instance?.close)    await instance.close();
        else if (instance?.stop)     await instance.stop();
        console.log(`[HeadySystem]   ✓ Stopped: ${name}`);
      } catch (err) {
        console.warn(`[HeadySystem]   ⚠ Error stopping ${name}: ${err.message}`);
      }
    }

    this._started.length = 0;
    console.log(`[HeadySystem] Shutdown complete.\n`);
  }

  // ─── Public Accessors ─────────────────────────────────────────────────────────

  /**
   * Returns the aggregated health status of the entire system.
   * @returns {object}
   */
  health() {
    return this._buildHealthPayload(true);
  }

  /**
   * Live system status (getter — no async).
   * @returns {object}
   */
  get status() {
    return this._buildHealthPayload(false);
  }

  // ─── Layer Accessors ──────────────────────────────────────────────────────────

  /** @returns {object|null} HeadyCore Runtime */
  get runtime()        { return this._runtime; }

  /** @returns {object|null} MemorySystem */
  get memory()         { return this._memory; }

  /** @returns {object|null} OrchestrationLayer */
  get orchestration()  { return this._orchestration; }

  /** @returns {object|null} Pipeline */
  get pipeline()       { return this._pipeline; }

  /** @returns {object|null} Bee Factory */
  get bees()           { return this._bees; }

  /** @returns {object|null} Resilience (circuit breakers) */
  get resilience()     { return this._resilience; }

  /** @returns {object|null} Security */
  get security()       { return this._security; }

  /** @returns {object|null} Intelligence */
  get intelligence()   { return this._intelligence; }

  /** @returns {object|null} GovernanceLayer */
  get governance()     { return this._governance; }

  /** @returns {object|null} Telemetry */
  get telemetry()      { return this._telemetry; }

  /** @returns {object|null} Services (LLM router, budget, etc.) */
  get services()       { return this._services; }

  /** @returns {object|null} Colab Runtime */
  get colabRuntime()   { return this._colabRuntime; }

  /** @returns {object|null} EventBus from Core Runtime */
  get bus()            { return this._runtime?.bus ?? null; }

  /** @returns {object|null} HTTP server from Core Runtime */
  get http()           { return this._runtime?.http ?? null; }

  /** @returns {object|null} MCP server from Core Runtime */
  get mcp()            { return this._runtime?.mcp ?? null; }
}

// ─── Convenience Factory ──────────────────────────────────────────────────────

/**
 * Boot the HeadySystem and return it.
 * Equivalent to `HeadySystem.boot(role, opts)`.
 *
 * @param {string} [role]
 * @param {object} [opts]
 * @returns {Promise<HeadySystem>}
 */
export async function boot(role, opts) {
  return HeadySystem.boot(role, opts);
}

// ─── Re-exports: make all layer symbols available from the master file ─────────

// Consumers can import everything they need from heady-system.js
// without knowing the internal directory structure.

export * from './core/index.js';
export * from './config/index.js';
export * from './utils/index.js';

// ─── Build Info ───────────────────────────────────────────────────────────────

/**
 * System-wide build metadata.
 * @type {Readonly<object>}
 */
export const BUILD_INFO = Object.freeze({
  version: VERSION,
  nodeRequirement: '>=22.0.0',
  dependencies: 'zero',
  builtAt: new Date().toISOString(),
  roles: Object.keys(ROLE_LAYERS),
  layers: [
    'core', 'memory', 'orchestration', 'pipeline', 'bees',
    'resilience', 'security', 'intelligence', 'governance',
    'services', 'telemetry', 'runtime', 'config', 'utils', 'providers',
  ],
  sacredGeometry: {
    phi: PHI,
    fibonacci15: FIBONACCI,
    clusterRoles: {
      brain:     { pool: '34%', fibIndex: 8,   fib: 34,  role: 'Central Hub (φ origin)' },
      conductor: { pool: '34%', fibIndex: '7+6', fib: 34, role: 'Inner Ring (processing)' },
      sentinel:  { pool: '13%', fibIndex: '5+3', fib: 11, role: 'Governance Shell' },
    },
  },
});

// ─── Default Export ───────────────────────────────────────────────────────────

export default {
  HeadySystem,
  boot,
  PHI,
  FIBONACCI,
  phiBackoff,
  VERSION,
  BUILD_INFO,
  ROLE_LAYERS,
};

// ─── Main entry point (run directly with `node heady-system.js`) ─────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const role = process.env.HEADY_NODE_ROLE || process.argv[2];

  HeadySystem.boot(role).then(system => {
    console.log(`[HeadySystem] Running as ${system.role.toUpperCase()} — press Ctrl+C to stop\n`);
  }).catch(err => {
    console.error(`[HeadySystem] Boot failed: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  });
}
