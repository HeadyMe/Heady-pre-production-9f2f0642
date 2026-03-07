/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
"use strict";

const logger = require("../utils/logger");
const { HeadyTemplateRegistry, registerTemplateRegistryRoutes } = require("./heady-template-registry");
const { HeadyMaintenanceOps, registerMaintenanceOpsRoutes } = require("./heady-maintenance-ops");
const { DigitalPresenceControlPlane, registerDigitalPresenceRoutes } = require("./digital-presence-control-plane");

class UnifiedAutonomyRuntime {
    constructor({ vectorMemory, tracker } = {}) {
        this.templateRegistry = new HeadyTemplateRegistry({ vectorMemory, tracker });
        this.maintenanceOps = new HeadyMaintenanceOps();
        this.digitalPresence = new DigitalPresenceControlPlane({
            templateRegistry: this.templateRegistry,
            maintenanceOps: this.maintenanceOps,
            vectorMemory,
            tracker,
        });
        this.state = {
            initialized: false,
            startedAt: null,
            tickCount: 0,
        };
    }

    async initialize() {
        this.templateRegistry.loadRegistry();
        this.templateRegistry.validateCoverage();
        this.state.initialized = true;
        this.state.startedAt = new Date().toISOString();
        logger.logSystem("🧠 Unified Autonomy Runtime initialized");
        return this;
    }

    async tick() {
        this.state.tickCount += 1;
        const evaluation = await this.digitalPresence.evaluate();
        const maintenance = this.maintenanceOps.reconcileProjectionState();

        return {
            ok: true,
            tick: this.state.tickCount,
            score: evaluation.score,
            maintenance: maintenance.recommendation,
            generatedAt: new Date().toISOString(),
        };
    }

    health() {
        return {
            ok: true,
            initialized: this.state.initialized,
            startedAt: this.state.startedAt,
            tickCount: this.state.tickCount,
            templateHealth: this.templateRegistry.health(),
            maintenanceHealth: this.maintenanceOps.health(),
            digitalPresenceHealth: this.digitalPresence.health(),
            timestamp: new Date().toISOString(),
        };
    }

    registerRoutes(app) {
        registerTemplateRegistryRoutes(app, this.templateRegistry);
        registerMaintenanceOpsRoutes(app, this.maintenanceOps);
        registerDigitalPresenceRoutes(app, this.digitalPresence);

        app.get("/api/autonomy/runtime/health", (req, res) => {
            res.json(this.health());
        });

        app.post("/api/autonomy/runtime/tick", async (req, res) => {
            const result = await this.tick();
            res.json(result);
        });

        logger.logSystem("🚀 Unified Autonomy Runtime routes registered");
    }
}

let singleton = null;
async function getUnifiedAutonomyRuntime(options = {}) {
    if (!singleton) {
        singleton = new UnifiedAutonomyRuntime(options);
        await singleton.initialize();
    }
    return singleton;
}

module.exports = {
    UnifiedAutonomyRuntime,
    getUnifiedAutonomyRuntime,
};
