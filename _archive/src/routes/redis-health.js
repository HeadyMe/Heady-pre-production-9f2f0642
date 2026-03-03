const express = require('express');
const router = express.Router();
const redisPool = require('../utils/redis-pool');

/**
 * @swagger
 * /api/redis/health:
 *   get:
 *     summary: Redis pool health metrics
 *     responses:
 *       200:
 *         description: Pool health data
 */
router.get('/health', async (req, res) => {
    try {
        const health = await redisPool.getPoolHealth();
        const status = health.connected ? 200 : 503;
        res.status(status).json({
            ok: health.connected,
            service: 'redis-pool',
            ...health,
            ts: new Date().toISOString(),
        });
    } catch (err) {
        res.status(503).json({
            ok: false,
            service: 'redis-pool',
            error: err.message,
            ts: new Date().toISOString(),
        });
    }
});

module.exports = router;
