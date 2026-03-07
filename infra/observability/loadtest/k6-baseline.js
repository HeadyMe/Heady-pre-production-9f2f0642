/**
 * HeadySystems v3.2.2 — k6 Baseline Load Test
 * =============================================
 * Scenario: Sustained baseline load with gradual ramp-up.
 *
 * Profile:
 *   - Ramp up to fib(10)=55 VUs over fib(5)=5 minutes
 *   - Sustain fib(10)=55 VUs for fib(8)=21 minutes
 *   - Ramp down over fib(5)=5 minutes
 *   - Total duration: ≈ 31 minutes
 *
 * Endpoints:
 *   - POST /api/brain/chat
 *   - POST /api/memory/search
 *   - GET  /api/mcp/tools/list
 *
 * Pass criteria:
 *   - p95 latency < 500ms
 *   - error rate < 1%
 *   - p99 latency < 1000ms
 *
 * All numeric parameters: φ=1.618033988749895, Fibonacci sequences.
 *
 * Usage:
 *   k6 run k6-baseline.js --env BASE_URL=https://headyme.com
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — φ and Fibonacci
// ─────────────────────────────────────────────────────────────────────────────

const PHI  = 1.618033988749895;
const FIB  = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// fib(10)=55 VUs — target steady state
const TARGET_VUS      = FIB[9];   // 55
// fib(5)=5 minutes ramp time
const RAMP_DURATION   = `${FIB[4]}m`;  // "5m"
// fib(8)=21 minutes sustain
const SUSTAIN_DURATION = `${FIB[7]}m`; // "21m"

// SLA thresholds
const P95_SLA_MS  = 500;   // p95 < 500ms
const P99_SLA_MS  = 1000;  // p99 < 1000ms (φ^2 × 382ms ≈ 1000ms)
const ERROR_RATE_SLA = 0.01; // < 1% errors

// Think time between requests: φ^0..φ^2 seconds (1s, 1.618s, 2.618s)
const THINK_TIME_BASES = [1, PHI, PHI * PHI];

const BASE_URL = __ENV.BASE_URL || 'https://headyme.com';
const API_TOKEN = __ENV.API_TOKEN || '';

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM METRICS
// ─────────────────────────────────────────────────────────────────────────────

const errorRate       = new Rate('heady_error_rate');
const chatLatency     = new Trend('heady_chat_latency_ms', true);
const searchLatency   = new Trend('heady_search_latency_ms', true);
const toolListLatency = new Trend('heady_tool_list_latency_ms', true);
const totalRequests   = new Counter('heady_total_requests');

// ─────────────────────────────────────────────────────────────────────────────
// TEST OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    baseline: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // Ramp up over fib(5)=5 minutes to fib(10)=55 VUs
        { duration: RAMP_DURATION,    target: TARGET_VUS },
        // Sustain fib(10)=55 VUs for fib(8)=21 minutes
        { duration: SUSTAIN_DURATION, target: TARGET_VUS },
        // Ramp down over fib(5)=5 minutes
        { duration: RAMP_DURATION,    target: 0 },
      ],
      gracefulRampDown: `${FIB[7]}s`,  // fib(8)=21s graceful shutdown
    },
  },

  thresholds: {
    // SLA thresholds — test fails if these are breached
    'http_req_duration{name:chat}':     [`p(95)<${P95_SLA_MS}`, `p(99)<${P99_SLA_MS}`],
    'http_req_duration{name:search}':   [`p(95)<${P95_SLA_MS}`, `p(99)<${P99_SLA_MS}`],
    'http_req_duration{name:tools}':    [`p(95)<${P95_SLA_MS}`, `p(99)<${P99_SLA_MS}`],
    'http_req_failed':                  [`rate<${ERROR_RATE_SLA}`],
    'heady_error_rate':                 [`rate<${ERROR_RATE_SLA}`],
    // Custom latency assertions
    'heady_chat_latency_ms':            [`p(95)<${P95_SLA_MS}`, `p(99)<${P99_SLA_MS}`],
    'heady_search_latency_ms':          [`p(95)<${P95_SLA_MS}`],
    'heady_tool_list_latency_ms':       [`p(95)<${P95_SLA_MS}`],
  },

  // Tags for result identification
  tags: {
    test_type:   'baseline',
    service:     'heady-systems',
    version:     '3.2.2',
    phi:         `${PHI}`,
    vus_target:  `${TARGET_VUS}`,  // fib(10)=55
    fibonacci:   'fib(10)=55-VUs,fib(5)=5m-ramp,fib(8)=21m-sustain',
  },

  // Prometheus remote write (if available)
  ...((__ENV.PROMETHEUS_RW_URL) && {
    ext: {
      loadimpact: {
        projectID: __ENV.K6_PROJECT_ID || '',
      },
    },
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST PAYLOADS
// ─────────────────────────────────────────────────────────────────────────────

/** Rotating chat prompts — varied to avoid cache bias */
const CHAT_PROMPTS = [
  "What is the current status of the heady-brain service?",
  "Explain the φ-ratio alignment in HeadySystems architecture.",
  "List the active bee agents and their current CSL gate levels.",
  "What Fibonacci value represents the MCP connection pool maximum?",
  "Describe the Sacred Geometry Consciousness Level framework.",
  "How does the zero-trust sandbox protect MCP tool execution?",
  "What is the WebAuthn authentication flow for HeadyOS?",
  "Explain octree partitioning in the vector memory space.",
];

/** Rotating search queries */
const SEARCH_QUERIES = [
  { query: "agent orchestration fibonacci", k: FIB[2] },  // k=2
  { query: "CSL gate transitions phi ratio", k: FIB[3] },  // k=3
  { query: "MCP tool execution sandbox", k: FIB[4] },      // k=5
  { query: "Redis connection pool management", k: FIB[5] }, // k=8
  { query: "vector space density octree", k: FIB[2] },      // k=2
];

// ─────────────────────────────────────────────────────────────────────────────
// COMMON HEADERS
// ─────────────────────────────────────────────────────────────────────────────

const headers = {
  'Content-Type':  'application/json',
  'Accept':        'application/json',
  'Authorization': `Bearer ${API_TOKEN}`,
  'User-Agent':    `k6-baseline/${TARGET_VUS}VUs (φ=${PHI})`,
  'X-Test-Type':   'baseline',
};

// ─────────────────────────────────────────────────────────────────────────────
// VU LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

export default function () {
  const vuCorrelationId = `k6-base-vu${__VU}-iter${__ITER}`;

  group('HeadyBrain Chat', () => {
    const payload = JSON.stringify({
      message:  randomItem(CHAT_PROMPTS),
      stream:   false,
      metadata: { correlationId: vuCorrelationId, phi: PHI },
    });

    const res = http.post(`${BASE_URL}/api/brain/chat`, payload, {
      headers,
      tags: { name: 'chat' },
    });

    const ok = check(res, {
      'chat: status 200':             (r) => r.status === 200,
      'chat: has response body':      (r) => r.body && r.body.length > 0,
      'chat: response has message':   (r) => { try { return !!JSON.parse(r.body)?.message; } catch { return false; } },
      [`chat: p95 < ${P95_SLA_MS}ms`]: (r) => r.timings.duration < P95_SLA_MS,
    });

    chatLatency.add(res.timings.duration);
    errorRate.add(!ok);
    totalRequests.add(1);
  });

  // φ-derived think time between requests
  sleep(THINK_TIME_BASES[Math.floor(Math.random() * THINK_TIME_BASES.length)]);

  group('Memory Search', () => {
    const query = randomItem(SEARCH_QUERIES);
    const payload = JSON.stringify({
      query:   query.query,
      k:       query.k,
      filters: { namespace: 'default' },
    });

    const res = http.post(`${BASE_URL}/api/memory/search`, payload, {
      headers,
      tags: { name: 'search' },
    });

    const ok = check(res, {
      'search: status 200':          (r) => r.status === 200,
      'search: results array':       (r) => { try { return Array.isArray(JSON.parse(r.body)?.results); } catch { return false; } },
      [`search: p95 < ${P95_SLA_MS}ms`]: (r) => r.timings.duration < P95_SLA_MS,
    });

    searchLatency.add(res.timings.duration);
    errorRate.add(!ok);
    totalRequests.add(1);
  });

  sleep(THINK_TIME_BASES[0]); // 1s think time between groups

  group('MCP Tools List', () => {
    const res = http.get(`${BASE_URL}/api/mcp/tools/list`, {
      headers,
      tags: { name: 'tools' },
    });

    const ok = check(res, {
      'tools: status 200':       (r) => r.status === 200,
      'tools: has tools array':  (r) => { try { return Array.isArray(JSON.parse(r.body)?.tools); } catch { return false; } },
      [`tools: p95 < ${P95_SLA_MS}ms`]: (r) => r.timings.duration < P95_SLA_MS,
    });

    toolListLatency.add(res.timings.duration);
    errorRate.add(!ok);
    totalRequests.add(1);
  });

  // φ^2 think time ≈ 2.618s after full iteration
  sleep(PHI * PHI);
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP & TEARDOWN
// ─────────────────────────────────────────────────────────────────────────────

export function setup() {
  console.log(`HeadySystems Baseline Load Test — φ=${PHI}`);
  console.log(`Target: fib(10)=${TARGET_VUS} VUs, ramp ${RAMP_DURATION}, sustain ${SUSTAIN_DURATION}`);
  console.log(`SLA: p95 < ${P95_SLA_MS}ms, p99 < ${P99_SLA_MS}ms, error < ${ERROR_RATE_SLA*100}%`);
  console.log(`Base URL: ${BASE_URL}`);

  // Warm-up check
  const health = http.get(`${BASE_URL}/health/live`);
  if (health.status !== 200) {
    console.error(`⚠️ Health check failed (${health.status}). Test may fail.`);
  } else {
    console.log('✓ Health check passed — starting test.');
  }

  return { startTime: Date.now(), baseUrl: BASE_URL };
}

export function teardown(data) {
  const durationMs = Date.now() - data.startTime;
  console.log(`\nBaseline test complete.`);
  console.log(`Total duration: ${Math.round(durationMs / 1000)}s`);
  console.log(`Fibonacci params: VUs=fib(10)=${TARGET_VUS}, ramp=fib(5)=5m, sustain=fib(8)=21m`);
  console.log(`φ = ${PHI}`);
}
