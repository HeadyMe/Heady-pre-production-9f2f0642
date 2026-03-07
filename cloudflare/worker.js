/**
 * =============================================================================
 * Heady Edge Router — Cloudflare Worker
 * =============================================================================
 * Routes all 9 Heady domains to the single Cloud Run origin, adding:
 *  - Path-prefix routing per domain
 *  - Comprehensive security headers (HSTS, CSP, X-Frame-Options, etc.)
 *  - Edge-level rate limiting via Cloudflare KV
 *  - Cache strategy: static assets 1 year, API responses honor Cache-Control
 *  - Bot protection
 *  - WebSocket upgrade passthrough for real-time features
 *  - Optional geographic routing / geo-block
 *
 * Domain → path mapping:
 *  headyme.com            → /app
 *  headysystems.com       → /systems
 *  headyconnection.org    → /connection
 *  headybuddy.org         → /buddy
 *  headymcp.com           → /mcp
 *  headyio.com            → /io
 *  headybot.com           → /bot
 *  headyapi.com           → /api
 *  heady-ai.com            → /ai
 *
 * Environment variables (set in wrangler.toml or Cloudflare dashboard):
 *  CLOUD_RUN_ORIGIN    — Full Cloud Run service URL (https://heady-production-uc.a.run.app)
 *  RATE_LIMIT_WINDOW   — Rate limit window in seconds (default: 60)
 *  RATE_LIMIT_MAX      — Max requests per window per IP (default: 100)
 *  BLOCKED_COUNTRIES   — Comma-separated ISO country codes to block (e.g., "XX,YY")
 *  MAINTENANCE_MODE    — Set to "1" to serve a maintenance page for all requests
 * =============================================================================
 */

'use strict';

// =============================================================================
// Domain → Cloud Run path prefix mapping
// =============================================================================
const DOMAIN_ROUTES = new Map([
  ['headyme.com',         '/app'],
  ['www.headyme.com',     '/app'],
  ['headysystems.com',    '/systems'],
  ['www.headysystems.com','/systems'],
  ['headyconnection.org', '/connection'],
  ['www.headyconnection.org', '/connection'],
  ['headybuddy.org',      '/buddy'],
  ['www.headybuddy.org',  '/buddy'],
  ['headymcp.com',        '/mcp'],
  ['www.headymcp.com',    '/mcp'],
  ['headyio.com',         '/io'],
  ['www.headyio.com',     '/io'],
  ['headybot.com',        '/bot'],
  ['www.headybot.com',    '/bot'],
  ['headyapi.com',        '/api'],
  ['www.headyapi.com',    '/api'],
  ['heady-ai.com',         '/ai'],
  ['www.heady-ai.com',     '/ai'],
]);

// =============================================================================
// Static asset patterns — cache for 1 year
// =============================================================================
const STATIC_ASSET_PATTERN = /\.(js|jsx|ts|tsx|css|scss|woff|woff2|ttf|eot|otf|png|jpg|jpeg|gif|svg|ico|webp|avif|mp4|webm|ogg|mp3|pdf|zip)(\?.*)?$/i;

// API path patterns — respect Cache-Control from origin, no default caching
const API_PATH_PATTERN = /^\/api\//i;

// Health check paths — never cache
const HEALTH_PATH_PATTERN = /^\/(health|metrics|ready|live)/i;

// WebSocket upgrade paths
const WEBSOCKET_PATH_PATTERN = /^\/(ws|socket|realtime|live|events)/i;

// =============================================================================
// Bot signatures to block (extended list)
// =============================================================================
const BAD_BOT_PATTERNS = [
  /sqlmap/i, /nikto/i, /masscan/i, /nmap/i, /zgrab/i,
  /python-requests/i, /go-http-client/i, /curl\/[0-4]\./i,
  /libwww-perl/i, /scrapy/i, /crawl/i, /harvest/i, /extract/i,
  /spam/i, /ahrefsbot/i, /semrushbot/i, /dotbot/i,
];

// Allowed good bots (search engines, monitoring)
const ALLOWED_BOT_PATTERNS = [
  /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i,
  /baiduspider/i, /yandexbot/i, /facebot/i, /twitterbot/i,
  /linkedinbot/i, /pingdom/i, /uptimerobot/i, /datadoghq/i,
];

// =============================================================================
// Security headers
// =============================================================================
const SECURITY_HEADERS = {
  // HSTS — 2 years, include subdomains, preload
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',

  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Clickjacking protection
  'X-Frame-Options': 'SAMEORIGIN',

  // XSS filter (legacy but harmless)
  'X-XSS-Protection': '1; mode=block',

  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions policy — lock down browser APIs
  'Permissions-Policy': [
    'accelerometer=()',
    'ambient-light-sensor=()',
    'autoplay=(self)',
    'battery=()',
    'camera=(self)',
    'display-capture=(self)',
    'document-domain=()',
    'encrypted-media=(self)',
    'fullscreen=(self)',
    'geolocation=(self)',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=(self)',
    'midi=()',
    'payment=(self)',
    'picture-in-picture=()',
    'screen-wake-lock=()',
    'sync-xhr=()',
    'usb=()',
    'web-share=()',
  ].join(', '),

  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob:",
    "connect-src 'self' wss: https:",
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; '),
};

// =============================================================================
// Main Worker handler
// =============================================================================
export default {
  /**
   * Main fetch handler — entry point for all requests.
   * @param {Request} request
   * @param {object}  env      — Worker bindings (KV, secrets, env vars)
   * @param {object}  ctx      — Execution context (waitUntil)
   */
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env, ctx);
    } catch (err) {
      console.error('[HeadyEdgeRouter] Unhandled error:', err.message);
      return errorResponse(500, 'Internal edge router error');
    }
  },
};

// =============================================================================
// Core request handler
// =============================================================================
async function handleRequest(request, env, ctx) {
  const url      = new URL(request.url);
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname;
  const method   = request.method.toUpperCase();

  // ── Maintenance mode ──────────────────────────────────────────────────────
  if (env.MAINTENANCE_MODE === '1') {
    return maintenancePage();
  }

  // ── CORS preflight shortcut ───────────────────────────────────────────────
  if (method === 'OPTIONS') {
    return handleCors(request, env);
  }

  // ── Bot protection ────────────────────────────────────────────────────────
  const botCheck = checkBotProtection(request);
  if (botCheck.blocked) {
    return errorResponse(403, 'Access denied');
  }

  // ── Geographic routing ────────────────────────────────────────────────────
  const geoBlock = checkGeographicBlock(request, env);
  if (geoBlock.blocked) {
    return errorResponse(451, 'Service unavailable in your region');
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────
  if (env.RATE_LIMIT_KV) {
    const limited = await checkRateLimit(request, env, ctx);
    if (limited) {
      return rateLimitResponse();
    }
  }

  // ── Domain routing ────────────────────────────────────────────────────────
  const pathPrefix = DOMAIN_ROUTES.get(hostname);
  if (!pathPrefix) {
    // Unknown domain — return 404
    return errorResponse(404, `Unknown Heady domain: ${hostname}`);
  }

  // ── WebSocket upgrade passthrough ─────────────────────────────────────────
  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader === 'websocket' || WEBSOCKET_PATH_PATTERN.test(pathname)) {
    return handleWebSocket(request, env, pathPrefix, pathname);
  }

  // ── Route request to Cloud Run ────────────────────────────────────────────
  const origin = env.CLOUD_RUN_ORIGIN || 'https://heady-production-uc.a.run.app';

  // Rewrite path: /<domain-prefix><original-path>
  // e.g. headyme.com/dashboard → /app/dashboard
  const rewrittenPath = pathPrefix + (pathname === '/' ? '' : pathname) + url.search;
  const originUrl     = origin + rewrittenPath;

  // Forward request to origin
  const originRequest = new Request(originUrl, {
    method:  request.method,
    headers: buildOriginHeaders(request, hostname),
    body:    ['GET', 'HEAD'].includes(method) ? null : request.body,
    redirect: 'follow',
  });

  // ── Cache strategy ────────────────────────────────────────────────────────
  const cacheKey = new Request(originUrl, originRequest);

  // Never cache health, auth, or POST/PUT/DELETE
  const isCacheable = ['GET', 'HEAD'].includes(method)
    && !HEALTH_PATH_PATTERN.test(pathname)
    && !pathname.includes('/auth/')
    && !pathname.includes('/session');

  if (isCacheable) {
    const cache = caches.default;

    // Try cache hit
    const cached = await cache.match(cacheKey);
    if (cached) {
      const response = new Response(cached.body, cached);
      response.headers.set('X-Cache', 'HIT');
      addSecurityHeaders(response.headers);
      return response;
    }
  }

  // ── Fetch from origin ─────────────────────────────────────────────────────
  let originResponse;
  try {
    originResponse = await fetch(originRequest, {
      cf: {
        // Cloudflare-specific options
        cacheTtl: 0,                  // Let our cache logic handle TTL
        cacheEverything: false,       // We manage caching manually
        resolveOverride: undefined,   // Use normal DNS resolution
      },
    });
  } catch (err) {
    console.error('[HeadyEdgeRouter] Origin fetch failed:', err.message);
    return originDownPage();
  }

  // ── Build response ────────────────────────────────────────────────────────
  const responseHeaders = new Headers(originResponse.headers);
  addSecurityHeaders(responseHeaders);
  responseHeaders.set('X-Cache', 'MISS');
  responseHeaders.set('X-Heady-Domain', hostname);
  responseHeaders.set('X-Heady-Prefix', pathPrefix);

  const response = new Response(originResponse.body, {
    status:     originResponse.status,
    statusText: originResponse.statusText,
    headers:    responseHeaders,
  });

  // ── Cache storage ─────────────────────────────────────────────────────────
  if (isCacheable && originResponse.ok) {
    const cacheTtl = getCacheTtl(pathname, originResponse);

    if (cacheTtl > 0) {
      const responseToCache = new Response(response.clone().body, response);
      responseToCache.headers.set('Cache-Control', `public, max-age=${cacheTtl}, immutable`);

      ctx.waitUntil(
        caches.default.put(cacheKey, responseToCache).catch(err =>
          console.error('[HeadyEdgeRouter] Cache put failed:', err.message)
        )
      );
    }
  }

  return response;
}

// =============================================================================
// WebSocket passthrough
// =============================================================================
async function handleWebSocket(request, env, pathPrefix, pathname) {
  const origin      = env.CLOUD_RUN_ORIGIN || 'https://heady-production-uc.a.run.app';
  const wsOrigin    = origin.replace(/^https?:\/\//, 'wss://');
  const url         = new URL(request.url);
  const rewritten   = wsOrigin + pathPrefix + pathname + url.search;

  // Use Cloudflare's WebSocket API to proxy the upgrade
  const [client, server] = Object.values(new WebSocketPair());

  // Accept the client WebSocket
  server.accept();

  // Connect to the origin WebSocket
  const originWs = await fetch(rewritten, {
    headers: buildOriginHeaders(request, url.hostname),
    cf: { resolveOverride: undefined },
  }).catch(err => {
    console.error('[HeadyEdgeRouter] WebSocket origin failed:', err.message);
    return null;
  });

  if (!originWs || originWs.status !== 101) {
    server.close(1011, 'Origin WebSocket connection failed');
    return new Response(null, { status: 101, webSocket: client });
  }

  // Pipe messages between client and origin
  const originSocket = originWs.webSocket;
  originSocket.accept();

  server.addEventListener('message', e => originSocket.send(e.data));
  originSocket.addEventListener('message', e => server.send(e.data));
  server.addEventListener('close', () => originSocket.close());
  originSocket.addEventListener('close', () => server.close());

  return new Response(null, { status: 101, webSocket: client });
}

// =============================================================================
// CORS handler
// =============================================================================
function handleCors(request, env) {
  const origin = request.headers.get('Origin') || '';
  const isHeadyDomain = [...DOMAIN_ROUTES.keys()].some(d => origin.includes(d));

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':      isHeadyDomain ? origin : 'https://headyme.com',
      'Access-Control-Allow-Methods':     'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers':     'Content-Type, Authorization, X-Requested-With, X-Heady-Client',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age':           '86400',
      'Vary': 'Origin',
    },
  });
}

// =============================================================================
// Rate limiting (Cloudflare KV-backed)
// =============================================================================
async function checkRateLimit(request, env, ctx) {
  const ip      = request.headers.get('CF-Connecting-IP') || 'unknown';
  const window  = parseInt(env.RATE_LIMIT_WINDOW || '60');
  const max     = parseInt(env.RATE_LIMIT_MAX    || '100');
  const now     = Math.floor(Date.now() / 1000);
  const bucket  = Math.floor(now / window);
  const key     = `rl:${ip}:${bucket}`;

  try {
    const currentRaw = await env.RATE_LIMIT_KV.get(key);
    const current    = currentRaw ? parseInt(currentRaw) : 0;

    if (current >= max) {
      return true;   // Rate limited
    }

    // Increment counter asynchronously
    ctx.waitUntil(
      env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: window * 2 })
        .catch(() => {})
    );

    return false;
  } catch (err) {
    // On KV error, allow the request through
    console.error('[HeadyEdgeRouter] Rate limit KV error:', err.message);
    return false;
  }
}

// =============================================================================
// Bot protection
// =============================================================================
function checkBotProtection(request) {
  const ua = request.headers.get('User-Agent') || '';

  // Allow known good bots first
  if (ALLOWED_BOT_PATTERNS.some(p => p.test(ua))) {
    return { blocked: false };
  }

  // Block known bad bots
  if (BAD_BOT_PATTERNS.some(p => p.test(ua))) {
    return { blocked: true, reason: 'bad-bot' };
  }

  // Block empty user agents (likely automated)
  if (!ua || ua.trim() === '') {
    return { blocked: true, reason: 'empty-ua' };
  }

  return { blocked: false };
}

// =============================================================================
// Geographic blocking
// =============================================================================
function checkGeographicBlock(request, env) {
  const blocked = env.BLOCKED_COUNTRIES;
  if (!blocked) return { blocked: false };

  const country = request.headers.get('CF-IPCountry') || '';
  const blockedList = blocked.split(',').map(c => c.trim().toUpperCase());

  if (blockedList.includes(country.toUpperCase())) {
    return { blocked: true, country };
  }

  return { blocked: false };
}

// =============================================================================
// Cache TTL determination
// =============================================================================
function getCacheTtl(pathname, response) {
  // Origin already set a cache directive — respect it
  const cc = response.headers.get('Cache-Control') || '';
  if (cc.includes('no-store') || cc.includes('no-cache') || cc.includes('private')) {
    return 0;
  }

  // Static assets — 1 year (immutable)
  if (STATIC_ASSET_PATTERN.test(pathname)) {
    return 31_536_000;   // 365 days
  }

  // API paths — never cache at edge beyond origin's directive
  if (API_PATH_PATTERN.test(pathname)) {
    const match = cc.match(/max-age=(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  // HTML pages — 5 minutes
  return 300;
}

// =============================================================================
// Origin request headers
// =============================================================================
function buildOriginHeaders(request, hostname) {
  const headers = new Headers(request.headers);

  // Add forwarding headers
  headers.set('X-Forwarded-Host',  hostname);
  headers.set('X-Forwarded-Proto', 'https');
  headers.set('X-Real-IP',         request.headers.get('CF-Connecting-IP') || '');
  headers.set('X-Heady-Domain',    hostname);
  headers.set('X-Heady-Ray',       request.headers.get('CF-Ray') || '');

  // Country and region for geo-aware routing in the app
  headers.set('X-Heady-Country',   request.headers.get('CF-IPCountry') || '');
  headers.set('X-Heady-Region',    request.cf?.region || '');
  headers.set('X-Heady-City',      request.cf?.city   || '');

  // Remove hop-by-hop headers that shouldn't be forwarded
  headers.delete('CF-Connecting-IP');
  headers.delete('CF-Ray');
  headers.delete('CF-Visitor');
  headers.delete('CF-Worker');

  return headers;
}

// =============================================================================
// Security headers injection
// =============================================================================
function addSecurityHeaders(headers) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
}

// =============================================================================
// Special responses
// =============================================================================

function errorResponse(status, message) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  addSecurityHeaders(headers);
  return new Response(JSON.stringify({ error: message, status }), { status, headers });
}

function rateLimitResponse() {
  const headers = new Headers({
    'Content-Type':  'application/json',
    'Retry-After':   '60',
    'X-RateLimit-Limit': String(100),
  });
  addSecurityHeaders(headers);
  return new Response(
    JSON.stringify({ error: 'Too many requests', status: 429, retryAfter: 60 }),
    { status: 429, headers }
  );
}

function maintenancePage() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Heady — Maintenance</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0a0a0f; color: #e0e0f0;
           display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { text-align: center; padding: 3rem; max-width: 480px; }
    h1 { font-size: 2rem; margin-bottom: 1rem; color: #7c3aed; }
    p { color: #a0a0c0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Heady</h1>
    <p>We're performing scheduled maintenance. The platform will be back shortly.</p>
    <p style="margin-top: 2rem; font-size: 0.85rem; opacity: 0.6;">
      Sovereign AI — temporarily offline
    </p>
  </div>
</body>
</html>`;

  return new Response(html, {
    status:  503,
    headers: {
      'Content-Type':  'text/html; charset=utf-8',
      'Retry-After':   '300',
      'Cache-Control': 'no-store',
    },
  });
}

function originDownPage() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Heady — Service Unavailable</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0a0a0f; color: #e0e0f0;
           display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { text-align: center; padding: 3rem; max-width: 480px; }
    h1 { font-size: 2rem; margin-bottom: 1rem; color: #dc2626; }
    p { color: #a0a0c0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>503</h1>
    <p>The Heady platform is temporarily unreachable. Self-healing is in progress.</p>
    <p style="margin-top: 2rem; font-size: 0.85rem; opacity: 0.6;">
      Please try again in a moment.
    </p>
  </div>
</body>
</html>`;

  return new Response(html, {
    status:  503,
    headers: {
      'Content-Type':  'text/html; charset=utf-8',
      'Retry-After':   '30',
      'Cache-Control': 'no-store',
    },
  });
}
