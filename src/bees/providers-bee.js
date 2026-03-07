/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Providers Bee — Covers all AI provider modules:
 * brain-providers.js, claude-sdk.js, provider-benchmark.js,
 * heady-models.js, monte-carlo.js
 */
const domain = 'providers';
const description = 'Brain providers, Claude SDK, provider benchmark, model catalog, Monte Carlo';
const priority = 0.85;

function getWork(ctx = {}) {
    const mods = [
        { name: 'brain-providers', path: '../providers/brain-providers' },
        { name: 'claude-sdk', path: '../providers/claude-sdk' },
        { name: 'provider-benchmark', path: '../provider-benchmark' },
        { name: 'heady-models', path: '../models/heady-models' },
        { name: 'monte-carlo', path: '../monte-carlo' },
    ];
    return mods.map(m => async () => {
        try { require(m.path); return { bee: domain, action: m.name, loaded: true }; }
        catch { return { bee: domain, action: m.name, loaded: false }; }
    });
}

module.exports = { domain, description, priority, getWork };
