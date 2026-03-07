/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Dynamic Bee Factory Enhanced — Runtime Agent Lifecycle Management
 * Patent Reference: HS-060
 * "System and Method for Runtime Generation, Orchestration, and Dissolution
 *  of Autonomous AI Agent Workers with Template-Driven Swarm Consensus"
 *
 * Implements ALL 9 patent claims:
 *   Claim 1 — Runtime creation from declarative specs with SHA-256 identity
 *   Claim 2 — Template-based creation (health-check, monitor, processor, scanner)
 *   Claim 3 — Ephemeral spawn (in-memory only)
 *   Claim 4 — Persistent to disk (optional)
 *   Claim 5 — Swarm formation with consensus policies (parallel/sequential,
 *              requireConsensus, timeoutMs)
 *   Claim 6 — requireConsensus parameter
 *   Claim 7 — Dissolution protocol
 *   Claim 8 — Work function injection
 *   Claim 9 — Full system
 *
 * PHI = 1.6180339887
 */

'use strict';

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI = 1.6180339887;

const AGENT_TYPES = Object.freeze({
  DYNAMIC:   'dynamic',
  EPHEMERAL: 'ephemeral',
  TEMPLATE:  'template',
  SWARM:     'swarm',
});

const SWARM_POLICY_MODES = Object.freeze({
  PARALLEL:   'parallel',
  SEQUENTIAL: 'sequential',
  PIPELINE:   'pipeline',
});

const DISSOLUTION_REASONS = Object.freeze({
  MANUAL:      'manual',
  TIMEOUT:     'timeout',
  TASK_DONE:   'task_complete',
  ERROR:       'error',
  REBALANCE:   'rebalance',
});

// Default persistence directory for dynamically-created agent files
const DEFAULT_BEES_DIR = path.join(process.cwd(), 'dynamic-bees');

// ─── BeeRegistry ──────────────────────────────────────────────────────────────

/**
 * Dual-registry for persistent and ephemeral agents.
 *
 * RTP: HS-060 Claim 9(b) — "a persistent registry and an ephemeral registry
 *                           for tracking agent identities"
 */
class BeeRegistry {
  constructor() {
    /**
     * Persistent agents — survive across calls, optionally written to disk.
     * @type {Map<string, object>}
     */
    this._persistent = new Map();

    /**
     * Ephemeral agents — in-memory only, reclaimed on process exit.
     * RTP: HS-060 Claim 3
     * @type {Map<string, object>}
     */
    this._ephemeral = new Map();

    this._createdCount  = 0;
    this._dissolvedCount = 0;
  }

  /**
   * Register an agent in the persistent registry.
   * @param {string} id
   * @param {object} entry
   */
  registerPersistent(id, entry) {
    this._persistent.set(id, entry);
    this._createdCount++;
  }

  /**
   * Register an agent in the ephemeral registry.
   * @param {string} id
   * @param {object} entry
   */
  registerEphemeral(id, entry) {
    this._ephemeral.set(id, entry);
    this._createdCount++;
  }

  /**
   * Look up an agent in both registries.
   * @param {string} id
   * @returns {object|null}
   */
  get(id) {
    return this._persistent.get(id) || this._ephemeral.get(id) || null;
  }

  /**
   * Remove an agent from all registries.
   * @param {string} id
   * @returns {boolean} True if an entry was removed
   */
  remove(id) {
    const a = this._persistent.delete(id);
    const b = this._ephemeral.delete(id);
    if (a || b) this._dissolvedCount++;
    return a || b;
  }

  /**
   * Return all registered agents (persistent + ephemeral).
   * @returns {Array<object>}
   */
  all() {
    return [
      ...Array.from(this._persistent.values()),
      ...Array.from(this._ephemeral.values()),
    ];
  }

  /**
   * Return counts summary.
   * @returns {object}
   */
  stats() {
    return {
      persistent:     this._persistent.size,
      ephemeral:      this._ephemeral.size,
      total:          this._persistent.size + this._ephemeral.size,
      createdTotal:   this._createdCount,
      dissolvedTotal: this._dissolvedCount,
    };
  }
}

// ─── WorkInjector ─────────────────────────────────────────────────────────────

/**
 * Work Injector — adds work functions to existing agents without recreation.
 * If the target agent does not exist, a new one is created.
 *
 * RTP: HS-060 Claim 8 — "injecting individual work functions into an existing
 *                        agent without recreation, wherein if the target agent
 *                        does not exist, a new agent is created with the
 *                        injected work function"
 * RTP: HS-060 Claim 9(e)
 */
class WorkInjector {
  /**
   * @param {BeeRegistry} registry
   * @param {DynamicBeeFactory} factory - Reference for creating new agents when needed
   */
  constructor(registry, factory) {
    this._registry = registry;
    this._factory  = factory;
    this._injectionLog = [];
  }

  /**
   * Inject a work function into an existing agent or create a new one.
   *
   * RTP: HS-060 Claim 8
   *
   * @param {string} domain       - Target agent domain
   * @param {string} workName     - Name of the work unit
   * @param {Function} fn         - The work function (may be async)
   * @returns {{ domain: string, injected: boolean, created: boolean, entry: object }}
   */
  inject(domain, workName, fn) {
    if (typeof fn !== 'function') {
      throw new Error(`WorkInjector: work function for '${workName}' must be callable`);
    }

    const existing = this._registry.get(domain);

    if (existing) {
      // Inject into existing agent without recreation
      const wrappedFn = async (ctx = {}) => {
        const result = await fn(ctx);
        return {
          bee:    domain,
          action: workName,
          ...(typeof result === 'object' && result !== null ? result : { result }),
        };
      };

      const prevGetWork   = existing.getWork;
      existing.getWork    = (ctx = {}) => {
        const existing = prevGetWork(ctx);
        existing.push(wrappedFn);
        return existing;
      };
      existing.workUnits  = existing.workUnits || [];
      existing.workUnits.push({ name: workName, injectedAt: Date.now() });

      this._injectionLog.push({ domain, workName, created: false, ts: Date.now() });
      return { domain, injected: true, created: false, entry: existing };
    }

    // Create new agent with the work unit
    const entry = this._factory.createAgent(domain, {
      description: `Auto-created via work injection: ${workName}`,
      priority:    0.5,
      workers:     [{ name: workName, fn }],
    });

    this._injectionLog.push({ domain, workName, created: true, ts: Date.now() });
    return { domain, injected: true, created: true, entry };
  }

  /**
   * Return the injection history.
   * @param {number} [limit=50]
   * @returns {Array<object>}
   */
  getLog(limit = 50) {
    return this._injectionLog.slice(-limit);
  }
}

// ─── DissolutionModule ────────────────────────────────────────────────────────

/**
 * Dissolution Module — cleanly removes agents from the registry, deletes
 * persisted disk files, and releases agent identities.
 *
 * RTP: HS-060 Claim 7 — "dissolution protocol that removes the agent from the
 *                        registry, deletes any persisted source file, and
 *                        releases the agent identity"
 * RTP: HS-060 Claim 9(d)
 */
class DissolutionModule {
  /**
   * @param {BeeRegistry} registry
   * @param {string} [beesDir] - Directory where persisted bee files are stored
   */
  constructor(registry, beesDir) {
    this._registry    = registry;
    this._beesDir     = beesDir || DEFAULT_BEES_DIR;
    this._dissolved   = [];
  }

  /**
   * Dissolve (cleanly remove) an agent.
   * RTP: HS-060 Claim 7
   *
   * @param {string} domain             - Domain identifier of agent to dissolve
   * @param {object} [opts]
   * @param {boolean} [opts.deleteDisk=true]  - Delete persisted file if present
   * @param {string}  [opts.reason]           - DISSOLUTION_REASONS value
   * @returns {{ domain: string, removed: boolean, diskDeleted: boolean, reason: string }}
   */
  dissolve(domain, opts = {}) {
    const { deleteDisk = true, reason = DISSOLUTION_REASONS.MANUAL } = opts;

    const entry     = this._registry.get(domain);
    const removed   = this._registry.remove(domain);
    let diskDeleted = false;

    if (removed && deleteDisk) {
      // Attempt to delete the persisted bee file
      const filename  = `${domain.replace(/[^a-z0-9-]/gi, '-')}-bee.js`;
      const filePath  = path.join(this._beesDir, filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          diskDeleted = true;
        } catch { /* non-fatal */ }
      }
    }

    const record = {
      domain,
      removed,
      diskDeleted,
      reason,
      agentType:  entry ? entry.agentType : 'unknown',
      dissolvedAt: Date.now(),
    };
    this._dissolved.push(record);

    return record;
  }

  /**
   * Dissolve all agents matching a filter.
   * @param {Function} filterFn  - Called with each agent entry; returns true to dissolve
   * @param {object} [opts]
   * @returns {Array<object>}
   */
  dissolveWhere(filterFn, opts = {}) {
    const toDissolve = this._registry.all().filter(filterFn).map(e => e.domain || e.id);
    return toDissolve.map(domain => this.dissolve(domain, opts));
  }

  /**
   * Return dissolution history.
   * @param {number} [limit=50]
   * @returns {Array<object>}
   */
  getHistory(limit = 50) {
    return this._dissolved.slice(-limit);
  }
}

// ─── SwarmCoordinator ─────────────────────────────────────────────────────────

/**
 * Swarm Coordinator — organizes multiple agents into a coordinated swarm
 * with configurable consensus policies.
 *
 * RTP: HS-060 Claim 5 — "organizing a plurality of agents into a coordinated
 *                        swarm with a configurable consensus policy"
 * RTP: HS-060 Claim 6 — "requireConsensus parameter"
 * RTP: HS-060 Claim 9(c)
 */
class SwarmCoordinator {
  /**
   * @param {BeeRegistry} registry
   */
  constructor(registry) {
    this._registry   = registry;
    this._swarms     = new Map();
    this._executions = [];
  }

  /**
   * Form a new swarm from a list of agent domain IDs and a consensus policy.
   *
   * RTP: HS-060 Claim 5(i)-(v)
   *
   * @param {string} swarmName
   * @param {string[]} agentDomains
   * @param {object} [policy]
   * @param {string}  [policy.mode='parallel']          - 'parallel' | 'sequential' | 'pipeline'
   * @param {boolean} [policy.requireConsensus=false]   - If true, all agents must succeed
   * @param {number}  [policy.timeoutMs=30000]          - Timeout per agent
   * @returns {{ swarmId: string, name: string, agentCount: number, policy: object }}
   */
  formSwarm(swarmName, agentDomains, policy = {}) {
    const {
      mode             = SWARM_POLICY_MODES.PARALLEL,
      requireConsensus = false,
      timeoutMs        = 30000,
    } = policy;

    const swarmId = `swarm-${swarmName}-${crypto.randomBytes(3).toString('hex')}`;

    const swarm = {
      id:              swarmId,
      name:            swarmName,
      agentDomains:    [...agentDomains],
      policy:          { mode, requireConsensus, timeoutMs },
      formedAt:        Date.now(),
    };

    this._swarms.set(swarmId, swarm);
    return { swarmId, name: swarmName, agentCount: agentDomains.length, policy: swarm.policy };
  }

  /**
   * Execute a swarm and collect per-agent results with metadata.
   *
   * RTP: HS-060 Claim 5 — full execution protocol
   * RTP: HS-060 Claim 6 — requireConsensus enforcement
   *
   * @param {string} swarmId
   * @param {object} [ctx={}]   - Context object passed to all agent work functions
   * @returns {Promise<{
   *   swarmId: string, name: string, mode: string,
   *   consensus: boolean|null, requireConsensus: boolean,
   *   successCount: number, failureCount: number, totalLatencyMs: number,
   *   results: Array<{ domain: string, status: string, latencyMs: number, results: Array, error?: string }>
   * }>}
   */
  async executeSwarm(swarmId, ctx = {}) {
    const swarm = this._swarms.get(swarmId);
    if (!swarm) throw new Error(`No swarm registered with id: ${swarmId}`);

    const { mode, requireConsensus, timeoutMs } = swarm.policy;
    const startTime = Date.now();
    const agentResults = [];

    // RTP: HS-060 Claim 5(i) — instantiate all constituent agents
    const agents = swarm.agentDomains.map(domain => {
      const entry = this._registry.get(domain);
      if (!entry) throw new Error(`Swarm agent not found in registry: ${domain}`);
      return entry;
    });

    // RTP: HS-060 Claim 5(ii) — execute according to parallel or sequential policy
    if (mode === SWARM_POLICY_MODES.PARALLEL) {
      const settled = await Promise.allSettled(
        agents.map(agent => this._runAgent(agent, ctx, timeoutMs))
      );
      for (let i = 0; i < settled.length; i++) {
        const s = settled[i];
        if (s.status === 'fulfilled') {
          agentResults.push(s.value);
        } else {
          agentResults.push({
            domain:     agents[i].domain,
            id:         agents[i].id,
            status:     'error',
            latencyMs:  0,
            results:    [],
            error:      s.reason ? s.reason.message : 'unknown error',
          });
        }
      }
    } else {
      // Sequential or pipeline
      let pipelineCtx = { ...ctx };
      for (const agent of agents) {
        const result = await this._runAgent(agent, pipelineCtx, timeoutMs);
        agentResults.push(result);

        if (mode === SWARM_POLICY_MODES.PIPELINE && result.status === 'ok') {
          // Merge agent output into next agent's context
          for (const r of result.results) {
            if (r && typeof r === 'object') Object.assign(pipelineCtx, r);
          }
        }

        // RTP: HS-060 Claim 6 — requireConsensus stops early on failure
        if (requireConsensus && result.status !== 'ok') break;
      }
    }

    // RTP: HS-060 Claim 5(iii,iv,v) — collect metadata, evaluate consensus, compute aggregates
    const successCount  = agentResults.filter(r => r.status === 'ok').length;
    const failureCount  = agentResults.filter(r => r.status !== 'ok').length;
    const totalLatency  = Date.now() - startTime;

    // RTP: HS-060 Claim 6 — consensus status
    const consensus = requireConsensus ? (failureCount === 0) : null;

    const execution = {
      swarmId,
      name:              swarm.name,
      mode,
      requireConsensus,
      consensus,
      successCount,
      failureCount,
      totalLatencyMs:    totalLatency,
      agentCount:        agents.length,
      executedAt:        Date.now(),
      results:           agentResults,
    };

    this._executions.push({ swarmId, executedAt: Date.now(), summary: { successCount, failureCount, consensus } });
    return execution;
  }

  /**
   * Run a single agent's work functions with timeout.
   * @private
   */
  async _runAgent(agent, ctx, timeoutMs) {
    const start = Date.now();
    try {
      const workFns = agent.getWork(ctx);
      const results = [];

      for (const fn of workFns) {
        const result = await Promise.race([
          fn(ctx),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`agent_timeout:${agent.domain}`)), timeoutMs)
          ),
        ]);
        results.push(result);
      }

      return {
        domain:    agent.domain,
        id:        agent.id,
        status:    'ok',
        latencyMs: Date.now() - start,
        results,
      };
    } catch (err) {
      return {
        domain:    agent.domain,
        id:        agent.id,
        status:    'error',
        latencyMs: Date.now() - start,
        results:   [],
        error:     err.message,
      };
    }
  }

  /**
   * List all formed swarms.
   * @returns {Array<object>}
   */
  listSwarms() {
    return Array.from(this._swarms.values()).map(s => ({
      id:          s.id,
      name:        s.name,
      agentCount:  s.agentDomains.length,
      policy:      s.policy,
      formedAt:    s.formedAt,
    }));
  }

  /**
   * Dissolve a swarm (remove from coordinator; does not dissolve individual agents).
   * @param {string} swarmId
   * @returns {boolean}
   */
  dissolveSwarm(swarmId) {
    return this._swarms.delete(swarmId);
  }

  /**
   * Execution history.
   * @param {number} [limit=50]
   * @returns {Array<object>}
   */
  getExecutionHistory(limit = 50) {
    return this._executions.slice(-limit);
  }
}

// ─── DynamicBeeFactory ────────────────────────────────────────────────────────

/**
 * Dynamic Bee Factory — creates, templates, persists, and manages
 * autonomous AI agent workers at runtime.
 *
 * RTP: HS-060 Claim 9(a) — "a factory module configured to create agents
 *                           from declarative specifications or predefined templates"
 */
class DynamicBeeFactory {
  /**
   * @param {object} [opts]
   * @param {string} [opts.beesDir]  - Directory for persisted bee files
   */
  constructor(opts = {}) {
    this._beesDir  = opts.beesDir || DEFAULT_BEES_DIR;

    // Composed subsystems (Claim 9)
    this.registry         = new BeeRegistry();
    this.dissolutionModule = new DissolutionModule(this.registry, this._beesDir);
    this.swarmCoordinator  = new SwarmCoordinator(this.registry);
    this.workInjector      = new WorkInjector(this.registry, this);

    this._createdAt = Date.now();
  }

  // ── Agent Creation (Claim 1) ─────────────────────────────────────────────

  /**
   * Create a new agent from a declarative specification.
   *
   * RTP: HS-060 Claim 1 — runtime creation with SHA-256 identity
   *
   * @param {string} domain
   * @param {object} [config]
   * @param {string}   [config.description]
   * @param {number}   [config.priority=0.5]   - 0.0 – 1.0
   * @param {Array}    [config.workers=[]]     - Array of { name, fn } or plain functions
   * @param {boolean}  [config.persist=false]  - Write to disk for future boots
   * @param {boolean}  [config.ephemeral=false] - Register in ephemeral registry
   * @returns {object} The registered agent entry
   */
  createAgent(domain, config = {}) {
    const {
      description  = `Dynamic agent: ${domain}`,
      priority     = 0.5,
      workers      = [],
      persist      = false,
      ephemeral    = false,
    } = config;

    // RTP: HS-060 Claim 1(b) — SHA-256 identity from domain + timestamp
    const createdAt = Date.now();
    const id = crypto
      .createHash('sha256')
      .update(`${domain}:${createdAt}`)
      .digest('hex');

    // Validate workers
    const validatedWorkers = workers.map((w, i) => {
      if (typeof w === 'function') return { name: `worker-${i}`, fn: w };
      if (typeof w === 'object' && typeof w.fn === 'function') return w;
      return { name: `worker-${i}`, fn: async () => ({ bee: domain, action: `worker-${i}`, status: 'noop' }) };
    });

    const entry = {
      domain,
      id,
      description,
      priority,
      agentType:   ephemeral ? AGENT_TYPES.EPHEMERAL : AGENT_TYPES.DYNAMIC,
      ephemeral,
      createdAt,
      workUnits:   validatedWorkers.map(w => ({ name: w.name, injectedAt: createdAt })),

      /**
       * Return array of bound async work functions.
       * @param {object} [ctx={}]
       * @returns {Function[]}
       */
      getWork: (ctx = {}) => validatedWorkers.map(w => async () => {
        const result = await w.fn(ctx);
        return {
          bee:    domain,
          action: w.name,
          ...(typeof result === 'object' && result !== null ? result : { result }),
        };
      }),
    };

    // RTP: HS-060 Claim 3 — ephemeral registry
    // RTP: HS-060 Claim 4 — persistent registry
    if (ephemeral) {
      this.registry.registerEphemeral(id, entry);
      this.registry.registerEphemeral(domain, entry); // also by domain for lookup
    } else {
      this.registry.registerPersistent(id, entry);
      this.registry.registerPersistent(domain, entry);
    }

    // RTP: HS-060 Claim 4 — optional disk persistence
    if (persist && !ephemeral) {
      this._persistToDisk(domain, config, validatedWorkers);
    }

    return entry;
  }

  // ── Template-Based Creation (Claim 2) ────────────────────────────────────

  /**
   * Create an agent from a predefined template.
   *
   * RTP: HS-060 Claim 2 — "creating the agent from a predefined template
   *                        selected from a library of agent patterns"
   *
   * Supported templates: health-check, monitor, processor, scanner
   *
   * @param {string} template - Template name
   * @param {object} config   - Template-specific config
   * @returns {object} Created agent entry
   */
  createFromTemplate(template, config = {}) {
    const templateFns = {
      /**
       * Health-Check Agent — probes a service endpoint and reports health.
       */
      'health-check': (cfg) => ({
        domain:      cfg.domain || `health-${cfg.target || 'service'}`,
        description: `Health checker for ${cfg.target || 'service'}`,
        priority:    0.9,
        workers: [
          {
            name: 'probe',
            fn: async () => {
              const url     = cfg.url || `https://${cfg.target}/api/health`;
              const timeout = cfg.timeout || 5000;
              const start   = Date.now();
              try {
                const res     = await fetch(url, { signal: AbortSignal.timeout(timeout) });
                const latency = Date.now() - start;
                const body    = res.headers.get('content-type')?.includes('json')
                  ? await res.json().catch(() => null)
                  : await res.text().catch(() => null);
                return {
                  target: cfg.target, url, latency,
                  status: res.ok ? 'healthy' : 'degraded',
                  statusCode: res.status, body,
                };
              } catch (err) {
                return {
                  target: cfg.target, url, status: 'down',
                  error: err.message, latency: Date.now() - start,
                };
              }
            },
          },
        ],
      }),

      /**
       * Monitor Agent — reports process/memory/uptime metrics.
       */
      'monitor': (cfg) => ({
        domain:      cfg.domain || `monitor-${cfg.target || 'process'}`,
        description: `Monitor for ${cfg.target || 'process'}`,
        priority:    0.7,
        workers: [
          {
            name: 'metrics',
            fn: async () => {
              const mem = process.memoryUsage();
              const lagStart = Date.now();
              await new Promise(r => setImmediate(r));
              return {
                target:            cfg.target,
                heapUsedMB:        +(mem.heapUsed / 1048576).toFixed(1),
                heapTotalMB:       +(mem.heapTotal / 1048576).toFixed(1),
                rssMB:             +(mem.rss / 1048576).toFixed(1),
                eventLoopLagMs:    Date.now() - lagStart,
                ts:                Date.now(),
              };
            },
          },
          {
            name: 'uptime',
            fn: async () => {
              const sec = process.uptime();
              const h   = Math.floor(sec / 3600);
              const m   = Math.floor((sec % 3600) / 60);
              const s   = Math.round(sec % 60);
              return {
                target:         cfg.target,
                uptimeSeconds:  Math.round(sec),
                uptimeHuman:    `${h}h ${m}m ${s}s`,
                cpuUsage:       process.cpuUsage(),
                pid:            process.pid,
                ts:             Date.now(),
              };
            },
          },
        ],
      }),

      /**
       * Processor Agent — runs configurable data-transform tasks.
       */
      'processor': (cfg) => ({
        domain:      cfg.domain || `processor-${cfg.name || 'data'}`,
        description: `Data processor: ${cfg.name || 'pipeline'}`,
        priority:    cfg.priority || 0.6,
        workers:     (cfg.tasks || []).map(task => ({
          name: task.name || 'process',
          fn:   task.fn   || (async () => ({ processed: true, task: task.name, ts: Date.now() })),
        })),
      }),

      /**
       * Scanner Agent — recursively analyses directory trees.
       */
      'scanner': (cfg) => ({
        domain:      cfg.domain || `scanner-${cfg.target || 'filesystem'}`,
        description: `Scanner for ${cfg.target || 'filesystem'}`,
        priority:    0.8,
        workers: [
          {
            name: 'scan',
            fn: cfg.scanFn || (async () => {
              const scanPath = cfg.scanPath || cfg.target || '.';
              const patterns = cfg.patterns  || ['.env', '.key', '.pem', 'secret'];
              const maxDepth = cfg.maxDepth  || 5;
              const findings = [];

              const walk = (dir, depth) => {
                if (depth > maxDepth) return;
                try {
                  const entries = fs.readdirSync(dir, { withFileTypes: true });
                  for (const dirent of entries) {
                    if (dirent.name === 'node_modules' || dirent.name === '.git') continue;
                    const fp = path.join(dir, dirent.name);
                    if (dirent.isDirectory()) {
                      walk(fp, depth + 1);
                    } else if (patterns.some(p => dirent.name.includes(p))) {
                      findings.push({
                        file:    fp,
                        pattern: patterns.find(p => dirent.name.includes(p)),
                        size:    fs.statSync(fp).size,
                      });
                    }
                  }
                } catch { /* permission denied */ }
              };
              walk(scanPath, 0);
              return { scanned: scanPath, findings, count: findings.length, ts: Date.now() };
            }),
          },
          {
            name: 'report',
            fn: cfg.reportFn || (async (ctx) => {
              const count    = ctx?.count || 0;
              const severity = count > 5 ? 'high' : count > 0 ? 'medium' : 'clean';
              return { severity, totalFindings: count, summary: (ctx?.findings || []).slice(0, 10).map(f => f.file) };
            }),
          },
        ],
      }),
    };

    const templateFn = templateFns[template];
    if (!templateFn) {
      throw new Error(`Unknown template: '${template}'. Available: ${Object.keys(templateFns).join(', ')}`);
    }

    const spec = templateFn(config);
    return this.createAgent(spec.domain, { ...spec, agentType: AGENT_TYPES.TEMPLATE });
  }

  // ── Ephemeral Spawn (Claim 3) ─────────────────────────────────────────────

  /**
   * Spawn a single-purpose ephemeral agent.
   * Lives only in memory for the current process lifecycle.
   *
   * RTP: HS-060 Claim 3 — "ephemeral instance that exists only in memory for
   *                        the duration of the current process lifecycle and is
   *                        automatically reclaimed upon process termination"
   *
   * @param {string} name             - Friendly name for the agent
   * @param {Function|Function[]} work - Work function(s)
   * @param {number} [priority=0.8]
   * @returns {object} The ephemeral agent entry
   */
  spawnEphemeral(name, work, priority = 0.8) {
    const workFns = Array.isArray(work) ? work : [work];
    const domain  = `ephemeral-${name}-${crypto.randomBytes(3).toString('hex')}`;

    return this.createAgent(domain, {
      description: `Ephemeral agent: ${name}`,
      priority,
      ephemeral:   true,
      workers:     workFns.map((fn, i) => ({ name: `${name}-work-${i}`, fn })),
    });
  }

  // ── Swarm Formation (Claims 5, 6) ────────────────────────────────────────

  /**
   * Form and optionally immediately execute a swarm.
   *
   * RTP: HS-060 Claim 5
   * RTP: HS-060 Claim 6
   *
   * @param {string} swarmName
   * @param {Array<{ domain: string, config?: object }>} beeConfigs
   * @param {object} [policy]
   * @param {string}  [policy.mode='parallel']
   * @param {boolean} [policy.requireConsensus=false]
   * @param {number}  [policy.timeoutMs=30000]
   * @param {boolean} [policy.executeNow=false] - Auto-execute after forming
   * @param {object}  [policy.ctx={}]           - Context for auto-execution
   * @returns {{ swarm: object, execution?: object }}
   */
  async createSwarm(swarmName, beeConfigs = [], policy = {}) {
    const { executeNow = false, ctx = {}, ...swarmPolicy } = policy;

    // Ensure all bees are created
    for (const { domain, config } of beeConfigs) {
      if (!this.registry.get(domain)) {
        this.createAgent(domain, config || {});
      }
    }

    const swarmInfo = this.swarmCoordinator.formSwarm(
      swarmName,
      beeConfigs.map(b => b.domain),
      swarmPolicy
    );

    if (executeNow) {
      const execution = await this.swarmCoordinator.executeSwarm(swarmInfo.swarmId, ctx);
      return { swarm: swarmInfo, execution };
    }

    return { swarm: swarmInfo };
  }

  // ── Dissolution (Claim 7) ────────────────────────────────────────────────

  /**
   * Dissolve (cleanly remove) an agent.
   * RTP: HS-060 Claim 7
   *
   * @param {string} domain
   * @param {object} [opts]
   * @returns {object}
   */
  dissolve(domain, opts = {}) {
    return this.dissolutionModule.dissolve(domain, opts);
  }

  // ── Work Injection (Claim 8) ──────────────────────────────────────────────

  /**
   * Inject a work function into an existing agent.
   * RTP: HS-060 Claim 8
   *
   * @param {string} domain
   * @param {string} workName
   * @param {Function} fn
   * @returns {object}
   */
  injectWork(domain, workName, fn) {
    return this.workInjector.inject(domain, workName, fn);
  }

  // ── Disk Persistence (Claim 4) ────────────────────────────────────────────

  /**
   * Write a bee agent file to disk for future boots.
   * RTP: HS-060 Claim 4 — "optionally persisting the agent to a source file
   *                        on disk, enabling the agent to be available on
   *                        subsequent system boots without re-creation"
   * @private
   */
  _persistToDisk(domain, config, validatedWorkers) {
    if (!fs.existsSync(this._beesDir)) {
      try { fs.mkdirSync(this._beesDir, { recursive: true }); } catch { return; }
    }

    const filename = `${domain.replace(/[^a-z0-9-]/gi, '-')}-bee.js`;
    const filePath = path.join(this._beesDir, filename);
    if (fs.existsSync(filePath)) return; // Never overwrite

    const workerNames = validatedWorkers.map(w => w.name);
    const code = `/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Auto-generated by DynamicBeeFactory (HS-060)
 * Domain:  ${domain}
 * Created: ${new Date().toISOString()}
 */
'use strict';

const domain      = '${domain}';
const description = '${(config.description || '').replace(/'/g, "\\'")}';
const priority    = ${config.priority || 0.5};

function getWork(ctx = {}) {
  return [
${workerNames.map(n => `    async () => ({ bee: domain, action: '${n}', status: 'active', ts: Date.now() }),`).join('\n')}
  ];
}

module.exports = { domain, description, priority, getWork };
`;

    try { fs.writeFileSync(filePath, code, 'utf8'); } catch { /* non-fatal */ }
  }

  // ── Listing & Status ──────────────────────────────────────────────────────

  /**
   * List all registered agents.
   * @returns {Array<object>}
   */
  listAgents() {
    return this.registry.all()
      .filter((v, i, arr) => arr.findIndex(x => x.id === v.id) === i) // dedupe
      .map(e => ({
        domain:     e.domain,
        id:         e.id,
        agentType:  e.agentType,
        description: e.description,
        priority:   e.priority,
        ephemeral:  e.ephemeral,
        createdAt:  e.createdAt,
        workUnits:  (e.workUnits || []).length,
      }));
  }

  /**
   * Full factory status report.
   * @returns {object}
   */
  status() {
    return {
      createdAt:   this._createdAt,
      uptime:      Date.now() - this._createdAt,
      registry:    this.registry.stats(),
      swarms:      this.swarmCoordinator.listSwarms(),
      injections:  this.workInjector.getLog(10),
      dissolutions: this.dissolutionModule.getHistory(10),
      phi:         PHI,
    };
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Core classes
  DynamicBeeFactory,
  BeeRegistry,
  SwarmCoordinator,
  DissolutionModule,
  WorkInjector,

  // Constants
  PHI,
  AGENT_TYPES,
  SWARM_POLICY_MODES,
  DISSOLUTION_REASONS,
};
