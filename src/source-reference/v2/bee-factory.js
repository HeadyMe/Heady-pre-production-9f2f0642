/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 *
 * Dynamic Bee Factory — Creates any type of bee on the fly at runtime.
 *
 * Heady doesn't wait for pre-defined bee workers. When a new domain,
 * task, or capability is needed, this factory spawns a bee for it
 * instantly — no code changes, no restarts, no pre-registration.
 *
 * Usage:
 *   const { createBee, spawnBee, createWorkUnit } = require('./bee-factory');
 *
 *   // Create a bee for any domain
 *   createBee('new-domain', {
 *       description: 'Handles new-domain tasks',
 *       priority: 0.9,
 *       workers: [
 *           { name: 'task-1', fn: async () => { ... } },
 *           { name: 'task-2', fn: async () => { ... } },
 *       ],
 *   });
 *
 *   // Or spawn a single-purpose bee instantly
 *   spawnBee('quick-fix', async () => patchDatabase());
 *
 *   // Or create a work unit that auto-registers
 *   createWorkUnit('analytics', 'daily-report', async () => generateReport());
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger').child('bee-factory');

const BEES_DIR = __dirname;
const _dynamicRegistry = new Map();
const _ephemeralBees = new Map(); // In-memory only, not persisted

/**
 * Create a full bee domain dynamically at runtime.
 * Registers it in-memory AND optionally persists to disk for future boots.
 *
 * @param {string} domain - Domain name for the bee
 * @param {Object} config - Bee configuration
 * @param {string} config.description - What this bee does
 * @param {number} config.priority - Urgency (0.0 - 1.0)
 * @param {Array} config.workers - Array of { name, fn } work units
 * @param {boolean} config.persist - If true, writes a bee file to disk (default: false)
 * @returns {Object} The registered bee entry
 */
function createBee(domain, config = {}) {
    const {
        description = `Dynamic ${domain} bee`,
        priority = 0.5,
        workers = [],
        persist = false,
    } = config;

    // Validate workers are callable
    let validated = true;
    for (let i = 0; i < workers.length; i++) {
        const w = workers[i];
        if (typeof w !== 'function' && (typeof w !== 'object' || typeof w.fn !== 'function')) {
            validated = false;
            try { logger.warn(`Worker ${i} in '${domain}' is not callable`); } catch { }
        }
    }

    const entry = {
        domain,
        description,
        priority,
        createdAt: Date.now(),
        dynamic: true,
        validated,
        file: `dynamic:${domain}`,
        getWork: (ctx = {}) => workers.map(w => {
            if (typeof w === 'function') return w;
            if (typeof w.fn === 'function') return async () => {
                try {
                    const result = await w.fn(ctx);
                    return { bee: domain, action: w.name || 'work', ...result };
                } catch (err) {
                    return { bee: domain, action: w.name || 'work', error: err.message };
                }
            };
            return async () => ({ bee: domain, action: w.name || 'noop', status: 'no-handler' });
        }),
    };

    _dynamicRegistry.set(domain, entry);

    // Also register in the main registry if available
    try {
        const registry = require('./registry');
        registry.registry.set(domain, entry);
    } catch { /* registry not loaded yet */ }

    // Persist to disk if requested — creates a real bee file
    if (persist) {
        _persistBee(domain, config);
    }

    return entry;
}

/**
 * Spawn a single-purpose ephemeral bee for one-off tasks.
 * Lives only in memory for this process lifecycle.
 *
 * @param {string} name - Name for this bee
 * @param {Function|Function[]} work - Work function(s) to execute
 * @param {number} priority - Urgency (default: 0.8)
 * @returns {Object} The ephemeral bee entry
 */
function spawnBee(name, work, priority = 0.8) {
    const workFns = Array.isArray(work) ? work : [work];
    const id = `ephemeral-${name}-${crypto.randomBytes(3).toString('hex')}`;

    const entry = {
        domain: id,
        description: `Ephemeral bee: ${name}`,
        priority,
        ephemeral: true,
        createdAt: Date.now(),
        file: `ephemeral:${id}`,
        getWork: () => workFns.map(fn => async (ctx) => {
            const result = await fn(ctx);
            return { bee: id, action: name, ...(typeof result === 'object' ? result : { result }) };
        }),
    };

    _ephemeralBees.set(id, entry);

    // Register in main registry
    try {
        const registry = require('./registry');
        registry.registry.set(id, entry);
    } catch { /* registry not loaded yet */ }

    return entry;
}

/**
 * Add a single work unit to an existing domain.
 * If the domain doesn't exist, creates it.
 *
 * @param {string} domain - Domain to add work to
 * @param {string} name - Name of the work unit
 * @param {Function} fn - The work function
 * @returns {Object} The updated/created bee entry
 */
function createWorkUnit(domain, name, fn) {
    const existing = _dynamicRegistry.get(domain);
    if (existing) {
        // Add to existing dynamic bee
        const oldGetWork = existing.getWork;
        existing.getWork = (ctx = {}) => {
            const existingWork = oldGetWork(ctx);
            existingWork.push(async () => {
                const result = await fn(ctx);
                return { bee: domain, action: name, ...(typeof result === 'object' ? result : { result }) };
            });
            return existingWork;
        };
        return existing;
    }

    // Create new domain with this single worker
    return createBee(domain, {
        workers: [{ name, fn }],
    });
}

/**
 * Create a bee from a template/pattern.
 * Useful for spawning service-monitoring bees, health-check bees, etc.
 *
 * @param {string} template - Template name ('health-check', 'monitor', 'processor', 'scanner')
 * @param {Object} config - Template-specific configuration
 * @returns {Object} The created bee entry
 */
function createFromTemplate(template, config = {}) {
    const templates = {
        'health-check': (cfg) => ({
            domain: cfg.domain || `health-${cfg.target}`,
            description: `Health checker for ${cfg.target}`,
            priority: 0.9,
            workers: [
                {
                    name: 'probe', fn: async () => {
                        const url = cfg.url || `https://${cfg.target}/api/health`;
                        const timeout = cfg.timeout || 5000;
                        const start = Date.now();
                        try {
                            const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
                            const latency = Date.now() - start;
                            const body = res.headers.get('content-type')?.includes('json')
                                ? await res.json().catch(() => null)
                                : await res.text().catch(() => null);
                            return {
                                target: cfg.target, url, status: res.ok ? 'healthy' : 'degraded',
                                statusCode: res.status, latency, body,
                            };
                        } catch (err) {
                            return {
                                target: cfg.target, url, status: 'down',
                                error: err.message, latency: Date.now() - start,
                            };
                        }
                    }
                },
            ],
        }),

        'monitor': (cfg) => ({
            domain: cfg.domain || `monitor-${cfg.target}`,
            description: `Monitor for ${cfg.target}`,
            priority: 0.7,
            workers: [
                {
                    name: 'metrics', fn: async () => {
                        const mem = process.memoryUsage();
                        // Measure event loop lag
                        const lagStart = Date.now();
                        await new Promise(r => setImmediate(r));
                        const eventLoopLag = Date.now() - lagStart;
                        return {
                            target: cfg.target,
                            heapUsedMB: Math.round(mem.heapUsed / 1048576 * 10) / 10,
                            heapTotalMB: Math.round(mem.heapTotal / 1048576 * 10) / 10,
                            rssMB: Math.round(mem.rss / 1048576 * 10) / 10,
                            externalMB: Math.round(mem.external / 1048576 * 10) / 10,
                            eventLoopLagMs: eventLoopLag,
                            ts: Date.now(),
                        };
                    }
                },
                {
                    name: 'uptime', fn: async () => {
                        const uptimeSec = process.uptime();
                        return {
                            target: cfg.target,
                            uptimeSeconds: Math.round(uptimeSec),
                            uptimeHuman: uptimeSec > 86400
                                ? `${Math.floor(uptimeSec / 86400)}d ${Math.floor((uptimeSec % 86400) / 3600)}h`
                                : uptimeSec > 3600
                                    ? `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m`
                                    : `${Math.floor(uptimeSec / 60)}m ${Math.round(uptimeSec % 60)}s`,
                            cpuUsage: process.cpuUsage(),
                            pid: process.pid,
                            ts: Date.now(),
                        };
                    }
                },
            ],
        }),

        'processor': (cfg) => ({
            domain: cfg.domain || `processor-${cfg.name}`,
            description: `Data processor: ${cfg.name}`,
            priority: cfg.priority || 0.6,
            workers: (cfg.tasks || []).map(task => ({
                name: task.name || 'process',
                fn: task.fn || (async () => ({ processed: true, task: task.name })),
            })),
        }),

        'scanner': (cfg) => ({
            domain: cfg.domain || `scanner-${cfg.target}`,
            description: `Scanner for ${cfg.target}`,
            priority: 0.8,
            workers: [
                {
                    name: 'scan', fn: cfg.scanFn || (async () => {
                        const fs = require('fs');
                        const path = require('path');
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
                                    if (entry.isDirectory()) {
                                        walk(fullPath, depth + 1);
                                    } else if (patterns.some(p => entry.name.includes(p))) {
                                        findings.push({
                                            file: fullPath,
                                            pattern: patterns.find(p => entry.name.includes(p)),
                                            size: fs.statSync(fullPath).size,
                                        });
                                    }
                                }
                            } catch { /* permission denied or missing dir */ }
                        };
                        walk(targetDir);

                        return { scanned: targetDir, findings, count: findings.length, ts: Date.now() };
                    })
                },
                {
                    name: 'report', fn: cfg.reportFn || (async (ctx) => {
                        const findings = ctx?.findings || [];
                        const severity = findings.length > 5 ? 'high' : findings.length > 0 ? 'medium' : 'clean';
                        return {
                            report: `Scan complete: ${cfg.target}`,
                            severity,
                            totalFindings: findings.length,
                            summary: findings.slice(0, 10).map(f => f.file),
                        };
                    })
                },
            ],
        }),

        'alerter': (cfg) => ({
            domain: cfg.domain || `alerter-${cfg.target}`,
            description: `Threshold alerter for ${cfg.target}`,
            priority: 0.85,
            workers: [
                {
                    name: 'check-thresholds', fn: async () => {
                        const mem = process.memoryUsage();
                        const heapPercent = (mem.heapUsed / mem.heapTotal) * 100;
                        const alerts = [];

                        if (heapPercent > (cfg.heapThreshold || 85)) {
                            alerts.push({ type: 'heap', level: 'warning', value: `${heapPercent.toFixed(1)}%`, threshold: `${cfg.heapThreshold || 85}%` });
                        }

                        if (process.uptime() > (cfg.maxUptimeSeconds || 86400 * 7)) {
                            alerts.push({ type: 'uptime', level: 'info', value: `${Math.floor(process.uptime() / 86400)}d`, threshold: 'restart recommended' });
                        }

                        if (global.eventBus && alerts.length > 0) {
                            global.eventBus.emit('bee:alerts', { target: cfg.target, alerts });
                        }

                        return { target: cfg.target, alerts, alertCount: alerts.length, ts: Date.now() };
                    }
                },
            ],
        }),
    };

    const templateFn = templates[template];
    if (!templateFn) {
        throw new Error(`Unknown bee template: '${template}'. Available: ${Object.keys(templates).join(', ')}`);
    }

    return createBee(config.domain || `${template}-${config.target || config.name || 'dynamic'}`, templateFn(config));
}

/**
 * Create a coordinated swarm of bees with an orchestration policy.
 * Swarms run multiple bees together with consensus collection.
 *
 * @param {string} name - Swarm name
 * @param {Array} beeConfigs - Array of { domain, config } for each bee
 * @param {Object} policy - Orchestration policy
 * @param {string} policy.mode - 'parallel', 'sequential', or 'pipeline'
 * @param {boolean} policy.requireConsensus - If true, all bees must succeed
 * @param {number} policy.timeoutMs - Max execution time per bee (default: 30000)
 * @returns {Object} The swarm bee entry
 */
function createSwarm(name, beeConfigs = [], policy = {}) {
    const {
        mode = 'parallel',
        requireConsensus = false,
        timeoutMs = 30000,
    } = policy;

    // Create individual bees first
    const bees = beeConfigs.map(({ domain, config }) =>
        createBee(domain, config || {})
    );

    // Create the orchestrating swarm bee
    const swarmBee = createBee(`swarm-${name}`, {
        description: `Swarm: ${name} (${mode}, ${bees.length} bees)`,
        priority: 1.0,
        isSwarm: true,
        workers: [{
            name: 'orchestrate',
            fn: async (ctx = {}) => {
                const results = {};
                const startTime = Date.now();

                if (mode === 'parallel') {
                    const settled = await Promise.allSettled(
                        bees.map(async (bee) => {
                            const workFns = bee.getWork(ctx);
                            const beeResults = [];
                            for (const fn of workFns) {
                                const result = await Promise.race([
                                    fn(ctx),
                                    new Promise((_, reject) =>
                                        setTimeout(() => reject(new Error('timeout')), timeoutMs)
                                    ),
                                ]);
                                beeResults.push(result);
                            }
                            return { domain: bee.domain, results: beeResults };
                        })
                    );

                    for (const s of settled) {
                        if (s.status === 'fulfilled') {
                            results[s.value.domain] = { status: 'ok', results: s.value.results };
                        } else {
                            results[s.reason?.domain || 'unknown'] = { status: 'error', error: s.reason?.message };
                        }
                    }
                } else if (mode === 'sequential' || mode === 'pipeline') {
                    let pipelineCtx = { ...ctx };
                    for (const bee of bees) {
                        try {
                            const workFns = bee.getWork(pipelineCtx);
                            const beeResults = [];
                            for (const fn of workFns) {
                                const result = await fn(pipelineCtx);
                                beeResults.push(result);
                                if (mode === 'pipeline' && typeof result === 'object') {
                                    pipelineCtx = { ...pipelineCtx, ...result };
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
                    swarm: name,
                    mode,
                    beeCount: bees.length,
                    consensus: requireConsensus ? allOk : null,
                    durationMs: Date.now() - startTime,
                    results,
                };
            },
        }],
    });

    return swarmBee;
}

/**
 * Get all dynamic and ephemeral bees.
 */
function listDynamicBees() {
    const bees = [];
    for (const [id, entry] of _dynamicRegistry) {
        bees.push({ domain: id, description: entry.description, priority: entry.priority, type: 'dynamic', createdAt: entry.createdAt });
    }
    for (const [id, entry] of _ephemeralBees) {
        bees.push({ domain: id, description: entry.description, priority: entry.priority, type: 'ephemeral', createdAt: entry.createdAt });
    }
    return bees;
}

/**
 * Dissolve (remove) a dynamic or ephemeral bee.
 */
function dissolveBee(domain) {
    _dynamicRegistry.delete(domain);
    _ephemeralBees.delete(domain);
    try {
        const registry = require('./registry');
        registry.registry.delete(domain);
    } catch { /* fine */ }
}

/**
 * Persist a dynamic bee to disk as a real bee file.
 * @private
 */
function _persistBee(domain, config) {
    const filename = `${domain.replace(/[^a-z0-9-]/gi, '-')}-bee.js`;
    const filePath = path.join(BEES_DIR, filename);

    // Don't overwrite existing files
    if (fs.existsSync(filePath)) return;

    const workerNames = (config.workers || []).map((w, i) =>
        typeof w === 'function' ? `worker-${i}` : (w.name || `worker-${i}`)
    );

    const code = `/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Auto-generated by Dynamic Bee Factory
 * Domain: ${domain}
 * Created: ${new Date().toISOString()}
 */
const domain = '${domain}';
const description = '${(config.description || '').replace(/'/g, "\\'")}';
const priority = ${config.priority || 0.5};

function getWork(ctx = {}) {
    return [
${workerNames.map(name => `        async () => ({ bee: domain, action: '${name}', status: 'active', ts: Date.now() }),`).join('\n')}
    ];
}

module.exports = { domain, description, priority, getWork };
`;

    try {
        fs.writeFileSync(filePath, code, 'utf8');
    } catch { /* non-fatal */ }
}

// Export everything — Heady can create any bee, anywhere, instantly
module.exports = {
    createBee,
    spawnBee,
    createWorkUnit,
    createFromTemplate,
    createSwarm,
    listDynamicBees,
    dissolveBee,
    dynamicRegistry: _dynamicRegistry,
    ephemeralBees: _ephemeralBees,
};
