/**
 * ∞ Core API — Heady Central API Router
 *
 * Central Express router for core Heady API endpoints.
 * Provides health, status, version, and system-level endpoints
 * that are always available regardless of which services are loaded.
 *
 * © 2026 HeadySystems Inc. All rights reserved.
 */

const { Router } = (() => {
    try { return require('express'); }
    catch (_e) { return { Router: () => ({ get: () => {}, post: () => {}, use: () => {} }) }; }
})();

const logger = require('../utils/logger');
const pkg = (() => {
    try {
        const path = require('path');
        return require(path.join(__dirname, '..', '..', 'package.json'));
    } catch (_e) { return { name: 'heady-manager', version: '1.0.0' }; }
})();

const router = Router();

// ── Health / Status ────────────────────────────────────────────
router.get('/health', (_req, res) => {
    res.json({
        ok: true,
        service: pkg.name,
        version: pkg.version,
        ts: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
    });
});

router.get('/status', (_req, res) => {
    const mem = process.memoryUsage();
    res.json({
        ok: true,
        service: pkg.name,
        version: pkg.version,
        node: process.version,
        ts: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        memory: {
            rss: Math.round(mem.rss / 1048576) + 'MB',
            heapUsed: Math.round(mem.heapUsed / 1048576) + 'MB',
            heapTotal: Math.round(mem.heapTotal / 1048576) + 'MB',
        },
        env: process.env.NODE_ENV || 'development',
    });
});

router.get('/version', (_req, res) => {
    res.json({ version: pkg.version, name: pkg.name });
});

// ── Echo / Ping ────────────────────────────────────────────────
router.get('/ping', (_req, res) => res.json({ pong: true, ts: new Date().toISOString() }));

router.post('/echo', (req, res) => res.json({ echo: req.body, ts: new Date().toISOString() }));

// ── System Info ────────────────────────────────────────────────
router.get('/system', (_req, res) => {
    try {
        const os = require('os');
        res.json({
            ok: true,
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            freeMemMB: Math.round(os.freemem() / 1048576),
            totalMemMB: Math.round(os.totalmem() / 1048576),
            loadAvg: os.loadavg(),
            uptime: Math.round(os.uptime()),
            ts: new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ── Error boundary ─────────────────────────────────────────────
router.use((err, _req, res, _next) => {
    logger.error?.('[core-api] Unhandled error:', err);
    res.status(500).json({ ok: false, error: err.message });
});

module.exports = router;
