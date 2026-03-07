/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Cloudflare Edge Worker — AI inference without origin round-trips.
 * Designed to run inside the Cloudflare Workers runtime.
 * Also exports Node-compatible wrappers for local testing.
 */

'use strict';

// ─── Runtime detection ───────────────────────────────────────────────────────

const IS_CLOUDFLARE = typeof globalThis.caches !== 'undefined' && typeof process === 'undefined';
const IS_NODE = !IS_CLOUDFLARE;

// In Node, fall back to lightweight logger shim
const logger = IS_NODE
  ? require('../../utils/logger')
  : { info: () => {}, debug: () => {}, error: () => {}, warn: () => {} };

// ─── Constants ────────────────────────────────────────────────────────────────

const CF_AI_BASE    = 'https://api.cloudflare.com/client/v4/accounts';
const EMBED_MODEL   = '@cf/baai/bge-small-en-v1.5';
const CLASSIFY_MODEL = '@cf/huggingface/distilbert-sst-2-int8';

const ROUTE_TABLE = [
  { pattern: /^\/api\/embed/,    target: 'embedding' },
  { pattern: /^\/api\/classify/, target: 'classification' },
  { pattern: /^\/api\/chat/,     target: 'llm' },
  { pattern: /^\/api\/image/,    target: 'image-gen' },
  { pattern: /^\/health/,        target: 'health' },
];

// ─── Edge Functions ───────────────────────────────────────────────────────────

/**
 * Compute embeddings at the edge using Cloudflare Workers AI.
 * Zero round-trip to origin for supported embedding models.
 *
 * @param {string} text - Input text to embed
 * @param {object} [opts]
 * @param {string} [opts.model]       - Override model
 * @param {object} [opts.env]         - Cloudflare env bindings (contains AI)
 * @returns {Promise<number[]>}       - Embedding vector
 */
async function embedAtEdge(text, opts = {}) {
  if (!text || typeof text !== 'string') {
    throw new TypeError('embedAtEdge: text must be a non-empty string');
  }

  const model = opts.model || EMBED_MODEL;

  // Cloudflare Workers AI path
  if (IS_CLOUDFLARE && opts.env && opts.env.AI) {
    const result = await opts.env.AI.run(model, { text });
    return result.data[0];
  }

  // Node / REST fallback using account credentials
  if (IS_NODE) {
    const accountId = process.env.CF_ACCOUNT_ID;
    const apiToken  = process.env.CF_API_TOKEN;

    if (!accountId || !apiToken) {
      logger.warn('[EdgeWorker] CF credentials not set — returning mock embedding');
      return _mockEmbedding(text, 384);
    }

    const res = await _cfFetch(`${CF_AI_BASE}/${accountId}/ai/run/${model}`, apiToken, { text });
    return res.result.data[0];
  }

  throw new Error('embedAtEdge: unable to determine runtime environment');
}

/**
 * Classify text at the edge (sentiment / intent).
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {string}   [opts.model]   - Override model
 * @param {object}   [opts.env]     - Cloudflare env bindings
 * @param {string[]} [opts.labels]  - Custom label set (if supported by model)
 * @returns {Promise<{ label: string, score: number }[]>}
 */
async function classifyAtEdge(text, opts = {}) {
  if (!text || typeof text !== 'string') {
    throw new TypeError('classifyAtEdge: text must be a non-empty string');
  }

  const model = opts.model || CLASSIFY_MODEL;

  if (IS_CLOUDFLARE && opts.env && opts.env.AI) {
    const result = await opts.env.AI.run(model, { text });
    return _normalizeClassification(result);
  }

  if (IS_NODE) {
    const accountId = process.env.CF_ACCOUNT_ID;
    const apiToken  = process.env.CF_API_TOKEN;

    if (!accountId || !apiToken) {
      logger.warn('[EdgeWorker] CF credentials not set — returning mock classification');
      return [{ label: 'NEUTRAL', score: 0.5 }];
    }

    const res = await _cfFetch(`${CF_AI_BASE}/${accountId}/ai/run/${model}`, apiToken, { text });
    return _normalizeClassification(res.result);
  }

  throw new Error('classifyAtEdge: unable to determine runtime environment');
}

/**
 * Route an incoming edge request to the appropriate handler.
 * Designed to be called from the Cloudflare Worker fetch handler.
 *
 * @param {Request} request - Fetch API Request object
 * @param {object}  [env]   - Cloudflare env bindings
 * @param {object}  [ctx]   - Cloudflare execution context
 * @returns {Promise<Response>}
 */
async function routeAtEdge(request, env, ctx) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    return _corsResponse(new Response(null, { status: 204 }));
  }

  // Route matching
  const route = ROUTE_TABLE.find(r => r.pattern.test(pathname));

  try {
    switch (route && route.target) {
      case 'health':
        return _corsResponse(Response.json({ status: 'ok', edge: true, ts: Date.now() }));

      case 'embedding': {
        const body = await _parseBody(request);
        if (!body.text) return _errResponse(400, 'text field required');
        const vector = await embedAtEdge(body.text, { model: body.model, env });
        return _corsResponse(Response.json({ vector, model: body.model || EMBED_MODEL }));
      }

      case 'classification': {
        const body = await _parseBody(request);
        if (!body.text) return _errResponse(400, 'text field required');
        const labels = await classifyAtEdge(body.text, { model: body.model, env });
        return _corsResponse(Response.json({ labels, model: body.model || CLASSIFY_MODEL }));
      }

      case 'llm': {
        // Forward to origin for full LLM inference (too large for edge-only)
        return _proxyToOrigin(request, env);
      }

      case 'image-gen': {
        return _proxyToOrigin(request, env);
      }

      default:
        return _corsResponse(Response.json({ error: 'Not found' }, { status: 404 }));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return _errResponse(500, message);
  }
}

// ─── Edge-side caching helpers ────────────────────────────────────────────────

/**
 * Try to serve an embedding from the edge cache before computing.
 * @param {string} text
 * @param {object} opts
 */
async function embedWithCache(text, opts = {}) {
  if (!IS_CLOUDFLARE || !globalThis.caches) {
    return embedAtEdge(text, opts);
  }

  const cacheKey = new Request(`https://embed-cache.heady.internal/${_hashText(text)}`);
  const cache = await caches.open('heady-edge-embed');
  const cached = await cache.match(cacheKey);

  if (cached) {
    const data = await cached.json();
    return data.vector;
  }

  const vector = await embedAtEdge(text, opts);

  // Cache for 1 hour
  const response = new Response(JSON.stringify({ vector }), {
    headers: { 'Cache-Control': 'max-age=3600', 'Content-Type': 'application/json' },
  });
  await cache.put(cacheKey, response);
  return vector;
}

// ─── Cloudflare Worker entry point ───────────────────────────────────────────

/**
 * Standard Cloudflare Worker export.
 * Usage in wrangler.toml: main = "src/edge/edge-worker.js"
 */
const cfWorkerExport = {
  async fetch(request, env, ctx) {
    return routeAtEdge(request, env, ctx);
  },
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function _cfFetch(url, token, body) {
  const headyFetch = require('../../core/heady-fetch');
  const res = await headyFetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CF AI API error ${res.status}: ${text}`);
  }

  return res.json();
}

function _normalizeClassification(result) {
  if (Array.isArray(result)) return result;
  if (result && result.label) return [{ label: result.label, score: result.score ?? 1 }];
  return [];
}

function _corsResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return new Response(response.body, { status: response.status, headers });
}

function _errResponse(status, message) {
  const body = JSON.stringify({ error: message });
  const headers = { 'Content-Type': 'application/json' };
  return _corsResponse(new Response(body, { status, headers }));
}

async function _parseBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function _proxyToOrigin(request, env) {
  const originUrl = (env && env.ORIGIN_URL) || 'https://api.headyconnection.org';
  const url = new URL(request.url);
  const target = `${originUrl}${url.pathname}${url.search}`;
  return fetch(target, { method: request.method, headers: request.headers, body: request.body });
}

function _mockEmbedding(text, dims = 384) {
  // Deterministic mock: hash text into floats
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  const seed = Math.abs(h);
  const vec = Array.from({ length: dims }, (_, i) => {
    const v = Math.sin(seed * (i + 1) * 0.01);
    return parseFloat(v.toFixed(6));
  });
  // L2-normalize
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map(x => x / norm);
}

function _hashText(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  embedAtEdge,
  classifyAtEdge,
  routeAtEdge,
  embedWithCache,
  cfWorkerExport,
  EMBED_MODEL,
  CLASSIFY_MODEL,
  ROUTE_TABLE,
};

// Cloudflare Workers default export
if (IS_CLOUDFLARE) {
  // eslint-disable-next-line no-undef
  Object.assign(globalThis, cfWorkerExport);
}
