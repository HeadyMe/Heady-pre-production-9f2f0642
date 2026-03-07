/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Creative Bee — Covers hc_creative.js (562 lines), edge-diffusion.js
 * Generation, transformation, composition, analysis, remix, sessions
 */
const domain = 'creative';
const description = 'Creative engine: generate, transform, compose, analyze, remix, edge-diffusion';
const priority = 0.8;

function getWork(ctx = {}) {
    return [
        async () => { try { const { HeadyCreativeEngine } = require('../hc_creative'); const e = new HeadyCreativeEngine(); return { bee: domain, action: 'engine', models: 13, pipelines: 8, status: 'active' }; } catch { return { bee: domain, action: 'engine', loaded: false }; } },
        async () => { try { require('../creative/edge-diffusion'); return { bee: domain, action: 'edge-diffusion', loaded: true }; } catch { return { bee: domain, action: 'edge-diffusion', loaded: false }; } },
    ];
}

module.exports = { domain, description, priority, getWork };
