/**
 * @fileoverview MCP Multi-Transport Adapter
 *
 * Provides a unified interface for all MCP transport types:
 * - Streamable HTTP (current standard, MCP spec 2025-03-26+)
 * - Legacy SSE (HTTP+SSE, 2024-11-05 spec — kept for backward compatibility)
 * - stdio (local subprocess transport)
 * - WebSocket (community transport, common in web environments)
 *
 * Handles:
 * - Automatic transport detection and negotiation
 * - JSON-RPC 2.0 message serialization/deserialization
 * - Streaming response handling (SSE event streams)
 * - Per-transport reconnection logic
 * - MCP-Protocol-Version header negotiation
 *
 * @module modules/transport-adapter
 * @requires events
 */

import { EventEmitter } from 'events';
import { createInterface } from 'readline';

// ─── Transport Identifiers ────────────────────────────────────────────────────

export const TransportId = Object.freeze({
  STREAMABLE_HTTP: 'streamable-http',
  SSE:             'sse',
  STDIO:           'stdio',
  WEBSOCKET:       'websocket',
  AUTO:            'auto',
});

/** MCP protocol versions in preference order (newest first) */
const PROTOCOL_VERSIONS = ['2025-11-25', '2025-03-26', '2024-11-05'];

/** Current default protocol version */
const DEFAULT_PROTOCOL_VERSION = '2025-11-25';

// ─── JSON-RPC Helpers ─────────────────────────────────────────────────────────

/**
 * Serialize a JSON-RPC 2.0 request.
 *
 * @param {string} method - RPC method name
 * @param {Object} [params] - Method parameters
 * @param {string|number} [id] - Request ID (omit for notifications)
 * @returns {string} Serialized JSON string
 */
export function serializeRequest(method, params, id) {
  const msg = { jsonrpc: '2.0', method };
  if (params !== undefined) msg.params = params;
  if (id !== undefined) msg.id = id;
  return JSON.stringify(msg);
}

/**
 * Deserialize a JSON-RPC 2.0 message.
 *
 * @param {string} raw - Raw JSON string
 * @returns {{id?: any, method?: string, result?: any, error?: Object, params?: any}}
 * @throws {Error} If the string is not valid JSON-RPC 2.0
 */
export function deserializeMessage(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in MCP message: ${raw.slice(0, 100)}`);
  }
  if (parsed.jsonrpc !== '2.0') {
    throw new Error(`Expected jsonrpc: "2.0", got: ${parsed.jsonrpc}`);
  }
  return parsed;
}

/**
 * Parse Server-Sent Events stream data.
 *
 * @param {string} chunk - Raw SSE chunk text
 * @returns {Array<{event?: string, data?: string, id?: string, retry?: number}>}
 */
export function parseSSEChunk(chunk) {
  const events = [];
  const blocks = chunk.split('\n\n').filter(Boolean);
  for (const block of blocks) {
    const evt = {};
    for (const line of block.split('\n')) {
      if (line.startsWith('data:')) evt.data = line.slice(5).trim();
      else if (line.startsWith('event:')) evt.event = line.slice(6).trim();
      else if (line.startsWith('id:')) evt.id = line.slice(3).trim();
      else if (line.startsWith('retry:')) evt.retry = parseInt(line.slice(6).trim(), 10);
    }
    if (Object.keys(evt).length > 0) events.push(evt);
  }
  return events;
}

// ─── Transport Detection ──────────────────────────────────────────────────────

/**
 * Detect which transport to use for a given URL.
 *
 * Detection algorithm:
 * 1. `stdio://` or no URL → stdio
 * 2. `ws://` or `wss://` → websocket
 * 3. HTTP/HTTPS → probe for Streamable HTTP (POST), fall back to SSE (GET)
 *
 * @param {string|URL} endpoint - Server endpoint
 * @returns {Promise<TransportId>}
 */
export async function detectTransport(endpoint) {
  if (!endpoint || endpoint === 'stdio' || String(endpoint).startsWith('stdio://')) {
    return TransportId.STDIO;
  }

  const url = typeof endpoint === 'string' ? new URL(endpoint) : endpoint;

  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return TransportId.WEBSOCKET;
  }

  if (url.protocol === 'http:' || url.protocol === 'https:') {
    // Probe for Streamable HTTP support (POST with MCP-Protocol-Version header)
    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'MCP-Protocol-Version': DEFAULT_PROTOCOL_VERSION,
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 'probe' }),
        signal: AbortSignal.timeout(3000),
      });

      // Streamable HTTP returns 200 or 202 with JSON or event-stream
      if (response.ok || response.status === 400) {
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('application/json') || contentType.includes('text/event-stream')) {
          return TransportId.STREAMABLE_HTTP;
        }
      }
      // 404 or 405 for POST = legacy SSE server
      if (response.status === 404 || response.status === 405) {
        return TransportId.SSE;
      }
    } catch (_) { /* fall through */ }

    // Default to SSE for HTTP if detection fails
    return TransportId.SSE;
  }

  throw new Error(`Unsupported endpoint protocol: ${url.protocol}`);
}

// ─── Base Transport ───────────────────────────────────────────────────────────

/**
 * Abstract base for all transport implementations.
 *
 * @abstract
 */
class BaseTransport extends EventEmitter {
  /**
   * @param {Object} options
   * @param {Function} [options.onMessage] - Callback for incoming messages
   * @param {boolean} [options.enableLogging=false]
   */
  constructor(options = {}) {
    super();
    this.onMessage = options.onMessage ?? null;
    this.enableLogging = options.enableLogging ?? false;
    this._connected = false;
    this._protocolVersion = DEFAULT_PROTOCOL_VERSION;
  }

  /** @returns {boolean} */
  get connected() { return this._connected; }

  /**
   * Connect to the server.
   * @returns {Promise<void>}
   * @abstract
   */
  async connect() { throw new Error('Not implemented'); }

  /**
   * Send a message.
   * @param {string} message - Serialized JSON-RPC message
   * @returns {Promise<void>}
   * @abstract
   */
  async send(message) { throw new Error('Not implemented'); }

  /**
   * Close the connection.
   * @returns {Promise<void>}
   * @abstract
   */
  async close() { throw new Error('Not implemented'); }

  /** @protected */
  _handleIncoming(raw) {
    try {
      const msg = deserializeMessage(raw);
      this.emit('message', msg);
      this.onMessage?.(msg);
    } catch (err) {
      this.emit('parse_error', { raw, error: err.message });
    }
  }

  /** @protected */
  _log(event, data) {
    if (this.enableLogging) this.emit('log', { event, ...data });
  }
}

// ─── Streamable HTTP Transport ────────────────────────────────────────────────

/**
 * Streamable HTTP transport implementation (MCP spec 2025-03-26+).
 *
 * Supports both simple request/response and SSE streaming upgrades.
 * Implements session management via MCP-Session-Id header.
 * Supports resumability via Last-Event-ID.
 *
 * @extends BaseTransport
 */
export class StreamableHTTPTransport extends BaseTransport {
  /**
   * @param {string|URL} url - Server endpoint URL
   * @param {Object} [options={}]
   * @param {Object} [options.headers={}] - Additional request headers (auth, etc.)
   * @param {boolean} [options.enableStreaming=true] - Accept SSE streaming responses
   * @param {number} [options.reconnectDelayMs=1000] - Base reconnect delay
   * @param {number} [options.maxReconnectAttempts=5]
   */
  constructor(url, options = {}) {
    super(options);
    this._url = typeof url === 'string' ? new URL(url) : url;
    this._headers = options.headers ?? {};
    this._enableStreaming = options.enableStreaming ?? true;
    this._reconnectDelayMs = options.reconnectDelayMs ?? 1000;
    this._maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
    this._sessionId = null;
    this._negotiatedVersion = null;
    this._sseController = null;
    this._lastEventId = null;
    this._reconnectAttempts = 0;
  }

  /** @returns {string|null} Active MCP session ID */
  get sessionId() { return this._sessionId; }

  /** @returns {string|null} Negotiated protocol version */
  get protocolVersion() { return this._negotiatedVersion; }

  /**
   * Connect by performing the MCP initialize handshake.
   *
   * @returns {Promise<void>}
   */
  async connect() {
    const response = await this._post(
      serializeRequest('initialize', {
        protocolVersion: DEFAULT_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        clientInfo: { name: 'heady-transport-adapter', version: '1.0.0' },
      }, 'init-0')
    );

    this._negotiatedVersion = response.headers.get('MCP-Protocol-Version') ?? DEFAULT_PROTOCOL_VERSION;
    this._sessionId = response.headers.get('MCP-Session-Id') ?? null;
    this._connected = true;
    this._reconnectAttempts = 0;

    this._log('connected', { url: this._url.toString(), version: this._negotiatedVersion, sessionId: this._sessionId });
    this.emit('connected', { sessionId: this._sessionId, version: this._negotiatedVersion });

    // If server wants server-initiated messages, open the SSE GET channel
    if (this._enableStreaming) {
      this._openSSEChannel().catch(err => {
        this._log('sse_channel_error', { error: err.message });
      });
    }
  }

  /**
   * Send a message (POST), handling streaming responses.
   *
   * @param {string} message - Serialized JSON-RPC message
   * @returns {Promise<Object|null>} Parsed response or null for notifications
   */
  async send(message) {
    const response = await this._post(message);
    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('text/event-stream')) {
      // Streaming response — consume SSE events
      return this._consumeSSEResponse(response);
    } else {
      const text = await response.text();
      if (!text.trim()) return null;
      const msg = deserializeMessage(text);
      this._handleIncoming(text);
      return msg;
    }
  }

  /**
   * Execute a POST request with appropriate headers.
   *
   * @param {string} body
   * @returns {Promise<Response>}
   * @private
   */
  async _post(body) {
    const headers = {
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': this._negotiatedVersion ?? DEFAULT_PROTOCOL_VERSION,
      Accept: 'application/json, text/event-stream',
      ...this._headers,
    };
    if (this._sessionId) headers['MCP-Session-Id'] = this._sessionId;

    const response = await fetch(this._url.toString(), {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok && response.status !== 202) {
      const errText = await response.text().catch(() => '');
      throw new Error(`MCP HTTP ${response.status}: ${errText.slice(0, 200)}`);
    }

    // Capture session ID from response if provided
    const newSessionId = response.headers.get('MCP-Session-Id');
    if (newSessionId) this._sessionId = newSessionId;

    return response;
  }

  /**
   * Open a GET SSE channel for server-initiated messages.
   *
   * @returns {Promise<void>}
   * @private
   */
  async _openSSEChannel() {
    const headers = {
      Accept: 'text/event-stream',
      'MCP-Protocol-Version': this._negotiatedVersion ?? DEFAULT_PROTOCOL_VERSION,
      ...this._headers,
    };
    if (this._sessionId) headers['MCP-Session-Id'] = this._sessionId;
    if (this._lastEventId) headers['Last-Event-ID'] = this._lastEventId;

    const response = await fetch(this._url.toString(), { method: 'GET', headers });
    if (!response.ok) {
      // Server doesn't support server-initiated messages — that's ok
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    const pump = async () => {
      while (this._connected) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const events = parseSSEChunk(part + '\n\n');
          for (const evt of events) {
            if (evt.id) this._lastEventId = evt.id;
            if (evt.data) this._handleIncoming(evt.data);
          }
        }
      }
    };

    pump().catch(err => {
      if (this._connected) {
        this.emit('sse_error', { error: err.message });
        this._scheduleSSEReconnect();
      }
    });
  }

  /** Schedule SSE channel reconnect on error */
  _scheduleSSEReconnect() {
    if (this._reconnectAttempts >= this._maxReconnectAttempts) return;
    const delay = this._reconnectDelayMs * Math.pow(1.618, this._reconnectAttempts++);
    setTimeout(() => {
      if (this._connected) this._openSSEChannel().catch(() => {});
    }, Math.min(delay, 30_000));
  }

  /**
   * Consume a streaming (SSE) POST response.
   *
   * @param {Response} response
   * @returns {Promise<Object|null>} Last result message
   * @private
   */
  async _consumeSSEResponse(response) {
    const reader = response.body?.getReader();
    if (!reader) return null;

    const decoder = new TextDecoder();
    let buffer = '';
    let lastResult = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const events = parseSSEChunk(part + '\n\n');
        for (const evt of events) {
          if (evt.id) this._lastEventId = evt.id;
          if (evt.data) {
            this._handleIncoming(evt.data);
            try { lastResult = deserializeMessage(evt.data); } catch (_) {}
          }
        }
      }
    }
    return lastResult;
  }

  /**
   * Close the transport and terminate the session.
   *
   * @returns {Promise<void>}
   */
  async close() {
    this._connected = false;
    if (this._sessionId) {
      // Send DELETE to terminate session per spec
      const headers = {
        'MCP-Session-Id': this._sessionId,
        'MCP-Protocol-Version': this._negotiatedVersion ?? DEFAULT_PROTOCOL_VERSION,
        ...this._headers,
      };
      await fetch(this._url.toString(), { method: 'DELETE', headers }).catch(() => {});
    }
    this._sessionId = null;
    this.emit('disconnected', {});
  }
}

// ─── Legacy SSE Transport ─────────────────────────────────────────────────────

/**
 * Legacy HTTP+SSE transport (MCP spec 2024-11-05).
 *
 * Maintained for backwards compatibility with older servers.
 * Uses two separate endpoints: GET /sse for receiving, POST /messages for sending.
 *
 * @extends BaseTransport
 */
export class LegacySSETransport extends BaseTransport {
  /**
   * @param {string|URL} sseUrl - GET endpoint for SSE stream
   * @param {string|URL} [messagesUrl] - POST endpoint (defaults to /messages relative to sseUrl)
   * @param {Object} [options={}]
   */
  constructor(sseUrl, messagesUrl, options = {}) {
    super(options);
    this._sseUrl = typeof sseUrl === 'string' ? new URL(sseUrl) : sseUrl;
    this._messagesUrl = messagesUrl ? new URL(messagesUrl) : new URL('/messages', this._sseUrl);
    this._headers = options.headers ?? {};
    this._sessionEndpoint = null;
    this._sseReader = null;
    this._lastEventId = null;
  }

  /**
   * Connect by opening the SSE stream and waiting for 'endpoint' event.
   *
   * @returns {Promise<void>}
   */
  async connect() {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await fetch(this._sseUrl.toString(), {
          headers: { Accept: 'text/event-stream', ...this._headers },
        });
        if (!response.ok) {
          return reject(new Error(`SSE connect failed: ${response.status}`));
        }

        const reader = response.body?.getReader();
        if (!reader) return reject(new Error('No response body'));
        this._sseReader = reader;

        let resolved = false;
        const decoder = new TextDecoder();
        let buffer = '';

        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n\n');
            buffer = parts.pop() ?? '';
            for (const part of parts) {
              const events = parseSSEChunk(part + '\n\n');
              for (const evt of events) {
                if (evt.id) this._lastEventId = evt.id;
                if (evt.event === 'endpoint') {
                  this._sessionEndpoint = new URL(evt.data, this._sseUrl);
                  this._connected = true;
                  if (!resolved) { resolved = true; resolve(); }
                } else if (evt.data) {
                  this._handleIncoming(evt.data);
                }
              }
            }
          }
          if (!resolved) reject(new Error('SSE stream ended before endpoint event'));
        };

        pump().catch(err => {
          if (!resolved) reject(err);
          else this.emit('sse_error', { error: err.message });
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Send a message via POST to the messages endpoint.
   *
   * @param {string} message
   * @returns {Promise<void>}
   */
  async send(message) {
    const url = this._sessionEndpoint ?? this._messagesUrl;
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this._headers },
      body: message,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`SSE POST failed: ${response.status} ${text.slice(0, 100)}`);
    }
  }

  /**
   * Close the SSE connection.
   *
   * @returns {Promise<void>}
   */
  async close() {
    this._connected = false;
    try { await this._sseReader?.cancel(); } catch (_) {}
    this._sseReader = null;
    this.emit('disconnected', {});
  }
}

// ─── Stdio Transport ──────────────────────────────────────────────────────────

/**
 * Stdio transport for local MCP server subprocesses.
 *
 * Launches the MCP server as a child process and communicates via stdin/stdout.
 * Each message is a single newline-delimited JSON-RPC 2.0 message.
 * Server logs go to stderr (passed through to parent process stderr).
 *
 * @extends BaseTransport
 */
export class StdioTransport extends BaseTransport {
  /**
   * @param {string} command - Server executable
   * @param {string[]} [args=[]] - Command arguments
   * @param {Object} [options={}]
   * @param {Object} [options.env={}] - Additional environment variables
   * @param {string} [options.cwd] - Working directory for subprocess
   * @param {boolean} [options.passStderr=true] - Forward server stderr to parent
   */
  constructor(command, args = [], options = {}) {
    super(options);
    this._command = command;
    this._args = args;
    this._env = { ...process.env, ...options.env };
    this._cwd = options.cwd;
    this._passStderr = options.passStderr ?? true;
    this._process = null;
    this._rl = null;
  }

  /**
   * Launch the server subprocess and connect stdio streams.
   *
   * @returns {Promise<void>}
   */
  async connect() {
    const { spawn } = await import('child_process');

    this._process = spawn(this._command, this._args, {
      stdio: ['pipe', 'pipe', this._passStderr ? 'inherit' : 'pipe'],
      env: this._env,
      cwd: this._cwd,
    });

    this._process.on('error', err => {
      this._connected = false;
      this.emit('process_error', { error: err.message });
    });

    this._process.on('exit', (code, signal) => {
      this._connected = false;
      this.emit('process_exit', { code, signal });
    });

    // Read line-delimited JSON-RPC from stdout
    this._rl = createInterface({
      input: this._process.stdout,
      crlfDelay: Infinity,
    });

    this._rl.on('line', line => {
      if (line.trim()) this._handleIncoming(line.trim());
    });

    this._connected = true;
    this.emit('connected', { command: this._command, pid: this._process.pid });
  }

  /**
   * Send a newline-delimited message to the server's stdin.
   *
   * @param {string} message - Serialized JSON-RPC message (must not contain embedded newlines)
   * @returns {Promise<void>}
   */
  async send(message) {
    if (!this._connected || !this._process?.stdin) {
      throw new Error('Stdio transport not connected');
    }
    return new Promise((resolve, reject) => {
      this._process.stdin.write(message + '\n', err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Close the subprocess gracefully (SIGTERM → SIGKILL after 2s).
   *
   * @returns {Promise<void>}
   */
  async close() {
    this._connected = false;
    this._rl?.close();
    if (this._process && !this._process.killed) {
      this._process.kill('SIGTERM');
      await new Promise(resolve => {
        const timer = setTimeout(() => {
          this._process?.kill('SIGKILL');
          resolve();
        }, 2000);
        this._process.on('exit', () => { clearTimeout(timer); resolve(); });
      });
    }
    this.emit('disconnected', { pid: this._process?.pid });
  }

  /** @returns {import('child_process').ChildProcess|null} Underlying child process */
  get process() { return this._process; }
}

// ─── WebSocket Transport ──────────────────────────────────────────────────────

/**
 * WebSocket transport for MCP servers supporting ws:// or wss:// endpoints.
 *
 * Provides full-duplex bidirectional messaging over a persistent WebSocket
 * connection with automatic reconnection.
 *
 * @extends BaseTransport
 */
export class WebSocketTransport extends BaseTransport {
  /**
   * @param {string|URL} url - WebSocket endpoint (ws:// or wss://)
   * @param {Object} [options={}]
   * @param {string[]} [options.protocols=[]] - WebSocket sub-protocols
   * @param {Object} [options.headers={}] - HTTP upgrade headers
   * @param {number} [options.reconnectDelayMs=1000] - Base reconnect delay
   * @param {number} [options.maxReconnectAttempts=8]
   */
  constructor(url, options = {}) {
    super(options);
    this._url = url.toString();
    this._protocols = options.protocols ?? [];
    this._headers = options.headers ?? {};
    this._reconnectDelayMs = options.reconnectDelayMs ?? 1000;
    this._maxReconnectAttempts = options.maxReconnectAttempts ?? 8;
    this._ws = null;
    this._reconnectAttempts = 0;
    this._messageQueue = []; // Buffer messages while reconnecting
  }

  /**
   * Establish the WebSocket connection.
   *
   * @returns {Promise<void>}
   */
  async connect() {
    return new Promise((resolve, reject) => {
      const connectTimeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10_000);

      // Use native WebSocket (Node 22+) or ws library
      const WSClass = globalThis.WebSocket ?? require('ws');
      this._ws = new WSClass(this._url, this._protocols);

      this._ws.onopen = () => {
        clearTimeout(connectTimeout);
        this._connected = true;
        this._reconnectAttempts = 0;
        this.emit('connected', { url: this._url });

        // Flush queued messages
        while (this._messageQueue.length > 0) {
          this._ws.send(this._messageQueue.shift());
        }
        resolve();
      };

      this._ws.onmessage = evt => {
        const data = typeof evt.data === 'string' ? evt.data : evt.data.toString();
        this._handleIncoming(data);
      };

      this._ws.onerror = evt => {
        if (!this._connected) {
          clearTimeout(connectTimeout);
          reject(new Error(`WebSocket error: ${evt.message ?? 'unknown'}`));
        }
        this.emit('ws_error', { error: evt.message });
      };

      this._ws.onclose = evt => {
        this._connected = false;
        this.emit('ws_closed', { code: evt.code, reason: evt.reason });
        if (this._reconnectAttempts < this._maxReconnectAttempts) {
          this._scheduleReconnect();
        }
      };
    });
  }

  /**
   * Schedule WebSocket reconnect with phi-ratio backoff.
   *
   * @private
   */
  _scheduleReconnect() {
    const delay = Math.min(
      this._reconnectDelayMs * Math.pow(1.618, this._reconnectAttempts++),
      60_000
    );
    setTimeout(() => {
      this.connect().catch(err => {
        this.emit('reconnect_failed', { error: err.message });
        this._scheduleReconnect();
      });
    }, delay);
  }

  /**
   * Send a message over the WebSocket.
   *
   * If disconnected, queues the message for when reconnection succeeds.
   *
   * @param {string} message
   * @returns {Promise<void>}
   */
  async send(message) {
    if (!this._connected || !this._ws) {
      // Queue for reconnect
      this._messageQueue.push(message);
      return;
    }
    return new Promise((resolve, reject) => {
      this._ws.send(message, err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Close the WebSocket connection.
   *
   * @returns {Promise<void>}
   */
  async close() {
    this._reconnectAttempts = this._maxReconnectAttempts; // Prevent auto-reconnect
    this._connected = false;
    if (this._ws) {
      this._ws.close(1000, 'normal closure');
      this._ws = null;
    }
    this.emit('disconnected', {});
  }
}

// ─── MCPTransportAdapter ──────────────────────────────────────────────────────

/**
 * Unified transport adapter that auto-selects and creates the correct transport.
 *
 * Provides a single interface regardless of the underlying transport mechanism.
 * Handles transport detection, creation, negotiation, and lifecycle.
 *
 * @extends EventEmitter
 *
 * @example
 * ```js
 * // Auto-detect transport
 * const adapter = new MCPTransportAdapter('https://mcp.example.com/github', {
 *   headers: { Authorization: 'Bearer token123' },
 *   transportType: TransportId.AUTO,
 * });
 * await adapter.connect();
 * await adapter.send(serializeRequest('tools/list', {}, 1));
 *
 * // Explicit stdio transport
 * const stdioAdapter = new MCPTransportAdapter('stdio', {
 *   command: 'npx',
 *   args: ['-y', '@modelcontextprotocol/server-github'],
 *   env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN },
 * });
 * await stdioAdapter.connect();
 * ```
 */
export class MCPTransportAdapter extends EventEmitter {
  /**
   * @param {string|URL} endpoint - Server endpoint or 'stdio'
   * @param {Object} [options={}] - Transport options
   * @param {string} [options.transportType=TransportId.AUTO] - Force transport type
   * @param {Object} [options.headers={}] - HTTP headers (for HTTP transports)
   * @param {string} [options.command] - Executable (for stdio)
   * @param {string[]} [options.args=[]] - Arguments (for stdio)
   * @param {Object} [options.env={}] - Environment variables (for stdio)
   * @param {string} [options.messagesUrl] - POST endpoint (for legacy SSE)
   * @param {number} [options.reconnectDelayMs=1000]
   * @param {number} [options.maxReconnectAttempts=8]
   * @param {boolean} [options.enableLogging=false]
   */
  constructor(endpoint, options = {}) {
    super();
    this._endpoint = endpoint;
    this._options = options;
    this._requestedType = options.transportType ?? TransportId.AUTO;
    this._transport = null;
    this._resolvedType = null;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Detect transport type (if AUTO), create the transport, and connect.
   *
   * @returns {Promise<{transportType: string, protocolVersion: string|null}>}
   */
  async connect() {
    // Detect transport if AUTO
    if (this._requestedType === TransportId.AUTO) {
      this._resolvedType = await detectTransport(this._endpoint);
    } else {
      this._resolvedType = this._requestedType;
    }

    this._transport = this._createTransport(this._resolvedType);

    // Bubble transport events
    this._transport.on('message', msg => this.emit('message', msg));
    this._transport.on('connected', data => this.emit('connected', { ...data, transportType: this._resolvedType }));
    this._transport.on('disconnected', data => this.emit('disconnected', data));
    this._transport.on('error', err => this.emit('error', err));
    this._transport.on('log', data => this.emit('log', data));

    await this._transport.connect();

    return {
      transportType: this._resolvedType,
      protocolVersion: this._transport._negotiatedVersion ?? null,
    };
  }

  /**
   * Send a JSON-RPC message.
   *
   * @param {string} message - Serialized JSON-RPC 2.0 message
   * @returns {Promise<Object|null>}
   */
  async send(message) {
    if (!this._transport) throw new Error('Transport not connected. Call connect() first.');
    return this._transport.send(message);
  }

  /**
   * Close the transport.
   *
   * @returns {Promise<void>}
   */
  async close() {
    await this._transport?.close();
    this._transport = null;
  }

  // ─── Factory ───────────────────────────────────────────────────────────────

  /**
   * Create the correct transport instance for the given type.
   *
   * @param {string} type - Transport type identifier
   * @returns {BaseTransport}
   * @private
   */
  _createTransport(type) {
    const opts = {
      headers: this._options.headers ?? {},
      enableLogging: this._options.enableLogging ?? false,
      reconnectDelayMs: this._options.reconnectDelayMs ?? 1000,
      maxReconnectAttempts: this._options.maxReconnectAttempts ?? 8,
      onMessage: msg => this.emit('message', msg),
    };

    switch (type) {
      case TransportId.STREAMABLE_HTTP:
        return new StreamableHTTPTransport(this._endpoint, opts);

      case TransportId.SSE:
        return new LegacySSETransport(
          this._endpoint,
          this._options.messagesUrl,
          opts
        );

      case TransportId.STDIO:
        return new StdioTransport(
          this._options.command ?? this._endpoint.toString().replace('stdio://', ''),
          this._options.args ?? [],
          { ...opts, env: this._options.env ?? {}, cwd: this._options.cwd }
        );

      case TransportId.WEBSOCKET:
        return new WebSocketTransport(this._endpoint, {
          ...opts,
          protocols: this._options.protocols ?? [],
        });

      default:
        throw new Error(`Unknown transport type: ${type}`);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** @returns {boolean} Whether the transport is connected */
  get connected() { return this._transport?.connected ?? false; }

  /** @returns {string|null} Resolved transport type */
  get transportType() { return this._resolvedType; }

  /** @returns {string|null} MCP session ID (Streamable HTTP only) */
  get sessionId() { return this._transport?.sessionId ?? null; }

  /**
   * Convenience helper: send a JSON-RPC request and wait for response.
   *
   * @param {string} method
   * @param {Object} [params]
   * @param {string|number} [id]
   * @returns {Promise<Object>}
   */
  async request(method, params, id = Date.now()) {
    const msg = serializeRequest(method, params, id);
    return this.send(msg);
  }
}

export default MCPTransportAdapter;
