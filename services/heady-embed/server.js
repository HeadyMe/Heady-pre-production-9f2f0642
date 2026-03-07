'use strict';

/**
 * HeadyEmbed HTTP Server
 *
 * Production Express server that wraps the HeadyEmbed service.
 * Uses Heady platform conventions: helmet, cors, compression, JSON body parsing.
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const config = require('./config');
const { HeadyEmbed } = require('./index');
const { createRouter } = require('./routes');

// ---------------------------------------------------------------------------
// Logger (structured, lightweight — no external deps required)
// ---------------------------------------------------------------------------

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LOG_LEVELS[config.logLevel] ?? LOG_LEVELS.info;

const log = {
  error: (...a) => currentLevel >= 0 && console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: a.join(' ') })),
  warn:  (...a) => currentLevel >= 1 && console.warn(JSON.stringify({ ts: new Date().toISOString(),  level: 'warn',  msg: a.join(' ') })),
  info:  (...a) => currentLevel >= 2 && console.log(JSON.stringify({ ts: new Date().toISOString(),   level: 'info',  msg: a.join(' ') })),
  debug: (...a) => currentLevel >= 3 && console.log(JSON.stringify({ ts: new Date().toISOString(),   level: 'debug', msg: a.join(' ') })),
};

// ---------------------------------------------------------------------------
// App bootstrap
// ---------------------------------------------------------------------------

async function main() {
  const app = express();

  // ── Security & performance middleware ────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: false, // API service, no HTML
  }));

  app.use(cors({
    origin: process.env.HEADY_CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  }));

  app.use(compression());
  app.use(express.json({ limit: '10mb' }));

  // ── Request logging ──────────────────────────────────────────────────────
  app.use((req, res, next) => {
    const start = Date.now();
    const reqId = req.headers['x-request-id'] || crypto.randomUUID?.() || Date.now().toString(36);
    req.requestId = reqId;
    res.setHeader('X-Request-ID', reqId);
    res.setHeader('X-Powered-By', 'Heady/HeadyEmbed');

    res.on('finish', () => {
      log.info(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms [${reqId}]`);
    });
    next();
  });

  // ── Initialize HeadyEmbed service ────────────────────────────────────────
  const embedService = new HeadyEmbed();

  embedService.on('initializing',    () => log.info('HeadyEmbed initializing...'));
  embedService.on('ready',           (e) => log.info(`HeadyEmbed ready: model=${e.model} loadTime=${e.modelLoadTimeMs}ms`));
  embedService.on('model:loading',   (e) => log.info(`Loading model: ${e.modelId}`));
  embedService.on('model:loaded',    (e) => log.info(`Model loaded: ${e.modelId} in ${e.loadTimeMs}ms`));
  embedService.on('model:error',     (e) => log.error(`Model error: ${e.modelId}: ${e.error}`));
  embedService.on('warn',            (e) => log.warn(e.message));
  embedService.on('error',           (e) => log.error('HeadyEmbed error:', e.message));
  embedService.on('cacheWarmed',     (e) => log.info(`Cache warmed: ${e.loaded} entries`));
  embedService.on('warmup:complete', (e) => log.info(`Warm-up complete in ${e.durationMs}ms`));
  embedService.on('hotswap:complete',(e) => log.info(`Hot-swapped model: ${e.from} → ${e.to}`));

  try {
    await embedService.initialize();
  } catch (err) {
    log.error('Fatal: HeadyEmbed initialization failed:', err.message);
    process.exit(1);
  }

  // ── Mount routes ─────────────────────────────────────────────────────────
  const router = createRouter(embedService);
  app.use('/', router);

  // ── 404 handler ──────────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  });

  // ── Global error handler ─────────────────────────────────────────────────
  app.use((err, req, res, next) => {
    log.error('Unhandled error:', err.message);
    if (res.headersSent) return next(err);
    res.status(422).json({ error: err.message || 'Internal server error' });
  });

  // ── Start server ─────────────────────────────────────────────────────────
  const server = app.listen(config.port, config.host, () => {
    log.info(`HeadyEmbed listening on http://${config.host}:${config.port}`);
    log.info(`Default model: ${config.model}`);
    log.info(`Dimensions: ${config.dimensions}`);
    log.info(`Batch size: ${config.batchSize}`);
    log.info(`Cache size: ${config.cacheSize} entries`);
  });

  // ── Graceful shutdown ────────────────────────────────────────────────────
  let shuttingDown = false;

  async function gracefulShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;

    log.info(`Received ${signal}. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async () => {
      log.info('HTTP server closed');

      try {
        await embedService.shutdown();
        log.info('HeadyEmbed shutdown complete');
      } catch (err) {
        log.error('Shutdown error:', err.message);
      }

      process.exit(0);
    });

    // Force exit after 30s
    setTimeout(() => {
      log.error('Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 30000).unref();
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    log.error('Uncaught exception:', err.message, err.stack);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled rejection:', reason);
  });

  return { app, server, embedService };
}

// Helper for routes that need crypto.randomUUID polyfill
const crypto = require('crypto');
if (!global.crypto) {
  global.crypto = crypto;
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
