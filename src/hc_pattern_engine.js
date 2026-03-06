/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 * Pattern Recognition Engine — Observes latency, success, error, and reliability patterns.
 * Emits events for cross-wiring into StoryDriver and SelfCritique.
 */
const { EventEmitter } = require("events");
const logger = require("./utils/logger");

class PatternEngine extends EventEmitter {
    constructor() { super(); this._patterns = new Map(); this._timer = null; this._analysisCount = 0; }

    start() {
        if (this._timer) return;
        this._timer = setInterval(() => this._analyze(), 30000);
    }

    stop() { if (this._timer) { clearInterval(this._timer); this._timer = null; } }

    observeLatency(key, latencyMs, meta = {}) { this._record(key, "latency", latencyMs, meta); }
    observeSuccess(key, durationMs, meta = {}) { this._record(key, "success", durationMs, meta); }
    observeError(key, error, meta = {}) { this._record(key, "error", 1, { ...meta, error }); }
    observe(category, key, value, meta = {}) { this._record(key, category, value, meta); }

    _record(key, category, value, meta) {
        if (!this._patterns.has(key)) this._patterns.set(key, { key, category, samples: [], meta: {}, errorCount: 0, successCount: 0 });
        const p = this._patterns.get(key);
        p.samples.push({ value, ts: Date.now(), ...meta });
        if (p.samples.length > 100) p.samples.shift();
        if (category === "error") p.errorCount++;
        if (category === "success") p.successCount++;
        p.meta = { ...p.meta, ...meta };
    }

    _analyze() {
        this._analysisCount++;
        for (const [key, pattern] of this._patterns) {
            // Error burst detection
            const recentErrors = pattern.samples.filter(s => s.ts > Date.now() - 60000 && pattern.category === "error");
            if (recentErrors.length >= 5) {
                this.emit("anomaly:error_burst", { patternId: key, name: key, count: recentErrors.length });
            }
            // Convergence detection — stable low latency
            if (pattern.samples.length >= 10) {
                const recent = pattern.samples.slice(-10).map(s => s.value);
                const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
                const variance = recent.reduce((s, v) => s + (v - avg) ** 2, 0) / recent.length;
                if (variance < avg * 0.1 && avg < 200) {
                    this.emit("pattern:converged", { id: key, name: key, avg, variance });
                }
            }
        }
        // Correlated slowdown
        const slowPatterns = Array.from(this._patterns.values()).filter(p => {
            const recent = p.samples.slice(-5);
            return recent.length >= 5 && recent.every(s => s.value > 1000);
        });
        if (slowPatterns.length >= 3) {
            this.emit("anomaly:correlated_slowdown", { patterns: slowPatterns.map(p => p.key), count: slowPatterns.length });
        }
    }

    getHealth() { return { ok: true, service: "pattern-engine", patterns: this._patterns.size, analyses: this._analysisCount, running: !!this._timer }; }
}

const patternEngine = new PatternEngine();

function registerPatternRoutes(app, engine) {
    app.get("/api/patterns/health", (_req, res) => res.json(engine.getHealth()));
    app.get("/api/patterns/list", (_req, res) => res.json({ ok: true, patterns: Array.from(engine._patterns.keys()) }));
}

module.exports = { PatternEngine, patternEngine, registerPatternRoutes };
