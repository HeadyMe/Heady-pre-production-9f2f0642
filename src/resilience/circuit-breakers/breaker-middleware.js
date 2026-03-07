/**
 * breaker-middleware.js
 * Express middleware integrating all circuit breakers into the request lifecycle.
 *
 * Features
 * --------
 * - Automatically wraps outgoing fetch/http calls with the appropriate breaker
 *   based on the target URL's hostname
 * - Adds X-Circuit-State and X-Circuit-Service headers to all responses
 * - Returns 503 with Retry-After header when a circuit is OPEN
 * - Provides /api/circuit-breakers status endpoint (aggregated dashboard)
 * - Emits Node.js events on state changes for alerting integrations
 * - Pluggable alert handlers (Slack, PagerDuty, custom)
 *
 * Usage
 * -----
 *   const { attachBreakers } = require('./breaker-middleware');
 *   attachBreakers(app);
 *
 * @module enterprise-hardening/circuit-breaker/breaker-middleware
 */
'use strict';

const { EventEmitter } = require('events');
const { registry, SERVICE_CONFIGS, EnhancedCircuitBreaker } = require('./external-api-breakers');
const { modelBridgeBreaker }  = require('./model-bridge-breaker');
const { postgresBreaker, redisBreaker } = require('./database-breaker');
const { githubBreaker }       = require('./github-api-breaker');
const { cloudflareBreaker }   = require('./cloudflare-breaker');
const { mcpBreaker }          = require('./mcp-breaker');
const { STATES }              = require('../../circuit-breaker');

// ---------------------------------------------------------------------------
// URL → service mapping
// hostname substring → service name in registry
// ---------------------------------------------------------------------------
const HOST_TO_SERVICE = {
  'api.openai.com':                        'openai',
  'api.anthropic.com':                     'anthropic',
  'generativelanguage.googleapis.com':     'google-genai',
  'api.groq.com':                          'groq',
  'api-inference.huggingface.co':          'huggingface',
  'huggingface.co':                        'huggingface',
  'api.cloudflare.com':                    'cloudflare-ai',
  'api.github.com':                        'github-api',
};

/**
 * Determine which service (if any) a URL maps to.
 * Returns null for unregistered hosts.
 *
 * @param {string} urlString
 * @returns {string|null}
 */
function serviceForUrl(urlString) {
  try {
    const { hostname } = new URL(urlString);
    for (const [host, service] of Object.entries(HOST_TO_SERVICE)) {
      if (hostname === host || hostname.endsWith(`.${host}`)) return service;
    }
  } catch { /* malformed URL */ }
  return null;
}

// ---------------------------------------------------------------------------
// fetch() interceptor
// Patches the global fetch to route calls through circuit breakers.
// Call installFetchInterceptor() once at application startup.
// ---------------------------------------------------------------------------
let _fetchIntercepted = false;

function installFetchInterceptor() {
  if (_fetchIntercepted || typeof globalThis.fetch !== 'function') return;
  _fetchIntercepted = true;

  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async function interceptedFetch(input, init) {
    const urlString = typeof input === 'string' ? input : input?.url || String(input);
    const service   = serviceForUrl(urlString);

    if (!service) return originalFetch(input, init);   // not a tracked service

    let breaker;
    try { breaker = registry.get(service); }
    catch { return originalFetch(input, init); }        // unregistered — pass through

    if (breaker.state === STATES.OPEN) {
      const retryAfter = Math.ceil(SERVICE_CONFIGS[service]?.recoveryTimeout / 1000 || 30);
      const err = new Error(`Circuit OPEN for ${service}`);
      err.code = 'CIRCUIT_OPEN';
      err.service = service;
      err.retryAfter = retryAfter;
      throw err;
    }

    return breaker.execute(() => originalFetch(input, init));
  };
}

// ---------------------------------------------------------------------------
// Circuit state response headers middleware
// Adds X-Circuit-State and X-Circuit-Service to every response.
// ---------------------------------------------------------------------------
function circuitStateHeaders() {
  return (req, res, next) => {
    const service = req._resolvedCircuitService || detectServiceFromRequest(req);
    if (service) {
      try {
        const breaker = registry.get(service);
        res.setHeader('X-Circuit-Service', service);
        res.setHeader('X-Circuit-State',   breaker.state);
      } catch { /* unknown service — skip */ }
    }
    next();
  };
}

/**
 * Attempt to infer which external service a request is proxying.
 * Checks headers, query params, and path prefixes.
 */
function detectServiceFromRequest(req) {
  const target = req.headers['x-proxy-target'] || req.query?.service || '';
  if (target) return serviceForUrl(target) || target;

  const path = req.path || '';
  if (path.startsWith('/api/openai'))        return 'openai';
  if (path.startsWith('/api/anthropic'))     return 'anthropic';
  if (path.startsWith('/api/google'))        return 'google-genai';
  if (path.startsWith('/api/groq'))          return 'groq';
  if (path.startsWith('/api/huggingface'))   return 'huggingface';
  if (path.startsWith('/api/cloudflare'))    return 'cloudflare-ai';
  if (path.startsWith('/api/github'))        return 'github-api';
  if (path.startsWith('/api/db'))            return 'postgresql-neon';
  if (path.startsWith('/api/redis') || path.startsWith('/api/kv')) return 'redis';
  if (path.startsWith('/api/mcp'))           return 'mcp-sdk';

  return null;
}

// ---------------------------------------------------------------------------
// 503 guard middleware
// Checks the inferred service's circuit state and short-circuits with 503.
// Mount BEFORE route handlers that call external services.
// ---------------------------------------------------------------------------
function circuitGuard(serviceMap = {}) {
  /**
   * serviceMap: { '/path/prefix': 'service-name' }
   * Allows explicit mapping of routes to services without header/path inference.
   */
  return (req, res, next) => {
    // Explicit map first
    const service = serviceMap[req.path]
      || Object.entries(serviceMap).find(([prefix]) => req.path.startsWith(prefix))?.[1]
      || detectServiceFromRequest(req);

    if (!service) return next();

    req._resolvedCircuitService = service;

    let breaker;
    try { breaker = registry.get(service); }
    catch { return next(); }

    if (breaker.state === STATES.OPEN) {
      const recoveryTimeout = SERVICE_CONFIGS[service]?.recoveryTimeout || 30_000;
      const retryAfterSecs  = Math.ceil(recoveryTimeout / 1000);
      res.setHeader('X-Circuit-State',   STATES.OPEN);
      res.setHeader('X-Circuit-Service', service);
      res.setHeader('Retry-After',       String(retryAfterSecs));
      return res.status(503).json({
        error:       'Service Unavailable',
        service,
        circuitState: STATES.OPEN,
        retryAfter:  retryAfterSecs,
        message:     `The ${service} circuit is open. Retry after ${retryAfterSecs}s.`,
        timestamp:   new Date().toISOString(),
      });
    }

    if (breaker.state === STATES.HALF_OPEN) {
      res.setHeader('X-Circuit-State',   STATES.HALF_OPEN);
      res.setHeader('X-Circuit-Service', service);
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// Alert manager
// ---------------------------------------------------------------------------
class AlertManager extends EventEmitter {
  constructor() {
    super();
    /** @type {Array<{name: string, handler: Function}>} */
    this._handlers = [];
  }

  /**
   * Register an alert handler.
   * @param {string}   name     Logical name (e.g. 'slack', 'pagerduty')
   * @param {Function} handler  async ({ service, from, to, at, ... }) => void
   */
  addHandler(name, handler) {
    this._handlers.push({ name, handler });
    return this;
  }

  removeHandler(name) {
    this._handlers = this._handlers.filter(h => h.name !== name);
  }

  async dispatch(event) {
    this.emit('alert', event);
    await Promise.allSettled(
      this._handlers.map(({ name, handler }) =>
        handler(event).catch(err =>
          this.emit('alertError', { handler: name, error: err.message })
        )
      )
    );
  }

  /** Built-in console handler (active by default in non-production). */
  static consoleHandler() {
    return async (event) => {
      const level = event.to === STATES.OPEN ? 'error' : 'info';
      console[level](
        `[CircuitBreaker] ${event.service}: ${event.from} → ${event.to} at ${event.at}`
      );
    };
  }
}

const alertManager = new AlertManager();

// Wire up alerts for all known breakers
function _wireAlerts() {
  registry.on('stateChange', event => alertManager.dispatch(event));
  modelBridgeBreaker.on('stateChange',    event => alertManager.dispatch(event));
  postgresBreaker.on('stateChange',       event => alertManager.dispatch(event));
  redisBreaker.on('stateChange',          event => alertManager.dispatch(event));
  githubBreaker.on('stateChange',         event => alertManager.dispatch(event));
  cloudflareBreaker.on('stateChange',     event => alertManager.dispatch(event));
  mcpBreaker.on('stateChange',            event => alertManager.dispatch(event));
  mcpBreaker.on('toolStateChange',        event => alertManager.dispatch(event));
}

// ---------------------------------------------------------------------------
// Aggregated dashboard route handler
// GET /api/circuit-breakers — master JSON dashboard
// ---------------------------------------------------------------------------
function aggregatedDashboardHandler() {
  return (_req, res) => {
    const data = {
      timestamp: new Date().toISOString(),
      external:   registry.dashboard(),
      modelBridge: modelBridgeBreaker.snapshot(),
      database: {
        postgres: postgresBreaker.snapshot(),
        redis:    redisBreaker.snapshot(),
      },
      github:     githubBreaker.snapshot(),
      cloudflare: cloudflareBreaker.snapshot(),
      mcp:        mcpBreaker.dashboard(),
    };

    // Overall health
    const allBreakers = [
      ...Object.values(data.external.breakers),
    ];
    const openCount = allBreakers.filter(b => b.state === STATES.OPEN).length;
    data.overall = {
      healthy: openCount === 0,
      openCount,
      totalTracked: allBreakers.length,
    };

    res.json(data);
  };
}

// ---------------------------------------------------------------------------
// attachBreakers — single call to wire everything into an Express app
// ---------------------------------------------------------------------------
/**
 * Attach all circuit-breaker middleware and routes to an Express application.
 *
 * @param {object} app         Express application
 * @param {object} [opts]
 * @param {boolean} [opts.installFetch]    Patch global fetch (default: true)
 * @param {boolean} [opts.consoleAlerts]   Log state changes to console (default: !production)
 * @param {object}  [opts.serviceMap]      Route-to-service overrides for circuitGuard
 * @param {Array}   [opts.alertHandlers]   Additional alert handlers [{name, handler}]
 */
function attachBreakers(app, opts = {}) {
  const {
    installFetch    = true,
    consoleAlerts   = process.env.NODE_ENV !== 'production',
    serviceMap      = {},
    alertHandlers   = [],
  } = opts;

  // Patch fetch
  if (installFetch) installFetchInterceptor();

  // Wire alerts
  _wireAlerts();

  if (consoleAlerts) alertManager.addHandler('console', AlertManager.consoleHandler());
  for (const { name, handler } of alertHandlers) alertManager.addHandler(name, handler);

  // Global state-header middleware (runs on every request)
  app.use(circuitStateHeaders());

  // Aggregated dashboard
  app.get('/api/circuit-breakers', aggregatedDashboardHandler());

  // Per-service reset
  app.post('/api/circuit-breakers/:service/reset', (req, res) => {
    const { service } = req.params;
    try {
      registry.get(service).reset();
      res.json({ service, reset: true, timestamp: new Date().toISOString() });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // MCP tool dashboard + reset routes
  mcpBreaker.registerRoutes(app);

  // Return the circuitGuard middleware for route-level use
  return circuitGuard(serviceMap);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  attachBreakers,
  circuitGuard,
  circuitStateHeaders,
  installFetchInterceptor,
  aggregatedDashboardHandler,
  alertManager,
  AlertManager,
  serviceForUrl,
  detectServiceFromRequest,
  HOST_TO_SERVICE,
};
