/**
 * ============================================================================
 * Heady Liquid Architecture v3.1 — Redis Pool Configuration
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * ============================================================================
 *
 * Redis serves as the real-time state bus for the Heady platform:
 *
 *   1. Agent Heartbeat Store — agents publish heartbeats to Redis;
 *      the conductor reads them for liveness detection.
 *   2. Task Queue Cache — hot tasks are cached in Redis for sub-ms dequeue
 *      before falling back to the Postgres task_queue table.
 *   3. Session State — ephemeral session data for API requests.
 *   4. Pub/Sub Bus — inter-agent communication and swarm events.
 *   5. Rate Limiting — API and LLM request rate limiting.
 *   6. Lock Store — distributed locks for swarm consensus.
 *   7. Vector Cache — frequently-accessed embeddings cached for speed.
 *
 * Deployment:
 *   - Local: Redis 7 Alpine via Docker Compose (port 6379)
 *   - Production: Google Memorystore for Redis (1GB BASIC tier)
 *
 * Connection:
 *   All connections go through ioredis with lazy connect, automatic
 *   reconnection (phi-based backoff), and cluster-aware routing.
 * ============================================================================
 */

'use strict';

const Redis = require('ioredis');

const PHI = (1 + Math.sqrt(5)) / 2; // 1.6180339887...

// ————————————————————————————————————————————————————————————————————————————
// Environment-Based Configuration
// ————————————————————————————————————————————————————————————————————————————

const REDIS_CONFIG = {
  // Connection
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),

  // TLS (for Memorystore / production)
  tls: process.env.REDIS_TLS === 'true' ? {
    rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
  } : undefined,

  // Connection behavior
  lazyConnect: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  maxRetriesPerRequest: 3,

  // Reconnection with phi-based exponential backoff
  retryStrategy(times) {
    if (times > 20) {
      console.error(`[Redis] Max reconnection attempts (${times}) reached. Giving up.`);
      return null; // Stop retrying
    }
    // φ^attempt * 100ms, capped at 30s
    const delay = Math.min(
      Math.round(Math.pow(PHI, times) * 100),
      30000
    );
    console.warn(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },

  // Key prefix for namespace isolation
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'heady:',
};

// ————————————————————————————————————————————————————————————————————————————
// Redis Key Namespaces
// ————————————————————————————————————————————————————————————————————————————

const KEYS = {
  // Agent heartbeats: heady:heartbeat:{tenant_id}:{agent_id}
  HEARTBEAT:       (tenantId, agentId) => `heartbeat:${tenantId}:${agentId}`,
  // Agent state cache: heady:agent:{tenant_id}:{agent_id}
  AGENT_STATE:     (tenantId, agentId) => `agent:${tenantId}:${agentId}`,
  // Task queue hot cache: heady:task:{tenant_id}:{domain}
  TASK_QUEUE:      (tenantId, domain)  => `task:${tenantId}:${domain}`,
  // Swarm state: heady:swarm:{tenant_id}:{swarm_id}
  SWARM_STATE:     (tenantId, swarmId) => `swarm:${tenantId}:${swarmId}`,
  // Session store: heady:session:{session_id}
  SESSION:         (sessionId)         => `session:${sessionId}`,
  // Rate limiter: heady:ratelimit:{tenant_id}:{endpoint}
  RATE_LIMIT:      (tenantId, endpoint) => `ratelimit:${tenantId}:${endpoint}`,
  // Distributed lock: heady:lock:{resource}
  LOCK:            (resource)          => `lock:${resource}`,
  // Vector cache: heady:vcache:{tenant_id}:{vector_id}
  VECTOR_CACHE:    (tenantId, vectorId) => `vcache:${tenantId}:${vectorId}`,
  // Pub/Sub channels
  CHANNEL_SWARM:   (swarmId)           => `ch:swarm:${swarmId}`,
  CHANNEL_SYSTEM:                         'ch:system',
  CHANNEL_ALERTS:                         'ch:alerts',
  // Pipeline state: heady:pipeline:{run_id}
  PIPELINE:        (runId)             => `pipeline:${runId}`,
  // LLM budget tracker: heady:budget:{tenant_id}
  BUDGET:          (tenantId)          => `budget:${tenantId}`,
};

// ————————————————————————————————————————————————————————————————————————————
// TTL Defaults (in seconds)
// ————————————————————————————————————————————————————————————————————————————

const TTL = {
  HEARTBEAT:     Math.round(PHI * 30),     // ~48s — agent heartbeat expiry
  AGENT_STATE:   Math.round(PHI * 60),     // ~97s — cached agent state
  TASK_QUEUE:    Math.round(PHI * 10),     // ~16s — hot task cache
  SWARM_STATE:   Math.round(PHI * 120),    // ~194s — swarm state cache
  SESSION:       3600,                      // 1 hour session TTL
  RATE_LIMIT:    60,                        // 1 minute rate limit window
  LOCK:          Math.round(PHI * 30),     // ~48s — distributed lock TTL
  VECTOR_CACHE:  Math.round(PHI * 300),    // ~485s — vector cache TTL
  PIPELINE:      86400,                     // 24h pipeline state retention
  BUDGET:        86400,                     // 24h budget tracking window
};

// ————————————————————————————————————————————————————————————————————————————
// Connection Pool Factory
// ————————————————————————————————————————————————————————————————————————————

/**
 * Specialized Redis connection pool.
 * Creates separate connections for different concerns to avoid
 * Pub/Sub blocking regular commands.
 */
class RedisPool {
  constructor() {
    this._connections = new Map();
    this._subscriber = null;
    this._publisher = null;
    this._isConnected = false;
  }

  /**
   * Get or create a named Redis connection.
   * Each connection type is isolated for its purpose.
   */
  getConnection(name = 'default') {
    if (this._connections.has(name)) {
      return this._connections.get(name);
    }

    const conn = new Redis({
      ...REDIS_CONFIG,
      connectionName: `heady-${name}`,
    });

    // Event handlers
    conn.on('connect', () => {
      console.log(`[Redis:${name}] Connected to ${REDIS_CONFIG.host}:${REDIS_CONFIG.port}`);
    });
    conn.on('ready', () => {
      console.log(`[Redis:${name}] Ready`);
      this._isConnected = true;
    });
    conn.on('error', (err) => {
      console.error(`[Redis:${name}] Error:`, err.message);
    });
    conn.on('close', () => {
      console.warn(`[Redis:${name}] Connection closed`);
      this._isConnected = false;
    });

    this._connections.set(name, conn);
    return conn;
  }

  /**
   * Get the default command connection.
   */
  get client() {
    return this.getConnection('default');
  }

  /**
   * Get the dedicated Pub/Sub subscriber connection.
   * Pub/Sub connections cannot execute regular commands.
   */
  get subscriber() {
    if (!this._subscriber) {
      this._subscriber = this.getConnection('subscriber');
    }
    return this._subscriber;
  }

  /**
   * Get the dedicated publisher connection.
   */
  get publisher() {
    if (!this._publisher) {
      this._publisher = this.getConnection('publisher');
    }
    return this._publisher;
  }

  /**
   * Connect all pool connections.
   */
  async connect() {
    const promises = [];
    for (const [name, conn] of this._connections) {
      if (conn.status === 'wait') {
        promises.push(conn.connect().catch(err => {
          console.error(`[Redis:${name}] Failed to connect:`, err.message);
        }));
      }
    }
    await Promise.all(promises);
  }

  /**
   * Graceful shutdown — disconnect all connections.
   */
  async disconnect() {
    const promises = [];
    for (const [name, conn] of this._connections) {
      promises.push(
        conn.quit()
          .catch(() => conn.disconnect())
          .catch(err => console.error(`[Redis:${name}] Disconnect error:`, err.message))
      );
    }
    await Promise.all(promises);
    this._connections.clear();
    this._subscriber = null;
    this._publisher = null;
    this._isConnected = false;
    console.log('[Redis] All connections closed');
  }

  /**
   * Health check — verify all connections are alive.
   */
  async healthCheck() {
    const results = {};
    for (const [name, conn] of this._connections) {
      try {
        const start = Date.now();
        await conn.ping();
        results[name] = {
          status: 'healthy',
          latencyMs: Date.now() - start,
        };
      } catch (err) {
        results[name] = {
          status: 'unhealthy',
          error: err.message,
        };
      }
    }
    return results;
  }
}

// ————————————————————————————————————————————————————————————————————————————
// Distributed Lock (Redlock-compatible pattern)
// ————————————————————————————————————————————————————————————————————————————

/**
 * Acquire a distributed lock using Redis SET NX EX.
 * Used by swarm consensus for file locking.
 *
 * @param {string} resource  - Resource to lock
 * @param {string} owner     - Lock owner identifier
 * @param {number} ttlSec    - Lock TTL in seconds
 * @returns {boolean} true if lock acquired
 */
async function acquireLock(client, resource, owner, ttlSec = TTL.LOCK) {
  const key = KEYS.LOCK(resource);
  const result = await client.set(key, owner, 'EX', ttlSec, 'NX');
  return result === 'OK';
}

/**
 * Release a distributed lock (only if owned).
 * Uses Lua script for atomic check-and-delete.
 */
async function releaseLock(client, resource, owner) {
  const key = KEYS.LOCK(resource);
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  const result = await client.eval(script, 1, key, owner);
  return result === 1;
}

/**
 * Extend lock TTL (heartbeat for long operations).
 */
async function extendLock(client, resource, owner, ttlSec = TTL.LOCK) {
  const key = KEYS.LOCK(resource);
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("expire", KEYS[1], ARGV[2])
    else
      return 0
    end
  `;
  const result = await client.eval(script, 1, key, owner, ttlSec);
  return result === 1;
}

// ————————————————————————————————————————————————————————————————————————————
// Rate Limiter (Sliding Window)
// ————————————————————————————————————————————————————————————————————————————

/**
 * Check and increment rate limit using sliding window.
 * @param {Redis} client     - Redis connection
 * @param {string} tenantId  - Tenant identifier
 * @param {string} endpoint  - API endpoint or resource
 * @param {number} maxReqs   - Maximum requests per window
 * @param {number} windowSec - Window size in seconds
 * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
 */
async function checkRateLimit(client, tenantId, endpoint, maxReqs = 100, windowSec = TTL.RATE_LIMIT) {
  const key = KEYS.RATE_LIMIT(tenantId, endpoint);
  const now = Date.now();
  const windowStart = now - (windowSec * 1000);

  const pipeline = client.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);     // Remove expired entries
  pipeline.zadd(key, now, `${now}:${Math.random()}`); // Add current request
  pipeline.zcard(key);                                  // Count requests in window
  pipeline.expire(key, windowSec);                      // Set TTL on the key

  const results = await pipeline.exec();
  const count = results[2][1];

  return {
    allowed: count <= maxReqs,
    remaining: Math.max(0, maxReqs - count),
    resetAt: Math.ceil((now + windowSec * 1000) / 1000),
  };
}

// ————————————————————————————————————————————————————————————————————————————
// Singleton Pool Instance
// ————————————————————————————————————————————————————————————————————————————

const pool = new RedisPool();

module.exports = {
  // Pool
  pool,
  RedisPool,

  // Configuration
  REDIS_CONFIG,
  KEYS,
  TTL,

  // Utilities
  acquireLock,
  releaseLock,
  extendLock,
  checkRateLimit,
};
