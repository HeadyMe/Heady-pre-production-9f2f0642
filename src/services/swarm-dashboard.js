/**
 * T8: Swarm Optimization Dashboard Service
 * @module src/services/swarm-dashboard
 */
'use strict';

class SwarmDashboard {
    constructor() {
        this._runs = [];
        this._bestConfig = null;
    }

    recordRun(config, metrics) {
        const run = {
            id: `run_${Date.now()}`,
            timestamp: new Date().toISOString(),
            config,
            metrics, // { score, latency, cost, tokens }
            confidence: this._computeConfidence(metrics),
        };
        this._runs.push(run);
        if (!this._bestConfig || metrics.score > this._bestConfig.metrics.score) {
            this._bestConfig = run;
        }
        return run;
    }

    _computeConfidence(metrics) {
        if (this._runs.length < 3) return 0.3;
        const scores = this._runs.slice(-10).map(r => r.metrics.score);
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
        return Math.max(0, Math.min(1, 1 - Math.sqrt(variance)));
    }

    getExplorationTree() {
        return {
            totalRuns: this._runs.length,
            bestConfig: this._bestConfig,
            recentRuns: this._runs.slice(-20),
            convergence: this._computeConfidence(this._bestConfig?.metrics || {}),
            explorationRate: Math.max(0.1, 1 - this._runs.length / 100),
        };
    }

    getSummary() {
        if (this._runs.length === 0) return { status: 'no_data' };
        const scores = this._runs.map(r => r.metrics.score);
        return {
            totalRuns: this._runs.length,
            bestScore: Math.max(...scores),
            avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
            worstScore: Math.min(...scores),
            bestConfig: this._bestConfig?.config,
            convergenceConfidence: this._computeConfidence(this._bestConfig?.metrics || {}),
        };
    }

    // Express routes
    routes(router) {
        router.get('/swarm/dashboard', (req, res) => res.json(this.getSummary()));
        router.get('/swarm/tree', (req, res) => res.json(this.getExplorationTree()));
        router.post('/swarm/run', (req, res) => {
            const { config, metrics } = req.body;
            res.json(this.recordRun(config, metrics));
        });
        return router;
    }
}

module.exports = SwarmDashboard;
