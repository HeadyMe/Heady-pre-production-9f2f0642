/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * BudgetService — Core logic for AI cost governance.
 * Manages budget quotas, usage tracking, and automated down-shifting logic.
 * Wired to Neon Postgres for persistence, with in-memory cache layer.
 */

'use strict';

const { getLogger } = require('./structured-logger');
const logger = getLogger('budget-service');

// ── Default Budgets by Tier ─────────────────────────────────────
const DEFAULT_BUDGETS = {
    system: { daily: 10.00, monthly: 100.00 },
    user: { daily: 2.00, monthly: 25.00 },
    service: { daily: 5.00, monthly: 50.00 },
    battle: { daily: 20.00, monthly: 200.00 },
};

class BudgetService {
    constructor(opts = {}) {
        this.db = opts.db || null;          // pg Pool or NeonDB connector
        this.cache = new Map();             // scopeType:scopeId:period -> budget
        this.cacheTTL = opts.cacheTTL || 60000; // 1 minute cache
        this.usageLog = [];                 // In-memory usage log (last 1000)
        this._initialized = false;
    }

    /**
     * Initialize budget tables in Neon if they don't exist.
     */
    async init() {
        if (this._initialized) return;

        if (this.db) {
            try {
                await this.db.query(`
                    CREATE TABLE IF NOT EXISTS budgets (
                        id SERIAL PRIMARY KEY,
                        scope_type VARCHAR(50) NOT NULL,
                        scope_id VARCHAR(100) NOT NULL,
                        period VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
                        limit_usd NUMERIC(10,4) NOT NULL DEFAULT 50.00,
                        spent_usd NUMERIC(10,4) NOT NULL DEFAULT 0.00,
                        period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        UNIQUE(scope_type, scope_id, period)
                    )
                `);
                await this.db.query(`
                    CREATE TABLE IF NOT EXISTS usage_log (
                        id SERIAL PRIMARY KEY,
                        scope_type VARCHAR(50) NOT NULL,
                        scope_id VARCHAR(100) NOT NULL,
                        cost_usd NUMERIC(10,6) NOT NULL,
                        model VARCHAR(100),
                        task_type VARCHAR(100),
                        tokens_used INTEGER DEFAULT 0,
                        latency_ms INTEGER DEFAULT 0,
                        details JSONB DEFAULT '{}',
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                `);
                logger.info('Budget tables initialized in Neon');
                this._initialized = true;
            } catch (err) {
                logger.warn(`Budget table init failed (using in-memory): ${err.message}`);
            }
        } else {
            logger.info('BudgetService running in-memory mode (no DB connected)');
            this._initialized = true;
        }
    }

    /**
     * Get or create a budget for a given scope.
     */
    async getBudget(scopeType, scopeId, period = 'MONTHLY') {
        const cacheKey = `${scopeType}:${scopeId}:${period}`;
        const now = Date.now();

        if (this.cache.has(cacheKey)) {
            const entry = this.cache.get(cacheKey);
            if (now - entry.ts < this.cacheTTL) return entry.budget;
        }

        const budget = await this._queryBudget(scopeType, scopeId, period);
        this.cache.set(cacheKey, { budget, ts: now });
        return budget;
    }

    /**
     * Check if a request fits within the remaining budget.
     */
    async checkBudget(scopeType, scopeId, estimatedCostUsd) {
        const budget = await this.getBudget(scopeType, scopeId);
        if (!budget) return { allowed: true, reason: 'no_budget_defined' };

        const remaining = budget.limit_usd - budget.spent_usd;
        if (remaining >= estimatedCostUsd) {
            return { allowed: true, remaining, budget: budget.limit_usd, spent: budget.spent_usd };
        }

        return {
            allowed: false,
            remaining,
            required: estimatedCostUsd,
            budget: budget.limit_usd,
            spent: budget.spent_usd,
            reason: 'budget_exceeded',
            suggestion: remaining > 0
                ? `Downshift to a cheaper model (remaining: $${remaining.toFixed(4)})`
                : 'Budget fully exhausted for this period',
        };
    }

    /**
     * Record usage and update the budget.
     */
    async recordUsage(scopeType, scopeId, actualCostUsd, details = {}) {
        // Update DB
        await this._updateSpent(scopeType, scopeId, actualCostUsd);

        // Log usage
        const entry = {
            scopeType, scopeId, cost: actualCostUsd,
            model: details.model || 'unknown',
            taskType: details.taskType || 'unknown',
            tokens: details.tokens || 0,
            latencyMs: details.latencyMs || 0,
            ts: new Date().toISOString(),
        };
        this.usageLog.push(entry);
        if (this.usageLog.length > 1000) this.usageLog.shift();

        // Invalidate cache
        for (const p of ['DAILY', 'MONTHLY', 'TOTAL']) {
            this.cache.delete(`${scopeType}:${scopeId}:${p}`);
        }

        logger.info(`Budget: $${actualCostUsd.toFixed(4)} recorded for ${scopeType}:${scopeId} (${details.model || 'unknown'})`);
        return true;
    }

    /**
     * Get usage summary for a scope.
     */
    getUsageSummary(scopeType, scopeId) {
        const entries = this.usageLog.filter(e =>
            (!scopeType || e.scopeType === scopeType) &&
            (!scopeId || e.scopeId === scopeId)
        );
        const totalCost = entries.reduce((sum, e) => sum + e.cost, 0);
        const totalTokens = entries.reduce((sum, e) => sum + e.tokens, 0);
        const byModel = {};
        for (const e of entries) {
            byModel[e.model] = (byModel[e.model] || 0) + e.cost;
        }
        return {
            totalCost: Math.round(totalCost * 10000) / 10000,
            totalTokens,
            requestCount: entries.length,
            byModel,
            recentEntries: entries.slice(-10),
        };
    }

    /**
     * Get overall budget health.
     */
    async getHealth() {
        const systemBudget = await this.getBudget('system', 'heady', 'MONTHLY');
        return {
            status: 'operational',
            mode: this.db ? 'postgres' : 'in-memory',
            cachedBudgets: this.cache.size,
            usageLogSize: this.usageLog.length,
            systemBudget: systemBudget,
        };
    }

    // ── DB Layer ────────────────────────────────────────────────────

    async _queryBudget(scopeType, scopeId, period) {
        if (this.db) {
            try {
                const result = await this.db.query(
                    'SELECT * FROM budgets WHERE scope_type = $1 AND scope_id = $2 AND period = $3',
                    [scopeType, scopeId, period]
                );
                if (result.rows.length > 0) return result.rows[0];

                // Auto-create with defaults
                const defaults = DEFAULT_BUDGETS[scopeType] || DEFAULT_BUDGETS.user;
                const limit = period === 'DAILY' ? defaults.daily : defaults.monthly;
                const insert = await this.db.query(
                    `INSERT INTO budgets (scope_type, scope_id, period, limit_usd, spent_usd)
                     VALUES ($1, $2, $3, $4, 0) RETURNING *`,
                    [scopeType, scopeId, period, limit]
                );
                return insert.rows[0];
            } catch (err) {
                logger.warn(`Budget DB query failed: ${err.message}`);
            }
        }

        // In-memory fallback
        const defaults = DEFAULT_BUDGETS[scopeType] || DEFAULT_BUDGETS.user;
        return {
            scope_type: scopeType,
            scope_id: scopeId,
            limit_usd: period === 'DAILY' ? defaults.daily : defaults.monthly,
            spent_usd: 0,
            period,
        };
    }

    async _updateSpent(scopeType, scopeId, amount) {
        if (this.db) {
            try {
                // Atomic increment
                await this.db.query(
                    `UPDATE budgets SET spent_usd = spent_usd + $1, updated_at = NOW()
                     WHERE scope_type = $2 AND scope_id = $3`,
                    [amount, scopeType, scopeId]
                );
                // Log to usage_log table
                await this.db.query(
                    `INSERT INTO usage_log (scope_type, scope_id, cost_usd) VALUES ($1, $2, $3)`,
                    [scopeType, scopeId, amount]
                );
            } catch (err) {
                logger.warn(`Budget DB update failed: ${err.message}`);
            }
        }
    }
}

// ── Express Routes ──────────────────────────────────────────────
function budgetRoutes(app, budgetService) {
    app.get('/api/budget/health', async (_req, res) => {
        const health = await budgetService.getHealth();
        res.json(health);
    });

    app.get('/api/budget/:scopeType/:scopeId', async (req, res) => {
        const budget = await budgetService.getBudget(req.params.scopeType, req.params.scopeId);
        res.json(budget);
    });

    app.post('/api/budget/check', async (req, res) => {
        const { scopeType, scopeId, estimatedCost } = req.body;
        if (!scopeType || !scopeId) return res.status(400).json({ error: 'scopeType and scopeId required' });
        const result = await budgetService.checkBudget(scopeType, scopeId, estimatedCost || 0);
        res.json(result);
    });

    app.get('/api/budget/usage', (_req, res) => {
        const summary = budgetService.getUsageSummary();
        res.json(summary);
    });

    app.get('/api/budget/usage/:scopeType/:scopeId', (req, res) => {
        const summary = budgetService.getUsageSummary(req.params.scopeType, req.params.scopeId);
        res.json(summary);
    });

    logger.info('BudgetService: routes registered at /api/budget/*');
}

module.exports = { BudgetService, budgetRoutes, DEFAULT_BUDGETS };
