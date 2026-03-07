/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 *
 * Bee Worker Registry — Auto-discovers and registers all
 * blast-compatible worker modules in src/bees/.
 *
 * Each worker module exports:
 *   { domain: string, work: Function[] }
 *
 * HeadyBees queries this registry to find available workers,
 * then blast() decides how many bees to spawn dynamically.
 */

const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

const BEES_DIR = __dirname;
const _registry = new Map();
let _discoveryStats = { loaded: 0, failed: 0, failedFiles: [], discoveredAt: null };

/**
 * Auto-discover all bee worker modules in this directory.
 * Each module that exports a `domain` and `getWork()` is registered.
 */
function discover() {
    const files = fs.readdirSync(BEES_DIR).filter(f =>
        f.endsWith(".js") && f !== "registry.js" && !f.startsWith("_")
    );

    let loaded = 0;
    let failed = 0;
    const failedFiles = [];

    for (const file of files) {
        try {
            const mod = require(path.join(BEES_DIR, file));
            if (mod.domain && typeof mod.getWork === "function") {
                _registry.set(mod.domain, {
                    file,
                    domain: mod.domain,
                    description: mod.description || `${mod.domain} bee worker`,
                    getWork: mod.getWork,
                    priority: mod.priority || 0.5,
                });
                logger.logNodeActivity("BEE-REGISTRY", `  🐝 Discovered: ${mod.domain} (${file})`);
                loaded++;
            }
        } catch (err) {
            logger.logNodeActivity("BEE-REGISTRY", `  ⚠ Failed to load ${file}: ${err.message}`);
            failed++;
            failedFiles.push({ file, error: err.message });
        }
    }

    _discoveryStats = { loaded, failed, failedFiles, discoveredAt: Date.now() };

    // Emit discovery telemetry
    if (global.eventBus) {
        global.eventBus.emit('telemetry:ingested', {
            metric: 'bee_discovery',
            value: { loaded, failed, total: _registry.size },
            component: 'bee-registry',
            confidence: 1.0,
        });
    }

    return _registry.size;
}

/**
 * Get blast-compatible work arrays for a given domain.
 * HeadyBees calls this to get the work, then blast() decides parallelism.
 *
 * @param {string} domain - The domain to get work for (e.g., 'brain-providers')
 * @param {Object} context - Context passed to the work functions
 * @returns {Function[]} Array of work functions for HeadyBees.blast()
 */
function getWork(domain, context = {}) {
    const entry = _registry.get(domain);
    if (!entry) return [];
    return entry.getWork(context);
}

/**
 * Get all registered domains with their metadata.
 */
function listDomains() {
    const domains = [];
    for (const [name, entry] of _registry) {
        domains.push({
            domain: name,
            file: entry.file,
            description: entry.description,
            priority: entry.priority,
        });
    }
    return domains;
}

/**
 * Get all work from all domains — for full-swarm blasts.
 * HeadyBees can blast ALL available work dynamically.
 *
 * @param {Object} context - Context passed to all work functions
 * @returns {{ name: string, work: Function[], urgency: number }[]}
 */
function getAllWork(context = {}) {
    const tasks = [];
    for (const [name, entry] of _registry) {
        const work = entry.getWork(context);
        if (work.length > 0) {
            tasks.push({
                name: `bee-${name}`,
                work,
                urgency: entry.priority,
                context,
            });
        }
    }
    return tasks;
}

/**
 * Get health status of the bee registry.
 * Shows discovery stats: loaded, failed, total.
 */
function getHealth() {
    return {
        registered: _registry.size,
        ..._discoveryStats,
        domains: Array.from(_registry.keys()),
    };
}

// ─── DYNAMIC BEE FACTORY ────────────────────────────────────────────────
// Heady can create any type of bee on the fly — no pre-definition needed
const factory = require('./bee-factory');

module.exports = {
    discover,
    getWork,
    listDomains,
    getAllWork,
    getHealth,
    registry: _registry,
    // Dynamic bee creation — available everywhere
    createBee: factory.createBee,
    spawnBee: factory.spawnBee,
    createWorkUnit: factory.createWorkUnit,
    createFromTemplate: factory.createFromTemplate,
    listDynamicBees: factory.listDynamicBees,
    dissolveBee: factory.dissolveBee,
};
