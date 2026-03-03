/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * ═══ Resilience API Routes ═══
 * Phase 1: Expose circuit breakers, caches, connection pools, and unified status
 * Endpoint: /api/resilience/*
 */

const express = require('express');
const router = express.Router();

const {
    getBreaker, getAllBreakers,
    getCache, getAllCacheMetrics,
    getPool, getAllPoolStatus,
    getResilienceStatus,
} = require('../resilience');

// ─── Unified Resilience Status ──────────────────────────────────────
router.get('/status', (req, res) => {
    res.json({ ok: true, ...getResilienceStatus() });
});

router.get('/health', (req, res) => {
    const status = getResilienceStatus();
    const healthy = status.summary.breakersOpen === 0;
    res.status(healthy ? 200 : 503).json({
        ok: healthy,
        breakersOpen: status.summary.breakersOpen,
        breakersRegistered: status.summary.breakersRegistered,
        cacheHitRate: status.summary.totalCacheHitRate,
        poolsActive: status.summary.poolsActive,
        ts: new Date().toISOString(),
    });
});

// ─── Circuit Breakers ───────────────────────────────────────────────
router.get('/breakers', (req, res) => {
    res.json({ ok: true, breakers: getAllBreakers() });
});

router.get('/breakers/:name', (req, res) => {
    const breaker = getBreaker(req.params.name);
    res.json({ ok: true, ...breaker.getStatus() });
});

router.post('/breakers/:name/reset', (req, res) => {
    const breaker = getBreaker(req.params.name);
    breaker.reset();
    res.json({ ok: true, message: `Circuit breaker "${req.params.name}" reset to CLOSED`, ...breaker.getStatus() });
});

// ─── Caches ─────────────────────────────────────────────────────────
router.get('/caches', (req, res) => {
    res.json({ ok: true, caches: getAllCacheMetrics() });
});

router.post('/caches/:name/clear', (req, res) => {
    const cache = getCache(req.params.name);
    cache.clear();
    res.json({ ok: true, message: `Cache "${req.params.name}" cleared` });
});

// ─── Connection Pools ───────────────────────────────────────────────
router.get('/pools', (req, res) => {
    res.json({ ok: true, pools: getAllPoolStatus() });
});

module.exports = router;
