'use strict';

/**
 * @fileoverview MCP transport layer — SSE + JSON-RPC 2.0 over HTTP.
 * Implements the MCP (Model Context Protocol) transport specification.
 * @module mcp/mcp-transport
 */

const { EventEmitter } = require('events');
const logger = require('../utils/logger');
const { getAllTools, executeTool } = require('./mcp-tools');

/**
 * @typedef {Object} JsonRpcRequest
 * @property {string} jsonrpc - Must be "2.0"
 * @property {string} method
 * @property {*} params
 * @property {string|number|null} id
 */

/**
 * @typedef {Object} JsonRpcResponse
 * @property {string} jsonrpc - "2.0"
 * @property {*} [result]
 * @property {Object} [error]
 * @property {string|number|null} id
 */

/**
 * @typedef {Object} SSEClient
 * @property {string} id
 * @property {Object} res - Express response object
 * @property {Date} connectedAt
 * @property {number} eventCount
 */

const JSONRPC_VERSION = '2.0';

const JSON_RPC_ERRORS = {
  PARSE_ERROR:      { code: -32700, message: 'Parse error' },
  INVALID_REQUEST:  { code: -32600, message: 'Invalid Request' },
  METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
  INVALID_PARAMS:   { code: -32602, message: 'Invalid params' },
  INTERNAL_ERROR:   { code: -32603, message: 'Internal error' },
};

/**
 * MCP Transport — handles both SSE connections and JSON-RPC request dispatch.
 * Implements the MCP protocol methods: tools/list, tools/call, resources/list, prompts/list.
 */
class MCPTransport extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, SSEClient>} */
    this._clients = new Map();
    this._clientSeq = 0;
    this._requestCount = 0;
    this._errorCount = 0;
    this._startedAt = new Date().toISOString();

    logger.info('[mcp-transport] MCPTransport initialized');
  }

  // ─── SSE Connection Management ─────────────────────────────────────────

  /**
   * Handles a new SSE connection request.
   * Sets up the SSE response and registers the client.
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @returns {string} The new client ID
   */
  handleSSE(req, res) {
    const clientId = `sse-${++this._clientSeq}-${Date.now()}`;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    const client = { id: clientId, res, connectedAt: new Date(), eventCount: 0 };
    this._clients.set(clientId, client);

    logger.info(`[mcp-transport] SSE client connected: ${clientId}`, { total: this._clients.size });

    // Send initial connection event
    this._sendRaw(client, 'connected', { clientId, serverTime: new Date().toISOString(), protocolVersion: '1.0' });

    // Heartbeat every 30s to keep connection alive
    const heartbeat = setInterval(() => {
      if (!this._clients.has(clientId)) {
        clearInterval(heartbeat);
        return;
      }
      this._sendRaw(client, 'ping', { ts: Date.now() });
    }, 30000);

    // Cleanup on disconnect
    const cleanup = () => {
      clearInterval(heartbeat);
      this._clients.delete(clientId);
      logger.info(`[mcp-transport] SSE client disconnected: ${clientId}`, { remaining: this._clients.size });
      this.emit('client:disconnect', clientId);
    };

    req.on('close', cleanup);
    req.on('abort', cleanup);
    req.on('error', cleanup);

    this.emit('client:connect', clientId);
    return clientId;
  }

  /**
   * Sends an SSE event to a specific client.
   * @param {string} clientId
   * @param {string} event - Event type name
   * @param {Object} data - JSON-serializable data
   * @returns {boolean} true if sent, false if client not found
   */
  sendEvent(clientId, event, data) {
    const client = this._clients.get(clientId);
    if (!client) return false;
    return this._sendRaw(client, event, data);
  }

  /**
   * Broadcasts an SSE event to all connected clients.
   * @param {string} event
   * @param {Object} data
   * @returns {number} Number of clients reached
   */
  broadcast(event, data) {
    let count = 0;
    for (const client of this._clients.values()) {
      if (this._sendRaw(client, event, data)) count++;
    }
    return count;
  }

  /**
   * @private
   * @param {SSEClient} client
   * @param {string} event
   * @param {Object} data
   * @returns {boolean}
   */
  _sendRaw(client, event, data) {
    try {
      const id = ++client.eventCount;
      const payload = `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      client.res.write(payload);
      return true;
    } catch (err) {
      logger.debug(`[mcp-transport] failed to send to client ${client.id}: ${err.message}`);
      this._clients.delete(client.id);
      return false;
    }
  }

  // ─── JSON-RPC Dispatch ─────────────────────────────────────────────────

  /**
   * Handles a JSON-RPC 2.0 request. Dispatches to the appropriate MCP method.
   * Responds via res.json().
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  async handleJSONRPC(req, res) {
    this._requestCount++;
    const body = req.body;

    // Batch requests
    if (Array.isArray(body)) {
      const responses = await Promise.all(body.map((r) => this._dispatch(r)));
      return res.json(responses);
    }

    // Validate structure
    if (!body || typeof body !== 'object') {
      this._errorCount++;
      return res.status(400).json(this._errorResponse(null, JSON_RPC_ERRORS.PARSE_ERROR));
    }

    if (body.jsonrpc !== JSONRPC_VERSION) {
      this._errorCount++;
      return res.status(400).json(this._errorResponse(body.id || null, JSON_RPC_ERRORS.INVALID_REQUEST));
    }

    const response = await this._dispatch(body);

    // Notifications (no id) don't get a response body
    if (body.id === undefined && !response.error) {
      return res.status(204).end();
    }

    return res.json(response);
  }

  /**
   * Streams a JSON-RPC call result via SSE.
   * The client must already be connected via handleSSE.
   * @param {Object} req - Express request (expects query.clientId)
   * @param {Object} res - Express response
   */
  async handleStreamingRPC(req, res) {
    const { clientId } = req.query;

    if (!clientId || !this._clients.has(clientId)) {
      return res.status(400).json({ error: 'Invalid or missing clientId. Connect to /api/mcp/stream first.' });
    }

    const body = req.body;
    if (!body || body.jsonrpc !== JSONRPC_VERSION) {
      return res.status(400).json({ error: 'Invalid JSON-RPC request' });
    }

    res.json({ accepted: true, clientId, requestId: body.id });

    // Dispatch asynchronously and stream result via SSE
    const dispatch = async () => {
      try {
        const response = await this._dispatch(body);
        this.sendEvent(clientId, 'rpc:response', response);
      } catch (err) {
        this.sendEvent(clientId, 'rpc:error', { error: err.message, requestId: body.id });
      }
    };
    dispatch();
  }

  /**
   * @private
   * Dispatches a single JSON-RPC request to the correct handler.
   * @param {JsonRpcRequest} request
   * @returns {Promise<JsonRpcResponse>}
   */
  async _dispatch(request) {
    const { method, params, id } = request;

    if (!method || typeof method !== 'string') {
      return this._errorResponse(id || null, JSON_RPC_ERRORS.INVALID_REQUEST);
    }

    logger.debug(`[mcp-transport] dispatch: ${method}`, { id });

    try {
      switch (method) {
        case 'tools/list':
          return this._successResponse(id, await this._handleToolsList(params));

        case 'tools/call':
          return this._successResponse(id, await this._handleToolsCall(params));

        case 'resources/list':
          return this._successResponse(id, await this._handleResourcesList(params));

        case 'prompts/list':
          return this._successResponse(id, await this._handlePromptsList(params));

        case 'ping':
          return this._successResponse(id, { pong: true, ts: Date.now() });

        case 'initialize':
          return this._successResponse(id, this._handleInitialize(params));

        default:
          return this._errorResponse(id, {
            ...JSON_RPC_ERRORS.METHOD_NOT_FOUND,
            message: `Method '${method}' not found`,
          });
      }
    } catch (err) {
      this._errorCount++;
      logger.error(`[mcp-transport] dispatch error for '${method}': ${err.message}`);
      return this._errorResponse(id, { ...JSON_RPC_ERRORS.INTERNAL_ERROR, data: err.message });
    }
  }

  // ─── MCP Method Handlers ──────────────────────────────────────────────

  /**
   * tools/list — Returns all available tools.
   * @param {Object} [params]
   * @returns {Promise<{tools: Array}>}
   */
  async _handleToolsList(params = {}) {
    const tools = getAllTools();
    const { category, limit, cursor } = params;

    let filtered = tools;
    if (category) {
      filtered = filtered.filter((t) => t.category === category);
    }

    const start = cursor ? parseInt(cursor, 10) : 0;
    const pageSize = limit || filtered.length;
    const page = filtered.slice(start, start + pageSize);
    const nextCursor = start + pageSize < filtered.length ? String(start + pageSize) : null;

    return {
      tools: page.map((t) => ({
        name: t.name,
        description: t.description,
        category: t.category,
        inputSchema: t.inputSchema,
      })),
      nextCursor,
      total: filtered.length,
    };
  }

  /**
   * tools/call — Executes a named tool.
   * @param {Object} params
   * @param {string} params.name
   * @param {Object} [params.arguments]
   * @returns {Promise<Object>}
   */
  async _handleToolsCall(params = {}) {
    const { name, arguments: args = {} } = params;
    if (!name) throw Object.assign(new Error('params.name is required'), { rpcCode: -32602 });

    logger.info(`[mcp-transport] executing tool: ${name}`);
    const result = await executeTool(name, args);

    // Format as MCP content response
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: !result.success,
      _meta: { tool: name, durationMs: result.durationMs },
    };
  }

  /**
   * resources/list — Lists available resources (memory store entries, etc.).
   * @param {Object} [params]
   * @returns {Promise<{resources: Array}>}
   */
  async _handleResourcesList(params = {}) {
    const resources = [
      {
        uri: 'heady://memory/store',
        name: 'HeadyStack Memory Store',
        description: 'Vector memory store for semantic search',
        mimeType: 'application/json',
      },
      {
        uri: 'heady://config/current',
        name: 'Current Configuration',
        description: 'Active runtime configuration',
        mimeType: 'application/json',
      },
      {
        uri: 'heady://telemetry/snapshot',
        name: 'Telemetry Snapshot',
        description: 'Current system metrics',
        mimeType: 'application/json',
      },
    ];

    return { resources };
  }

  /**
   * prompts/list — Lists available prompt templates.
   * @param {Object} [params]
   * @returns {Promise<{prompts: Array}>}
   */
  async _handlePromptsList(params = {}) {
    const prompts = [
      {
        name: 'system-health-report',
        description: 'Generate a system health report',
        arguments: [{ name: 'detailed', description: 'Include detailed metrics', required: false }],
      },
      {
        name: 'security-audit',
        description: 'Run a security audit and summarize findings',
        arguments: [{ name: 'target', description: 'Target directory', required: false }],
      },
      {
        name: 'deployment-plan',
        description: 'Generate a deployment plan for a target environment',
        arguments: [
          { name: 'environment', description: 'Target environment', required: true },
          { name: 'service', description: 'Service name', required: false },
        ],
      },
    ];

    return { prompts };
  }

  /**
   * initialize — MCP protocol initialization handshake.
   * @param {Object} [params]
   * @returns {Object}
   */
  _handleInitialize(params = {}) {
    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false },
        prompts: { listChanged: false },
        logging: {},
      },
      serverInfo: {
        name: 'HeadyStack MCP Server',
        version: '1.0.0',
      },
    };
  }

  // ─── Response Builders ─────────────────────────────────────────────────

  /**
   * Builds a JSON-RPC success response.
   * @param {string|number|null} id
   * @param {*} result
   * @returns {JsonRpcResponse}
   */
  _successResponse(id, result) {
    return { jsonrpc: JSONRPC_VERSION, id: id ?? null, result };
  }

  /**
   * Builds a JSON-RPC error response.
   * @param {string|number|null} id
   * @param {{code: number, message: string, data?: *}} error
   * @returns {JsonRpcResponse}
   */
  _errorResponse(id, error) {
    return { jsonrpc: JSONRPC_VERSION, id: id ?? null, error };
  }

  // ─── Transport Stats ───────────────────────────────────────────────────

  /**
   * Returns current transport statistics.
   * @returns {Object}
   */
  getStats() {
    return {
      connectedClients: this._clients.size,
      totalRequests: this._requestCount,
      totalErrors: this._errorCount,
      startedAt: this._startedAt,
      uptime: process.uptime(),
    };
  }
}

module.exports = { MCPTransport };
