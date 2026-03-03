/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 * HCTaskScheduler — Priority-based task scheduling with safe mode.
 */
const { EventEmitter } = require("events");
const logger = require("./utils/logger");

class HCTaskScheduler extends EventEmitter {
    constructor(opts = {}) {
        super();
        this._queue = [];
        this._running = new Map();
        this._completed = [];
        this._maxConcurrency = opts.maxConcurrency || 8;
        this._safeMode = false;
        this._concurrencyOverrides = {};
    }

    enqueue(task) {
        const t = { id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: task.type || "general", priority: task.priority || 5, taskClass: task.taskClass || "standard", resourceTier: task.resourceTier || "normal", status: "queued", metrics: { queuedAt: Date.now() }, ...task };
        this._queue.push(t);
        this._queue.sort((a, b) => b.priority - a.priority);
        return t;
    }

    enterSafeMode() { this._safeMode = true; this._maxConcurrency = 2; logger.logSystem("[TaskScheduler] Safe mode activated — concurrency reduced to 2"); }
    exitSafeMode() { this._safeMode = false; this._maxConcurrency = 8; }
    adjustConcurrency(type, value) { this._concurrencyOverrides[type] = value; }

    async tick() {
        if (this._running.size >= this._maxConcurrency) return;
        const next = this._queue.shift();
        if (!next) return;
        next.status = "running";
        next.metrics.startedAt = Date.now();
        this._running.set(next.id, next);
        try {
            if (next.handler) await next.handler(next);
            next.status = "completed";
            next.metrics.completedAt = Date.now();
            this.emit("task:completed", next);
        } catch (err) {
            next.status = "failed";
            next.error = err.message;
            next.metrics.completedAt = Date.now();
            this.emit("task:failed", next);
        }
        this._running.delete(next.id);
        this._completed.push(next);
        if (this._completed.length > 200) this._completed.shift();
    }

    getHealth() { return { ok: true, service: "task-scheduler", queued: this._queue.length, running: this._running.size, completed: this._completed.length, safeMode: this._safeMode, maxConcurrency: this._maxConcurrency }; }
}

function registerSchedulerRoutes(app, scheduler) {
    app.get("/api/scheduler/health", (_req, res) => res.json(scheduler.getHealth()));
    app.get("/api/scheduler/queue", (_req, res) => res.json({ ok: true, queue: scheduler._queue.slice(0, 20), running: Array.from(scheduler._running.values()) }));
    app.post("/api/scheduler/enqueue", (req, res) => { const t = scheduler.enqueue(req.body); res.json({ ok: true, task: t }); });
}

module.exports = { HCTaskScheduler, registerSchedulerRoutes };
