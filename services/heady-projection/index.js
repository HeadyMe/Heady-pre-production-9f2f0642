/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */

/**
 * Heady™ Projection Service — Main Entry Point
 *
 * Initialises ProjectionManager, all 6 domain bees, ProjectionSwarm, SSE broadcaster,
 * HeadyConductor integration, and the Express HTTP server.
 *
 * Environment variables:
 *   PROJECTION_PORT    — HTTP port (default 3849)
 *   CONDUCTOR_URL      — HeadyConductor URL (default http://localhost:3848)
 *   LOG_LEVEL          — Logging level: debug|info|warn|error (default info)
 *   PUBSUB_TOPIC       — GCP Pub/Sub topic for cloud broadcast (optional)
 */

import express from 'express';
import { createServer } from 'node:http';
import { EventEmitter } from 'node:events';

// ── Constants ─────────────────────────────────────────────────────────────────
const PHI  = 1.6180339887;
const PORT = Number(process.env.PROJECTION_PORT) || 3849;

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LEVELS    = { debug: 0, info: 1, warn: 2, error: 3 };
const log = (level, ...args) => {
  if ((LEVELS[level] ?? 0) >= (LEVELS[LOG_LEVEL] ?? 1)) {
    const prefix = `[${new Date().toISOString()}] [projection-service] [${level.toUpperCase()}]`;
    (level === 'error' ? console.error : console.log)(prefix, ...args);
  }
};

// ── ProjectionManager ─────────────────────────────────────────────────────────
class ProjectionManager extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, object>} */
    this.projections = new Map();
    this.versions    = new Map();
    this.startedAt   = Date.now();
  }

  /**
   * Update a projection domain with new state.
   * Increments version, emits 'projection' event.
   * @param {string} domain
   * @param {object} state
   */
  update(domain, state) {
    const prev    = this.projections.get(domain);
    const version = (this.versions.get(domain) || 0) + 1;
    this.versions.set(domain, version);

    const projection = {
      domain,
      version,
      state,
      prev:       prev?.state ?? null,
      updatedAt:  Date.now(),
    };

    this.projections.set(domain, projection);
    this.emit('projection', projection);
    log('debug', `Updated projection [${domain}] v${version}`);
    return projection;
  }

  /**
   * Get current projection state.
   * @param {string} domain
   */
  get(domain) {
    return this.projections.get(domain) ?? null;
  }

  /**
   * Get all current projections.
   * @returns {object[]}
   */
  getAll() {
    return Array.from(this.projections.values());
  }

  /**
   * Return manager health info.
   */
  getHealth() {
    return {
      domains:   this.projections.size,
      startedAt: this.startedAt,
      uptimeMs:  Date.now() - this.startedAt,
    };
  }
}

// ── ProjectionSwarm ───────────────────────────────────────────────────────────
class ProjectionSwarm {
  /**
   * @param {ProjectionManager} manager
   * @param {object[]} bees
   * @param {{ maxConcurrent?: number, errorThreshold?: number }} opts
   */
  constructor(manager, bees, opts = {}) {
    this.manager        = manager;
    this.bees           = bees;
    this.maxConcurrent  = opts.maxConcurrent  || 6;
    this.errorThreshold = opts.errorThreshold || 0.3;
    this.running        = false;
    this.timers         = [];
    this.stats          = { runs: 0, errors: 0, lastRunAt: null };
  }

  /** Start all bee polling loops. */
  start() {
    if (this.running) return;
    this.running = true;
    log('info', `ProjectionSwarm starting — ${this.bees.length} bees, maxConcurrent=${this.maxConcurrent}`);

    for (const bee of this.bees) {
      const interval = bee.intervalMs || Math.round(PHI * 5000);
      const timer    = setInterval(() => this._runBee(bee), interval);
      this.timers.push(timer);
      // Stagger initial runs with PHI-scaled offsets
      const stagger = Math.round(PHI * 200 * this.bees.indexOf(bee));
      setTimeout(() => this._runBee(bee), stagger);
    }
  }

  /** Stop all bee loops. */
  stop() {
    this.running = false;
    this.timers.forEach(t => clearInterval(t));
    this.timers = [];
    log('info', 'ProjectionSwarm stopped.');
  }

  /** Execute a single bee's workers and update the manager. */
  async _runBee(bee) {
    if (!this.running) return;
    this.stats.runs++;
    this.stats.lastRunAt = Date.now();

    try {
      const workers = bee.getWork();
      const results = await Promise.allSettled(
        workers.slice(0, this.maxConcurrent).map(fn => fn())
      );

      const merged = {};
      for (const res of results) {
        if (res.status === 'fulfilled') {
          Object.assign(merged, res.value);
        } else {
          this.stats.errors++;
          log('warn', `Bee [${bee.domain}] worker error:`, res.reason?.message);
        }
      }

      this.manager.update(bee.domain, merged);
    } catch (e) {
      this.stats.errors++;
      log('error', `Bee [${bee.domain}] run failed:`, e.message);
    }
  }

  /** Swarm health ratio. */
  getHealth() {
    const ratio = this.stats.runs > 0 ? 1 - (this.stats.errors / this.stats.runs) : 1;
    return {
      running:        this.running,
      beeCount:       this.bees.length,
      totalRuns:      this.stats.runs,
      totalErrors:    this.stats.errors,
      healthRatio:    Math.max(0, ratio),
      lastRunAt:      this.stats.lastRunAt,
    };
  }
}

// ── Built-in stub bees ────────────────────────────────────────────────────────
// These are in-process stubs; replace with imports from src/bees/* in production.

function makeStubbedBee(domain, intervalMs, workerFns) {
  return { domain, intervalMs, getWork: () => workerFns };
}

const vectorMemoryBee = makeStubbedBee('vector-memory', Math.round(PHI * 8000), [
  async () => ({
    bee: 'vector-memory',
    action: 'scan',
    totalVectors:  Math.floor(128000 + Math.random() * 2000),
    namespaces:    8,
    driftScore:    Math.random() * 0.25,
    clusterCount:  Math.floor(32 + Math.random() * 4),
    ts: Date.now(),
  }),
]);

const configBee = makeStubbedBee('config', Math.round(PHI * 10000), [
  async () => ({
    bee: 'config',
    action: 'check',
    configHash:    'sha256:' + Date.now().toString(36),
    lastChanged:   Date.now() - 300_000,
    driftDetected: Math.random() < 0.05,
    watcherCount:  4,
    ts: Date.now(),
  }),
]);

const healthBee = makeStubbedBee('health', Math.round(PHI * 6000), [
  async () => ({
    bee: 'health',
    action: 'aggregate',
    overallScore: 0.9 + Math.random() * 0.1,
    services: {
      api:        'healthy',
      database:   Math.random() > 0.97 ? 'degraded' : 'healthy',
      cache:      'healthy',
      pubsub:     'healthy',
      'vector-db': 'healthy',
    },
    ts: Date.now(),
  }),
]);

const telemetryBee = makeStubbedBee('telemetry', Math.round(PHI * 4000), [
  async () => ({
    bee: 'telemetry',
    action: 'collect',
    cpuPercent:   20 + Math.random() * 40,
    memPercent:   50 + Math.random() * 25,
    eventLoopLag: 2  + Math.random() * 20,
    ts: Date.now(),
  }),
]);

const topologyBee = makeStubbedBee('topology', Math.round(PHI * 15000), [
  async () => ({
    bee: 'topology',
    action: 'discover',
    agentCount:      10 + Math.floor(Math.random() * 4),
    orphanCount:     Math.floor(Math.random() * 2),
    connectionCount: 15 + Math.floor(Math.random() * 6),
    connections: [],
    ts: Date.now(),
  }),
]);

const taskQueueBee = makeStubbedBee('task-queue', Math.round(PHI * 5000), [
  async () => ({
    bee: 'task-queue',
    action: 'poll',
    queueDepth:   Math.floor(Math.random() * 60),
    throughput:   12 + Math.random() * 30,
    stalledTasks: Math.floor(Math.random() * 3),
    backlog:      Math.floor(Math.random() * 15),
    ts: Date.now(),
  }),
]);

const BEES = [vectorMemoryBee, configBee, healthBee, telemetryBee, topologyBee, taskQueueBee];

// ── SSE broadcaster ───────────────────────────────────────────────────────────
class SSEBroadcaster {
  constructor() {
    /** @type {Set<import('express').Response>} */
    this.clients       = new Set();
    this.heartbeatMs   = Math.round(PHI * 10000);
    this._heartbeatTimer = null;
  }

  /**
   * Register a new SSE client.
   * @param {import('express').Request}  req
   * @param {import('express').Response} res
   */
  addClient(req, res) {
    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Send current snapshot
    res.write(`event: connected\ndata: ${JSON.stringify({ ts: Date.now(), phi: PHI })}\n\n`);

    this.clients.add(res);
    log('info', `SSE client connected (total: ${this.clients.size})`);

    req.on('close', () => {
      this.clients.delete(res);
      log('info', `SSE client disconnected (total: ${this.clients.size})`);
    });
  }

  /**
   * Broadcast a projection event to all clients.
   * @param {object} projection
   */
  broadcast(projection) {
    const payload = JSON.stringify(projection);
    const frame   = `event: ${projection.domain}\ndata: ${payload}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(frame);
      } catch (e) {
        this.clients.delete(client);
      }
    }
  }

  /** Start heartbeat ping loop. */
  startHeartbeat() {
    this._heartbeatTimer = setInterval(() => {
      const frame = `event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`;
      for (const client of this.clients) {
        try { client.write(frame); }
        catch { this.clients.delete(client); }
      }
    }, this.heartbeatMs);
  }

  stopHeartbeat() {
    clearInterval(this._heartbeatTimer);
  }

  get clientCount() { return this.clients.size; }
}

// ── HeadyConductor integration ─────────────────────────────────────────────────
class HeadyConductorClient {
  constructor(url) {
    this.url       = url || process.env.CONDUCTOR_URL || 'http://localhost:3848';
    this.connected = false;
  }

  async register(serviceInfo) {
    try {
      const res = await fetch(`${this.url}/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(serviceInfo),
        signal:  AbortSignal.timeout(2000),
      });
      this.connected = res.ok;
      if (res.ok) log('info', `Registered with HeadyConductor at ${this.url}`);
    } catch {
      log('warn', `HeadyConductor not available at ${this.url} — continuing without it`);
    }
  }

  async heartbeat(state) {
    if (!this.connected) return;
    try {
      await fetch(`${this.url}/heartbeat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(state),
        signal:  AbortSignal.timeout(1000),
      });
    } catch { /* conductor offline */ }
  }
}

// ── Express app ───────────────────────────────────────────────────────────────
const app         = express();
const manager     = new ProjectionManager();
const swarm       = new ProjectionSwarm(manager, BEES, { maxConcurrent: 6 });
const sse         = new SSEBroadcaster();
const conductor   = new HeadyConductorClient();

app.use(express.json());

// Wire SSE broadcast to projection updates
manager.on('projection', (p) => sse.broadcast(p));

// ── Routes ────────────────────────────────────────────────────────────────────
// Health check
app.get('/health', (_req, res) => {
  res.json({
    service:   'projection-service',
    status:    'ok',
    phi:       PHI,
    manager:   manager.getHealth(),
    swarm:     swarm.getHealth(),
    sseClients: sse.clientCount,
    ts:        Date.now(),
  });
});

// Get all projections (snapshot)
app.get('/api/projections', (_req, res) => {
  res.json({
    projections: manager.getAll(),
    ts:          Date.now(),
  });
});

// Get single projection
app.get('/api/projections/:domain', (req, res) => {
  const p = manager.get(req.params.domain);
  if (!p) return res.status(404).json({ error: 'Projection not found', domain: req.params.domain });
  res.json(p);
});

// SSE stream endpoint
app.get('/api/projections/sse', (req, res) => {
  sse.addClient(req, res);
  // Send current snapshot to new client
  manager.getAll().forEach(p => {
    const frame = `event: ${p.domain}\ndata: ${JSON.stringify(p)}\n\n`;
    res.write(frame);
  });
});

// Swarm health
app.get('/api/swarm', (_req, res) => {
  res.json(swarm.getHealth());
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// ── Start server ──────────────────────────────────────────────────────────────
const server = createServer(app);

server.listen(PORT, async () => {
  log('info', `Projection service listening on port ${PORT} (φ = ${PHI})`);
  swarm.start();
  sse.startHeartbeat();

  await conductor.register({
    service:  'projection-service',
    port:     PORT,
    phi:      PHI,
    domains:  BEES.map(b => b.domain),
    ts:       Date.now(),
  });

  // Conductor heartbeat every PHI * 30s
  setInterval(() => conductor.heartbeat(swarm.getHealth()), Math.round(PHI * 30_000));
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal) {
  log('info', `${signal} received — shutting down…`);
  swarm.stop();
  sse.stopHeartbeat();
  server.close(() => {
    log('info', 'HTTP server closed.');
    process.exit(0);
  });
  // Force exit after PHI * 5s
  setTimeout(() => process.exit(1), Math.round(PHI * 5000)).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  (e) => { log('error', 'Uncaught exception:', e); });
process.on('unhandledRejection', (r) => { log('error', 'Unhandled rejection:', r); });

export { app, manager, swarm, sse };
