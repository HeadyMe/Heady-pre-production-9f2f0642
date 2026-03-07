/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 *
 * Dynamic Bee Factory — Creates any type of bee on the fly at runtime.
 * CSL Integration: Uses Continuous Semantic Logic gates for intelligent
 * bee dispatch, swarm candidate scoring, and priority classification.
 *
 * CSL gates used:
 *   - multi_resonance      → Score bee candidates against task intent
 *   - route_gate           → Select best bee for a task with soft activation
 *   - resonance_gate       → Match task intent to bee domain semantics
 *   - ternary_gate         → Classify bee health/priority: core / ephemeral / reject
 *   - soft_gate            → Continuous priority activation for swarm ordering
 *   - superposition_gate   → Fuse multi-domain bee vectors for composite swarms
 *   - orthogonal_gate      → Exclude specific domain influence from routing
 *
 * Usage:
 *   const { createBee, spawnBee, routeBee, createWorkUnit } = require('./bee-factory');
 *
 *   // Create a bee for any domain
 *   createBee('new-domain', { description: 'Handles new-domain tasks', priority: 0.9, ... });
 *
 *   // Route a task to the best bee using CSL
 *   const best = routeBee('deploy kubernetes cluster');
 *
 *   // Or spawn a single-purpose bee instantly
 *   spawnBee('quick-fix', async () => patchDatabase());
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger').child('bee-factory');
const CSL = require('../core/semantic-logic');

const BEES_DIR = __dirname;
const _dynamicRegistry = new Map();
const _ephemeralBees = new Map(); // In-memory only, not persisted

// ── CSL Helpers ─────────────────────────────────────────────────────────
const _vecCache = new Map();

/**
 * Deterministic pseudo-embedding for a domain/description string.
 * In production, replaced by the 384D vector-memory embeddings.
 */
function _domainToVec(text, dim = 64) {
    if (_vecCache.has(text)) return _vecCache.get(text);
    const v = new Float32Array(dim);
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
    }
    for (let i = 0; i < dim; i++) {
        hash = ((hash << 5) + hash + i) >>> 0;
        v[i] = ((hash % 2000) - 1000) / 1000;
    }
    const result = CSL.normalize(v);
    _vecCache.set(text, result);
    return result;
}

/**
 * Build a composite semantic vector for a bee from its domain + description.
 */
function _buildBeeVector(domain, description) {
    const domainVec = _domainToVec(domain);
    const descVec = _domainToVec(description || domain);
    return CSL.weighted_superposition(domainVec, descVec, 0.6);
}

/**
 * Create a full bee domain dynamically at runtime.
 * Registers it in-memory AND optionally persists to disk for future boots.
 * Now includes a CSL semantic vector for routing.
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

    // CSL: Build semantic vector for this bee
    const vector = _buildBeeVector(domain, description);

    // CSL: Classify priority using ternary_gate
    const priorityClass = CSL.ternary_gate(priority, 0.7, 0.3);

    const entry = {
        domain,
        description,
        priority,
        createdAt: Date.now(),
        dynamic: true,
        validated,
        file: `dynamic:${domain}`,
        vector,
        csl: {
            priorityState: priorityClass.state, // +1 = critical, 0 = normal, -1 = low
            priorityActivation: priorityClass.resonanceActivation,
        },
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

    const vector = _buildBeeVector(id, `Ephemeral bee: ${name}`);

    const entry = {
        domain: id,
        description: `Ephemeral bee: ${name}`,
        priority,
        ephemeral: true,
        createdAt: Date.now(),
        file: `ephemeral:${id}`,
        vector,
        csl: { priorityState: CSL.ternary_gate(priority, 0.7, 0.3).state },
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
 * Route a task to the best bee using CSL multi-resonance scoring.
 * This is the primary CSL-powered dispatch function.
 *
 * @param {string} taskDescription - Natural language description of the task
 * @param {Object} options - Routing options
 * @param {number} options.threshold - Minimum resonance to accept (default: 0.3)
 * @param {string[]} options.exclude - Domain names to exclude via orthogonal_gate
 * @param {number} options.topK - Return top K matches (default: 3)
 * @returns {{ best: Object|null, ranked: Array, csl: Object }}
 */
function routeBee(taskDescription, options = {}) {
    const {
        threshold = 0.3,
        exclude = [],
        topK = 3,
    } = options;

    // Build intent vector from task description
    let intentVec = _domainToVec(taskDescription);

    // Strip excluded domain influence via orthogonal_gate
    if (exclude.length > 0) {
        const excludeVecs = exclude.map(e => _domainToVec(e));
        intentVec = CSL.batch_orthogonal(intentVec, excludeVecs);
    }

    // Collect all registered bees (dynamic + ephemeral) with vectors
    const allBees = [];
    for (const [, entry] of _dynamicRegistry) {
        if (entry.vector) allBees.push(entry);
    }
    for (const [, entry] of _ephemeralBees) {
        if (entry.vector) allBees.push(entry);
    }

    if (allBees.length === 0) {
        return { best: null, ranked: [], csl: { error: 'No bees registered' } };
    }

    // CSL route_gate — scores all candidates with multi_resonance + soft_gate
    const candidates = allBees.map(b => ({ id: b.domain, vector: b.vector }));
    const routeResult = CSL.route_gate(intentVec, candidates, threshold);

    // Enrich with priority weighting via soft_gate
    const ranked = routeResult.scores.map(s => {
        const bee = allBees.find(b => b.domain === s.id);
        const priorityActivation = CSL.soft_gate(bee.priority, 0.5, 10);
        // Composite: 70% semantic resonance + 30% priority
        const composite = s.score * 0.7 + priorityActivation * 0.3;
        return {
            domain: s.id,
            description: bee.description,
            resonance: s.score,
            activation: s.activation,
            priority: bee.priority,
            priorityActivation: +priorityActivation.toFixed(6),
            composite: +composite.toFixed(6),
        };
    }).sort((a, b) => b.composite - a.composite).slice(0, topK);

    const best = ranked.length > 0 ? allBees.find(b => b.domain === ranked[0].domain) : null;

    return {
        best,
        ranked,
        csl: {
            intentDim: intentVec.length,
            candidatesScored: allBees.length,
            fallback: routeResult.fallback,
            gateStats: CSL.getStats(),
        },
    };
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
 * Create a coordinated swarm of bees with CSL-powered candidate scoring.
 * Uses multi_resonance to rank bees by semantic affinity to the swarm mission,
 * and superposition_gate to build the swarm's composite capability vector.
 *
 * @param {string} name - Swarm name
 * @param {Array} beeConfigs - Array of { domain, config } for each bee
 * @param {Object} policy - Orchestration policy
 * @param {string} policy.mode - 'parallel', 'sequential', or 'pipeline'
 * @param {boolean} policy.requireConsensus - If true, all bees must succeed
 * @param {number} policy.timeoutMs - Max execution time per bee (default: 30000)
 * @returns {Object} The swarm bee entry with CSL scoring
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

    // CSL: Score each bee's affinity to the swarm mission using multi_resonance
    const swarmIntentVec = _domainToVec(name);
    const beeVectors = bees.map(b => b.vector);
    const affinityScores = beeVectors.length > 0
        ? CSL.multi_resonance(swarmIntentVec, beeVectors, 0.2)
        : [];

    // CSL: Build composite swarm vector via consensus superposition
    const swarmVector = beeVectors.length > 0
        ? CSL.consensus_superposition(beeVectors)
        : swarmIntentVec;

    // Create the orchestrating swarm bee
    const swarmBee = createBee(`swarm-${name}`, {
        description: `Swarm: ${name} (${mode}, ${bees.length} bees, CSL-scored)`,
        priority: 1.0,
        isSwarm: true,
        workers: [{
            name: 'orchestrate',
            fn: async (ctx = {}) => {
                const results = {};
                const startTime = Date.now();

                // Order bees by CSL affinity (highest first) for sequential/pipeline modes
                const orderedBees = affinityScores.length > 0
                    ? affinityScores.map(s => bees[s.index])
                    : bees;

                if (mode === 'parallel') {
                    const settled = await Promise.allSettled(
                        orderedBees.map(async (bee) => {
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
                    for (const bee of orderedBees) {
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
                    csl: {
                        affinityScores: affinityScores.map(s => ({ index: s.index, score: s.score })),
                        swarmVectorDim: swarmVector.length,
                    },
                    results,
                };
            },
        }],
    });

    // Attach the composite swarm vector
    swarmBee.vector = swarmVector;
    swarmBee.csl.affinityScores = affinityScores.map(s => ({ index: s.index, score: s.score }));

    return swarmBee;
}

/**
 * Get all dynamic and ephemeral bees with CSL metadata.
 */
function listDynamicBees() {
    const bees = [];
    for (const [id, entry] of _dynamicRegistry) {
        bees.push({
            domain: id, description: entry.description, priority: entry.priority,
            type: 'dynamic', createdAt: entry.createdAt,
            csl: entry.csl || null,
        });
    }
    for (const [id, entry] of _ephemeralBees) {
        bees.push({
            domain: id, description: entry.description, priority: entry.priority,
            type: 'ephemeral', createdAt: entry.createdAt,
            csl: entry.csl || null,
        });
    }
    return bees;
}

/**
 * Dissolve (remove) a dynamic or ephemeral bee.
 */
function dissolveBee(domain) {
    _dynamicRegistry.delete(domain);
    _ephemeralBees.delete(domain);
    _vecCache.delete(domain);
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
 * Auto-generated by Dynamic Bee Factory (CSL-enabled)
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
    routeBee,
    createWorkUnit,
    createFromTemplate,
    createSwarm,
    listDynamicBees,
    dissolveBee,
    dynamicRegistry: _dynamicRegistry,
    ephemeralBees: _ephemeralBees,
    _domainToVec,
};
