/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */

/**
 * Heady™ Dashboard Server
 * Serves the dashboard SPA and proxies /api/* to the projection service.
 *
 * Environment variables:
 *   DASHBOARD_PORT     — HTTP port for this server     (default 3850)
 *   PROJECTION_SERVICE — Upstream projection service   (default http://localhost:3849)
 */

import express from 'express';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PHI              = 1.6180339887;
const PORT             = Number(process.env.DASHBOARD_PORT) || 3850;
const PROJECTION_HOST  = process.env.PROJECTION_SERVICE || 'http://localhost:3849';
const INDEX_HTML       = join(__dirname, 'index.html');

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();

// ── Static: serve index.html ──────────────────────────────────────────────────
app.get('/', (_req, res) => {
  if (!existsSync(INDEX_HTML)) {
    return res.status(404).send('Dashboard index.html not found.');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(readFileSync(INDEX_HTML));
});

// ── Proxy: /api/* → projection service ───────────────────────────────────────
app.use('/api', (req, res) => {
  const targetUrl = `${PROJECTION_HOST}${req.url}`;

  const isSSE = req.headers.accept?.includes('text/event-stream');
  const isHttps = PROJECTION_HOST.startsWith('https://');
  const transport = isHttps ? https : http;

  const upstreamUrl = new URL(targetUrl);

  const options = {
    hostname: upstreamUrl.hostname,
    port:     upstreamUrl.port || (isHttps ? 443 : 80),
    path:     upstreamUrl.pathname + (upstreamUrl.search || ''),
    method:   req.method,
    headers: {
      ...req.headers,
      host: upstreamUrl.host,
      'x-forwarded-for': req.socket.remoteAddress,
      'x-forwarded-host': req.headers.host,
      'x-forwarded-proto': 'http',
    },
  };

  const proxyReq = transport.request(options, (proxyRes) => {
    // Copy status + headers
    res.writeHead(proxyRes.statusCode, proxyRes.headers);

    if (isSSE) {
      // Flush headers immediately for SSE
      res.flushHeaders?.();
      proxyRes.on('data', (chunk) => res.write(chunk));
      proxyRes.on('end', () => res.end());
    } else {
      proxyRes.pipe(res);
    }
  });

  proxyReq.on('error', (e) => {
    console.error(`[Dashboard] Proxy error → ${targetUrl}: ${e.message}`);
    if (!res.headersSent) {
      res.status(502).json({
        error:   'Bad Gateway',
        message: `Projection service unavailable at ${PROJECTION_HOST}`,
        phi:     PHI,
      });
    }
  });

  // Forward request body
  req.pipe(proxyReq);

  // Handle client disconnect
  req.on('close', () => proxyReq.destroy());
});

// ── Health check for the dashboard server itself ───────────────────────────────
app.get('/_health', (_req, res) => {
  res.json({
    service:     'heady-dashboard',
    status:      'ok',
    phi:         PHI,
    upstream:    PROJECTION_HOST,
    ts:          Date.now(),
  });
});

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const server = createServer(app);
server.listen(PORT, () => {
  console.log(`[Heady Dashboard] ▶  http://localhost:${PORT}`);
  console.log(`[Heady Dashboard] ◎  Proxying /api/* → ${PROJECTION_HOST}`);
  console.log(`[Heady Dashboard] φ  PHI = ${PHI}`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n[Dashboard] ${signal} received — shutting down…`);
  server.close(() => {
    console.log('[Dashboard] HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), Math.round(PHI * 3000));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

export default app;
