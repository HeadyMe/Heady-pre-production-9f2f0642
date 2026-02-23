/**
 * HeadyBattle — Competitive validation, Arena Mode, leaderboards
 */
class HeadyBattle {
    constructor(client) { this._c = client; }

    /** Validate a change through HeadyBattle interrogation */
    async validate(change, opts = {}) {
        return this._c.post("/api/battle/validate", {
            change, context: opts.context || "",
            mode: opts.mode || "standard",
            minScore: opts.minScore || 0.80,
        });
    }

    /** Run Arena Mode — solutions compete */
    async arena(solutions, opts = {}) {
        return this._c.post("/api/battle/arena", {
            solutions, rounds: opts.rounds || 3,
            metrics: opts.metrics || ["quality", "performance", "safety"],
        });
    }

    /** Get leaderboard */
    async leaderboard(opts = {}) {
        return this._c.get(`/api/battle/leaderboard?limit=${opts.limit || 10}`);
    }

    /** Single evaluation */
    async evaluate(code, opts = {}) {
        return this._c.post("/api/battle/evaluate", {
            code, language: opts.language || "auto",
            criteria: opts.criteria || ["quality", "security", "performance"],
        });
    }

    /** HeadySims Monte Carlo simulation */
    async simulate(change, opts = {}) {
        return this._c.post("/api/sims/simulate", {
            change, iterations: opts.iterations || 1000,
            strategy: opts.strategy || "balanced",
        });
    }
}

module.exports = HeadyBattle;
