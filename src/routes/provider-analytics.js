/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ Provider Analytics API ═══
 *
 * REST endpoints for provider usage dashboards and budget monitoring.
 * Exposes aggregated provider/account/model analytics from the usage tracker.
 *
 * Heady AI Nodes: OBSERVER, SENTINEL
 */

const express = require("express");
const router = express.Router();
const tracker = require("../telemetry/provider-usage-tracker");

/**
 * GET /api/providers/summary
 * All providers rollup — dashboard overview.
 * Query: ?period=daily|monthly|all (default: all)
 */
router.get("/summary", (_req, res) => {
    const period = _req.query.period || "all";
    res.json(tracker.getAllProvidersSummary(period));
});

/**
 * GET /api/providers/accounts
 * Full account registry with per-account usage.
 */
router.get("/accounts", (_req, res) => {
    const registry = tracker.getAccountRegistry();
    const accounts = {};

    for (const [provider, accts] of Object.entries(registry)) {
        accounts[provider] = accts.map(a => ({
            ...a,
            usage: tracker.getAccountSummary(a.id),
        }));
    }

    res.json({ accounts, timestamp: new Date().toISOString() });
});

/**
 * GET /api/providers/budget-status
 * Budget alerts and remaining capacity across all providers.
 */
router.get("/budget-status", (_req, res) => {
    const statuses = tracker.getAllBudgetStatus();
    const exceeded = statuses.filter(s => s.status === "exceeded");
    const warnings = statuses.filter(s => s.status === "warning");

    res.json({
        statuses,
        alerts: {
            exceeded: exceeded.length,
            warnings: warnings.length,
            messages: [
                ...exceeded.map(s => s.alert),
                ...warnings.map(s => s.alert),
            ],
        },
        timestamp: new Date().toISOString(),
    });
});

/**
 * GET /api/providers/top
 * Top providers ranked by cost, calls, or tokens.
 * Query: ?metric=cost|calls|tokens&limit=10
 */
router.get("/top", (req, res) => {
    const metric = req.query.metric || "cost";
    const limit = parseInt(req.query.limit) || 10;
    res.json({
        metric,
        providers: tracker.getTopProviders(metric, limit),
        timestamp: new Date().toISOString(),
    });
});

/**
 * GET /api/providers/:provider/detail
 * Single provider deep-dive with daily/monthly/all-time breakdown.
 */
router.get("/:provider/detail", (req, res) => {
    const { provider } = req.params;
    res.json({
        provider,
        allTime: tracker.getProviderSummary(provider, "all"),
        daily: tracker.getProviderSummary(provider, "daily"),
        monthly: tracker.getProviderSummary(provider, "monthly"),
        budget: tracker.checkProviderBudget(provider),
        timestamp: new Date().toISOString(),
    });
});

/**
 * GET /api/providers/health
 * Provider analytics service health check.
 */
router.get("/health", (_req, res) => {
    res.json({
        status: "online",
        service: "provider-analytics",
        totalTracked: tracker.getAllProvidersSummary("all").totalCalls,
        latencyPercentiles: tracker.calculatePercentiles(),
    });
});

module.exports = router;
