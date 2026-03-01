/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 * Routes Bee — Covers all src/routes/ that are service-like:
 * lens.js (671), memory.js (616), battle.js, brain.js (1105),
 * buddy, conductor, governance, harmony, hcfp, health,
 * nodes, ops, patterns, pipeline-api, soul, system, vinci, etc.
 */
const domain = 'routes';
const description = 'All API routes: brain, lens, memory, battle, buddy, conductor, governance, harmony, health, nodes, ops, patterns, pipeline, soul, system, vinci';
const priority = 0.7;

function getWork(ctx = {}) {
    const routes = [
        'aloha', 'auth-routes', 'battle', 'billing-routes', 'brain',
        'buddy', 'buddy-companion', 'budget-router', 'claude-routes',
        'conductor', 'config', 'config-api', 'enterprise-ops', 'governance',
        'harmony', 'hcfp', 'headybuddy-config', 'headyme-onboarding',
        'health-routes', 'hive-sdk', 'lens', 'maintenance', 'memory',
        'midi', 'models-api', 'nodes', 'nuke-switch', 'ops', 'patterns',
        'pipeline-api', 'pqc', 'predictive-suggestions', 'provider-analytics',
        'pulse-api', 'redis-health', 'registry', 'resilience', 'resilience-routes',
        'service-stubs', 'soul', 'spec-routes', 'sse-streaming', 'system',
        'vinci', 'vinci-canvas', 'vm-token-routes',
    ];
    return routes.map(name => async () => {
        try { require(`../routes/${name}`); return { bee: domain, action: name, loaded: true }; }
        catch { return { bee: domain, action: name, loaded: false }; }
    });
}

module.exports = { domain, description, priority, getWork };
