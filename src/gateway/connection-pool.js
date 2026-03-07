/**
 * Heady MCP Connection Pool Manager
 * ==================================
 * Phi-scaled connection pooling across multiple MCP transports:
 * - Streamable HTTP (2025 spec)
 * - Legacy SSE (2024 spec)
 * - WebSocket (full-duplex)
 * - stdio (local process)
 *
 * @module src/gateway/connection-pool
 * @version 1.0.0
 */

'use strict';

const { EventEmitter } = require('events');
const {
  PHI, PSI, fib, phiBackoff, phiAdaptiveInterval, CSL_THRESHOLDS,
} = require('../../shared/phi-math');

// ── Transport Adapters ──────────────────────────────────────────────────────
class TransportAdapter {
  static create(type, endpoint) {
    switch (type) {
      case 'streamable-http': return new StreamableHTTPAdapter(endpoint);
      case 'legacy-sse':      return new LegacySSEAdapter(endpoint);
      case 'websocket':       return new WebSocketAdapter(endpoint);
      case 'stdio':           return new StdioAdapter(endpoint);
      default: throw new Error(`Unknown transport: ${type}`);
    }
  }
}

class StreamableHTTPAdapter {
  constructor(endpoint) {
    this.endpoint = endpoint;
    this.type = 'streamable-http';
    this._sessionId = null;
  }
  async connect() {
    // POST to endpoint for initialization, GET for SSE stream
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1 }),
    });
    this._sessionId = res.headers.get('mcp-session-id');
    return this;
  }
  async send(request) {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this._sessionId ? { 'mcp-session-id': this._sessionId } : {}),
      },
      body: JSON.stringify(request),
    });
    return res.json();
  }
  async close() { this._sessionId = null; }
  get alive() { return this._sessionId !== null; }
}

class LegacySSEAdapter {
  constructor(endpoint) {
    this.endpoint = endpoint;
    this.type = 'legacy-sse';
    this._messageEndpoint = null;
    this._eventSource = null;
    this._pendingResponses = new Map();
  }
  async connect() {
    return new Promise((resolve, reject) => {
      const { EventSource } = require('eventsource');
      this._eventSource = new EventSource(`${this.endpoint}/sse`);
      this._eventSource.addEventListener('endpoint', (e) => {
        this._messageEndpoint = `${this.endpoint}${e.data}`;
        resolve(this);
      });
      this._eventSource.addEventListener('message', (e) => {
        const msg = JSON.parse(e.data);
        const pending = this._pendingResponses.get(msg.id);
        if (pending) { pending.resolve(msg); this._pendingResponses.delete(msg.id); }
      });
      this._eventSource.onerror = (e) => reject(new Error('SSE connection failed'));
      setTimeout(() => reject(new Error('SSE connect timeout')), fib(7) * 1000);
    });
  }
  async send(request) {
    return new Promise((resolve, reject) => {
      this._pendingResponses.set(request.id, { resolve, reject });
      fetch(this._messageEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      }).catch(reject);
      setTimeout(() => {
        if (this._pendingResponses.has(request.id)) {
          this._pendingResponses.delete(request.id);
          reject(new Error('Request timeout'));
        }
      }, fib(7) * 1000);
    });
  }
  async close() { if (this._eventSource) this._eventSource.close(); }
  get alive() { return this._eventSource?.readyState === 1; }
}

class WebSocketAdapter {
  constructor(endpoint) {
    this.endpoint = endpoint;
    this.type = 'websocket';
    this._ws = null;
    this._pendingResponses = new Map();
  }
  async connect() {
    return new Promise((resolve, reject) => {
      const WebSocket = require('ws');
      this._ws = new WebSocket(this.endpoint);
      this._ws.on('open', () => resolve(this));
      this._ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        const pending = this._pendingResponses.get(msg.id);
        if (pending) { pending.resolve(msg); this._pendingResponses.delete(msg.id); }
      });
      this._ws.on('error', reject);
      setTimeout(() => reject(new Error('WS connect timeout')), fib(7) * 1000);
    });
  }
  async send(request) {
    return new Promise((resolve, reject) => {
      this._pendingResponses.set(request.id, { resolve, reject });
      this._ws.send(JSON.stringify(request));
      setTimeout(() => {
        if (this._pendingResponses.has(request.id)) {
          this._pendingResponses.delete(request.id);
          reject(new Error('Request timeout'));
        }
      }, fib(7) * 1000);
    });
  }
  async close() { if (this._ws) this._ws.close(); }
  get alive() { return this._ws?.readyState === 1; }
}

class StdioAdapter {
  constructor(command) {
    this.command = command;
    this.type = 'stdio';
    this._process = null;
    this._buffer = '';
    this._pendingResponses = new Map();
  }
  async connect() {
    const { spawn } = require('child_process');
    const [cmd, ...cmdArgs] = this.command.split(' ');
    this._process = spawn(cmd, cmdArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
    this._process.stdout.on('data', (chunk) => {
      this._buffer += chunk.toString();
      const lines = this._buffer.split('\n');
      this._buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          const pending = this._pendingResponses.get(msg.id);
          if (pending) { pending.resolve(msg); this._pendingResponses.delete(msg.id); }
        } catch { /* skip non-JSON lines */ }
      }
    });
    return this;
  }
  async send(request) {
    return new Promise((resolve, reject) => {
      this._pendingResponses.set(request.id, { resolve, reject });
      this._process.stdin.write(JSON.stringify(request) + '\n');
      setTimeout(() => {
        if (this._pendingResponses.has(request.id)) {
          this._pendingResponses.delete(request.id);
          reject(new Error('Request timeout'));
        }
      }, fib(7) * 1000);
    });
  }
  async close() { if (this._process) this._process.kill('SIGTERM'); }
  get alive() { return this._process && !this._process.killed; }
}

// ── Connection Pool ─────────────────────────────────────────────────────────
class ConnectionPoolManager extends EventEmitter {
  constructor(serverRegistry) {
    super();
    this.pools = new Map(); // namespace → { connections[], config }
    this._minConnections = fib(3);  // 2
    this._maxConnections = fib(7);  // 13
    this._idleTimeoutMs = fib(11) * 1000; // 89s
    this._maxReconnectAttempts = fib(7); // 13
    this._heartbeatBaseMs = fib(8) * 1000; // 21s

    for (const [namespace, config] of Object.entries(serverRegistry)) {
      this.pools.set(namespace, {
        config,
        available: [],
        inUse: new Set(),
        reconnectAttempts: 0,
        healthScore: 1.0,
      });
    }
  }

  async acquire(namespace) {
    const pool = this.pools.get(namespace);
    if (!pool) throw new Error(`Unknown server namespace: ${namespace}`);

    // Return available connection
    if (pool.available.length > 0) {
      const conn = pool.available.pop();
      if (conn.alive) {
        pool.inUse.add(conn);
        return conn;
      }
      // Dead connection — discard, try next
    }

    // Create new if under max
    if (pool.inUse.size + pool.available.length < this._maxConnections) {
      const conn = await this._createConnection(namespace, pool.config);
      pool.inUse.add(conn);
      return conn;
    }

    // Wait with phi-backoff
    return new Promise((resolve, reject) => {
      const attempt = pool.reconnectAttempts++;
      const timeout = phiBackoff(attempt, 500, fib(7) * 1000);
      setTimeout(async () => {
        try {
          const conn = await this.acquire(namespace);
          resolve(conn);
        } catch (e) { reject(e); }
      }, timeout);
    });
  }

  async release(namespace, connection) {
    const pool = this.pools.get(namespace);
    if (!pool) return;

    pool.inUse.delete(connection);
    pool.reconnectAttempts = 0;

    if (connection.alive && pool.available.length < this._maxConnections) {
      pool.available.push(connection);
    } else {
      await connection.close();
    }
  }

  async _createConnection(namespace, config) {
    const transport = config.transport || 'streamable-http';
    const adapter = TransportAdapter.create(transport, config.endpoint);
    return adapter.connect();
  }

  getPoolSize(namespace) {
    const pool = this.pools.get(namespace);
    if (!pool) return 0;
    return pool.available.length + pool.inUse.size;
  }

  async drainAll() {
    for (const [ns, pool] of this.pools) {
      for (const conn of pool.available) await conn.close();
      for (const conn of pool.inUse) await conn.close();
      pool.available = [];
      pool.inUse.clear();
    }
  }

  // Heartbeat — phi-adaptive interval based on health
  startHeartbeat() {
    this._heartbeatInterval = setInterval(async () => {
      for (const [ns, pool] of this.pools) {
        const healthy = pool.available.filter(c => c.alive).length;
        const total = pool.available.length;
        pool.healthScore = total > 0 ? healthy / total : 0;

        // Remove dead connections
        pool.available = pool.available.filter(c => c.alive);

        // Ensure minimum connections
        while (pool.available.length < this._minConnections) {
          try {
            const conn = await this._createConnection(ns, pool.config);
            pool.available.push(conn);
          } catch { break; }
        }
      }
    }, this._heartbeatBaseMs);
  }

  stopHeartbeat() {
    if (this._heartbeatInterval) clearInterval(this._heartbeatInterval);
  }
}

module.exports = { ConnectionPoolManager, TransportAdapter };
