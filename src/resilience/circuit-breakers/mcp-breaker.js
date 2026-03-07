/**
 * mcp-breaker.js
 * Circuit-breaker wrapper for MCP SDK tool calls (@modelcontextprotocol/sdk).
 *
 * Features
 * --------
 * - Per-tool circuit breakers (31 tools, each with its own breaker instance)
 * - Tool call timeout enforcement (default 10 s, configurable per tool)
 * - Fallback implementations for critical tools (marked as CRITICAL)
 * - Tool availability dashboard
 * - Global MCP SDK breaker (parent) + per-tool children
 * - Event emission on state changes
 *
 * @module enterprise-hardening/circuit-breaker/mcp-breaker
 */
'use strict';

const { EventEmitter } = require('events');
const { registry, EnhancedCircuitBreaker, PHI } = require('./external-api-breakers');
const { STATES } = require('../../circuit-breaker');

// ---------------------------------------------------------------------------
// Tool registry (31 MCP tools for headymcp-core)
// ---------------------------------------------------------------------------
/**
 * Each entry:
 *   name         — tool identifier
 *   timeoutMs    — per-tool timeout override (falls back to DEFAULT_TOOL_TIMEOUT_MS)
 *   critical     — whether a fallback implementation exists
 *   fallback     — async function that handles the call when breaker is OPEN
 *   description  — short description for dashboard
 */
const DEFAULT_TOOL_TIMEOUT_MS = 10_000;

const TOOL_REGISTRY = [
  // Core system tools
  { name: 'heady.ping',              timeoutMs: 2_000,  critical: true,  description: 'Liveness check' },
  { name: 'heady.echo',              timeoutMs: 2_000,  critical: true,  description: 'Echo input' },
  { name: 'heady.status',            timeoutMs: 5_000,  critical: true,  description: 'System status' },
  { name: 'heady.config.get',        timeoutMs: 5_000,  critical: false, description: 'Get configuration value' },
  { name: 'heady.config.set',        timeoutMs: 5_000,  critical: false, description: 'Set configuration value' },

  // Agent tools
  { name: 'heady.agent.spawn',       timeoutMs: 15_000, critical: false, description: 'Spawn a new agent' },
  { name: 'heady.agent.stop',        timeoutMs: 5_000,  critical: false, description: 'Stop a running agent' },
  { name: 'heady.agent.list',        timeoutMs: 5_000,  critical: true,  description: 'List active agents' },
  { name: 'heady.agent.send',        timeoutMs: 10_000, critical: false, description: 'Send message to agent' },
  { name: 'heady.agent.receive',     timeoutMs: 10_000, critical: false, description: 'Receive message from agent' },

  // Memory tools
  { name: 'heady.memory.store',      timeoutMs: 5_000,  critical: false, description: 'Store to memory' },
  { name: 'heady.memory.retrieve',   timeoutMs: 5_000,  critical: true,  description: 'Retrieve from memory' },
  { name: 'heady.memory.search',     timeoutMs: 10_000, critical: false, description: 'Semantic memory search' },
  { name: 'heady.memory.delete',     timeoutMs: 5_000,  critical: false, description: 'Delete memory entry' },
  { name: 'heady.memory.list',       timeoutMs: 5_000,  critical: false, description: 'List memory entries' },

  // LLM / model tools
  { name: 'heady.llm.generate',      timeoutMs: 30_000, critical: true,  description: 'LLM text generation' },
  { name: 'heady.llm.embed',         timeoutMs: 15_000, critical: false, description: 'Generate embeddings' },
  { name: 'heady.llm.stream',        timeoutMs: 30_000, critical: false, description: 'Streaming generation' },

  // File / storage tools
  { name: 'heady.file.read',         timeoutMs: 10_000, critical: true,  description: 'Read file' },
  { name: 'heady.file.write',        timeoutMs: 10_000, critical: false, description: 'Write file' },
  { name: 'heady.file.list',         timeoutMs: 5_000,  critical: true,  description: 'List files' },
  { name: 'heady.file.delete',       timeoutMs: 5_000,  critical: false, description: 'Delete file' },

  // Web / search tools
  { name: 'heady.web.fetch',         timeoutMs: 15_000, critical: false, description: 'Fetch URL' },
  { name: 'heady.web.search',        timeoutMs: 15_000, critical: false, description: 'Web search' },
  { name: 'heady.web.screenshot',    timeoutMs: 30_000, critical: false, description: 'Screenshot URL' },

  // Code tools
  { name: 'heady.code.run',          timeoutMs: 30_000, critical: false, description: 'Execute code' },
  { name: 'heady.code.lint',         timeoutMs: 10_000, critical: false, description: 'Lint code' },

  // Data tools
  { name: 'heady.data.query',        timeoutMs: 30_000, critical: false, description: 'Database query' },
  { name: 'heady.data.transform',    timeoutMs: 15_000, critical: false, description: 'Transform data' },

  // Workflow tools
  { name: 'heady.workflow.trigger',  timeoutMs: 10_000, critical: false, description: 'Trigger workflow' },
  { name: 'heady.workflow.status',   timeoutMs: 5_000,  critical: true,  description: 'Check workflow status' },
];

// ---------------------------------------------------------------------------
// Fallback implementations for CRITICAL tools
// ---------------------------------------------------------------------------
const CRITICAL_FALLBACKS = {
  'heady.ping': async (_params) => ({ pong: true, fallback: true, timestamp: Date.now() }),

  'heady.echo': async (params) => ({ echo: params?.input || '', fallback: true }),

  'heady.status': async (_params) => ({
    status: 'degraded',
    fallback: true,
    message: 'MCP SDK breaker OPEN — running in degraded mode',
    timestamp: new Date().toISOString(),
  }),

  'heady.agent.list': async (_params) => ({
    agents: [],
    fallback: true,
    message: 'Agent list unavailable while MCP circuit is open',
  }),

  'heady.memory.retrieve': async (params) => ({
    result: null,
    fallback: true,
    message: `Memory unavailable for key: ${params?.key || 'unknown'}`,
  }),

  'heady.llm.generate': async (params) => ({
    content: 'Service temporarily unavailable. Please retry shortly.',
    model: 'fallback',
    fallback: true,
    prompt: params?.prompt || '',
  }),

  'heady.file.read': async (params) => ({
    content: null,
    fallback: true,
    error: `File read unavailable for: ${params?.path || 'unknown'}`,
  }),

  'heady.file.list': async (params) => ({
    files: [],
    fallback: true,
    message: `File listing unavailable for: ${params?.dir || '/'}`,
  }),

  'heady.workflow.status': async (params) => ({
    status: 'unknown',
    fallback: true,
    workflowId: params?.workflowId || 'unknown',
  }),
};

// ---------------------------------------------------------------------------
// Timeout helper
// ---------------------------------------------------------------------------
function withTimeout(promise, ms, toolName) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`MCP tool timeout: ${toolName} (${ms}ms)`)),
      ms
    );
    promise.then(v => { clearTimeout(t); resolve(v); },
                 e => { clearTimeout(t); reject(e); });
  });
}

// ---------------------------------------------------------------------------
// MCPToolBreaker — manages per-tool breakers
// ---------------------------------------------------------------------------
class MCPToolBreaker extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {object}   [opts.mcpClient]       @modelcontextprotocol/sdk Client instance
   * @param {number}   [opts.defaultTimeoutMs]
   * @param {boolean}  [opts.useFallbacks]    Default: true
   */
  constructor(opts = {}) {
    super();
    this._client         = opts.mcpClient      || null;
    this._defaultTimeout = opts.defaultTimeoutMs || DEFAULT_TOOL_TIMEOUT_MS;
    this._useFallbacks   = opts.useFallbacks !== false;

    // Global MCP SDK breaker (parent)
    this._globalBreaker = registry.get('mcp-sdk');
    this._globalBreaker.on('stateChange', e => this.emit('stateChange', { ...e, scope: 'global' }));

    // Per-tool breakers — Map<toolName, EnhancedCircuitBreaker>
    this._toolBreakers = new Map();
    this._toolConfigs  = new Map();
    this._toolMetrics  = new Map();

    // Register all 31 tools
    for (const tool of TOOL_REGISTRY) {
      this._registerTool(tool);
    }
  }

  // -------------------------------------------------------------------------
  // Tool registration
  // -------------------------------------------------------------------------
  _registerTool(toolDef) {
    const { name, timeoutMs, critical, description, fallback } = toolDef;

    const breaker = new EnhancedCircuitBreaker(`mcp:${name}`, {
      failureThreshold: 5,
      recoveryTimeout:  30_000,
      halfOpenMaxCalls: 3,
      timeoutMs: timeoutMs || this._defaultTimeout,
    });

    breaker.on('stateChange', e => {
      this.emit('toolStateChange', { ...e, tool: name });
    });

    this._toolBreakers.set(name, breaker);
    this._toolConfigs.set(name, {
      timeoutMs: timeoutMs || this._defaultTimeout,
      critical: !!critical,
      description: description || name,
      fallback: fallback || CRITICAL_FALLBACKS[name] || null,
    });
    this._toolMetrics.set(name, { calls: 0, failures: 0, fallbackCalls: 0, lastError: null });
  }

  /**
   * Dynamically register an additional tool not in the default 31.
   * @param {object} toolDef
   */
  registerTool(toolDef) {
    if (this._toolBreakers.has(toolDef.name)) return; // already registered
    this._registerTool(toolDef);
  }

  setClient(client) { this._client = client; }

  // -------------------------------------------------------------------------
  // Core call() — main entry point
  // -------------------------------------------------------------------------
  /**
   * Call an MCP tool with full circuit-breaker protection.
   *
   * @param {string} toolName   MCP tool name (e.g. 'heady.memory.retrieve')
   * @param {object} [params]   Tool parameters
   * @returns {Promise<any>}
   */
  async call(toolName, params = {}) {
    const metrics = this._toolMetrics.get(toolName);
    const config  = this._toolConfigs.get(toolName);
    const breaker = this._toolBreakers.get(toolName);

    if (!breaker) {
      // Unknown tool — register it dynamically and proceed
      this.registerTool({ name: toolName });
      return this.call(toolName, params);
    }

    metrics.calls++;

    // If global MCP breaker is OPEN, check for fallback
    if (this._globalBreaker.state === STATES.OPEN) {
      return this._handleFallback(toolName, params, config, metrics, new Error('Global MCP circuit is OPEN'));
    }

    // If per-tool breaker is OPEN, check for fallback
    if (breaker.state === STATES.OPEN) {
      return this._handleFallback(toolName, params, config, metrics, new Error(`Tool circuit ${toolName} is OPEN`));
    }

    const timeoutMs = config?.timeoutMs || this._defaultTimeout;

    try {
      const result = await breaker.execute(() =>
        this._globalBreaker.execute(() => {
          if (!this._client) throw new Error('MCPToolBreaker: MCP client not initialised');
          return withTimeout(
            this._client.callTool({ name: toolName, arguments: params }),
            timeoutMs,
            toolName
          );
        })
      );

      return result;
    } catch (err) {
      metrics.failures++;
      metrics.lastError = err.message;
      return this._handleFallback(toolName, params, config, metrics, err);
    }
  }

  // -------------------------------------------------------------------------
  // Fallback handling
  // -------------------------------------------------------------------------
  async _handleFallback(toolName, params, config, metrics, originalErr) {
    if (!this._useFallbacks) throw originalErr;

    const fallbackFn = config?.fallback || CRITICAL_FALLBACKS[toolName];

    if (!fallbackFn) {
      this.emit('toolFailed', { tool: toolName, error: originalErr.message, fallback: false });
      throw originalErr;
    }

    try {
      metrics.fallbackCalls++;
      const result = await fallbackFn(params);
      this.emit('toolFallback', { tool: toolName, reason: originalErr.message });
      return result;
    } catch (fallbackErr) {
      this.emit('toolFailed', { tool: toolName, error: fallbackErr.message, fallback: true });
      throw new Error(`${toolName} and its fallback both failed: ${fallbackErr.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Batch call (parallel, with individual error handling)
  // -------------------------------------------------------------------------
  /**
   * Call multiple tools in parallel.
   * Returns an array of { toolName, result?, error? } objects.
   *
   * @param {Array<{name: string, params?: object}>} calls
   */
  async callBatch(calls) {
    return Promise.all(
      calls.map(async ({ name, params }) => {
        try {
          const result = await this.call(name, params);
          return { toolName: name, result };
        } catch (err) {
          return { toolName: name, error: err.message };
        }
      })
    );
  }

  // -------------------------------------------------------------------------
  // Tool availability dashboard
  // -------------------------------------------------------------------------
  /**
   * Returns availability status for all registered tools.
   */
  dashboard() {
    const tools = {};
    for (const [name, breaker] of this._toolBreakers.entries()) {
      const config  = this._toolConfigs.get(name);
      const metrics = this._toolMetrics.get(name);
      tools[name] = {
        state:         breaker.state,
        available:     breaker.state !== STATES.OPEN,
        critical:      config.critical,
        hasFallback:   !!(config.fallback || CRITICAL_FALLBACKS[name]),
        description:   config.description,
        timeoutMs:     config.timeoutMs,
        calls:         metrics.calls,
        failures:      metrics.failures,
        fallbackCalls: metrics.fallbackCalls,
        lastError:     metrics.lastError,
        p99LatencyMs:  breaker.p99LatencyMs,
      };
    }

    const toolList = Object.values(tools);
    return {
      timestamp: new Date().toISOString(),
      global: this._globalBreaker.snapshot(),
      summary: {
        total:          toolList.length,
        available:      toolList.filter(t => t.available).length,
        open:           toolList.filter(t => !t.available).length,
        critical:       toolList.filter(t => t.critical).length,
        withFallback:   toolList.filter(t => t.hasFallback).length,
      },
      tools,
    };
  }

  // -------------------------------------------------------------------------
  // Reset helpers
  // -------------------------------------------------------------------------
  resetTool(toolName) {
    const b = this._toolBreakers.get(toolName);
    if (!b) throw new Error(`Unknown tool: ${toolName}`);
    b.reset();
    const m = this._toolMetrics.get(toolName);
    m.calls = 0; m.failures = 0; m.fallbackCalls = 0; m.lastError = null;
  }

  resetAll() {
    this._globalBreaker.reset();
    for (const [name] of this._toolBreakers) this.resetTool(name);
  }

  // -------------------------------------------------------------------------
  // Express route handler factories
  // -------------------------------------------------------------------------
  dashboardHandler() {
    return (_req, res) => res.json(this.dashboard());
  }

  resetToolHandler() {
    return (req, res) => {
      const { tool } = req.params;
      try {
        this.resetTool(tool);
        res.json({ tool, reset: true });
      } catch (err) {
        res.status(404).json({ error: err.message });
      }
    };
  }

  registerRoutes(app) {
    app.get('/api/mcp/breakers',           this.dashboardHandler());
    app.post('/api/mcp/breakers/:tool/reset', this.resetToolHandler());
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------
const mcpBreaker = new MCPToolBreaker();

module.exports = {
  mcpBreaker,
  MCPToolBreaker,
  TOOL_REGISTRY,
  CRITICAL_FALLBACKS,
  DEFAULT_TOOL_TIMEOUT_MS,
};
