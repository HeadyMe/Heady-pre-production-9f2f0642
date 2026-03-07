/**
 * HeadySystems Site Router
 * ============================================================================
 * Express middleware extending services/heady-web/
 *
 * Inspects req.hostname and routes to the correct vertical's static files
 * and injects vertical-specific meta tags, analytics, and branding.
 *
 * Routing priority:
 *   1. Exact domain match  (health.headyme.com → healthcare vertical)
 *   2. Subdomain wildcard  (*.headyme.com → vertical lookup by subdomain prefix)
 *   3. Path prefix         (/healthcare, /legal, etc.)
 *   4. Fallback            → headyme.com (main site)
 *
 * Usage:
 *   const { createSiteRouter } = require('./deployment/site-router');
 *   app.use(createSiteRouter());
 * ============================================================================
 */

'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const NodeCache = require('node-cache');   // npm i node-cache
const morgan = require('morgan');           // npm i morgan (already in heady-web)

// ── Constants ─────────────────────────────────────────────────────────────────

const SITES_DIR = process.env.SITES_DIR || path.join(__dirname, '..', 'sites');
const VERTICAL_REGISTRY_PATH =
  process.env.VERTICAL_REGISTRY ||
  path.join(__dirname, '..', 'vertical-registry.json');
const FALLBACK_DOMAIN = process.env.FALLBACK_DOMAIN || 'headyme.com';
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '300', 10); // seconds
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'production';

// ── In-memory caches ──────────────────────────────────────────────────────────

/** Registry cache: verticals keyed by domain and by vertical_id */
const registryCache = new NodeCache({ stdTTL: CACHE_TTL, checkperiod: 60 });

/** Static file cache: rendered HTML with injected meta tags */
const htmlCache = new NodeCache({
  stdTTL: NODE_ENV === 'production' ? 600 : 10,
  checkperiod: 60,
  maxKeys: 200,
});

// ── Registry loading ──────────────────────────────────────────────────────────

/**
 * Load and parse the vertical registry.
 * Returns { byDomain, byId, bySubdomain, byPath } lookup maps.
 * @returns {Promise<RegistryIndex>}
 */
async function loadRegistry() {
  const cached = registryCache.get('index');
  if (cached) return cached;

  let raw;
  try {
    raw = await fsPromises.readFile(VERTICAL_REGISTRY_PATH, 'utf8');
  } catch (err) {
    console.warn(`[site-router] No vertical registry at ${VERTICAL_REGISTRY_PATH}, using empty registry.`);
    raw = '{"verticals":[]}';
  }

  const data = JSON.parse(raw);
  const verticals = data.verticals || [];

  /** @type {RegistryIndex} */
  const index = {
    byDomain: {},
    byId: {},
    bySubdomain: {},
    byPath: {},
    all: verticals,
  };

  for (const v of verticals) {
    if (!v.id || !v.domain) continue;

    // Exact domain match
    index.byDomain[v.domain.toLowerCase()] = v;

    // Vertical ID lookup
    index.byId[v.id.toLowerCase()] = v;

    // Subdomain prefix (e.g. "health" from "health.headyme.com")
    const subdomain = v.domain.split('.')[0].toLowerCase();
    index.bySubdomain[subdomain] = v;

    // Path-based routing (e.g. /healthcare → healthcare vertical)
    const pathKey = (v.fallback_path || `/${v.id}`).replace(/^\/+/, '');
    index.byPath[pathKey] = v;
  }

  registryCache.set('index', index);
  return index;
}

/**
 * Force-reload the registry (call on SIGHUP or file change).
 */
function invalidateRegistry() {
  registryCache.del('index');
  htmlCache.flushAll();
  console.info('[site-router] Registry cache invalidated.');
}

// ── Domain → Vertical resolution ─────────────────────────────────────────────

/**
 * Given a hostname, find the matching vertical config.
 * @param {string} hostname - e.g. "health.headyme.com" or "headyme.com"
 * @param {RegistryIndex} index
 * @returns {VerticalConfig|null}
 */
function resolveVerticalByDomain(hostname, index) {
  const host = hostname.toLowerCase().split(':')[0]; // strip port

  // 1. Exact domain match
  if (index.byDomain[host]) return index.byDomain[host];

  // 2. Subdomain wildcard match (*.headyme.com)
  const parts = host.split('.');
  if (parts.length >= 3) {
    const subdomain = parts[0];
    if (index.bySubdomain[subdomain]) return index.bySubdomain[subdomain];
  }

  return null;
}

/**
 * Given a URL path, find the matching vertical.
 * @param {string} urlPath - e.g. "/healthcare/features"
 * @param {RegistryIndex} index
 * @returns {VerticalConfig|null}
 */
function resolveVerticalByPath(urlPath, index) {
  const segments = urlPath.replace(/^\/+/, '').split('/');
  const firstSegment = segments[0].toLowerCase();
  return index.byPath[firstSegment] || index.byId[firstSegment] || null;
}

// ── Site path resolution ──────────────────────────────────────────────────────

/**
 * Get the filesystem path for a vertical's site files.
 * @param {VerticalConfig|null} vertical
 * @returns {string} Absolute path to the vertical's directory
 */
function getVerticalDir(vertical) {
  if (!vertical) {
    // Fallback: main headyme.com site
    return path.join(SITES_DIR, 'A2-websites', 'headyme');
  }

  // Check A3-verticals first
  const verticalPath = path.join(SITES_DIR, 'A3-verticals', vertical.id);
  if (fs.existsSync(verticalPath)) return verticalPath;

  // Check A2-websites for legacy domains
  const legacyPath = path.join(SITES_DIR, 'A2-websites', vertical.id);
  if (fs.existsSync(legacyPath)) return legacyPath;

  console.warn(`[site-router] No site files found for vertical '${vertical.id}' — using fallback`);
  return path.join(SITES_DIR, 'A2-websites', 'headyme');
}

// ── Meta tag injection ────────────────────────────────────────────────────────

/**
 * Inject vertical-specific meta tags and analytics into an HTML string.
 * Replaces placeholders or inserts before </head>.
 * @param {string} html
 * @param {VerticalConfig} vertical
 * @param {string} requestPath
 * @returns {string}
 */
function injectVerticalMeta(html, vertical, requestPath) {
  const meta = vertical.meta || {};
  const brand = vertical.brand || {};

  const canonicalUrl = `https://${vertical.domain}${requestPath === '/' ? '' : requestPath}`;

  const injected = `
    <!-- HeadySystems Site Router: Vertical Meta Injection -->
    <meta name="vertical-id" content="${escapeHtml(vertical.id)}">
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
    ${meta.analytics_id ? `
    <!-- Google Analytics: ${escapeHtml(meta.analytics_id)} -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(meta.analytics_id)}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${escapeHtml(meta.analytics_id)}', { page_path: '${escapeHtml(requestPath)}' });
    </script>` : ''}
    <script>
      window.__HEADY_VERTICAL__ = ${JSON.stringify({
        id: vertical.id,
        domain: vertical.domain,
        name: brand.name || 'HeadySystems',
        accentColor: brand.accent_color || '#06b6d4',
        env: NODE_ENV,
      })};
    </script>
  `;

  // Inject before </head>
  if (html.includes('</head>')) {
    return html.replace('</head>', `${injected}\n</head>`);
  }

  // If no </head> tag, prepend to body
  return injected + html;
}

/**
 * Escape HTML special characters for safe attribute injection.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Core middleware factory ────────────────────────────────────────────────────

/**
 * Create the site router middleware.
 *
 * @param {SiteRouterOptions} [options]
 * @returns {express.Router}
 */
function createSiteRouter(options = {}) {
  const router = express.Router();

  const {
    enablePathRouting = true,
    enableSubdomainRouting = true,
    enableHtmlInjection = true,
    onVerticalResolved = null,   // Optional hook: (vertical, req) => void
    logger = console,
  } = options;

  // ── Request logging ──────────────────────────────────────────────────────
  if (NODE_ENV !== 'test') {
    router.use(
      morgan(':method :url :status :res[content-length] - :response-time ms', {
        skip: (req) => req.path === '/_health',
      })
    );
  }

  // ── Health check (before all routing logic) ────────────────────────────
  router.get('/_health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'heady-web',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      verticals: registryCache.has('index')
        ? (registryCache.get('index').all || []).length
        : null,
    });
  });

  // ── Registry reload endpoint (internal only) ────────────────────────────
  router.post('/_admin/reload-registry', (req, res) => {
    const authHeader = req.headers['x-heady-admin'];
    if (authHeader !== process.env.HEADY_ADMIN_SECRET) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    invalidateRegistry();
    res.json({ status: 'ok', message: 'Registry reloaded' });
  });

  // ── Main routing middleware ────────────────────────────────────────────
  router.use(async (req, res, next) => {
    let vertical = null;

    try {
      const index = await loadRegistry();
      const hostname = req.hostname || req.headers.host || '';

      // Step 1: Try domain-based resolution
      if (enableSubdomainRouting) {
        vertical = resolveVerticalByDomain(hostname, index);
      }

      // Step 2: Try path-based resolution if no domain match
      if (!vertical && enablePathRouting) {
        vertical = resolveVerticalByPath(req.path, index);
      }

      // Attach to request for downstream handlers
      req.vertical = vertical || null;
      req.headyIndex = index;

      if (vertical) {
        logger.debug?.(`[site-router] ${hostname}${req.path} → vertical: ${vertical.id}`);
      }

      // Optional hook for telemetry / A/B testing
      if (onVerticalResolved && vertical) {
        try { onVerticalResolved(vertical, req); } catch (_) {}
      }

    } catch (err) {
      logger.error(`[site-router] Registry load error: ${err.message}`);
      // Non-fatal: continue with null vertical (fallback to main site)
      req.vertical = null;
    }

    next();
  });

  // ── Static file serving ────────────────────────────────────────────────
  router.use(async (req, res, next) => {
    const vertical = req.vertical;
    const siteDir = getVerticalDir(vertical);

    // Strip vertical path prefix for path-based routing
    // e.g. /healthcare/features → /features within the healthcare site
    let servePath = req.path;
    if (vertical && enablePathRouting && !resolveVerticalByDomain(req.hostname, req.headyIndex || {})) {
      const prefix = (vertical.fallback_path || `/${vertical.id}`);
      if (servePath.startsWith(prefix)) {
        servePath = servePath.slice(prefix.length) || '/';
      }
    }

    // Normalize path to prevent directory traversal
    const normalized = path.normalize(servePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const targetFile = path.join(siteDir, normalized);

    // Security: ensure target is within siteDir
    if (!targetFile.startsWith(siteDir + path.sep) && targetFile !== siteDir) {
      return res.status(403).send('Forbidden');
    }

    // Check if file exists
    let stat;
    try {
      stat = await fsPromises.stat(targetFile);
    } catch (_) {
      stat = null;
    }

    // Directory: serve index.html
    const filePath = stat?.isDirectory()
      ? path.join(targetFile, 'index.html')
      : targetFile;

    // Check for index.html existence
    let fileStat;
    try {
      fileStat = await fsPromises.stat(filePath);
    } catch (_) {
      // File not found — try 404 page, then fallthrough
      const notFoundPath = path.join(siteDir, '404.html');
      if (fs.existsSync(notFoundPath)) {
        return res.status(404).sendFile(notFoundPath);
      }
      return next();
    }

    if (!fileStat.isFile()) return next();

    // Serve HTML with meta injection
    if (enableHtmlInjection && vertical && filePath.endsWith('.html')) {
      const cacheKey = `${vertical.id}:${filePath}`;
      let html = htmlCache.get(cacheKey);

      if (!html) {
        try {
          html = await fsPromises.readFile(filePath, 'utf8');
          html = injectVerticalMeta(html, vertical, req.path);
          htmlCache.set(cacheKey, html);
        } catch (err) {
          logger.error(`[site-router] HTML injection failed: ${err.message}`);
          return res.sendFile(filePath);
        }
      }

      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('X-Heady-Vertical', vertical.id);
      res.set('Cache-Control', NODE_ENV === 'production' ? 'public, max-age=300' : 'no-cache');
      return res.send(html);
    }

    // Serve non-HTML assets directly
    res.set('X-Heady-Vertical', vertical?.id || 'main');
    res.sendFile(filePath, { maxAge: NODE_ENV === 'production' ? '1d' : 0 });
  });

  // ── SPA fallback: serve index.html for unknown paths ─────────────────────
  router.use((req, res) => {
    const vertical = req.vertical;
    const siteDir = getVerticalDir(vertical);
    const indexPath = path.join(siteDir, 'index.html');

    if (fs.existsSync(indexPath)) {
      if (enableHtmlInjection && vertical) {
        (async () => {
          try {
            let html = await fsPromises.readFile(indexPath, 'utf8');
            html = injectVerticalMeta(html, vertical, req.path);
            res.set('Content-Type', 'text/html; charset=utf-8');
            res.set('X-Heady-Vertical', vertical.id);
            res.status(200).send(html);
          } catch (_) {
            res.sendFile(indexPath);
          }
        })();
      } else {
        res.sendFile(indexPath);
      }
    } else {
      res.status(404).json({
        error: 'Not Found',
        hostname: req.hostname,
        path: req.path,
        vertical: vertical?.id || null,
      });
    }
  });

  return router;
}

// ── Middleware for use directly with app.use() ────────────────────────────────

/**
 * Drop-in middleware version (no options).
 * Use: app.use(siteRouterMiddleware)
 */
const siteRouterMiddleware = createSiteRouter();

// ── Watch registry file for changes (dev mode) ───────────────────────────────

if (NODE_ENV === 'development' && fs.existsSync(VERTICAL_REGISTRY_PATH)) {
  fs.watch(VERTICAL_REGISTRY_PATH, (eventType) => {
    if (eventType === 'change') {
      console.info('[site-router] Registry file changed — reloading...');
      invalidateRegistry();
    }
  });
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

process.on('SIGHUP', () => {
  console.info('[site-router] SIGHUP received — reloading registry...');
  invalidateRegistry();
});

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  createSiteRouter,
  siteRouterMiddleware,
  loadRegistry,
  invalidateRegistry,
  resolveVerticalByDomain,
  resolveVerticalByPath,
  getVerticalDir,
  injectVerticalMeta,
};

// ── Type definitions (JSDoc) ──────────────────────────────────────────────────

/**
 * @typedef {Object} VerticalConfig
 * @property {string} id
 * @property {string} domain
 * @property {string} [fallback_path]
 * @property {boolean} [subdomain_routing]
 * @property {string} [status]
 * @property {{ name: string, accent_color: string, tagline: string }} [brand]
 * @property {{ title: string, description: string, analytics_id: string }} [meta]
 */

/**
 * @typedef {Object} RegistryIndex
 * @property {Object.<string, VerticalConfig>} byDomain
 * @property {Object.<string, VerticalConfig>} byId
 * @property {Object.<string, VerticalConfig>} bySubdomain
 * @property {Object.<string, VerticalConfig>} byPath
 * @property {VerticalConfig[]} all
 */

/**
 * @typedef {Object} SiteRouterOptions
 * @property {boolean} [enablePathRouting]
 * @property {boolean} [enableSubdomainRouting]
 * @property {boolean} [enableHtmlInjection]
 * @property {Function} [onVerticalResolved]
 * @property {Console} [logger]
 */
