/**
 * ∞ Service Registry — Phase 7 Bootstrap
 * Extracted from heady-manager.js lines 1267-1510
 * 40+ service mount points via try/require pattern
 */
module.exports = function mountServices(app, { logger, authEngine, vectorMemory, buddy, pipeline, _engines, secretsManager, cfManager, eventBus, projectRoot }) {
    const { orchestrator } = _engines || {};
    const { midiBus } = require('../engines/midi-event-bus');

    // Route-based services
    const routeServices = [
        ['../routes/buddy-companion', '/api/buddy-companion', 'Buddy Companion'],
        ['../routes/headybuddy-config', '/api/headybuddy-config', 'HeadyBuddy Config'],
        ['../routes/headyme-onboarding', '/api/headyme-onboarding', 'HeadyMe Onboarding'],
        ['../routes/health-routes', '/health', 'Health Routes'],
    ];
    for (const [mod, mount, name] of routeServices) {
        try { app.use(mount, require(mod)); logger.logNodeActivity("CONDUCTOR", `  ∞ ${name}: LOADED → ${mount}`); }
        catch (err) { logger.logNodeActivity("CONDUCTOR", `  ⚠ ${name} not loaded: ${err.message}`); }
    }

    // Harmony Orchestrator (needs params)
    try {
        const harmonyRoutes = require('../routes/harmony')({ orchestrator: _engines?.orchestrator, engines: _engines, authEngine, midiBus });
        app.use('/api/harmony', harmonyRoutes);
    } catch (err) { logger.logNodeActivity("CONDUCTOR", `  ⚠ Harmony not loaded: ${err.message}`); }

    // Enterprise Ops
    try {
        const opsRoutes = require('../routes/enterprise-ops')({ orchestrator: _engines?.orchestrator, engines: _engines, midiBus });
        app.use('/api/enterprise', opsRoutes);
    } catch (err) { logger.logNodeActivity("CONDUCTOR", `  ⚠ Enterprise Ops not loaded: ${err.message}`); }

    // SSE Streaming
    try { require('../routes/sse-streaming')(app); } catch { }

    // Service Route Registration (Phase 2 Liquid)
    const { registerServiceRoutes } = require('./service-routes');
    registerServiceRoutes(app, { engines: _engines, vectorMemory, orchestrator: _engines?.orchestrator, Handshake: require('../security/handshake'), projectRoot });

    // Static Hosting & Domain Routing
    const { mountStaticHosting } = require('./static-hosting');
    mountStaticHosting(app, projectRoot);

    // Core API
    try { app.use('/api', require('../../services/core-api')); } catch {
        try { app.use('/api', require('../routes/config-api')); } catch { }
    }

    // Pipeline API
    try { app.use('/api/pipeline', require('../routes/pipeline-api')); } catch { }

    // Buddy Route (pillar)
    try {
        require('../routes/buddy')(app, {
            continuousPipeline: { running: false, cycleCount: 0 }, storyDriver: _engines?.storyDriver,
            resourceManager: _engines?.resourceManager, patternEngine: _engines?.patternEngine,
            selfCritiqueEngine: _engines?.selfCritiqueEngine, orchestrator: _engines?.orchestrator,
            engines: _engines, vectorMemory, midiBus,
        });
    } catch (err) { logger.logNodeActivity("CONDUCTOR", `  ⚠ Buddy routes not loaded: ${err.message}`); }

    // Secrets and Cloudflare routes
    try {
        if (secretsManager) { require('../hc_secrets_manager').registerSecretsRoutes(app); secretsManager.startMonitor(60000); }
        if (cfManager) { require('../hc_cloudflare').registerCloudflareRoutes(app, cfManager); }
    } catch { }

    // Upstash Redis
    try {
        const upstash = require('../services/upstash-redis');
        upstash.redisRoutes(app);
    } catch { }

    // Liquid State + IDE Bridge + Projection Engine + Governance + Domain Router + UI Registry + LLM Router
    const autoServices = [
        ['../services/liquid-state-manager', (s) => { s.boot(); s.liquidStateRoutes(app); }, 'LiquidState'],
        ['../services/ide-bridge', (s) => s.ideBridgeRoutes(app), 'IDEBridge'],
        ['../services/projection-engine', (s) => s.projectionRoutes(app), 'ProjectionEngine'],
        ['../services/projection-governance', (s) => s.governanceRoutes(app), 'ProjectionGov'],
        ['../services/domain-router', (s) => s.domainRouterRoutes(app), 'DomainRouter'],
        ['../services/ui-registry', (s) => s.uiRegistryRoutes(app), 'UIRegistry'],
        ['../services/llm-router', (s) => s.llmRouterRoutes(app), 'LLMRouter'],
    ];
    for (const [mod, init, name] of autoServices) {
        try { init(require(mod)); logger.logNodeActivity("CONDUCTOR", `  ∞ ${name}: LOADED`); }
        catch (err) { logger.logNodeActivity("CONDUCTOR", `  ⚠ ${name} not loaded: ${err.message}`); }
    }

    // Autonomous Scheduler + Swarm Ignition + Bee Templates + Consensus
    try { const s = require('../services/autonomous-scheduler'); s.start(); s.schedulerRoutes(app); } catch { }
    try { const { igniteSwarm, swarmIgnitionRoutes } = require('../orchestration/swarm-ignition'); igniteSwarm({ enablePruner: true, enableTester: true, enableEmbedder: true }); swarmIgnitionRoutes(app); } catch { }
    try { require('../bees/headybee-template-registry').registerRoutes(app); } catch { }
    try { const { consensus, registerConsensusRoutes } = require('../orchestration/swarm-consensus'); consensus.startStaleCheck(); registerConsensusRoutes(app); } catch { }

    // Redis pool shutdown
    try { const { onShutdown } = require('../lifecycle/graceful-shutdown'); const rp = require('../utils/redis-pool'); onShutdown('redis-pool', () => rp.close()); } catch { }

    // Provider analytics
    try { app.use('/api/providers', require('../routes/provider-analytics')); } catch { }

    // Models API
    try { app.use('/api', require('../routes/models-api')); } catch { }

    // Aloha Protocol
    try { require('../routes/aloha')(app, { selfCritiqueEngine: _engines?.selfCritiqueEngine, storyDriver: _engines?.storyDriver, resourceManager: _engines?.resourceManager, patternEngine: _engines?.patternEngine }); } catch { }
};
