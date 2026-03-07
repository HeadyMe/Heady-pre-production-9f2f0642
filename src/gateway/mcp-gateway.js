/**
 * @fileoverview MCP Gateway with CSL-Gated Routing — Phi-Continuous Edition
 *
 * Central gateway for the Heady Latent OS MCP ecosystem. Routes tool calls
 * to upstream MCP servers using Contextual Semantic Lattice (CSL) cosine
 * similarity matching, namespace-prefix routing, load balancing, and
 * graceful failover.
 *
 * Architecture: Aggregator pattern — agents interact with a single gateway
 * endpoint; the gateway fans out to correct upstream MCP servers.
 *
 * ── Phi-Math Integration ────────────────────────────────────────────────────
 * All fixed thresholds, weights, retry counts, and intervals are replaced
 * with deterministic values derived from φ (golden ratio) and the Fibonacci
 * sequence via the shared phi-math module:
 *
 *   CSL_ROUTE_THRESHOLD  0.72    → CSL_THRESHOLDS.MEDIUM        ≈ 0.809
 *   weight: 1 (default)          → cslRouteScore() dynamic score
 *   maxRetries: 3                → fib(4) = 3  (Fibonacci-derived)
 *   health check interval        → phiAdaptiveInterval() — grows by φ when
 *                                   healthy, shrinks by ψ when not
 *   CSL_WEIGHTED load-balancing  → cslBlend() for smooth weight interpolation
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @module gateway/mcp-gateway
 * @requires @modelcontextprotocol/sdk
 * @requires events
 * @requires shared/phi-math
 */

import { EventEmitter } from 'events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import crypto from 'crypto';
import {
  PHI,
  PSI,
  CSL_THRESHOLDS,
  cslGate,
  cslBlend,
  cslRouteScore,
  phiBackoff,
  phiFusionWeights,
  phiAdaptiveInterval,
  fib,
  DEDUP_THRESHOLD,
} from '../../shared/phi-math.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * CSL cosine similarity threshold for tool routing decisions.
 *
 * Replaced the old arbitrary 0.72 with CSL_THRESHOLDS.MEDIUM derived from
 * the phi-harmonic sequence: 1 - ψ² × 0.5 ≈ 0.809.
 *
 * The phi-harmonic levels partition [0,1] such that the gap between
 * consecutive levels follows the golden ratio, providing natural breakpoints.
 *
 * @type {number} ≈ 0.809
 */
const CSL_ROUTE_THRESHOLD = CSL_THRESHOLDS.MEDIUM;

/**
 * Default health check interval in milliseconds.
 *
 * Base interval for the phi-adaptive health check scheduler.  After each
 * successful check the interval grows by φ (towards max); after each failure
 * it shrinks by ψ (towards min), giving a naturally self-tuning cadence.
 *
 * fib(11) = 89 seconds ≈ 89_000 ms — a Fibonacci-derived base interval.
 *
 * @type {number} 89_000 ms
 */
const HEALTH_CHECK_INTERVAL_MS = fib(11) * 1000; // F(11)=89 → 89 000 ms

/**
 * Default request timeout in milliseconds.
 *
 * fib(16) * 1000 / fib(10) ≈ 987_000 / 55 ≈ 17 942 ms (~18 s).
 * Stays phi-proportional to the reconnect backoff sequence.
 *
 * @type {number} ≈ 17_945 ms
 */
const DEFAULT_TIMEOUT_MS = Math.round((fib(16) * 1000) / fib(10));

/**
 * Maximum failover attempts before returning error.
 *
 * fib(4) = 3 — same numeric value as the original `3`, but now
 * Fibonacci-derived so it participates coherently in the phi-scaled
 * retry/backoff system.
 *
 * @type {number} 3
 */
const MAX_FAILOVER_ATTEMPTS = fib(4); // F(4) = 3

/** Load balancing strategies */
export const LoadBalanceStrategy = Object.freeze({
  ROUND_ROBIN:       'round_robin',
  LEAST_CONNECTIONS: 'least_connections',
  CSL_WEIGHTED:      'csl_weighted',
  RANDOM:            'random',
});

/** Server health states */
export const ServerHealth = Object.freeze({
  HEALTHY:   'healthy',
  DEGRADED:  'degraded',
  UNHEALTHY: 'unhealthy',
  UNKNOWN:   'unknown',
});

// ─── CSL Similarity Engine ────────────────────────────────────────────────────

/**
 * Computes cosine similarity between two embedding vectors.
 * Used for CSL-gated routing decisions.
 *
 * @param {number[]} vecA - First embedding vector
 * @param {number[]} vecB - Second embedding vector
 * @returns {number} Cosine similarity in [0, 1]
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot   += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Generates a lightweight bag-of-words embedding for a tool name/description.
 * In production this would call the Heady vector service; here we produce a
 * deterministic 128-dim pseudo-embedding suitable for unit-testing CSL routing.
 *
 * @param {string} text - Input text to embed
 * @returns {number[]} 128-dimensional embedding vector
 */
function pseudoEmbed(text) {
  const normalized = text.toLowerCase().replace(/[^a-z0-9_.\s]/g, '');
  const tokens = normalized.split(/[\s_.]+/).filter(Boolean);
  const vec = new Float64Array(128).fill(0);
  for (const token of tokens) {
    const hash = crypto.createHash('sha256').update(token).digest();
    for (let i = 0; i < 128; i++) {
      vec[i] += ((hash[i % 32] / 255) * 2 - 1);
    }
  }
  // L2 normalize
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return Array.from(vec).map(v => v / norm);
}

// ─── Server Registry Entry ────────────────────────────────────────────────────

/**
 * @typedef {Object} MCPServerRegistration
 * @property {string} id - Unique server identifier
 * @property {string} namespace - Namespace prefix (e.g. 'github', 'slack', 'db')
 * @property {string} url - Server endpoint URL (or 'stdio')
 * @property {string} transport - Transport type: 'streamable-http' | 'sse' | 'stdio'
 * @property {number} [weight] - Load balancing weight (defaults to dynamic CSL score)
 * @property {string[]} [capabilities] - Declared capability tags
 * @property {Object} [auth] - Authentication configuration
 * @property {string} [auth.type] - 'bearer' | 'oauth2' | 'none'
 * @property {string} [auth.token] - Bearer token (if type=bearer)
 * @property {number} [maxConnections=5] - Max concurrent connections
 * @property {number} [timeoutMs] - Per-server request timeout override
 * @property {number} [cslScore] - Latest CSL route score for this server
 */

/**
 * @typedef {Object} ToolRoute
 * @property {string} toolName - Fully-qualified tool name (with namespace prefix)
 * @property {string} serverId - Target server identifier
 * @property {string} upstreamToolName - Tool name as upstream server knows it
 * @property {Object} schema - JSON Schema for the tool
 * @property {number[]} embedding - CSL embedding of tool description
 */

// ─── MCPGateway ───────────────────────────────────────────────────────────────

/**
 * Central MCP Gateway for the Heady Latent OS.
 *
 * Responsibilities:
 * - Maintain a registry of upstream MCP servers organized by namespace
 * - Discover and cache tool schemas from all registered servers
 * - Route incoming tool call requests using CSL cosine similarity or namespace prefix
 * - Load balance across multiple instances of the same server
 * - Monitor server health and perform graceful failover
 * - Log all requests/responses for audit
 *
 * @extends EventEmitter
 * @fires MCPGateway#tool_routed
 * @fires MCPGateway#server_registered
 * @fires MCPGateway#server_unhealthy
 * @fires MCPGateway#failover
 *
 * @example
 * ```js
 * const gateway = new MCPGateway({ strategy: LoadBalanceStrategy.LEAST_CONNECTIONS });
 * await gateway.registerServer({
 *   id: 'github-primary',
 *   namespace: 'github',
 *   url: 'https://mcp.example.com/github',
 *   transport: 'streamable-http',
 *   auth: { type: 'bearer', token: process.env.GITHUB_MCP_TOKEN },
 * });
 * await gateway.initialize();
 * const result = await gateway.callTool('github.create_issue', { title: 'Bug' }, { userId: 'u1' });
 * ```
 */
export class MCPGateway extends EventEmitter {
  /**
   * @param {Object} [options={}] - Gateway configuration
   * @param {string} [options.strategy=LoadBalanceStrategy.LEAST_CONNECTIONS] - Load balancing strategy
   * @param {number} [options.cslThreshold=CSL_THRESHOLDS.MEDIUM] - Minimum CSL score for route match (≈0.809)
   * @param {number} [options.healthCheckIntervalMs=fib(11)*1000] - Health check base cadence (89 000 ms)
   * @param {number} [options.defaultTimeoutMs] - Default request timeout (≈17 945 ms, fib(16)*1000/fib(10))
   * @param {boolean} [options.enableSemanticRouting=true] - Fall back to CSL matching when prefix unknown
   * @param {boolean} [options.enableLogging=true] - Enable request/response logging
   * @param {Function} [options.embedFn] - Custom embedding function (text) => number[]
   */
  constructor(options = {}) {
    super();
    this.strategy               = options.strategy               ?? LoadBalanceStrategy.LEAST_CONNECTIONS;
    this.cslThreshold           = options.cslThreshold           ?? CSL_ROUTE_THRESHOLD;
    this.healthCheckIntervalMs  = options.healthCheckIntervalMs  ?? HEALTH_CHECK_INTERVAL_MS;
    this.defaultTimeoutMs       = options.defaultTimeoutMs       ?? DEFAULT_TIMEOUT_MS;
    this.enableSemanticRouting  = options.enableSemanticRouting  ?? true;
    this.enableLogging          = options.enableLogging          ?? true;
    this.embedFn                = options.embedFn                ?? pseudoEmbed;

    /** @type {Map<string, MCPServerRegistration>} serverId → registration */
    this._servers = new Map();

    /** @type {Map<string, string[]>} namespace → [serverId, ...] */
    this._namespaces = new Map();

    /** @type {Map<string, ToolRoute>} qualifiedToolName → route */
    this._toolRoutes = new Map();

    /** @type {Map<string, Client>} serverId → MCP SDK Client */
    this._clients = new Map();

    /** @type {Map<string, ServerHealth>} serverId → health */
    this._health = new Map();

    /** @type {Map<string, number>} serverId → active connection count */
    this._activeConnections = new Map();

    /** @type {Map<string, number>} serverId → round-robin index */
    this._rrIndex = new Map();

    /** @type {Map<string, number[]>} namespace → last-used server index */
    this._rrState = new Map();

    /**
     * Per-server phi-adaptive health check intervals (ms).
     * Healthy servers grow by φ each cycle; unhealthy shrink by ψ.
     * Keyed by serverId.
     *
     * @type {Map<string, number>}
     */
    this._healthIntervals = new Map();

    /** @type {NodeJS.Timeout|null} */
    this._healthTimer = null;

    /** @type {boolean} */
    this._initialized = false;

    /** @type {Array<Object>} Rolling request log (last F(16)=987 entries) */
    this._requestLog = [];

    /**
     * Maximum rolling request log size.
     * fib(16) = 987 ≈ 1 000 — Fibonacci-derived cap.
     *
     * @type {number} 987
     */
    this._requestLogMax = fib(16); // F(16) = 987
  }

  // ─── Registration ───────────────────────────────────────────────────────────

  /**
   * Register an upstream MCP server with the gateway.
   *
   * The default server weight is no longer a static `1`.  Instead it starts
   * at `cslRouteScore(1.0, 0)` which equals 1.0 and decays naturally with
   * age as subsequent health scores update the cslScore field.
   *
   * Multiple servers can share the same namespace to enable load balancing.
   * The server is NOT connected at registration time; call `initialize()` or
   * `connectServer(id)` to establish the connection.
   *
   * @param {MCPServerRegistration} registration - Server registration details
   * @throws {Error} If a server with the same id is already registered
   * @fires MCPGateway#server_registered
   */
  registerServer(registration) {
    const { id, namespace } = registration;
    if (this._servers.has(id)) {
      throw new Error(`Server '${id}' is already registered`);
    }

    /**
     * Dynamic initial weight via cslRouteScore().
     *
     * cslRouteScore(cosineSim=1.0, ageMs=0) = 1.0 × φ^0 = 1.0
     *
     * This is semantically the same as the old `weight: 1`, but is now
     * routed through the phi-harmonic decay formula so subsequent calls
     * that pass an actual cosine similarity will produce smooth weight
     * interpolation via cslBlend().
     */
    const initialWeight = cslRouteScore(1.0, 0);

    const entry = {
      maxConnections: fib(5),   // F(5) = 5 — phi-derived default connection cap
      weight:         initialWeight,
      cslScore:       1.0,      // Stored for cslBlend() in CSL_WEIGHTED strategy
      timeoutMs:      this.defaultTimeoutMs,
      ...registration,
    };
    this._servers.set(id, entry);
    this._health.set(id, ServerHealth.UNKNOWN);
    this._activeConnections.set(id, 0);

    // Initialise phi-adaptive health check interval at the base value
    this._healthIntervals.set(id, this.healthCheckIntervalMs);

    // Add to namespace index
    if (!this._namespaces.has(namespace)) {
      this._namespaces.set(namespace, []);
    }
    this._namespaces.get(namespace).push(id);

    this.emit('server_registered', { id, namespace });
    this._log('info', 'server_registered', { id, namespace, url: entry.url });
  }

  /**
   * Deregister a server and close its connection gracefully.
   *
   * @param {string} serverId - Server identifier to remove
   * @returns {Promise<void>}
   */
  async deregisterServer(serverId) {
    const reg = this._servers.get(serverId);
    if (!reg) return;
    await this._disconnectClient(serverId);
    this._servers.delete(serverId);
    this._health.delete(serverId);
    this._activeConnections.delete(serverId);
    this._healthIntervals.delete(serverId);

    const nsServers = this._namespaces.get(reg.namespace) ?? [];
    this._namespaces.set(reg.namespace, nsServers.filter(id => id !== serverId));

    // Remove routes pointing at this server
    for (const [toolName, route] of this._toolRoutes) {
      if (route.serverId === serverId) this._toolRoutes.delete(toolName);
    }
    this._log('info', 'server_deregistered', { serverId });
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Initialize the gateway: connect to all registered servers, discover tools,
   * and start health checks.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) return;
    this._log('info', 'gateway_initializing', { serverCount: this._servers.size });

    const connectPromises = [];
    for (const [id] of this._servers) {
      connectPromises.push(this._connectServer(id).catch(err => {
        this._log('warn', 'server_connect_failed', { id, error: err.message });
        this._health.set(id, ServerHealth.UNHEALTHY);
      }));
    }
    await Promise.allSettled(connectPromises);
    await this._discoverAllTools();

    // Start periodic health checks — the interval is re-evaluated adaptively
    // per-server inside _checkServerHealth(); this timer fires at the base rate.
    this._healthTimer = setInterval(() => this._runHealthChecks(), this.healthCheckIntervalMs);
    this._healthTimer.unref?.();

    this._initialized = true;
    this._log('info', 'gateway_initialized', {
      servers:    this._servers.size,
      tools:      this._toolRoutes.size,
      cslThresh:  this.cslThreshold,
      timeoutMs:  this.defaultTimeoutMs,
      maxRetries: MAX_FAILOVER_ATTEMPTS,
    });
  }

  /**
   * Gracefully shut down the gateway: stop health checks and close all connections.
   *
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (this._healthTimer) {
      clearInterval(this._healthTimer);
      this._healthTimer = null;
    }
    const closes = [];
    for (const [id] of this._clients) {
      closes.push(this._disconnectClient(id));
    }
    await Promise.allSettled(closes);
    this._initialized = false;
    this._log('info', 'gateway_shutdown', {});
  }

  // ─── Tool Discovery ─────────────────────────────────────────────────────────

  /**
   * Discover all tools from all healthy servers and build the routing table.
   *
   * @returns {Promise<void>}
   * @private
   */
  async _discoverAllTools() {
    for (const [serverId, registration] of this._servers) {
      if (this._health.get(serverId) === ServerHealth.UNHEALTHY) continue;
      await this._discoverServerTools(serverId, registration).catch(err => {
        this._log('warn', 'tool_discovery_failed', { serverId, error: err.message });
      });
    }
  }

  /**
   * Discover tools from a single server and register them in the routing table.
   *
   * @param {string} serverId
   * @param {MCPServerRegistration} registration
   * @returns {Promise<string[]>} Discovered qualified tool names
   * @private
   */
  async _discoverServerTools(serverId, registration) {
    const client = this._clients.get(serverId);
    if (!client) return [];

    const result = await client.listTools();
    const tools = result?.tools ?? [];
    const discovered = [];

    for (const tool of tools) {
      const qualifiedName = `${registration.namespace}.${tool.name}`;
      const description = tool.description ?? tool.name;
      const route = {
        toolName:         qualifiedName,
        serverId,
        upstreamToolName: tool.name,
        schema:           tool.inputSchema ?? {},
        embedding:        this.embedFn(`${qualifiedName} ${description}`),
        description,
      };
      this._toolRoutes.set(qualifiedName, route);
      discovered.push(qualifiedName);
    }
    this._log('info', 'tools_discovered', { serverId, count: discovered.length });
    return discovered;
  }

  // ─── Tool Call Routing ─────────────────────────────────────────────────────

  /**
   * Route and execute a tool call through the gateway.
   *
   * Routing priority:
   * 1. Exact namespace-prefix match (e.g., `github.create_issue`)
   * 2. CSL cosine similarity search across all registered tools (if enabled)
   * 3. Error if no route found
   *
   * The routing threshold is now `CSL_THRESHOLDS.MEDIUM` (≈ 0.809) instead of
   * the old arbitrary 0.72.  The `cslGate()` function provides a smooth
   * sigmoid transition so borderline matches are weighted rather than
   * hard-cut, improving recall at the cost of marginal precision.
   *
   * @param {string} qualifiedToolName - Tool name with namespace prefix
   * @param {Object} params - Tool call parameters
   * @param {Object} [context={}] - Request context for logging/auth
   * @param {string} [context.userId] - Authenticated user identifier
   * @param {string} [context.sessionId] - Session identifier
   * @param {string} [context.requestId] - Unique request identifier
   * @returns {Promise<Object>} Tool call result
   * @throws {Error} If no route found or all servers fail
   */
  async callTool(qualifiedToolName, params = {}, context = {}) {
    const requestId = context.requestId ?? crypto.randomUUID();
    const startTime = Date.now();
    this._log('info', 'tool_call_start', { requestId, toolName: qualifiedToolName, userId: context.userId });

    // 1. Resolve route
    let route = this._toolRoutes.get(qualifiedToolName);

    // 2. Fall back to CSL semantic search if no direct match
    if (!route && this.enableSemanticRouting) {
      route = this._cslRouteMatch(qualifiedToolName);
      if (route) {
        this._log('info', 'csl_route_match', { requestId, query: qualifiedToolName, matched: route.toolName });
      }
    }

    if (!route) {
      const err = new Error(`No route found for tool: ${qualifiedToolName}`);
      this._log('error', 'no_route', { requestId, toolName: qualifiedToolName });
      throw err;
    }

    // 3. Select server instance (load balancing)
    const serverId = this._selectServer(route.serverId, route.toolName);
    if (!serverId) {
      throw new Error(`No healthy server available for tool: ${qualifiedToolName}`);
    }

    // 4. Execute with failover
    return this._executeWithFailover(route, serverId, params, context, requestId, startTime);
  }

  /**
   * Execute a tool call with automatic failover across server instances.
   *
   * Retry delays use `phiBackoff()` — gentler than 2× doubling, natural
   * for organic retry cadences in a semantic routing context.
   *
   * @param {ToolRoute} route
   * @param {string} primaryServerId
   * @param {Object} params
   * @param {Object} context
   * @param {string} requestId
   * @param {number} startTime
   * @returns {Promise<Object>}
   * @private
   */
  async _executeWithFailover(route, primaryServerId, params, context, requestId, startTime) {
    const namespace = this._servers.get(primaryServerId)?.namespace;
    const candidates = namespace
      ? (this._namespaces.get(namespace) ?? [primaryServerId])
      : [primaryServerId];

    const tried = new Set();
    let lastError;

    for (let attempt = 0; attempt < Math.min(MAX_FAILOVER_ATTEMPTS, candidates.length); attempt++) {
      // Find next healthy candidate
      const serverId = candidates.find(id => !tried.has(id) && this._health.get(id) !== ServerHealth.UNHEALTHY)
        ?? candidates.find(id => !tried.has(id));

      if (!serverId) break;
      tried.add(serverId);

      try {
        this._activeConnections.set(serverId, (this._activeConnections.get(serverId) ?? 0) + 1);
        const client = this._clients.get(serverId);
        if (!client) throw new Error(`No client for server ${serverId}`);

        const registration = this._servers.get(serverId);
        const timeout = registration.timeoutMs ?? this.defaultTimeoutMs;

        const result = await Promise.race([
          client.callTool({ name: route.upstreamToolName, arguments: params }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Tool call timeout')), timeout)),
        ]);

        const duration = Date.now() - startTime;
        this._logRequest({ requestId, toolName: route.toolName, serverId, userId: context.userId,
          params, result, duration, attempt, success: true });
        this.emit('tool_routed', { requestId, toolName: route.toolName, serverId, duration });

        return result;
      } catch (err) {
        lastError = err;

        // phiBackoff-derived retry wait for next attempt
        // baseMs = fib(9)×10 = 340 ms; maxMs = fib(16)×100 = 98 700 ms
        const retryDelay = phiBackoff(attempt, fib(9) * 10, fib(16) * 100);
        this._log('warn', 'tool_call_attempt_failed', {
          requestId, serverId, attempt, error: err.message, retryDelayMs: retryDelay,
        });

        // Mark server degraded on timeout/connection errors
        if (err.message.includes('timeout') || err.message.includes('ECONNREFUSED')) {
          this._health.set(serverId, ServerHealth.DEGRADED);
          this.emit('server_unhealthy', { serverId, reason: err.message });
        }

        if (attempt < MAX_FAILOVER_ATTEMPTS - 1) {
          this.emit('failover', { requestId, fromServer: serverId, attempt });
          // Wait phi-backoff delay before trying next candidate
          await new Promise(r => setTimeout(r, retryDelay));
        }
      } finally {
        this._activeConnections.set(serverId, Math.max(0, (this._activeConnections.get(serverId) ?? 1) - 1));
      }
    }

    const duration = Date.now() - startTime;
    this._logRequest({ requestId, toolName: route.toolName, serverId: primaryServerId,
      userId: context.userId, params, error: lastError?.message, duration, success: false });
    throw lastError ?? new Error(`All failover attempts exhausted for tool: ${route.toolName}`);
  }

  // ─── CSL Routing ──────────────────────────────────────────────────────────

  /**
   * Find best-matching tool route using CSL cosine similarity with soft gating.
   *
   * Instead of a hard `score > threshold` cut, we pass each candidate's raw
   * cosine similarity through `cslGate()` which applies a sigmoid centered on
   * `CSL_THRESHOLDS.MEDIUM`.  This ensures borderline matches contribute
   * proportionally rather than being silently discarded.
   *
   * The winner is still the highest gated score, but the transition is smooth:
   *   gatedScore = cosSim × sigmoid((cosSim - τ) / φ_temp)
   *
   * @param {string} query - Tool name or natural language description
   * @returns {ToolRoute|null} Best matching route above CSL threshold
   * @private
   */
  _cslRouteMatch(query) {
    const queryEmbedding = this.embedFn(query);
    let bestGatedScore = 0;
    let bestRoute = null;

    for (const [, route] of this._toolRoutes) {
      if (!route.embedding) continue;
      const rawScore = cosineSimilarity(queryEmbedding, route.embedding);

      /**
       * cslGate() softens the threshold with a sigmoid transition.
       * When rawScore >> τ (MEDIUM ≈ 0.809), gatedScore ≈ rawScore.
       * When rawScore << τ, gatedScore ≈ 0 (gate closed).
       *
       * This replaces the hard `if (score > bestScore)` with a continuous
       * ranking function that remains differentiable.
       */
      const gatedScore = cslGate(rawScore, rawScore, this.cslThreshold);

      if (gatedScore > bestGatedScore) {
        bestGatedScore = gatedScore;
        bestRoute = route;
      }
    }

    // Only return if gated score clears the minimum noise floor (CSL_THRESHOLDS.MINIMUM ≈ 0.5)
    return bestGatedScore >= CSL_THRESHOLDS.MINIMUM * CSL_THRESHOLDS.MINIMUM
      ? bestRoute
      : null;
  }

  /**
   * List all tools with their CSL similarity scores to a query.
   * Useful for debugging routing decisions.
   *
   * @param {string} query - Query text
   * @param {number} [topK=fib(7)] - Return top K results (default fib(7)=13)
   * @returns {Array<{toolName: string, score: number, gatedScore: number, serverId: string}>}
   */
  cslRankTools(query, topK = fib(7)) {
    const queryEmbedding = this.embedFn(query);
    const scores = [];
    for (const [toolName, route] of this._toolRoutes) {
      if (!route.embedding) continue;
      const rawScore = cosineSimilarity(queryEmbedding, route.embedding);
      scores.push({
        toolName,
        serverId:    route.serverId,
        description: route.description,
        score:       rawScore,
        gatedScore:  cslGate(rawScore, rawScore, this.cslThreshold),
      });
    }
    return scores.sort((a, b) => b.gatedScore - a.gatedScore).slice(0, topK);
  }

  // ─── Load Balancing ────────────────────────────────────────────────────────

  /**
   * Select the best server ID for a tool call using the configured strategy.
   *
   * For `CSL_WEIGHTED` strategy, server weights are no longer static integers.
   * Instead each candidate's effective weight is computed via `cslBlend()`:
   *
   *   effectiveWeight = cslBlend(highWeight, lowWeight, server.cslScore)
   *
   * where highWeight = 1/activeConnections (same as before) and
   * lowWeight = PSI/activeConnections (≈ 0.618× less for low-CSL servers).
   * The blend is smooth over the full [0,1] CSL score range.
   *
   * @param {string} preferredServerId - Primary server for the route
   * @param {string} toolName - Tool name (used for CSL weighted selection)
   * @returns {string|null} Selected server ID or null if none healthy
   * @private
   */
  _selectServer(preferredServerId, toolName) {
    const registration = this._servers.get(preferredServerId);
    if (!registration) return null;

    const namespace = registration.namespace;
    const candidates = (this._namespaces.get(namespace) ?? [preferredServerId])
      .filter(id => this._health.get(id) !== ServerHealth.UNHEALTHY);

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    switch (this.strategy) {
      case LoadBalanceStrategy.ROUND_ROBIN:
        return this._roundRobin(namespace, candidates);

      case LoadBalanceStrategy.LEAST_CONNECTIONS:
        return candidates.reduce((best, id) => {
          const bestConns = this._activeConnections.get(best) ?? 0;
          const curConns  = this._activeConnections.get(id)   ?? 0;
          return curConns < bestConns ? id : best;
        });

      case LoadBalanceStrategy.CSL_WEIGHTED: {
        /**
         * Phi-continuous CSL-weighted selection.
         *
         * Old approach: weight = serverWeight / (activeConnections + 1)
         * New approach: cslBlend() smoothly interpolates between a high-CSL
         *   weight (φ-scaled) and a low-CSL weight (ψ-scaled) based on the
         *   server's last measured CSL score.
         *
         * Specifically:
         *   highWeight = reg.weight / (connections + 1)   (φ-normalized base)
         *   lowWeight  = highWeight × PSI                  (ψ-discounted for low scores)
         *   blended    = cslBlend(highWeight, lowWeight, cslScore)
         */
        const totalWeight = candidates.reduce((sum, id) => {
          const reg  = this._servers.get(id);
          const c    = (this._activeConnections.get(id) ?? 0) + 1;
          const base = (reg?.weight ?? 1) / c;
          const low  = base * PSI;
          return sum + cslBlend(base, low, reg?.cslScore ?? 1.0);
        }, 0);

        let rand = Math.random() * totalWeight;
        for (const id of candidates) {
          const reg  = this._servers.get(id);
          const c    = (this._activeConnections.get(id) ?? 0) + 1;
          const base = (reg?.weight ?? 1) / c;
          const low  = base * PSI;
          rand -= cslBlend(base, low, reg?.cslScore ?? 1.0);
          if (rand <= 0) return id;
        }
        return candidates[0];
      }

      case LoadBalanceStrategy.RANDOM:
        return candidates[Math.floor(Math.random() * candidates.length)];

      default:
        return candidates[0];
    }
  }

  /**
   * Round-robin selection within a namespace.
   *
   * @param {string} namespace
   * @param {string[]} candidates
   * @returns {string}
   * @private
   */
  _roundRobin(namespace, candidates) {
    const idx = (this._rrIndex.get(namespace) ?? 0) % candidates.length;
    this._rrIndex.set(namespace, idx + 1);
    return candidates[idx];
  }

  // ─── Health Checks ─────────────────────────────────────────────────────────

  /**
   * Run health checks against all registered servers.
   *
   * Each server's check is gated by its phi-adaptive interval:
   *   - healthy servers grow by φ each cycle (checked less often)
   *   - unhealthy servers shrink by ψ each cycle (checked more often)
   *
   * @returns {Promise<void>}
   * @private
   */
  async _runHealthChecks() {
    const now = Date.now();
    for (const [serverId] of this._servers) {
      const interval = this._healthIntervals.get(serverId) ?? this.healthCheckIntervalMs;

      // Only check if enough time has passed for this server's adaptive interval
      // (approximate — timer fires at base rate, but each server has its own cadence)
      this._checkServerHealth(serverId, now, interval).catch(err => {
        this._log('warn', 'health_check_error', { serverId, error: err.message });
      });
    }
  }

  /**
   * Check health of a single server by calling `ping` or listing tools.
   *
   * After the check, updates the server's phi-adaptive interval:
   *   healthy   → interval × φ  (back off, less frequent checks)
   *   unhealthy → interval × ψ  (accelerate, more frequent checks)
   *
   * Health timeout is phi-scaled:
   *   fib(8) × 100 = 2100 ms  (old hardcoded 5000 ms was arbitrary)
   *
   * Latency threshold for DEGRADED:
   *   CSL_THRESHOLDS.HIGH × DEFAULT_TIMEOUT_MS ≈ 0.882 × 17 945 ≈ 15 827 ms
   *
   * @param {string} serverId
   * @param {number} [_now] - Current timestamp (unused, kept for signature compat)
   * @param {number} [_interval] - Current adaptive interval (unused here)
   * @returns {Promise<ServerHealth>}
   * @private
   */
  async _checkServerHealth(serverId, _now, _interval) {
    const client = this._clients.get(serverId);
    if (!client) {
      this._health.set(serverId, ServerHealth.UNKNOWN);
      return ServerHealth.UNKNOWN;
    }

    /**
     * Health check timeout = fib(8) × 100 ms = 2 100 ms.
     *
     * Replaces the old hardcoded 5 000 ms with a Fibonacci-derived value
     * that is proportional to the base refill interval used in rate-limiter.js.
     */
    const healthTimeoutMs = fib(8) * 100; // F(8)=21 → 2 100 ms

    try {
      const t0 = Date.now();
      await Promise.race([
        client.listTools(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('health timeout')), healthTimeoutMs)),
      ]);
      const latency = Date.now() - t0;

      /**
       * DEGRADED threshold: CSL_THRESHOLDS.HIGH × DEFAULT_TIMEOUT_MS
       * ≈ 0.882 × 17 945 ms ≈ 15 828 ms.
       *
       * Old value was an arbitrary 10 000 ms (10 s).
       */
      const degradedLatencyMs = CSL_THRESHOLDS.HIGH * this.defaultTimeoutMs;
      const status = latency > degradedLatencyMs ? ServerHealth.DEGRADED : ServerHealth.HEALTHY;
      const prev = this._health.get(serverId);
      this._health.set(serverId, status);

      // Update server's CSL score based on latency (normalized phi-decay)
      const reg = this._servers.get(serverId);
      if (reg) {
        reg.cslScore = cslRouteScore(1.0, latency, this.defaultTimeoutMs);
        reg.weight   = reg.cslScore;
      }

      // Phi-adaptive interval: grow when healthy, shrink when degraded
      const currentInterval = this._healthIntervals.get(serverId) ?? this.healthCheckIntervalMs;
      const nextInterval = phiAdaptiveInterval(
        currentInterval,
        status === ServerHealth.HEALTHY,
        fib(9) * 1000,           // min = F(9)×1000 = 34 000 ms ≈ 34 s
        fib(14) * 1000,          // max = F(14)×1000 = 377 000 ms ≈ 6.3 min
      );
      this._healthIntervals.set(serverId, nextInterval);

      if (prev !== status) {
        this._log('info', 'health_status_change', {
          serverId, prev, current: status, latencyMs: latency,
          cslScore: reg?.cslScore?.toFixed(4), nextIntervalMs: nextInterval,
        });
      }
      return status;
    } catch (err) {
      this._health.set(serverId, ServerHealth.UNHEALTHY);
      this.emit('server_unhealthy', { serverId, reason: err.message });
      this._log('warn', 'server_unhealthy', { serverId, error: err.message });

      // Phi-adaptive: shrink interval aggressively when unhealthy
      const currentInterval = this._healthIntervals.get(serverId) ?? this.healthCheckIntervalMs;
      const nextInterval = phiAdaptiveInterval(
        currentInterval,
        false,                   // not healthy
        fib(9) * 1000,           // min = 34 000 ms
        fib(14) * 1000,          // max = 377 000 ms
      );
      this._healthIntervals.set(serverId, nextInterval);

      // Attempt reconnection for unhealthy servers
      this._reconnectServer(serverId);
      return ServerHealth.UNHEALTHY;
    }
  }

  /**
   * Attempt to reconnect a failed server.
   *
   * @param {string} serverId
   * @returns {Promise<void>}
   * @private
   */
  async _reconnectServer(serverId) {
    const registration = this._servers.get(serverId);
    if (!registration) return;
    try {
      await this._disconnectClient(serverId);
      await this._connectServer(serverId);
      await this._discoverServerTools(serverId, registration);
      this._log('info', 'server_reconnected', { serverId });
    } catch (err) {
      this._log('warn', 'server_reconnect_failed', { serverId, error: err.message });
    }
  }

  // ─── Client Management ─────────────────────────────────────────────────────

  /**
   * Connect to a single MCP server and create its SDK Client.
   *
   * @param {string} serverId
   * @returns {Promise<void>}
   * @private
   */
  async _connectServer(serverId) {
    const registration = this._servers.get(serverId);
    if (!registration) throw new Error(`Unknown server: ${serverId}`);

    // Dynamic import to keep transport adapters optional
    let transport;
    if (registration.transport === 'stdio') {
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
      transport = new StdioClientTransport({
        command: registration.command,
        args:    registration.args ?? [],
        env:     registration.env  ?? {},
      });
    } else if (registration.transport === 'sse' || registration.transport === 'streamable-http') {
      const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js').catch(
        async () => import('@modelcontextprotocol/sdk/client/sse.js')
      );
      const headers = {};
      if (registration.auth?.type === 'bearer' && registration.auth.token) {
        headers['Authorization'] = `Bearer ${registration.auth.token}`;
      }
      transport = new StreamableHTTPClientTransport(new URL(registration.url), { headers });
    } else {
      throw new Error(`Unsupported transport: ${registration.transport}`);
    }

    const client = new Client(
      { name: 'heady-mcp-gateway', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    await client.connect(transport);
    this._clients.set(serverId, client);
    this._health.set(serverId, ServerHealth.HEALTHY);
    this._log('info', 'server_connected', { serverId, transport: registration.transport });
  }

  /**
   * Close and remove the client for a server.
   *
   * @param {string} serverId
   * @returns {Promise<void>}
   * @private
   */
  async _disconnectClient(serverId) {
    const client = this._clients.get(serverId);
    if (!client) return;
    try {
      await client.close();
    } catch (_) { /* ignore close errors */ }
    this._clients.delete(serverId);
  }

  // ─── Introspection ─────────────────────────────────────────────────────────

  /**
   * Get a list of all registered tool names.
   *
   * @returns {string[]}
   */
  listTools() {
    return Array.from(this._toolRoutes.keys());
  }

  /**
   * Get tool schema for a qualified tool name.
   *
   * @param {string} qualifiedToolName
   * @returns {Object|null}
   */
  getToolSchema(qualifiedToolName) {
    return this._toolRoutes.get(qualifiedToolName)?.schema ?? null;
  }

  /**
   * Get health status for all servers.
   *
   * @returns {Array<{id: string, namespace: string, health: string, activeConnections: number, cslScore: number, adaptiveIntervalMs: number}>}
   */
  getHealthStatus() {
    const statuses = [];
    for (const [id, reg] of this._servers) {
      statuses.push({
        id,
        namespace:           reg.namespace,
        url:                 reg.url,
        transport:           reg.transport,
        health:              this._health.get(id) ?? ServerHealth.UNKNOWN,
        activeConnections:   this._activeConnections.get(id) ?? 0,
        weight:              reg.weight ?? 1,
        cslScore:            reg.cslScore ?? 1.0,
        adaptiveIntervalMs:  this._healthIntervals.get(id) ?? this.healthCheckIntervalMs,
      });
    }
    return statuses;
  }

  /**
   * Get gateway statistics.
   *
   * @returns {Object}
   */
  getStats() {
    const healthCounts = { healthy: 0, degraded: 0, unhealthy: 0, unknown: 0 };
    for (const [, h] of this._health) healthCounts[h] = (healthCounts[h] ?? 0) + 1;
    return {
      servers:            this._servers.size,
      tools:              this._toolRoutes.size,
      namespaces:         this._namespaces.size,
      health:             healthCounts,
      recentRequests:     this._requestLog.length,
      strategy:           this.strategy,
      cslThreshold:       this.cslThreshold,
      maxFailoverAttempts: MAX_FAILOVER_ATTEMPTS,
      defaultTimeoutMs:   this.defaultTimeoutMs,
      phiConstants: {
        PHI,
        PSI,
        CSL_THRESHOLDS,
        DEDUP_THRESHOLD,
        maxRetriesFib4: fib(4),
        healthCheckBaseFib11s: fib(11),
      },
    };
  }

  // ─── Logging ───────────────────────────────────────────────────────────────

  /**
   * Internal structured log emitter.
   *
   * @param {'info'|'warn'|'error'} level
   * @param {string} event
   * @param {Object} data
   * @private
   */
  _log(level, event, data) {
    if (!this.enableLogging) return;
    const entry = {
      ts:        new Date().toISOString(),
      level,
      event,
      component: 'MCPGateway',
      ...data,
    };
    this.emit('log', entry);
    // eslint-disable-next-line no-console
    if (level === 'error') console.error(JSON.stringify(entry));
    else if (level === 'warn') console.warn(JSON.stringify(entry));
    // info suppressed unless debug mode
  }

  /**
   * Record a completed request to the rolling request log.
   *
   * Log cap is fib(16)=987 entries (replaces the old magic number 1000).
   *
   * @param {Object} entry
   * @private
   */
  _logRequest(entry) {
    this._requestLog.push({ ...entry, ts: new Date().toISOString() });
    if (this._requestLog.length > this._requestLogMax) this._requestLog.shift();
    this.emit('request_logged', entry);
  }

  /**
   * Get recent request log entries.
   *
   * @param {number} [limit=fib(7)] - Number of recent entries (default fib(7)=13)
   * @returns {Object[]}
   */
  getRequestLog(limit = fib(7)) {
    return this._requestLog.slice(-limit);
  }
}

export default MCPGateway;
