/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Improvement Scheduler — Continuous pipeline auto-execution engine.
 * Triggers HCFullPipeline at configurable intervals, feeds results into
 * pattern engine and self-critique for continuous improvement.
 */

const logger = require('./utils/logger');

class ImprovementScheduler {
    constructor(opts = {}) {
        this.interval = opts.interval || 900000; // Default 15 minutes
        this.pipeline = opts.pipeline || null;
        this.patternEngine = opts.patternEngine || null;
        this.selfCritiqueEngine = opts.selfCritiqueEngine || null;
        this.mcPlanScheduler = opts.mcPlanScheduler || null;

        this.running = false;
        this.cycleCount = 0;
        this.lastCycleTs = null;
        this.lastResult = null;
        this.errors = [];
        this.maxErrors = 50;
        this._timer = null;
    }

    start() {
        if (this.running) return;
        this.running = true;
        logger.logNodeActivity("IMPROVEMENT", `  ∞ Scheduler started — interval: ${this.interval / 1000}s`);

        // Run first cycle after a 30s warm-up delay
        this._timer = setTimeout(() => {
            this._runCycle();
            this._timer = setInterval(() => this._runCycle(), this.interval);
        }, 30000);
    }

    stop() {
        this.running = false;
        if (this._timer) {
            clearInterval(this._timer);
            clearTimeout(this._timer);
            this._timer = null;
        }
        logger.logNodeActivity("IMPROVEMENT", "  ∞ Scheduler stopped");
    }

    async _runCycle() {
        if (!this.pipeline) {
            logger.logNodeActivity("IMPROVEMENT", "  ⚠ No pipeline — skipping cycle");
            return;
        }

        const cycleId = `cycle-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const startTs = Date.now();
        this.cycleCount++;

        try {
            logger.logNodeActivity("IMPROVEMENT", `  ∞ Cycle #${this.cycleCount} started (${cycleId})`);

            // Run the pipeline
            const result = await this.pipeline.run({ type: "improvement", cycleId });
            this.lastResult = result;
            this.lastCycleTs = new Date().toISOString();

            const durationMs = Date.now() - startTs;
            logger.logNodeActivity("IMPROVEMENT", `  ∞ Cycle #${this.cycleCount} completed in ${durationMs}ms — status: ${result.status || 'ok'}`);

            // Feed results to pattern engine
            if (this.patternEngine && typeof this.patternEngine.ingest === 'function') {
                try {
                    this.patternEngine.ingest({
                        type: 'pipeline_cycle',
                        cycleId,
                        cycleNumber: this.cycleCount,
                        durationMs,
                        status: result.status,
                        ts: this.lastCycleTs,
                    });
                } catch { /* pattern engine feed is non-critical */ }
            }

            // Feed results to self-critique
            if (this.selfCritiqueEngine && typeof this.selfCritiqueEngine.addObservation === 'function') {
                try {
                    this.selfCritiqueEngine.addObservation({
                        source: 'improvement_scheduler',
                        type: 'pipeline_cycle',
                        cycleId,
                        result: result.status || 'completed',
                        durationMs,
                    });
                } catch { /* self-critique feed is non-critical */ }
            }

        } catch (err) {
            const errorEntry = {
                cycleId,
                error: err.message,
                ts: new Date().toISOString(),
                cycleNumber: this.cycleCount,
            };
            this.errors.push(errorEntry);
            if (this.errors.length > this.maxErrors) this.errors.shift();
            logger.logNodeActivity("IMPROVEMENT", `  ⚠ Cycle #${this.cycleCount} failed: ${err.message}`);
        }
    }

    getStatus() {
        return {
            running: this.running,
            intervalMs: this.interval,
            intervalHuman: `${Math.round(this.interval / 60000)}m`,
            cycleCount: this.cycleCount,
            lastCycleTs: this.lastCycleTs,
            lastStatus: this.lastResult?.status || null,
            recentErrors: this.errors.slice(-5),
            pipelineLoaded: !!this.pipeline,
            ts: new Date().toISOString(),
        };
    }
}

function registerImprovementRoutes(app, scheduler) {
    app.get('/api/improvement/status', (req, res) => {
        res.json({ ok: true, ...scheduler.getStatus() });
    });

    app.post('/api/improvement/trigger', async (req, res) => {
        try {
            await scheduler._runCycle();
            res.json({ ok: true, message: 'Improvement cycle triggered', ...scheduler.getStatus() });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    app.post('/api/improvement/start', (req, res) => {
        scheduler.start();
        res.json({ ok: true, message: 'Scheduler started', ...scheduler.getStatus() });
    });

    app.post('/api/improvement/stop', (req, res) => {
        scheduler.stop();
        res.json({ ok: true, message: 'Scheduler stopped', ...scheduler.getStatus() });
    });
}

module.exports = { ImprovementScheduler, registerImprovementRoutes };
