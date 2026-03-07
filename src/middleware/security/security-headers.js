/**
 * Security Headers Middleware — Comprehensive Production Implementation
 * @module security-middleware/security-headers
 *
 * Provides all recommended security response headers:
 *  - Content-Security-Policy (strict nonce-based)
 *  - Strict-Transport-Security (HSTS + preload)
 *  - X-Content-Type-Options
 *  - X-Frame-Options (configurable)
 *  - X-XSS-Protection (disabled in favor of CSP)
 *  - Referrer-Policy
 *  - Permissions-Policy
 *  - Cross-Origin-Opener-Policy
 *  - Cross-Origin-Resource-Policy
 *  - Cross-Origin-Embedder-Policy
 *  - Cache-Control
 *  - X-Request-ID injection
 *  - X-DNS-Prefetch-Control
 *  - Report-To (CSP violation reporting)
 *  - CSP nonce generation + injection into res.locals
 */

'use strict';

const crypto = require('crypto');

// ─── Default Configuration ───────────────────────────────────────────────────

const DEFAULTS = {
  // HSTS
  hstsMaxAge:               31536000,  // 1 year
  hstsIncludeSubdomains:    true,
  hstsPreload:              true,

  // CSP
  cspReportUri:             '/csp-violations',
  cspReportOnlyMode:        false,

  // X-Frame-Options
  frameOptions:             'DENY',    // 'DENY' | 'SAMEORIGIN' | null (to disable)

  // Referrer Policy
  referrerPolicy:           'strict-origin-when-cross-origin',

  // COOP / COEP / CORP
  crossOriginOpenerPolicy:  'same-origin',
  crossOriginEmbedderPolicy:'require-corp',
  crossOriginResourcePolicy:'same-origin',

  // Cache-Control for authenticated routes
  cacheControlAuthenticated:'no-store, max-age=0',
  cacheControlPublic:       'public, max-age=3600',

  // Request ID
  requestIdHeader:          'X-Request-ID',

  // Report-To endpoint
  reportToGroupName:        'heady-csp-violations',
  reportToEndpoint:         '/csp-violations',
  reportToMaxAge:           86400,

  // Permissions Policy defaults (deny all sensitive APIs)
  permissionsPolicy: {
    accelerometer:    '()',
    'ambient-light-sensor': '()',
    autoplay:         '()',
    battery:          '()',
    camera:           '()',
    'display-capture': '()',
    'document-domain': '()',
    'encrypted-media': '()',
    'execution-while-not-rendered': '()',
    'execution-while-out-of-viewport': '()',
    fullscreen:       '()',
    geolocation:      '()',
    gyroscope:        '()',
    'keyboard-map':   '()',
    magnetometer:     '()',
    microphone:       '()',
    midi:             '()',
    'navigation-override': '()',
    payment:          '()',
    'picture-in-picture': '()',
    'publickey-credentials-get': '()',
    'screen-wake-lock': '()',
    'serial':         '()',
    'speaker-selection': '()',
    'sync-xhr':       '()',
    usb:              '()',
    'web-share':      '()',
    'xr-spatial-tracking': '()',
  },
};

// ─── CSP Nonce Generation ─────────────────────────────────────────────────────

/**
 * Generate a cryptographically random CSP nonce.
 * @returns {string} base64url-encoded 16-byte nonce
 */
function generateNonce() {
  return crypto.randomBytes(16).toString('base64url');
}

// ─── CSP Builder ─────────────────────────────────────────────────────────────

/**
 * Build a strict CSP header value with nonce.
 *
 * @param {string} nonce          - CSP nonce value
 * @param {object} [overrides]    - Per-request CSP directive overrides
 * @param {string} [reportUri]    - CSP report URI
 * @returns {string}
 */
function buildCSP(nonce, overrides = {}, reportUri = '/csp-violations') {
  const directives = {
    'default-src':   ["'self'"],
    'script-src':    ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"],
    'style-src':     ["'self'", `'nonce-${nonce}'`],
    'img-src':       ["'self'", 'data:', 'blob:', 'https:'],
    'font-src':      ["'self'", 'data:'],
    'connect-src':   ["'self'", 'https://api.headyme.com', 'https://api.headysystems.com', 'wss://api.headyme.com'],
    'frame-src':     ["'none'"],
    'frame-ancestors': ["'none'"],
    'object-src':    ["'none'"],
    'base-uri':      ["'self'"],
    'form-action':   ["'self'"],
    'manifest-src':  ["'self'"],
    'worker-src':    ["'self'", 'blob:'],
    'media-src':     ["'self'"],
    'upgrade-insecure-requests': [],
    'block-all-mixed-content':   [],
    ...overrides,
  };

  if (reportUri) {
    directives['report-uri'] = [reportUri];
  }

  return Object.entries(directives)
    .map(([directive, values]) => {
      if (!values || values.length === 0) return directive;
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');
}

// ─── Permissions Policy Builder ───────────────────────────────────────────────

function buildPermissionsPolicy(policy) {
  return Object.entries(policy)
    .map(([feature, value]) => `${feature}=${value}`)
    .join(', ');
}

// ─── Report-To Header Builder ─────────────────────────────────────────────────

function buildReportTo(groupName, endpoint, maxAge) {
  return JSON.stringify({
    group:      groupName,
    max_age:    maxAge,
    endpoints:  [{ url: endpoint }],
    include_subdomains: true,
  });
}

// ─── Main Middleware Factory ──────────────────────────────────────────────────

/**
 * Create the security headers Express middleware.
 *
 * @param {object} [opts]                  - Configuration overrides
 * @param {number} [opts.hstsMaxAge]       - HSTS max-age in seconds
 * @param {boolean} [opts.hstsIncludeSubdomains]
 * @param {boolean} [opts.hstsPreload]
 * @param {string} [opts.frameOptions]     - X-Frame-Options value (or null to disable)
 * @param {string} [opts.cspReportUri]     - CSP violation report URI
 * @param {boolean} [opts.cspReportOnlyMode] - Use CSP-Report-Only header
 * @param {object} [opts.cspOverrides]     - CSP directive overrides applied globally
 * @param {object} [opts.permissionsPolicy] - Permissions-Policy overrides
 * @param {boolean} [opts.requireAuth]     - If true, set Cache-Control: no-store
 * @param {Function} [opts.isAuthenticated] - fn(req) → bool; determine if route is authenticated
 * @returns {Function} Express middleware
 */
function securityHeaders(opts = {}) {
  const config = { ...DEFAULTS, ...opts };
  const permPolicy = buildPermissionsPolicy({ ...DEFAULTS.permissionsPolicy, ...(opts.permissionsPolicy || {}) });
  const reportTo   = buildReportTo(config.reportToGroupName, config.reportToEndpoint, config.reportToMaxAge);

  // Build HSTS value
  let hsts = `max-age=${config.hstsMaxAge}`;
  if (config.hstsIncludeSubdomains) hsts += '; includeSubDomains';
  if (config.hstsPreload)           hsts += '; preload';

  return (req, res, next) => {
    // ── Generate per-request CSP nonce ──────────────────────────────────
    const nonce = generateNonce();
    res.locals.cspNonce = nonce;

    // ── Determine if route is authenticated ──────────────────────────────
    const isAuth = typeof config.isAuthenticated === 'function'
      ? config.isAuthenticated(req)
      : !!(req.user || req.session?.userId);

    // ── Build CSP (allow per-request overrides via res.locals.cspOverrides) ──
    const cspValue = buildCSP(nonce, { ...config.cspOverrides, ...res.locals.cspOverrides }, config.cspReportUri);

    // ── Set headers ──────────────────────────────────────────────────────

    // Transport Security
    res.set('Strict-Transport-Security', hsts);

    // Content Security Policy
    const cspHeaderName = config.cspReportOnlyMode ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
    res.set(cspHeaderName, cspValue);

    // Content type sniffing prevention
    res.set('X-Content-Type-Options', 'nosniff');

    // Frame embedding prevention
    if (config.frameOptions) {
      res.set('X-Frame-Options', config.frameOptions);
    }

    // XSS Protection — explicitly disable; CSP is the modern replacement
    res.set('X-XSS-Protection', '0');

    // Referrer Policy
    res.set('Referrer-Policy', config.referrerPolicy);

    // Permissions Policy
    res.set('Permissions-Policy', permPolicy);

    // Cross-Origin Policies
    res.set('Cross-Origin-Opener-Policy',   config.crossOriginOpenerPolicy);
    res.set('Cross-Origin-Embedder-Policy', config.crossOriginEmbedderPolicy);
    res.set('Cross-Origin-Resource-Policy', config.crossOriginResourcePolicy);

    // Cache Control
    if (isAuth || config.requireAuth) {
      res.set('Cache-Control', config.cacheControlAuthenticated);
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    } else {
      res.set('Cache-Control', config.cacheControlPublic);
    }

    // DNS Prefetch Control
    res.set('X-DNS-Prefetch-Control', 'off');

    // Report-To (for CSP violation collection + other reporting APIs)
    res.set('Report-To', reportTo);

    // Request ID — use existing or generate new
    const requestId = req.id
      || req.headers[config.requestIdHeader.toLowerCase()]
      || req.headers['x-request-id']
      || crypto.randomUUID();

    req.id = requestId;
    res.set(config.requestIdHeader, requestId);

    // Remove server info headers (defense in depth)
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    next();
  };
}

// ─── Per-Route Frame Options Middleware ───────────────────────────────────────

/**
 * Override X-Frame-Options on a per-route basis.
 * Use to allow specific embed targets.
 *
 * @param {'DENY'|'SAMEORIGIN'|string} value  - 'ALLOW-FROM uri' for legacy
 * @returns {Function} Express middleware
 */
function frameOptions(value) {
  return (req, res, next) => {
    if (value === null) {
      res.removeHeader('X-Frame-Options');
    } else {
      res.set('X-Frame-Options', value);
    }
    next();
  };
}

/**
 * Per-route CSP override middleware.
 * Merges additional CSP directives for a specific route (e.g., to allow specific embed).
 *
 * @param {object} directives  - CSP directive overrides
 * @returns {Function} Express middleware
 */
function cspOverride(directives) {
  return (req, res, next) => {
    res.locals.cspOverrides = { ...(res.locals.cspOverrides || {}), ...directives };
    next();
  };
}

// ─── CSP Violation Report Handler ────────────────────────────────────────────

/**
 * Express route handler for CSP violation reports.
 * Mount at the same path as cspReportUri.
 *
 * @param {object} [opts]
 * @param {Function} [opts.onViolation]  - Callback(report, req)
 * @returns {Function} Express route handler
 */
function cspViolationHandler(opts = {}) {
  return (req, res) => {
    const report = req.body?.['csp-report'] || req.body || {};

    // Minimal validation
    if (!report['document-uri'] && !report['blocked-uri']) {
      return res.status(204).end();
    }

    const violation = {
      timestamp:     new Date().toISOString(),
      documentUri:   report['document-uri'],
      referrer:      report['referrer'],
      violatedDir:   report['violated-directive'],
      effectiveDir:  report['effective-directive'],
      originalPolicy: report['original-policy'],
      blockedUri:    report['blocked-uri'],
      statusCode:    report['status-code'],
      scriptSample:  report['script-sample'],
      ip:            req.ip || req.headers['x-forwarded-for'],
      userAgent:     req.headers['user-agent'],
      requestId:     req.id,
    };

    // Call optional handler
    if (typeof opts.onViolation === 'function') {
      try { opts.onViolation(violation, req); } catch {}
    }

    // Default: log to stderr
    console.warn('[CSP-VIOLATION]', JSON.stringify(violation));

    res.status(204).end();
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  securityHeaders,
  frameOptions,
  cspOverride,
  cspViolationHandler,
  generateNonce,
  buildCSP,
  buildPermissionsPolicy,
  buildReportTo,
  DEFAULTS,
};

// ─── Usage Example ────────────────────────────────────────────────────────────
/*
const express = require('express');
const { securityHeaders, cspViolationHandler, frameOptions } = require('./security-headers');

const app = express();

// Apply to all routes
app.use(securityHeaders({
  cspReportUri:     '/.well-known/csp-violations',
  isAuthenticated:  (req) => !!req.user,
  // Allow specific analytics domains in connect-src
  cspOverrides: {
    'connect-src': ["'self'", 'https://api.headyme.com', 'https://telemetry.headysystems.com'],
  },
}));

// CSP violation handler
app.post('/.well-known/csp-violations',
  express.json({ type: ['application/json', 'application/csp-report'] }),
  cspViolationHandler({ onViolation: (v) => auditLogger.log({ action: 'CSP_VIOLATION', metadata: v }) })
);

// Override frame options for specific embeddable page
app.get('/embed/widget', frameOptions('SAMEORIGIN'), (req, res) => {
  // This page can be embedded in same-origin iframes
  res.send(`<script nonce="${res.locals.cspNonce}">console.log('widget')</script>`);
});
*/
