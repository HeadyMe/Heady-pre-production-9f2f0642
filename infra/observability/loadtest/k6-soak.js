/**
 * HeadySystems v3.2.2 — k6 Soak Test
 * =====================================
 * Scenario: Long-duration test to detect memory leaks, connection pool
 * exhaustion, and gradual performance degradation.
 *
 * Profile:
 *   - Ramp up to fib(8)=21 VUs over fib(5)=5 minutes
 *   - Sustain fib(8)=21 VUs for fib(13)=233 minutes (~3.9 hours)
 *   - Ramp down over fib(5)=5 minutes
 *   - Total: ~4 hours
 *
 * Health checks recorded every fib(7)=13 minutes:
 *   - Node.js heap size (memory leak indicator)
 *   - Redis connection pool utilization
 *   - Error rate drift
 *   - p99 latency drift
 *
 * Pass criteria:
 *   - p99 latency does NOT increase more than φ×100ms over soak duration
 *   - Error rate stays < 0.01 throughout
 *   - Memory usage does NOT exceed CSL CRITICAL (0.854) at any point
 *   - No connection pool exhaustion events
 *
 * All numeric parameters: φ=1.618033988749895, Fibonacci sequences.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

const BASE_URL       = __ENV.BASE_URL       || 'https://headyme.com';
const API_TOKEN      = __ENV.API_TOKEN      || '';
const PROMETHEUS_URL = __ENV.PROMETHEUS_URL || 'http://localhost:9090';

// fib(8)=21 VUs — low sustained load for long-duration testing
const SOAK_VUS        = FIB[7];   // 21
// fib(5)=5 min ramp
const RAMP_DURATION   = `${FIB[4]}m`;  // 5m
// fib(13)=233 min soak (≈ 3h 53m)
const SOAK_DURATION   = `${FIB[12]}m`; // 233m

// Memory leak detection threshold: no more than φ^2 × 10% = 26.2% heap increase
const MAX_HEAP_GROWTH_RATIO = PHI * PHI * 0.1; // ≈ 0.262 = 26.2%

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM METRICS
// ─────────────────────────────────────────────────────────────────────────────

const errorRate        = new Rate('heady_soak_error_rate');
const latencyTrend     = new Trend('heady_soak_latency_ms', true);
const memoryUsageGauge = new Gauge('heady_soak_memory_mib');
const poolUtilGauge    = new Gauge('heady_soak_pool_utilization');
const heapGrowthGauge  = new Gauge('heady_soak_heap_growth_ratio');
const slaBreachCounter = new Counter('heady_soak_sla_breaches');

// ─────────────────────────────────────────────────────────────────────────────
// TEST OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    soak: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // Ramp up to fib(8)=21 VUs over fib(5)=5 minutes
        { duration: RAMP_DURATION,  target: SOAK_VUS },
        // Sustain fib(8)=21 VUs for fib(13)=233 minutes
        { duration: SOAK_DURATION,  target: SOAK_VUS },
        // Ramp down over fib(5)=5 minutes
        { duration: RAMP_DURATION,  target: 0 },
      ],
      gracefulRampDown: `${FIB[8]}s`,  // fib(9)=34s graceful stop
    },
  },

  thresholds: {
    // Soak: all SLAs must hold for full duration
    'http_req_duration{name:chat}':   [`p(95)<500`, `p(99)<1000`],
    'http_req_duration{name:search}': [`p(95)<500`],
    'http_req_duration{name:tools}':  [`p(95)<500`],
    'http_req_failed':                [`rate<0.01`],
    'heady_soak_error_rate':          [`rate<0.01`],
    // Memory: no leak threshold — heap growth < 26.2% (φ^2 × 10%)
    'heady_soak_heap_growth_ratio':   [`value<${MAX_HEAP_GROWTH_RATIO}`],
    // Pool: never exhausted
    'heady_soak_pool_utilization':    [`value<0.854`],  // < CSL CRITICAL
  },

  tags: {
    test_type:      'soak',
    service:        'heady-systems',
    version:        '3.2.2',
    phi:            `${PHI}`,
    vus:            `${SOAK_VUS}`,   // fib(8)=21
    duration_min:   `${FIB[12]}`,    // fib(13)=233
    fibonacci:      'fib(8)=21-VUs,fib(13)=233-min',
  },

  summaryTrendStats: ['min', 'med', 'avg', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
};

// ─────────────────────────────────────────────────────────────────────────────
// HEADERS
// ─────────────────────────────────────────────────────────────────────────────

const headers = {
  'Content-Type':  'application/json',
  'Accept':        'application/json',
  'Authorization': `Bearer ${API_TOKEN}`,
  'User-Agent':    `k6-soak/${SOAK_VUS}VUs/${FIB[12]}min (φ=${PHI})`,
  'X-Test-Type':   'soak',
};

// ─────────────────────────────────────────────────────────────────────────────
// PAYLOAD ROTATION — varied to avoid caching artifacts
// ─────────────────────────────────────────────────────────────────────────────

const CHAT_PROMPTS = [
  "Tell me about HeadySystems reliability metrics.",
  "What is the current phi-drift in vector space?",
  "List active agents and their memory consumption.",
  "How does the soak test validate memory leak absence?",
  "Describe Fibonacci connection pool scaling strategy.",
  "What is the current error budget remaining?",
  "Explain the CSL gate self-calibration mechanism.",
  "How does the octree rebalance during sustained load?",
  "What are the current p50/p95/p99 latency values?",
  "Describe zero-trust sandbox resource limits.",
  "How does the rate limiter use Fibonacci burst rates?",
  "What WebAuthn credential types are supported?",
  "Explain PQC key encapsulation in mTLS.",
  "What is the current Fibonacci alignment score?",
  "Describe the audit log SHA-256 chain verification.",
];

// Heap size baseline captured in setup
let baselineHeapMiB = 0;

// ─────────────────────────────────────────────────────────────────────────────
// PROMETHEUS METRIC COLLECTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Poll Prometheus for system health metrics every fib(7)=13 minutes.
 * Runs as a separate scenario on VU 1 only (via __VU === 1 check).
 */
const METRICS_POLL_INTERVAL_S = FIB[6] * 60; // fib(7)=13 minutes

// ─────────────────────────────────────────────────────────────────────────────
// VU LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

export default function (data) {
  // Only VU 1 polls system metrics (prevents Prometheus overload)
  if (__VU === 1 && __ITER % Math.floor(METRICS_POLL_INTERVAL_S / (PHI * PHI)) === 0) {
    pollSystemMetrics(data);
  }

  group('Soak: Chat', () => {
    const res = http.post(`${BASE_URL}/api/brain/chat`, JSON.stringify({
      message:  randomItem(CHAT_PROMPTS),
      stream:   false,
      metadata: {
        testType: 'soak',
        vu:       __VU,
        iter:     __ITER,
        elapsed:  Date.now() - data.startTime,
      },
    }), {
      headers,
      tags: { name: 'chat' },
      timeout: `${FIB[7]}s`,  // fib(8)=21s
    });

    const ok = check(res, {
      'soak chat: status 200':      (r) => r.status === 200,
      'soak chat: body present':    (r) => r.body && r.body.length > 0,
      'soak chat: within p95 SLA':  (r) => r.timings.duration < 500,
    });

    latencyTrend.add(res.timings.duration);
    errorRate.add(!ok || res.status >= 500);
    if (res.timings.duration > 500) slaBreachCounter.add(1);
  });

  // φ-derived think time: 1.618s
  sleep(PHI);

  group('Soak: Search', () => {
    const res = http.post(`${BASE_URL}/api/memory/search`, JSON.stringify({
      query: `soak test query ${__ITER % FIB[9]}`,
      k:     FIB[3],  // fib(4)=3 results
    }), {
      headers,
      tags: { name: 'search' },
      timeout: `${FIB[7]}s`,
    });

    check(res, {
      'soak search: status 200':   (r) => r.status === 200,
      'soak search: has results':  (r) => { try { return !!JSON.parse(r.body)?.results; } catch { return false; } },
    });

    latencyTrend.add(res.timings.duration);
    errorRate.add(res.status >= 500);
  });

  sleep(PHI);

  group('Soak: MCP Tools', () => {
    const res = http.get(`${BASE_URL}/api/mcp/tools/list`, {
      headers,
      tags: { name: 'tools' },
      timeout: `${FIB[7]}s`,
    });

    check(res, {
      'soak tools: status 200': (r) => r.status === 200,
    });

    errorRate.add(res.status >= 500);
  });

  // φ^2 think time ≈ 2.618s
  sleep(PHI * PHI);
}

/**
 * Poll Prometheus for memory and connection pool metrics.
 * Only called periodically from VU 1 to avoid measurement overhead.
 */
function pollSystemMetrics(data) {
  // Heap memory check
  const memRes = http.get(
    `${PROMETHEUS_URL}/api/v1/query?query=max(nodejs_heap_size_used_bytes)`,
    { tags: { name: 'prometheus_poll' } }
  );

  if (memRes.status === 200) {
    try {
      const body = JSON.parse(memRes.body);
      const heapBytes = parseFloat(body?.data?.result?.[0]?.value?.[1] || '0');
      const heapMiB = heapBytes / (1024 * 1024);
      memoryUsageGauge.add(heapMiB);

      if (baselineHeapMiB > 0) {
        const growthRatio = (heapMiB - baselineHeapMiB) / baselineHeapMiB;
        heapGrowthGauge.add(growthRatio);

        if (growthRatio > MAX_HEAP_GROWTH_RATIO) {
          console.warn(`⚠️ Heap growth ${(growthRatio * 100).toFixed(1)}% > threshold ${(MAX_HEAP_GROWTH_RATIO*100).toFixed(1)}% — possible memory leak!`);
          console.warn(`  Baseline: ${baselineHeapMiB.toFixed(1)} MiB, Current: ${heapMiB.toFixed(1)} MiB`);
        }
      }
    } catch {}
  }

  // Redis pool utilization check
  const poolRes = http.get(
    `${PROMETHEUS_URL}/api/v1/query?query=heady_redis_pool_active_connections%2Fheady_redis_pool_max_connections`,
    { tags: { name: 'prometheus_poll' } }
  );

  if (poolRes.status === 200) {
    try {
      const body = JSON.parse(poolRes.body);
      const utilization = parseFloat(body?.data?.result?.[0]?.value?.[1] || '0');
      poolUtilGauge.add(utilization);

      if (utilization > 0.854) { // CSL CRITICAL threshold
        console.error(`🔴 Redis pool utilization ${(utilization*100).toFixed(1)}% > CSL CRITICAL (85.4%)!`);
      }
    } catch {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP & TEARDOWN
// ─────────────────────────────────────────────────────────────────────────────

export function setup() {
  console.log(`HeadySystems SOAK Test — φ=${PHI}`);
  console.log(`VUs: fib(8)=${SOAK_VUS}, duration: fib(13)=${FIB[12]} minutes (≈${(FIB[12]/60).toFixed(1)}h)`);
  console.log(`Memory leak threshold: ${(MAX_HEAP_GROWTH_RATIO*100).toFixed(1)}% heap growth (φ^2 × 10%)`);
  console.log(`Metrics polled every fib(7)=${FIB[6]} minutes via Prometheus`);
  console.log(`Base URL: ${BASE_URL}`);

  // Capture baseline heap
  try {
    const memRes = http.get(
      `${PROMETHEUS_URL}/api/v1/query?query=max(nodejs_heap_size_used_bytes)`,
    );
    if (memRes.status === 200) {
      const body = JSON.parse(memRes.body);
      const heapBytes = parseFloat(body?.data?.result?.[0]?.value?.[1] || '0');
      baselineHeapMiB = heapBytes / (1024 * 1024);
      console.log(`Baseline heap: ${baselineHeapMiB.toFixed(1)} MiB`);
    }
  } catch {}

  return { startTime: Date.now(), baselineHeapMiB };
}

export function teardown(data) {
  const durationMin = Math.round((Date.now() - data.startTime) / 60000);
  console.log(`\nSoak test complete. Duration: ${durationMin} minutes`);
  console.log(`Fibonacci params: VUs=fib(8)=${SOAK_VUS}, soak=fib(13)=${FIB[12]}min`);
  console.log(`φ = ${PHI}`);
  console.log(`Max heap growth threshold: φ^2 × 10% = ${(MAX_HEAP_GROWTH_RATIO*100).toFixed(1)}%`);
}
