/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 * HCResourceDiagnostics — Cross-references resource + scheduler state for diagnostics.
 */
const logger = require("./utils/logger");

class HCResourceDiagnostics {
    constructor(deps = {}) {
        this.resourceManager = deps.resourceManager;
        this.taskScheduler = deps.taskScheduler;
    }

    diagnose() {
        const resourceHealth = this.resourceManager ? this.resourceManager.getHealth() : { ok: false, note: "ResourceManager not available" };
        const schedulerHealth = this.taskScheduler ? this.taskScheduler.getHealth() : { ok: false, note: "TaskScheduler not available" };
        const resourceSnapshot = this.resourceManager ? this.resourceManager.getSnapshot() : {};

        const bottlenecks = [];
        if (resourceSnapshot.ram > 85) bottlenecks.push({ type: "ram", severity: "high", value: resourceSnapshot.ram });
        if (resourceSnapshot.cpu > 85) bottlenecks.push({ type: "cpu", severity: "high", value: resourceSnapshot.cpu });
        if (schedulerHealth.queued > 50) bottlenecks.push({ type: "queue_depth", severity: "medium", value: schedulerHealth.queued });

        return { ok: true, resourceHealth, schedulerHealth, resourceSnapshot, bottlenecks, recommendation: bottlenecks.length > 0 ? "Consider reducing concurrency or scaling resources" : "System operating normally", ts: new Date().toISOString() };
    }

    getHealth() { return { ok: true, service: "resource-diagnostics", hasResourceManager: !!this.resourceManager, hasTaskScheduler: !!this.taskScheduler }; }
}

function registerDiagnosticRoutes(app, diagnostics) {
    app.get("/api/diagnostics/health", (_req, res) => res.json(diagnostics.getHealth()));
    app.get("/api/diagnostics/report", (_req, res) => res.json(diagnostics.diagnose()));
}

module.exports = { HCResourceDiagnostics, registerDiagnosticRoutes };
