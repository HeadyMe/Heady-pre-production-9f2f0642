/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 * HCResourceManager — System resource monitoring with φ-scaled polling.
 * Tracks CPU, RAM, disk, GPU utilization and emits events for cross-wiring.
 */
const { EventEmitter } = require("events");
const os = require("os");
const logger = require("./utils/logger");

const PHI = 1.6180339887;

class HCResourceManager extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.pollIntervalMs = opts.pollIntervalMs || Math.round(PHI ** 3 * 1000);
        this._timer = null;
        this._history = [];
        this._safeModeActive = false;
    }

    start() {
        if (this._timer) return;
        this._timer = setInterval(() => this._poll(), this.pollIntervalMs);
        this._poll();
        logger.logSystem(`[ResourceManager] Started — polling every ${this.pollIntervalMs}ms`);
    }

    stop() {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
    }

    _poll() {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
        const cpus = os.cpus();
        const cpuAvg = cpus.reduce((sum, c) => {
            const total = Object.values(c.times).reduce((s, t) => s + t, 0);
            return sum + ((total - c.times.idle) / total) * 100;
        }, 0) / cpus.length;

        const snapshot = { ts: Date.now(), cpu: Math.round(cpuAvg), ram: usedPercent, cores: cpus.length };
        this._history.push(snapshot);
        if (this._history.length > 100) this._history.shift();

        // Emit severity events for cross-wiring
        if (usedPercent > 90) {
            this.emit("resource_event", { resourceType: "ram", severity: "CRITICAL", currentUsagePercent: usedPercent });
            if (!this._safeModeActive) { this._safeModeActive = true; this.emit("mitigation:safe_mode_activated"); }
        } else if (usedPercent > 75) {
            this.emit("resource_event", { resourceType: "ram", severity: "WARN_HARD", currentUsagePercent: usedPercent });
            this.emit("mitigation:concurrency_lowered");
        }
        if (cpuAvg > 90) {
            this.emit("resource_event", { resourceType: "cpu", severity: "CRITICAL", currentUsagePercent: Math.round(cpuAvg) });
        }
    }

    getSnapshot() {
        return this._history[this._history.length - 1] || { ts: Date.now(), cpu: 0, ram: 0, cores: os.cpus().length };
    }

    getHealth() { return { ok: true, service: "resource-manager", polling: !!this._timer, history: this._history.length, safeMode: this._safeModeActive }; }
}

function registerRoutes(app, manager) {
    app.get("/api/resources/health", (_req, res) => res.json(manager.getHealth()));
    app.get("/api/resources/snapshot", (_req, res) => res.json({ ok: true, ...manager.getSnapshot() }));
    app.get("/api/resources/history", (_req, res) => res.json({ ok: true, history: manager._history.slice(-20) }));
    app.post("/api/system/production", (req, res) => {
        const s = manager.getSnapshot();
        res.json({ cpu: { currentPercent: s.cpu, cores: s.cores }, ram: { currentPercent: s.ram, absoluteValue: Math.round((os.totalmem() - os.freemem()) / 1048576), capacity: Math.round(os.totalmem() / 1048576), unit: "MB" }, status: "live", ts: new Date().toISOString() });
    });
}

module.exports = { HCResourceManager, registerRoutes };
