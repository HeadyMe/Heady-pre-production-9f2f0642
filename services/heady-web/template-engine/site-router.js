/**
 * HeadySystems A1 Template Engine
 * site-router.js — Domain-Based Vertical Selection Middleware
 *
 * Express middleware that:
 *   1. Inspects req.hostname
 *   2. Resolves the vertical (brand domain or subdomain industry)
 *   3. Loads the vertical's configuration from vertical-registry.json + config files
 *   4. Attaches req.vertical (full config object) for downstream rendering
 *   5. Falls back to headyme.com config for unknown domains
 *
 * Supported domains:
 *   headyme.com                   → vertical: "headyme"       (personal productivity)
 *   headyos.com                   → vertical: "headyos"       (AI operating system)
 *   headysystems.com              → vertical: "headysystems"  (enterprise platform)
 *   headyai.com                   → vertical: "headyai"       (AI services)
 *   headyconnection.com           → vertical: "headyconnection"
 *   headyconnection.org           → vertical: "headyconnection" (alias)
 *   heady.exchange                → vertical: "exchange"
 *   heady.investments             → vertical: "investments"
 *
 * Subdomain industry verticals (all under headyme.com):
 *   health.headyme.com            → vertical: "health"
 *   legal.headyme.com             → vertical: "legal"
 *   finance.headyme.com           → vertical: "finance"
 *   realestate.headyme.com        → vertical: "realestate"
 *   education.headyme.com         → vertical: "education"
 *   wellness.headyme.com          → vertical: "wellness"
 *
 * Usage:
 *   const express = require('express');
 *   const { verticalRouter } = require('./site-router');
 *
 *   const app = express();
 *   app.use(verticalRouter());
 *
 *   app.get('/', (req, res) => {
 *     console.log(req.vertical);  // { id, domain, brand, content, meta, navigation, ... }
 *     res.render('template', { vertical: req.vertical });
 *   });
 *
 * Environment Variables:
 *   VERTICAL_REGISTRY_PATH   — path to vertical-registry.json (default: ./vertical-registry.json)
 *   VERTICAL_CONFIG_DIR      — base directory for per-vertical config files
 *   VERTICAL_CACHE_TTL       — seconds to cache loaded configs (default: 300)
 *   HEADY_ENV                — "development" | "staging" | "production"
 *   FORCE_VERTICAL           — override all routing (useful for local dev)
 */

'use strict';

const path    = require('path');
const fs      = require('fs');
const EventEmitter = require('events');

/* ─── Constants ──────────────────────────────────────────────── */

const DEFAULT_VERTICAL = 'headyme';
const DEFAULT_REGISTRY_PATH = path.resolve(__dirname, 'vertical-registry.json');
const DEFAULT_CONFIG_DIR    = path.resolve(__dirname, 'configs');
const DEFAULT_CACHE_TTL     = 300; // seconds

/* ─── VerticalResolver ───────────────────────────────────────── */

class VerticalResolver extends EventEmitter {
  constructor(options = {}) {
    super();

    this.registryPath  = options.registryPath  || process.env.VERTICAL_REGISTRY_PATH || DEFAULT_REGISTRY_PATH;
    this.configDir     = options.configDir     || process.env.VERTICAL_CONFIG_DIR    || DEFAULT_CONFIG_DIR;
    this.cacheTtl      = options.cacheTtl      || parseInt(process.env.VERTICAL_CACHE_TTL || String(DEFAULT_CACHE_TTL), 10);
    this.defaultVertical = options.defaultVertical || DEFAULT_VERTICAL;

    /** @type {Map<string, { config: Object, loadedAt: number }>} vertical config cache */
    this._configCache  = new Map();

    /** @type {Map<string, string>} hostname → vertical_id lookup table */
    this._hostnameMap  = new Map();

    /** @type {Object|null} parsed registry */
    this._registry     = null;

    /** @type {number} registry last loaded timestamp */
    this._registryLoadedAt = 0;

    this._loaded = false;
  }

  /**
   * Load (or reload) the vertical registry from disk.
   * Rebuilds the hostname lookup map.
   *
   * @returns {Object} registry
   * @throws {Error} if registry cannot be parsed
   */
  _loadRegistry() {
    const now = Date.now();
    if (this._loaded && (now - this._registryLoadedAt) < this.cacheTtl * 1000) {
      return this._registry;
    }

    let raw;
    try {
      raw = fs.readFileSync(this.registryPath, 'utf8');
    } catch (err) {
      if (!this._registry) {
        // First load failure — create empty registry
        console.error(`[HeadySystems] vertical-registry.json not found at ${this.registryPath}. Using empty registry.`);
        this._registry = { verticals: [] };
        this._loaded = true;
        return this._registry;
      }
      // Subsequent failure — keep stale registry
      console.warn(`[HeadySystems] Could not reload vertical-registry.json: ${err.message}`);
      return this._registry;
    }

    try {
      this._registry = JSON.parse(raw);
    } catch (parseErr) {
      throw new Error(`[HeadySystems] vertical-registry.json parse error: ${parseErr.message}`);
    }

    // Rebuild hostname → vertical_id map
    this._hostnameMap.clear();

    (this._registry.verticals || []).forEach(entry => {
      // Primary domain
      if (entry.domain) {
        this._hostnameMap.set(this._normHost(entry.domain), entry.vertical_id);
      }
      // Alias domains
      if (Array.isArray(entry.aliases)) {
        entry.aliases.forEach(alias => {
          this._hostnameMap.set(this._normHost(alias), entry.vertical_id);
        });
      }
    });

    this._registryLoadedAt = now;
    this._loaded = true;
    this.emit('registry:loaded', this._registry);
    return this._registry;
  }

  /**
   * Normalize a hostname for comparison:
   *   - lowercase
   *   - strip trailing dot
   *   - strip www. prefix (unless the domain is www.example.com and that's its own entry)
   *
   * @param {string} host
   * @returns {string}
   */
  _normHost(host) {
    return host.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  }

  /**
   * Resolve req.hostname to a vertical_id.
   *
   * Resolution order:
   *   1. FORCE_VERTICAL env var (dev override)
   *   2. Exact hostname match in registry
   *   3. Subdomain industry match (e.g. health.headyme.com → "health")
   *   4. Parent domain match (e.g. api.headyos.com → "headyos")
   *   5. Default vertical
   *
   * @param {string} hostname — from req.hostname (Express already strips port)
   * @returns {string} vertical_id
   */
  resolveVerticalId(hostname) {
    // Dev override
    if (process.env.FORCE_VERTICAL) {
      return process.env.FORCE_VERTICAL;
    }

    this._loadRegistry();

    const norm = this._normHost(hostname || '');

    // 1. Exact match
    if (this._hostnameMap.has(norm)) {
      return this._hostnameMap.get(norm);
    }

    // 2. Industry subdomain matching: e.g. "health.headyme.com"
    const parts = norm.split('.');
    if (parts.length >= 3) {
      const subdomain = parts[0];
      const baseDomain = parts.slice(1).join('.');

      // Check if base domain is a known heady domain
      const baseVerticalId = this._hostnameMap.get(baseDomain);
      if (baseVerticalId) {
        // Check if subdomain is a registered industry vertical
        const industryVerticalId = this._resolveIndustrySubdomain(subdomain, baseVerticalId);
        if (industryVerticalId) return industryVerticalId;
      }
    }

    // 3. Parent domain fallback (strip deepest subdomain, recurse once)
    if (parts.length > 2) {
      const parent = parts.slice(1).join('.');
      if (this._hostnameMap.has(parent)) {
        return this._hostnameMap.get(parent);
      }
    }

    // 4. Default
    return this.defaultVertical;
  }

  /**
   * Map known industry subdomains to their vertical_id.
   * These subdomains represent Heady's industry verticals.
   *
   * @param {string} subdomain — e.g. "health", "legal"
   * @param {string} _parentVerticalId — parent domain's vertical (unused currently)
   * @returns {string|null}
   */
  _resolveIndustrySubdomain(subdomain, _parentVerticalId) {
    const industryMap = {
      health:      'health',
      wellness:    'wellness',
      legal:       'legal',
      law:         'legal',
      finance:     'finance',
      financial:   'finance',
      investing:   'investments',
      invest:      'investments',
      realestate:  'realestate',
      property:    'realestate',
      education:   'education',
      learn:       'education',
      edu:         'education',
      hr:          'hr',
      people:      'hr',
      logistics:   'logistics',
      supply:      'logistics',
      retail:      'retail',
      shop:        'retail',
    };

    return industryMap[subdomain.toLowerCase()] || null;
  }

  /**
   * Load the full configuration object for a vertical_id.
   * Merges: base registry entry + optional per-vertical config file.
   *
   * @param {string} verticalId
   * @returns {Object} complete vertical config
   */
  loadVerticalConfig(verticalId) {
    // Check cache
    const cached = this._configCache.get(verticalId);
    if (cached && (Date.now() - cached.loadedAt) < this.cacheTtl * 1000) {
      return cached.config;
    }

    this._loadRegistry();

    // Find registry entry
    const entry = (this._registry.verticals || []).find(v => v.vertical_id === verticalId);
    if (!entry) {
      console.warn(`[HeadySystems] Unknown vertical_id "${verticalId}", falling back to "${this.defaultVertical}"`);
      return this.loadVerticalConfig(this.defaultVertical);
    }

    // Start with registry entry as base config
    let config = { ...entry };

    // Attempt to load per-vertical config file
    if (entry.config_path) {
      const configFilePath = path.isAbsolute(entry.config_path)
        ? entry.config_path
        : path.resolve(this.configDir, entry.config_path);

      if (fs.existsSync(configFilePath)) {
        try {
          const fileContent = fs.readFileSync(configFilePath, 'utf8');
          const fileConfig  = JSON.parse(fileContent);
          // Deep merge: file config overrides registry entry
          config = deepMerge(config, fileConfig);
        } catch (err) {
          console.error(`[HeadySystems] Failed to load config at ${configFilePath}: ${err.message}`);
        }
      }
    }

    // Normalize config to ensure all required fields exist
    config = normalizeConfig(config, verticalId);

    // Cache
    this._configCache.set(verticalId, { config, loadedAt: Date.now() });
    this.emit('config:loaded', { verticalId, config });

    return config;
  }

  /**
   * Invalidate cache for a specific vertical (or all if no id given).
   * @param {string} [verticalId]
   */
  invalidateCache(verticalId) {
    if (verticalId) {
      this._configCache.delete(verticalId);
    } else {
      this._configCache.clear();
      this._loaded = false;
    }
  }

  /**
   * Return a middleware function for use with Express.
   * Attaches req.vertical and req.verticalId.
   *
   * @returns {Function} Express middleware (req, res, next)
   */
  middleware() {
    return (req, res, next) => {
      try {
        const hostname   = req.hostname || req.headers.host || '';
        const verticalId = this.resolveVerticalId(hostname);
        const config     = this.loadVerticalConfig(verticalId);

        req.verticalId = verticalId;
        req.vertical   = config;

        // Set some useful response headers for debugging
        if (process.env.HEADY_ENV !== 'production') {
          res.setHeader('X-Heady-Vertical', verticalId);
          res.setHeader('X-Heady-Domain', hostname);
        }

        // Expose vertical to template engines
        res.locals.vertical   = config;
        res.locals.verticalId = verticalId;

        next();
      } catch (err) {
        console.error('[HeadySystems] verticalRouter error:', err);
        // Attempt graceful degradation with default vertical
        try {
          req.verticalId = this.defaultVertical;
          req.vertical   = this.loadVerticalConfig(this.defaultVertical);
          res.locals.vertical   = req.vertical;
          res.locals.verticalId = req.verticalId;
        } catch (fallbackErr) {
          console.error('[HeadySystems] Fatal: cannot load default vertical config:', fallbackErr);
          req.vertical   = buildEmptyConfig(this.defaultVertical);
          res.locals.vertical = req.vertical;
        }
        next();
      }
    };
  }
}

/* ─── Factory function ───────────────────────────────────────── */

/**
 * Create and return a configured Express middleware.
 *
 * @param {Object} [options]
 * @param {string} [options.registryPath]
 * @param {string} [options.configDir]
 * @param {number} [options.cacheTtl]
 * @param {string} [options.defaultVertical]
 * @returns {Function} Express middleware
 */
function verticalRouter(options) {
  const resolver = new VerticalResolver(options);
  return resolver.middleware();
}

/* ─── Config Normalization ───────────────────────────────────── */

/**
 * Ensure a config object has all required fields, filling missing
 * fields with sensible defaults derived from the vertical_id.
 *
 * @param {Object} raw
 * @param {string} verticalId
 * @returns {Object}
 */
function normalizeConfig(raw, verticalId) {
  return {
    // Identity
    id:          raw.vertical_id || verticalId,
    domain:      raw.domain      || `${verticalId}.com`,
    status:      raw.status      || 'planned',
    deployed_at: raw.deployed_at || null,

    // Brand
    brand: {
      name:      raw.brand?.name     || titleCase(verticalId),
      tagline:   raw.brand?.tagline  || '',
      logo:      raw.brand?.logo     || null,
      favicon:   raw.brand?.favicon  || '/favicon.ico',
      colors: {
        primary:   raw.brand?.colors?.primary   || '#0a0e17',
        secondary: raw.brand?.colors?.secondary || '#0d1321',
        accent:    raw.brand?.colors?.accent    || '#2dd4bf',
      },
    },

    // Content
    content: {
      hero: {
        title:           raw.content?.hero?.title           || '',
        subtitle:        raw.content?.hero?.subtitle        || '',
        cta_text:        raw.content?.hero?.cta_text        || 'Get Started',
        cta_url:         raw.content?.hero?.cta_url         || '/signup',
        background_type: raw.content?.hero?.background_type || 'sacred-geometry',
      },
      features:  raw.content?.features  || [],
      pricing: {
        enabled: raw.content?.pricing?.enabled !== false,
        tiers:   raw.content?.pricing?.tiers   || [],
      },
      testimonials: raw.content?.testimonials || [],
      metrics:      raw.content?.metrics      || [],
    },

    // SEO meta
    meta: {
      title:          raw.meta?.title          || `${titleCase(verticalId)} — HeadySystems`,
      description:    raw.meta?.description    || '',
      og_image:       raw.meta?.og_image       || '/og-default.png',
      twitter_handle: raw.meta?.twitter_handle || '@headysystems',
      analytics_id:   raw.meta?.analytics_id   || null,
      canonical_url:  raw.meta?.canonical_url  || `https://${raw.domain || verticalId + '.com'}`,
    },

    // Navigation
    navigation: {
      items: raw.navigation?.items || [],
    },

    // Footer
    footer: {
      columns:      raw.footer?.columns      || [],
      social_links: raw.footer?.social_links || [],
      legal_links:  raw.footer?.legal_links  || [
        { label: 'Privacy Policy', url: '/privacy' },
        { label: 'Terms of Service', url: '/terms' },
      ],
    },

    // Compliance
    compliance: {
      badges: raw.compliance?.badges || [],
    },

    // Custom CSS override (vertical-specific style tweaks)
    custom_css: raw.custom_css || '',

    // Design system hint
    design: {
      theme:          raw.design?.theme          || 'dark',
      accent_variant: raw.design?.accent_variant || 'teal',
      data_vertical:  raw.design?.data_vertical  || verticalId,
    },
  };
}

/**
 * Build a minimal empty config for absolute fallback situations.
 */
function buildEmptyConfig(verticalId) {
  return normalizeConfig({ vertical_id: verticalId }, verticalId);
}

/* ─── Deep Merge Utility ─────────────────────────────────────── */

/**
 * Deep merge two objects. Arrays in `override` fully replace arrays in `base`.
 * @param {Object} base
 * @param {Object} override
 * @returns {Object}
 */
function deepMerge(base, override) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    return override !== undefined ? override : base;
  }
  const result = { ...base };
  Object.keys(override).forEach(key => {
    const bVal = base[key];
    const oVal = override[key];
    if (oVal !== null && typeof oVal === 'object' && !Array.isArray(oVal) &&
        bVal !== null && typeof bVal === 'object' && !Array.isArray(bVal)) {
      result[key] = deepMerge(bVal, oVal);
    } else {
      result[key] = oVal;
    }
  });
  return result;
}

/* ─── String Utilities ───────────────────────────────────────── */

function titleCase(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ─── Health Check Helper ────────────────────────────────────── */

/**
 * Express route handler for /health/vertical
 * Returns resolved vertical info as JSON.
 * Useful for debugging routing in staging.
 *
 * Usage:
 *   app.get('/health/vertical', verticalHealthCheck(resolver));
 */
function verticalHealthCheck(resolver) {
  return (req, res) => {
    const hostname   = req.hostname || req.headers.host || '';
    const verticalId = resolver.resolveVerticalId(hostname);
    const config     = resolver.loadVerticalConfig(verticalId);
    res.json({
      hostname,
      verticalId,
      domain:   config.domain,
      status:   config.status,
      brand:    config.brand?.name,
      env:      process.env.HEADY_ENV || 'development',
      force:    process.env.FORCE_VERTICAL || null,
    });
  };
}

/* ─── Watch mode (development) ───────────────────────────────── */

/**
 * Watch the registry file for changes and auto-invalidate the cache.
 * Only call this in development environments.
 *
 * @param {VerticalResolver} resolver
 * @returns {{ stop: Function }}
 */
function watchRegistry(resolver) {
  let watcher = null;

  try {
    watcher = fs.watch(resolver.registryPath, { persistent: false }, (eventType) => {
      if (eventType === 'change') {
        console.log('[HeadySystems] vertical-registry.json changed — reloading');
        resolver.invalidateCache();
      }
    });
  } catch (err) {
    console.warn(`[HeadySystems] Could not watch registry file: ${err.message}`);
  }

  return {
    stop() {
      if (watcher) {
        watcher.close();
        watcher = null;
      }
    },
  };
}

/* ─── Exports ────────────────────────────────────────────────── */

module.exports = {
  VerticalResolver,
  verticalRouter,
  verticalHealthCheck,
  watchRegistry,
  deepMerge,
  normalizeConfig,
};
