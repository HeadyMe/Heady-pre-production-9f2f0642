/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Heady Patterns API — Exposes circuit breaker, auto-tuning pool,
 * and hot/cold cache status + management endpoints.
 */
const express = require('../core/heady-server');
const router = express.Router();

const { getAllBreakers: getCBStatus, getBreaker } = require("../resilience/circuit-breaker");
const { getAllPoolStatus, getPool } = require("../patterns/auto-tuning-pool");
const { getAllCacheStatus, getCache } = require("../patterns/hot-cold-cache");

// Initialize default breakers for core services
const defaultBreakers = ["heady-brain", "heady-soul", "heady-battle", "heady-hcfp", "notion-api"];
defaultBreakers.forEach((name) => getBreaker(name, { failureThreshold: 5, resetTimeoutMs: 30000 }));

// Initialize default pools
const defaultPools = ["api-requests", "background-jobs", "ai-inference"];
defaultPools.forEach((name) => getPool(name, { min: 1, max: 16, initial: 4, latencyTargetMs: 200 }));

// Initialize default caches
getCache("brain-responses", { hotMaxItems: 100, hotTtlMs: 60000, coldTtlMs: 300000 });
getCache("api-results", { hotMaxItems: 200, hotTtlMs: 30000, coldTtlMs: 120000 });

// ── Health / overview ──
router.get("/health", (req, res) => {
    res.json({
        ok: true,
        service: "heady-patterns",
        circuitBreakers: Object.keys(getCBStatus()).length,
        pools: Object.keys(getAllPoolStatus()).length,
        caches: Object.keys(getAllCacheStatus()).length,
        ts: new Date().toISOString(),
    });
});

// ── Circuit Breakers ──
router.get("/circuit-breakers", (req, res) => res.json({ ok: true, breakers: getCBStatus() }));

router.post("/circuit-breakers/:name/reset", (req, res) => {
    const cb = getBreaker(req.params.name);
    cb.reset();
    res.json({ ok: true, breaker: cb.getStatus() });
});

// ── Auto-Tuning Pools ──
router.get("/pools", (req, res) => res.json({ ok: true, pools: getAllPoolStatus() }));

// ── Hot/Cold Caches ──
router.get("/caches", (req, res) => res.json({ ok: true, caches: getAllCacheStatus() }));

router.post("/caches/:name/clear", (req, res) => {
    const cache = getCache(req.params.name);
    cache.clear();
    res.json({ ok: true, message: `Cache ${req.params.name} cleared` });
});

// ── Combined status ──
router.get("/status", (req, res) => {
    res.json({
        ok: true,
        patterns: {
            circuitBreakers: getCBStatus(),
            pools: getAllPoolStatus(),
            caches: getAllCacheStatus(),
        },
        ts: new Date().toISOString(),
    });
});

module.exports = router;
