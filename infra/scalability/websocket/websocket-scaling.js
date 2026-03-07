'use strict';
/**
 * @module websocket-scaling
 * @description WebSocket scaling for HeadySystems with Redis-backed session store
 *
 * Features:
 *   - Sticky sessions via Redis-backed session store
 *   - Redis pub/sub for cross-instance message broadcast
 *   - Connection limits: fib(16)=987 per instance
 *   - Heartbeat every fib(9)=34 seconds
 *   - Auto-reconnect with φ-backoff (client-side code included)
 *   - Graceful migration on instance drain
 *
 * φ = 1.618033988749895
 * fib(16) = 987 connections per instance
 * fib(9)  = 34s heartbeat interval
 */

const EventEmitter = require('events');
const crypto       = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// φ constants
// ─────────────────────────────────────────────────────────────────────────────
const PHI  = 1.618033988749895;
const FIB  = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

const MAX_CONNECTIONS_PER_INSTANCE = FIB[16];   // 987
const HEARTBEAT_INTERVAL_MS        = FIB[9] * 1000;   // 34s
const HEARTBEAT_TIMEOUT_MS         = FIB[7] * 1000;   // 13s — time to respond before dead
const SESSION_TTL_S                = FIB[10] * 60;    // fib(10)=55 min session TTL
const DRAIN_GRACE_MS               = FIB[8] * 1000;   // fib(8)=21s

// ─────────────────────────────────────────────────────────────────────────────
// Redis Session Store
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class RedisSessionStore
 * Stores WebSocket session metadata in Redis for sticky-session routing.
 * Key format: `heady:ws:session:{sessionId}`
 */
class RedisSessionStore {
  /**
   * @param {Object} opts
   * @param {Object} opts.redis         - Connected Redis client
   * @param {string} [opts.namespace]   - Key prefix
   * @param {number} [opts.ttlS]        - Session TTL in seconds
   */
  constructor(opts) {
    this._redis    = opts.redis;
    this.namespace = opts.namespace ?? 'heady:ws:session';
    this.ttlS      = opts.ttlS     ?? SESSION_TTL_S;
  }

  _key(sessionId) { return `${this.namespace}:${sessionId}`; }

  /**
   * Create or refresh a session.
   * @param {string} sessionId
   * @param {Object} data  - { userId, instanceId, connectedAt, metadata }
   * @returns {Promise<void>}
   */
  async set(sessionId, data) {
    await this._redis.set(
      this._key(sessionId),
      JSON.stringify({ ...data, updatedAt: Date.now() }),
      { EX: this.ttlS }
    );
  }

  /**
   * Retrieve session data.
   * @param {string} sessionId
   * @returns {Promise<Object|null>}
   */
  async get(sessionId) {
    const raw = await this._redis.get(this._key(sessionId));
    return raw ? JSON.parse(raw) : null;
  }

  /**
   * Delete a session (on disconnect).
   * @param {string} sessionId
   */
  async delete(sessionId) {
    await this._redis.del(this._key(sessionId));
  }

  /**
   * Refresh TTL to prevent expiry on active sessions.
   * @param {string} sessionId
   */
  async touch(sessionId) {
    await this._redis.expire(this._key(sessionId), this.ttlS);
  }

  /**
   * Get all active sessions for an instance (for drain migration).
   * @param {string} instanceId
   * @returns {Promise<string[]>} Session IDs
   */
  async getByInstance(instanceId) {
    const pattern = `${this.namespace}:*`;
    const keys    = await this._redis.keys(pattern);
    const sessions = [];

    for (const key of keys) {
      const raw = await this._redis.get(key);
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (data.instanceId === instanceId) {
        sessions.push(key.replace(`${this.namespace}:`, ''));
      }
    }
    return sessions;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Redis Pub/Sub Broadcaster
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class WebSocketBroadcaster
 * Redis pub/sub for cross-instance message broadcasting.
 *
 * Channels:
 *   heady:ws:broadcast         — all connected clients
 *   heady:ws:user:{userId}     — specific user
 *   heady:ws:room:{roomId}     — topic/room
 *   heady:ws:instance:{id}     — specific instance
 *
 * @extends EventEmitter
 */
class WebSocketBroadcaster extends EventEmitter {
  static CHANNEL_BROADCAST = 'heady:ws:broadcast';
  static CHANNEL_USER      = (uid) => `heady:ws:user:${uid}`;
  static CHANNEL_ROOM      = (rid) => `heady:ws:room:${rid}`;
  static CHANNEL_INSTANCE  = (iid) => `heady:ws:instance:${iid}`;

  /**
   * @param {Object} opts
   * @param {Object} opts.publisherClient   - Redis client for publishing
   * @param {Object} opts.subscriberClient  - Dedicated subscriber client
   * @param {string} opts.instanceId        - This server instance ID
   */
  constructor(opts) {
    super();
    this._pub        = opts.publisherClient;
    this._sub        = opts.subscriberClient;
    this.instanceId  = opts.instanceId;
    this._handlers   = new Map();   // channel → Set<Function>
  }

  /** Subscribe to relevant channels for this instance */
  async subscribe() {
    const channels = [
      WebSocketBroadcaster.CHANNEL_BROADCAST,
      WebSocketBroadcaster.CHANNEL_INSTANCE(this.instanceId),
    ];

    await this._sub.subscribe(channels, (message, channel) => {
      try {
        const parsed = JSON.parse(message);
        this.emit('message', { channel, ...parsed });
        this._dispatch(channel, parsed);
      } catch (err) {
        this.emit('error', err);
      }
    });
  }

  /** @private Dispatch to registered handlers */
  _dispatch(channel, data) {
    const handlers = this._handlers.get(channel);
    if (handlers) handlers.forEach(h => h(data));

    // Also dispatch wildcard handlers
    const wildcardHandlers = this._handlers.get('*');
    if (wildcardHandlers) wildcardHandlers.forEach(h => h({ channel, ...data }));
  }

  /**
   * Register a handler for a channel pattern.
   * @param {string} channel
   * @param {Function} handler
   */
  on(channel, handler) {
    if (channel === 'message' || channel === 'error') {
      return super.on(channel, handler);
    }
    if (!this._handlers.has(channel)) this._handlers.set(channel, new Set());
    this._handlers.get(channel).add(handler);
    return this;
  }

  /**
   * Publish to the broadcast channel (all instances/clients).
   * @param {Object} data
   */
  async broadcast(data) {
    await this._pub.publish(
      WebSocketBroadcaster.CHANNEL_BROADCAST,
      JSON.stringify({ ...data, fromInstance: this.instanceId, ts: Date.now() })
    );
  }

  /**
   * Publish to a specific user's channel.
   * @param {string} userId
   * @param {Object} data
   */
  async sendToUser(userId, data) {
    await this._pub.publish(
      WebSocketBroadcaster.CHANNEL_USER(userId),
      JSON.stringify({ ...data, targetUserId: userId, fromInstance: this.instanceId, ts: Date.now() })
    );
  }

  /**
   * Publish to a room.
   * @param {string} roomId
   * @param {Object} data
   */
  async sendToRoom(roomId, data) {
    await this._pub.publish(
      WebSocketBroadcaster.CHANNEL_ROOM(roomId),
      JSON.stringify({ ...data, roomId, fromInstance: this.instanceId, ts: Date.now() })
    );
  }

  /**
   * Subscribe to a specific user's messages (on this instance).
   * @param {string} userId
   */
  async subscribeUser(userId) {
    await this._sub.subscribe(
      WebSocketBroadcaster.CHANNEL_USER(userId),
      (message) => {
        try {
          const data = JSON.parse(message);
          this.emit('message', { channel: WebSocketBroadcaster.CHANNEL_USER(userId), ...data });
          this._dispatch(WebSocketBroadcaster.CHANNEL_USER(userId), data);
        } catch (err) {
          this.emit('error', err);
        }
      }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Connection Manager
// ─────────────────────────────────────────────────────────────────────────────

/** Connection states mapped to CSL levels */
const CONNECTION_STATE = {
  CONNECTING: 'CONNECTING',
  ACTIVE:     'ACTIVE',       // CSL MODERATE+
  IDLE:       'IDLE',         // CSL LOW
  DRAINING:   'DRAINING',     // instance shutting down
  CLOSED:     'CLOSED',
};

/**
 * @class HeadyWebSocketConnection
 * Represents a single managed WebSocket connection.
 */
class HeadyWebSocketConnection {
  constructor(ws, opts = {}) {
    this.id          = opts.sessionId ?? crypto.randomUUID();
    this.userId      = opts.userId    ?? null;
    this.ws          = ws;
    this.state       = CONNECTION_STATE.ACTIVE;
    this.rooms       = new Set();
    this.connectedAt = Date.now();
    this.lastPingAt  = null;
    this.lastPongAt  = null;
    this.latencyMs   = 0;
    this.metadata    = opts.metadata ?? {};
    this._alive      = true;
  }

  /** Send a JSON message to this client */
  send(type, data) {
    if (this.ws.readyState !== 1 /* OPEN */) return false;
    try {
      this.ws.send(JSON.stringify({ type, data, ts: Date.now() }));
      return true;
    } catch (_) {
      return false;
    }
  }

  /** Send ping and track latency */
  ping() {
    this._alive    = false;
    this.lastPingAt = Date.now();
    this.ws.ping();
  }

  /** Record pong response */
  pong() {
    this._alive    = true;
    this.lastPongAt = Date.now();
    this.latencyMs  = this.lastPongAt - (this.lastPingAt ?? this.lastPongAt);
  }

  /** Is this connection still alive (responded to last ping)? */
  get isAlive() { return this._alive; }

  toJSON() {
    return {
      id:          this.id,
      userId:      this.userId,
      state:       this.state,
      rooms:       Array.from(this.rooms),
      connectedAt: this.connectedAt,
      latencyMs:   this.latencyMs,
      metadata:    this.metadata,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket Scale Manager
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class WebSocketScaleManager
 * Manages WebSocket connections with:
 *   - Per-instance connection limits (fib(16)=987)
 *   - Heartbeat/ping-pong (fib(9)=34s interval)
 *   - Redis session store for stickiness
 *   - Cross-instance broadcasting
 *   - Graceful drain for instance shutdown
 *
 * @extends EventEmitter
 */
class WebSocketScaleManager extends EventEmitter {
  /**
   * @param {Object} opts
   * @param {Object} opts.redisPublisher   - Redis client (publish)
   * @param {Object} opts.redisSubscriber  - Redis client (subscribe, dedicated)
   * @param {Object} opts.redisData        - Redis client (key/value)
   * @param {string} [opts.instanceId]     - This instance ID
   * @param {number} [opts.maxConnections] - fib(16)=987
   * @param {number} [opts.heartbeatMs]    - fib(9)=34s
   */
  constructor(opts) {
    super();
    this.instanceId     = opts.instanceId  ?? process.env.INSTANCE_ID ?? crypto.randomUUID();
    this.maxConnections = opts.maxConnections ?? MAX_CONNECTIONS_PER_INSTANCE;
    this.heartbeatMs    = opts.heartbeatMs ?? HEARTBEAT_INTERVAL_MS;

    this._connections = new Map();  // sessionId → HeadyWebSocketConnection
    this._isDraining  = false;
    this._heartbeatTimer = null;

    this.sessionStore = new RedisSessionStore({
      redis: opts.redisData,
    });

    this.broadcaster = new WebSocketBroadcaster({
      publisherClient:  opts.redisPublisher,
      subscriberClient: opts.redisSubscriber,
      instanceId:       this.instanceId,
    });

    // Wire broadcaster messages to local connections
    this.broadcaster.on('message', (msg) => this._routeIncomingBroadcast(msg));
  }

  /** Initialize (subscribe to Redis channels) */
  async init() {
    await this.broadcaster.subscribe();
    this._startHeartbeat();
    return this;
  }

  // ───────────────────────────────────────────────
  // Connection Lifecycle
  // ───────────────────────────────────────────────

  /**
   * Accept a new WebSocket connection.
   * @param {WebSocket} ws       - WebSocket instance
   * @param {Object}    request  - HTTP upgrade request
   * @returns {HeadyWebSocketConnection|null}
   */
  async accept(ws, request) {
    // Check capacity
    if (this._connections.size >= this.maxConnections) {
      ws.close(1013, `Instance at capacity (fib(16)=${this.maxConnections})`);
      this.emit('capacity-exceeded', { max: this.maxConnections });
      return null;
    }

    if (this._isDraining) {
      ws.close(1001, 'Instance draining — reconnect to another instance');
      return null;
    }

    const sessionId = request.headers['x-session-id'] ?? crypto.randomUUID();
    const userId    = request.headers['x-user-id']    ?? null;

    const conn = new HeadyWebSocketConnection(ws, { sessionId, userId });
    this._connections.set(sessionId, conn);

    // Store session in Redis
    await this.sessionStore.set(sessionId, {
      instanceId:  this.instanceId,
      userId,
      connectedAt: conn.connectedAt,
    });

    // Subscribe to user-specific channel
    if (userId) {
      await this.broadcaster.subscribeUser(userId);
    }

    // Wire WebSocket events
    ws.on('pong',    ()    => conn.pong());
    ws.on('message', (msg) => this._handleMessage(conn, msg));
    ws.on('close',   ()    => this._handleClose(conn));
    ws.on('error',   (err) => this._handleError(conn, err));

    this.emit('connected', { conn });
    return conn;
  }

  /**
   * Send a message to a specific session.
   * @param {string} sessionId
   * @param {string} type
   * @param {Object} data
   * @returns {Promise<boolean>}
   */
  async send(sessionId, type, data) {
    const local = this._connections.get(sessionId);
    if (local) return local.send(type, data);

    // Not local — route via Redis
    const session = await this.sessionStore.get(sessionId);
    if (!session) return false;

    await this.broadcaster._pub.publish(
      WebSocketBroadcaster.CHANNEL_INSTANCE(session.instanceId),
      JSON.stringify({ action: 'send', sessionId, type, data })
    );
    return true;
  }

  // ───────────────────────────────────────────────
  // Heartbeat
  // ───────────────────────────────────────────────

  /** @private Start heartbeat timer (fib(9)=34s) */
  _startHeartbeat() {
    this._heartbeatTimer = setInterval(async () => {
      const dead = [];
      for (const [sessionId, conn] of this._connections) {
        if (!conn.isAlive) {
          dead.push(sessionId);
        } else {
          conn.ping();
          // Refresh session TTL in Redis
          await this.sessionStore.touch(sessionId).catch(() => {});
        }
      }

      // Terminate dead connections
      for (const sessionId of dead) {
        const conn = this._connections.get(sessionId);
        if (conn) {
          conn.ws.terminate();
          this._removeConnection(sessionId);
          this.emit('connection-timeout', { sessionId });
        }
      }

      this.emit('heartbeat', {
        active:  this._connections.size,
        dead:    dead.length,
        max:     this.maxConnections,
        fill:    this._connections.size / this.maxConnections,
      });
    }, this.heartbeatMs).unref();
  }

  /** @private Handle incoming WebSocket message */
  _handleMessage(conn, rawMsg) {
    try {
      const msg = JSON.parse(rawMsg.toString());
      this.emit('message', { conn, msg });
    } catch (_) {
      this.emit('message-error', { conn, rawMsg: rawMsg.toString() });
    }
  }

  /** @private Handle connection close */
  async _handleClose(conn) {
    await this._removeConnection(conn.id);
    this.emit('disconnected', { conn });
  }

  /** @private Handle connection error */
  _handleError(conn, err) {
    this.emit('error', { conn, err });
  }

  /** @private Remove connection and clean up Redis */
  async _removeConnection(sessionId) {
    const conn = this._connections.get(sessionId);
    if (conn) conn.state = CONNECTION_STATE.CLOSED;
    this._connections.delete(sessionId);
    await this.sessionStore.delete(sessionId).catch(() => {});
  }

  /** @private Route broadcast messages to local connections */
  _routeIncomingBroadcast(msg) {
    const { action, sessionId, type, data, targetUserId } = msg;

    if (action === 'send' && sessionId) {
      const conn = this._connections.get(sessionId);
      if (conn) conn.send(type, data);
      return;
    }

    if (action === 'broadcast') {
      for (const conn of this._connections.values()) {
        conn.send(type, data);
      }
      return;
    }

    if (targetUserId) {
      for (const conn of this._connections.values()) {
        if (conn.userId === targetUserId) conn.send(type, data);
      }
    }
  }

  // ───────────────────────────────────────────────
  // Graceful Drain
  // ───────────────────────────────────────────────

  /**
   * Drain all connections for instance shutdown.
   * Sends migration notice to all clients with φ-backoff reconnect hint.
   * @returns {Promise<void>}
   */
  async drain() {
    this._isDraining = true;
    clearInterval(this._heartbeatTimer);

    const connCount = this._connections.size;
    this.emit('drain-start', { connections: connCount });

    // Notify all clients to reconnect (send migration message)
    for (const conn of this._connections.values()) {
      conn.state = CONNECTION_STATE.DRAINING;
      conn.send('server:migrate', {
        reason:       'instance-drain',
        reconnectMs:  FIB[5] * 1000,    // fib(5)=5s — reconnect after 5s
        phiBackoff:   true,
        message:      'Server maintenance — please reconnect',
      });
    }

    // Wait fib(8)=21s grace period for clients to reconnect
    await new Promise(r => setTimeout(r, DRAIN_GRACE_MS));

    // Force-close any remaining connections
    for (const [sessionId, conn] of this._connections) {
      conn.ws.close(1001, 'Server drain complete');
      await this._removeConnection(sessionId);
    }

    this.emit('drain-complete', { drained: connCount });
  }

  // ───────────────────────────────────────────────
  // Metrics
  // ───────────────────────────────────────────────

  metrics() {
    const activeConns = Array.from(this._connections.values());
    const fillRatio   = this._connections.size / this.maxConnections;

    return {
      timestamp:    new Date().toISOString(),
      instanceId:   this.instanceId,
      phi:          PHI,
      connections: {
        active:     this._connections.size,
        max:        this.maxConnections,       // fib(16)=987
        fillRatio:  Number(fillRatio.toFixed(4)),
        cslLevel:   (() => {
          if (fillRatio < 0.382) return 'NOMINAL';
          if (fillRatio < 0.618) return 'ELEVATED';
          if (fillRatio < 0.854) return 'HIGH';
          return 'CRITICAL';
        })(),
      },
      heartbeat: {
        intervalMs: this.heartbeatMs,          // 34000 (fib9)
        timeoutMs:  HEARTBEAT_TIMEOUT_MS,      // 13000 (fib7)
      },
      latency: {
        avgMs: activeConns.length
          ? Number((activeConns.reduce((s, c) => s + c.latencyMs, 0) / activeConns.length).toFixed(2))
          : 0,
        maxMs: activeConns.length
          ? Math.max(...activeConns.map(c => c.latencyMs))
          : 0,
      },
      isDraining: this._isDraining,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Client-Side Auto-Reconnect Code (φ-backoff)
// Included here for reference; delivered to browser via /ws-client.js endpoint
// ─────────────────────────────────────────────────────────────────────────────

const CLIENT_RECONNECT_SNIPPET = `
// HeadyWebSocket — client-side auto-reconnect with φ-backoff
// φ = 1.618033988749895
// Backoff sequence: 1s, 1.618s, 2.618s, 4.236s, 6.854s, ...

class HeadyWebSocket {
  static PHI = 1.618033988749895;
  static MAX_RETRIES = 8;        // fib(6)=8 reconnect attempts
  static HEARTBEAT_CHECK_MS = 34000; // fib(9)=34s

  constructor(url, protocols) {
    this.url        = url;
    this.protocols  = protocols;
    this.attempt    = 0;
    this._handlers  = {};
    this._ws        = null;
    this._connect();
  }

  _connect() {
    this._ws = new WebSocket(this.url, this.protocols);
    this._ws.onopen    = (e) => { this.attempt = 0; this._emit('open', e); };
    this._ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'server:migrate') {
        const delay = msg.reconnectMs || HeadyWebSocket.PHI * 1000;
        console.log('[HeadyWS] Migration received — reconnecting in', delay, 'ms');
        setTimeout(() => this._reconnect(), delay);
        return;
      }
      this._emit('message', msg);
    };
    this._ws.onclose   = (e) => { if (!e.wasClean) this._reconnect(); this._emit('close', e); };
    this._ws.onerror   = (e) => { this._emit('error', e); };
  }

  _reconnect() {
    if (this.attempt >= HeadyWebSocket.MAX_RETRIES) {
      console.error('[HeadyWS] Max reconnect attempts (fib6=8) reached');
      return;
    }
    const delayMs = Math.round(1000 * Math.pow(HeadyWebSocket.PHI, this.attempt));
    console.log('[HeadyWS] Reconnecting in', delayMs, 'ms (attempt', ++this.attempt, ')');
    setTimeout(() => this._connect(), delayMs);
  }

  on(event, handler) {
    this._handlers[event] = this._handlers[event] || [];
    this._handlers[event].push(handler);
  }

  _emit(event, data) {
    (this._handlers[event] || []).forEach(h => h(data));
  }

  send(type, data) {
    if (this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type, data }));
    }
  }
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  WebSocketScaleManager,
  HeadyWebSocketConnection,
  WebSocketBroadcaster,
  RedisSessionStore,
  CLIENT_RECONNECT_SNIPPET,
  CONNECTION_STATE,
  MAX_CONNECTIONS_PER_INSTANCE,  // 987 (fib16)
  HEARTBEAT_INTERVAL_MS,          // 34000 (fib9)
  HEARTBEAT_TIMEOUT_MS,           // 13000 (fib7)
  SESSION_TTL_S,                  // 3300 (fib10 × 60)
  DRAIN_GRACE_MS,                 // 21000 (fib8)
  PHI,
  FIB,
};
