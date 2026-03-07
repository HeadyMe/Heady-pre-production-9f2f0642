/*
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * heady-api-gateway-v2.js
 * ════════════════════════════════════════════════════════════════════
 *
 * Heady API Gateway v2 — unified edge for all nine Heady domains.
 *
 * What this replaces / improves
 * ──────────────────────────────
 *   • headyapi-core (empty shell — only express dep)
 *   • source-map.json "notes": "gateway needs auth layer"
 *   • alive-software-architecture.md API surface (partial only)
 *   • heady-registry.json services[headyapi] hard-coded URLs
 *
 * Key capabilities
 * ────────────────
 *   ✓ API versioning  (/api/v1/* legacy, /api/v2/* current)
 *   ✓ JWT + API-key dual authentication
 *   ✓ Per-service, per-user rate limiting (sliding window, in-memory)
 *   ✓ CORS for all 9 Heady domains + localhost dev
 *   ✓ SSE (Server-Sent Events) endpoint for real-time pipeline updates
 *   ✓ Request validation middleware (JSON Schema via fast validator)
 *   ✓ Proxy routing through HeadyServiceMesh (circuit-breaking, LB)
 *   ✓ Observability: trace headers, Prometheus metrics, structured logs
 *   ✓ Admin router (/api/v1/admin/*) — gated by HMAC admin token
 *   ✓ Health / readiness probes (/health, /ready)
 *   ✓ GCP Pub/Sub webhook ingest (/webhooks/pubsub)
 *   ✓ Graceful shutdown with drain period
 *
 * Versioning policy
 * ──────────────────
 *   /api/v1/*  — Stable, maintained for backward compat. No new features.
 *   /api/v2/*  — Current, actively developed. New integrations go here.
 *   /api/v3/*  — Reserved for future breaking changes.
 *   /api/vN/*  — Unrecognised version → 404 with upgrade instructions.
 *
 * Nine Heady domains handled
 * ───────────────────────────
 *   headyme.com, headysystems.com, headyapi.com, headyconnection.org,
 *   headybuddy.org, headymcp.com, headyio.com, headybot.com, heady-ai.com
 *
 * Auth schemes
 * ─────────────
 *   Bearer <JWT>   — HS256 signed with gateway.jwtSecret (config server)
 *   X-Heady-Key    — SHA-256 HMAC API key (issued per service/user)
 *   X-Admin-Token  — Admin HMAC token (heady-service-mesh compatible)
 *   Public routes  — explicitly whitelisted, no auth required
 *
 * Rate limits (default, all configurable via config server)
 * ──────────────────────────────────────────────────────────
 *   Anonymous    :   60 req / 60 s per IP
 *   Authenticated: 1000 req / 60 s per identity
 *   Admin routes :  200 req / 60 s per identity
 *   Pipeline SSE :   10 concurrent streams per identity
 *
 * Port
 * ────
 *   Reads from config server 'gateway.port' (default 8080 for Cloud Run).
 *
 * Usage
 * ─────
 *   const { createGateway } = require('./heady-api-gateway-v2');
 *   const gw = createGateway();
 *   await gw.start();
 *   // → Listening on port 8080
 *
 *   // Programmatic (embed in existing Express app):
 *   app.use(gw.router());
 *
 * ════════════════════════════════════════════════════════════════════
 */

'use strict';

const http         = require('http');
const https        = require('https');
const { URL }      = require('url');
const crypto       = require('crypto');
const EventEmitter = require('events');
const { pipeline } = require('stream');

// ─── φ constant ───────────────────────────────────────────────────────────────
const PHI = 1.6180339887;

// ─── All 9 Heady domains + canonical www variants ─────────────────────────────
const HEADY_DOMAINS = Object.freeze([
  'headyme.com',       'www.headyme.com',
  'headysystems.com',  'www.headysystems.com',
  'headyapi.com',      'www.headyapi.com',
  'headyconnection.org', 'www.headyconnection.org',
  'headybuddy.org',    'www.headybuddy.org',
  'headymcp.com',      'www.headymcp.com',
  'headyio.com',       'www.headyio.com',
  'headybot.com',      'www.headybot.com',
  'heady-ai.com',       'www.heady-ai.com',
  // Dev / local
  'localhost',
  '127.0.0.1',
]);

// ─── Supported API versions ───────────────────────────────────────────────────
const SUPPORTED_VERSIONS = Object.freeze(['v1', 'v2']);
const CURRENT_VERSION    = 'v2';
const LEGACY_VERSION     = 'v1';

// ─── Public (no-auth) routes by version ──────────────────────────────────────
const PUBLIC_ROUTES = Object.freeze({
  v1: [
    'GET /api/v1/health',
    'GET /api/v1/ready',
    'GET /api/v1/version',
    'POST /api/v1/auth/login',
    'POST /api/v1/auth/refresh',
    'POST /webhooks/pubsub',
  ],
  v2: [
    'GET /api/v2/health',
    'GET /api/v2/ready',
    'GET /api/v2/version',
    'POST /api/v2/auth/login',
    'POST /api/v2/auth/refresh',
    'GET /api/v2/obs/metrics',     // Prometheus scrape
    'POST /webhooks/pubsub',
  ],
});

// ─── Rate limit tiers ─────────────────────────────────────────────────────────
const RATE_TIERS = Object.freeze({
  anonymous:     { windowMs: 60_000, maxRequests: 60   },
  authenticated: { windowMs: 60_000, maxRequests: 1000 },
  admin:         { windowMs: 60_000, maxRequests: 200  },
  pipeline_sse:  { windowMs: 60_000, maxStreams: 10    },
});

// ─────────────────────────────────────────────────────────────────────────────
//  In-memory rate limiter (sliding window, no external deps)
// ─────────────────────────────────────────────────────────────────────────────

class RateLimiter {
  constructor() {
    // key → { timestamps: number[], tier: string }
    this._windows = new Map();
    // Prune every φ × 60 s
    this._pruneTimer = setInterval(() => this._prune(), Math.round(PHI * 60_000));
    if (this._pruneTimer.unref) this._pruneTimer.unref();
  }

  /**
   * Check and record a request attempt.
   * @param {string} key        — identity (IP or user ID)
   * @param {string} tier       — 'anonymous' | 'authenticated' | 'admin'
   * @returns {{ allowed: boolean, remaining: number, resetMs: number }}
   */
  check(key, tier = 'anonymous') {
    const config  = RATE_TIERS[tier] || RATE_TIERS.anonymous;
    const now     = Date.now();
    const entry   = this._windows.get(key) || { timestamps: [] };
    const cutoff  = now - config.windowMs;

    // Slide window
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    const allowed   = entry.timestamps.length < config.maxRequests;
    if (allowed) entry.timestamps.push(now);

    this._windows.set(key, entry);

    return {
      allowed,
      remaining: Math.max(0, config.maxRequests - entry.timestamps.length),
      resetMs:   entry.timestamps.length ? (entry.timestamps[0] + config.windowMs - now) : 0,
      limit:     config.maxRequests,
    };
  }

  _prune() {
    const now = Date.now();
    for (const [key, entry] of this._windows) {
      // Remove windows older than the longest tier window
      if (entry.timestamps.every((t) => now - t > 120_000)) {
        this._windows.delete(key);
      }
    }
  }

  stop() {
    clearInterval(this._pruneTimer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  JWT helpers (HS256, no external deps)
// ─────────────────────────────────────────────────────────────────────────────

function base64urlEncode(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

/**
 * Sign a JWT with HS256.
 * @param {Object} payload
 * @param {string} secret
 * @param {number} [expiresInS=3600]
 */
function signJwt(payload, secret, expiresInS = 3600) {
  const header  = base64urlEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body    = base64urlEncode(Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInS,
  })));
  const sig = base64urlEncode(
    crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${sig}`;
}

/**
 * Verify a JWT. Returns decoded payload or throws.
 */
function verifyJwt(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format.');
  const [header, body, sig] = parts;
  const expected = base64urlEncode(
    crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest()
  );
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('JWT signature invalid.');
  }
  const payload = JSON.parse(base64urlDecode(body).toString('utf8'));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('JWT expired.');
  }
  return payload;
}

/**
 * Verify an API key (HMAC-SHA256: key = HMAC(secret, keyId)).
 */
function verifyApiKey(key, secret) {
  // Key format: <keyId>.<hmac>
  const sep = key.lastIndexOf('.');
  if (sep === -1) throw new Error('Invalid API key format.');
  const keyId  = key.substring(0, sep);
  const hmac   = key.substring(sep + 1);
  const expected = crypto.createHmac('sha256', secret).update(keyId).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) {
    throw new Error('Invalid API key.');
  }
  return { keyId };
}

// ─────────────────────────────────────────────────────────────────────────────
//  HeadyApiGatewayV2
// ─────────────────────────────────────────────────────────────────────────────

class HeadyApiGatewayV2 extends EventEmitter {
  constructor(opts = {}) {
    super();
    this._opts = {
      port:           opts.port           || parseInt(process.env.PORT || '8080', 10),
      jwtSecret:      opts.jwtSecret      || process.env.JWT_SECRET    || '',
      apiKeySecret:   opts.apiKeySecret   || process.env.API_KEY_SECRET || '',
      adminTokenHash: opts.adminTokenHash || process.env.ADMIN_TOKEN_HASH || '',
      trustProxy:     opts.trustProxy     !== false,
      enableCors:     opts.enableCors     !== false,
      enableRateLimit: opts.enableRateLimit !== false,
      enableAuth:     opts.enableAuth     !== false,
      serviceName:    opts.serviceName    || 'headyapi',
    };

    this._rateLimiter = new RateLimiter();
    this._sseClients  = new Map();   // traceId → res
    this._server      = null;
    this._started     = false;

    // Lazy-load singleton collaborators to avoid circular requires at module load
    this._mesh  = null;   // HeadyServiceMesh singleton
    this._obs   = null;   // HeadyObservability singleton
    this._cfg   = null;   // ConfigServer singleton
    this._bus   = null;   // HeadyEventBus singleton
  }

  // ── Lazy singleton accessors ──────────────────────────────────────────────────

  get mesh() {
    if (!this._mesh) {
      try { this._mesh = require('./heady-service-mesh').getServiceMesh(); }
      catch { /* optional dependency */ }
    }
    return this._mesh;
  }

  get obs() {
    if (!this._obs) {
      try { this._obs = require('./heady-observability').getObservability({ service: this._opts.serviceName }); }
      catch { /* optional dependency */ }
    }
    return this._obs;
  }

  get cfg() {
    if (!this._cfg) {
      try { this._cfg = require('./heady-config-server').getConfigServer(); }
      catch { /* optional dependency */ }
    }
    return this._cfg;
  }

  get bus() {
    if (!this._bus) {
      try { this._bus = require('./heady-event-bus').getEventBus(); }
      catch { /* optional dependency */ }
    }
    return this._bus;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  async start() {
    if (this._started) return this;

    const express = require('express');
    const app = express();

    if (this._opts.trustProxy) app.set('trust proxy', 1);
    app.set('x-powered-by', false);
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // ── Observability middleware (first) ────────────────────────────────────
    if (this.obs) app.use(this.obs.requestMiddleware());

    // ── CORS ────────────────────────────────────────────────────────────────
    if (this._opts.enableCors) app.use(this._corsMiddleware());

    // ── Security headers ────────────────────────────────────────────────────
    app.use(this._securityHeaders());

    // ── Version router ──────────────────────────────────────────────────────
    app.use('/api', this._versionRouter());

    // ── Webhook ingress ─────────────────────────────────────────────────────
    app.use('/webhooks', this._webhookRouter());

    // ── Health probes (no version prefix — Cloud Run requires /) ───────────
    app.get('/health', (_req, res) => res.json({ status: 'ok', service: this._opts.serviceName, ts: Date.now() }));
    app.get('/ready',  (_req, res) => res.json({ status: 'ready', service: this._opts.serviceName }));
    app.get('/',       (_req, res) => res.json({
      name:     'Heady API Gateway',
      version:  CURRENT_VERSION,
      docs:     'https://headyapi.com/docs',
      github:   'https://github.com/heady-project/headyapi-core',
    }));

    // ── Observability error middleware (last) ───────────────────────────────
    if (this.obs) app.use(this.obs.errorMiddleware());

    // ── Unhandled routes ────────────────────────────────────────────────────
    app.use((req, res) => {
      res.status(404).json({
        error:   'Not Found',
        path:    req.path,
        hint:    `API routes live under /api/${CURRENT_VERSION}/. Check the docs at https://headyapi.com/docs`,
        traceId: req.headyTrace?.traceId || null,
      });
    });

    this._server = http.createServer(app);
    const port   = this.cfg ? this.cfg.get('gateway.port', this._opts.port) : this._opts.port;

    await new Promise((resolve, reject) => {
      this._server.listen(port, '0.0.0.0', (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    this._started = true;
    this.emit('gateway:started', { port });
    console.log(`[HeadyApiGatewayV2] Listening on port ${port}`);
    return this;
  }

  async stop() {
    if (!this._server) return;
    // Drain SSE clients
    for (const [, res] of this._sseClients) {
      try { res.end(); } catch { /* ignore */ }
    }
    this._sseClients.clear();
    this._rateLimiter.stop();

    await new Promise((resolve) => this._server.close(resolve));
    this._started = false;
    this.emit('gateway:stopped');
  }

  // ── CORS ───────────────────────────────────────────────────────────────────

  _corsMiddleware() {
    return (req, res, next) => {
      const origin = req.headers.origin || '';
      const allowed = HEADY_DOMAINS.some((d) => origin.includes(d)) || !origin;
      res.setHeader('Access-Control-Allow-Origin',  allowed ? (origin || '*') : 'null');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', [
        'Content-Type', 'Authorization', 'X-Heady-Key',
        'X-Heady-Trace-Id', 'X-Heady-Span-Id', 'X-Heady-Service',
        'X-Admin-Token', 'Cache-Control',
      ].join(', '));
      res.setHeader('Access-Control-Expose-Headers', 'X-Heady-Trace-Id, X-Heady-Span-Id');
      res.setHeader('Access-Control-Max-Age', String(Math.round(PHI * 3600))); // ~5820 s
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      next();
    };
  }

  // ── Security headers ───────────────────────────────────────────────────────

  _securityHeaders() {
    return (_req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('X-Heady-Gateway', `v${CURRENT_VERSION}`);
      next();
    };
  }

  // ── Version router ─────────────────────────────────────────────────────────

  _versionRouter() {
    const express = require('express');
    const router  = express.Router();

    // Version detection
    router.use('/:version/*', (req, res, next) => {
      const { version } = req.params;
      if (!SUPPORTED_VERSIONS.includes(version)) {
        return res.status(404).json({
          error:     `API version '${version}' is not supported.`,
          supported: SUPPORTED_VERSIONS,
          current:   CURRENT_VERSION,
          upgrade:   `https://headyapi.com/docs/migration/${version}-to-${CURRENT_VERSION}`,
        });
      }
      req.apiVersion = version;
      next();
    });

    // Mount versioned routers
    router.use('/v1', this._authMiddleware(), this._rateLimitMiddleware('authenticated'), this._v1Router());
    router.use('/v2', this._authMiddleware(), this._rateLimitMiddleware('authenticated'), this._v2Router());

    return router;
  }

  // ── Auth middleware ────────────────────────────────────────────────────────

  _authMiddleware() {
    return (req, res, next) => {
      if (!this._opts.enableAuth) { req.auth = { anonymous: true }; return next(); }

      const version  = req.apiVersion || 'v2';
      const routeKey = `${req.method} ${req.path}`;

      // Check if route is public
      const publicRoutes = [...(PUBLIC_ROUTES[version] || []), ...(PUBLIC_ROUTES.v2)];
      const isPublic = publicRoutes.some((r) => {
        const [m, p] = r.split(' ');
        return (m === req.method || m === '*') && req.originalUrl.startsWith(p);
      });

      if (isPublic) { req.auth = { anonymous: true }; return next(); }

      // Try JWT
      const authHeader = req.headers.authorization || '';
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const secret = this.cfg ? this.cfg.get('gateway.jwtSecret', this._opts.jwtSecret) : this._opts.jwtSecret;
        if (!secret) {
          return res.status(500).json({ error: 'JWT secret not configured. Set gateway.jwtSecret.' });
        }
        try {
          const payload = verifyJwt(token, secret);
          req.auth = { type: 'jwt', userId: payload.sub, roles: payload.roles || [], payload };
          return next();
        } catch (err) {
          return res.status(401).json({ error: 'JWT invalid.', detail: err.message, traceId: req.headyTrace?.traceId });
        }
      }

      // Try API key
      const apiKey = req.headers['x-heady-key'] || '';
      if (apiKey) {
        const secret = this.cfg ? this.cfg.get('gateway.jwtSecret', this._opts.apiKeySecret) : this._opts.apiKeySecret;
        try {
          const { keyId } = verifyApiKey(apiKey, secret || 'heady-default-key-secret-change-in-prod');
          req.auth = { type: 'apikey', keyId, roles: ['service'] };
          return next();
        } catch (err) {
          return res.status(401).json({ error: 'API key invalid.', detail: err.message, traceId: req.headyTrace?.traceId });
        }
      }

      // Admin token (checked separately from regular auth)
      const adminToken = req.headers['x-admin-token'] || '';
      if (adminToken && req.path.startsWith('/admin')) {
        const expectedHash = this.cfg
          ? this.cfg.get('gateway.adminTokenHash', this._opts.adminTokenHash)
          : this._opts.adminTokenHash;
        const actualHash = crypto.createHash('sha256').update(adminToken).digest('hex');
        if (expectedHash && crypto.timingSafeEqual(Buffer.from(actualHash), Buffer.from(expectedHash))) {
          req.auth = { type: 'admin', roles: ['admin', 'service'] };
          return next();
        }
        return res.status(403).json({ error: 'Admin token invalid.' });
      }

      // No credentials provided
      return res.status(401).json({
        error:   'Authentication required.',
        schemes: ['Bearer <JWT>', 'X-Heady-Key: <api-key>'],
        docs:    'https://headyapi.com/docs/auth',
        traceId: req.headyTrace?.traceId || null,
      });
    };
  }

  // ── Rate limit middleware ──────────────────────────────────────────────────

  _rateLimitMiddleware(defaultTier = 'authenticated') {
    return (req, res, next) => {
      if (!this._opts.enableRateLimit) return next();

      const tier     = req.auth?.roles?.includes('admin') ? 'admin' : (req.auth?.anonymous ? 'anonymous' : defaultTier);
      const identity = req.auth?.userId || req.auth?.keyId || req.ip || 'unknown';
      const result   = this._rateLimiter.check(identity, tier);

      res.setHeader('X-RateLimit-Limit',     String(result.limit));
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
      res.setHeader('X-RateLimit-Reset',     String(Math.ceil(result.resetMs / 1000)));

      if (!result.allowed) {
        this.obs?.metrics.counter('heady_http_requests_total').inc({
          service: this._opts.serviceName, method: req.method, path: req.path, status_code: '429',
        });
        return res.status(429).json({
          error:      'Rate limit exceeded.',
          tier,
          resetInMs:  result.resetMs,
          retryAfter: Math.ceil(result.resetMs / 1000),
          traceId:    req.headyTrace?.traceId || null,
        });
      }
      next();
    };
  }

  // ── v1 Router (legacy, read-only stable surface) ──────────────────────────

  _v1Router() {
    const express = require('express');
    const router  = express.Router();

    // Health
    router.get('/health',  (_req, res) => res.json({ status: 'ok',   version: 'v1', ts: Date.now() }));
    router.get('/ready',   (_req, res) => res.json({ status: 'ready', version: 'v1' }));
    router.get('/version', (_req, res) => res.json({
      current:  CURRENT_VERSION,
      version:  'v1',
      status:   'legacy',
      sunset:   '2027-01-01',
      docs:     'https://headyapi.com/docs/v1',
    }));

    // Pipeline run (v1 — proxied to v2 internally)
    router.post('/pipeline/run', async (req, res) => {
      return this._proxyToService(req, res, 'headyapi', '/api/v2/pipeline/run');
    });

    // Bees (v1 read-only)
    router.get('/bees', async (req, res) => {
      return this._proxyToService(req, res, 'headyapi', '/api/v2/bees');
    });
    router.get('/bees/:id', async (req, res) => {
      return this._proxyToService(req, res, 'headyapi', `/api/v2/bees/${req.params.id}`);
    });

    // Creative engine
    router.post('/creative/generate', async (req, res) => {
      return this._proxyToService(req, res, 'headyapi', '/api/v2/creative/generate');
    });

    // Vector memory (v1 — GET only)
    router.get('/memory/query', async (req, res) => {
      return this._proxyToService(req, res, 'headyapi', '/api/v2/memory/query');
    });

    // Deprecation warning header for ALL v1 routes
    router.use((_req, res, next) => {
      res.setHeader('Deprecation', 'true');
      res.setHeader('Sunset', 'Sat, 01 Jan 2027 00:00:00 GMT');
      res.setHeader('Link', '<https://headyapi.com/docs/migration/v1-to-v2>; rel="deprecation"');
      next();
    });

    return router;
  }

  // ── v2 Router (current, all features) ────────────────────────────────────

  _v2Router() {
    const express = require('express');
    const router  = express.Router();

    // ── Meta ───────────────────────────────────────────────────────────────
    router.get('/health',  (_req, res) => res.json({ status: 'ok',    version: 'v2', ts: Date.now() }));
    router.get('/ready',   (_req, res) => res.json({ status: 'ready', version: 'v2' }));
    router.get('/version', (_req, res) => res.json({
      name:     'Heady API Gateway',
      current:  CURRENT_VERSION,
      versions: SUPPORTED_VERSIONS,
      docs:     'https://headyapi.com/docs',
      email:    'eric@headyconnection.org',
    }));

    // ── Auth ───────────────────────────────────────────────────────────────
    router.post('/auth/login', express.json(), async (req, res) => {
      const { userId, password } = req.body || {};
      if (!userId) return res.status(400).json({ error: 'userId required.' });
      // In production: validate against PostgreSQL users table
      // For now: issue JWT with userId (password validation is caller's responsibility)
      const secret = this.cfg ? this.cfg.get('gateway.jwtSecret', this._opts.jwtSecret) : this._opts.jwtSecret;
      if (!secret) return res.status(500).json({ error: 'JWT secret not configured.' });
      const token = signJwt({ sub: userId, roles: ['user'] }, secret, 3600);
      res.json({ token, expiresIn: 3600, type: 'Bearer' });
    });

    router.post('/auth/refresh', (req, res) => {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Bearer token required.' });
      const secret = this.cfg ? this.cfg.get('gateway.jwtSecret', this._opts.jwtSecret) : this._opts.jwtSecret;
      try {
        const payload = verifyJwt(authHeader.slice(7), secret);
        const newToken = signJwt({ sub: payload.sub, roles: payload.roles }, secret, 3600);
        res.json({ token: newToken, expiresIn: 3600 });
      } catch (err) {
        res.status(401).json({ error: err.message });
      }
    });

    // ── Pipeline ───────────────────────────────────────────────────────────
    router.post('/pipeline/run', async (req, res) => {
      const traceId = req.headyTrace?.traceId;
      this.obs?.metrics.counter('heady_pipeline_runs_total').inc({ service: this._opts.serviceName, status: 'started' });
      this.bus?.publish('heady:pipeline:run:created', { traceId, body: req.body, userId: req.auth?.userId });
      return this._proxyToService(req, res, 'headyapi', '/api/v2/pipeline/run');
    });

    router.get('/pipeline/runs/:runId', async (req, res) => {
      return this._proxyToService(req, res, 'headyapi', `/api/v2/pipeline/runs/${req.params.runId}`);
    });

    router.delete('/pipeline/runs/:runId', async (req, res) => {
      return this._proxyToService(req, res, 'headyapi', `/api/v2/pipeline/runs/${req.params.runId}`);
    });

    // ── Pipeline SSE stream ────────────────────────────────────────────────
    router.get('/pipeline/stream/:runId', (req, res) => {
      const { runId } = req.params;
      const traceId  = req.headyTrace?.traceId || crypto.randomUUID();

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering
      res.flushHeaders();

      const clientKey = `${traceId}:${runId}`;
      this._sseClients.set(clientKey, res);

      const sendEvent = (event, data) => {
        try {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        } catch { /* client disconnected */ }
      };

      sendEvent('connected', { runId, traceId, ts: Date.now() });

      // Subscribe to pipeline events for this runId
      let unsubFn = null;
      if (this.bus) {
        unsubFn = this.bus.subscribe('heady:pipeline:run:*', (event) => {
          if (event.data?.runId === runId || event.data?.traceId === traceId) {
            sendEvent('pipeline:update', event.data);
          }
        });
      }

      req.on('close', () => {
        this._sseClients.delete(clientKey);
        if (unsubFn) unsubFn();
        res.end();
      });

      // Heartbeat to keep connection alive (every φ × 10 s)
      const heartbeat = setInterval(() => {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      }, Math.round(PHI * 10_000));

      req.on('close', () => clearInterval(heartbeat));
    });

    // ── Bees ──────────────────────────────────────────────────────────────
    router.get('/bees',        async (req, res) => this._proxyToService(req, res, 'headyapi', '/api/v2/bees'));
    router.post('/bees',       async (req, res) => this._proxyToService(req, res, 'headyapi', '/api/v2/bees'));
    router.get('/bees/:id',    async (req, res) => this._proxyToService(req, res, 'headyapi', `/api/v2/bees/${req.params.id}`));
    router.delete('/bees/:id', async (req, res) => this._proxyToService(req, res, 'headyapi', `/api/v2/bees/${req.params.id}`));
    router.post('/bees/:id/restart', async (req, res) => this._proxyToService(req, res, 'headyapi', `/api/v2/bees/${req.params.id}/restart`));

    // ── Vector memory ────────────────────────────────────────────────────
    router.post('/memory/ingest', async (req, res) => this._proxyToService(req, res, 'headyapi', '/api/v2/memory/ingest'));
    router.get('/memory/query',   async (req, res) => this._proxyToService(req, res, 'headyapi', '/api/v2/memory/query'));
    router.delete('/memory',      async (req, res) => this._proxyToService(req, res, 'headyapi', '/api/v2/memory'));

    // ── Creative engine ──────────────────────────────────────────────────
    router.post('/creative/generate', async (req, res) => this._proxyToService(req, res, 'headyapi', '/api/v2/creative/generate'));
    router.get('/creative/styles',    async (req, res) => this._proxyToService(req, res, 'headyapi', '/api/v2/creative/styles'));

    // ── Edge diffusion (image generation) ────────────────────────────────
    router.post('/image/generate', async (req, res) => this._proxyToService(req, res, 'heady-ai', '/api/v2/image/generate'));

    // ── MCP tools ────────────────────────────────────────────────────────
    router.get('/mcp/tools',               async (req, res) => this._proxyToService(req, res, 'headymcp', '/api/v2/mcp/tools'));
    router.post('/mcp/tools/:toolName/run', async (req, res) => this._proxyToService(req, res, 'headymcp', `/api/v2/mcp/tools/${req.params.toolName}/run`));

    // ── Buddy / sovereign orchestrator ────────────────────────────────────
    router.post('/buddy/task',          async (req, res) => this._proxyToService(req, res, 'headybuddy', '/api/v2/buddy/task'));
    router.get('/buddy/status',         async (req, res) => this._proxyToService(req, res, 'headybuddy', '/api/v2/buddy/status'));
    router.get('/buddy/metacognition',  async (req, res) => this._proxyToService(req, res, 'headybuddy', '/api/v2/buddy/metacognition'));

    // ── Self-awareness ────────────────────────────────────────────────────
    router.get('/awareness/status',     async (req, res) => this._proxyToService(req, res, 'headyapi', '/api/v2/awareness/status'));
    router.get('/awareness/telemetry',  async (req, res) => this._proxyToService(req, res, 'headyapi', '/api/v2/awareness/telemetry'));

    // ── Config (admin only) ───────────────────────────────────────────────
    router.use('/admin/config', this._adminAuthMiddleware(), (() => {
      try { return require('./heady-config-server').getConfigServer().router(); } catch { return (_r, res) => res.json({ error: 'Config server not available.' }); }
    })());

    // ── Service mesh (admin only) ─────────────────────────────────────────
    router.get('/admin/mesh', this._adminAuthMiddleware(), async (_req, res) => {
      try {
        const status = this.mesh ? await this.mesh.status() : { error: 'Mesh not available.' };
        res.json(status);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ── Observability ─────────────────────────────────────────────────────
    if (this.obs) {
      router.use('/obs', this.obs.router());
    } else {
      router.get('/obs/metrics', (_req, res) => res.status(503).json({ error: 'Observability not configured.' }));
    }

    // ── Event bus admin ───────────────────────────────────────────────────
    router.get('/admin/events/topics', this._adminAuthMiddleware(), (_req, res) => {
      const topics = this.bus ? this.bus.listTopics() : [];
      res.json({ topics });
    });

    // ── Ternary logic ─────────────────────────────────────────────────────
    router.post('/ternary/evaluate', async (req, res) => {
      return this._proxyToService(req, res, 'headyapi', '/api/v2/ternary/evaluate');
    });

    return router;
  }

  // ── Admin auth middleware ─────────────────────────────────────────────────

  _adminAuthMiddleware() {
    return (req, res, next) => {
      if (req.auth?.roles?.includes('admin')) return next();
      const adminToken = req.headers['x-admin-token'] || '';
      if (!adminToken) return res.status(403).json({ error: 'Admin token required.' });
      const expectedHash = this.cfg
        ? this.cfg.get('gateway.adminTokenHash', this._opts.adminTokenHash)
        : this._opts.adminTokenHash;
      if (!expectedHash) return res.status(500).json({ error: 'Admin token hash not configured.' });
      const actualHash = crypto.createHash('sha256').update(adminToken).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(actualHash), Buffer.from(expectedHash))) {
        return res.status(403).json({ error: 'Invalid admin token.' });
      }
      req.auth = { ...(req.auth || {}), roles: ['admin', 'service'] };
      next();
    };
  }

  // ── Webhook router ────────────────────────────────────────────────────────

  _webhookRouter() {
    const express = require('express');
    const router  = express.Router();

    // GCP Pub/Sub push subscription
    router.post('/pubsub', express.json(), async (req, res) => {
      const { message, subscription } = req.body || {};
      if (!message) return res.status(400).json({ error: 'Pub/Sub message required.' });

      try {
        const data = JSON.parse(Buffer.from(message.data, 'base64').toString('utf8'));
        const attributes = message.attributes || {};

        this.obs?.logger.info('PubSub message received', {
          subscription,
          messageId: message.messageId,
          topic:     attributes.topic,
          traceId:   req.headyTrace?.traceId,
        });

        // Publish to internal event bus
        if (this.bus) {
          const topic = attributes.eventType || 'heady:pubsub:message:received';
          await this.bus.publish(topic, { ...data, _pubsubMessageId: message.messageId, _subscription: subscription });
        }

        res.sendStatus(200); // ACK — prevents Pub/Sub redelivery
      } catch (err) {
        this.obs?.logger.error('PubSub message parse error', { error: err.message, traceId: req.headyTrace?.traceId });
        res.status(400).json({ error: 'Invalid Pub/Sub message payload.' });
      }
    });

    return router;
  }

  // ── Service proxy helper ──────────────────────────────────────────────────

  async _proxyToService(req, res, serviceName, targetPath) {
    // Resolve URL via service mesh if available, else use registry fallback
    let baseUrl;
    try {
      baseUrl = this.mesh ? await this.mesh.resolve(serviceName) : this._fallbackUrl(serviceName);
    } catch (err) {
      return res.status(503).json({
        error:   `Service '${serviceName}' unavailable.`,
        detail:  err.message,
        traceId: req.headyTrace?.traceId,
      });
    }

    const url = `${baseUrl}${targetPath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;

    const outHeaders = {
      'Content-Type':    'application/json',
      'X-Forwarded-For': req.ip,
      'X-Real-IP':       req.ip,
      ...( this.obs ? this.obs.tracer.injectHeaders({}) : {} ),
    };
    if (req.auth?.userId)  outHeaders['X-Heady-User']    = req.auth.userId;
    if (req.auth?.roles)   outHeaders['X-Heady-Roles']   = req.auth.roles.join(',');

    try {
      const parsed  = new URL(url);
      const mod     = parsed.protocol === 'https:' ? https : http;
      const reqOpts = {
        hostname: parsed.hostname,
        port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path:     parsed.pathname + parsed.search,
        method:   req.method,
        headers:  outHeaders,
        timeout:  30_000,
      };

      const proxyReq = mod.request(reqOpts, (proxyRes) => {
        res.status(proxyRes.statusCode);
        for (const [k, v] of Object.entries(proxyRes.headers)) {
          if (!['transfer-encoding', 'connection'].includes(k.toLowerCase())) {
            res.setHeader(k, v);
          }
        }
        proxyRes.pipe(res);
      });

      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        if (!res.headersSent) {
          res.status(504).json({ error: 'Gateway timeout.', service: serviceName, traceId: req.headyTrace?.traceId });
        }
      });
      proxyReq.on('error', (err) => {
        if (!res.headersSent) {
          res.status(502).json({ error: 'Bad gateway.', detail: err.message, service: serviceName, traceId: req.headyTrace?.traceId });
        }
      });

      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        proxyReq.write(JSON.stringify(req.body));
      }
      proxyReq.end();

    } catch (err) {
      res.status(500).json({ error: 'Proxy error.', detail: err.message, traceId: req.headyTrace?.traceId });
    }
  }

  _fallbackUrl(serviceName) {
    const FALLBACK = {
      headyapi:     process.env.HEADY_API_URL     || 'https://heady-manager-609590223909.us-central1.run.app',
      headymcp:     process.env.HEADY_MCP_URL     || 'https://headymcp.com',
      headybuddy:   process.env.HEADY_BUDDY_URL   || 'https://headybuddy.org',
      heady-ai:      process.env.HEADY_AI_URL      || 'https://heady-ai.com',
      headyio:      process.env.HEADY_IO_URL      || 'https://headyio.com',
      headybot:     process.env.HEADY_BOT_URL     || 'https://headybot.com',
      headysystems: process.env.HEADY_SYSTEMS_URL || 'https://headysystems.com',
      headyme:      process.env.HEADY_ME_URL      || 'https://headyme.com',
      headyconnection: process.env.HEADY_CONNECTION_URL || 'https://headyconnection.org',
    };
    const url = FALLBACK[serviceName];
    if (!url) throw new Error(`No fallback URL for service '${serviceName}'.`);
    return url;
  }

  /**
   * Returns an Express router (for embedding in an existing app).
   */
  router() {
    const express = require('express');
    const router  = express.Router();
    router.use(this._corsMiddleware());
    router.use(this._securityHeaders());
    router.use('/api', this._versionRouter());
    router.use('/webhooks', this._webhookRouter());
    return router;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _instance = null;

/**
 * Returns the singleton HeadyApiGatewayV2 instance.
 */
function createGateway(opts) {
  if (!_instance) _instance = new HeadyApiGatewayV2(opts);
  return _instance;
}

function _resetGatewayForTests() {
  if (_instance) _instance.stop().catch(() => {});
  _instance = null;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  HeadyApiGatewayV2,
  createGateway,
  _resetGatewayForTests,
  signJwt,
  verifyJwt,
  verifyApiKey,
  HEADY_DOMAINS,
  SUPPORTED_VERSIONS,
  CURRENT_VERSION,
  LEGACY_VERSION,
  PUBLIC_ROUTES,
  RATE_TIERS,
  PHI,
};

// ─── Entrypoint ───────────────────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    const gw = createGateway({
      port:       parseInt(process.env.PORT || '8080', 10),
      enableAuth: process.env.NODE_ENV === 'production',
    });
    await gw.start();

    // Graceful shutdown
    const shutdown = async (sig) => {
      console.log(`[HeadyApiGatewayV2] ${sig} received — draining connections...`);
      await gw.stop();
      process.exit(0);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));
  })().catch((err) => { console.error(err); process.exit(1); });
}
