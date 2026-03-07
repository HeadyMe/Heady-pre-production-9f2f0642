/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Intelligence Bee — Covers hc_deep_intel.js, hc_deep_scan.js,
 * hc_realtime_intelligence.js, hc_scientist.js, continuous-learning.js,
 * duckdb-memory.js, predictive-cache.js, unified-context.js, voice-relay.js
 */
const domain = 'intelligence';
const description = 'Deep intel, deep scan, realtime intelligence, scientist, continuous learning, duckdb, predictive cache, context, voice';
const priority = 0.9;

function getWork(ctx = {}) {
    const mods = [
        { name: 'deep-intel', path: '../hc_deep_intel' },
        { name: 'deep-scan', path: '../hc_deep_scan' },
        { name: 'realtime-intel', path: '../hc_realtime_intelligence' },
        { name: 'scientist', path: '../hc_scientist' },
        { name: 'continuous-learning', path: '../continuous-learning' },
        { name: 'duckdb-memory', path: '../intelligence/duckdb-memory' },
        { name: 'predictive-cache', path: '../intelligence/predictive-cache' },
        { name: 'unified-context', path: '../intelligence/unified-context' },
        { name: 'voice-relay', path: '../intelligence/voice-relay' },
    ];
    return mods.map(m => async () => {
        try { require(m.path); return { bee: domain, action: m.name, loaded: true }; }
        catch { return { bee: domain, action: m.name, loaded: false }; }
    });
}

module.exports = { domain, description, priority, getWork };
