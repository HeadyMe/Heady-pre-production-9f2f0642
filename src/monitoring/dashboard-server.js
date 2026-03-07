/**
 * ═══════════════════════════════════════════════════════════════════
 * Heady Unified Observability Dashboard — Server
 * ═══════════════════════════════════════════════════════════════════
 *
 * Express app serving the live observability dashboard on port 9090.
 * Collects metrics from all 7 Heady services, MCP router, bee factory,
 * skill router, CSL gate statistics, and phi scale values.
 *
 * Endpoints:
 *   GET  /health   — Server health check
 *   GET  /metrics  — Full metrics snapshot (JSON)
 *   GET  /api/status — Aggregated platform status
 *   GET  /stream   — SSE endpoint pushing real-time metrics every 2s
 *   GET  /         — Dashboard HTML
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * @module src/monitoring/dashboard-server
 */
'use strict';

const express = require('express');
const path = require('path');
const http = require('http');
const logger = require('../utils/logger');
const shutdownManager = require('../lib/shutdown');
const MetricsCollector = require('./metrics-collector');
const AlertManager = require('./alert-manager');

const PORT = parseInt(process.env.DASHBOARD_PORT || '9090', 10);
const PHI = 1.618033988749895;

// ── Circular Buffer for time-series storage ────────────────────────
class CircularBuffer {
    constructor(capacity = 1000) {
        this.capacity = capacity;
        this.buffer = [];
        this.index = 0;
        this.full = false;
    }

    push(item) {
        if (this.full) {
            this.buffer[this.index] = item;
        } else {
            this.buffer.push(item);
        }
        this.index = (this.index + 1) % this.capacity;
        if (this.index === 0 && !this.full) this.full = true;
    }

    toArray() {
        if (!this.full) return [...this.buffer];
        return [
            ...this.buffer.slice(this.index),
            ...this.buffer.slice(0, this.index),
        ];
    }

    get length() {
        return this.full ? this.capacity : this.buffer.length;
    }

    last(n = 60) {
        const arr = this.toArray();
        return arr.slice(Math.max(0, arr.length - n));
    }
}

// ── SSE Client Manager ─────────────────────────────────────────────
class SSEManager {
    constructor() {
        this.clients = new Set();
    }

    addClient(res) {
        this.clients.add(res);
        res.on('close', () => this.clients.delete(res));
    }

    broadcast(event, data) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        for (const client of this.clients) {
            try {
                client.write(payload);
            } catch {
                this.clients.delete(client);
            }
        }
    }

    get count() {
        return this.clients.size;
    }
}

// ── Dashboard Server ───────────────────────────────────────────────
class DashboardServer {
    constructor() {
        this.app = express();
        this.server = null;
        this.sse = new SSEManager();
        this.collector = new MetricsCollector();
        this.alertManager = new AlertManager();
        this.started = Date.now();

        // Time-series storage: one circular buffer per metric
        this.timeSeries = {
            latencyP50: new CircularBuffer(1000),
            latencyP95: new CircularBuffer(1000),
            latencyP99: new CircularBuffer(1000),
            throughput: new CircularBuffer(1000),
            errorRate: new CircularBuffer(1000),
            cpuSaturation: new CircularBuffer(1000),
            memorySaturation: new CircularBuffer(1000),
        };

        // Per-service time-series
        this.serviceTimeSeries = {};
        const services = [
            'heady-embed', 'heady-infer', 'heady-vector',
            'heady-chain', 'heady-cache', 'heady-guard', 'heady-eval',
        ];
        for (const svc of services) {
            this.serviceTimeSeries[svc] = new CircularBuffer(1000);
        }

        this._setupRoutes();
        this._setupCollectionLoop();
    }

    /**
     * Set up Express routes
     */
    _setupRoutes() {
        const app = this.app;

        // Serve static files (dashboard HTML/CSS)
        app.use(express.static(path.join(__dirname)));
        app.use(express.json());

        // Health endpoint
        app.get('/health', (req, res) => {
            res.json({
                ok: true,
                service: 'heady-dashboard',
                uptime: Date.now() - this.started,
                sseClients: this.sse.count,
                metricsCollected: this.collector.totalCollections,
            });
        });

        // Full metrics snapshot
        app.get('/metrics', async (req, res) => {
            try {
                const snapshot = await this._buildSnapshot();
                res.json(snapshot);
            } catch (err) {
                logger.error('[Dashboard] Metrics error:', err.message);
                res.status(500).json({ error: err.message });
            }
        });

        // Aggregated platform status
        app.get('/api/status', async (req, res) => {
            try {
                const snapshot = await this._buildSnapshot();
                res.json({
                    ok: true,
                    platform: 'Heady Sovereign AI',
                    architecture: 'federated-liquid-conductor',
                    uptime: Date.now() - this.started,
                    services: snapshot.services,
                    goldenSignals: snapshot.goldenSignals,
                    cslStats: snapshot.cslStats,
                    phiScales: snapshot.phiScales,
                    mcpRouter: snapshot.mcpRouter,
                    beeFactory: snapshot.beeFactory,
                    skillRouter: snapshot.skillRouter,
                    alerts: snapshot.alerts,
                });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // SSE stream for real-time updates
        app.get('/stream', (req, res) => {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            res.flushHeaders();

            // Send initial connection event
            res.write(`event: connected\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
            this.sse.addClient(res);
            logger.info(`[Dashboard] SSE client connected (total: ${this.sse.count})`);
        });

        // Time-series data for charts
        app.get('/api/timeseries/:metric', (req, res) => {
            const { metric } = req.params;
            const window = parseInt(req.query.window || '60', 10);
            const ts = this.timeSeries[metric];
            if (!ts) {
                return res.status(404).json({ error: `Unknown metric: ${metric}` });
            }
            res.json({ metric, window, data: ts.last(window) });
        });

        // Service-specific time-series
        app.get('/api/timeseries/service/:name', (req, res) => {
            const { name } = req.params;
            const window = parseInt(req.query.window || '60', 10);
            const ts = this.serviceTimeSeries[name];
            if (!ts) {
                return res.status(404).json({ error: `Unknown service: ${name}` });
            }
            res.json({ service: name, window, data: ts.last(window) });
        });

        // Alert endpoints
        app.get('/api/alerts', (req, res) => {
            res.json({ ok: true, alerts: this.alertManager.getActiveAlerts() });
        });

        app.get('/api/alerts/history', (req, res) => {
            const limit = parseInt(req.query.limit || '100', 10);
            res.json({ ok: true, history: this.alertManager.getHistory(limit) });
        });

        // Quarantine status (from self-healing mesh)
        app.get('/api/quarantine', (req, res) => {
            try {
                const QuarantineManager = require('../resilience/quarantine-manager');
                res.json({ ok: true, quarantined: QuarantineManager.getQuarantined() });
            } catch {
                res.json({ ok: true, quarantined: [], note: 'quarantine-manager not loaded' });
            }
        });

        // Incident timeline
        app.get('/api/incidents', (req, res) => {
            try {
                const timeline = require('../resilience/incident-timeline');
                res.json({ ok: true, incidents: timeline.getRecent(24) });
            } catch {
                res.json({ ok: true, incidents: [], note: 'incident-timeline not loaded' });
            }
        });

        // Root serves dashboard HTML
        app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'dashboard.html'));
        });

        logger.logSystem('[Dashboard] Routes configured: /health, /metrics, /api/status, /stream, /api/timeseries, /api/alerts');
    }

    /**
     * Set up the collection loop that polls services every 2 seconds
     */
    _setupCollectionLoop() {
        this.collector.on('metric', (data) => {
            // Store in time-series
            const ts = Date.now();
            if (data.goldenSignals) {
                const gs = data.goldenSignals;
                this.timeSeries.latencyP50.push({ ts, value: gs.latencyP50 || 0 });
                this.timeSeries.latencyP95.push({ ts, value: gs.latencyP95 || 0 });
                this.timeSeries.latencyP99.push({ ts, value: gs.latencyP99 || 0 });
                this.timeSeries.throughput.push({ ts, value: gs.throughput || 0 });
                this.timeSeries.errorRate.push({ ts, value: gs.errorRate || 0 });
                this.timeSeries.cpuSaturation.push({ ts, value: gs.cpuSaturation || 0 });
                this.timeSeries.memorySaturation.push({ ts, value: gs.memorySaturation || 0 });
            }

            // Store per-service data
            if (data.services) {
                for (const svc of data.services) {
                    if (this.serviceTimeSeries[svc.name]) {
                        this.serviceTimeSeries[svc.name].push({
                            ts,
                            latency: svc.latency || 0,
                            status: svc.status || 'unknown',
                            circuitBreaker: svc.circuitBreakerState || 'UNKNOWN',
                        });
                    }
                }
            }

            // Check alert conditions
            this.alertManager.evaluate(data);

            // Broadcast to SSE clients
            this.sse.broadcast('metrics', {
                ts,
                goldenSignals: data.goldenSignals,
                services: data.services,
                cslStats: data.cslStats,
                phiScales: data.phiScales,
                mcpRouter: data.mcpRouter,
                beeFactory: data.beeFactory,
                skillRouter: data.skillRouter,
                alerts: this.alertManager.getActiveAlerts(),
            });
        });

        // Start collecting every 2 seconds
        this.collectionInterval = setInterval(() => {
            this.collector.collectAll().catch(err => {
                logger.error('[Dashboard] Collection error:', err.message);
            });
        }, 2000);
    }

    /**
     * Build a full snapshot of all metrics
     */
    async _buildSnapshot() {
        const latest = this.collector.getLatest();
        return {
            ts: Date.now(),
            uptime: Date.now() - this.started,
            goldenSignals: latest.goldenSignals || {},
            services: latest.services || [],
            cslStats: latest.cslStats || {},
            phiScales: latest.phiScales || {},
            mcpRouter: latest.mcpRouter || {},
            beeFactory: latest.beeFactory || [],
            skillRouter: latest.skillRouter || {},
            alerts: this.alertManager.getActiveAlerts(),
            timeSeries: {
                latencyP50: this.timeSeries.latencyP50.last(60),
                latencyP95: this.timeSeries.latencyP95.last(60),
                latencyP99: this.timeSeries.latencyP99.last(60),
                throughput: this.timeSeries.throughput.last(60),
                errorRate: this.timeSeries.errorRate.last(60),
            },
        };
    }

    /**
     * Start the dashboard server
     */
    start() {
        return new Promise((resolve) => {
            this.server = http.createServer(this.app);
            this.server.listen(PORT, () => {
                logger.logSystem(`[Dashboard] ═══ Heady Observability Dashboard running on http://0.0.0.0:${PORT} ═══`);
                logger.logSystem(`[Dashboard] SSE stream at /stream, metrics at /metrics`);
                resolve(this.server);
            });

            // Register graceful shutdown
            shutdownManager.register('dashboard-server', () => {
                return new Promise((res) => {
                    clearInterval(this.collectionInterval);
                    // Close all SSE connections
                    for (const client of this.sse.clients) {
                        try { client.end(); } catch { /* ignore */ }
                    }
                    this.sse.clients.clear();
                    if (this.server) {
                        this.server.close(() => res());
                    } else {
                        res();
                    }
                });
            }, 5);
        });
    }

    /**
     * Stop the server
     */
    stop() {
        return new Promise((resolve) => {
            clearInterval(this.collectionInterval);
            if (this.server) {
                this.server.close(() => resolve());
            } else {
                resolve();
            }
        });
    }
}

// ── Singleton & startup ────────────────────────────────────────────
let _dashboard = null;

function getDashboardServer() {
    if (!_dashboard) _dashboard = new DashboardServer();
    return _dashboard;
}

// Auto-start if run directly
if (require.main === module) {
    const dashboard = getDashboardServer();
    dashboard.start().catch(err => {
        logger.error('[Dashboard] Failed to start:', err.message);
        process.exit(1);
    });
}

module.exports = { DashboardServer, getDashboardServer, CircularBuffer, SSEManager };
