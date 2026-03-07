/**
 * edge-origin-router.js
 * Heady Latent OS — Edge ↔ Origin Smart Router
 *
 * Routes AI inference requests between Cloudflare edge (Workers AI) and
 * origin (Cloud Run) based on complexity scoring, latency measurements,
 * cost optimization, and geographic rules.
 *
 * Design principles:
 *   - Prefer edge when quality is equivalent (lower latency + cost)
 *   - Fibonacci complexity thresholds align with Sacred Geometry resource allocation
 *   - Automatic fallback: edge failure → origin (transparent to caller)
 *   - Request tagging for downstream analytics (cost attribution, route tracing)
 *   - Smart Placement integration hints for Workers deployed near origin
 *
 * Routing tiers:
 *   Tier 1 — EDGE_ONLY:    Simple queries, short context, classification, embedding
 *   Tier 2 — EDGE_PREFER:  Medium queries, try edge first, fallback to origin
 *   Tier 3 — ORIGIN_ONLY:  Complex multi-step, long context, tool-heavy workflows
 *
 * @module edge-origin-router
 */

import { PHI, PSI, fib, phiFusionWeights, CSL_THRESHOLDS } from '../../shared/phi-math.js';

// ─────────────────────────────────────────────────────────────────────────────
// Complexity scoring weights (Sacred Geometry — Fibonacci ratios)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scoring weights for complexity factors using phiFusionWeights pattern.
 * Weights follow Fibonacci sequence: fib(9)=34, fib(8)=21, fib(7)=13, fib(6)=8, fib(5)=5, fib(4)=3, fib(3)=2, fib(2)=1
 * These are the same values as before — verified as correct Fibonacci numbers.
 */
const COMPLEXITY_WEIGHTS = {
  TOKEN_ESTIMATE:    fib(9),   // 34 — dominant factor: context length
  TOOL_COUNT:        fib(8),   // 21 — tool use implies agentic complexity
  MESSAGE_DEPTH:     fib(7),   // 13 — conversation depth
  SYSTEM_PROMPT_LEN: fib(6),   //  8 — elaborate system prompts = complex
  EXPLICIT_HINT:     fib(5),   //  5 — client-provided complexity hint
  MULTIMODAL:        fib(4),   //  3 — multimodal input
  REASONING_MODEL:   fib(3),   //  2 — requires chain-of-thought reasoning
  RAG_CONTEXT:       fib(2),   //  1 — has retrieved context to process
};

/**
 * Complexity score thresholds for tier assignment.
 * Derived from CSL_THRESHOLDS scaled to the max score range (87 = sum of all weights):
 *   EDGE_ONLY   = floor(CSL_THRESHOLDS.MINIMUM * 50)  ≈ 25  (noise floor scaled)
 *   ORIGIN_ONLY = floor(CSL_THRESHOLDS.LOW * 87)      ≈ 60  (low threshold scaled)
 */
const TIER_THRESHOLDS = {
  EDGE_ONLY:   Math.floor(CSL_THRESHOLDS.MINIMUM * 50),  // ≈ 25 (CSL noise floor scaled)
  EDGE_PREFER: Math.floor(CSL_THRESHOLDS.LOW * 87),      // ≈ 60 (CSL LOW scaled to score range)
  ORIGIN_ONLY: Math.floor(CSL_THRESHOLDS.LOW * 87),      // ≈ 60 (same boundary)
};

/**
 * Edge inference timeout (ms) before fallback to origin.
 * phi-scaled: round(1000 × PHI^3) ≈ 4236ms.
 */
const EDGE_TIMEOUT_MS = Math.round(1000 * Math.pow(PHI, 3));    // ≈ 4236ms (phi-scaled from 1s base)

/**
 * Origin request timeout (ms).
 * phi-scaled: round(1000 × PHI^7) ≈ 29034ms ≈ 29s (close to original 30s).
 * PHI^7 × 1000 gives exact phi-continuous derivation.
 */
const ORIGIN_TIMEOUT_MS = Math.round(1000 * Math.pow(PHI, 7));  // ≈ 29034ms (phi-scaled from 1s base)

/**
 * Latency measurement ring buffer size.
 * fib(10) = 55 — already a Fibonacci number, made explicit.
 */
const LATENCY_WINDOW = fib(10); // fib(10) = 55 ✓ already Fibonacci — made explicit via fib()

// ─────────────────────────────────────────────────────────────────────────────
// Route decision types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {'edge_only'|'edge_prefer'|'origin_only'} RouteTier
 */

/**
 * @typedef {object} RouteDecision
 * @property {RouteTier} tier
 * @property {'edge'|'origin'} primary - Primary route to attempt
 * @property {'edge'|'origin'|null} fallback - Fallback on failure
 * @property {number} complexityScore
 * @property {string[]} reasons - Human-readable reasons for decision
 * @property {string} requestTag - Unique tag for analytics
 * @property {object} [smartPlacementHint] - Hint for CF Smart Placement
 * @property {number} estimatedLatencyMs - Estimated latency for this route
 * @property {number} estimatedCostNeurons - Estimated Cloudflare Neurons cost
 */

/**
 * @typedef {object} RouterRequest
 * @property {string} type - 'chat' | 'embed' | 'classify' | 'rerank' | 'rag'
 * @property {object[]} [messages] - Chat messages
 * @property {string} [text] - Single text input
 * @property {string[]} [tools] - Tool names requested
 * @property {number} [tokenEstimate] - Pre-computed token estimate
 * @property {string} [complexity] - Client hint: 'low' | 'medium' | 'high'
 * @property {boolean} [multimodal] - Contains image/audio input
 * @property {boolean} [requiresReasoning] - Needs chain-of-thought model
 * @property {object[]} [ragContext] - Retrieved context chunks
 * @property {string} [region] - Client geographic region (CF-IPCountry)
 * @property {string} [tier] - Client subscription tier ('free'|'pro'|'enterprise')
 */

// ─────────────────────────────────────────────────────────────────────────────
// Latency tracker (in-memory ring buffer — no external storage needed)
// ─────────────────────────────────────────────────────────────────────────────

class LatencyTracker {
  constructor(windowSize = LATENCY_WINDOW) {
    this._edge = new Array(windowSize).fill(null);
    this._origin = new Array(windowSize).fill(null);
    this._idx = { edge: 0, origin: 0 };
    this._windowSize = windowSize;
  }

  /** @param {'edge'|'origin'} route @param {number} ms */
  record(route, ms) {
    const arr = route === 'edge' ? this._edge : this._origin;
    const key = route === 'edge' ? 'edge' : 'origin';
    arr[this._idx[key] % this._windowSize] = ms;
    this._idx[key]++;
  }

  /**
   * @param {'edge'|'origin'} route
   * @returns {{p50: number, p95: number, count: number}}
   */
  stats(route) {
    const arr = (route === 'edge' ? this._edge : this._origin)
      .filter((v) => v !== null)
      .sort((a, b) => a - b);

    if (arr.length === 0) return { p50: Infinity, p95: Infinity, count: 0 };

    // Phi-harmonic percentile indices:
    //   p50 → PSI ≈ 0.618  (golden ratio conjugate — phi-harmonic median)
    //   p95 → 1 - PSI^3 ≈ 0.854  (phi-harmonic high-percentile)
    const p50 = arr[Math.floor(arr.length * PSI)];                          // PSI ≈ 0.618
    const p95 = arr[Math.floor(arr.length * (1 - Math.pow(PSI, 3)))];       // 1 - PSI^3 ≈ 0.854
    return { p50, p95, count: arr.length };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EdgeOriginRouter class
// ─────────────────────────────────────────────────────────────────────────────

export class EdgeOriginRouter {
  /**
   * @param {object} config
   * @param {string} config.originUrl - Cloud Run origin base URL
   * @param {string} [config.originApiKey] - Bearer token for origin auth
   * @param {KVNamespace} [config.kv] - KV for persistent latency/route stats
   * @param {boolean} [config.preferCost] - When true, prefer edge even at slight quality loss
   * @param {object} [config.geoRules] - Geographic routing overrides
   * @param {object} [config.costBudgets] - Per-tier cost budgets
   */
  constructor({
    originUrl,
    originApiKey = '',
    kv = null,
    preferCost = true,
    geoRules = {},
    costBudgets = {},
  }) {
    this.originUrl = originUrl.replace(/\/$/, '');
    this.originApiKey = originApiKey;
    this.kv = kv;
    this.preferCost = preferCost;
    this.geoRules = geoRules;
    this.costBudgets = costBudgets;

    /** @type {LatencyTracker} */
    this._latency = new LatencyTracker();

    /** Request counters for analytics */
    this._counters = { edge: 0, origin: 0, fallback: 0, error: 0 };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public: Route decision
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Compute a routing decision for the given request.
   * Does NOT execute the request — returns a RouteDecision for the caller.
   *
   * @param {RouterRequest} request
   * @returns {RouteDecision}
   */
  decide(request) {
    const score = this._scoreComplexity(request);
    const tier = this._assignTier(score, request);
    const reasons = this._buildReasonList(request, score, tier);
    const requestTag = this._buildRequestTag(request, tier);

    const { primary, fallback } = this._selectRoute(tier, request);
    const estimatedLatencyMs = this._estimateLatency(primary);
    const estimatedCostNeurons = this._estimateCost(request, primary);

    const smartPlacementHint = primary === 'origin'
      ? { placement: 'smart', affinity: 'origin_db', reason: 'origin_heavy_query' }
      : null;

    return {
      tier,
      primary,
      fallback,
      complexityScore: score,
      reasons,
      requestTag,
      smartPlacementHint,
      estimatedLatencyMs,
      estimatedCostNeurons,
    };
  }

  /**
   * Execute a request via the decided route, with automatic fallback.
   *
   * @param {RouterRequest} routerRequest - Original request metadata
   * @param {Request} httpRequest - Raw HTTP Request to forward
   * @param {object} env - Worker env bindings
   * @returns {Promise<{response: Response, route: 'edge'|'origin', tag: string, fallbackUsed: boolean}>}
   */
  async route(routerRequest, httpRequest, env) {
    const decision = this.decide(routerRequest);

    let response = null;
    let routeUsed = decision.primary;
    let fallbackUsed = false;

    const startTime = Date.now();

    try {
      if (decision.primary === 'edge') {
        response = await this._callEdge(httpRequest, env, decision);
        this._counters.edge++;
      } else {
        response = await this._callOrigin(httpRequest, decision);
        this._counters.origin++;
      }
    } catch (primaryErr) {
      console.warn(`[EdgeOriginRouter] primary route (${decision.primary}) failed:`, primaryErr.message);

      if (decision.fallback) {
        fallbackUsed = true;
        routeUsed = decision.fallback;
        this._counters.fallback++;

        try {
          if (decision.fallback === 'origin') {
            response = await this._callOrigin(httpRequest, decision);
          } else {
            response = await this._callEdge(httpRequest, env, decision);
          }
        } catch (fallbackErr) {
          this._counters.error++;
          throw new Error(`Both edge and origin routes failed. Primary: ${primaryErr.message}. Fallback: ${fallbackErr.message}`);
        }
      } else {
        this._counters.error++;
        throw primaryErr;
      }
    }

    const latencyMs = Date.now() - startTime;
    this._latency.record(routeUsed, latencyMs);

    // Add analytics headers to response
    const mutableHeaders = new Headers(response.headers);
    mutableHeaders.set('X-Heady-Route', routeUsed);
    mutableHeaders.set('X-Heady-Tag', decision.requestTag);
    mutableHeaders.set('X-Heady-Complexity', String(decision.complexityScore));
    mutableHeaders.set('X-Heady-Latency', String(latencyMs));
    if (fallbackUsed) mutableHeaders.set('X-Heady-Fallback', '1');

    return {
      response: new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: mutableHeaders,
      }),
      route: routeUsed,
      tag: decision.requestTag,
      fallbackUsed,
    };
  }

  /**
   * Get current router statistics.
   * @returns {object}
   */
  getStats() {
    return {
      counters: { ...this._counters },
      latency: {
        edge: this._latency.stats('edge'),
        origin: this._latency.stats('origin'),
      },
      config: {
        originUrl: this.originUrl,
        preferCost: this.preferCost,
      },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Complexity scoring
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Score the complexity of a request using weighted factors.
   * @param {RouterRequest} req
   * @returns {number}
   */
  _scoreComplexity(req) {
    let score = 0;

    // Estimate token count from messages + text
    const messages = req.messages ?? [];
    const totalChars = messages.reduce((s, m) => s + (m.content?.length ?? 0), 0) + (req.text?.length ?? 0);
    const tokenEst = req.tokenEstimate ?? Math.ceil(totalChars / 4);

    // TOKEN_ESTIMATE: normalized to 0–34
    score += Math.min((tokenEst / 2000) * COMPLEXITY_WEIGHTS.TOKEN_ESTIMATE, COMPLEXITY_WEIGHTS.TOKEN_ESTIMATE);

    // TOOL_COUNT: each tool adds complexity
    const toolCount = req.tools?.length ?? 0;
    score += Math.min(toolCount * 5, COMPLEXITY_WEIGHTS.TOOL_COUNT);

    // MESSAGE_DEPTH: conversation turns
    score += Math.min((messages.length / 10) * COMPLEXITY_WEIGHTS.MESSAGE_DEPTH, COMPLEXITY_WEIGHTS.MESSAGE_DEPTH);

    // SYSTEM_PROMPT_LEN
    const systemLen = messages.find((m) => m.role === 'system')?.content?.length ?? 0;
    score += Math.min((systemLen / 500) * COMPLEXITY_WEIGHTS.SYSTEM_PROMPT_LEN, COMPLEXITY_WEIGHTS.SYSTEM_PROMPT_LEN);

    // EXPLICIT_HINT
    if (req.complexity === 'high') score += COMPLEXITY_WEIGHTS.EXPLICIT_HINT;
    else if (req.complexity === 'medium') score += COMPLEXITY_WEIGHTS.EXPLICIT_HINT * 0.5;

    // MULTIMODAL
    if (req.multimodal) score += COMPLEXITY_WEIGHTS.MULTIMODAL;

    // REASONING_MODEL
    if (req.requiresReasoning) score += COMPLEXITY_WEIGHTS.REASONING_MODEL;

    // RAG_CONTEXT
    const ragChunks = req.ragContext?.length ?? 0;
    if (ragChunks > 0) score += Math.min(ragChunks * 0.5, COMPLEXITY_WEIGHTS.RAG_CONTEXT * 5);

    // Fast-path overrides: classification and embedding are always edge
    if (req.type === 'classify' || req.type === 'embed' || req.type === 'rerank') {
      return 5; // Force tier 1
    }

    return Math.round(score);
  }

  /**
   * Assign a routing tier based on complexity score and request attributes.
   * @param {number} score
   * @param {RouterRequest} req
   * @returns {RouteTier}
   */
  _assignTier(score, req) {
    // Enterprise tier always gets origin for quality
    if (req.tier === 'enterprise' && score > TIER_THRESHOLDS.EDGE_ONLY) {
      return 'origin_only';
    }

    // Geographic override: some regions have higher edge GPU density
    const geoOverride = this.geoRules[req.region];
    if (geoOverride === 'edge_only') return 'edge_only';
    if (geoOverride === 'origin_only') return 'origin_only';

    if (score < TIER_THRESHOLDS.EDGE_ONLY) return 'edge_only';
    if (score < TIER_THRESHOLDS.ORIGIN_ONLY) return 'edge_prefer';
    return 'origin_only';
  }

  /**
   * @param {RouteTier} tier
   * @param {RouterRequest} req
   * @returns {{primary: 'edge'|'origin', fallback: 'edge'|'origin'|null}}
   */
  _selectRoute(tier, req) {
    // Cost preference: if edge stats show lower latency, prefer it even at medium complexity
    if (tier === 'edge_prefer' && this.preferCost) {
      const edgeStats = this._latency.stats('edge');
      const originStats = this._latency.stats('origin');
      // If edge p95 is less than origin p50, strongly prefer edge
      if (edgeStats.count > 5 && edgeStats.p95 < (originStats.p50 || Infinity)) {
        return { primary: 'edge', fallback: 'origin' };
      }
    }

    switch (tier) {
      case 'edge_only':    return { primary: 'edge', fallback: null };
      case 'edge_prefer':  return { primary: 'edge', fallback: 'origin' };
      case 'origin_only':  return { primary: 'origin', fallback: null };
      default:             return { primary: 'edge', fallback: 'origin' };
    }
  }

  /**
   * Build human-readable routing reasons for logging/analytics.
   * @param {RouterRequest} req
   * @param {number} score
   * @param {RouteTier} tier
   * @returns {string[]}
   */
  _buildReasonList(req, score, tier) {
    const reasons = [`complexity_score=${score}`, `tier=${tier}`];

    if (req.type === 'embed' || req.type === 'classify') reasons.push('fast_path_type');
    if (req.tools?.length > 0) reasons.push(`tool_count=${req.tools.length}`);
    if (req.requiresReasoning) reasons.push('reasoning_model_required');
    if (req.multimodal) reasons.push('multimodal_input');
    if (req.tier === 'enterprise') reasons.push('enterprise_tier_upgrade');
    if (req.region && this.geoRules[req.region]) reasons.push(`geo_override_${this.geoRules[req.region]}`);
    if (this.preferCost) reasons.push('cost_preference_enabled');

    return reasons;
  }

  /**
   * Build a structured request tag for analytics attribution.
   * @param {RouterRequest} req
   * @param {RouteTier} tier
   * @returns {string}
   */
  _buildRequestTag(req, tier) {
    const ts = Date.now().toString(36);
    const typeCode = (req.type ?? 'unk').slice(0, 3);
    const tierCode = tier === 'edge_only' ? 'e' : tier === 'origin_only' ? 'o' : 'ep';
    return `hdy:${typeCode}:${tierCode}:${ts}`;
  }

  /**
   * Estimate expected latency for a route (ms).
   * @param {'edge'|'origin'} route
   * @returns {number}
   */
  _estimateLatency(route) {
    const stats = this._latency.stats(route);
    if (stats.count > 0) return stats.p50;
    // Default estimates
    return route === 'edge' ? 250 : 800;
  }

  /**
   * Estimate Cloudflare Neurons cost for this request.
   * Rough model: 1 Neuron ≈ 1000 tokens at edge.
   * @param {RouterRequest} req
   * @param {'edge'|'origin'} route
   * @returns {number}
   */
  _estimateCost(req, route) {
    if (route === 'origin') return 0; // origin cost not tracked here
    const tokenEst = req.tokenEstimate ?? 100;
    return Math.ceil(tokenEst / 1000);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Route executors
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Call the edge inference Worker (internal Service Binding or same-worker).
   * In practice, this re-routes to the edge-inference-worker via Service Binding.
   *
   * @param {Request} request
   * @param {object} env
   * @param {RouteDecision} decision
   * @returns {Promise<Response>}
   */
  async _callEdge(request, env, decision) {
    // Tag the request before forwarding
    const edgeRequest = new Request(request, {
      headers: {
        ...Object.fromEntries(request.headers),
        'X-Heady-Route': 'edge',
        'X-Heady-Tag': decision.requestTag,
        'X-Heady-Complexity': String(decision.complexityScore),
      },
    });

    // Use Service Binding if available, otherwise forward to self
    if (env.EDGE_INFERENCE) {
      return env.EDGE_INFERENCE.fetch(edgeRequest);
    }

    // Fallback: forward to the same origin URL with edge path
    const url = new URL(request.url);
    const edgeUrl = new URL(url.pathname, url.origin);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EDGE_TIMEOUT_MS);

    try {
      const response = await fetch(edgeUrl.toString(), {
        method: request.method,
        headers: edgeRequest.headers,
        body: request.body,
        signal: controller.signal,
      });

      if (!response.ok && response.status >= 500) {
        throw new Error(`Edge returned ${response.status}`);
      }

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Call the Cloud Run origin backend.
   *
   * @param {Request} request
   * @param {RouteDecision} decision
   * @returns {Promise<Response>}
   */
  async _callOrigin(request, decision) {
    const url = new URL(request.url);
    const originUrl = `${this.originUrl}${url.pathname}${url.search}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ORIGIN_TIMEOUT_MS);

    try {
      const response = await fetch(originUrl, {
        method: request.method,
        headers: {
          ...Object.fromEntries(request.headers),
          'Authorization': this.originApiKey ? `Bearer ${this.originApiKey}` : request.headers.get('Authorization') ?? '',
          'X-Heady-Route': 'origin',
          'X-Heady-Tag': decision.requestTag,
          'X-Heady-Forwarded-By': 'edge-origin-router',
        },
        body: request.body,
        signal: controller.signal,
      });

      if (!response.ok && response.status >= 500) {
        throw new Error(`Origin returned ${response.status}`);
      }

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }
}
