# Heady™ Redis Pooling Optimization — Multi-Agent Handoff Latency

> Priority: IMMEDIATE | Target: Reduce agent handoff latency by 60%+
> Current: src/resilience/redis-pool.js | Upgrade path defined below

---

## 1. Problem Statement

Multi-agent handoffs via Redis incur unnecessary latency due to:
- Single connection per operation (no pooling)
- No pipelining for batch vector operations
- Missing connection keep-alive / PHI-scaled health checks
- No read replicas for high-read orchestration queries
- Circuit breaker not wired to Redis pool state

---

## 2. Target Architecture

```
┌──────────────────────────────────────────────────┐
│  HeadyConductor / Swarm Agents                    │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │  Redis Pool Manager (PHI-scaled)              │ │
│  │                                                │ │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────┐ │ │
│  │  │ HOT Pool │  │ WARM Pool│  │ COLD Pool  │ │ │
│  │  │ 8 conns  │  │ 5 conns  │  │ 3 conns   │ │ │
│  │  │ Handoffs │  │ Pubsub   │  │ Analytics  │ │ │
│  │  └────┬─────┘  └────┬─────┘  └─────┬──────┘ │ │
│  │       │              │              │         │ │
│  │  ┌────▼──────────────▼──────────────▼──────┐ │ │
│  │  │  Connection Lifecycle (PHI health)       │ │ │
│  │  │  - Keep-alive: φ × 5000ms = 8090ms     │ │ │
│  │  │  - Idle timeout: φ³ × 10000ms = 42360ms│ │ │
│  │  │  - Circuit breaker integration          │ │ │
│  │  └────┬────────────────────────────────────┘ │ │
│  └───────┼──────────────────────────────────────┘ │
│          │                                         │
│  ┌───────▼────────────────────────────────────┐   │
│  │  Redis Cluster / Sentinel                   │   │
│  │  Primary (write) + Read Replicas            │   │
│  └────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

---

## 3. Implementation

### 3.1 PHI-Scaled Redis Pool Manager

File: `src/resilience/redis-pool-v3.js`
```javascript
'use strict';

const Redis = require('ioredis');
const { EventEmitter } = require('events');

const PHI = 1.6180339887;

// Fibonacci-sized pool configuration
const POOL_CONFIG = {
  hot:  { size: 8,  prefix: 'handoff:',  purpose: 'Agent handoffs (latency-critical)' },
  warm: { size: 5,  prefix: 'pubsub:',   purpose: 'Pub/Sub + orchestration state' },
  cold: { size: 3,  prefix: 'analytics:', purpose: 'Telemetry + analytics queries' },
};

// PHI-scaled timing
const TIMING = {
  keepAliveMs:     Math.round(PHI * 5000),      // ~8,090ms
  idleTimeoutMs:   Math.round(PHI * PHI * PHI * 10000), // ~42,360ms
  healthCheckMs:   Math.round(PHI * PHI * 3000), // ~7,854ms
  reconnectBaseMs: 500,                           // PHI-backoff from 500ms
  maxReconnectMs:  Math.round(PHI * PHI * PHI * PHI * PHI * 1000), // ~11,090ms
  pipelineFlushMs: Math.round(PHI * 10),         // ~16ms batch flush
};

class RedisPoolManager extends EventEmitter {
  constructor(redisUrl, options = {}) {
    super();
    this.url = redisUrl;
    this.pools = {};
    this.metrics = {
      totalCommands: 0,
      poolHits: 0,
      poolMisses: 0,
      pipelineBatches: 0,
      avgLatencyMs: 0,
      circuitState: 'CLOSED',
    };
    this.circuitBreaker = {
      failures: 0,
      threshold: 5,  // Fibonacci: 5
      state: 'CLOSED',
      lastFailure: null,
      recoveryMs: TIMING.maxReconnectMs,
    };
    
    this._initPools(options);
  }

  _initPools(options) {
    for (const [tier, config] of Object.entries(POOL_CONFIG)) {
      this.pools[tier] = [];
      for (let i = 0; i < config.size; i++) {
        const conn = new Redis(this.url, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          keepAlive: TIMING.keepAliveMs,
          connectTimeout: 5000,
          lazyConnect: tier === 'cold', // Cold pool connects on demand
          keyPrefix: options.keyPrefix || '',
          retryStrategy: (times) => {
            // PHI-backoff
            const delay = Math.min(
              TIMING.reconnectBaseMs * Math.pow(PHI, times),
              TIMING.maxReconnectMs
            );
            return Math.round(delay);
          },
        });

        conn._tier = tier;
        conn._index = i;
        conn._busy = false;
        conn._lastUsed = Date.now();

        conn.on('error', (err) => this._handleError(tier, i, err));
        conn.on('ready', () => this.emit('connection:ready', { tier, index: i }));

        this.pools[tier].push(conn);
      }
    }

    // Start health check loop
    this._healthCheckInterval = setInterval(
      () => this._healthCheck(),
      TIMING.healthCheckMs
    );
  }

  /**
   * Get a connection from the appropriate pool
   * @param {'hot'|'warm'|'cold'} tier - Pool tier
   * @returns {Redis} Available connection
   */
  acquire(tier = 'hot') {
    if (this.circuitBreaker.state === 'OPEN') {
      throw new Error(`Redis circuit breaker OPEN — retry after ${this.circuitBreaker.recoveryMs}ms`);
    }

    const pool = this.pools[tier];
    if (!pool) throw new Error(`Unknown pool tier: ${tier}`);

    // Find least-recently-used available connection
    let best = null;
    let oldestUse = Infinity;
    for (const conn of pool) {
      if (!conn._busy && conn.status === 'ready') {
        if (conn._lastUsed < oldestUse) {
          oldestUse = conn._lastUsed;
          best = conn;
        }
      }
    }

    if (best) {
      best._busy = true;
      best._lastUsed = Date.now();
      this.metrics.poolHits++;
      return best;
    }

    // Fallback: steal from a lower-priority pool
    const fallbackOrder = tier === 'hot' ? ['warm', 'cold'] : ['cold'];
    for (const fallback of fallbackOrder) {
      for (const conn of this.pools[fallback]) {
        if (!conn._busy && conn.status === 'ready') {
          conn._busy = true;
          conn._lastUsed = Date.now();
          this.metrics.poolMisses++;
          return conn;
        }
      }
    }

    throw new Error('No available Redis connections across all pools');
  }

  /**
   * Release connection back to pool
   */
  release(conn) {
    conn._busy = false;
    conn._lastUsed = Date.now();
  }

  /**
   * Execute a command with automatic pool management
   */
  async exec(tier, command, ...args) {
    const conn = this.acquire(tier);
    const start = Date.now();
    try {
      const result = await conn[command](...args);
      this.metrics.totalCommands++;
      this._updateLatency(Date.now() - start);
      this._circuitSuccess();
      return result;
    } catch (err) {
      this._circuitFailure(err);
      throw err;
    } finally {
      this.release(conn);
    }
  }

  /**
   * Pipeline multiple commands for batch efficiency
   * Reduces round-trips for multi-agent handoff data
   */
  async pipeline(tier, commands) {
    const conn = this.acquire(tier);
    const start = Date.now();
    try {
      const pipe = conn.pipeline();
      for (const [cmd, ...args] of commands) {
        pipe[cmd](...args);
      }
      const results = await pipe.exec();
      this.metrics.totalCommands += commands.length;
      this.metrics.pipelineBatches++;
      this._updateLatency(Date.now() - start);
      this._circuitSuccess();
      return results;
    } catch (err) {
      this._circuitFailure(err);
      throw err;
    } finally {
      this.release(conn);
    }
  }

  /**
   * Pub/Sub for agent handoff notifications
   */
  async subscribe(channel, handler) {
    const conn = this.acquire('warm');
    conn._busy = true; // Keep allocated for subscription
    await conn.subscribe(channel);
    conn.on('message', (ch, message) => {
      if (ch === channel) handler(JSON.parse(message));
    });
    return () => {
      conn.unsubscribe(channel);
      this.release(conn);
    };
  }

  /**
   * Agent handoff — optimized hot-path operation
   */
  async agentHandoff(fromAgent, toAgent, payload) {
    const handoffKey = `handoff:${fromAgent}:${toAgent}:${Date.now()}`;
    const channelKey = `agent:${toAgent}:inbox`;
    
    // Pipeline: store handoff data + notify target agent
    await this.pipeline('hot', [
      ['set', handoffKey, JSON.stringify(payload), 'EX', 300],
      ['publish', channelKey, JSON.stringify({ 
        type: 'handoff',
        from: fromAgent,
        key: handoffKey,
        timestamp: Date.now(),
      })],
      ['hincrby', 'metrics:handoffs', `${fromAgent}:${toAgent}`, 1],
    ]);

    return handoffKey;
  }

  // --- Circuit Breaker ---
  _circuitSuccess() {
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.state = 'CLOSED';
      this.circuitBreaker.failures = 0;
      this.emit('circuit:closed');
    }
  }

  _circuitFailure(err) {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();
    
    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.state = 'OPEN';
      this.metrics.circuitState = 'OPEN';
      this.emit('circuit:open', { error: err.message });
      
      // PHI-scaled recovery timer
      setTimeout(() => {
        this.circuitBreaker.state = 'HALF_OPEN';
        this.metrics.circuitState = 'HALF_OPEN';
        this.emit('circuit:half_open');
      }, this.circuitBreaker.recoveryMs);
    }
  }

  _handleError(tier, index, err) {
    this.emit('error', { tier, index, error: err.message });
  }

  _updateLatency(ms) {
    // Exponential moving average
    this.metrics.avgLatencyMs = this.metrics.avgLatencyMs * 0.9 + ms * 0.1;
  }

  _healthCheck() {
    for (const [tier, pool] of Object.entries(this.pools)) {
      for (const conn of pool) {
        if (conn.status !== 'ready' && !conn._busy) {
          this.emit('health:degraded', { tier, index: conn._index });
        }
        // Reclaim idle connections in cold pool
        if (tier === 'cold' && !conn._busy) {
          const idle = Date.now() - conn._lastUsed;
          if (idle > TIMING.idleTimeoutMs) {
            conn.disconnect();
            this.emit('health:idle_disconnect', { tier, index: conn._index });
          }
        }
      }
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      pools: Object.fromEntries(
        Object.entries(this.pools).map(([tier, pool]) => [
          tier,
          {
            total: pool.length,
            available: pool.filter(c => !c._busy && c.status === 'ready').length,
            busy: pool.filter(c => c._busy).length,
          },
        ])
      ),
      timing: TIMING,
    };
  }

  async shutdown() {
    clearInterval(this._healthCheckInterval);
    for (const pool of Object.values(this.pools)) {
      for (const conn of pool) {
        await conn.quit();
      }
    }
  }
}

module.exports = { RedisPoolManager, POOL_CONFIG, TIMING };
```

---

## 4. Load Test Baseline

File: `tests/load/redis-handoff-k6.js`
```javascript
import redis from 'k6/experimental/redis';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp to 50 VUs
    { duration: '1m',  target: 100 },  // Sustain 100 VUs
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    'redis_handoff_duration': ['p95<50', 'p99<100'],  // ms
    'redis_pipeline_duration': ['p95<20'],
  },
};

const client = new redis.Client('redis://localhost:6379');

export default function () {
  const fromAgent = `agent_${__VU}`;
  const toAgent = `agent_${(__VU % 17) + 1}`;  // 17 swarm agents
  
  const start = Date.now();
  
  client.set(`handoff:${fromAgent}:${toAgent}:${Date.now()}`, JSON.stringify({
    task: 'test_handoff',
    payload: { data: 'test' },
  }));
  
  const duration = Date.now() - start;
  
  check(duration, {
    'handoff < 50ms': (d) => d < 50,
    'handoff < 100ms': (d) => d < 100,
  });
  
  sleep(0.1);
}
```

---

## 5. Migration Path

1. Install ioredis: `npm install ioredis`
2. Drop `src/resilience/redis-pool-v3.js` into monorepo
3. Update HeadyConductor to use `RedisPoolManager` instead of single Redis client
4. Wire `agentHandoff()` into swarm coordinator's handoff path
5. Add `/health` metrics endpoint for pool stats
6. Run load test to validate p95 < 50ms target
7. Monitor in Logic Visualizer dashboard
