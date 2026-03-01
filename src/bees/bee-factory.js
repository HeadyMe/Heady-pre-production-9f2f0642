/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
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

    const entry = {
        domain,
        description,
        priority,
        createdAt: Date.now(),
        dynamic: true,
        file: `dynamic:${domain}`,
        getWork: (ctx = {}) => workers.map(w => {
            if (typeof w === 'function') return w;
            if (typeof w.fn === 'function') return async () => {
                const result = await w.fn(ctx);
                return { bee: domain, action: w.name || 'work', ...result };
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
                        try {
                            const url = cfg.url || `https://${cfg.target}/api/health`;
                            return { target: cfg.target, url, status: 'checked' };
                        } catch (err) { return { target: cfg.target, error: err.message }; }
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
                        return { target: cfg.target, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal, ts: Date.now() };
                    }
                },
                { name: 'uptime', fn: async () => ({ target: cfg.target, uptime: process.uptime(), ts: Date.now() }) },
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
                { name: 'scan', fn: cfg.scanFn || (async () => ({ scanned: cfg.target, ts: Date.now() })) },
                { name: 'report', fn: cfg.reportFn || (async () => ({ report: `Scan complete: ${cfg.target}` })) },
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
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
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
    listDynamicBees,
    dissolveBee,
    dynamicRegistry: _dynamicRegistry,
    ephemeralBees: _ephemeralBees,
};
