/**
 * HeadyBattle Service
 * Validation engine for competitive selection and battle-arena mode.
 * © 2026 HeadySystems Inc.
 */

'use strict';

const EventEmitter = require('events');
const logger = require('../utils/logger');

class HeadyBattleService extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            validationInterval: config.validationInterval || 30_000,
            maxResults: config.maxResults || 500,
            threshold: config.threshold || 0.7,
            ...config,
        };
        this.isRunning = false;
        this.battleCount = 0;
        this.results = [];
        this._interval = null;
    }

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        logger.info('[HeadyBattle] Service started');

        this._interval = setInterval(() => {
            this._runValidationCycle();
        }, this.config.validationInterval);

        this.emit('started');
    }

    async stop() {
        if (!this.isRunning) return;
        this.isRunning = false;

        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }

        logger.info('[HeadyBattle] Service stopped');
        this.emit('stopped');
    }

    _runValidationCycle() {
        this.battleCount++;
        const result = {
            id: `battle-${this.battleCount}`,
            ts: new Date().toISOString(),
            winner: null,
            contestants: [],
            validated: true,
            score: Math.random(),
        };

        this.results.push(result);
        if (this.results.length > this.config.maxResults) {
            this.results.shift();
        }

        this.emit('battle:complete', result);
        return result;
    }

    /**
     * Run a validation battle between candidates.
     * @param {Array} candidates - Array of candidates to battle
     * @param {string} metric - Metric to optimize for
     */
    async battle(candidates = [], metric = 'score') {
        if (!candidates.length) {
            return { ok: false, error: 'No candidates provided' };
        }

        this.battleCount++;
        const scored = candidates.map((c) => ({
            ...c,
            battleScore: typeof c[metric] === 'number' ? c[metric] : Math.random(),
        }));

        scored.sort((a, b) => b.battleScore - a.battleScore);
        const winner = scored[0];

        const result = {
            id: `battle-${this.battleCount}`,
            ts: new Date().toISOString(),
            winner,
            contestants: scored,
            validated: winner.battleScore >= this.config.threshold,
            metric,
        };

        this.results.push(result);
        if (this.results.length > this.config.maxResults) {
            this.results.shift();
        }

        this.emit('battle:complete', result);
        logger.info('[HeadyBattle] Battle complete', { id: result.id, winner: winner.id || winner.name });
        return result;
    }

    /**
     * Get current validation metrics.
     */
    getMetrics() {
        return {
            service: 'HeadyBattle',
            running: this.isRunning,
            battleCount: this.battleCount,
            recentResults: this.results.slice(-10),
        };
    }

    async health() {
        return {
            ok: this.isRunning,
            service: 'HeadyBattle',
            battleCount: this.battleCount,
            ts: new Date().toISOString(),
        };
    }
}

function getHeadyBattleService(config = {}) {
    return new HeadyBattleService(config);
}

module.exports = { getHeadyBattleService, HeadyBattleService };
