/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Memory Bee — Covers vector-memory.js (667 lines), vector-federation.js,
 * vector-pipeline.js, hybrid-search.js, embedding-provider.js, memory-receipts.js
 */
const domain = 'memory';
const description = 'Vector memory, federation, pipeline, hybrid search, embeddings, receipts';
const priority = 0.85;

function getWork(ctx = {}) {
    const mods = [
        { name: 'vector-memory', path: '../vector-memory' },
        { name: 'vector-federation', path: '../vector-federation' },
        { name: 'vector-pipeline', path: '../vector-pipeline' },
        { name: 'hybrid-search', path: '../hybrid-search' },
        { name: 'embedding-provider', path: '../embedding-provider' },
        { name: 'memory-receipts', path: '../memory-receipts' },
    ];
    return mods.map(m => async () => {
        try { require(m.path); return { bee: domain, action: m.name, loaded: true }; }
        catch { return { bee: domain, action: m.name, loaded: false }; }
    });
}

module.exports = { domain, description, priority, getWork };
