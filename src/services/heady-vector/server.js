'use strict';

/**
 * HeadyVector Server Entry Point
 * Boots Express + HeadyVector service.
 * CommonJS, Node.js 20+.
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

const config = require('./config');
const { getInstance } = require('./index');
const { createRouter } = require('./routes');

async function main() {
  // ── Initialize HeadyVector ─────────────────────────────────────────────────
  const hv = getInstance();
  await hv.start();

  // ── Express setup ──────────────────────────────────────────────────────────
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: false, // API service, not serving HTML
  }));
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
  }));
  app.use(compression());
  app.use(express.json({ limit: '50mb' })); // Large batch upserts
  app.use(express.urlencoded({ extended: true }));

  // Request logging (lightweight)
  if (config.nodeEnv !== 'test') {
    app.use((req, _res, next) => {
      if (req.path !== '/health/live' && req.path !== '/health/ready') {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      }
      next();
    });
  }

  // ── Mount router ───────────────────────────────────────────────────────────
  app.use('/', createRouter(hv));

  // ── Start server ───────────────────────────────────────────────────────────
  const server = app.listen(config.port, config.host, () => {
    console.log(`[heady-vector] Listening on http://${config.host}:${config.port}`);
    console.log(`[heady-vector] PHI=${config.phi} | Node ${process.version}`);
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal) => {
    console.log(`[heady-vector] Received ${signal}, shutting down...`);
    server.close(async () => {
      await hv.stop();
      console.log('[heady-vector] Bye.');
      process.exit(0);
    });
    // Force exit after 10s
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    console.error('[heady-vector] Unhandled rejection:', reason);
  });

  return { app, server, hv };
}

main().catch((err) => {
  console.error('[heady-vector] Fatal startup error:', err);
  process.exit(1);
});

module.exports = { main };
