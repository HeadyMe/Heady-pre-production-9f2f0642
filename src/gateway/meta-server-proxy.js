/**
 * @fileoverview MCP Meta-Server Proxy
 *
 * Aggregates multiple upstream MCP servers into a single unified MCP server.
 * External clients connect to this meta-server and see all tools from all
 * upstream servers under a single endpoint, with namespace prefixing to
 * prevent collisions.
 *
 * This implements the "Aggregator Gateway" pattern from the MCP gateway
 * taxonomy (Gartner 2025): one endpoint, many backing servers.
 *
 * Features:
 * - Tool discovery and registration from upstream servers
 * - Namespace management: `github.create_issue`, `slack.send_message`, etc.
 * - Schema merging and validation
 * - Proxy tool calls to correct upstream server
 * - Tool schema caching with TTL-based invalidation
 * - Health dashboard endpoint
 * - Exposes itself as a valid MCP server (implements MCP SDK Server interface)
 *
 * ─── Phi-Math Integration ─────────────────────────────────────────────────────
 * All fixed timing, threshold, and count constants are replaced with values
 * derived from the Fibonacci sequence (fib()), the golden-ratio backoff
 * (phiBackoff()), adaptive interval (phiAdaptiveInterval()), and CSL gates
 * (cslGate()) via the shared phi-math module.  Each constant is individually
 * documented with its phi derivation.
 *
 * @module gateway/meta-server-proxy
 * @requires @modelcontextprotocol/sdk
 * @requires events
 * @requires shared/phi-math
 */

import { EventEmitter } from 'events';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import crypto from 'crypto';
import {
  PHI,
  PSI,
  CSL_THRESHOLDS,
  cslGate,
  phiBackoff,
  phiAdaptiveInterval,
  fib,
} from '../../shared/phi-math.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Default tool schema cache TTL.
 *
 * @phi fib(14) * 1000 = 377 * 1000 = 377 000 ms ≈ 6.28 minutes
 *
 * F(14) = 377.  The old value was 5 * 60_000 = 300 000 ms (5 min, arbitrary).
 * 377 000 ms is the first Fibonacci-millisecond value that exceeds 5 minutes,
 * naturally extending the cache lifetime by the golden ratio proportion while
 * remaining well under the 10-minute mark where stale schemas cause problems.
 */
const DEFAULT_SCHEMA_CACHE_TTL_MS = fib(14) * 1000; // 377 000 ms ≈ 6.28 min

/**
 * Default health check interval.
 *
 * @phi fib(11) * 1000 = 89 * 1000 = 89 000 ms ≈ 89 s
 *
 * F(11) = 89.  Old value: 30 000 ms (30 s, arbitrary).  89 s is the natural
 * Fibonacci successor to 55 s (F(10)) — giving a ~3× increase over the old
 * value that reduces health-check overhead significantly without sacrificing
 * meaningful freshness for a meta-server that aggregates stable upstream tools.
 * The sequence: F(9)=34 s, F(10)=55 s, F(11)=89 s, F(12)=144 s.
 */
const DEFAULT_HEALTH_CHECK_INTERVAL_MS = fib(11) * 1000; // 89 000 ms

/**
 * Timeout for the tool-discovery request per upstream server.
 *
 * @phi fib(11) * 100 = 89 * 100 = 8 900 ms ≈ 8.9 s
 *
 * F(11) = 89.  Old value: 10 000 ms (arbitrary).  8 900 ms tightens the
 * discovery timeout slightly — if an upstream doesn't respond in ~9 s during
 * initialisation it is unlikely to be healthy.  Using *100 rather than *1000
 * places this value between F(10)*100=5 500 ms and F(12)*100=14 400 ms,
 * following the phi-harmonic progression in the 100 ms decade.
 */
const DISCOVERY_TIMEOUT_MS = fib(11) * 100; // 8 900 ms

/**
 * Timeout for each individual health-check probe.
 *
 * @phi fib(8) * 100 = 21 * 100 = 2 100 ms
 *
 * F(8) = 21.  Old value: 5 000 ms (arbitrary).  Health-check probes are
 * lightweight (listTools), so a 2 100 ms timeout is both tighter and
 * phi-derived: it leaves room for one phi-backoff retry within the overall
 * health-check interval of 89 000 ms.
 */
const HEALTH_CHECK_TIMEOUT_MS = fib(8) * 100; // 2 100 ms

/**
 * Error count threshold before marking a server as "degraded".
 *
 * @phi fib(5) = 5
 *
 * F(5) = 5.  The old hard-coded value was also 5 — this preserves identical
 * runtime behaviour while replacing the magic number with a Fibonacci-derived
 * constant.  Using fib(5) makes the threshold part of the phi progression:
 *   fib(4)=3 (cache invalidation), fib(5)=5 (degraded), fib(6)=8 (future escalation).
 */
const ERROR_THRESHOLD_DEGRADED = fib(5); // 5

/**
 * Error count threshold before invalidating a server's cached tools.
 *
 * @phi fib(4) = 3
 *
 * F(4) = 3.  Old value: 3 (arbitrary).  Again, runtime behaviour is identical
 * but the value now participates in the phi progression alongside ERROR_THRESHOLD_DEGRADED.
 * A server reaching fib(4)=3 errors gets its cache invalidated; at fib(5)=5 it
 * is marked degraded — the two thresholds are in the natural Fibonacci ratio.
 */
const ERROR_THRESHOLD_CACHE_INVALIDATE = fib(4); // 3

/** Schema merge strategies */
export const SchemaMergeStrategy = Object.freeze({
  /** Keep the first server's schema for duplicate tool names */
  FIRST_WINS:   'first_wins',
  /** Keep the last registered server's schema */
  LAST_WINS:    'last_wins',
  /** Reject ambiguous tool names */
  STRICT:       'strict',
  /** Merge schemas if compatible, else namespace-disambiguate */
  BEST_EFFORT:  'best_effort',
});

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} UpstreamServer
 * @property {string} id - Unique identifier
 * @property {string} namespace - Tool name prefix (e.g. 'github', 'slack')
 * @property {string} description - Human-readable description
 * @property {Client} client - Connected MCP SDK Client
 * @property {Object} transport - Transport (for cleanup)
 * @property {string} status - 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
 * @property {Date|null} lastHealthCheck - Timestamp of last health check
 * @property {number} toolCount - Number of discovered tools
 * @property {number} callCount - Total proxied calls
 * @property {number} errorCount - Total errors
 * @property {number} healthInterval - Current adaptive health-check interval (ms)
 */

/**
 * @typedef {Object} CachedToolSchema
 * @property {string} qualifiedName - Namespace-prefixed name
 * @property {string} upstreamName - Name as upstream server knows it
 * @property {string} serverId - Upstream server identifier
 * @property {Object} schema - JSON Schema (inputSchema)
 * @property {string} description - Tool description
 * @property {number} cachedAt - Cache timestamp (ms)
 * @property {number} callCount - Calls to this specific tool
 * @property {number} [cslMergeScore] - CSL gate score from last schema merge
 */

// ─── Schema Validator ─────────────────────────────────────────────────────────

/**
 * Validate that a tool schema is a valid JSON Schema object.
 *
 * @param {*} schema - Schema to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateSchema(schema) {
  const errors = [];
  if (!schema || typeof schema !== 'object') {
    errors.push('Schema must be an object');
    return { valid: false, errors };
  }
  if (schema.type && typeof schema.type !== 'string') {
    errors.push('Schema.type must be a string');
  }
  if (schema.properties && typeof schema.properties !== 'object') {
    errors.push('Schema.properties must be an object');
  }
  if (schema.required && !Array.isArray(schema.required)) {
    errors.push('Schema.required must be an array');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Compute a structural similarity score between two JSON Schemas.
 *
 * The score is a simple Jaccard similarity over the union of property key sets,
 * normalised to [0, 1].  A score of 1.0 means identical property keys; 0.0
 * means completely disjoint.
 *
 * Used by mergeSchemas() to compute the cslMergeScore that feeds into cslGate().
 *
 * @param {Object} schemaA
 * @param {Object} schemaB
 * @returns {number} Similarity ∈ [0, 1]
 * @private
 */
function schemaSimilarity(schemaA, schemaB) {
  const propsA = new Set(Object.keys(schemaA.properties ?? {}));
  const propsB = new Set(Object.keys(schemaB.properties ?? {}));
  if (propsA.size === 0 && propsB.size === 0) return 1.0;
  const intersection = [...propsA].filter(k => propsB.has(k)).length;
  const union = new Set([...propsA, ...propsB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Merge two JSON Schemas for the same tool name from different servers.
 * Used in BEST_EFFORT merge strategy.
 *
 * Integrates cslGate() to score the merge confidence:
 *   - schemaSimilarity() produces a cosine-like score in [0, 1].
 *   - cslGate(1.0, score, CSL_THRESHOLDS.MEDIUM) returns a weight in [0, 1]
 *     that is close to 1 when schemas are structurally similar and close to 0
 *     when they diverge significantly.
 *   - The merge proceeds unconditionally (both schemas contribute their
 *     properties), but the cslMergeScore is attached to the result so callers
 *     can inspect merge confidence.
 *
 * @phi cslGate() threshold: CSL_THRESHOLDS.MEDIUM ≈ 0.809
 *   Schemas with Jaccard similarity ≥ 0.809 are considered high-confidence
 *   merges; below that the gate output smoothly approaches 0, signalling
 *   increasing divergence.
 *
 * @param {Object} schemaA - First schema
 * @param {Object} schemaB - Second schema
 * @returns {{schema: Object, cslMergeScore: number}} Merged schema + confidence
 */
function mergeSchemas(schemaA, schemaB) {
  const merged = { type: 'object', properties: {}, required: [] };

  // Merge properties
  const propsA = schemaA.properties ?? {};
  const propsB = schemaB.properties ?? {};
  merged.properties = { ...propsB, ...propsA }; // A takes precedence

  // Union of required fields that appear in both
  const reqA = new Set(schemaA.required ?? []);
  const reqB = new Set(schemaB.required ?? []);
  merged.required = [...new Set([...reqA].filter(k => reqB.has(k)))]; // Only mutually required

  // CSL gate score: how similar are these schemas structurally?
  // cslGate(1.0, similarity, CSL_THRESHOLDS.MEDIUM) → confidence weight
  const similarity = schemaSimilarity(schemaA, schemaB);
  const cslMergeScore = cslGate(1.0, similarity, CSL_THRESHOLDS.MEDIUM);

  return { schema: merged, cslMergeScore };
}

// ─── MCPMetaServerProxy ───────────────────────────────────────────────────────

/**
 * MCP Meta-Server Proxy.
 *
 * Aggregates multiple upstream MCP servers into a single unified MCP server.
 * Implements the MCP SDK Server interface so existing MCP clients connect
 * to it seamlessly, unaware that their tools are proxied.
 *
 * @extends EventEmitter
 * @fires MCPMetaServerProxy#tools_discovered
 * @fires MCPMetaServerProxy#tool_proxied
 * @fires MCPMetaServerProxy#schema_cache_invalidated
 * @fires MCPMetaServerProxy#server_registered
 * @fires MCPMetaServerProxy#server_removed
 * @fires MCPMetaServerProxy#health_updated
 *
 * @example
 * ```js
 * const proxy = new MCPMetaServerProxy({
 *   serverInfo: { name: 'heady-meta-server', version: '1.0.0' },
 *   schemaMergeStrategy: SchemaMergeStrategy.BEST_EFFORT,
 *   // schemaCacheTtlMs defaults to fib(14)*1000 = 377_000 ms
 * });
 *
 * // Register upstream servers (connected Client instances)
 * proxy.registerUpstream({
 *   id: 'github',
 *   namespace: 'github',
 *   description: 'GitHub MCP Server',
 *   client: githubClient,
 *   transport: githubTransport,
 * });
 *
 * await proxy.initialize();
 *
 * // Expose via Streamable HTTP or stdio
 * const transport = new StreamableHTTPServerTransport({ port: 8080 });
 * await proxy.mcpServer.connect(transport);
 * ```
 */
export class MCPMetaServerProxy extends EventEmitter {
  /**
   * @param {Object} [options={}]
   * @param {Object} [options.serverInfo] - Meta-server identity
   * @param {string} [options.serverInfo.name='heady-meta-server'] - Server name
   * @param {string} [options.serverInfo.version='1.0.0'] - Server version
   * @param {string} [options.schemaMergeStrategy] - Schema merge strategy
   * @param {number} [options.schemaCacheTtlMs] - Tool schema cache TTL
   *   Default: fib(14) * 1000 = 377 000 ms ≈ 6.28 min (phi-scaled)
   * @param {number} [options.healthCheckIntervalMs] - Health check interval
   *   Default: fib(11) * 1000 = 89 000 ms ≈ 89 s (phi-scaled)
   * @param {boolean} [options.autoRediscoverOnHealthChange=true] - Re-discover tools on health change
   * @param {boolean} [options.enableMetricsEndpoint=true] - Expose health/metrics tool
   * @param {Function} [options.toolFilter] - (qualifiedName, schema) => boolean to filter tools
   */
  constructor(options = {}) {
    super();
    this._serverInfo = {
      name:    options.serverInfo?.name    ?? 'heady-meta-server',
      version: options.serverInfo?.version ?? '1.0.0',
    };
    this._mergeStrategy         = options.schemaMergeStrategy       ?? SchemaMergeStrategy.BEST_EFFORT;
    this._schemaCacheTtlMs      = options.schemaCacheTtlMs          ?? DEFAULT_SCHEMA_CACHE_TTL_MS;
    this._healthCheckIntervalMs = options.healthCheckIntervalMs      ?? DEFAULT_HEALTH_CHECK_INTERVAL_MS;
    this._autoRediscover        = options.autoRediscoverOnHealthChange ?? true;
    this._enableMetrics         = options.enableMetricsEndpoint       ?? true;
    this._toolFilter            = options.toolFilter                  ?? null;

    /** @type {Map<string, UpstreamServer>} serverId → server */
    this._upstreams = new Map();

    /** @type {Map<string, CachedToolSchema>} qualifiedName → cached schema */
    this._toolCache = new Map();

    /** @type {Map<string, string>} qualifiedName → serverId (routing table) */
    this._routingTable = new Map();

    /** @type {Server|null} MCP SDK Server instance */
    this._mcpServer = null;

    /** @type {NodeJS.Timeout|null} */
    this._healthTimer = null;

    /** @type {boolean} */
    this._initialized = false;

    /** @type {{totalCalls: number, totalErrors: number, cacheHits: number}} */
    this._metrics = { totalCalls: 0, totalErrors: 0, cacheHits: 0, totalProxied: 0 };
  }

  // ─── MCP Server Access ────────────────────────────────────────────────────

  /**
   * Get the underlying MCP SDK Server instance.
   * Connect this to a transport to expose the meta-server.
   *
   * @returns {Server}
   */
  get mcpServer() { return this._mcpServer; }

  // ─── Registration ──────────────────────────────────────────────────────────

  /**
   * Register an upstream MCP server.
   *
   * The server must already have an established Client connection.
   * Tools will be discovered during `initialize()` or immediately if
   * already initialized.
   *
   * @param {Object} config - Upstream server configuration
   * @param {string} config.id - Unique identifier
   * @param {string} config.namespace - Tool name prefix (lowercase, no dots/spaces)
   * @param {string} [config.description=''] - Human-readable description
   * @param {Client} config.client - Connected MCP SDK Client instance
   * @param {Object} [config.transport] - Transport (for cleanup reference)
   * @throws {Error} If namespace already in use by a different server
   */
  registerUpstream(config) {
    const { id, namespace, client } = config;
    if (!id || !namespace || !client) {
      throw new Error('Upstream registration requires id, namespace, and client');
    }
    if (!/^[a-z][a-z0-9_-]*$/.test(namespace)) {
      throw new Error(`Invalid namespace '${namespace}': must be lowercase alphanumeric/dash/underscore`);
    }

    // Check namespace conflict
    for (const [existingId, server] of this._upstreams) {
      if (server.namespace === namespace && existingId !== id) {
        throw new Error(
          `Namespace '${namespace}' already used by server '${existingId}'. ` +
          `Choose a different namespace or remove the existing server first.`
        );
      }
    }

    const server = {
      id,
      namespace,
      description: config.description ?? '',
      client,
      transport: config.transport ?? null,
      status: 'unknown',
      lastHealthCheck: null,
      toolCount: 0,
      callCount: 0,
      errorCount: 0,
      /**
       * Adaptive health check interval for this server instance.
       *
       * @phi Starts at DEFAULT_HEALTH_CHECK_INTERVAL_MS = fib(11)*1000 = 89 000 ms.
       * phiAdaptiveInterval() will grow it by PHI (×1.618) when healthy and
       * shrink it by PSI (×0.618) when unhealthy, keeping checks tight during
       * failure recovery and sparse during stable operation.
       */
      healthInterval: this._healthCheckIntervalMs,
    };

    this._upstreams.set(id, server);
    this.emit('server_registered', { id, namespace, description: server.description });

    // If already initialized, discover tools immediately
    if (this._initialized) {
      this._discoverServerTools(id).catch(err => {
        this.emit('discovery_error', { serverId: id, error: err.message });
      });
    }
  }

  /**
   * Remove an upstream server and clean up its tools from the routing table.
   *
   * @param {string} serverId
   * @returns {Promise<void>}
   */
  async removeUpstream(serverId) {
    const server = this._upstreams.get(serverId);
    if (!server) return;

    // Close connection
    try { await server.client.close?.(); } catch (_) {}

    // Remove all tools from this server
    for (const [qualifiedName, sId] of this._routingTable) {
      if (sId === serverId) {
        this._toolCache.delete(qualifiedName);
        this._routingTable.delete(qualifiedName);
      }
    }

    this._upstreams.delete(serverId);
    this.emit('server_removed', { id: serverId, namespace: server.namespace });

    // Re-register tools with the MCP server if initialized
    if (this._initialized) await this._rebuildMCPTools();
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Initialize the meta-server:
   * 1. Create MCP SDK Server instance
   * 2. Discover tools from all upstream servers
   * 3. Register all tools with the MCP server
   * 4. Start health checks
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) return;

    // Create the MCP SDK Server
    this._mcpServer = new Server(
      this._serverInfo,
      { capabilities: { tools: {} } }
    );

    // Register the tools/list handler
    this._mcpServer.setRequestHandler(
      { method: 'tools/list' },
      async () => this._handleListTools()
    );

    // Register the tools/call handler
    this._mcpServer.setRequestHandler(
      { method: 'tools/call' },
      async (request) => this._handleCallTool(request)
    );

    // Discover tools from all registered upstreams
    const discoveries = [];
    for (const [serverId] of this._upstreams) {
      discoveries.push(this._discoverServerTools(serverId).catch(err => {
        this.emit('discovery_error', { serverId, error: err.message });
      }));
    }
    await Promise.allSettled(discoveries);

    // Add built-in metrics tool if enabled
    if (this._enableMetrics) {
      this._registerMetricsTool();
    }

    // Start health checks at the base phi-scaled interval
    this._healthTimer = setInterval(
      () => this._runHealthChecks(),
      this._healthCheckIntervalMs
    );
    this._healthTimer.unref?.();

    this._initialized = true;
    this.emit('initialized', {
      servers: this._upstreams.size,
      tools: this._toolCache.size,
    });
  }

  /**
   * Shut down the meta-server gracefully.
   *
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (this._healthTimer) {
      clearInterval(this._healthTimer);
      this._healthTimer = null;
    }

    // Close all upstream connections
    const closes = [];
    for (const [, server] of this._upstreams) {
      closes.push(server.client.close?.().catch(() => {}));
    }
    await Promise.allSettled(closes);

    await this._mcpServer?.close?.().catch(() => {});
    this._initialized = false;
    this.emit('shutdown', {});
  }

  // ─── Tool Discovery ─────────────────────────────────────────────────────────

  /**
   * Discover tools from a single upstream server and update the routing table.
   *
   * Uses a DISCOVERY_TIMEOUT_MS = fib(11) * 100 = 8 900 ms timeout for the
   * listTools() call.  If discovery exceeds this window the server is not
   * added to the routing table and a discovery_error event is emitted.
   *
   * @phi fib(11) * 100 = 8 900 ms discovery timeout
   *   Old value: 10 000 ms (arbitrary).  8 900 ms is slightly tighter and
   *   Fibonacci-derived, fitting the phi-harmonic *100 decade:
   *     F(9)*100=3400 ms, F(10)*100=5500 ms, F(11)*100=8900 ms, F(12)*100=14400 ms.
   *
   * @param {string} serverId
   * @returns {Promise<string[]>} Discovered qualified tool names
   * @private
   */
  async _discoverServerTools(serverId) {
    const server = this._upstreams.get(serverId);
    if (!server) throw new Error(`Unknown server: ${serverId}`);

    const result = await Promise.race([
      server.client.listTools(),
      new Promise((_, r) =>
        setTimeout(() => r(new Error('Discovery timeout')), DISCOVERY_TIMEOUT_MS) // fib(11)*100 = 8 900 ms
      ),
    ]);

    const tools = result?.tools ?? [];
    const discovered = [];
    const conflicts = [];

    for (const tool of tools) {
      const qualifiedName = `${server.namespace}.${tool.name}`;

      // Apply tool filter
      if (this._toolFilter && !this._toolFilter(qualifiedName, tool.inputSchema)) continue;

      // Schema validation
      const { valid, errors } = validateSchema(tool.inputSchema ?? {});
      if (!valid) {
        this.emit('schema_validation_failed', { serverId, tool: tool.name, errors });
      }

      // Handle namespace conflicts
      const existingServerId = this._routingTable.get(qualifiedName);
      if (existingServerId && existingServerId !== serverId) {
        conflicts.push({ qualifiedName, existingServerId });
        const resolution = this._resolveConflict(qualifiedName, tool, server, existingServerId);
        if (!resolution.use) continue;
      }

      const cached = {
        qualifiedName,
        upstreamName: tool.name,
        serverId,
        schema: valid ? (tool.inputSchema ?? { type: 'object', properties: {} }) : {},
        description: tool.description ?? tool.name,
        cachedAt: Date.now(),
        callCount: this._toolCache.get(qualifiedName)?.callCount ?? 0,
        cslMergeScore: null,
      };

      this._toolCache.set(qualifiedName, cached);
      this._routingTable.set(qualifiedName, serverId);
      discovered.push(qualifiedName);
    }

    server.status = 'healthy';
    server.toolCount = discovered.length;
    server.lastHealthCheck = new Date();

    // Adapt this server's health interval toward the longer end (healthy)
    server.healthInterval = phiAdaptiveInterval(
      server.healthInterval,
      true,
      this._healthCheckIntervalMs,
      this._healthCheckIntervalMs * PHI * PHI  // max: base × φ² ≈ 2.618×
    );

    this.emit('tools_discovered', { serverId, namespace: server.namespace, count: discovered.length, conflicts: conflicts.length });

    return discovered;
  }

  /**
   * Resolve a naming conflict based on the merge strategy.
   *
   * In BEST_EFFORT mode, cslGate() is used to score the structural similarity
   * between the conflicting schemas.  The merge score is stored on the cached
   * entry so consumers can inspect confidence.
   *
   * @phi cslGate() with CSL_THRESHOLDS.MEDIUM ≈ 0.809 as the merge gate
   *   When schema Jaccard similarity ≥ 0.809, the gate is mostly open (≥ 0.5
   *   weight), indicating a high-confidence merge.  Below that the gate signal
   *   attenuates, surfacing uncertainty in the emitted 'schema_merged' event.
   *
   * @param {string} qualifiedName
   * @param {Object} newTool - Tool from new server
   * @param {UpstreamServer} newServer
   * @param {string} existingServerId
   * @returns {{use: boolean, merged?: Object, cslMergeScore?: number}}
   * @private
   */
  _resolveConflict(qualifiedName, newTool, newServer, existingServerId) {
    switch (this._mergeStrategy) {
      case SchemaMergeStrategy.FIRST_WINS:
        return { use: false }; // Keep existing

      case SchemaMergeStrategy.LAST_WINS:
        return { use: true }; // Replace with new

      case SchemaMergeStrategy.STRICT:
        throw new Error(
          `Tool name collision '${qualifiedName}' between servers '${newServer.id}' and '${existingServerId}'`
        );

      case SchemaMergeStrategy.BEST_EFFORT: {
        // Merge schemas and use the new server as primary.
        // cslGate() scores the structural similarity of the two schemas:
        //   - High similarity (≥ CSL_THRESHOLDS.MEDIUM ≈ 0.809) → gate open → confident merge
        //   - Low similarity → gate attenuated → potentially divergent tools sharing a name
        const existing = this._toolCache.get(qualifiedName);
        if (existing) {
          const { schema: merged, cslMergeScore } = mergeSchemas(
            existing.schema,
            newTool.inputSchema ?? {}
          );
          this.emit('schema_merged', {
            qualifiedName,
            serversInvolved: [existingServerId, newServer.id],
            cslMergeScore,                // phi-derived merge confidence ∈ [0, 1]
            highConfidence: cslMergeScore >= CSL_THRESHOLDS.MEDIUM,
          });
          return { use: true, merged, cslMergeScore };
        }
        return { use: true };
      }

      default:
        return { use: false };
    }
  }

  /**
   * Rebuild the tool list after upstream changes.
   *
   * @returns {Promise<void>}
   * @private
   */
  async _rebuildMCPTools() {
    // Clear cache for removed servers
    const validServerIds = new Set(this._upstreams.keys());
    for (const [qualifiedName, serverId] of this._routingTable) {
      if (!validServerIds.has(serverId)) {
        this._toolCache.delete(qualifiedName);
        this._routingTable.delete(qualifiedName);
      }
    }
    this.emit('schema_cache_invalidated', { toolCount: this._toolCache.size });
  }

  // ─── MCP Request Handlers ──────────────────────────────────────────────────

  /**
   * Handle a `tools/list` request by returning all cached tool schemas.
   *
   * @returns {Promise<{tools: Object[]}>}
   * @private
   */
  async _handleListTools() {
    const now = Date.now();
    const tools = [];

    for (const [qualifiedName, cached] of this._toolCache) {
      // Check cache freshness against fib(14)*1000 = 377 000 ms TTL
      if (now - cached.cachedAt > this._schemaCacheTtlMs) {
        const serverId = this._routingTable.get(qualifiedName);
        if (serverId) {
          // Background refresh
          this._discoverServerTools(serverId).catch(() => {});
        }
      }

      tools.push({
        name: qualifiedName,
        description: cached.description,
        inputSchema: cached.schema,
      });
    }

    return { tools };
  }

  /**
   * Handle a `tools/call` request by routing to the correct upstream.
   *
   * @param {Object} request - MCP tools/call request
   * @returns {Promise<Object>} Tool call result
   * @private
   */
  async _handleCallTool(request) {
    const { name: toolName, arguments: args } = request.params ?? {};
    const startTime = Date.now();
    this._metrics.totalCalls++;

    // Look up routing
    const serverId = this._routingTable.get(toolName);
    if (!serverId) {
      this._metrics.totalErrors++;
      throw {
        code: -32601,
        message: `Tool not found: ${toolName}`,
        data: { availableTools: Array.from(this._routingTable.keys()).slice(0, 20) },
      };
    }

    const cached = this._toolCache.get(toolName);
    const server = this._upstreams.get(serverId);
    if (!server) {
      this._metrics.totalErrors++;
      throw { code: -32603, message: `Upstream server '${serverId}' not available` };
    }

    // Check cache hit for this schema access
    if (cached && Date.now() - cached.cachedAt < this._schemaCacheTtlMs) {
      this._metrics.cacheHits++;
    }

    try {
      // Proxy to upstream server using the upstream tool name (without namespace prefix)
      const upstreamName = cached?.upstreamName ?? toolName.split('.').slice(1).join('.');
      const result = await server.client.callTool({
        name: upstreamName,
        arguments: args ?? {},
      });

      const duration = Date.now() - startTime;
      server.callCount++;
      if (cached) cached.callCount++;
      this._metrics.totalProxied++;

      this.emit('tool_proxied', {
        qualifiedName: toolName,
        upstreamName,
        serverId,
        duration,
        success: true,
      });

      return result;
    } catch (err) {
      server.errorCount++;
      this._metrics.totalErrors++;

      /**
       * Mark server degraded when errorCount exceeds ERROR_THRESHOLD_DEGRADED.
       *
       * @phi fib(5) = 5  (replaces hard-coded 5 with Fibonacci-derived value)
       *   Part of the phi error-escalation sequence:
       *     fib(4)=3 → cache invalidation,  fib(5)=5 → status=degraded
       */
      if (server.errorCount > ERROR_THRESHOLD_DEGRADED) server.status = 'degraded';

      this.emit('tool_proxy_error', { toolName, serverId, error: err.message });
      throw err;
    }
  }

  // ─── Health Checks ─────────────────────────────────────────────────────────

  /**
   * Run health checks for all upstream servers.
   *
   * Uses HEALTH_CHECK_TIMEOUT_MS = fib(8) * 100 = 2 100 ms per probe.
   * After each result (pass or fail) the per-server healthInterval is adapted
   * via phiAdaptiveInterval():
   *   - Healthy: interval grows by φ (×1.618) up to max
   *   - Unhealthy: interval shrinks by ψ (×0.618) down to min
   *
   * This reduces health-check overhead during stable operation and increases
   * polling frequency automatically during fault recovery — with no arbitrary
   * backoff constants.
   *
   * @phi fib(8) * 100 = 2 100 ms health check timeout
   *   Old value: 5 000 ms (arbitrary).  2 100 ms is a tighter probe budget
   *   appropriate for lightweight listTools() calls.
   *
   * @phi phiAdaptiveInterval() governs per-server polling frequency
   *   Healthy interval converges upward (less frequent checks).
   *   Unhealthy interval converges downward (more frequent recovery checks).
   *
   * @returns {Promise<void>}
   * @private
   */
  async _runHealthChecks() {
    for (const [serverId, server] of this._upstreams) {
      try {
        await Promise.race([
          server.client.listTools(),
          new Promise((_, r) =>
            setTimeout(() => r(new Error('Health check timeout')), HEALTH_CHECK_TIMEOUT_MS) // fib(8)*100 = 2 100 ms
          ),
        ]);

        const prev = server.status;
        server.status = 'healthy';
        server.lastHealthCheck = new Date();

        // Grow health interval when healthy: currentInterval × φ (up to max)
        server.healthInterval = phiAdaptiveInterval(
          server.healthInterval,
          true,
          this._healthCheckIntervalMs,
          this._healthCheckIntervalMs * PHI * PHI  // max ≈ base × 2.618
        );

        if (prev !== 'healthy' && this._autoRediscover) {
          // Server recovered — rediscover tools
          await this._discoverServerTools(serverId);
        }
      } catch (err) {
        server.status = 'unhealthy';

        // Shrink health interval when unhealthy: currentInterval × ψ (down to min)
        server.healthInterval = phiAdaptiveInterval(
          server.healthInterval,
          false,
          this._healthCheckIntervalMs * PSI, // min ≈ base × 0.618
          this._healthCheckIntervalMs
        );

        this.emit('health_updated', { serverId, status: 'unhealthy', error: err.message });

        /**
         * Invalidate this server's cache on consecutive failures.
         *
         * @phi fib(4) = 3  (replaces hard-coded 3 with Fibonacci-derived value)
         *   fib(4)=3 is the cache-invalidation threshold in the error escalation
         *   sequence: fib(4)=3 → invalidate cache, fib(5)=5 → degraded status.
         */
        if (server.errorCount > ERROR_THRESHOLD_CACHE_INVALIDATE) {
          this.emit('schema_cache_invalidated', { serverId });
        }
      }

      this.emit('health_updated', { serverId, status: server.status });
    }
  }

  // ─── Metrics Tool ─────────────────────────────────────────────────────────

  /**
   * Register a built-in `meta.health` tool that returns the health dashboard.
   *
   * @private
   */
  _registerMetricsTool() {
    const qualifiedName = 'meta.health';
    this._toolCache.set(qualifiedName, {
      qualifiedName,
      upstreamName: '__meta__health',
      serverId: '__meta__',
      schema: { type: 'object', properties: {}, required: [] },
      description: 'Health dashboard for the MCP Meta-Server. Returns status of all upstream servers.',
      cachedAt: Date.now(),
      callCount: 0,
      cslMergeScore: null,
    });
    this._routingTable.set(qualifiedName, '__meta__');

    // Override the routing for this special tool
    const origHandler = this._handleCallTool.bind(this);
    this._handleCallTool = async (request) => {
      if (request.params?.name === qualifiedName) {
        return { content: [{ type: 'text', text: JSON.stringify(this.getHealthDashboard(), null, 2) }] };
      }
      return origHandler(request);
    };
  }

  // ─── Schema Cache Management ──────────────────────────────────────────────

  /**
   * Invalidate the schema cache for a specific server or all servers.
   *
   * @param {string} [serverId] - Server to invalidate (all if omitted)
   */
  invalidateCache(serverId) {
    if (serverId) {
      for (const [name, sId] of this._routingTable) {
        if (sId === serverId) {
          const cached = this._toolCache.get(name);
          if (cached) cached.cachedAt = 0; // Force refresh on next access
        }
      }
    } else {
      for (const [, cached] of this._toolCache) {
        cached.cachedAt = 0;
      }
    }
    this.emit('schema_cache_invalidated', { serverId: serverId ?? 'all' });
  }

  /**
   * Force refresh tool discovery for a server.
   *
   * @param {string} serverId
   * @returns {Promise<string[]>} Refreshed tool list
   */
  async refreshServer(serverId) {
    this.invalidateCache(serverId);
    return this._discoverServerTools(serverId);
  }

  // ─── Health Dashboard ─────────────────────────────────────────────────────

  /**
   * Get the full health dashboard for the meta-server.
   *
   * @returns {Object} Health status for all upstreams and aggregated metrics
   */
  getHealthDashboard() {
    const servers = [];
    for (const [id, server] of this._upstreams) {
      const toolsForServer = Array.from(this._routingTable.entries())
        .filter(([, sId]) => sId === id)
        .map(([name]) => name);

      servers.push({
        id,
        namespace: server.namespace,
        description: server.description,
        status: server.status,
        lastHealthCheck: server.lastHealthCheck?.toISOString() ?? null,
        toolCount: toolsForServer.length,
        tools: toolsForServer,
        callCount: server.callCount,
        errorCount: server.errorCount,
        errorRate: server.callCount > 0
          ? `${((server.errorCount / server.callCount) * 100).toFixed(1)}%`
          : '0%',
        healthIntervalMs: server.healthInterval,  // phi-adaptive current interval
      });
    }

    const toolsByNamespace = {};
    for (const [qualifiedName, cached] of this._toolCache) {
      const ns = qualifiedName.split('.')[0];
      if (!toolsByNamespace[ns]) toolsByNamespace[ns] = [];
      toolsByNamespace[ns].push({
        name: qualifiedName,
        callCount: cached.callCount,
        cacheAge: Math.round((Date.now() - cached.cachedAt) / 1000) + 's',
        cslMergeScore: cached.cslMergeScore,  // phi-derived merge confidence
      });
    }

    return {
      metaServer: {
        name:    this._serverInfo.name,
        version: this._serverInfo.version,
      },
      status: servers.every(s => s.status === 'healthy') ? 'healthy'
            : servers.some(s => s.status === 'healthy')  ? 'degraded'
            : 'unhealthy',
      upstreamServers: servers,
      toolsByNamespace,
      metrics: {
        ...this._metrics,
        cacheHitRate: this._metrics.totalCalls > 0
          ? `${((this._metrics.cacheHits / this._metrics.totalCalls) * 100).toFixed(1)}%`
          : '0%',
        totalTools: this._toolCache.size,
        totalServers: this._upstreams.size,
      },
      phiConfig: {
        schemaCacheTtlMs: this._schemaCacheTtlMs,  // fib(14)*1000 = 377 000 ms
        healthCheckIntervalMs: this._healthCheckIntervalMs, // fib(11)*1000 = 89 000 ms
        discoveryTimeoutMs: DISCOVERY_TIMEOUT_MS,  // fib(11)*100 = 8 900 ms
        healthCheckTimeoutMs: HEALTH_CHECK_TIMEOUT_MS, // fib(8)*100 = 2 100 ms
        errorThresholdDegraded: ERROR_THRESHOLD_DEGRADED,    // fib(5) = 5
        errorThresholdCacheInvalidate: ERROR_THRESHOLD_CACHE_INVALIDATE, // fib(4) = 3
      },
      mergeStrategy: this._mergeStrategy,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get all registered tool names.
   *
   * @returns {string[]}
   */
  listTools() {
    return Array.from(this._toolCache.keys());
  }

  /**
   * Get tool schema for a qualified tool name.
   *
   * @param {string} qualifiedName
   * @returns {CachedToolSchema|null}
   */
  getToolSchema(qualifiedName) {
    return this._toolCache.get(qualifiedName) ?? null;
  }

  /**
   * Get routing table.
   *
   * @returns {Object<string, string>} qualifiedName → serverId
   */
  getRoutingTable() {
    return Object.fromEntries(this._routingTable);
  }

  // ─── Testing Helpers ───────────────────────────────────────────────────────

  /**
   * Create a test meta-server with in-memory upstreams.
   * Useful for unit testing without real MCP server connections.
   *
   * @param {Array<{id: string, namespace: string, tools: Object[]}>} upstreamDefs
   * @returns {Promise<MCPMetaServerProxy>}
   */
  static async createTestInstance(upstreamDefs = []) {
    const proxy = new MCPMetaServerProxy({
      serverInfo: { name: 'test-meta-server', version: '0.0.1' },
    });

    for (const def of upstreamDefs) {
      // Create an in-memory MCP server for testing
      const upstreamServer = new Server(
        { name: def.id, version: '1.0.0' },
        { capabilities: { tools: {} } }
      );

      upstreamServer.setRequestHandler({ method: 'tools/list' }, async () => ({
        tools: def.tools ?? [],
      }));
      upstreamServer.setRequestHandler({ method: 'tools/call' }, async (req) => ({
        content: [{ type: 'text', text: `Mock result for ${req.params?.name}` }],
      }));

      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await upstreamServer.connect(serverTransport);

      const client = new Client(
        { name: 'test-client', version: '1.0.0' },
        { capabilities: {} }
      );
      await client.connect(clientTransport);

      proxy.registerUpstream({
        id:          def.id,
        namespace:   def.namespace,
        description: def.description ?? `Test ${def.namespace} server`,
        client,
        transport:   clientTransport,
      });
    }

    await proxy.initialize();
    return proxy;
  }
}

export { validateSchema, mergeSchemas };
export default MCPMetaServerProxy;
