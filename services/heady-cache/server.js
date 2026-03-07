'use strict';

/**
 * HeadyCache Express Server Entry Point
 *
 * Starts the HeadyCache HTTP service with:
 *   - helmet (security headers)
 *   - cors (cross-origin)
 *   - compression (gzip)
 *   - JSON body parsing
 *   - Structured request logging
 *   - Graceful shutdown
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

const config = require('./config');
const { HeadyCache } = require('./index');
const { createRouter } = require('./routes');
const { healthCheck } = require('./health');

// ---------------------------------------------------------------------------
// Initialize cache
// ---------------------------------------------------------------------------

const cache = new HeadyCache();

// ---------------------------------------------------------------------------
// Build Express app
// ---------------------------------------------------------------------------

const app = express();

// Security & middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: duration,
        })
      );
    }
  });
  next();
});

// Mount cache routes
app.use('/', createRouter(cache));

// Override the /health route with the full health check
app.get('/health/detailed', async (req, res) => {
  try {
    const result = await healthCheck(cache);
    const status = result.status === 'ok' ? 200 : 503;
    res.status(status).json(result);
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// Error handler
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[heady-cache] unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function start() {
  try {
    await cache.init();
    console.log(`[heady-cache] cache initialized (backend=${config.backend})`);

    const server = app.listen(config.port, '0.0.0.0', () => {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          service: 'heady-cache',
          event: 'started',
          port: config.port,
          backend: config.backend,
          maxSize: config.maxSize,
          ttl: config.ttl,
          similarityThreshold: config.similarityThreshold,
          evictionPolicy: config.evictionPolicy,
        })
      );
    });

    // ---------------------------------------------------------------------------
    // Graceful shutdown
    // ---------------------------------------------------------------------------

    const shutdown = async (signal) => {
      console.log(`[heady-cache] received ${signal}, shutting down...`);
      server.close(async () => {
        try {
          await cache.close();
          console.log('[heady-cache] shutdown complete');
          process.exit(0);
        } catch (err) {
          console.error('[heady-cache] shutdown error:', err);
          process.exit(1);
        }
      });
      // Force exit if graceful shutdown takes too long
      setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      console.error('[heady-cache] unhandledRejection:', reason);
    });

    process.on('uncaughtException', (err) => {
      console.error('[heady-cache] uncaughtException:', err);
      process.exit(1);
    });

    return server;
  } catch (err) {
    console.error('[heady-cache] startup error:', err);
    process.exit(1);
  }
}

// Only start if called directly
if (require.main === module) {
  start();
}

module.exports = { app, cache, start };
