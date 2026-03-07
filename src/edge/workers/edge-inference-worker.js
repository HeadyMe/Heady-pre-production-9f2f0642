/**
 * edge-inference-worker.js
 * Heady Latent OS — Edge Inference Worker
 *
 * Cloudflare Worker module handling AI inference at the edge.
 * Endpoints: /api/chat (SSE streaming), /api/embed, /api/classify, /api/rerank
 *
 * Model bindings:
 *   - @cf/meta/llama-3.1-8b-instruct-fp8-fast  (fast chat)
 *   - @cf/meta/llama-3.2-1b-instruct           (simple/ultra-fast chat)
 *   - @cf/baai/bge-base-en-v1.5                (embeddings, 768-dim)
 *   - @cf/baai/bge-small-en-v1.5               (fast embeddings, 384-dim)
 *   - @cf/huggingface/distilbert-sst-2-int8    (classification)
 *   - @cf/baai/bge-reranker-base               (reranking)
 *   - @cf/meta/llama-guard-3-8b               (safety)
 *
 * Sacred Geometry resource allocation: Fibonacci ratios govern cache TTL tiers
 * and rate limit buckets (8, 13, 21, 34, 55, 89 req/min).
 *
 * @module edge-inference-worker
 */

// ─────────────────────────────────────────────────────────────────────────────
// Phi-Math constants (inlined from shared/phi-math.js — Workers can't import)
// Source: heady-implementation/shared/phi-math.js v2.0.0
// ─────────────────────────────────────────────────────────────────────────────

/** Golden ratio φ = (1 + √5) / 2 */
const PHI = 1.6180339887498949;
/** Golden ratio conjugate ψ = 1/φ = φ - 1 */
const PSI = 0.6180339887498949;

/**
 * Fibonacci sequence helper — F(0)=0, F(1)=1, F(2)=1, ...
 * Used to compute explicit Fibonacci constants below.
 * fib(6)=8, fib(7)=13, fib(8)=21, fib(9)=34, fib(10)=55, fib(11)=89
 */
// F(n) values for rate limits and TTLs — all are true Fibonacci numbers:
const _FIB_8  = 8;    // fib(6)
const _FIB_13 = 13;   // fib(7)
const _FIB_21 = 21;   // fib(8)
const _FIB_34 = 34;   // fib(9)
const _FIB_55 = 55;   // fib(10)
const _FIB_89 = 89;   // fib(11)

// CSL thresholds from phi-math (phiThreshold(n) = 1 - PSI^n * 0.5)
const _CSL_MEDIUM   = 1.0 - Math.pow(PSI, 2) * 0.5;  // ≈ 0.809
const _CSL_LOW      = 1.0 - Math.pow(PSI, 1) * 0.5;  // ≈ 0.691
const _CSL_MINIMUM  = 1.0 - Math.pow(PSI, 0) * 0.5;  // ≈ 0.500

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phi-scaled TTL tiers (seconds) for cache layers.
 * Values derived from phi-harmonic sequence:
 *   EMBED      = round(PHI^7 * 100) ≈ 2909s → rounded to phi-friendly 3600 (1h)
 *   CLASSIFY   = fib(12) = 144 * 2 ≈ 300 (nearest phi-scaled: PSI^(-3)*100 ≈ 292)
 *   RERANK     = fib(13) = 233 * 2 ≈ 610 (nearest: fib(14) = 610 — exact Fibonacci!)
 *   CHAT_EXACT = fib(10) * 2 = 110 (phi-scaled: nearest Fibonacci 2x = 144-based)
 *
 * Phi-scaled in seconds using phiBackoff-like scaling from a base of 60s:
 *   60 * PHI^0 = 60
 *   60 * PHI^1 ≈ 97
 *   60 * PHI^2 ≈ 157 → CHAT_EXACT
 *   60 * PHI^4 ≈ 411 → CLASSIFY
 *   60 * PHI^5 ≈ 665 → RERANK
 *   60 * PHI^7 ≈ 1741 → use fib(16)=987*4=3948 → 3600 rounded
 */
const CACHE_TTL = {
  EMBED:      Math.round(60 * Math.pow(PHI, 7)),  // ≈ 3541 → ~1h; embeddings are stable
  CLASSIFY:   Math.round(60 * Math.pow(PHI, 4)),  // ≈ 411 → ~7m; classifications may drift
  RERANK:     Math.round(60 * Math.pow(PHI, 5)),  // ≈ 665 → ~11m
  CHAT_EXACT: Math.round(60 * Math.pow(PHI, 2)),  // ≈ 157 → ~2.6m; deterministic chat (temp=0)
};

/**
 * Fibonacci rate-limit thresholds per tier (req/min).
 * These are true Fibonacci numbers: F(10)=55, F(8)=21, F(11)=89, F(9)=34.
 * Already Fibonacci — made explicit via named constants.
 */
const RATE_LIMITS = {
  EMBED:    _FIB_55,  // fib(10) = 55
  CHAT:     _FIB_21,  // fib(8)  = 21
  CLASSIFY: _FIB_89,  // fib(11) = 89
  RERANK:   _FIB_34,  // fib(9)  = 34
};

/** Model assignments by complexity tier */
const MODELS = {
  CHAT_FAST: '@cf/meta/llama-3.2-1b-instruct',
  CHAT_STANDARD: '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
  EMBED_FAST: '@cf/baai/bge-small-en-v1.5',
  EMBED_STANDARD: '@cf/baai/bge-base-en-v1.5',
  CLASSIFY: '@cf/huggingface/distilbert-sst-2-int8',
  RERANK: '@cf/baai/bge-reranker-base',
  SAFETY: '@cf/meta/llama-guard-3-8b',
};

/** CORS allowed origins — tighten in production */
const ALLOWED_ORIGINS = [
  'https://heady.ai',
  'https://app.heady.ai',
  'https://headyconnection.org',
  'http://localhost:3000',
  'http://localhost:5173',
];

// ─────────────────────────────────────────────────────────────────────────────
// CORS helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build CORS response headers.
 * @param {Request} request
 * @returns {Headers}
 */
function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  const h = new Headers();
  h.set('Access-Control-Allow-Origin', allowed);
  h.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, X-Session-ID');
  h.set('Access-Control-Max-Age', '86400');
  h.set('Vary', 'Origin');
  return h;
}

/**
 * Handle preflight OPTIONS request.
 * @param {Request} request
 * @returns {Response}
 */
function handleOptions(request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

// ─────────────────────────────────────────────────────────────────────────────
// Error helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a structured JSON error response.
 * @param {string} message
 * @param {number} status
 * @param {Request} request
 * @param {string} [code]
 * @returns {Response}
 */
function errorResponse(message, status, request, code = 'INFERENCE_ERROR') {
  const headers = corsHeaders(request);
  headers.set('Content-Type', 'application/json');
  return new Response(
    JSON.stringify({
      error: { message, code, status },
      timestamp: Date.now(),
    }),
    { status, headers },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting (using Cloudflare's built-in CF-RateLimit header + KV counters)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check and increment rate limit counter for a given key.
 * Uses Workers KV for distributed counting with 60s sliding window.
 *
 * @param {KVNamespace} kv
 * @param {string} key
 * @param {number} limitPerMin
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number}>}
 */
async function checkRateLimit(kv, key, limitPerMin) {
  const windowKey = `rl:${key}:${Math.floor(Date.now() / 60_000)}`;
  const raw = await kv.get(windowKey);
  const count = raw ? parseInt(raw, 10) : 0;

  if (count >= limitPerMin) {
    return { allowed: false, remaining: 0, resetAt: (Math.floor(Date.now() / 60_000) + 1) * 60_000 };
  }

  // Increment — fire and forget to avoid blocking the request path
  kv.put(windowKey, String(count + 1), { expirationTtl: 120 }).catch(() => {});
  return { allowed: true, remaining: limitPerMin - count - 1, resetAt: (Math.floor(Date.now() / 60_000) + 1) * 60_000 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Complexity scoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score the complexity of a chat request to select model tier.
 * Returns 'simple' | 'standard' | 'complex'
 *
 * Scoring factors (phiFusionWeights pattern — Fibonacci proportions):
 *   - Token estimate (rough char/4)   weight: fib(9)=34  (dominant factor)
 *   - Message count                   weight: fib(8)=21
 *   - System prompt length            weight: fib(7)=13
 *   - Tool/function use requested     weight: fib(6)=8
 *   - Explicit complexity hint        weight: fib(5)=5
 *
 * Thresholds use CSL_THRESHOLDS-derived values (scaled to score range):
 *   'simple'   = score < _CSL_MINIMUM * 40  ≈ 20
 *   'standard' = score < _CSL_LOW * 72      ≈ 50
 *   'complex'  = score ≥ 50
 *
 * @param {object} body
 * @returns {'simple'|'standard'|'complex'}
 */
function scoreChatComplexity(body) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const totalChars = messages.reduce((s, m) => s + (m.content?.length ?? 0), 0);
  const tokenEstimate = Math.ceil(totalChars / 4);
  const systemPrompt = messages.find((m) => m.role === 'system')?.content ?? '';

  let score = 0;
  score += Math.min(tokenEstimate / 500, _FIB_34) * 1;  // up to fib(9)=34 pts from tokens
  score += Math.min(messages.length, _FIB_21);          // up to fib(8)=21 pts from depth
  score += Math.min(systemPrompt.length / 200, _FIB_13); // up to fib(7)=13 pts from system
  score += body.tools?.length ? _FIB_8 : 0;             // fib(6)=8 pts for tool use
  score += body.complexity === 'high' ? 5 : 0;          // 5 pts for explicit hint

  // Thresholds derived from CSL noise floor (_CSL_MINIMUM ≈ 0.5) and LOW (≈ 0.691)
  // scaled to the 0–81 score range (sum of all max weights = 34+21+13+8+5=81)
  const SIMPLE_THRESHOLD   = Math.round(_CSL_MINIMUM * 40);   // ≈ 20
  const STANDARD_THRESHOLD = Math.round(_CSL_LOW * 72);       // ≈ 50

  if (score < SIMPLE_THRESHOLD) return 'simple';
  if (score < STANDARD_THRESHOLD) return 'standard';
  return 'complex';
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a deterministic cache key for a request.
 * Uses crypto.subtle SHA-256 over the canonical request body.
 *
 * @param {string} prefix
 * @param {object} payload
 * @returns {Promise<string>}
 */
async function makeCacheKey(prefix, payload) {
  const data = JSON.stringify(payload, Object.keys(payload).sort());
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}:${hex}`;
}

/**
 * Attempt to read a cached response from Workers KV.
 *
 * @param {KVNamespace} kv
 * @param {string} cacheKey
 * @returns {Promise<object|null>}
 */
async function kvCacheGet(kv, cacheKey) {
  try {
    const raw = await kv.get(cacheKey, { type: 'json' });
    return raw ?? null;
  } catch {
    return null;
  }
}

/**
 * Store a response in Workers KV cache with TTL.
 *
 * @param {KVNamespace} kv
 * @param {string} cacheKey
 * @param {object} value
 * @param {number} ttlSeconds
 * @returns {Promise<void>}
 */
async function kvCachePut(kv, cacheKey, value, ttlSeconds) {
  try {
    await kv.put(cacheKey, JSON.stringify(value), { expirationTtl: ttlSeconds });
  } catch {
    // cache write failure is non-fatal
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate Authorization header against expected bearer token.
 * Returns the extracted API key or null on failure.
 *
 * @param {Request} request
 * @param {Env} env
 * @returns {string|null}
 */
function validateAuth(request, env) {
  const auth = request.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  // In dev/local, allow the dev token
  if (env.EDGE_API_KEY && token !== env.EDGE_API_KEY) return null;
  return token;
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle POST /api/chat
 * Streams SSE from Workers AI LLM. Selects model based on complexity scoring.
 * Supports cache for temperature=0 deterministic requests.
 *
 * @param {Request} request
 * @param {Env} env
 * @param {ExecutionContext} ctx
 * @returns {Promise<Response>}
 */
async function handleChat(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, request, 'INVALID_BODY');
  }

  const { messages, stream = true, temperature = 0.7, max_tokens = 1024, session_id } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return errorResponse('messages array is required and must be non-empty', 400, request, 'MISSING_MESSAGES');
  }

  // Rate limiting
  const rateLimitKey = session_id ?? request.headers.get('CF-Connecting-IP') ?? 'global';
  const rl = await checkRateLimit(env.EDGE_CACHE_KV, `chat:${rateLimitKey}`, RATE_LIMITS.CHAT);
  if (!rl.allowed) {
    const headers = corsHeaders(request);
    headers.set('Retry-After', String(Math.ceil((rl.resetAt - Date.now()) / 1000)));
    headers.set('X-RateLimit-Remaining', '0');
    return new Response(JSON.stringify({ error: { message: 'Rate limit exceeded', code: 'RATE_LIMITED', status: 429 } }), { status: 429, headers });
  }

  // Complexity scoring → model selection
  const complexity = scoreChatComplexity(body);

  // If complexity is 'complex', route to origin (caller should check X-Heady-Route)
  if (complexity === 'complex') {
    const headers = corsHeaders(request);
    headers.set('X-Heady-Route', 'origin');
    headers.set('X-Heady-Complexity', complexity);
    headers.set('Content-Type', 'application/json');
    return new Response(
      JSON.stringify({ route: 'origin', reason: 'complexity_score_exceeded_edge_threshold', complexity }),
      { status: 307, headers },
    );
  }

  const model = complexity === 'simple' ? MODELS.CHAT_FAST : MODELS.CHAT_STANDARD;

  // Exact-match cache for deterministic (temp=0) non-streaming requests
  if (!stream && temperature === 0 && env.EDGE_CACHE_KV) {
    const cacheKey = await makeCacheKey('chat', { model, messages, temperature, max_tokens });
    const cached = await kvCacheGet(env.EDGE_CACHE_KV, cacheKey);
    if (cached) {
      const headers = corsHeaders(request);
      headers.set('Content-Type', 'application/json');
      headers.set('X-Heady-Cache', 'HIT');
      return new Response(JSON.stringify(cached), { headers });
    }
  }

  const inferenceParams = {
    messages,
    stream,
    temperature,
    max_tokens,
  };

  try {
    if (stream) {
      // Streaming SSE response
      const aiStream = await env.AI.run(model, inferenceParams);
      const headers = corsHeaders(request);
      headers.set('Content-Type', 'text/event-stream');
      headers.set('Cache-Control', 'no-cache');
      headers.set('Connection', 'keep-alive');
      headers.set('X-Heady-Model', model);
      headers.set('X-Heady-Complexity', complexity);
      headers.set('X-RateLimit-Remaining', String(rl.remaining));
      return new Response(aiStream, { headers });
    } else {
      // Non-streaming JSON response
      const result = await env.AI.run(model, { ...inferenceParams, stream: false });
      const responsePayload = {
        result,
        model,
        complexity,
        cached: false,
        timestamp: Date.now(),
      };

      // Cache deterministic responses
      if (temperature === 0 && env.EDGE_CACHE_KV) {
        const cacheKey = await makeCacheKey('chat', { model, messages, temperature, max_tokens });
        ctx.waitUntil(kvCachePut(env.EDGE_CACHE_KV, cacheKey, responsePayload, CACHE_TTL.CHAT_EXACT));
      }

      const headers = corsHeaders(request);
      headers.set('Content-Type', 'application/json');
      headers.set('X-Heady-Model', model);
      headers.set('X-Heady-Complexity', complexity);
      headers.set('X-RateLimit-Remaining', String(rl.remaining));
      return new Response(JSON.stringify(responsePayload), { headers });
    }
  } catch (err) {
    console.error('[chat] inference error:', err);
    return errorResponse('Edge inference failed', 502, request, 'INFERENCE_FAILED');
  }
}

/**
 * Handle POST /api/embed
 * Generates embeddings using BGE models. Returns float32 vectors.
 * Caches results in KV by content hash.
 *
 * @param {Request} request
 * @param {Env} env
 * @param {ExecutionContext} ctx
 * @returns {Promise<Response>}
 */
async function handleEmbed(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, request, 'INVALID_BODY');
  }

  const { text, texts, model: requestedModel, dimensions = 'standard' } = body;

  // Accept single text or batch
  const inputs = texts ?? (text ? [text] : null);
  if (!inputs || inputs.length === 0) {
    return errorResponse('text or texts field is required', 400, request, 'MISSING_INPUT');
  }

  if (inputs.length > 100) {
    return errorResponse('Maximum batch size is 100 texts', 400, request, 'BATCH_TOO_LARGE');
  }

  // Rate limiting
  const clientIP = request.headers.get('CF-Connecting-IP') ?? 'global';
  const rl = await checkRateLimit(env.EDGE_CACHE_KV, `embed:${clientIP}`, RATE_LIMITS.EMBED);
  if (!rl.allowed) {
    return errorResponse('Rate limit exceeded', 429, request, 'RATE_LIMITED');
  }

  // Model selection: explicit > dimension hint > default
  let model = MODELS.EMBED_STANDARD;
  if (requestedModel && (requestedModel.includes('bge-small') || dimensions === 'fast')) {
    model = MODELS.EMBED_FAST;
  }

  // Cache lookup for single-text requests
  let cacheKey = null;
  if (inputs.length === 1 && env.EDGE_CACHE_KV) {
    cacheKey = await makeCacheKey('embed', { model, text: inputs[0] });
    const cached = await kvCacheGet(env.EDGE_CACHE_KV, cacheKey);
    if (cached) {
      const headers = corsHeaders(request);
      headers.set('Content-Type', 'application/json');
      headers.set('X-Heady-Cache', 'HIT');
      return new Response(JSON.stringify(cached), { headers });
    }
  }

  try {
    const result = await env.AI.run(model, { text: inputs });
    const responsePayload = {
      embeddings: result.data ?? result,
      model,
      dimensions: model.includes('small') ? 384 : 768,
      count: inputs.length,
      cached: false,
      timestamp: Date.now(),
    };

    // Store in cache
    if (cacheKey && env.EDGE_CACHE_KV) {
      ctx.waitUntil(kvCachePut(env.EDGE_CACHE_KV, cacheKey, responsePayload, CACHE_TTL.EMBED));
    }

    const headers = corsHeaders(request);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Heady-Model', model);
    headers.set('X-Heady-Cache', 'MISS');
    headers.set('X-RateLimit-Remaining', String(rl.remaining));
    return new Response(JSON.stringify(responsePayload), { headers });
  } catch (err) {
    console.error('[embed] inference error:', err);
    return errorResponse('Embedding generation failed', 502, request, 'INFERENCE_FAILED');
  }
}

/**
 * Handle POST /api/classify
 * Runs text classification using DistilBERT SST-2.
 * Caches results due to deterministic nature of classification.
 *
 * @param {Request} request
 * @param {Env} env
 * @param {ExecutionContext} ctx
 * @returns {Promise<Response>}
 */
async function handleClassify(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, request, 'INVALID_BODY');
  }

  const { text, texts } = body;
  const inputs = texts ?? (text ? [text] : null);

  if (!inputs || inputs.length === 0) {
    return errorResponse('text or texts field is required', 400, request, 'MISSING_INPUT');
  }

  if (inputs.length > 50) {
    return errorResponse('Maximum batch size is 50 texts', 400, request, 'BATCH_TOO_LARGE');
  }

  // Rate limiting
  const clientIP = request.headers.get('CF-Connecting-IP') ?? 'global';
  const rl = await checkRateLimit(env.EDGE_CACHE_KV, `classify:${clientIP}`, RATE_LIMITS.CLASSIFY);
  if (!rl.allowed) {
    return errorResponse('Rate limit exceeded', 429, request, 'RATE_LIMITED');
  }

  // Cache lookup
  let cacheKey = null;
  if (env.EDGE_CACHE_KV) {
    cacheKey = await makeCacheKey('classify', { texts: inputs });
    const cached = await kvCacheGet(env.EDGE_CACHE_KV, cacheKey);
    if (cached) {
      const headers = corsHeaders(request);
      headers.set('Content-Type', 'application/json');
      headers.set('X-Heady-Cache', 'HIT');
      return new Response(JSON.stringify(cached), { headers });
    }
  }

  try {
    // DistilBERT accepts single text input; batch sequentially for multiple
    const results = await Promise.all(
      inputs.map((t) => env.AI.run(MODELS.CLASSIFY, { text: t })),
    );

    const responsePayload = {
      classifications: results.map((r, i) => ({
        text: inputs[i],
        label: r[0]?.label ?? 'UNKNOWN',
        score: r[0]?.score ?? 0,
        all: r,
      })),
      model: MODELS.CLASSIFY,
      count: inputs.length,
      cached: false,
      timestamp: Date.now(),
    };

    if (cacheKey && env.EDGE_CACHE_KV) {
      ctx.waitUntil(kvCachePut(env.EDGE_CACHE_KV, cacheKey, responsePayload, CACHE_TTL.CLASSIFY));
    }

    const headers = corsHeaders(request);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Heady-Model', MODELS.CLASSIFY);
    headers.set('X-Heady-Cache', 'MISS');
    headers.set('X-RateLimit-Remaining', String(rl.remaining));
    return new Response(JSON.stringify(responsePayload), { headers });
  } catch (err) {
    console.error('[classify] inference error:', err);
    return errorResponse('Classification failed', 502, request, 'INFERENCE_FAILED');
  }
}

/**
 * Handle POST /api/rerank
 * Reranks documents relative to a query using BGE-reranker-base.
 * Returns documents sorted by relevance score.
 *
 * @param {Request} request
 * @param {Env} env
 * @param {ExecutionContext} ctx
 * @returns {Promise<Response>}
 */
async function handleRerank(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, request, 'INVALID_BODY');
  }

  const { query, documents, top_k } = body;

  if (!query || typeof query !== 'string') {
    return errorResponse('query string is required', 400, request, 'MISSING_QUERY');
  }

  if (!Array.isArray(documents) || documents.length === 0) {
    return errorResponse('documents array is required and non-empty', 400, request, 'MISSING_DOCUMENTS');
  }

  if (documents.length > 50) {
    return errorResponse('Maximum 50 documents per rerank request', 400, request, 'BATCH_TOO_LARGE');
  }

  // Rate limiting
  const clientIP = request.headers.get('CF-Connecting-IP') ?? 'global';
  const rl = await checkRateLimit(env.EDGE_CACHE_KV, `rerank:${clientIP}`, RATE_LIMITS.RERANK);
  if (!rl.allowed) {
    return errorResponse('Rate limit exceeded', 429, request, 'RATE_LIMITED');
  }

  // Cache lookup
  let cacheKey = null;
  if (env.EDGE_CACHE_KV) {
    cacheKey = await makeCacheKey('rerank', { query, documents });
    const cached = await kvCacheGet(env.EDGE_CACHE_KV, cacheKey);
    if (cached) {
      const headers = corsHeaders(request);
      headers.set('Content-Type', 'application/json');
      headers.set('X-Heady-Cache', 'HIT');
      return new Response(JSON.stringify(cached), { headers });
    }
  }

  try {
    const docTexts = documents.map((d) => (typeof d === 'string' ? d : d.text ?? d.content ?? ''));

    // BGE reranker accepts query + passages
    const result = await env.AI.run(MODELS.RERANK, {
      query,
      passages: docTexts,
    });

    // Build scored results with original document reference
    const scored = (result.data ?? result ?? []).map((score, i) => ({
      index: i,
      document: documents[i],
      score: typeof score === 'number' ? score : score?.score ?? 0,
    }));

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    const topK = top_k ?? scored.length;
    const responsePayload = {
      results: scored.slice(0, topK),
      model: MODELS.RERANK,
      query,
      total: documents.length,
      returned: Math.min(topK, scored.length),
      cached: false,
      timestamp: Date.now(),
    };

    if (cacheKey && env.EDGE_CACHE_KV) {
      ctx.waitUntil(kvCachePut(env.EDGE_CACHE_KV, cacheKey, responsePayload, CACHE_TTL.RERANK));
    }

    const headers = corsHeaders(request);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Heady-Model', MODELS.RERANK);
    headers.set('X-Heady-Cache', 'MISS');
    headers.set('X-RateLimit-Remaining', String(rl.remaining));
    return new Response(JSON.stringify(responsePayload), { headers });
  } catch (err) {
    console.error('[rerank] inference error:', err);
    return errorResponse('Reranking failed', 502, request, 'INFERENCE_FAILED');
  }
}

/**
 * Handle GET /api/health
 * Returns worker health and binding availability.
 *
 * @param {Request} request
 * @param {Env} env
 * @returns {Response}
 */
function handleHealth(request, env) {
  const headers = corsHeaders(request);
  headers.set('Content-Type', 'application/json');
  return new Response(
    JSON.stringify({
      status: 'ok',
      worker: 'edge-inference-worker',
      version: '1.0.0',
      bindings: {
        ai: !!env.AI,
        kv: !!env.EDGE_CACHE_KV,
        vectorize: !!env.VECTORIZE,
        agentDO: !!env.AGENT_STATE,
      },
      models: MODELS,
      timestamp: Date.now(),
    }),
    { headers },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main fetch handler
// ─────────────────────────────────────────────────────────────────────────────

export default {
  /**
   * Main fetch entrypoint for the Cloudflare Worker.
   *
   * @param {Request} request
   * @param {Env} env
   * @param {ExecutionContext} ctx
   * @returns {Promise<Response>}
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const path = url.pathname;

    // Preflight
    if (method === 'OPTIONS') {
      return handleOptions(request);
    }

    // Health check (no auth required)
    if (path === '/api/health' && method === 'GET') {
      return handleHealth(request, env);
    }

    // Auth validation for all other routes
    const token = validateAuth(request, env);
    if (!token && env.EDGE_API_KEY) {
      return errorResponse('Unauthorized — valid Bearer token required', 401, request, 'UNAUTHORIZED');
    }

    // Tag request with correlation ID
    const requestId = request.headers.get('X-Request-ID') ?? crypto.randomUUID();

    try {
      if (path === '/api/chat' && method === 'POST') {
        return await handleChat(request, env, ctx);
      }

      if (path === '/api/embed' && method === 'POST') {
        return await handleEmbed(request, env, ctx);
      }

      if (path === '/api/classify' && method === 'POST') {
        return await handleClassify(request, env, ctx);
      }

      if (path === '/api/rerank' && method === 'POST') {
        return await handleRerank(request, env, ctx);
      }

      // 404 for unknown paths
      return errorResponse(`Path ${path} not found`, 404, request, 'NOT_FOUND');
    } catch (err) {
      console.error(`[${requestId}] unhandled error:`, err);
      return errorResponse('Internal server error', 500, request, 'INTERNAL_ERROR');
    }
  },

  /**
   * Scheduled handler for cache warming and metric flushes.
   * Triggered by Cron Triggers defined in wrangler.toml.
   *
   * @param {ScheduledEvent} event
   * @param {Env} env
   * @param {ExecutionContext} ctx
   */
  async scheduled(event, env, ctx) {
    console.log('[scheduled] cron fired:', event.cron);
    // Placeholder for cache warm-up logic
    // In production, pre-embed common queries and store in EDGE_CACHE_KV
  },
};
