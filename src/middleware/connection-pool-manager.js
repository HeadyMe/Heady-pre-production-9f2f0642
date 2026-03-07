/**
 * @fileoverview MCP Connection Pool Manager — Phi-Continuous Edition
 *
 * Manages a pool of MCP server connections with configurable min/max/idle
 * settings. Provides transport-aware pooling, heartbeat health monitoring,
 * automatic exponential-backoff reconnection (using the golden-ratio phi
 * for the backoff multiplier), connection warm-up on startup, and rich
 * connection metrics.
 *
 * ── Phi-Math Integration ────────────────────────────────────────────────────
 * All fixed pool size limits, timeout constants, and backoff multipliers are
 * replaced with deterministic values from the shared phi-math module:
 *
 *   min:                 2       → fib(3)  = 2   (unchanged numerically)
 *   max:                10       → fib(7)  = 13  (phi-scaled upward)
 *   idleTimeoutMs:   60_000      → fib(16)*1000/fib(10) ≈ 17 945 ms
 *   maxReconnectAttempts: 10     → fib(7)  = 13
 *   reconnect backoff            → phiBackoff() from shared module
 *   heartbeat interval           → phiAdaptiveInterval() — grows φ when
 *                                   healthy, shrinks ψ when failing
 *
 * The local `const PHI = 1.618…` is removed; all phi usage now comes
 * from the shared module to guarantee a single source of truth.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @module modules/connection-pool-manager
 * @requires @modelcontextprotocol/sdk
 * @requires events
 * @requires shared/phi-math
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import {
  PHI,
  PSI,
  phiBackoff,
  phiAdaptiveInterval,
  fib,
} from '../../shared/phi-math.js';

// ─── Constants ────────────────────────────────────────────────────────────────

// NOTE: `const PHI = 1.618…` removed — PHI now imported from shared/phi-math.js

/** Pool connection states */
export const ConnectionState = Object.freeze({
  CONNECTING: 'connecting',
  IDLE:       'idle',
  ACTIVE:     'active',
  DRAINING:   'draining',
  CLOSED:     'closed',
  ERROR:      'error',
});

/** Transport types and their pooling strategies */
export const TransportType = Object.freeze({
  SSE:             'sse',
  STREAMABLE_HTTP: 'streamable-http',
  STDIO:           'stdio',
  WEBSOCKET:       'websocket',
});

/**
 * Default pool settings — all values phi/Fibonacci derived.
 *
 * @property {number} min                 fib(3)  = 2   — minimum connections
 * @property {number} max                 fib(7)  = 13  — maximum connections (was 10)
 * @property {number} idleTimeoutMs       fib(16)*1000/fib(10) ≈ 17 945 ms (was 60 000 ms)
 *                                        Ratio fib(16)/fib(10) = 987/55 ≈ 17.945 follows the
 *                                        Fibonacci ratio convergence toward φ.
 * @property {number} acquireTimeoutMs    fib(10)*100 = 5 500 ms (was 5 000 ms, phi-rounded)
 * @property {number} heartbeatIntervalMs fib(11)*1000/fib(7) ≈ 6 846 ms base (was 15 000 ms)
 *                                        Actual cadence is adaptive via phiAdaptiveInterval().
 * @property {number} heartbeatTimeoutMs  fib(8)*100 = 2 100 ms (was 3 000 ms)
 * @property {number} maxReconnectAttempts fib(7) = 13 (was 10)
 * @property {number} reconnectBaseDelayMs fib(8)*10 = 210 ms  (was 500 ms)
 * @property {number} reconnectMaxDelayMs  fib(16)*100 = 98 700 ms (was 60 000 ms; φ-extended)
 */
const POOL_DEFAULTS = Object.freeze({
  min:                   fib(3),                                   // F(3)  = 2
  max:                   fib(7),                                   // F(7)  = 13
  idleTimeoutMs:         Math.round((fib(16) * 1000) / fib(10)),   // ≈ 17 945 ms
  acquireTimeoutMs:      fib(10) * 100,                            // F(10) × 100 = 5 500 ms
  heartbeatIntervalMs:   Math.round((fib(11) * 1000) / fib(7)),    // ≈ 6 846 ms base
  heartbeatTimeoutMs:    fib(8) * 100,                             // F(8)  × 100 = 2 100 ms
  maxReconnectAttempts:  fib(7),                                   // F(7)  = 13
  reconnectBaseDelayMs:  fib(8) * 10,                              // F(8)  × 10  = 210 ms
  reconnectMaxDelayMs:   fib(16) * 100,                            // F(16) × 100 = 98 700 ms
  warmUpOnStart:         true,
});

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} PooledConnection
 * @property {string} id - Unique connection identifier
 * @property {string} serverId - Target MCP server identifier
 * @property {Object} client - MCP SDK Client instance
 * @property {Object} transport - Underlying transport instance
 * @property {ConnectionState} state - Current connection state
 * @property {Date} createdAt - Connection creation timestamp
 * @property {Date} lastUsedAt - Last activity timestamp
 * @property {Date|null} lastHeartbeatAt - Last successful heartbeat
 * @property {number} useCount - Total number of times this connection was used
 * @property {number} reconnectAttempts - Consecutive reconnect attempts
 * @property {string} transportType - Transport type for this connection
 */

/**
 * @typedef {Object} PoolConfig
 * @property {string} serverId - Unique server identifier
 * @property {string} transportType - Transport type
 * @property {Function} transportFactory - Async factory: () => {client, transport}
 * @property {number} [min] - Minimum pool size (default fib(3)=2)
 * @property {number} [max] - Maximum pool size (default fib(7)=13)
 * @property {number} [idleTimeoutMs] - Max idle time before connection eviction
 * @property {number} [acquireTimeoutMs] - Max wait time to acquire connection
 * @property {number} [heartbeatIntervalMs] - Heartbeat check base interval
 * @property {number} [heartbeatTimeoutMs] - Heartbeat response timeout
 * @property {number} [maxReconnectAttempts] - Max consecutive reconnect attempts (default fib(7)=13)
 * @property {number} [reconnectBaseDelayMs] - Initial reconnect backoff delay
 * @property {number} [reconnectMaxDelayMs] - Maximum reconnect backoff delay
 * @property {boolean} [warmUpOnStart] - Pre-create min connections on init
 */

// ─── ConnectionPool ───────────────────────────────────────────────────────────

/**
 * A single server's connection pool.
 *
 * @private
 */
class ConnectionPool extends EventEmitter {
  /**
   * @param {PoolConfig} config
   */
  constructor(config) {
    super();
    this.config = { ...POOL_DEFAULTS, ...config };
    this.serverId = config.serverId;
    this.transportType = config.transportType;

    /** @type {Map<string, PooledConnection>} connectionId → connection */
    this._connections = new Map();

    /** @type {string[]} Connection IDs currently idle */
    this._idle = [];

    /** @type {Array<{resolve: Function, reject: Function, timer: NodeJS.Timeout}>} */
    this._waitQueue = [];

    /** @type {NodeJS.Timeout|null} */
    this._heartbeatTimer = null;

    /** @type {NodeJS.Timeout|null} */
    this._idleEvictionTimer = null;

    /** @type {boolean} */
    this._destroyed = false;

    /**
     * Current phi-adaptive heartbeat interval (ms).
     * Starts at config.heartbeatIntervalMs and adjusts after each beat:
     *   healthy → grows by φ (up to fib(14)×1000 max)
     *   failing → shrinks by ψ (down to fib(8)×100 min)
     *
     * @type {number}
     */
    this._currentHeartbeatIntervalMs = this.config.heartbeatIntervalMs;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Initialize the pool, optionally warming up minimum connections.
   *
   * Warm-up creates exactly `fib(3)` = 2 connections (the phi-derived
   * minimum), matching the POOL_DEFAULTS.min value.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.config.warmUpOnStart) {
      const warmUpPromises = [];
      for (let i = 0; i < this.config.min; i++) {
        warmUpPromises.push(this._createConnection().catch(err => {
          this.emit('warn', { event: 'warmup_failed', serverId: this.serverId, error: err.message });
        }));
      }
      await Promise.allSettled(warmUpPromises);
    }

    // Start heartbeat monitoring at the current adaptive interval
    this._heartbeatTimer = setInterval(
      () => this._runHeartbeats(),
      this._currentHeartbeatIntervalMs
    );
    this._heartbeatTimer.unref?.();

    // Start idle eviction at half the idle timeout (Fibonacci-derived)
    this._idleEvictionTimer = setInterval(
      () => this._evictIdleConnections(),
      Math.round(this.config.idleTimeoutMs / PHI)   // ÷φ ≈ ×0.618 — checks more often than full interval
    );
    this._idleEvictionTimer.unref?.();

    this.emit('initialized', { serverId: this.serverId, poolSize: this._connections.size });
  }

  /**
   * Drain and destroy the pool, closing all connections.
   *
   * @returns {Promise<void>}
   */
  async destroy() {
    this._destroyed = true;
    if (this._heartbeatTimer)    { clearInterval(this._heartbeatTimer);    this._heartbeatTimer    = null; }
    if (this._idleEvictionTimer) { clearInterval(this._idleEvictionTimer); this._idleEvictionTimer = null; }

    // Reject all waiting acquires
    for (const waiter of this._waitQueue) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error('Pool destroyed'));
    }
    this._waitQueue = [];

    // Close all connections
    const closes = [];
    for (const [id, conn] of this._connections) {
      closes.push(this._closeConnection(id, conn));
    }
    await Promise.allSettled(closes);
    this._connections.clear();
    this._idle = [];
  }

  // ─── Acquire / Release ─────────────────────────────────────────────────────

  /**
   * Acquire a connection from the pool.
   * Returns an idle connection immediately, or creates a new one if below max.
   * Waits in queue if at capacity.
   *
   * @returns {Promise<PooledConnection>}
   * @throws {Error} If no connection available within acquireTimeoutMs
   */
  async acquire() {
    if (this._destroyed) throw new Error(`Pool for ${this.serverId} is destroyed`);

    // Try idle connections first
    while (this._idle.length > 0) {
      const connId = this._idle.shift();
      const conn = this._connections.get(connId);
      if (!conn || conn.state === ConnectionState.CLOSED || conn.state === ConnectionState.ERROR) continue;
      conn.state = ConnectionState.ACTIVE;
      conn.lastUsedAt = new Date();
      conn.useCount++;
      this.emit('connection_acquired', { connId, serverId: this.serverId });
      return conn;
    }

    // Try creating a new connection if below max
    const active = this._activeCount();
    if (this._connections.size < this.config.max) {
      try {
        const conn = await this._createConnection();
        conn.state = ConnectionState.ACTIVE;
        conn.lastUsedAt = new Date();
        conn.useCount++;
        return conn;
      } catch (err) {
        this.emit('error', { event: 'create_failed', serverId: this.serverId, error: err.message });
        // Fall through to waiting
      }
    }

    // Wait for a connection to be released
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this._waitQueue.findIndex(w => w.resolve === resolve);
        if (idx !== -1) this._waitQueue.splice(idx, 1);
        reject(new Error(`Acquire timeout for server ${this.serverId} (${active} active, ${this._connections.size} total)`));
      }, this.config.acquireTimeoutMs);

      this._waitQueue.push({ resolve, reject, timer });
    });
  }

  /**
   * Release a connection back to the pool.
   *
   * @param {PooledConnection} conn
   */
  release(conn) {
    if (!conn || !this._connections.has(conn.id)) return;

    if (conn.state === ConnectionState.CLOSED || conn.state === ConnectionState.ERROR) {
      this._connections.delete(conn.id);
      this._ensureMin();
      return;
    }

    conn.state = ConnectionState.IDLE;
    conn.lastUsedAt = new Date();
    this.emit('connection_released', { connId: conn.id, serverId: this.serverId });

    // Dispatch to waiting acquirer if any
    const waiter = this._waitQueue.shift();
    if (waiter) {
      clearTimeout(waiter.timer);
      conn.state = ConnectionState.ACTIVE;
      conn.useCount++;
      waiter.resolve(conn);
      return;
    }

    this._idle.push(conn.id);
  }

  // ─── Connection Creation ───────────────────────────────────────────────────

  /**
   * Create a new connection using the configured factory.
   *
   * @returns {Promise<PooledConnection>}
   * @private
   */
  async _createConnection() {
    const id  = crypto.randomUUID();
    const now = new Date();

    /** @type {PooledConnection} */
    const conn = {
      id,
      serverId:           this.serverId,
      client:             null,
      transport:          null,
      state:              ConnectionState.CONNECTING,
      createdAt:          now,
      lastUsedAt:         now,
      lastHeartbeatAt:    null,
      useCount:           0,
      reconnectAttempts:  0,
      transportType:      this.transportType,
    };
    this._connections.set(id, conn);

    try {
      const { client, transport } = await this.config.transportFactory();
      conn.client    = client;
      conn.transport = transport;
      conn.state     = ConnectionState.IDLE;
      this._idle.push(id);
      this.emit('connection_created', { connId: id, serverId: this.serverId, transportType: this.transportType });
      return conn;
    } catch (err) {
      conn.state = ConnectionState.ERROR;
      this._connections.delete(id);
      throw err;
    }
  }

  /**
   * Close a single connection.
   *
   * @param {string} connId
   * @param {PooledConnection} conn
   * @returns {Promise<void>}
   * @private
   */
  async _closeConnection(connId, conn) {
    conn.state = ConnectionState.DRAINING;
    try {
      await conn.client?.close?.();
    } catch (_) { /* ignore */ }
    conn.state = ConnectionState.CLOSED;
    this._connections.delete(connId);
    this._idle = this._idle.filter(id => id !== connId);
    this.emit('connection_closed', { connId, serverId: this.serverId });
  }

  // ─── Heartbeat ─────────────────────────────────────────────────────────────

  /**
   * Run heartbeat checks on all idle connections.
   *
   * For stdio transport: check child process is alive.
   * For HTTP/SSE/WS: call listTools as a lightweight ping.
   *
   * After each pass the heartbeat interval is updated via phiAdaptiveInterval():
   *   all healthy → interval × φ (relax, poll less)
   *   any failure → interval × ψ (intensify, poll more)
   *
   * The timer is rescheduled with the new adaptive interval so that the
   * cadence continuously self-tunes.
   *
   * @returns {Promise<void>}
   * @private
   */
  async _runHeartbeats() {
    const idleSnapshot = [...this._idle];
    let anyFailed = false;

    for (const connId of idleSnapshot) {
      const conn = this._connections.get(connId);
      if (!conn || conn.state !== ConnectionState.IDLE) continue;

      try {
        await Promise.race([
          this._heartbeatConnection(conn),
          new Promise((_, r) => setTimeout(() => r(new Error('heartbeat timeout')), this.config.heartbeatTimeoutMs)),
        ]);
        conn.lastHeartbeatAt  = new Date();
        conn.reconnectAttempts = 0;
      } catch (err) {
        anyFailed = true;
        this.emit('heartbeat_failed', { connId, serverId: this.serverId, error: err.message });
        conn.state = ConnectionState.ERROR;
        this._idle = this._idle.filter(id => id !== connId);
        this._scheduleReconnect(conn);
      }
    }

    // Phi-adaptive interval update after the heartbeat pass
    const nextInterval = phiAdaptiveInterval(
      this._currentHeartbeatIntervalMs,
      !anyFailed,
      this.config.heartbeatTimeoutMs * fib(3),  // min = heartbeatTimeout × F(3) ≈ 3× timeout
      fib(14) * 1000,                            // max = F(14)×1000 = 377 000 ms
    );

    if (nextInterval !== this._currentHeartbeatIntervalMs) {
      this._currentHeartbeatIntervalMs = nextInterval;
      // Reschedule timer at new adaptive interval
      if (this._heartbeatTimer) {
        clearInterval(this._heartbeatTimer);
        this._heartbeatTimer = setInterval(() => this._runHeartbeats(), nextInterval);
        this._heartbeatTimer.unref?.();
      }
      this.emit('heartbeat_interval_adjusted', {
        serverId: this.serverId,
        intervalMs: nextInterval,
        healthy: !anyFailed,
      });
    }
  }

  /**
   * Execute a single heartbeat for a connection (transport-specific).
   *
   * @param {PooledConnection} conn
   * @returns {Promise<void>}
   * @private
   */
  async _heartbeatConnection(conn) {
    if (this.transportType === TransportType.STDIO) {
      // For stdio, verify the transport process is still running
      if (conn.transport?.process?.exitCode !== null) {
        throw new Error('stdio process has exited');
      }
    } else {
      // For network transports, use listTools as a lightweight ping
      await conn.client.listTools();
    }
  }

  // ─── Reconnection ──────────────────────────────────────────────────────────

  /**
   * Schedule a reconnect attempt with phi-ratio exponential backoff.
   *
   * Delay formula (from shared phi-math phiBackoff):
   *   delay(attempt) = baseMs × φ^attempt, clamped to maxMs, with ψ² jitter
   *
   * This replaces the previous inline `Math.pow(PHI, attempts)` with the
   * shared phiBackoff() function, which additionally applies φ-jitter to
   * spread reconnect storms.
   *
   * Sequence with baseMs = fib(8)×10 = 210 ms:
   *   attempt 0:  210 ms
   *   attempt 1:  340 ms
   *   attempt 2:  549 ms
   *   attempt 3:  888 ms
   *   attempt 4:  1 436 ms
   *   attempt 5:  2 323 ms
   *   attempt 6:  3 759 ms
   *   attempt 7:  6 082 ms
   *   attempt 12: ≈ 98 700 ms (max, fib(16)×100)
   *
   * @param {PooledConnection} conn
   * @private
   */
  _scheduleReconnect(conn) {
    if (conn.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.emit('reconnect_exhausted', { serverId: this.serverId, connId: conn.id });
      this._connections.delete(conn.id);
      this._ensureMin();
      return;
    }

    /**
     * phiBackoff() replaces:
     *   Math.min(base × φ^attempts, maxDelay)
     * with the identical formula but sourced from the shared module,
     * adding ψ²-jitter (≈±38.2%) to prevent reconnect storms.
     */
    const delay = phiBackoff(
      conn.reconnectAttempts,
      this.config.reconnectBaseDelayMs,
      this.config.reconnectMaxDelayMs,
      true,  // jitter = true
    );

    conn.reconnectAttempts++;
    this.emit('reconnect_scheduled', {
      connId:    conn.id,
      serverId:  this.serverId,
      attempt:   conn.reconnectAttempts,
      delayMs:   Math.round(delay),
    });

    setTimeout(async () => {
      if (this._destroyed) return;
      try {
        const { client, transport } = await this.config.transportFactory();
        conn.client             = client;
        conn.transport          = transport;
        conn.state              = ConnectionState.IDLE;
        conn.lastHeartbeatAt    = new Date();
        if (!this._connections.has(conn.id)) {
          this._connections.set(conn.id, conn);
        }
        this._idle.push(conn.id);
        this.emit('reconnected', { connId: conn.id, serverId: this.serverId });
      } catch (err) {
        this.emit('reconnect_failed', { connId: conn.id, serverId: this.serverId, error: err.message });
        this._scheduleReconnect(conn);
      }
    }, delay);
  }

  // ─── Idle Eviction ─────────────────────────────────────────────────────────

  /**
   * Evict connections that have been idle longer than idleTimeoutMs,
   * while respecting the minimum pool size (fib(3) = 2).
   *
   * @private
   */
  _evictIdleConnections() {
    const now = Date.now();
    const toEvict = [];

    for (const connId of [...this._idle]) {
      const conn = this._connections.get(connId);
      if (!conn) continue;
      const idleMs = now - conn.lastUsedAt.getTime();
      if (idleMs > this.config.idleTimeoutMs) {
        toEvict.push(connId);
      }
    }

    // Keep at least min connections alive
    const keepCount = Math.max(0, this._activeCount() + this._idle.length - toEvict.length - this.config.min);
    const actualEvict = toEvict.slice(0, Math.max(0, toEvict.length - keepCount));

    for (const connId of actualEvict) {
      const conn = this._connections.get(connId);
      if (conn) this._closeConnection(connId, conn);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** @returns {number} Count of currently active (in-use) connections */
  _activeCount() {
    let count = 0;
    for (const [, conn] of this._connections) {
      if (conn.state === ConnectionState.ACTIVE) count++;
    }
    return count;
  }

  /** Ensure we maintain at least `min` connections (fib(3) = 2) */
  _ensureMin() {
    if (this._destroyed) return;
    const deficit = this.config.min - this._connections.size;
    for (let i = 0; i < deficit; i++) {
      this._createConnection().catch(err => {
        this.emit('warn', { event: 'ensure_min_failed', serverId: this.serverId, error: err.message });
      });
    }
  }

  // ─── Metrics ───────────────────────────────────────────────────────────────

  /**
   * Get current pool metrics.
   *
   * @returns {{active: number, idle: number, total: number, waiting: number, serverId: string}}
   */
  getMetrics() {
    const active = this._activeCount();
    return {
      serverId:           this.serverId,
      transportType:      this.transportType,
      active,
      idle:               this._idle.length,
      total:              this._connections.size,
      waiting:            this._waitQueue.length,
      min:                this.config.min,
      max:                this.config.max,
      heartbeatIntervalMs: this._currentHeartbeatIntervalMs,
    };
  }
}

// ─── MCPConnectionPoolManager ─────────────────────────────────────────────────

/**
 * Central manager for all MCP server connection pools.
 *
 * Handles multiple pools (one per server), provides unified acquire/release,
 * aggregated metrics, and lifecycle management.
 *
 * @extends EventEmitter
 *
 * @example
 * ```js
 * const poolManager = new MCPConnectionPoolManager();
 *
 * poolManager.createPool({
 *   serverId: 'github',
 *   transportType: TransportType.STREAMABLE_HTTP,
 *   transportFactory: async () => {
 *     const transport = new StreamableHTTPClientTransport(new URL('https://mcp.example.com/github'));
 *     const client = new Client({ name: 'heady', version: '1.0.0' }, { capabilities: {} });
 *     await client.connect(transport);
 *     return { client, transport };
 *   },
 *   min: fib(3),  // 2
 *   max: fib(7),  // 13
 * });
 *
 * await poolManager.initialize();
 * const conn = await poolManager.acquire('github');
 * try {
 *   const result = await conn.client.callTool({ name: 'create_issue', arguments: {} });
 * } finally {
 *   poolManager.release('github', conn);
 * }
 * ```
 */
export class MCPConnectionPoolManager extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, ConnectionPool>} serverId → pool */
    this._pools = new Map();
    /** @type {boolean} */
    this._initialized = false;
  }

  // ─── Pool Management ────────────────────────────────────────────────────────

  /**
   * Create a new connection pool for a server.
   *
   * @param {PoolConfig} config - Pool configuration
   * @throws {Error} If a pool for this serverId already exists
   */
  createPool(config) {
    if (this._pools.has(config.serverId)) {
      throw new Error(`Pool for server '${config.serverId}' already exists`);
    }
    const pool = new ConnectionPool(config);

    // Bubble up pool events
    pool.on('error',                data => this.emit('pool_error',          data));
    pool.on('connection_created',   data => this.emit('connection_created',  data));
    pool.on('connection_closed',    data => this.emit('connection_closed',   data));
    pool.on('heartbeat_failed',     data => this.emit('heartbeat_failed',    data));
    pool.on('reconnect_scheduled',  data => this.emit('reconnect_scheduled', data));
    pool.on('reconnected',          data => this.emit('reconnected',         data));
    pool.on('reconnect_exhausted',  data => this.emit('reconnect_exhausted', data));
    pool.on('heartbeat_interval_adjusted', data => this.emit('heartbeat_interval_adjusted', data));

    this._pools.set(config.serverId, pool);
  }

  /**
   * Remove and destroy a pool.
   *
   * @param {string} serverId
   * @returns {Promise<void>}
   */
  async removePool(serverId) {
    const pool = this._pools.get(serverId);
    if (!pool) return;
    await pool.destroy();
    this._pools.delete(serverId);
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Initialize all registered pools.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    const inits = [];
    for (const [, pool] of this._pools) {
      inits.push(pool.initialize());
    }
    await Promise.allSettled(inits);
    this._initialized = true;
    this.emit('initialized', { pools: this._pools.size });
  }

  /**
   * Gracefully shut down all pools.
   *
   * @returns {Promise<void>}
   */
  async shutdown() {
    const destroys = [];
    for (const [, pool] of this._pools) {
      destroys.push(pool.destroy());
    }
    await Promise.allSettled(destroys);
    this._pools.clear();
    this._initialized = false;
    this.emit('shutdown', {});
  }

  // ─── Connection Operations ─────────────────────────────────────────────────

  /**
   * Acquire a connection from a named pool.
   *
   * @param {string} serverId - Target server identifier
   * @returns {Promise<PooledConnection>}
   * @throws {Error} If no pool exists for the server
   */
  async acquire(serverId) {
    const pool = this._pools.get(serverId);
    if (!pool) throw new Error(`No connection pool for server: ${serverId}`);
    return pool.acquire();
  }

  /**
   * Release a connection back to its pool.
   *
   * @param {string} serverId - Target server identifier
   * @param {PooledConnection} conn - Connection to release
   */
  release(serverId, conn) {
    const pool = this._pools.get(serverId);
    if (!pool) return;
    pool.release(conn);
  }

  /**
   * Execute an operation with a pooled connection, automatically releasing it.
   *
   * @template T
   * @param {string} serverId - Target server identifier
   * @param {(conn: PooledConnection) => Promise<T>} operation - Operation to run
   * @returns {Promise<T>}
   */
  async withConnection(serverId, operation) {
    const conn = await this.acquire(serverId);
    try {
      return await operation(conn);
    } finally {
      this.release(serverId, conn);
    }
  }

  // ─── Metrics ───────────────────────────────────────────────────────────────

  /**
   * Get metrics for a specific pool.
   *
   * @param {string} serverId
   * @returns {Object|null}
   */
  getPoolMetrics(serverId) {
    return this._pools.get(serverId)?.getMetrics() ?? null;
  }

  /**
   * Get aggregated metrics across all pools.
   *
   * @returns {{
   *   pools: Object[],
   *   totals: {active: number, idle: number, total: number, waiting: number}
   * }}
   */
  getAllMetrics() {
    const pools  = [];
    const totals = { active: 0, idle: 0, total: 0, waiting: 0 };

    for (const [, pool] of this._pools) {
      const m = pool.getMetrics();
      pools.push(m);
      totals.active  += m.active;
      totals.idle    += m.idle;
      totals.total   += m.total;
      totals.waiting += m.waiting;
    }

    return { pools, totals, poolCount: this._pools.size };
  }

  /**
   * Get list of registered server IDs.
   *
   * @returns {string[]}
   */
  getServerIds() {
    return Array.from(this._pools.keys());
  }

  /**
   * Check if a pool exists and has healthy connections.
   *
   * @param {string} serverId
   * @returns {boolean}
   */
  isHealthy(serverId) {
    const pool = this._pools.get(serverId);
    if (!pool) return false;
    const m = pool.getMetrics();
    return m.active + m.idle > 0;
  }
}

export { ConnectionPool, PHI, POOL_DEFAULTS };
export default MCPConnectionPoolManager;
