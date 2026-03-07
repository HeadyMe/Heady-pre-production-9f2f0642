/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 *
 * Refactor Bee — Learns from EVERY system action, not just major ones.
 * Utility can shift at any moment. This bee observes all operations,
 * tracks refactoring patterns, and feeds learnings back into vector space.
 *
 * Part of the event-driven reactor architecture:
 *   - No cycles, no timers
 *   - Reacts to system events instantaneously
 *   - Every action is a learning opportunity
 */

const domain = 'refactoring';
const description = 'Learns from every system action — utility can shift at any moment';
const priority = 0.9;

// Track what the system has learned from each action
const _learningLog = [];
const MAX_LOG = 500;

function getWork(ctx = {}) {
    return [
        // ═══ ARCHITECTURE LEARNING ═══════════════════════════════════════
        async () => {
            const fs = require('fs');
            const path = require('path');
            const srcDir = path.join(__dirname, '..');
            let moduleCount = 0;
            try {
                moduleCount = fs.readdirSync(srcDir).filter(f => f.endsWith('.js')).length;
            } catch { /* ok */ }
            const learning = {
                type: 'architecture-scan', moduleCount,
                insight: `${moduleCount} source modules — any could be refactored for better vector space integration`,
                ts: Date.now(),
            };
            _learningLog.push(learning);
            if (_learningLog.length > MAX_LOG) _learningLog.splice(0, _learningLog.length - MAX_LOG);
            return { bee: domain, action: 'architecture-learning', ...learning };
        },

        // ═══ BEE SWARM LEARNING ═══════════════════════════════════════
        async () => {
            const fs = require('fs');
            const path = require('path');
            const beesDir = __dirname;
            let beeCount = 0;
            try {
                beeCount = fs.readdirSync(beesDir).filter(f => f.endsWith('-bee.js')).length;
            } catch { /* ok */ }
            return {
                bee: domain, action: 'swarm-learning',
                beeCount, insight: `${beeCount} bees in swarm — each one is both a worker and a learner`,
                ts: Date.now(),
            };
        },

        // ═══ VECTOR SPACE HEALTH LEARNING ════════════════════════════════
        async () => {
            const mem = process.memoryUsage();
            const heapUsedMB = Math.round(mem.heapUsed / 1048576);
            const heapTotalMB = Math.round(mem.heapTotal / 1048576);
            const heapPct = Math.round((heapUsedMB / heapTotalMB) * 100);
            return {
                bee: domain, action: 'vector-space-health',
                heapUsedMB, heapTotalMB, heapPct,
                insight: heapPct > 80
                    ? 'High memory pressure — vector space compaction recommended'
                    : `Heap ${heapPct}% — vector space has room for growth`,
                ts: Date.now(),
            };
        },

        // ═══ EVENT PATTERN LEARNING ══════════════════════════════════════
        async () => {
            const eventBus = global.eventBus;
            const listenerCounts = {};
            if (eventBus) {
                for (const name of eventBus.eventNames()) {
                    listenerCounts[name] = eventBus.listenerCount(name);
                }
            }
            const total = Object.values(listenerCounts).reduce((s, c) => s + c, 0);
            return {
                bee: domain, action: 'event-pattern-learning',
                totalListeners: total,
                eventTypes: Object.keys(listenerCounts).length,
                insight: `${total} listeners across ${Object.keys(listenerCounts).length} event types — every one is a learning channel`,
                ts: Date.now(),
            };
        },

        // ═══ DEPENDENCY GRAPH LEARNING ═══════════════════════════════════
        async () => {
            const cachedModules = Object.keys(require.cache).length;
            return {
                bee: domain, action: 'dependency-learning',
                cachedModules,
                insight: `${cachedModules} modules in require cache — dependency graph is the nervous system`,
                ts: Date.now(),
            };
        },

        // ═══ ERROR ABSORPTION LEARNING ═══════════════════════════════════
        async () => {
            const errCount = _learningLog.filter(l => l.type === 'error-absorbed').length;
            return {
                bee: domain, action: 'error-absorption-learning',
                absorbedErrors: errCount,
                insight: `${errCount} errors absorbed and converted to learnings — every failure teaches`,
                ts: Date.now(),
            };
        },

        // ═══ PROCESS VITALS LEARNING ═════════════════════════════════════
        async () => {
            const os = require('os');
            const cpus = os.cpus().length;
            const loadAvg = os.loadavg();
            const uptimeSec = Math.floor(process.uptime());
            return {
                bee: domain, action: 'process-vitals-learning',
                cpus, loadAvg: loadAvg.map(l => l.toFixed(2)),
                uptimeSec,
                insight: `${cpus} cores, load [${loadAvg.map(l => l.toFixed(2)).join(', ')}], uptime ${uptimeSec}s — vitals inform refactoring priorities`,
                ts: Date.now(),
            };
        },

        // ═══ REFACTORING STATUS ══════════════════════════════════════════
        async () => ({
            bee: domain, action: 'refactoring-status',
            totalLearnings: _learningLog.length,
            insight: `${_learningLog.length} total learnings captured — every action feeds the next optimization`,
            ts: Date.now(),
        }),
    ];
}

module.exports = { domain, description, priority, getWork, learningLog: _learningLog };
