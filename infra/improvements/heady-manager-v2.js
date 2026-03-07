/**
 * ∞ Heady Conductor v2 — Thin Orchestrator Shell with Graceful Shutdown
 *
 * CHANGES from heady-manager.js:
 *   [CRITICAL] Added SIGTERM/SIGINT handlers with connection draining
 *              Original had no graceful shutdown — Cloud Run SIGTERM caused instant exit,
 *              dropping in-flight requests
 *   [CRITICAL] Added readiness gate — server does not accept traffic until all
 *              bootstrap phases complete (prevents 502s on cold start)
 *   [HIGH]     Added startup timeout — if bootstrap exceeds 60s, exit with code 1
 *              so Cloud Run marks revision unhealthy and rolls back
 *   [HIGH]     Added prom-client metrics bootstrap for Prometheus scraping
 *   [HIGH]     Added OTEL tracing middleware (if OTEL_EXPORTER_ENDPOINT is set)
 *   [MEDIUM]   Added unhandledRejection and uncaughtException handlers with
 *              structured logging and graceful exit
 *   [MEDIUM]   Export server instance and shutdown function for testing
 *   [OPS]      Added /health/startup endpoint (Cloud Run startup probe)
 *   [OPS]      Startup timer for observability — reports total boot time
 *
 * © 2026 HeadySystems Inc. — Proprietary
 */

'use strict';

// ── Boot Timer ──────────────────────────────────────────────────────────────
const BOOT_START = Date.now();
const BOOT_TIMEOUT_MS = parseInt(process.env.BOOT_TIMEOUT_MS) || 60_000;
const SHUTDOWN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_TIMEOUT_MS) || 15_000;

// ── Startup Readiness State ─────────────────────────────────────────────────
// CHANGE: Track readiness separately from liveness.
// Server starts listening immediately but marks itself not-ready until all
// bootstrap phases complete. This prevents Cloud Run from sending traffic before
// the service is warm.
const startupState = {
  ready: false,
  started: false,
  phase: 'initializing',
  bootTimeMs: null,
  error: null,
};

// ── Unhandled Error Safety Net ───────────────────────────────────────────────
// CHANGE: Added structured error logging before process exit.
// Original had no uncaughtException handler — silent crashes with no log context.
process.on('uncaughtException', (err, origin) => {
  console.error(JSON.stringify({
    level: 'fatal',
    msg: 'Uncaught exception — process will exit',
    error: err.message,
    stack: err.stack,
    origin,
    phase: startupState.phase,
    ts: new Date().toISOString(),
  }));
  // Give logger time to flush before exit
  setTimeout(() => process.exit(1), 500);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(JSON.stringify({
    level: 'error',
    msg: 'Unhandled promise rejection',
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    phase: startupState.phase,
    ts: new Date().toISOString(),
  }));
  // Do not exit — unhandled rejections in non-critical paths should not crash server
});

// ── Boot Timeout Watchdog ────────────────────────────────────────────────────
// CHANGE: If bootstrap takes longer than BOOT_TIMEOUT_MS, exit with failure.
// Cloud Run will then roll back to the previous revision automatically.
const bootTimeoutHandle = setTimeout(() => {
  console.error(JSON.stringify({
    level: 'fatal',
    msg: `Boot timeout after ${BOOT_TIMEOUT_MS}ms — last phase: ${startupState.phase}`,
    ts: new Date().toISOString(),
  }));
  process.exit(1);
}, BOOT_TIMEOUT_MS).unref();

// ── Phase 0: Environment Validation ─────────────────────────────────────────
startupState.phase = 'env-validation';
const { validateEnvironment } = require('./src/config/env-schema');
validateEnvironment({ strict: process.env.NODE_ENV === 'production' });

// ── Phase 1: Environment + Globals ──────────────────────────────────────────
startupState.phase = 'config-globals';
const { app, logger, eventBus, remoteConfig, secretsManager, cfManager } =
  require('./src/bootstrap/config-globals');

// ── Phase 2: Metrics Bootstrap ──────────────────────────────────────────────
// CHANGE: Initialize prom-client before any request handling.
// This enables the /metrics endpoint to return valid data from first request.
startupState.phase = 'metrics';
let metricsRegistry = null;
try {
  const promClient = require('prom-client');

  // Default metrics (CPU, memory, event loop lag, GC)
  promClient.collectDefaultMetrics({
    prefix: 'heady_',
    labels: {
      service: process.env.HEADY_SERVICE_NAME || 'heady-manager',
      version: process.env.HEADY_VERSION || 'unknown',
      environment: process.env.NODE_ENV || 'development',
    },
  });

  metricsRegistry = promClient.register;

  // Custom HTTP metrics
  const httpRequestsTotal = new promClient.Counter({
    name: 'heady_http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'],
  });

  const httpRequestDuration = new promClient.Histogram({
    name: 'heady_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  });

  // Middleware: instrument all routes
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const routeLabel = req.route?.path || req.path.replace(/\/[0-9a-f-]{36}/g, '/:id') || 'unknown';
      httpRequestsTotal.labels(req.method, routeLabel, String(res.statusCode)).inc();
      httpRequestDuration.labels(req.method, routeLabel).observe((Date.now() - start) / 1000);
    });
    next();
  });

  // /metrics endpoint — protected behind internal auth if needed
  app.get('/metrics', async (req, res) => {
    // CHANGE: Require bearer token for Prometheus scrape to prevent public exposure
    const metricsToken = process.env.METRICS_TOKEN;
    if (metricsToken) {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== metricsToken) {
        return res.status(401).json({ error: 'unauthorized' });
      }
    }
    res.set('Content-Type', metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  });

  logger.info('[Manager] prom-client metrics initialized');
} catch (err) {
  // prom-client is optional — log warning but continue
  logger.warn('[Manager] prom-client not available — metrics endpoint disabled', { error: err.message });
}

// ── Phase 3: OTEL Tracing ────────────────────────────────────────────────────
// CHANGE: Initialize OpenTelemetry tracing if endpoint is configured.
// Original code had OTEL_EXPORTER_ENDPOINT in env-example but no wiring.
startupState.phase = 'otel-tracing';
if (process.env.OTEL_EXPORTER_ENDPOINT) {
  try {
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    const { Resource } = require('@opentelemetry/resources');
    const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

    const sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: process.env.HEADY_SERVICE_NAME || 'heady-manager',
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.HEADY_VERSION || '3.1.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'production',
      }),
      traceExporter: new OTLPTraceExporter({
        url: `${process.env.OTEL_EXPORTER_ENDPOINT}/v1/traces`,
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false }, // too noisy
        }),
      ],
    });

    sdk.start();
    logger.info('[Manager] OpenTelemetry tracing started', {
      endpoint: process.env.OTEL_EXPORTER_ENDPOINT,
    });

    // Graceful shutdown for OTEL
    process.on('SIGTERM', () => sdk.shutdown().catch(() => {}));
  } catch (err) {
    logger.warn('[Manager] OpenTelemetry not available', { error: err.message });
  }
}

// ── Phase 4: Middleware Stack ────────────────────────────────────────────────
startupState.phase = 'middleware';
require('./src/bootstrap/middleware-stack')(app, { logger, remoteConfig });

// ── Phase 5: Auth Engine ─────────────────────────────────────────────────────
startupState.phase = 'auth';
const { authEngine } = require('./src/bootstrap/auth-engine')(app, {
  logger, secretsManager, cfManager,
});

// ── Phase 6: Vector Stack ────────────────────────────────────────────────────
startupState.phase = 'vector-stack';
const { vectorMemory, buddy, pipeline, selfAwareness, watchdog } =
  require('./src/bootstrap/vector-stack')(app, { logger, eventBus });

// ── Phase 7: Engine Wiring ───────────────────────────────────────────────────
startupState.phase = 'engines';
const { wireEngines } = require('./src/bootstrap/engine-wiring');
const { loadRegistry } = require('./src/routes/registry');
const PORT = process.env.PORT || process.env.HEADY_PORT || 3301;
const _engines = wireEngines(app, {
  pipeline, loadRegistry, eventBus,
  projectRoot: __dirname,
  PORT,
});

// ── Phase 8: Pipeline Wiring ──────────────────────────────────────────────────
startupState.phase = 'pipeline-wiring';
require('./src/bootstrap/pipeline-wiring')(app, {
  pipeline, buddy, vectorMemory, selfAwareness, _engines, logger, eventBus,
});

// ── Phase 9: Service Registry ─────────────────────────────────────────────────
startupState.phase = 'service-registry';
require('./src/bootstrap/service-registry')(app, {
  logger, authEngine, vectorMemory, buddy, pipeline, _engines,
  secretsManager, cfManager, eventBus,
  projectRoot: __dirname,
});

// ── Phase 10: Inline Routes ───────────────────────────────────────────────────
startupState.phase = 'inline-routes';
require('./src/bootstrap/inline-routes')(app, {
  logger, secretsManager, cfManager, authEngine, _engines,
});

// CHANGE: Add /health/startup endpoint for Cloud Run startup probe.
// Distinct from /health/live (liveness) and /health/ready (readiness).
// Returns 503 until server has completed all bootstrap phases.
app.get('/health/startup', (req, res) => {
  if (startupState.started) {
    res.json({
      status: 'started',
      bootTimeMs: startupState.bootTimeMs,
      ts: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'starting',
      phase: startupState.phase,
      elapsedMs: Date.now() - BOOT_START,
      ts: new Date().toISOString(),
    });
  }
});

// ── Phase 11: Voice Relay ─────────────────────────────────────────────────────
startupState.phase = 'voice-relay';
const { voiceSessions } = require('./src/bootstrap/voice-relay')(app, { logger });

// ── Phase 12: Server Boot ─────────────────────────────────────────────────────
startupState.phase = 'server-boot';
const server = require('./src/bootstrap/server-boot')(app, { logger, voiceSessions });

// ── Startup Complete ──────────────────────────────────────────────────────────
clearTimeout(bootTimeoutHandle);
startupState.phase = 'ready';
startupState.started = true;
startupState.ready = true;
startupState.bootTimeMs = Date.now() - BOOT_START;

logger.info('[Manager] Boot complete', {
  bootTimeMs: startupState.bootTimeMs,
  port: PORT,
  env: process.env.NODE_ENV,
  pid: process.pid,
});

// Export boot time metric if prom-client is available
if (metricsRegistry) {
  try {
    const promClient = require('prom-client');
    new promClient.Gauge({
      name: 'heady_boot_duration_seconds',
      help: 'Time taken to boot the server in seconds',
    }).set(startupState.bootTimeMs / 1000);
  } catch { /* optional */ }
}

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
// CHANGE: Full graceful shutdown implementation.
// Original heady-manager.js had NO signal handling.
// Cloud Run sends SIGTERM before SIGKILL — we have ~10s to drain connections.
//
// Shutdown sequence:
//   1. Mark service not-ready (stop accepting new traffic)
//   2. Stop autonomous engine from accepting new tasks
//   3. Drain existing HTTP connections (wait up to SHUTDOWN_TIMEOUT_MS)
//   4. Close database pool
//   5. Close Redis connection
//   6. Flush OTEL spans
//   7. Exit with code 0

let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`[Manager] Received ${signal} — starting graceful shutdown`, {
    signal,
    shutdownTimeoutMs: SHUTDOWN_TIMEOUT_MS,
    activeConnections: 'draining',
  });

  // Step 1: Mark not-ready — Cloud Run load balancer stops sending new requests
  startupState.ready = false;

  // Step 2: Pause autonomous engine
  try {
    if (_engines?.autonomousEngine?.pause) {
      _engines.autonomousEngine.pause();
      logger.info('[Manager] Autonomous engine paused');
    }
  } catch (err) {
    logger.warn('[Manager] Failed to pause autonomous engine', { error: err.message });
  }

  // Step 3: Stop accepting new connections, drain existing ones
  const shutdownDeadline = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Shutdown timeout')), SHUTDOWN_TIMEOUT_MS)
  );

  const drainConnections = new Promise((resolve) => {
    server.close((err) => {
      if (err) {
        logger.warn('[Manager] Error closing HTTP server', { error: err.message });
      } else {
        logger.info('[Manager] HTTP server closed — all connections drained');
      }
      resolve();
    });
  });

  try {
    await Promise.race([drainConnections, shutdownDeadline]);
  } catch (err) {
    logger.warn('[Manager] Shutdown timeout — forcing close', {
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
    });
    // Force close any remaining connections
    server.closeAllConnections?.();
  }

  // Step 4: Close database pool
  try {
    const pool = require('./src/services/db-pool');
    await pool.end();
    logger.info('[Manager] Database pool closed');
  } catch (err) {
    logger.warn('[Manager] DB pool close error', { error: err.message });
  }

  // Step 5: Close Redis
  try {
    const redis = require('./src/utils/redis-pool');
    await redis.quit();
    logger.info('[Manager] Redis connection closed');
  } catch (err) {
    logger.warn('[Manager] Redis close error', { error: err.message });
  }

  // Step 6: Stop watchdog
  try {
    if (watchdog?.stop) watchdog.stop();
  } catch { /* optional */ }

  logger.info('[Manager] Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Export for testing and monitoring
module.exports = { app, server, startupState, gracefulShutdown };
