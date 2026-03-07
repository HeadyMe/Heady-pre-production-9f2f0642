/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Heady Health Routes — Production health and readiness endpoints
 * Provides /health/live, /health/ready, and /health/full for Kubernetes-style probes.
 */
const express = require('../core/heady-server');
const router = express.Router();

const startTime = Date.now();

// ── Liveness: is the process alive? ─────────────────────────────────
router.get('/live', (req, res) => {
    res.json({
        status: 'ok',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
    });
});

// ── Readiness: can we serve traffic? ────────────────────────────────
router.get('/ready', async (req, res) => {
    const checks = {};
    let allReady = true;

    // Check resilience module
    try {
        const resilience = require('../resilience');
        const status = resilience.getResilienceStatus();
        checks.resilience = {
            status: 'ok',
            breakers: status.summary.breakersRegistered,
            openBreakers: status.summary.breakersOpen,
        };
        if (status.summary.breakersOpen > 3) {
            checks.resilience.status = 'degraded';
            allReady = false;
        }
    } catch {
        checks.resilience = { status: 'unavailable' };
    }

    // Check filesystem
    try {
        const fs = require('fs');
        fs.accessSync('/home/headyme/Heady/heady-registry.json', fs.constants.R_OK);
        checks.filesystem = { status: 'ok' };
    } catch {
        checks.filesystem = { status: 'error' };
        allReady = false;
    }

    // Check memory
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
    checks.memory = {
        status: heapUsedMB > 450 ? 'warning' : 'ok',
        heapUsedMB,
        heapTotalMB,
        rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
    };

    // Check event loop lag
    const lagStart = Date.now();
    await new Promise(r => setImmediate(r));
    const lagMs = Date.now() - lagStart;
    checks.eventLoop = {
        status: lagMs > 100 ? 'warning' : 'ok',
        lagMs,
    };

    // Check vector memory (3D spatial storage)
    try {
        const vectorMem = require('../vector-memory');
        const stats = vectorMem.getStats();
        checks.vectorMemory = {
            status: 'ok',
            totalVectors: stats.total_vectors,
            shards: stats.num_shards,
            architecture: stats.architecture,
        };
    } catch {
        checks.vectorMemory = { status: 'unavailable' };
    }

    // Check self-awareness telemetry
    try {
        const selfAwareness = require('../self-awareness');
        const introspection = selfAwareness.getSystemIntrospection();
        checks.selfAwareness = {
            status: 'ok',
            telemetryEvents: introspection.telemetry.totalEvents,
            errorRate1m: introspection.telemetry.errorRate1m,
        };
        if (introspection.telemetry.errorRate1m > 50) {
            checks.selfAwareness.status = 'degraded';
            allReady = false;
        }
    } catch {
        checks.selfAwareness = { status: 'unavailable' };
    }

    res.status(allReady ? 200 : 503).json({
        status: allReady ? 'ready' : 'not_ready',
        checks,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
    });
});

// ── Full: comprehensive system status ───────────────────────────────
router.get('/full', async (req, res) => {
    const pkg = (() => { try { return require('../../package.json'); } catch { return {}; } })();

    let resilienceStatus = null;
    try {
        resilienceStatus = require('../resilience').getResilienceStatus();
    } catch { /* ignore */ }

    let introspection = null;
    try {
        introspection = require('../self-awareness').getSystemIntrospection();
    } catch { /* ignore */ }

    res.json({
        service: 'heady-manager',
        version: pkg.version || 'unknown',
        environment: process.env.NODE_ENV || 'development',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        resilience: resilienceStatus?.summary || null,
        introspection: introspection || null,
        timestamp: new Date().toISOString(),
    });
});

module.exports = router;
