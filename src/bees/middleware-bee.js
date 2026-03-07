/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Middleware Bee — Covers all src/middleware/ modules:
 * auto-error-pipeline, cors-config, error-handler, request-id,
 * resilience-middleware, security-headers
 */
const domain = 'middleware';
const description = 'Auto-error pipeline, CORS, error handler, request-id, resilience, security headers';
const priority = 0.7;

function getWork(ctx = {}) {
    const mods = [
        'auto-error-pipeline', 'cors-config', 'error-handler',
        'request-id', 'resilience-middleware', 'security-headers',
    ];
    return mods.map(name => async () => {
        try { require(`../middleware/${name}`); return { bee: domain, action: name, loaded: true }; }
        catch { return { bee: domain, action: name, loaded: false }; }
    });
}

module.exports = { domain, description, priority, getWork };
