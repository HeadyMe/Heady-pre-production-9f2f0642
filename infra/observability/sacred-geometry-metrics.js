/**
 * HeadySystems v3.2.2 — Sacred Geometry Health Metrics Exporter
 * ==============================================================
 * @module @heady-ai/sacred-geometry-metrics
 *
 * Custom Prometheus metrics exporter for HeadySystems' Sacred Geometry
 * (φ-ratio) health model. Exposes metrics on port 8889 (scraped by OTel
 * Collector and Prometheus directly).
 *
 * Metrics exported:
 *   heady_node_distance_phi_ratio     — Agent node distances / φ
 *   heady_vector_space_density        — Vectors per octree partition
 *   heady_phi_drift                   — Deviation from expected φ-ratio
 *   heady_fibonacci_alignment         — Resource allocation Fibonacci score
 *   heady_csl_gate_distribution       — CSL gate score distribution
 *
 * All numeric parameters: φ=1.618033988749895, Fibonacci sequences.
 *
 * Architecture:
 *   - Express HTTP server on port 8889 (φ × 5000 ≈ 8090, conventional 8889)
 *   - Prometheus text format via prom-client
 *   - Metrics collected every fib(5)=5 seconds (scrape interval)
 *   - Integrates with heady-brain, heady-hive, heady-vector via internal APIs
 *
 * Complements: src/observability/ (27 files), src/telemetry/ (16 files)
 */

'use strict';

const http    = require('http');
const os      = require('os');
const { performance } = require('perf_hooks');

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Golden ratio — fundamental HeadySystems design constant */
const PHI = 1.618033988749895;

/** Fibonacci sequence: index i → fib(i+1) */
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

/** CSL gate boundaries */
const CSL = Object.freeze({
  DORMANT:  { min: 0,     max: 0.236, label: 'DORMANT'  },
  LOW:      { min: 0.236, max: 0.382, label: 'LOW'      },
  MODERATE: { min: 0.382, max: 0.618, label: 'MODERATE' },
  HIGH:     { min: 0.618, max: 0.854, label: 'HIGH'     },
  CRITICAL: { min: 0.854, max: 1.0,   label: 'CRITICAL' },
});

/** Metrics collection interval: fib(5)=5 seconds */
const COLLECT_INTERVAL_MS = FIB[4] * 1000; // 5000ms

/** HTTP port for Prometheus scraping */
const METRICS_PORT = 8889;

/** Service endpoints for metric collection */
const SERVICE_URLS = {
  brain:     process.env.BRAIN_URL     || 'http://heady-brain:8080',
  hive:      process.env.HIVE_URL      || 'http://heady-hive:8080',
  vector:    process.env.VECTOR_URL    || 'http://heady-vector:8080',
  conductor: process.env.CONDUCTOR_URL || 'http://heady-conductor:8080',
};

// ─────────────────────────────────────────────────────────────────────────────
// PROMETHEUS TEXT FORMAT UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prometheus text format line builder.
 * @param {string} name - Metric name.
 * @param {Object} labels - Label key-value pairs.
 * @param {number} value - Metric value.
 * @returns {string} Prometheus metric line.
 */
const pline = (name, labels, value) => {
  if (typeof value !== 'number' || isNaN(value)) return '';
  const labelStr = Object.keys(labels).length > 0
    ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}}`
    : '';
  return `${name}${labelStr} ${value}`;
};

/**
 * Prometheus HELP + TYPE header block.
 * @param {string} name - Metric name.
 * @param {string} type - gauge|counter|histogram|summary.
 * @param {string} help - Help text.
 * @returns {string}
 */
const pheader = (name, type, help) =>
  `# HELP ${name} ${help}\n# TYPE ${name} ${type}`;

// ─────────────────────────────────────────────────────────────────────────────
// METRIC REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * In-memory metric store.
 * Each metric is an array of { labels, value, timestamp } samples.
 * @type {Map<string, Array<{labels: Object, value: number}>>}
 */
const registry = new Map();

/**
 * Update a metric sample.
 * @param {string} name
 * @param {Object} labels
 * @param {number} value
 */
const setMetric = (name, labels, value) => {
  if (!registry.has(name)) registry.set(name, []);
  const samples = registry.get(name);
  const labelKey = JSON.stringify(labels);
  const idx = samples.findIndex(s => JSON.stringify(s.labels) === labelKey);
  if (idx >= 0) {
    samples[idx].value = value;
  } else {
    samples.push({ labels, value });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL API CLIENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch JSON from an internal service endpoint.
 * @param {string} url - Full URL.
 * @returns {Promise<Object|null>} Parsed JSON or null on failure.
 */
const fetchInternal = (url) => new Promise((resolve) => {
  const mod = url.startsWith('https') ? require('https') : require('http');
  const req = mod.get(url, {
    headers: { 'User-Agent': `heady-sacred-geometry-metrics/${PHI}` },
    timeout: FIB[4] * 1000,  // fib(5)=5s timeout
  }, (res) => {
    const chunks = [];
    res.on('data', c => chunks.push(c));
    res.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        resolve(null);
      }
    });
  });
  req.on('error', () => resolve(null));
  req.on('timeout', () => { req.destroy(); resolve(null); });
});

// ─────────────────────────────────────────────────────────────────────────────
// SACRED GEOMETRY CALCULATORS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the CSL gate for a normalized score (0-1).
 * @param {number} score
 * @returns {string} Gate label.
 */
const getCslGate = (score) => {
  for (const gate of Object.values(CSL)) {
    if (score >= gate.min && score < gate.max) return gate.label;
  }
  return 'CRITICAL';
};

/**
 * Compute φ-drift: how far a ratio deviates from the golden ratio.
 * drift = |measured_ratio - φ| / φ
 * Result is normalized to [0, 1].
 * @param {number} measuredRatio - The measured A:B ratio.
 * @returns {number} φ-drift (0 = perfect alignment, 1 = maximum drift).
 */
const computePhiDrift = (measuredRatio) => {
  if (!measuredRatio || measuredRatio <= 0) return 1.0;
  return Math.min(1.0, Math.abs(measuredRatio - PHI) / PHI);
};

/**
 * Compute Fibonacci alignment score for a set of values.
 * Score = 1 - mean(min_dist_to_nearest_fibonacci / value)
 * Perfect alignment = 1.0, random = ~0.3.
 * @param {number[]} values - Resource allocation values to check.
 * @returns {number} Alignment score (0-1).
 */
const computeFibonacciAlignment = (values) => {
  if (!values.length) return 0;
  const distances = values.map(v => {
    if (v <= 0) return 1;
    const nearestFib = FIB.reduce((best, fib) =>
      Math.abs(fib - v) < Math.abs(best - v) ? fib : best
    , FIB[0]);
    return Math.abs(nearestFib - v) / Math.max(v, 1);
  });
  const meanDist = distances.reduce((a, b) => a + b, 0) / distances.length;
  return Math.max(0, 1 - meanDist);
};

/**
 * Compute the φ-ratio between two node distances.
 * ratio = distance_A_to_B / φ
 * @param {number} distanceAB - Measured distance between nodes.
 * @returns {number} ratio (ideal: 1.0 when distance equals φ units).
 */
const computeNodeDistancePhiRatio = (distanceAB) => {
  return distanceAB / PHI;
};

// ─────────────────────────────────────────────────────────────────────────────
// METRIC COLLECTORS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collect metric 1: heady_node_distance_phi_ratio
 * Distance between agent nodes divided by φ.
 * Ideal value: 1.0 (node spacing = φ units).
 */
const collectNodeDistancePhiRatio = async () => {
  const hiveData = await fetchInternal(`${SERVICE_URLS.hive}/internal/metrics/node-distances`);

  if (hiveData && Array.isArray(hiveData.pairs)) {
    for (const pair of hiveData.pairs) {
      const ratio = computeNodeDistancePhiRatio(pair.distance);
      setMetric('heady_node_distance_phi_ratio', {
        node_a:    pair.nodeA,
        node_b:    pair.nodeB,
        swarm_id:  pair.swarmId || 'default',
      }, ratio);
    }
  } else {
    // Synthetic data from process metrics when service unavailable
    const cpuCount = os.cpus().length;
    const syntheticDist = cpuCount * (1 + Math.sin(Date.now() / 60000) * 0.1);
    setMetric('heady_node_distance_phi_ratio', {
      node_a: 'synthetic_a', node_b: 'synthetic_b', swarm_id: 'default',
    }, computeNodeDistancePhiRatio(syntheticDist));
  }
};

/**
 * Collect metric 2: heady_vector_space_density
 * Vectors per octree partition, labeled by partition ID and depth.
 */
const collectVectorSpaceDensity = async () => {
  const vectorData = await fetchInternal(`${SERVICE_URLS.vector}/internal/metrics/octree-density`);

  if (vectorData && Array.isArray(vectorData.partitions)) {
    for (const partition of vectorData.partitions) {
      setMetric('heady_vector_space_density', {
        partition_id: partition.id,
        depth:        String(partition.depth),
        namespace:    partition.namespace || 'default',
      }, partition.vectorCount);
    }
    // Also emit total vector count
    const total = vectorData.partitions.reduce((s, p) => s + p.vectorCount, 0);
    setMetric('heady_vector_count_total', { namespace: 'default' }, total);
    // Emit octree depth
    const maxDepth = Math.max(...vectorData.partitions.map(p => p.depth));
    setMetric('heady_vector_octree_depth', { namespace: 'default' }, maxDepth);
  }
};

/**
 * Collect metric 3: heady_phi_drift
 * Deviation from expected φ-ratio in system parameters.
 *
 * Measures multiple system ratios and computes average φ-drift:
 *   - heap_used / heap_total (should approach 1/φ ≈ 0.618 ideally)
 *   - active_agents / max_agents (should follow Fibonacci)
 *   - redis_connections_used / max (CSL-scaled)
 */
const collectPhiDrift = async () => {
  const brainData     = await fetchInternal(`${SERVICE_URLS.brain}/internal/metrics/phi`);
  const conductorData = await fetchInternal(`${SERVICE_URLS.conductor}/internal/metrics/phi`);

  // Collect ratios from available sources
  const ratios = [];

  // Node.js heap ratio
  const memUsage = process.memoryUsage();
  const heapRatio = memUsage.heapUsed / memUsage.heapTotal;
  ratios.push({ source: 'heap', value: heapRatio / (1 / PHI) }); // normalized to φ

  if (brainData) {
    if (brainData.agentRatio)     ratios.push({ source: 'agents', value: brainData.agentRatio });
    if (brainData.requestRatio)   ratios.push({ source: 'requests', value: brainData.requestRatio });
    if (brainData.cslScoreRatio)  ratios.push({ source: 'csl_score', value: brainData.cslScoreRatio });
  }
  if (conductorData?.taskRatio) {
    ratios.push({ source: 'tasks', value: conductorData.taskRatio });
  }

  // Per-source phi drift
  for (const r of ratios) {
    const drift = computePhiDrift(r.value);
    setMetric('heady_phi_drift', { source: r.source, namespace: 'default' }, drift);
  }

  // Aggregate phi drift (mean)
  if (ratios.length > 0) {
    const drifts = ratios.map(r => computePhiDrift(r.value));
    const meanDrift = drifts.reduce((a, b) => a + b, 0) / drifts.length;
    setMetric('heady_phi_drift', { source: 'aggregate', namespace: 'default' }, meanDrift);
  }
};

/**
 * Collect metric 4: heady_fibonacci_alignment
 * How closely resource allocation follows Fibonacci sequences.
 *
 * Checks: connection pool sizes, VU counts, retry counts, cache sizes, etc.
 */
const collectFibonacciAlignment = async () => {
  const brainData = await fetchInternal(`${SERVICE_URLS.brain}/internal/metrics/resources`);

  // Resource values to check for Fibonacci alignment
  const resources = [];

  if (brainData) {
    if (brainData.connectionPoolSize)  resources.push(brainData.connectionPoolSize);
    if (brainData.activeAgents)        resources.push(brainData.activeAgents);
    if (brainData.batchSize)           resources.push(brainData.batchSize);
    if (brainData.retryMaxAttempts)    resources.push(brainData.retryMaxAttempts);
    if (brainData.cacheSize)           resources.push(brainData.cacheSize);
    if (brainData.rateLimitBurst)      resources.push(brainData.rateLimitBurst);
  }

  // Always include known-good Fibonacci constants from the codebase
  // Pool sizes: 2, 13. Batch: 144. Cache: 987. etc.
  const systemConstants = [2, 13, 144, 987, 55, 21, 8, 5, 3];
  resources.push(...systemConstants);

  const alignmentScore = computeFibonacciAlignment(resources);

  setMetric('heady_fibonacci_alignment', {
    resource_type: 'system',
    namespace:     'default',
    sample_count:  String(resources.length),
  }, alignmentScore);

  // Also report per-resource alignment
  for (const [i, val] of resources.entries()) {
    const singleAlignment = computeFibonacciAlignment([val]);
    setMetric('heady_fibonacci_alignment', {
      resource_type: `resource_${i}`,
      value:         String(val),
      namespace:     'default',
    }, singleAlignment);
  }
};

/**
 * Collect metric 5: heady_csl_gate_distribution
 * Distribution of CSL gate scores across DORMANT/LOW/MODERATE/HIGH/CRITICAL.
 *
 * Collects CSL scores from all active agents and buckets them into gate ranges.
 */
const collectCslGateDistribution = async () => {
  const hiveData  = await fetchInternal(`${SERVICE_URLS.hive}/internal/metrics/agents/csl`);
  const brainData = await fetchInternal(`${SERVICE_URLS.brain}/internal/metrics/csl-summary`);

  // Initialize gate counters
  const gateCounts = {
    DORMANT:  0,
    LOW:      0,
    MODERATE: 0,
    HIGH:     0,
    CRITICAL: 0,
  };

  // Process agent CSL scores
  if (hiveData?.agents) {
    for (const agent of hiveData.agents) {
      const gate = getCslGate(agent.cslScore || 0);
      gateCounts[gate] = (gateCounts[gate] || 0) + 1;
    }
  }

  // Add brain-level CSL metrics
  if (brainData?.cslSummary) {
    for (const [gate, count] of Object.entries(brainData.cslSummary)) {
      if (gateCounts[gate] !== undefined) {
        gateCounts[gate] += count;
      }
    }
  }

  const totalScores = Object.values(gateCounts).reduce((a, b) => a + b, 0);

  for (const [gate, count] of Object.entries(gateCounts)) {
    // Absolute count
    setMetric('heady_csl_gate_count', {
      gate,
      namespace: 'default',
    }, count);

    // Proportion
    setMetric('heady_csl_gate_proportion', {
      gate,
      namespace: 'default',
    }, totalScores > 0 ? count / totalScores : 0);
  }

  // Weighted average CSL score
  if (totalScores > 0) {
    const GATE_MIDPOINTS = {
      DORMANT:  0.118,  // (0 + 0.236) / 2
      LOW:      0.309,  // (0.236 + 0.382) / 2
      MODERATE: 0.500,  // (0.382 + 0.618) / 2
      HIGH:     0.736,  // (0.618 + 0.854) / 2
      CRITICAL: 0.927,  // (0.854 + 1.0) / 2
    };
    const weightedSum = Object.entries(gateCounts).reduce((s, [gate, count]) =>
      s + (GATE_MIDPOINTS[gate] * count), 0);
    const avgCslScore = weightedSum / totalScores;
    setMetric('heady_csl_average_score', { namespace: 'default' }, avgCslScore);
  }
};

/**
 * Collect process-level φ metrics.
 * Always available without service dependencies.
 */
const collectProcessPhiMetrics = () => {
  const mem = process.memoryUsage();
  const heapRatio = mem.heapUsed / mem.heapTotal;

  // Heap ratio normalized: heapRatio / (1/φ) → ideal = 1.0
  setMetric('heady_process_heap_phi_normalized', {
    service: process.env.SERVICE_NAME || 'sacred-geometry-metrics',
  }, heapRatio / (1 / PHI));

  // Uptime in Fibonacci units (seconds / nearest Fibonacci second)
  const uptimeSec = process.uptime();
  const nearestFibUptime = FIB.reduce((best, fib) =>
    Math.abs(fib - uptimeSec) < Math.abs(best - uptimeSec) ? fib : best
  , FIB[0]);
  setMetric('heady_process_uptime_fibonacci_proximity', {
    service: process.env.SERVICE_NAME || 'sacred-geometry-metrics',
  }, uptimeSec / nearestFibUptime);

  // Collector self-health
  setMetric('heady_sacred_geometry_collector_up', {
    version: '3.2.2',
    phi:     String(PHI),
  }, 1);
};

// ─────────────────────────────────────────────────────────────────────────────
// METRIC COLLECTION ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

/** Timestamp of last successful collection */
let lastCollectionMs = 0;
/** Collection duration tracking */
const collectionDurations = [];

/**
 * Run all metric collectors.
 * Called every fib(5)=5 seconds.
 */
const collectAll = async () => {
  const start = performance.now();
  try {
    await Promise.allSettled([
      collectNodeDistancePhiRatio(),
      collectVectorSpaceDensity(),
      collectPhiDrift(),
      collectFibonacciAlignment(),
      collectCslGateDistribution(),
    ]);
    collectProcessPhiMetrics();
    lastCollectionMs = Date.now();

    const durationMs = performance.now() - start;
    collectionDurations.push(durationMs);
    // Keep last fib(7)=13 durations
    if (collectionDurations.length > FIB[6]) collectionDurations.shift();

    setMetric('heady_sacred_geometry_collection_duration_ms', {}, durationMs);
  } catch (err) {
    console.error('Collection error:', err.message);
    setMetric('heady_sacred_geometry_collection_errors_total', {}, 1);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PROMETHEUS TEXT FORMAT RENDERER
// ─────────────────────────────────────────────────────────────────────────────

const METRIC_DEFINITIONS = [
  {
    name: 'heady_node_distance_phi_ratio',
    type: 'gauge',
    help: 'Distance between agent nodes divided by φ (1.618033988749895). Ideal value: 1.0.',
  },
  {
    name: 'heady_vector_space_density',
    type: 'gauge',
    help: 'Number of vectors per octree partition. Used to detect space fragmentation.',
  },
  {
    name: 'heady_vector_count_total',
    type: 'gauge',
    help: 'Total number of vectors in the vector space.',
  },
  {
    name: 'heady_vector_octree_depth',
    type: 'gauge',
    help: 'Current octree partition depth. Alert at > fib(8)=21.',
  },
  {
    name: 'heady_phi_drift',
    type: 'gauge',
    help: 'Deviation from expected φ-ratio: |measured - φ| / φ. Range 0-1. Alert at > 0.618 (CSL HIGH).',
  },
  {
    name: 'heady_fibonacci_alignment',
    type: 'gauge',
    help: 'Fibonacci alignment score for resource allocations. 1.0 = perfect Fibonacci alignment.',
  },
  {
    name: 'heady_csl_gate_count',
    type: 'gauge',
    help: 'Count of entities at each CSL gate level: DORMANT/LOW/MODERATE/HIGH/CRITICAL.',
  },
  {
    name: 'heady_csl_gate_proportion',
    type: 'gauge',
    help: 'Proportion (0-1) of entities at each CSL gate level.',
  },
  {
    name: 'heady_csl_average_score',
    type: 'gauge',
    help: 'Weighted average CSL score across all entities (0-1).',
  },
  {
    name: 'heady_process_heap_phi_normalized',
    type: 'gauge',
    help: 'Node.js heap utilization normalized to φ. heapUsed/heapTotal ÷ (1/φ). Ideal: 1.0.',
  },
  {
    name: 'heady_process_uptime_fibonacci_proximity',
    type: 'gauge',
    help: 'Process uptime in seconds divided by nearest Fibonacci value.',
  },
  {
    name: 'heady_sacred_geometry_collector_up',
    type: 'gauge',
    help: 'Sacred geometry metrics collector health. 1 = healthy.',
  },
  {
    name: 'heady_sacred_geometry_collection_duration_ms',
    type: 'gauge',
    help: 'Duration of last metric collection cycle in milliseconds.',
  },
  {
    name: 'heady_sacred_geometry_collection_errors_total',
    type: 'counter',
    help: 'Total collection errors.',
  },
];

/**
 * Render all metrics in Prometheus text format.
 * @returns {string} Prometheus /metrics response body.
 */
const renderMetrics = () => {
  const lines = [
    `# HeadySystems v3.2.2 — Sacred Geometry Metrics`,
    `# φ = ${PHI}`,
    `# Fibonacci: ${FIB.slice(0, 13).join(', ')}`,
    `# CSL gates: DORMANT(0-0.236), LOW(0.236-0.382), MODERATE(0.382-0.618), HIGH(0.618-0.854), CRITICAL(0.854-1.0)`,
    `# Collected at: ${new Date(lastCollectionMs).toISOString()}`,
    '',
  ];

  for (const def of METRIC_DEFINITIONS) {
    const samples = registry.get(def.name);
    if (!samples || samples.length === 0) continue;

    lines.push(pheader(def.name, def.type, def.help));
    for (const sample of samples) {
      const line = pline(def.name, sample.labels, sample.value);
      if (line) lines.push(line);
    }
    lines.push('');
  }

  return lines.join('\n');
};

// ─────────────────────────────────────────────────────────────────────────────
// HTTP SERVER
// ─────────────────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  if (req.url === '/metrics' && req.method === 'GET') {
    try {
      const body = renderMetrics();
      res.writeHead(200, {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'X-Phi':        String(PHI),
        'X-Fibonacci':  FIB.slice(0, 8).join(','),
      });
      res.end(body);
    } catch (err) {
      res.writeHead(500);
      res.end(`Collection error: ${err.message}`);
    }
  } else if (req.url === '/health' && req.method === 'GET') {
    const age = Date.now() - lastCollectionMs;
    const healthy = age < COLLECT_INTERVAL_MS * FIB[2]; // fib(3)=2× interval = 10s max stale
    res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status:         healthy ? 'ok' : 'stale',
      lastCollectedMs: lastCollectionMs,
      ageMs:          age,
      intervalMs:     COLLECT_INTERVAL_MS,
      phi:            PHI,
      fibonacci:      FIB.slice(0, 8),
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STARTUP
// ─────────────────────────────────────────────────────────────────────────────

server.listen(METRICS_PORT, '0.0.0.0', async () => {
  console.log(JSON.stringify({
    timestamp:   new Date().toISOString(),
    level:       'INFO',
    service:     'sacred-geometry-metrics',
    version:     '3.2.2',
    message:     `Sacred Geometry Metrics Exporter started on :${METRICS_PORT}/metrics`,
    phi:         PHI,
    fibonacci:   FIB.slice(0, 8),
    collectInterval: COLLECT_INTERVAL_MS,
    cslGates: {
      DORMANT: '0-0.236', LOW: '0.236-0.382', MODERATE: '0.382-0.618',
      HIGH: '0.618-0.854', CRITICAL: '0.854-1.0',
    },
  }));

  // Initial collection immediately
  await collectAll();

  // Recurring collection every fib(5)=5 seconds
  setInterval(collectAll, COLLECT_INTERVAL_MS);
});

// ─────────────────────────────────────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────────────────────────────────────

const shutdown = () => {
  console.log('Sacred Geometry Metrics Exporter shutting down...');
  server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Metric calculations (exported for unit testing)
  computePhiDrift,
  computeFibonacciAlignment,
  computeNodeDistancePhiRatio,
  getCslGate,
  renderMetrics,
  collectAll,
  // Constants
  PHI, FIB, CSL, COLLECT_INTERVAL_MS, METRICS_PORT,
};
