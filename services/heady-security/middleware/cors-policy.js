/**
 * Advanced CORS Policy Middleware
 * @module security-middleware/cors-policy
 *
 * Features:
 *  - Allowlist of all HeadyMe domains
 *  - Per-route CORS overrides
 *  - Preflight caching (max-age: 86400)
 *  - credentials: true only for first-party domains
 *  - Full method set: GET, POST, PUT, DELETE, PATCH, OPTIONS
 *  - Exposed headers: X-Request-ID, X-RateLimit-Remaining, X-Circuit-State
 *  - Origin validation with subdomain support
 *  - Environment-aware (dev mode allows localhost)
 */

'use strict';

// ─── Allowed Origins ──────────────────────────────────────────────────────────

// All HeadyMe first-party domains — credentials: true is safe for these
const FIRST_PARTY_DOMAINS = [
  'headyme.com',
  'headysystems.com',
  'headymcp.com',
  'headybuddy.com',
  'headyconnection.org',
  'headyapi.com',
  'headybot.com',
  'headyos.com',
  'headyio.com',
];

// Third-party domains — allowed but no credentials
const THIRD_PARTY_DOMAINS = [
  // Add partner/integration domains here
];

// Allowed HTTP methods
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

// Exposed response headers
const EXPOSED_HEADERS = [
  'X-Request-ID',
  'X-RateLimit-Remaining',
  'X-RateLimit-Limit',
  'X-RateLimit-Reset',
  'X-Circuit-State',
  'X-Processing-Purpose',
  'X-Legal-Basis',
  'X-Session-Expires-In',
  'Content-Disposition',
  'X-Checksum-SHA256',
];

// Allowed request headers
const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Request-ID',
  'X-Session-ID',
  'X-API-Key',
  'X-Tenant-ID',
  'X-Access-Purpose',
  'X-Data-Destination-Country',
  'Accept',
  'Accept-Language',
  'Cache-Control',
  'If-None-Match',
  'If-Modified-Since',
];

const PREFLIGHT_MAX_AGE = 86400; // 24 hours

// ─── Origin Validator ─────────────────────────────────────────────────────────

/**
 * Determine if an origin is allowed and whether credentials should be permitted.
 *
 * @param {string} origin
 * @param {object} opts
 * @param {string[]} [opts.additionalDomains] - Extra allowed domains
 * @param {boolean} [opts.allowLocalhost]     - Allow localhost/127.0.0.1 (dev)
 * @returns {{ allowed: boolean, credentials: boolean, matchedDomain: string|null }}
 */
function validateOrigin(origin, opts = {}) {
  if (!origin) return { allowed: false, credentials: false, matchedDomain: null };

  let hostname;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return { allowed: false, credentials: false, matchedDomain: null };
  }

  // Dev: allow localhost
  if (opts.allowLocalhost && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local'))) {
    return { allowed: true, credentials: true, matchedDomain: hostname };
  }

  // First-party domains (exact + subdomain match)
  for (const domain of FIRST_PARTY_DOMAINS) {
    if (hostname === domain || hostname.endsWith('.' + domain)) {
      return { allowed: true, credentials: true, matchedDomain: domain };
    }
  }

  // Additional first-party domains from config
  for (const domain of (opts.additionalDomains || [])) {
    if (hostname === domain || hostname.endsWith('.' + domain)) {
      return { allowed: true, credentials: true, matchedDomain: domain };
    }
  }

  // Third-party domains (no credentials)
  for (const domain of THIRD_PARTY_DOMAINS) {
    if (hostname === domain || hostname.endsWith('.' + domain)) {
      return { allowed: true, credentials: false, matchedDomain: domain };
    }
  }

  return { allowed: false, credentials: false, matchedDomain: null };
}

// ─── Route-Level Override Registry ───────────────────────────────────────────

class CORSRouteRegistry {
  constructor() {
    this._routes = new Map(); // pattern → options
  }

  /**
   * Register per-route CORS override.
   *
   * @param {string|RegExp} pattern    - Route path or regex
   * @param {object} corsOptions       - Per-route CORS options
   * @param {string[]} [corsOptions.origins]       - Additional allowed origins
   * @param {string[]} [corsOptions.methods]       - Override allowed methods
   * @param {boolean}  [corsOptions.credentials]  - Override credentials flag
   * @param {string[]} [corsOptions.exposedHeaders] - Additional exposed headers
   * @param {boolean}  [corsOptions.allowAll]      - Allow * (public API, no credentials)
   */
  register(pattern, corsOptions) {
    this._routes.set(pattern, corsOptions);
    return this;
  }

  /**
   * Find override matching a path.
   * @param {string} path
   * @returns {object|null}
   */
  find(path) {
    for (const [pattern, opts] of this._routes) {
      if (pattern instanceof RegExp) {
        if (pattern.test(path)) return opts;
      } else if (typeof pattern === 'string') {
        if (path === pattern || path.startsWith(pattern)) return opts;
      }
    }
    return null;
  }
}

// ─── Middleware Factory ───────────────────────────────────────────────────────

/**
 * Create the CORS middleware.
 *
 * @param {object} [opts]
 * @param {string[]} [opts.additionalDomains]   - Extra allowed first-party domains
 * @param {boolean}  [opts.allowLocalhost]       - Allow localhost (default: NODE_ENV !== 'production')
 * @param {CORSRouteRegistry} [opts.routeRegistry] - Per-route override registry
 * @param {string[]} [opts.allowedHeaders]       - Override allowed request headers
 * @param {string[]} [opts.exposedHeaders]       - Override exposed response headers
 * @param {number}   [opts.maxAge]               - Preflight cache max-age (default: 86400)
 * @returns {Function} Express middleware
 */
function corsPolicy(opts = {}) {
  const {
    additionalDomains = [],
    allowLocalhost    = process.env.NODE_ENV !== 'production',
    routeRegistry     = new CORSRouteRegistry(),
    allowedHeaders    = ALLOWED_HEADERS,
    exposedHeaders    = EXPOSED_HEADERS,
    maxAge            = PREFLIGHT_MAX_AGE,
  } = opts;

  const allowedHeadersStr = allowedHeaders.join(', ');
  const exposedHeadersStr = exposedHeaders.join(', ');
  const allowedMethodsStr = ALLOWED_METHODS.join(', ');

  return (req, res, next) => {
    const origin = req.headers.origin;

    // No origin header → likely same-origin or non-browser → allow
    if (!origin) return next();

    // Check for route-level override
    const routeOverride = routeRegistry.find(req.path);

    // Handle public API (no credentials)
    if (routeOverride?.allowAll) {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', (routeOverride.methods || ALLOWED_METHODS).join(', '));
      res.set('Access-Control-Allow-Headers', allowedHeadersStr);
      res.set('Access-Control-Expose-Headers', (routeOverride.exposedHeaders || exposedHeaders).join(', '));
      if (req.method === 'OPTIONS') {
        res.set('Access-Control-Max-Age', String(maxAge));
        return res.status(204).end();
      }
      return next();
    }

    // Validate origin
    const { allowed, credentials, matchedDomain } = validateOrigin(origin, { additionalDomains, allowLocalhost });

    if (!allowed) {
      // Log blocked CORS attempt
      console.warn('[CORS] Blocked origin:', origin, 'path:', req.path);
      if (req.method === 'OPTIONS') {
        return res.status(403).json({ error: 'CORS: Origin not allowed', origin });
      }
      // For non-preflight, don't set CORS headers (browser will block it)
      return next();
    }

    // Compute effective credentials flag
    const effectiveCredentials = routeOverride?.credentials !== undefined
      ? routeOverride.credentials
      : credentials;

    // Compute effective methods
    const effectiveMethods = routeOverride?.methods || ALLOWED_METHODS;

    // Compute effective additional exposed headers
    const effectiveExposedHeaders = [
      ...exposedHeaders,
      ...(routeOverride?.exposedHeaders || []),
    ];

    // Set CORS headers
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');  // Must vary cache by Origin

    if (effectiveCredentials) {
      res.set('Access-Control-Allow-Credentials', 'true');
    }

    res.set('Access-Control-Allow-Methods',  effectiveMethods.join(', '));
    res.set('Access-Control-Allow-Headers',  allowedHeadersStr);
    res.set('Access-Control-Expose-Headers', effectiveExposedHeaders.join(', '));

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Max-Age', String(maxAge));
      return res.status(204).end();
    }

    next();
  };
}

// ─── Route Override Shortcuts ─────────────────────────────────────────────────

/**
 * Middleware to allow all origins on a specific route (public API — no credentials).
 * Use for webhook endpoints, public data APIs, etc.
 */
function publicCors(methods = ['GET', 'POST']) {
  return (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', methods.join(', '));
    res.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
    res.set('Access-Control-Expose-Headers', EXPOSED_HEADERS.join(', '));
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Max-Age', String(PREFLIGHT_MAX_AGE));
      return res.status(204).end();
    }
    next();
  };
}

/**
 * Middleware that blocks all cross-origin requests (for internal-only APIs).
 */
function noCors() {
  return (req, res, next) => {
    if (req.headers.origin) {
      return res.status(403).json({ error: 'Cross-origin requests not allowed for this endpoint' });
    }
    next();
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  corsPolicy,
  publicCors,
  noCors,
  validateOrigin,
  CORSRouteRegistry,
  FIRST_PARTY_DOMAINS,
  ALLOWED_METHODS,
  ALLOWED_HEADERS,
  EXPOSED_HEADERS,
  PREFLIGHT_MAX_AGE,
};

// ─── Usage Example ────────────────────────────────────────────────────────────
/*
const express = require('express');
const { corsPolicy, publicCors, noCors, CORSRouteRegistry } = require('./cors-policy');

const app = express();

// Per-route registry
const routeRegistry = new CORSRouteRegistry()
  .register('/api/public/', { allowAll: true })
  .register('/api/webhooks/', { allowAll: true, methods: ['POST'] })
  .register('/api/v1/admin/', { credentials: true })  // enforce first-party only
  .register(/^\/embed\//, { origins: ['https://partner.example.com'], credentials: false });

// Apply globally
app.use(corsPolicy({
  allowLocalhost:   process.env.NODE_ENV !== 'production',
  routeRegistry,
}));

// Override on specific routes
app.get('/api/public/status', publicCors(['GET']), (req, res) => res.json({ ok: true }));
app.post('/internal/admin', noCors(), (req, res) => res.json({ ok: true }));
*/
