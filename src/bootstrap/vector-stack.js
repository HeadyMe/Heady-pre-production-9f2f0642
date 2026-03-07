/**
 * ∞ Vector Stack — Phase 4 Bootstrap
 * Extracted from heady-manager.js lines 447-907
 * Vector memory, pipeline, federation, bees, spatial, buddy, watchdog
 */
module.exports = function mountVectorStack(app, { logger, eventBus }) {
    // 3D Vector Memory
    const vectorMemory = require('../vector-memory');
    vectorMemory.init();

    // Vector Space Operations
    const { VectorSpaceOps } = require('../vector-space-ops');
    const vectorSpaceOps = new VectorSpaceOps(vectorMemory);
    vectorSpaceOps.registerRoutes(app);
    vectorSpaceOps.start();
    logger.logNodeActivity("CONDUCTOR", "  🌐 VectorSpaceOps: ACTIVE");
    eventBus.emit('vector_ops:started', { subsystems: ['anti-sprawl', 'security', 'maintenance', 'projections'] });

    // Bee Swarm Discovery
    try {
        const beeRegistry = require('../bees/registry');
        const beeCount = beeRegistry.discover();
        logger.logNodeActivity("CONDUCTOR", `  🐝 Bee Swarm: ${beeCount} bees discovered`);
        eventBus.emit('bee_swarm:discovered', { count: beeCount });
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Bee Swarm: discovery failed — ${err.message}`);
    }

    // Self-Awareness Telemetry
    let selfAwareness = null;
    try {
        selfAwareness = require('../self-awareness');
        selfAwareness.startSelfAwareness();
        logger.logNodeActivity("CONDUCTOR", "  ∞ Self-Awareness: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Self-Awareness not loaded: ${err.message}`);
    }

    // Vector-Augmented Response Pipeline
    const vectorPipeline = require('../vector-pipeline');
    app.use(vectorPipeline.createVectorAugmentedMiddleware(vectorMemory));
    vectorPipeline.registerRoutes(app, vectorMemory);

    const vectorFederation = require('../vector-federation');
    vectorFederation.registerRoutes(app);
    vectorMemory.registerRoutes(app);
    logger.logNodeActivity("CONDUCTOR", "  ∞ VectorPipeline + Federation: ACTIVE");

    // Headybee Template Registry
    try {
        const { registerHeadybeeTemplateRegistryRoutes } = require('../services/headybee-template-registry');
        registerHeadybeeTemplateRegistryRoutes(app);
    } catch (err) { logger.logNodeActivity("CONDUCTOR", `  ⚠ HeadybeeRegistry not loaded: ${err.message}`); }

    // Antigravity Runtime
    try {
        const antigravityRuntime = require('../services/antigravity-heady-runtime');
        const health = antigravityRuntime.getHealthStatus();
        app.get("/api/antigravity/health", (_req, res) => res.json(health));
        app.post("/api/antigravity/enforce", (req, res) => {
            try { res.json({ ok: true, plan: antigravityRuntime.enforceHeadyForAntigravityOperation(req.body) }); }
            catch (err) { res.status(400).json({ ok: false, error: err.message }); }
        });
        app.get("/api/antigravity/policy", (_req, res) => {
            try { res.json(antigravityRuntime.readPolicy()); }
            catch (err) { res.status(500).json({ error: err.message }); }
        });
        logger.logNodeActivity("CONDUCTOR", `  🌐 AntigravityRuntime: ENFORCED`);
    } catch (err) { logger.logNodeActivity("CONDUCTOR", `  ⚠ AntigravityRuntime not loaded: ${err.message}`); }

    // Buddy Chat Contract
    try {
        const buddyChatContract = require('../services/buddy-chat-contract');
        app.post("/api/buddy-chat/request", (req, res) => {
            try { res.json({ ok: true, ...buddyChatContract.buildChatRequest(req.body) }); }
            catch (err) { res.status(400).json({ ok: false, error: err.message }); }
        });
        app.post("/api/buddy-chat/workspace", (req, res) => {
            res.json({ ok: true, workspaceId: buddyChatContract.buildUserWorkspaceId(req.body) });
        });
    } catch (err) { logger.logNodeActivity("CONDUCTOR", `  ⚠ BuddyChatContract not loaded: ${err.message}`); }

    // Service group: Digital Presence, Unified Autonomy, Liquid System, Liquid Runtime, Onboarding
    const serviceGroup = [
        ['../services/digital-presence-orchestrator', 'registerDigitalPresenceOrchestratorRoutes', 'DigitalPresence'],
        ['../services/unified-enterprise-autonomy', 'registerUnifiedEnterpriseAutonomyRoutes', 'UnifiedAutonomy'],
        ['../services/unified-liquid-system', 'registerUnifiedLiquidSystemRoutes', 'UnifiedLiquidSystem'],
        ['../services/liquid-unified-runtime', 'registerLiquidUnifiedRuntimeRoutes', 'LiquidUnifiedRuntime'],
        ['../services/onboarding-orchestrator', 'registerOnboardingOrchestratorRoutes', 'OnboardingOrchestrator'],
    ];
    for (const [mod, fn, name] of serviceGroup) {
        try { require(mod)[fn](app); logger.logNodeActivity("CONDUCTOR", `  ∞ ${name}: LOADED`); }
        catch (err) { logger.logNodeActivity("CONDUCTOR", `  ⚠ ${name} not loaded: ${err.message}`); }
    }

    // Spatial subsystems
    try { require('../services/spatial-embedder').registerRoutes(app); } catch { }
    try { require('../services/octree-manager').registerRoutes(app); } catch { }
    try { require('../services/redis-sync-bridge').registerRoutes(app); } catch { }
    try { require('../services/buddy-system').registerRoutes(app); } catch { }

    // Heady core services (registerRoutes pattern)
    const coreServices = [
        ['../services/heady-autonomy', 'HeadyAutonomy'],
        ['../services/service-manager', 'ServiceManager'],
        ['../services/dynamic-connector-service', 'DynamicConnector'],
        ['../services/cloud-midi-sequencer', 'CloudMIDI'],
        ['../services/daw-mcp-bridge', 'DAW-MCP'],
        ['../services/realtime-intelligence-service', 'RealtimeIntelligence'],
        ['../services/admin-citadel', 'AdminCitadel'],
        ['../services/error-sentinel-service', 'ErrorSentinel'],
    ];
    for (const [mod, name] of coreServices) {
        try {
            const svc = require(mod);
            if (svc.registerRoutes) svc.registerRoutes(app);
            else if (svc.register) svc.register(app);
            logger.logNodeActivity("CONDUCTOR", `  ∞ ${name}: LOADED`);
        } catch (err) { logger.logNodeActivity("CONDUCTOR", `  ⚠ ${name} not loaded: ${err.message}`); }
    }

    // Brain → VectorMemory wiring
    try {
        const brainRoutes = require('../routes/brain');
        if (brainRoutes.setMemoryWrapper) brainRoutes.setMemoryWrapper(vectorMemory);
    } catch { }

    // HeadyCorrections
    const corrections = require('../corrections');
    corrections.init();
    corrections.registerRoutes(app);

    // Agent Orchestrator
    const { getOrchestrator } = require('../agent-orchestrator');
    const orchestrator = getOrchestrator({ baseUrl: process.env.HEADY_MANAGER_URL || "https://manager.headysystems.com", apiKey: process.env.HEADY_API_KEY });
    orchestrator.registerRoutes(app);
    orchestrator.setVectorMemory(vectorMemory);
    logger.logNodeActivity("CONDUCTOR", "  ∞ AgentOrchestrator: LOADED");

    // Conductor
    const { getConductor } = require('../heady-conductor');
    const { SecretRotation } = require('../security/secret-rotation');
    const { AutoHeal } = require('../resilience/auto-heal');
    const Handshake = require('../security/handshake');

    try { require('../security/code-governance').loadConfig(); require('../security/code-governance').registerRoutes(app); } catch { }

    const conductor = getConductor();
    const secretRotation = new SecretRotation();
    const autoHeal = new AutoHeal(conductor);

    setInterval(() => autoHeal.check(), 60000 * 5);
    setInterval(() => { const r = secretRotation.audit(); if (r.expired.length > 0) logger.logNodeActivity("CONDUCTOR", `[SECURITY] Secret Audit: ${r.expired.length} expired`); }, 86400000);

    const initialAudit = secretRotation.audit();
    logger.logNodeActivity("CONDUCTOR", `  ∞ Secret Rotation: INITIALIZED (Score: ${initialAudit.score})`);
    autoHeal.check();

    conductor.setOrchestrator(orchestrator);
    conductor.setVectorMemory(vectorMemory);
    conductor.registerRoutes(app);

    // Compute Dashboard
    require('../compute-dashboard').registerRoutes(app, orchestrator);

    // Buddy Core + Watchdog
    const { getBuddy } = require('../orchestration/buddy-core');
    const { BuddyWatchdog } = require('../orchestration/buddy-watchdog');
    const buddy = getBuddy();
    buddy.setConductor(conductor);
    buddy.setVectorMemory(vectorMemory);
    try {
        const redisHealth = require('../routes/redis-health');
        if (redisHealth.getClient && redisHealth.getClient()) buddy.setRedis(redisHealth.getClient());
    } catch { }
    buddy.registerRoutes(app);

    const watchdog = new BuddyWatchdog(buddy);
    watchdog.registerRoutes(app);
    watchdog.start();
    logger.logNodeActivity("CONDUCTOR", "  🐕 Buddy Watchdog: ACTIVE");

    // Deep Research
    try {
        const { DeepResearchEngine } = require('../deep-research');
        const HeadyGateway = require('../../heady-hive-sdk/lib/gateway');
        const deepResearch = new DeepResearchEngine(new HeadyGateway());
        app.post("/api/buddy/deep-research", async (req, res) => {
            try {
                const { query, providers, depth, maxWaitMs } = req.body || {};
                if (!query) return res.status(400).json({ ok: false, error: "query is required" });
                res.json(await deepResearch.research(query, { providers, depth, maxWaitMs }));
            } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
        });
        app.get("/api/buddy/deep-research/stats", (req, res) => res.json({ ok: true, ...deepResearch.getStats() }));
        buddy.registerMCPTool("deep_research", {
            description: "Multi-provider deep research with consensus scoring", category: "research",
            inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
            handler: async (input) => deepResearch.research(input.query, { depth: input.depth || "deep" }),
        });
    } catch (err) { logger.logNodeActivity("CONDUCTOR", `  ⚠ Deep Research not loaded: ${err.message}`); }

    // Vector-Serve
    try {
        const { VectorServe } = require('../vector-serve');
        new VectorServe(vectorMemory, logger).wireRoutes(app);
    } catch { }

    // Cross-Device Sync
    try {
        const { CrossDeviceSyncHub } = require('../cross-device-sync');
        const syncHub = new CrossDeviceSyncHub();
        syncHub.registerRoutes(app);
    } catch { }

    // System Monitor
    try {
        const sysMonitor = require('../system-monitor');
        sysMonitor.registerRoutes(app);
        sysMonitor.start();
    } catch { }

    // Continuous Learning
    try {
        const learningEngine = require('../continuous-learning');
        learningEngine.registerRoutes(app);
        app.locals.vectorMemory = vectorMemory;
    } catch { }

    // Self-Optimizer
    const selfOptimizer = require('../self-optimizer');
    selfOptimizer.registerRoutes(app, vectorMemory);

    // Pipeline reference from engine-wiring is passed in through pipeline-wiring phase
    const pipeline = require('../routes/pipeline-api');

    return { vectorMemory, buddy, watchdog, conductor, orchestrator, Handshake, selfAwareness, pipeline };
};
