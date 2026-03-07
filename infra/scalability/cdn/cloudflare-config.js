'use strict';
/**
 * @module cloudflare-config
 * @description Cloudflare configuration module for HeadySystems
 *
 * Covers:
 *   - Page rules for all 9 domains
 *   - Edge functions for API caching + geolocation routing
 *   - Cache-Tag based purging
 *   - φ-scaled rate limiting rules
 *   - Geographic routing preferences
 *   - Security headers (HSTS, CSP, X-Frame-Options, etc.)
 *
 * φ = 1.618033988749895
 * Rate limits: Fibonacci burst series (fib(5)=5 to fib(16)=987)
 */

const PHI = 1.618033988749895;
const FIB = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181,6765];

// ─────────────────────────────────────────────────────────────────────────────
// Domains
// ─────────────────────────────────────────────────────────────────────────────

/** All 9 HeadySystems domains */
const DOMAINS = {
  primary:     'headyme.com',
  connection:  'headyconnection.com',
  connectionOrg: 'headyconnection.org',
  os:          'headyos.com',
  exchange:    'heady.exchange',
  investments: 'heady.investments',
  systems:     'headysystems.com',
  ai:          'headyai.com',
  admin:       'admin.headyme.com',
};

// ─────────────────────────────────────────────────────────────────────────────
// Security Headers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard security headers for all Heady properties.
 * HSTS max-age uses fib(14)=377 days × 86400s = 32,572,800s
 */
const SECURITY_HEADERS = {
  'Strict-Transport-Security':
    `max-age=${FIB[14] * 86400}; includeSubDomains; preload`,
  // max-age = 377 * 86400 = 32,572,800 seconds

  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.headyme.com wss://headyme.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; '),

  'X-Frame-Options':           'DENY',
  'X-Content-Type-Options':    'nosniff',
  'X-XSS-Protection':          '1; mode=block',
  'Referrer-Policy':           'strict-origin-when-cross-origin',
  'Permissions-Policy':        'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-site',
};

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiting Rules (φ-scaled)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * φ-scaled rate limiting configuration.
 * Thresholds use Fibonacci numbers scaled by the plan tier.
 *
 * Burst limits per 10s window:
 *   Anonymous:   fib(7)=13  req / 10s
 *   Free:        fib(9)=34  req / 10s
 *   Pro:         fib(11)=89 req / 10s
 *   Enterprise:  fib(13)=233 req / 10s
 *   API (keyed): fib(15)=610 req / 10s
 */
const RATE_LIMIT_RULES = [
  {
    id:          'rl-anonymous',
    description: 'Anonymous traffic — fib(7)=13 req/10s',
    expression:  '(not cf.edge.server_port in {443})',
    action:      'block',
    characteristics: ['ip.src'],
    period:      10,
    requestsPerPeriod: FIB[7],    // 13
    mitigation: {
      timeout:   FIB[9],          // 34s block duration
    },
  },
  {
    id:          'rl-api-unauthenticated',
    description: 'Unauthenticated API calls — fib(9)=34 req/10s',
    expression:  '(http.request.uri.path matches "^/api/") and (not http.request.headers["authorization"] exists)',
    action:      'challenge',
    characteristics: ['ip.src'],
    period:      10,
    requestsPerPeriod: FIB[9],    // 34
    mitigation: {
      timeout:   FIB[10],         // 55s
    },
  },
  {
    id:          'rl-api-authenticated',
    description: 'Authenticated API calls — fib(11)=89 req/10s',
    expression:  '(http.request.uri.path matches "^/api/") and (http.request.headers["authorization"] exists)',
    action:      'block',
    characteristics: ['ip.src', 'http.request.headers["authorization"]'],
    period:      10,
    requestsPerPeriod: FIB[11],   // 89
    mitigation: {
      timeout:   FIB[8],          // 21s
    },
  },
  {
    id:          'rl-api-enterprise',
    description: 'Enterprise tier — fib(13)=233 req/10s',
    expression:  '(http.request.headers["x-heady-tier"] eq "enterprise")',
    action:      'log',           // monitor only for enterprise
    characteristics: ['ip.src', 'http.request.headers["x-heady-api-key"]'],
    period:      10,
    requestsPerPeriod: FIB[13],   // 233
  },
  {
    id:          'rl-inference',
    description: 'Inference endpoint — fib(6)=8 req/10s (expensive)',
    expression:  '(http.request.uri.path matches "^/api/v[0-9]+/infer")',
    action:      'block',
    characteristics: ['ip.src', 'http.request.headers["x-heady-api-key"]'],
    period:      10,
    requestsPerPeriod: FIB[6],    // 8
    mitigation: {
      timeout:   FIB[10],         // 55s
    },
  },
  {
    id:          'rl-websocket',
    description: 'WebSocket upgrade — fib(5)=5 connections/10s per IP',
    expression:  '(http.request.headers["upgrade"] eq "websocket")',
    action:      'block',
    characteristics: ['ip.src'],
    period:      10,
    requestsPerPeriod: FIB[5],    // 5
    mitigation: {
      timeout:   FIB[8],          // 21s
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Page Rules
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Page rules for each domain.
 * Cache TTL uses fib(10)=55s for dynamic, fib(13)=233s for static assets.
 */
const PAGE_RULES = {
  [DOMAINS.primary]: [
    {
      id:      'headyme-api-nocache',
      match:   'headyme.com/api/*',
      actions: {
        cacheLevel:       'bypass',
        securityLevel:    'high',
        browserCheck:     'on',
        ssl:              'full_strict',
      },
    },
    {
      id:      'headyme-static-cache',
      match:   'headyme.com/_next/static/*',
      actions: {
        cacheLevel:  'cache_everything',
        edgeTtl:     { type: 'override', value: FIB[14] * 86400 }, // 377 days
        browserTtl:  { type: 'override', value: FIB[13] * 86400 }, // 233 days
        polish:      'lossless',
      },
    },
    {
      id:      'headyme-app-pages',
      match:   'headyme.com/*',
      actions: {
        cacheLevel:    'standard',
        edgeTtl:       { type: 'override', value: FIB[10] },       // 55s
        minifyHtmlJs:  true,
        securityLevel: 'medium',
        ssl:           'full_strict',
      },
    },
  ],

  [DOMAINS.os]: [
    {
      id:      'headyos-docs-cache',
      match:   'headyos.com/docs/*',
      actions: {
        cacheLevel: 'cache_everything',
        edgeTtl:    { type: 'override', value: FIB[12] * 60 },    // 144 min
        browserTtl: { type: 'override', value: FIB[11] * 60 },    // 89 min
      },
    },
    {
      id:      'headyos-api-bypass',
      match:   'headyos.com/api/*',
      actions: { cacheLevel: 'bypass' },
    },
  ],

  [DOMAINS.exchange]: [
    {
      id:      'heady-exchange-api',
      match:   'heady.exchange/api/*',
      actions: {
        cacheLevel:    'bypass',
        securityLevel: 'high',
        waf:           'on',
      },
    },
    {
      id:      'heady-exchange-static',
      match:   'heady.exchange/assets/*',
      actions: {
        cacheLevel: 'cache_everything',
        edgeTtl:    { type: 'override', value: FIB[14] * 86400 },
      },
    },
  ],

  [DOMAINS.investments]: [
    {
      id:      'heady-investments-all',
      match:   'heady.investments/*',
      actions: {
        cacheLevel:    'bypass',
        securityLevel: 'high',
        waf:           'on',
        ssl:           'full_strict',
      },
    },
  ],

  [DOMAINS.admin]: [
    {
      id:      'admin-portal-all',
      match:   'admin.headyme.com/*',
      actions: {
        cacheLevel:    'bypass',
        securityLevel: 'under_attack',
        waf:           'on',
        browserCheck:  'on',
        ssl:           'full_strict',
      },
    },
  ],

  // Default rules for remaining domains (connection, systems, ai, connectionOrg)
  _default: [
    {
      id:      'default-static',
      match:   '*/assets/*',
      actions: {
        cacheLevel: 'cache_everything',
        edgeTtl:    { type: 'override', value: FIB[13] * 3600 },  // 233h
      },
    },
    {
      id:      'default-api',
      match:   '*/api/*',
      actions: { cacheLevel: 'bypass' },
    },
    {
      id:      'default-pages',
      match:   '*/*',
      actions: {
        cacheLevel: 'standard',
        edgeTtl:    { type: 'override', value: FIB[10] },          // 55s
        ssl:        'full_strict',
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Geographic Routing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Geolocation-based routing preferences.
 * Routes requests to the nearest Cloud Run region.
 */
const GEO_ROUTING = {
  rules: [
    {
      id:         'geo-north-america',
      continents: ['NA'],
      regions:    ['US', 'CA', 'MX'],
      upstream:   'us-central1.heady.internal',
      latencyBudgetMs: FIB[7],   // 13ms target
    },
    {
      id:         'geo-europe',
      continents: ['EU'],
      regions:    ['GB', 'DE', 'FR', 'NL', 'SE', 'CH', 'NO'],
      upstream:   'europe-west1.heady.internal',
      latencyBudgetMs: FIB[7],   // 13ms target
    },
    {
      id:         'geo-asia-pacific',
      continents: ['AS', 'OC'],
      regions:    ['JP', 'SG', 'AU', 'KR', 'IN', 'TW', 'HK'],
      upstream:   'asia-east1.heady.internal',
      latencyBudgetMs: FIB[8],   // 21ms target
    },
    {
      id:         'geo-fallback',
      continents: ['SA', 'AF', 'AN'],
      upstream:   'us-central1.heady.internal',
      latencyBudgetMs: FIB[9],   // 34ms — longer for remote regions
    },
  ],
  failoverChain: [
    'us-central1.heady.internal',
    'europe-west1.heady.internal',
    'asia-east1.heady.internal',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Edge Functions (Cloudflare Workers snippets)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Edge function: API response caching with φ-scaled TTL.
 * Deployed as a Cloudflare Worker on api.headyme.com/v1/public/*
 */
const EDGE_API_CACHE_WORKER = `
// Heady Edge API Cache Worker
// TTL: fib(10)=55s for public API endpoints
const PHI = 1.618033988749895;
const CACHE_TTL = 55; // fib(10)

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Only cache GET requests to /api/v*/public/*
    if (request.method !== 'GET' || !url.pathname.match(/^\\/api\\/v\\d+\\/public\\//)) {
      return fetch(request);
    }

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);

    // Check cache
    let response = await cache.match(cacheKey);
    if (response) {
      const headers = new Headers(response.headers);
      headers.set('X-Cache', 'HIT');
      headers.set('X-Cache-Layer', 'L3:cloudflare-edge');
      headers.set('X-Heady-Phi', PHI.toString());
      return new Response(response.body, { ...response, headers });
    }

    // Fetch from origin
    const originResponse = await fetch(request);
    if (originResponse.ok) {
      const responseToCache = new Response(originResponse.clone().body, originResponse);
      const headers = new Headers(responseToCache.headers);
      headers.set('Cache-Control', \`public, max-age=\${CACHE_TTL}, s-maxage=\${CACHE_TTL}\`);
      headers.set('X-Cache', 'MISS');
      headers.set('X-Cache-Layer', 'L3:cloudflare-edge');
      headers.set('X-Heady-Phi', PHI.toString());
      const cachedResponse = new Response(responseToCache.body, {
        status:  responseToCache.status,
        headers,
      });
      ctx.waitUntil(cache.put(cacheKey, cachedResponse.clone()));
      return cachedResponse;
    }
    return originResponse;
  },
};
`;

/**
 * Edge function: Geolocation routing worker.
 * Routes requests to nearest Cloud Run region based on CF-IPCountry.
 */
const EDGE_GEO_ROUTING_WORKER = `
// Heady Geolocation Routing Worker
const REGION_MAP = {
  // North America → us-central1
  US: 'https://us-central1-heady.run.app',
  CA: 'https://us-central1-heady.run.app',
  MX: 'https://us-central1-heady.run.app',
  // Europe → europe-west1
  GB: 'https://europe-west1-heady.run.app',
  DE: 'https://europe-west1-heady.run.app',
  FR: 'https://europe-west1-heady.run.app',
  NL: 'https://europe-west1-heady.run.app',
  SE: 'https://europe-west1-heady.run.app',
  // Asia → asia-east1
  JP: 'https://asia-east1-heady.run.app',
  SG: 'https://asia-east1-heady.run.app',
  AU: 'https://asia-east1-heady.run.app',
  KR: 'https://asia-east1-heady.run.app',
  IN: 'https://asia-east1-heady.run.app',
};
const DEFAULT_UPSTREAM = 'https://us-central1-heady.run.app';

export default {
  async fetch(request, env, ctx) {
    const country  = request.cf?.country || 'US';
    const upstream = REGION_MAP[country] || DEFAULT_UPSTREAM;
    const url      = new URL(request.url);
    const target   = new URL(upstream);
    url.hostname   = target.hostname;

    const proxied = new Request(url.toString(), request);
    const response = await fetch(proxied);
    const headers  = new Headers(response.headers);
    headers.set('X-Heady-Region',  upstream.includes('europe') ? 'eu' :
                                   upstream.includes('asia')   ? 'ap' : 'us');
    headers.set('X-Heady-Country', country);
    return new Response(response.body, { ...response, headers });
  },
};
`;

// ─────────────────────────────────────────────────────────────────────────────
// Cache-Tag Taxonomy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cache-Tag builder for Heady resources.
 * Use these tags in Cache-Tag response headers and for targeted purging.
 */
const CacheTagBuilder = {
  user:    (userId)    => `heady-user-${userId}`,
  agent:   (agentId)  => `heady-agent-${agentId}`,
  org:     (orgId)    => `heady-org-${orgId}`,
  api:     (version)  => `heady-api-${version}`,
  docs:    (section)  => `heady-docs-${section}`,
  domain:  (domain)   => `heady-domain-${domain.replace(/\./g, '-')}`,

  /** Build all tags for a request context */
  forRequest: ({ userId, agentId, orgId, apiVersion, domain } = {}) => {
    const tags = [];
    if (userId)     tags.push(CacheTagBuilder.user(userId));
    if (agentId)    tags.push(CacheTagBuilder.agent(agentId));
    if (orgId)      tags.push(CacheTagBuilder.org(orgId));
    if (apiVersion) tags.push(CacheTagBuilder.api(apiVersion));
    if (domain)     tags.push(CacheTagBuilder.domain(domain));
    return tags;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Purge Client
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class CloudflarePurgeClient
 * Cloudflare Cache purge operations with retry (φ-backoff).
 */
class CloudflarePurgeClient {
  /**
   * @param {Object} opts
   * @param {string} opts.zoneId
   * @param {string} opts.apiToken
   */
  constructor(opts) {
    this.zoneId   = opts.zoneId;
    this.apiToken = opts.apiToken;
    this._baseUrl = `https://api.cloudflare.com/client/v4/zones/${opts.zoneId}/purge_cache`;
    this._maxRetries = FIB[5];   // 5 retries
  }

  /** @private φ-exponential backoff delay */
  _backoffMs(attempt) {
    return Math.round(1000 * Math.pow(PHI, attempt));
    // attempt 0→1000ms, 1→1618ms, 2→2618ms, 3→4236ms, 4→6854ms
  }

  /** @private Execute purge with retry */
  async _purge(body, attempt = 0) {
    try {
      const res = await fetch(this._baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(`CF purge failed: ${JSON.stringify(data.errors)}`);
      return data;
    } catch (err) {
      if (attempt >= this._maxRetries) throw err;
      await new Promise(r => setTimeout(r, this._backoffMs(attempt)));
      return this._purge(body, attempt + 1);
    }
  }

  purgeByTags(tags)   { return this._purge({ tags }); }
  purgeByUrls(files)  { return this._purge({ files }); }
  purgeEverything()   { return this._purge({ purge_everything: true }); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wrangler Config Generator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate wrangler.toml configuration for Cloudflare Workers.
 * @param {string} workerName
 * @param {string} zoneId
 * @param {string[]} routes
 * @returns {string} wrangler.toml content
 */
function generateWranglerConfig(workerName, zoneId, routes) {
  return `
name = "${workerName}"
main = "src/index.js"
compatibility_date = "2024-01-01"
workers_dev = false

[vars]
PHI = "1.618033988749895"
CACHE_TTL = "55"

[[routes]]
${routes.map(r => `pattern = "${r}"\nzone_id = "${zoneId}"`).join('\n\n[[routes]]\n')}

[build]
command = "pnpm build"

[observability]
enabled = true
head_sampling_rate = ${(1 / PHI).toFixed(4)}
`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Full Zone Configuration (Terraform-compatible)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a complete zone configuration object for a domain.
 * Compatible with Cloudflare Terraform provider output format.
 *
 * @param {string} domain
 * @param {string} zoneId
 * @param {Object} [opts]
 * @returns {Object} Zone config object
 */
function buildZoneConfig(domain, zoneId, opts = {}) {
  return {
    domain,
    zoneId,
    securityHeaders: SECURITY_HEADERS,
    pageRules: PAGE_RULES[domain] || PAGE_RULES._default,
    rateLimitRules: RATE_LIMIT_RULES,
    geoRouting: GEO_ROUTING,
    cacheTagBuilder: CacheTagBuilder,
    settings: {
      ssl:                  'full_strict',
      minTlsVersion:        '1.2',
      tls13:                'zrt',            // TLS 1.3 + 0-RTT
      http3:                'on',
      http2Prioritization:  'on',
      ipv6:                 'on',
      webp:                 'on',
      imageResizing:        'on',
      minify:               { html: true, css: true, js: true },
      rocketLoader:         'off',            // off — we handle JS async ourselves
      mirage:               'off',
      polish:               'lossless',
      earlyHints:           'on',
      zeroRtt:              'on',
      browserCacheTtl:      FIB[11],          // 89s default browser cache
      challengeTtl:         FIB[12] * 60,     // 144 minutes
      developmentMode:      opts.devMode ?? false,
      ...opts.settings,
    },
    firewallRules: opts.firewallRules ?? [],
  };
}

/**
 * Build all zone configurations for all 9 HeadySystems domains.
 * @param {Object} zoneIds - map of domain → zoneId
 * @returns {Object[]} Array of zone configs
 */
function buildAllZoneConfigs(zoneIds = {}) {
  return Object.entries(DOMAINS).map(([key, domain]) => {
    const zoneId = zoneIds[domain] || zoneIds[key] || `ZONE_ID_${key.toUpperCase()}`;
    return buildZoneConfig(domain, zoneId);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  DOMAINS,
  SECURITY_HEADERS,
  RATE_LIMIT_RULES,
  PAGE_RULES,
  GEO_ROUTING,
  CacheTagBuilder,
  CloudflarePurgeClient,
  EDGE_API_CACHE_WORKER,
  EDGE_GEO_ROUTING_WORKER,
  generateWranglerConfig,
  buildZoneConfig,
  buildAllZoneConfigs,
  PHI,
  FIB,
};
