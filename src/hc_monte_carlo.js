/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 * HeadySims (Monte Carlo) — Plan scheduling with drift detection + global simulation runner.
 */
const { EventEmitter } = require("events");
const logger = require("./utils/logger");

class MCPlanScheduler extends EventEmitter {
    constructor() { super(); this._strategies = new Map(); this._speedMode = "off"; this._results = []; }

    setSpeedMode(mode) { this._speedMode = mode; }

    registerStrategy(id, config) {
        this._strategies.set(id, { id, targetMs: config.targetMs || 1000, samples: [], ...config });
    }

    recordResult(taskType, strategyId, actualLatencyMs) {
        const strategy = this._strategies.get(strategyId);
        const reward = strategy ? Math.max(0, 1 - (actualLatencyMs / strategy.targetMs)) : 0;
        const entry = { taskType, strategyId, actualLatencyMs, reward, ts: Date.now() };
        this._results.push(entry);
        if (this._results.length > 500) this._results.shift();
        this.emit("result:recorded", entry);

        // Drift detection
        if (strategy) {
            strategy.samples.push(actualLatencyMs);
            if (strategy.samples.length > 20) strategy.samples.shift();
            const median = [...strategy.samples].sort((a, b) => a - b)[Math.floor(strategy.samples.length / 2)];
            if (median > strategy.targetMs * 1.5) {
                this.emit("drift:detected", { taskType, strategyId, medianMs: median, targetMs: strategy.targetMs });
            }
        }
    }

    getHealth() { return { ok: true, service: "mc-plan-scheduler", strategies: this._strategies.size, results: this._results.length, speedMode: this._speedMode }; }
}

class MCGlobal extends EventEmitter {
    constructor() { super(); this._running = false; this._timer = null; this._pipeline = null; this._registry = null; this._cycleCount = 0; }

    bind({ pipeline, registry }) { this._pipeline = pipeline; this._registry = typeof registry === "function" ? registry : () => registry; }

    startAutoRun() {
        if (this._running) return;
        this._running = true;
        this._timer = setInterval(() => { this._cycleCount++; this.emit("cycle", { cycle: this._cycleCount, ts: Date.now() }); }, 60000);
    }

    stopAutoRun() { if (this._timer) { clearInterval(this._timer); this._timer = null; } this._running = false; }

    getHealth() { return { ok: true, service: "mc-global", running: this._running, cycles: this._cycleCount }; }
}

const mcPlanScheduler = new MCPlanScheduler();
const mcGlobal = new MCGlobal();

function registerHeadySimsRoutes(app, scheduler, global) {
    app.get("/api/sims/health", (_req, res) => res.json({ plan: scheduler.getHealth(), global: global.getHealth() }));
    app.get("/api/sims/strategies", (_req, res) => res.json({ ok: true, strategies: Array.from(scheduler._strategies.values()) }));
    app.get("/api/sims/results", (_req, res) => res.json({ ok: true, results: scheduler._results.slice(-20) }));
}

module.exports = { MCPlanScheduler, MCGlobal, mcPlanScheduler, mcGlobal, registerHeadySimsRoutes };
