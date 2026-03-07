/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Edge Worker — Cloudflare Workers Proxy & Router
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Runs on Cloudflare's edge network (~300 PoPs worldwide).
 * Routes requests from 9+ Heady domains to the Cloud Run origin,
 * handles edge caching, security headers, rate limiting, and health checks.
 *
 * Domains served:
 *   headyme.com, headysystems.com, headyconnection.org, headybuddy.org,
 *   headymcp.com, headyio.com, headybot.com, headyapi.com, heady-ai.com
 *
 * Deploy:
 *   wrangler deploy infra/cloudflare/heady-edge-worker.js --name heady-edge
 *
 * © 2026 HeadySystems Inc. — Proprietary
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ── Configuration ────────────────────────────────────────────────────────────

const CLOUD_RUN_ORIGIN = 'https://heady-manager-xxxxxxxxxx-uc.a.run.app';

const DOMAIN_ROUTES = {
  'headyme.com':           { service: 'heady-manager', pathPrefix: '/app' },
  'www.headyme.com':       { service: 'heady-manager', pathPrefix: '/app' },
  'headysystems.com':      { service: 'heady-manager', pathPrefix: '/systems' },
  'www.headysystems.com':  { service: 'heady-manager', pathPrefix: '/systems' },
  'headyconnection.org':   { service: 'heady-manager', pathPrefix: '/connection' },
  'headybuddy.org':        { service: 'heady-manager', pathPrefix: '/buddy' },
  'headymcp.com':          { service: 'heady-manager', pathPrefix: '/mcp' },
  'headyio.com':           { service: 'heady-manager', pathPrefix: '/io' },
  'headybot.com':          { service: 'heady-manager', pathPrefix: '/bot' },
  'headyapi.com':          { service: 'heady-manager', pathPrefix: '/api' },
  'heady-ai.com':           { service: 'heady-manager', pathPrefix: '/ai' },
};

// Rate limiting config (per IP, per minute)
const RATE_LIMIT = {
  maxRequests: 120,
  windowMs: 60_000,
};

// Cache TTLs (seconds)
const CACHE_TTL = {
  static: 86400,      // 24h for static assets
  api: 0,             // No caching for API
  health: 10,         // 10s for health checks
  page: 300,          // 5min for pages
};

// Security headers applied to every response
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Heady-Edge': 'cloudflare-worker',
  'X-Heady-Version': '3.1.0',
};

// ── Rate Limiter (in-memory, per-colo) ───────────────────────────────────────

const rateLimitMap = new Map();

function checkRateLimit(clientIP) {
  const now = Date.now();
  const key = clientIP;
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.windowStart > RATE_LIMIT.windowMs) {
    rateLimitMap.set(key, { windowStart: now, count: 1 });
    return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1 };
  }

  entry.count++;
  if (entry.count > RATE_LIMIT.maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: RATE_LIMIT.maxRequests - entry.count };
}

// Periodic cleanup of stale rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT.windowMs * 2) {
      rateLimitMap.delete(key);
    }
  }
}, 60_000);

// ── CORS Handler ─────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = new Set([
  'https://headyme.com',
  'https://www.headyme.com',
  'https://headysystems.com',
  'https://headyconnection.org',
  'https://headybuddy.org',
  'https://headymcp.com',
  'https://headyio.com',
  'https://headybot.com',
  'https://headyapi.com',
  'https://heady-ai.com',
]);

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  const headers = {};

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Heady-Token, X-Request-ID';
    headers['Access-Control-Max-Age'] = '86400';
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

// ── Request Handler ──────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();
    const url = new URL(request.url);
    const hostname = url.hostname;
    const pathname = url.pathname;
    const method = request.method;
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const requestId = crypto.randomUUID();

    // ── CORS Preflight ─────────────────────────────────────────────────
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...getCorsHeaders(request),
          ...SECURITY_HEADERS,
        },
      });
    }

    // ── Rate Limiting ──────────────────────────────────────────────────
    const rateCheck = checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(RATE_LIMIT.windowMs / 1000),
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(RATE_LIMIT.windowMs / 1000)),
          'X-RateLimit-Limit': String(RATE_LIMIT.maxRequests),
          'X-RateLimit-Remaining': '0',
          ...SECURITY_HEADERS,
        },
      });
    }

    // ── Edge Health Check (no origin roundtrip) ────────────────────────
    if (pathname === '/health/edge' || pathname === '/__health') {
      return new Response(JSON.stringify({
        status: 'ok',
        edge: 'cloudflare',
        colo: request.cf?.colo || 'unknown',
        hostname,
        timestamp: new Date().toISOString(),
        version: '3.1.0',
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${CACHE_TTL.health}`,
          ...SECURITY_HEADERS,
        },
      });
    }

    // ── Resolve domain route ───────────────────────────────────────────
    const route = DOMAIN_ROUTES[hostname];
    if (!route) {
      return new Response(JSON.stringify({
        error: 'Unknown domain',
        hostname,
        supported: Object.keys(DOMAIN_ROUTES),
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS },
      });
    }

    // ── Build origin URL ───────────────────────────────────────────────
    const originUrl = new URL(CLOUD_RUN_ORIGIN);
    originUrl.pathname = pathname;
    originUrl.search = url.search;

    // ── Forward request to Cloud Run origin ────────────────────────────
    const originRequest = new Request(originUrl.toString(), {
      method: request.method,
      headers: new Headers(request.headers),
      body: ['GET', 'HEAD'].includes(method) ? undefined : request.body,
      redirect: 'follow',
    });

    // Inject routing headers for the origin
    originRequest.headers.set('X-Forwarded-Host', hostname);
    originRequest.headers.set('X-Forwarded-Proto', 'https');
    originRequest.headers.set('X-Heady-Domain', hostname);
    originRequest.headers.set('X-Heady-Route', route.pathPrefix);
    originRequest.headers.set('X-Heady-Edge-Colo', request.cf?.colo || 'unknown');
    originRequest.headers.set('X-Request-ID', requestId);
    originRequest.headers.set('X-Real-IP', clientIP);

    // ── Cache Strategy ─────────────────────────────────────────────────
    let cacheTtl = CACHE_TTL.api;
    if (pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/)) {
      cacheTtl = CACHE_TTL.static;
    } else if (pathname.startsWith('/health')) {
      cacheTtl = CACHE_TTL.health;
    } else if (method === 'GET' && !pathname.startsWith('/api/')) {
      cacheTtl = CACHE_TTL.page;
    }

    try {
      // Use Cloudflare cache API for GET requests with cacheTtl > 0
      let response;
      if (method === 'GET' && cacheTtl > 0) {
        response = await fetch(originRequest, {
          cf: {
            cacheTtl,
            cacheEverything: true,
            cacheKey: `${hostname}:${pathname}${url.search}`,
          },
        });
      } else {
        response = await fetch(originRequest);
      }

      // ── Augment response headers ───────────────────────────────────
      const newResponse = new Response(response.body, response);
      const elapsed = Date.now() - startTime;

      // Security headers
      for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        newResponse.headers.set(key, value);
      }

      // CORS headers
      for (const [key, value] of Object.entries(getCorsHeaders(request))) {
        newResponse.headers.set(key, value);
      }

      // Telemetry headers
      newResponse.headers.set('X-Request-ID', requestId);
      newResponse.headers.set('X-Response-Time', `${elapsed}ms`);
      newResponse.headers.set('X-RateLimit-Remaining', String(rateCheck.remaining));

      // Cache status header
      if (cacheTtl > 0) {
        newResponse.headers.set('X-Cache-TTL', String(cacheTtl));
      }

      return newResponse;

    } catch (error) {
      // ── Origin failure — return edge error page ────────────────────
      console.error(`Origin error for ${hostname}${pathname}: ${error.message}`);

      return new Response(JSON.stringify({
        error: 'Origin unavailable',
        message: 'The Heady platform is temporarily unavailable. Please retry.',
        hostname,
        requestId,
        timestamp: new Date().toISOString(),
      }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '30',
          ...SECURITY_HEADERS,
        },
      });
    }
  },
};
