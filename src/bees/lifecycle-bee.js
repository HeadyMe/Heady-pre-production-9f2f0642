/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Lifecycle Bee — Covers all lifecycle/bootstrap modules:
 * engine-wiring.js, service-routes.js, static-hosting.js,
 * error-pipeline-bridge.js, graceful-shutdown.js,
 * heady-registry.js, hc_service_dispatcher.js, hc_qa.js,
 * hc_improvement_scheduler.js, generate-verticals.js,
 * config-buildout-tasks.js, decomposition-tasks.js, architecture-tasks.js
 */
const domain = 'lifecycle';
const description = 'Bootstrap wiring, service routes, static hosting, error bridge, shutdown, registry, QA, improvement scheduler, verticals, config-buildout, decomposition, architecture';
const priority = 0.7;

function getWork(ctx = {}) {
    const mods = [
        { name: 'engine-wiring', path: '../bootstrap/engine-wiring' },
        { name: 'service-routes', path: '../bootstrap/service-routes' },
        { name: 'static-hosting', path: '../bootstrap/static-hosting' },
        { name: 'error-pipeline-bridge', path: '../lifecycle/error-pipeline-bridge' },
        { name: 'graceful-shutdown', path: '../lifecycle/graceful-shutdown' },
        { name: 'heady-registry', path: '../heady-registry' },
        { name: 'service-dispatcher', path: '../hc_service_dispatcher' },
        { name: 'qa', path: '../hc_qa' },
        { name: 'improvement-scheduler', path: '../hc_improvement_scheduler' },
        { name: 'generate-verticals', path: '../generate-verticals' },
        { name: 'config-buildout', path: '../config-buildout-tasks' },
        { name: 'decomposition', path: '../decomposition-tasks' },
        { name: 'architecture', path: '../architecture-tasks' },
    ];
    return mods.map(m => async () => {
        try { require(m.path); return { bee: domain, action: m.name, loaded: true }; }
        catch { return { bee: domain, action: m.name, loaded: false }; }
    });
}

module.exports = { domain, description, priority, getWork };
