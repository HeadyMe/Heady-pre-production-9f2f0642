# Heady™ Projection Types

> © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL.

This document describes each of the six projection domains maintained by the Heady™ Projection Service. Each domain is computed by a dedicated HeadyBee on a PHI-scaled polling interval.

---

## Table of Contents

1. [vector-memory](#1-vector-memory)
2. [config](#2-config)
3. [health](#3-health)
4. [telemetry](#4-telemetry)
5. [topology](#5-topology)
6. [task-queue](#6-task-queue)

---

## 1. vector-memory

### What it measures

The state of the platform's embedding vector store. Tracks total vector count, namespace distribution, semantic drift, and cluster topology. Used by the AI inference layer to detect when the vector index needs rebalancing or re-clustering.

### Update frequency

Every ~8,090 ms (5000 × φ). Debounced by 500 ms to coalesce rapid writes.

### Stale after

30,000 ms

### Data schema

```typescript
interface VectorMemoryState {
  /** Total number of embeddings in the index */
  totalVectors: number;

  /** Number of distinct namespaces (e.g. per-tenant partitions) */
  namespaces: number;

  /**
   * Semantic drift score [0.0–1.0].
   * Measures average cosine distance from cluster centroids.
   * > 0.5 triggers an alert.
   */
  driftScore: number;

  /** Number of identified semantic clusters */
  clusterCount: number;

  /** Timestamp of last index compaction */
  lastCompactionAt?: number;

  /** Approximate memory usage of the index (bytes) */
  indexSizeBytes?: number;
}
```

### Example output

```json
{
  "domain":    "vector-memory",
  "version":   128,
  "updatedAt": 1710000000000,
  "state": {
    "totalVectors":    134521,
    "namespaces":      8,
    "driftScore":      0.1847,
    "clusterCount":    34,
    "lastCompactionAt": 1709999100000,
    "indexSizeBytes":  2147483648
  }
}
```

### Alert conditions

| Condition                   | Threshold   | Severity |
|-----------------------------|-------------|----------|
| `driftScore > 0.5`          | 0.50        | warning  |
| `driftScore > 0.8`          | 0.80        | critical |
| `clusterCount < 4`          | 4 clusters  | warning  |
| `totalVectors < 1000`       | 1,000       | info     |

---

## 2. config

### What it measures

The live configuration state of the platform. Detects runtime config drift — when the in-memory configuration diverges from the persisted baseline. Essential for catching hot-patch changes, feature flag flips, or accidental mutations.

### Update frequency

Every 10,000 ms. Debounced by 200 ms.

### Stale after

60,000 ms

### Data schema

```typescript
interface ConfigState {
  /**
   * SHA-256 hash of the current in-memory config.
   * Changes when any config key changes value.
   */
  configHash: string;

  /** Wall-clock timestamp (ms) when config last changed */
  lastChanged: number;

  /**
   * True if configHash differs from the persisted baseline.
   * Triggers immediate alert.
   */
  driftDetected: boolean;

  /** Number of active config watchers (should be ≥ 1) */
  watcherCount: number;

  /** Human-readable name of the active config profile */
  activeProfile?: string;

  /** Array of config keys that have changed since baseline */
  changedKeys?: string[];
}
```

### Example output

```json
{
  "domain":    "config",
  "version":   55,
  "updatedAt": 1710000000000,
  "state": {
    "configHash":    "sha256:a3f8b2c1d9e0f7a6b5c4d3e2f1a0b9c8",
    "lastChanged":   1709998800000,
    "driftDetected": false,
    "watcherCount":  4,
    "activeProfile": "production",
    "changedKeys":   []
  }
}
```

### Alert conditions

| Condition                   | Description                                 | Severity |
|-----------------------------|---------------------------------------------|----------|
| `driftDetected === true`    | Config hash diverged from baseline          | critical |
| `watcherCount < 1`          | No active watchers — blind to future changes| warning  |
| `changedKeys.length > 10`   | High number of simultaneous key changes     | warning  |

---

## 3. health

### What it measures

Aggregate health of all downstream services. Computes an overall health score [0–1] by polling each registered service endpoint and normalising results. The primary signal used by load balancers and alerting.

### Update frequency

Every ~6,180 ms (φ⁶ × 1000). Debounced by 100 ms (lowest debounce — health is critical).

### Stale after

15,000 ms (most aggressive staleness — a 15s-old health score is meaningless)

### Data schema

```typescript
interface HealthState {
  /**
   * Overall health score [0.0–1.0].
   * Computed as mean of individual service scores.
   * < 0.7 triggers a warning; < 0.5 triggers a critical alert.
   */
  overallScore: number;

  /**
   * Per-service status map.
   * Keys are service names; values are one of: 'healthy' | 'degraded' | 'down' | 'unknown'.
   */
  services: Record<string, 'healthy' | 'degraded' | 'down' | 'unknown'>;

  /** Number of services reporting 'healthy' */
  healthyCount?: number;

  /** Number of services reporting 'degraded' */
  degradedCount?: number;

  /** Number of services reporting 'down' */
  downCount?: number;

  /** Timestamp of last full health sweep */
  lastSweepAt?: number;
}
```

### Example output

```json
{
  "domain":    "health",
  "version":   312,
  "updatedAt": 1710000000000,
  "state": {
    "overallScore":  0.92,
    "services": {
      "api":        "healthy",
      "database":   "healthy",
      "cache":      "healthy",
      "pubsub":     "healthy",
      "vector-db":  "healthy"
    },
    "healthyCount":  5,
    "degradedCount": 0,
    "downCount":     0,
    "lastSweepAt":   1710000000000
  }
}
```

### Alert conditions

| Condition                         | Threshold  | Severity |
|-----------------------------------|------------|----------|
| `overallScore < 0.7`              | 0.70       | warning  |
| `overallScore < 0.5`              | 0.50       | critical |
| Any `services[name] === 'down'`   | —          | critical |
| Any `services[name] === 'degraded'` | —        | warning  |

---

## 4. telemetry

### What it measures

Real-time infrastructure metrics: CPU utilisation, memory pressure, and Node.js event loop lag. Used by the autoscaler to make scale-up/down decisions and by the dashboard to visualise system load.

### Update frequency

Every 4,000 ms. No debounce — telemetry is time-sensitive and every sample counts.

### Stale after

10,000 ms

### Data schema

```typescript
interface TelemetryState {
  /** CPU utilisation percentage [0–100] */
  cpuPercent: number;

  /** Heap + RSS memory utilisation percentage [0–100] */
  memPercent: number;

  /**
   * Node.js event loop lag in milliseconds.
   * Measured by scheduling a 0ms timer and recording actual delay.
   * > 30ms = warning; > 100ms = critical.
   */
  eventLoopLag: number;

  /** Heap used (bytes) */
  heapUsedBytes?: number;

  /** Heap total (bytes) */
  heapTotalBytes?: number;

  /** RSS memory (bytes) */
  rssBytes?: number;

  /** Number of active handles (file descriptors, sockets, etc.) */
  activeHandles?: number;

  /** Number of active requests */
  activeRequests?: number;
}
```

### Example output

```json
{
  "domain":    "telemetry",
  "version":   1840,
  "updatedAt": 1710000000000,
  "state": {
    "cpuPercent":     42.3,
    "memPercent":     61.7,
    "eventLoopLag":   8.2,
    "heapUsedBytes":  142606336,
    "heapTotalBytes": 205520896,
    "rssBytes":       251658240,
    "activeHandles":  12,
    "activeRequests": 3
  }
}
```

### Alert conditions

| Condition                      | Threshold  | Severity |
|--------------------------------|------------|----------|
| `cpuPercent > 85`              | 85%        | warning  |
| `cpuPercent > 95`              | 95%        | critical |
| `memPercent > 90`              | 90%        | warning  |
| `memPercent > 98`              | 98%        | critical |
| `eventLoopLag > 30`            | 30ms       | warning  |
| `eventLoopLag > 100`           | 100ms      | critical |

---

## 5. topology

### What it measures

The live agent graph of the Heady swarm. Discovers all registered agents, maps connection edges, and identifies orphan nodes (agents with no connections). Used by HeadyConductor for routing decisions and swarm rebalancing.

### Update frequency

Every 15,000 ms. Debounced by 1,000 ms — topology is expensive to recompute.

### Stale after

120,000 ms (topology changes slowly; 2-minute staleness is acceptable)

### Data schema

```typescript
interface TopologyState {
  /** Total number of registered agents */
  agentCount: number;

  /** Number of agents with zero connections (orphans) */
  orphanCount: number;

  /** Total number of bidirectional connection edges */
  connectionCount: number;

  /**
   * Adjacency list — array of [fromIndex, toIndex] pairs.
   * Indices reference agents in the agents array.
   */
  connections: [number, number][];

  /** Array of agent descriptors */
  agents?: Array<{
    id:       string;
    name:     string;
    domain:   string;
    status:   string;
    priority: number;
  }>;

  /** ISO timestamp of last full topology discovery */
  discoveredAt?: string;
}
```

### Example output

```json
{
  "domain":    "topology",
  "version":   18,
  "updatedAt": 1710000000000,
  "state": {
    "agentCount":      12,
    "orphanCount":     0,
    "connectionCount": 18,
    "connections": [[0,1],[0,2],[1,3],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,0]],
    "agents": [
      { "id": "bee-001", "name": "health-bee",       "domain": "health",       "status": "healthy", "priority": 1.0 },
      { "id": "bee-002", "name": "config-bee",        "domain": "config",       "status": "healthy", "priority": 0.9 }
    ],
    "discoveredAt": "2024-03-10T00:00:00.000Z"
  }
}
```

### Alert conditions

| Condition               | Description                                     | Severity |
|-------------------------|-------------------------------------------------|----------|
| `orphanCount > 0`       | Disconnected agents cannot receive work         | warning  |
| `agentCount < 1`        | Swarm is empty — no work will be done           | critical |
| `agentCount < 3`        | Swarm is understaffed                           | warning  |

---

## 6. task-queue

### What it measures

The state of the distributed task queue: pending jobs, processing throughput, stalled workers, and backlog depth. Used by the scheduler to pace new task submissions and detect processing failures.

### Update frequency

Every 5,000 ms. Debounced by 250 ms.

### Stale after

20,000 ms

### Data schema

```typescript
interface TaskQueueState {
  /** Number of tasks currently waiting to be processed */
  queueDepth: number;

  /**
   * Tasks completed per second (rolling 60s average).
   * < 1 task/s when queue is non-empty = warning.
   */
  throughput: number;

  /**
   * Number of tasks that have exceeded their processing deadline
   * without completing or failing.
   */
  stalledTasks: number;

  /**
   * Total number of tasks deferred to the backlog
   * (waiting for capacity before entering the active queue).
   */
  backlog: number;

  /** Number of tasks processed in the last polling window */
  completedInWindow?: number;

  /** Number of tasks that failed in the last polling window */
  failedInWindow?: number;

  /** Oldest task age in the queue (ms) */
  oldestTaskAgeMs?: number;

  /** P95 task processing latency (ms) */
  p95LatencyMs?: number;
}
```

### Example output

```json
{
  "domain":    "task-queue",
  "version":   892,
  "updatedAt": 1710000000000,
  "state": {
    "queueDepth":        23,
    "throughput":        18.4,
    "stalledTasks":      0,
    "backlog":           7,
    "completedInWindow": 92,
    "failedInWindow":    1,
    "oldestTaskAgeMs":   4200,
    "p95LatencyMs":      340
  }
}
```

### Alert conditions

| Condition                      | Threshold   | Severity |
|-------------------------------|-------------|----------|
| `queueDepth > 500`             | 500         | warning  |
| `queueDepth > 1000`            | 1,000       | critical |
| `stalledTasks > 10`            | 10          | warning  |
| `stalledTasks > 50`            | 50          | critical |
| `throughput < 1` (queue > 0)   | 1 task/s    | warning  |
| `p95LatencyMs > 5000`          | 5,000ms     | warning  |
| `oldestTaskAgeMs > 300000`     | 5 minutes   | critical |

---

## Common Fields

Every projection — regardless of domain — includes these top-level fields:

| Field       | Type     | Description                                              |
|-------------|----------|----------------------------------------------------------|
| `domain`    | string   | Projection domain name (ProjectionType enum value)       |
| `version`   | number   | Monotonically increasing update counter                  |
| `state`     | object   | Domain-specific state payload (documented above)         |
| `prev`      | object\|null | Previous state snapshot (null on first update)       |
| `updatedAt` | number   | Unix timestamp (ms) of most recent update                |

---

## SSE Event Format

Each domain fires a named SSE event:

```
event: health
data: {"domain":"health","version":312,"state":{...},"prev":{...},"updatedAt":1710000000000}

event: telemetry
data: {"domain":"telemetry","version":1840,"state":{...},"updatedAt":1710000000000}
```

Subscribe to a specific domain:
```javascript
const es = new EventSource('/api/projections/sse');
es.addEventListener('health', (e) => {
  const projection = JSON.parse(e.data);
  console.log(projection.state.overallScore);
});
```

---

*PHI = 1.6180339887 — all polling intervals derive from the golden ratio.*
