/**
 * HeadySystems A1 Template Engine
 * cloudflare-worker.js — Edge Vertical Routing Worker
 *
 * Cloudflare Worker that runs at the edge (Cloudflare's global network)
 * to deliver the correct vertical experience for each domain.
 *
 * Responsibilities:
 *   1. Inspect the incoming request hostname
 *   2. Resolve the vertical_id from the hostname map
 *   3. Serve static assets from R2/KV based on hostname
 *   4. Inject vertical-specific meta tags, analytics, and CSS into HTML responses
 *   5. Handle SSL/HTTPS redirect (note: TLS termination is handled by Cloudflare automatically)
 *   6. Set appropriate Cache-Control headers per content type
 *   7. Fall back to origin if no edge config exists
 *   8. Security headers on all responses
 *
 * Architecture:
 *   - Static assets (JS, CSS, images) → served from R2 via KV index
 *   - HTML pages → fetched from origin, then mutated via HTMLRewriter
 *   - API requests (/api/*) → forwarded directly to origin
 *   - Metrics/health → handled inline
 *
 * KV Bindings (configure in wrangler.toml):
 *   VERTICAL_KV   — key-value store for vertical configs and asset manifests
 *   ASSET_KV      — key-value store for static asset content (alternative to R2)
 *
 * R2 Bindings:
 *   ASSETS_BUCKET — R2 bucket for static assets (CSS, JS, images)
 *
 * Environment Variables (set in Cloudflare dashboard or wrangler.toml):
 *   HEADY_ENV            — "development" | "staging" | "production"
 *   ORIGIN_URL           — origin server URL for pass-through
 *   STATIC_DOMAIN        — CDN domain for assets (e.g., assets.headysystems.com)
 *   ENABLE_EDGE_INJECT   — "true" to enable HTML injection (default: true)
 *   ANALYTICS_ENDPOINT   — endpoint for edge-side analytics
 *
 * Deployment:
 *   npx wrangler publish
 *   Routes: *headyme.com/*, *headyos.com/*, *headysystems.com/*,
 *           *headyai.com/*, *headyconnection.com/*, *headyconnection.org/*,
 *           *heady.exchange/*, *heady.investments/*,
 *           *.headyme.com/*, *.headyos.com/*
 *
 * SSL Notes:
 *   Cloudflare handles TLS termination automatically. All traffic between
 *   Cloudflare and the origin should use "Full (strict)" SSL mode with a
 *   valid origin certificate. HTTP→HTTPS redirects are enforced by this
 *   worker via HSTS headers and redirect logic.
 */

/* ─── Hostname → Vertical Map ────────────────────────────────── */

/**
 * Static hostname resolution map.
 * Mirrors vertical-registry.json but inlined for edge performance.
 * Keys are normalized hostnames (lowercase, no www, no trailing dot).
 *
 * @type {Record<string, string>}
 */
const HOSTNAME_VERTICAL_MAP = {
  // Brand domains
  'headyme.com':           'headyme',
  'app.headyme.com':       'headyme',
  'headyos.com':           'headyos',
  'app.headyos.com':       'headyos',
  'os.headyme.com':        'headyos',
  'headysystems.com':      'headysystems',
  'enterprise.headysystems.com': 'headysystems',
  'headyai.com':           'headyai',
  'ai.headyme.com':        'headyai',
  'headyconnection.com':   'headyconnection',
  'headyconnection.org':   'headyconnection',
  'connect.headyme.com':   'headyconnection',
  'heady.exchange':        'exchange',
  'exchange.headyme.com':  'exchange',
  'heady.investments':     'investments',
  'invest.headyme.com':    'investments',

  // Industry vertical subdomains
  'health.headyme.com':    'health',
  'wellness.headyme.com':  'wellness',
  'legal.headyme.com':     'legal',
  'law.headyme.com':       'legal',
  'finance.headyme.com':   'finance',
  'financial.headyme.com': 'finance',
  'realestate.headyme.com':'realestate',
  'property.headyme.com':  'realestate',
  'education.headyme.com': 'education',
  'learn.headyme.com':     'education',
  'hr.headyme.com':        'hr',
  'people.headyme.com':    'hr',
  'logistics.headyme.com': 'logistics',
  'supply.headyme.com':    'logistics',
};

/**
 * Per-vertical design system configuration.
 * Inlined at the edge for zero-latency injection.
 *
 * @type {Record<string, VerticalEdgeConfig>}
 */
const VERTICAL_EDGE_CONFIGS = {
  headyme: {
    accentVariant:  'teal',
    accentColor:    '#20808d',
    accentLight:    '#2dd4bf',
    dataVertical:   'headyme',
    themeColor:     '#0a0e17',
    ogTitle:        'HeadyMe — AI-Native Personal OS',
    ogDescription:  'Orchestrate your life with AI intelligence and sacred geometry precision.',
    twitterHandle:  '@headyme',
    analyticsId:    'G-HME000001',
    gaEnabled:      true,
  },
  headyos: {
    accentVariant:  'violet',
    accentColor:    '#8b5cf6',
    accentLight:    '#a78bfa',
    dataVertical:   'headyos',
    themeColor:     '#0d0a1a',
    ogTitle:        'HeadyOS — The AI Operating System',
    ogDescription:  'HeadyOS is an AI-native OS for orchestrating your digital world.',
    twitterHandle:  '@headyos',
    analyticsId:    'G-HOS000002',
    gaEnabled:      true,
  },
  headysystems: {
    accentVariant:  'gold',
    accentColor:    '#d4a843',
    accentLight:    '#fbbf24',
    dataVertical:   'headysystems',
    themeColor:     '#0a0c08',
    ogTitle:        'HeadySystems — Enterprise AI Platform',
    ogDescription:  'Production-grade AI infrastructure, built on sacred geometry principles.',
    twitterHandle:  '@headysystems',
    analyticsId:    'G-HSY000003',
    gaEnabled:      true,
  },
  headyai: {
    accentVariant:  'violet',
    accentColor:    '#8b5cf6',
    accentLight:    '#c4b5fd',
    dataVertical:   'headyai',
    themeColor:     '#0a0814',
    ogTitle:        'HeadyAI — AI Services & APIs',
    ogDescription:  'State-of-the-art AI models and inference APIs for developers.',
    twitterHandle:  '@headyai',
    analyticsId:    'G-HAI000004',
    gaEnabled:      true,
  },
  headyconnection: {
    accentVariant:  'teal',
    accentColor:    '#2dd4bf',
    accentLight:    '#5eead4',
    dataVertical:   'headyconnection',
    themeColor:     '#080f14',
    ogTitle:        'HeadyConnection — Community & Network',
    ogDescription:  'Connect, collaborate, and create with the HeadySystems community.',
    twitterHandle:  '@headyconnection',
    analyticsId:    'G-HCN000005',
    gaEnabled:      true,
  },
  exchange: {
    accentVariant:  'gold',
    accentColor:    '#d4a843',
    accentLight:    '#fbbf24',
    dataVertical:   'exchange',
    themeColor:     '#0c0e08',
    ogTitle:        'Heady Exchange — Digital Asset Trading',
    ogDescription:  'Next-generation digital asset exchange powered by HeadySystems AI.',
    twitterHandle:  '@headyexchange',
    analyticsId:    null,
    gaEnabled:      false,
  },
  investments: {
    accentVariant:  'gold',
    accentColor:    '#e6c060',
    accentLight:    '#fcd65a',
    dataVertical:   'investments',
    themeColor:     '#0d0b06',
    ogTitle:        'Heady Investments — Wealth Intelligence',
    ogDescription:  'AI-powered investment portfolio management and wealth optimization.',
    twitterHandle:  '@headyinvest',
    analyticsId:    null,
    gaEnabled:      false,
  },
  health: {
    accentVariant:  'teal',
    accentColor:    '#20808d',
    accentLight:    '#2dd4bf',
    dataVertical:   'health',
    themeColor:     '#060f14',
    ogTitle:        'Heady Health — AI Health & Wellness',
    ogDescription:  'HIPAA-compliant AI health platform for personalized wellness.',
    twitterHandle:  '@headyhealth',
    analyticsId:    'G-HHE000006',
    gaEnabled:      true,
  },
  legal: {
    accentVariant:  'silver',
    accentColor:    '#94a3b8',
    accentLight:    '#cbd5e1',
    dataVertical:   'legal',
    themeColor:     '#080a0e',
    ogTitle:        'Heady Legal — AI Legal Intelligence',
    ogDescription:  'AI-powered contract analysis, document review, and legal research.',
    twitterHandle:  '@headylegal',
    analyticsId:    'G-HLE000007',
    gaEnabled:      true,
  },
  finance: {
    accentVariant:  'gold',
    accentColor:    '#d4a843',
    accentLight:    '#fbbf24',
    dataVertical:   'finance',
    themeColor:     '#0a0c06',
    ogTitle:        'Heady Finance — AI Financial Intelligence',
    ogDescription:  'Intelligent financial planning, expense tracking, and tax optimization.',
    twitterHandle:  '@headyfinance',
    analyticsId:    'G-HFI000008',
    gaEnabled:      true,
  },
  realestate: {
    accentVariant:  'teal',
    accentColor:    '#20808d',
    accentLight:    '#2dd4bf',
    dataVertical:   'realestate',
    themeColor:     '#060e0c',
    ogTitle:        'Heady Real Estate — Property Intelligence',
    ogDescription:  'AI-powered property search, market analysis, and mortgage optimization.',
    twitterHandle:  '@headyproperty',
    analyticsId:    null,
    gaEnabled:      false,
  },
  education: {
    accentVariant:  'violet',
    accentColor:    '#8b5cf6',
    accentLight:    '#a78bfa',
    dataVertical:   'education',
    themeColor:     '#080814',
    ogTitle:        'Heady Education — AI Learning Platform',
    ogDescription:  'Personalized AI tutoring and curriculum planning for every learner.',
    twitterHandle:  '@headylearnai',
    analyticsId:    null,
    gaEnabled:      false,
  },
  wellness: {
    accentVariant:  'teal',
    accentColor:    '#20808d',
    accentLight:    '#2dd4bf',
    dataVertical:   'wellness',
    themeColor:     '#060e0e',
    ogTitle:        'Heady Wellness — AI Mindfulness & Wellness',
    ogDescription:  'AI-guided mindfulness, meditation, and mental wellness support.',
    twitterHandle:  '@headywellness',
    analyticsId:    null,
    gaEnabled:      false,
  },
};

const DEFAULT_VERTICAL_ID = 'headyme';

/* ─── Cache Duration Constants ───────────────────────────────── */
const CACHE_TTL = {
  HTML:       'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
  CSS_JS:     'public, max-age=31536000, immutable',    // 1 year — use content hashes
  IMAGES:     'public, max-age=86400, s-maxage=604800',  // images: 7d CDN
  FONTS:      'public, max-age=31536000, immutable',
  API:        'no-store, no-cache',
  PRIVATE:    'private, no-store',
};

/* ─── Security Headers ───────────────────────────────────────── */
const SECURITY_HEADERS = {
  'Strict-Transport-Security':  'max-age=63072000; includeSubDomains; preload',  // HSTS 2yr
  'X-Content-Type-Options':     'nosniff',
  'X-Frame-Options':            'SAMEORIGIN',
  'X-XSS-Protection':           '1; mode=block',
  'Referrer-Policy':            'strict-origin-when-cross-origin',
  'Permissions-Policy':         'camera=(), microphone=(), geolocation=(self), payment=(self)',
};

/* ─── Utility: Hostname normalization ────────────────────────── */
function normalizeHostname(hostname) {
  return (hostname || '')
    .toLowerCase()
    .replace(/:\d+$/, '')      // strip port
    .replace(/\.$/, '')         // strip trailing dot
    .replace(/^www\./, '');     // strip www prefix
}

/* ─── Utility: Resolve vertical from hostname ────────────────── */
function resolveVerticalId(hostname) {
  const norm = normalizeHostname(hostname);

  // Exact match
  if (HOSTNAME_VERTICAL_MAP[norm]) {
    return HOSTNAME_VERTICAL_MAP[norm];
  }

  // Subdomain industry match (not in static map)
  const parts = norm.split('.');
  if (parts.length >= 3) {
    const subdomain   = parts[0];
    const parentDomain = parts.slice(1).join('.');
    const parentVertical = HOSTNAME_VERTICAL_MAP[parentDomain];

    if (parentVertical) {
      // Known industry subdomains
      const industryMap = {
        health: 'health', wellness: 'wellness', legal: 'legal', law: 'legal',
        finance: 'finance', financial: 'finance', realestate: 'realestate',
        property: 'realestate', education: 'education', learn: 'education',
        hr: 'hr', people: 'hr', logistics: 'logistics', supply: 'logistics',
        retail: 'retail', shop: 'retail',
      };
      if (industryMap[subdomain]) return industryMap[subdomain];
      // Otherwise inherit parent vertical
      return parentVertical;
    }
  }

  return DEFAULT_VERTICAL_ID;
}

/* ─── Utility: Get vertical edge config ─────────────────────── */
function getVerticalConfig(verticalId) {
  return VERTICAL_EDGE_CONFIGS[verticalId] || VERTICAL_EDGE_CONFIGS[DEFAULT_VERTICAL_ID];
}

/* ─── Utility: Determine content type and cache policy ──────── */
function getCachePolicy(url, contentType) {
  const pathname = new URL(url).pathname.toLowerCase();

  if (pathname.startsWith('/api/') || pathname.startsWith('/_internal/')) {
    return CACHE_TTL.API;
  }
  if (pathname.match(/\.(js|mjs|cjs)$/)) return CACHE_TTL.CSS_JS;
  if (pathname.match(/\.css$/))          return CACHE_TTL.CSS_JS;
  if (pathname.match(/\.(woff2?|ttf|otf|eot)$/)) return CACHE_TTL.FONTS;
  if (pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|avif|ico)$/)) return CACHE_TTL.IMAGES;
  if (contentType && contentType.includes('text/html')) return CACHE_TTL.HTML;

  return CACHE_TTL.HTML;
}

/* ─── Utility: Build meta tags HTML ─────────────────────────── */
function buildMetaTagsHtml(verticalCfg, url) {
  const canonical = url ? new URL(url).origin : '';
  const gaSnippet = verticalCfg.gaEnabled && verticalCfg.analyticsId
    ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${verticalCfg.analyticsId}"></script>
       <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${verticalCfg.analyticsId}',{anonymize_ip:true});</script>`
    : '';

  return `
    <!-- HeadySystems Edge-Injected Vertical Config -->
    <meta name="theme-color" content="${verticalCfg.themeColor}">
    <meta property="og:site_name" content="HeadySystems">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="${verticalCfg.twitterHandle}">
    <!-- Vertical design system binding -->
    <meta name="heady-vertical" content="${verticalCfg.dataVertical}">
    <!-- Edge analytics -->
    ${gaSnippet}
  `.trim();
}

/* ─── Utility: Build vertical CSS vars HTML ──────────────────── */
function buildVerticalCssHtml(verticalCfg) {
  return `
    <!-- HeadySystems Edge-Injected Vertical CSS Override -->
    <style id="heady-vertical-theme">
      :root {
        --color-accent: ${verticalCfg.accentColor};
        --color-accent-light: ${verticalCfg.accentLight};
      }
      [data-vertical="${verticalCfg.dataVertical}"] {
        --color-accent: ${verticalCfg.accentColor};
        --color-accent-light: ${verticalCfg.accentLight};
      }
    </style>
  `.trim();
}

/* ─── Utility: Set data-vertical on <html> element ──────────── */
function buildBodyDataAttr(verticalCfg) {
  // Injected via HTMLRewriter element handler
  return verticalCfg.dataVertical;
}

/* ─── Utility: Redirect HTTP → HTTPS ────────────────────────── */
function httpsRedirect(request) {
  const url = new URL(request.url);
  if (url.protocol === 'http:') {
    url.protocol = 'https:';
    return Response.redirect(url.toString(), 301);
  }
  return null;
}

/* ─── HTMLRewriter: Inject into HTML responses ───────────────── */
class HeadInjector {
  constructor(metaHtml, cssHtml) {
    this.metaHtml = metaHtml;
    this.cssHtml  = cssHtml;
    this.done     = false;
  }

  element(el) {
    if (!this.done) {
      // Inject meta tags and CSS at end of <head>
      el.append(
        `\n${this.metaHtml}\n${this.cssHtml}\n`,
        { html: true }
      );
      this.done = true;
    }
  }
}

class HtmlDataAttrInjector {
  constructor(dataVertical) {
    this.dataVertical = dataVertical;
  }
  element(el) {
    // Set data-vertical attribute on <html> element for CSS accent overrides
    el.setAttribute('data-vertical', this.dataVertical);
    // Ensure dark theme class is present
    const existingClass = el.getAttribute('class') || '';
    if (!existingClass.includes('dark')) {
      el.setAttribute('class', (existingClass + ' dark').trim());
    }
  }
}

class NoscriptTrackingInjector {
  constructor(analyticsId) {
    this.analyticsId = analyticsId;
    this.done = false;
  }
  element(el) {
    if (!this.done && this.analyticsId) {
      el.append(
        `<noscript><img height="1" width="1" style="display:none" src="https://www.googletagmanager.com/collect?v=2&tid=${this.analyticsId}" /></noscript>`,
        { html: true }
      );
      this.done = true;
    }
  }
}

/* ─── Main Fetch Handler ─────────────────────────────────────── */

/**
 * @param {Request} request
 * @param {Object} env — Cloudflare Worker environment bindings
 * @param {Object} ctx — ExecutionContext
 */
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);

  // 1. HTTPS redirect (handles non-TLS requests reaching the worker)
  const httpsRedir = httpsRedirect(request);
  if (httpsRedir) return httpsRedir;

  // 2. Resolve vertical
  const hostname   = url.hostname;
  const verticalId = resolveVerticalId(hostname);
  const vertCfg    = getVerticalConfig(verticalId);

  // 3. Route: API requests bypass all injection
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_internal/')) {
    const apiResponse = await forwardToOrigin(request, env);
    return applySecurityHeaders(apiResponse);
  }

  // 4. Route: Health check endpoint
  if (url.pathname === '/_heady/health') {
    return new Response(JSON.stringify({
      status:     'ok',
      vertical:   verticalId,
      hostname,
      env:        env.HEADY_ENV || 'unknown',
      timestamp:  new Date().toISOString(),
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': CACHE_TTL.API,
      },
    });
  }

  // 5. Route: Static assets (CSS, JS, images) → try R2 or KV first, then origin
  if (isStaticAsset(url.pathname)) {
    const assetResponse = await serveStaticAsset(request, url, env, verticalId);
    if (assetResponse) return applySecurityHeaders(assetResponse);
    // Fall through to origin
  }

  // 6. Fetch HTML from origin
  let originResponse;
  try {
    originResponse = await forwardToOrigin(request, env, {
      'X-Heady-Vertical':  verticalId,
      'X-Heady-Hostname':  hostname,
    });
  } catch (err) {
    // Origin unreachable — return 502
    return new Response('Service temporarily unavailable', {
      status: 502,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': CACHE_TTL.API },
    });
  }

  // 7. Non-HTML responses: pass through with security headers
  const contentType = originResponse.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html')) {
    const mutableResponse = new Response(originResponse.body, originResponse);
    applySecurityHeadersMutable(mutableResponse.headers);
    mutableResponse.headers.set('Cache-Control', getCachePolicy(request.url, contentType));
    return mutableResponse;
  }

  // 8. HTML response: inject vertical config via HTMLRewriter
  const enableInject = env.ENABLE_EDGE_INJECT !== 'false';

  let transformedResponse;
  if (enableInject) {
    const metaHtml = buildMetaTagsHtml(vertCfg, request.url);
    const cssHtml  = buildVerticalCssHtml(vertCfg);

    transformedResponse = new HTMLRewriter()
      .on('html', new HtmlDataAttrInjector(buildBodyDataAttr(vertCfg)))
      .on('head', new HeadInjector(metaHtml, cssHtml))
      .on('body', new NoscriptTrackingInjector(vertCfg.analyticsId))
      .transform(originResponse);
  } else {
    transformedResponse = new Response(originResponse.body, originResponse);
  }

  // 9. Apply cache + security headers to final HTML response
  const finalHeaders = new Headers(transformedResponse.headers);
  applySecurityHeadersMutable(finalHeaders);
  finalHeaders.set('Cache-Control', CACHE_TTL.HTML);
  finalHeaders.set('X-Heady-Vertical', verticalId);
  finalHeaders.set('Vary', 'Accept-Encoding');

  return new Response(transformedResponse.body, {
    status:  transformedResponse.status,
    headers: finalHeaders,
  });
}

/* ─── Static Asset Routing ───────────────────────────────────── */

function isStaticAsset(pathname) {
  return /\.(css|js|mjs|cjs|woff2?|ttf|otf|eot|png|jpg|jpeg|gif|webp|avif|svg|ico|map)$/.test(pathname);
}

/**
 * Serve static assets from R2 bucket or KV store.
 * Key structure: "{verticalId}/{pathname}" or shared "shared/{pathname}"
 */
async function serveStaticAsset(request, url, env, verticalId) {
  const pathname = url.pathname.replace(/^\//, '');

  // Try vertical-specific asset first
  const verticalKey = `${verticalId}/${pathname}`;
  const sharedKey   = `shared/${pathname}`;

  // Attempt R2 lookup (if ASSETS_BUCKET is bound)
  if (env.ASSETS_BUCKET) {
    const r2Keys = [verticalKey, sharedKey, pathname];
    for (const key of r2Keys) {
      const object = await env.ASSETS_BUCKET.get(key);
      if (object) {
        const contentType = getContentType(pathname);
        const headers = new Headers({
          'Content-Type':   contentType,
          'Cache-Control':  getCachePolicy(request.url, contentType),
          'ETag':           object.etag || '',
          'X-Served-By':   'r2',
        });
        applySecurityHeadersMutable(headers);
        return new Response(object.body, { headers });
      }
    }
  }

  // Attempt KV lookup (if ASSET_KV is bound)
  if (env.ASSET_KV) {
    const kvKeys = [verticalKey, sharedKey, pathname];
    for (const key of kvKeys) {
      const value = await env.ASSET_KV.getWithMetadata(key, 'arrayBuffer');
      if (value.value) {
        const contentType = value.metadata?.contentType || getContentType(pathname);
        const headers = new Headers({
          'Content-Type':  contentType,
          'Cache-Control': getCachePolicy(request.url, contentType),
          'X-Served-By':  'kv',
        });
        applySecurityHeadersMutable(headers);
        return new Response(value.value, { headers });
      }
    }
  }

  return null; // Not found in edge stores → fall through to origin
}

/* ─── Origin Forwarding ──────────────────────────────────────── */

/**
 * Forward a request to the configured origin server.
 * Strips Cloudflare-added headers, adds Heady routing headers.
 *
 * @param {Request} request
 * @param {Object} env
 * @param {Object} [extraHeaders]
 * @returns {Promise<Response>}
 */
async function forwardToOrigin(request, env, extraHeaders = {}) {
  const originUrl = env.ORIGIN_URL;

  let targetRequest;

  if (originUrl) {
    // Rewrite URL to point to origin
    const url = new URL(request.url);
    const originBase = new URL(originUrl);
    url.hostname = originBase.hostname;
    url.port     = originBase.port;
    url.protocol = originBase.protocol;

    targetRequest = new Request(url.toString(), {
      method:  request.method,
      headers: new Headers(request.headers),
      body:    request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'follow',
    });
  } else {
    // No origin URL: use the original request as-is (Cloudflare zone routing)
    targetRequest = new Request(request.url, {
      method:  request.method,
      headers: new Headers(request.headers),
      body:    request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'follow',
    });
  }

  // Add routing headers
  Object.entries(extraHeaders).forEach(([k, v]) => {
    targetRequest.headers.set(k, v);
  });
  targetRequest.headers.set('X-Forwarded-Proto', 'https');
  targetRequest.headers.set('X-Heady-Worker', '1');

  return fetch(targetRequest);
}

/* ─── Security Header Helpers ───────────────────────────────── */

function applySecurityHeadersMutable(headers) {
  Object.entries(SECURITY_HEADERS).forEach(([k, v]) => {
    headers.set(k, v);
  });
}

function applySecurityHeaders(response) {
  const mutable = new Response(response.body, response);
  applySecurityHeadersMutable(mutable.headers);
  return mutable;
}

/* ─── Content Type Lookup ────────────────────────────────────── */

const MIME_TYPES = {
  css:   'text/css; charset=utf-8',
  js:    'application/javascript; charset=utf-8',
  mjs:   'application/javascript; charset=utf-8',
  cjs:   'application/javascript; charset=utf-8',
  json:  'application/json; charset=utf-8',
  html:  'text/html; charset=utf-8',
  svg:   'image/svg+xml',
  png:   'image/png',
  jpg:   'image/jpeg',
  jpeg:  'image/jpeg',
  webp:  'image/webp',
  avif:  'image/avif',
  gif:   'image/gif',
  ico:   'image/x-icon',
  woff:  'font/woff',
  woff2: 'font/woff2',
  ttf:   'font/truetype',
  otf:   'font/opentype',
  map:   'application/json',
};

function getContentType(pathname) {
  const ext = pathname.split('.').pop().toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/* ─── Cloudflare Worker Export ───────────────────────────────── */

/**
 * Cloudflare Workers module syntax entry point.
 * wrangler.toml must set `compatibility_date` to 2024-01-01 or later
 * and include the required bindings:
 *
 * [[r2_buckets]]
 * binding = "ASSETS_BUCKET"
 * bucket_name = "heady-assets-prod"
 *
 * [[kv_namespaces]]
 * binding = "VERTICAL_KV"
 * id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
 *
 * [[kv_namespaces]]
 * binding = "ASSET_KV"
 * id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"
 *
 * [vars]
 * HEADY_ENV = "production"
 * ENABLE_EDGE_INJECT = "true"
 * ORIGIN_URL = "https://origin.headysystems.com"
 */
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  },

  /**
   * Scheduled handler — can be used for cache warming or config refresh.
   * wrangler.toml: [triggers] crons = ["0 * * * *"]
   */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        // Warm up vertical KV entries
        const verticalIds = Object.keys(VERTICAL_EDGE_CONFIGS);
        for (const id of verticalIds) {
          if (env.VERTICAL_KV) {
            await env.VERTICAL_KV.put(
              `config:${id}`,
              JSON.stringify(VERTICAL_EDGE_CONFIGS[id]),
              { expirationTtl: 3600 }
            );
          }
        }
        console.log(`[HeadySystems Worker] Warmed ${verticalIds.length} vertical configs`);
      })()
    );
  },
};
