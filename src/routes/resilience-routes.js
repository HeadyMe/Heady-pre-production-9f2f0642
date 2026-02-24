/**
 * Heady Resilience Routes — /api/resilience
 * Exposes circuit breaker, cache, and pool status for HeadyLens and the Admin UI.
 */
const express = require('express');
const router = express.Router();
const { getResilienceStatus, getAllBreakers, getAllCacheMetrics, getAllPoolStatus, getBreaker } = require('../resilience');

// GET /api/resilience/status — full dashboard
router.get('/status', (req, res) => {
    res.json(getResilienceStatus());
});

// GET /api/resilience/breakers — circuit breakers only
router.get('/breakers', (req, res) => {
    res.json(getAllBreakers());
});

// POST /api/resilience/breakers/:name/reset — manually reset a breaker
router.post('/breakers/:name/reset', (req, res) => {
    const breaker = getBreaker(req.params.name);
    breaker.reset();
    res.json({ ok: true, breaker: breaker.getStatus() });
});

// GET /api/resilience/caches — cache metrics
router.get('/caches', (req, res) => {
    res.json(getAllCacheMetrics());
});

// GET /api/resilience/pools — pool status
router.get('/pools', (req, res) => {
    res.json(getAllPoolStatus());
});

module.exports = router;
