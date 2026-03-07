/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Services Bee — Covers all src/services/ modules:
 * arena-mode (600), branch-automation (646), budget (200+), daw-mcp-bridge (796),
 * dynamic-connector, error-sentinel, heady-autonomy, heady-branded-output,
 * heady-notion (733), monte-carlo (578), openai-business, realtime-intelligence,
 * service-manager (602), socratic (678)
 */
const domain = 'services';
const description = 'Arena, branch-automation, budget, DAW, dynamic-connector, error-sentinel, autonomy, branded-output, notion, monte-carlo, openai, realtime-intel, service-manager, socratic';
const priority = 0.85;

function getWork(ctx = {}) {
    const services = [
        'arena-mode-service', 'branch-automation-service', 'budget-service',
        'daw-mcp-bridge', 'dynamic-connector-service', 'error-sentinel-service',
        'heady-autonomy', 'heady-branded-output', 'heady-notion',
        'monte-carlo-service', 'openai-business', 'realtime-intelligence-service',
        'service-manager', 'socratic-service',
    ];
    return services.map(svc => async () => {
        try { require(`../services/${svc}`); return { bee: domain, action: svc, loaded: true }; }
        catch { return { bee: domain, action: svc, loaded: false }; }
    });
}

module.exports = { domain, description, priority, getWork };
