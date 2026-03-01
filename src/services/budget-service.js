/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * BudgetService — Core logic for AI cost governance.
 * Manages budget quotas, usage tracking, and automated down-shifting logic.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require("../utils/logger");

class BudgetService {
    constructor(opts = {}) {
        this.db = opts.db; // Expects a PostgreSQL client or bridge
        this.cache = new Map(); // scopeType:scopeId:period -> budget
        this.cacheTTL = opts.cacheTTL || 60000; // 1 minute cache
    }

    /**
     * Get or create a budget for a given scope
     */
    async getBudget(scopeType, scopeId, period = 'MONTHLY') {
        const cacheKey = `${scopeType}:${scopeId}:${period}`;
        const now = Date.now();

        if (this.cache.has(cacheKey)) {
            const entry = this.cache.get(cacheKey);
            if (now - entry.ts < this.cacheTTL) {
                return entry.budget;
            }
        }

        // DB implementation placeholder (simulated for now, real PG integration in next step)
        // In a real implementation, we'd query the 'budgets' table
        const budget = await this._queryBudget(scopeType, scopeId, period);

        this.cache.set(cacheKey, { budget, ts: now });
        return budget;
    }

    /**
     * Check if a request fits within the remaining budget
     */
    async checkBudget(scopeType, scopeId, estimatedCostUsd) {
        const budget = await this.getBudget(scopeType, scopeId);
        if (!budget) return { allowed: true }; // No budget defined = unrestricted

        const remaining = budget.limit_usd - budget.spent_usd;
        if (remaining >= estimatedCostUsd) {
            return { allowed: true, remaining };
        }

        return {
            allowed: false,
            remaining,
            required: estimatedCostUsd,
            reason: 'budget_exceeded'
        };
    }

    /**
     * Record usage and update the budget
     */
    async recordUsage(scopeType, scopeId, actualCostUsd, details = {}) {
        // 1. Update DB (atomic increment)
        await this._updateSpent(scopeType, scopeId, actualCostUsd);

        // 2. Invalidate cache
        const periods = ['DAILY', 'MONTHLY', 'TOTAL'];
        for (const p of periods) {
            this.cache.delete(`${scopeType}:${scopeId}:${p}`);
        }

        return true;
    }

    /**
     * Internal: Query budget (simulated for Spec verification)
     */
    async _queryBudget(scopeType, scopeId, period) {
        // Mock data for initial Spec 4 validation
        return {
            scope_type: scopeType,
            scope_id: scopeId,
            limit_usd: 50.00,
            spent_usd: 0.00,
            period: period
        };
    }

    /**
     * Internal: Update spent amount (simulated)
     */
    async _updateSpent(scopeType, scopeId, amount) {
        logger.logSystem(`[Budget] Recorded $${amount} for ${scopeType}:${scopeId}`);
    }
}

module.exports = BudgetService;
