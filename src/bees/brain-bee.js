/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Brain Bee — Decomposes routes/brain.js (1105 lines) into blast-compatible work units.
 * Covers: chat, analyze, embed, search, complete, summarize
 */
const domain = 'brain';
const description = 'Brain API chat/analyze/embed/search orchestration';
const priority = 1.0;

function getWork(ctx = {}) {
    const brain = ctx.brain || {};
    return [
        async () => {
            const mod = require('../routes/brain');
            return { bee: domain, action: 'health', status: 'active', routes: ['chat', 'analyze', 'embed', 'search', 'complete', 'summarize'] };
        },
        async () => {
            const providers = require('../providers/brain-providers');
            return { bee: domain, action: 'provider-check', providers: Object.keys(providers).length };
        },
        async () => {
            const models = require('../models/heady-models');
            return { bee: domain, action: 'model-catalog', models: models.getAllModels?.()?.length || 0 };
        },
    ];
}

module.exports = { domain, description, priority, getWork };
