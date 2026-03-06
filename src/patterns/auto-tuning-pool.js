/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Heady Auto-Tuning Concurrency — Adaptive Pool Sizing
 * Dynamically adjusts concurrency limits based on throughput,
 * latency, and error rates. Uses AIMD (Additive Increase,
 * Multiplicative Decrease) algorithm.
 */

class AutoTuningPool {
    constructor(name, options = {}) {
        this.name = name;
        this.minConcurrency = options.min || 1;
        this.maxConcurrency = options.max || 32;
        this.concurrency = options.initial || 4;
        this.active = 0;
        this.queue = [];

        // AIMD parameters
        this.increaseStep = options.increaseStep || 1;
        this.decreaseFactor = options.decreaseFactor || 0.5;
        this.tuneIntervalMs = options.tuneIntervalMs || 5000;
        this.latencyTargetMs = options.latencyTargetMs || 200;

        // Metrics window
        this._window = [];
        this._windowSizeMs = 10000;
        this._tuner = setInterval(() => this._tune(), this.tuneIntervalMs);

        // Totals
        this.totalProcessed = 0;
        this.totalErrors = 0;
    }

    async execute(fn) {
        if (this.active >= this.concurrency) {
            // Queue the request
            await new Promise((resolve) => this.queue.push(resolve));
        }

        this.active++;
        const start = Date.now();

        try {
            const result = await fn();
            this._record(Date.now() - start, false);
            this.totalProcessed++;
            return result;
        } catch (err) {
            this._record(Date.now() - start, true);
            this.totalErrors++;
            throw err;
        } finally {
            this.active--;
            if (this.queue.length > 0) {
                const next = this.queue.shift();
                next();
            }
        }
    }

    _record(latencyMs, isError) {
        const now = Date.now();
        this._window.push({ ts: now, latencyMs, isError });
        // Trim old entries
        const cutoff = now - this._windowSizeMs;
        while (this._window.length > 0 && this._window[0].ts < cutoff) {
            this._window.shift();
        }
    }

    _tune() {
        if (this._window.length < 3) return;

        const errors = this._window.filter((e) => e.isError).length;
        const errorRate = errors / this._window.length;
        const avgLatency = this._window.reduce((s, e) => s + e.latencyMs, 0) / this._window.length;

        const prev = this.concurrency;

        if (errorRate > 0.3) {
            // High errors → multiplicative decrease
            this.concurrency = Math.max(this.minConcurrency, Math.floor(this.concurrency * this.decreaseFactor));
        } else if (avgLatency > this.latencyTargetMs * 2) {
            // High latency → decrease
            this.concurrency = Math.max(this.minConcurrency, this.concurrency - this.increaseStep);
        } else if (avgLatency < this.latencyTargetMs && errorRate < 0.05) {
            // Good performance → additive increase
            this.concurrency = Math.min(this.maxConcurrency, this.concurrency + this.increaseStep);
        }

        if (this.concurrency !== prev) {
            // Drain queue entries if concurrency increased
            while (this.active < this.concurrency && this.queue.length > 0) {
                const next = this.queue.shift();
                next();
            }
        }
    }

    getStatus() {
        const avgLatency = this._window.length > 0
            ? Math.round(this._window.reduce((s, e) => s + e.latencyMs, 0) / this._window.length)
            : 0;
        const errorRate = this._window.length > 0
            ? (this._window.filter((e) => e.isError).length / this._window.length * 100).toFixed(1)
            : "0.0";

        return {
            name: this.name,
            concurrency: this.concurrency,
            active: this.active,
            queued: this.queue.length,
            avgLatencyMs: avgLatency,
            errorRate: `${errorRate}%`,
            totalProcessed: this.totalProcessed,
            totalErrors: this.totalErrors,
            bounds: { min: this.minConcurrency, max: this.maxConcurrency },
        };
    }

    destroy() {
        clearInterval(this._tuner);
        this.queue.forEach((resolve) => resolve());
        this.queue = [];
    }
}

// ── Pool Registry ──
const pools = new Map();

function getPool(name, options) {
    if (!pools.has(name)) {
        pools.set(name, new AutoTuningPool(name, options));
    }
    return pools.get(name);
}

function getAllPoolStatus() {
    const status = {};
    for (const [name, pool] of pools) {
        status[name] = pool.getStatus();
    }
    return status;
}

module.exports = { AutoTuningPool, getPool, getAllPoolStatus };
