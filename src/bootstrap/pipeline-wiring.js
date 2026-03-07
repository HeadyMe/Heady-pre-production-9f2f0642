/**
 * ∞ Pipeline Wiring — Phase 6 Bootstrap
 * Extracted from heady-manager.js lines 1092-1266
 * Pipeline binding, self-healing, auto-task conversion, external task loading
 */
module.exports = function wirePipeline(app, { pipeline, buddy, vectorMemory, selfAwareness, _engines, logger, eventBus }) {
    const { patternEngine, storyDriver, mcPlanScheduler, selfCritiqueEngine, autoSuccessEngine } = _engines || {};

    // Bind pipeline to external systems
    try {
        if (pipeline && pipeline.bind) {
            pipeline.bind({ mcScheduler: mcPlanScheduler || null, patternEngine: patternEngine || null, selfCritique: selfCritiqueEngine || null });
            logger.logNodeActivity("CONDUCTOR", "  ∞ Pipeline bound to MC + Patterns + Self-Critique");
        }
    } catch (err) { logger.logNodeActivity("CONDUCTOR", `  ⚠ Pipeline bind failed: ${err.message}`); }

    // Self-healing wiring
    try {
        if (pipeline && buddy) {
            pipeline.errorInterceptor = buddy.errorInterceptor;
            pipeline.vectorMemory = vectorMemory;
            if (selfAwareness) { pipeline.selfAwareness = selfAwareness; }
            pipeline.buddyMetacognition = buddy.metacognition;
            buddy.setPipeline(pipeline);
            logger.logNodeActivity("CONDUCTOR", "  ∞ Self-Healing Pipeline: WIRED");
        }
    } catch (err) { logger.logNodeActivity("CONDUCTOR", `  ⚠ Self-Healing Pipeline wiring failed: ${err.message}`); }

    // Improvement Scheduler
    try {
        const { ImprovementScheduler, registerImprovementRoutes } = require('../hc_improvement_scheduler');
        const improvementScheduler = new ImprovementScheduler({ interval: 900000, pipeline, patternEngine, selfCritiqueEngine, mcPlanScheduler });
        registerImprovementRoutes(app, improvementScheduler);
        improvementScheduler.start();
        logger.logNodeActivity("CONDUCTOR", "  ∞ Improvement Scheduler: LOADED (15m cycles)");
    } catch (err) { logger.logNodeActivity("CONDUCTOR", `  ⚠ Improvement Scheduler not loaded: ${err.message}`); }

    // Apex Risk Agent
    try {
        const { ApexRiskAgent, registerApexRoutes } = require('../trading/apex-risk-agent');
        const apexRiskAgent = new ApexRiskAgent(process.env.APEX_ACCOUNT_TIER || '50K');
        registerApexRoutes(app, apexRiskAgent);
        logger.logNodeActivity("CONDUCTOR", `  📈 Apex Risk Agent: LOADED (tier: ${apexRiskAgent.tier})`);
    } catch (err) { logger.logNodeActivity("CONDUCTOR", `  ⚠ Apex Risk Agent not loaded: ${err.message}`); }

    // Load ALL external task catalogs
    if (autoSuccessEngine) {
        const taskSources = [
            { file: '../trading-tasks', label: 'Trading' },
            { file: '../architecture-tasks', label: 'Architecture' },
            { file: '../config-buildout-tasks', label: 'Config Build-Out' },
            { file: '../decomposition-tasks', label: 'Decomposition' },
            { file: '../auto-flow-200-tasks.json', label: 'Auto-Flow 200' },
            { file: '../buddy-tasks.json', label: 'Buddy' },
            { file: '../headyos-tasks.json', label: 'HeadyOS' },
            { file: '../long814-tasks.json', label: 'Long814' },
            { file: '../nonprofit-tasks.json', label: 'Nonprofit' },
            { file: '../orchestration-protocol-tasks.json', label: 'Orchestration Protocol' },
            { file: '../phase5-hardening-tasks.json', label: 'Phase 5 Hardening' },
        ];
        let totalLoaded = 0;
        for (const src of taskSources) {
            try { totalLoaded += autoSuccessEngine.loadExternalTasks(require(src.file)); }
            catch { }
        }
        logger.logNodeActivity("CONDUCTOR", `  🔥 Total external tasks loaded: ${totalLoaded}`);
        if (eventBus) eventBus.emit('auto_success:tasks_loaded', { count: totalLoaded });
    }

    // Auto-task conversion hook
    if (eventBus) {
        eventBus.on('recommendation', (rec) => {
            try {
                const taskId = `rec-${Date.now()}`;
                const text = typeof rec === 'string' ? rec : (rec.text || 'auto-task');
                logger.logNodeActivity("CONDUCTOR", `[AutoTask] Task ${taskId}: ${text}`);
                if (storyDriver) storyDriver.ingestSystemEvent({ type: 'AUTO_TASK_CREATED', refs: { taskId, text }, source: 'auto_task_conversion' });
            } catch { }
        });
    }
};
