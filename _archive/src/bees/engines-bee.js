/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 * Engines Bee — Covers all src/engines/ modules:
 * auto-commit-engine, finops-budget-router, midi-event-bus,
 * semantic-contextualizer, spatial-context-engine, ump-udp-transport, xet-storage-engine
 */
const domain = 'engines';
const description = 'Auto-commit, FinOps budget router, MIDI event bus, semantic contextualizer, spatial context, UMP UDP transport, XET storage';
const priority = 0.7;

function getWork(ctx = {}) {
    const mods = [
        'auto-commit-engine', 'finops-budget-router', 'midi-event-bus',
        'semantic-contextualizer', 'spatial-context-engine', 'ump-udp-transport', 'xet-storage-engine',
    ];
    return mods.map(name => async () => {
        try { require(`../engines/${name}`); return { bee: domain, action: name, loaded: true }; }
        catch { return { bee: domain, action: name, loaded: false }; }
    });
}

module.exports = { domain, description, priority, getWork };
