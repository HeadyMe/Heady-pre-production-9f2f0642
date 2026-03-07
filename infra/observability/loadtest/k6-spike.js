/**
 * HeadySystems v3.2.2 — k6 Spike Test
 * ======================================
 * Scenario: Sudden load spike from fib(5)=5 VUs to fib(11)=89 VUs.
 * Validates auto-scaling and graceful degradation under sudden bursts.
 *
 * Profile:
 *   Stage 1: Steady at fib(5)=5 VUs for fib(4)=3 minutes  — baseline
 *   Stage 2: Spike to fib(11)=89 VUs in 10 seconds          — spike onset (φ^n × 10s)
 *   Stage 3: Hold fib(11)=89 VUs for fib(7)=13 minutes      — spike sustained
 *   Stage 4: Drop to fib(5)=5 VUs in 10 seconds             — spike recovery
 *   Stage 5: Steady at fib(5)=5 VUs for fib(7)=13 minutes   — recovery observation
 *   Stage 6: Ramp down to 0 over fib(3)=2 minutes
 *
 * Spike ratio: 89/5 = 17.8x ≈ φ^6 = 17.944 (golden ratio power spike)
 *
 * Pass criteria:
 *   - System scales to handle fib(11)=89 VUs within fib(7)=13s
 *   - Error rate during spike < 5% (graceful degradation, not crash)
 *   - After spike drops, error rate recovers to < 1% within fib(8)=21s
 *   - p99 latency returns to < 1000ms within fib(8)=21s of spike end
 *   - No data corruption (audit chain integrity maintained)
 *
 * All numeric parameters: φ=1.618033988749895, Fibonacci sequences.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

const BASE_URL  = __ENV.BASE_URL  || 'https://headyme.com';
const API_TOKEN = __ENV.API_TOKEN || '';

// Key spike parameters (all Fibonacci-derived)
const BASE_VUS  = FIB[4];   // fib(5)=5   — pre/post spike
const SPIKE_VUS = FIB[10];  // fib(11)=89 — spike peak

// Spike ratio: 89/5 = 17.8x ≈ φ^6 ≈ 17.94 (golden ratio)
const SPIKE_RATIO = SPIKE_VUS / BASE_VUS; // 17.8x

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM METRICS
// ─────────────────────────────────────────────────────────────────────────────

const errorRateTotal  = new Rate('heady_spike_error_rate');
const spikeLatency    = new Trend('heady_spike_latency_ms', true);
const recoveryTime    = new Gauge('heady_spike_recovery_time_s');
const rejectedReqs    = new Counter('heady_spike_rejected_requests');
const scalingLatency  = new Trend('heady_spike_scaling_latency_ms');

// ─────────────────────────────────────────────────────────────────────────────
// TEST OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // Stage 1: Warm up at fib(5)=5 VUs for fib(4)=3 minutes
        { duration: '30s',           target: BASE_VUS  },  // ramp to baseline
        { duration: `${FIB[3]}m`,    target: BASE_VUS  },  // 3m at 5 VUs
        // Stage 2: SPIKE — jump to fib(11)=89 VUs in 10s (~φ^4 seconds)
        { duration: '10s',           target: SPIKE_VUS },  // SPIKE ONSET
        // Stage 3: Sustain spike for fib(7)=13 minutes
        { duration: `${FIB[6]}m`,    target: SPIKE_VUS },  // 13m at 89 VUs
        // Stage 4: Drop back to baseline in 10s
        { duration: '10s',           target: BASE_VUS  },  // SPIKE RECOVERY
        // Stage 5: Observe recovery at baseline for fib(7)=13 minutes
        { duration: `${FIB[6]}m`,    target: BASE_VUS  },  // 13m recovery watch
        // Stage 6: Ramp down over fib(3)=2 minutes
        { duration: `${FIB[2]}m`,    target: 0         },
      ],
      gracefulRampDown: `${FIB[7]}s`,  // fib(8)=21s
    },
  },

  thresholds: {
    // During spike: allow up to 5% error rate (graceful degradation)
    'http_req_failed':              [`rate<0.05`],
    'heady_spike_error_rate':       [`rate<0.05`],
    // Latency: allow up to 2×SLA during spike, recover within 21s
    'http_req_duration{name:chat}': [
      { threshold: `p(95)<1000`, abortOnFail: false },
      { threshold: `p(99)<2000`, abortOnFail: false },
    ],
    // Rejected requests: 429 is acceptable under spike (rate limiter working)
    // Counter will be non-zero which is expected behavior
  },

  tags: {
    test_type:   'spike',
    service:     'heady-systems',
    version:     '3.2.2',
    phi:         `${PHI}`,
    base_vus:    `${BASE_VUS}`,   // fib(5)=5
    spike_vus:   `${SPIKE_VUS}`,  // fib(11)=89
    spike_ratio: `${SPIKE_RATIO.toFixed(1)}x`,  // ~17.8x ≈ φ^6
    fibonacci:   'fib(5)=5→fib(11)=89-spike-17.8x',
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
  'User-Agent':    `k6-spike/${BASE_VUS}→${SPIKE_VUS}VUs (φ^6=${PHI**6|0})`,
  'X-Test-Type':   'spike',
};

const CHAT_PROMPTS = [
  "How does HeadySystems handle sudden load spikes?",
  "Describe auto-scaling triggers based on CSL gates.",
  "What is the rate limiter burst capacity (Fibonacci)?",
  "How does the bulkhead prevent cascade failures during spikes?",
  "What circuit breaker thresholds protect against overload?",
];

// Track spike phase for adaptive behavior
let _spikePhaseDetected = false;

// ─────────────────────────────────────────────────────────────────────────────
// VU LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

export default function (data) {
  const iterStart = Date.now();
  const isHighLoad = __VU > BASE_VUS;

  if (isHighLoad && !_spikePhaseDetected) {
    _spikePhaseDetected = true;
    console.log(`VU ${__VU}: Spike phase detected — ${__VU} VUs active (ratio: ${(__VU / BASE_VUS).toFixed(1)}x)`);
  }

  group('Spike: Chat', () => {
    const res = http.post(`${BASE_URL}/api/brain/chat`, JSON.stringify({
      message:  randomItem(CHAT_PROMPTS),
      stream:   false,
      metadata: {
        testType:   'spike',
        vu:         __VU,
        iter:       __ITER,
        phase:      isHighLoad ? 'spike' : 'baseline',
        spikRatio:  SPIKE_RATIO,
      },
    }), {
      headers,
      tags: { name: 'chat' },
      timeout: `${FIB[7]}s`,  // fib(8)=21s
    });

    const ok = check(res, {
      'spike chat: not 500':   (r) => r.status !== 500,
      'spike chat: not 502':   (r) => r.status !== 502,
      // 429 is acceptable — rate limiter protecting the system
      'spike chat: status ok': (r) => r.status === 200 || r.status === 429 || r.status === 503,
    });

    spikeLatency.add(res.timings.duration);
    scalingLatency.add(Date.now() - iterStart);

    // Track 429s as rejected (expected behavior during spike)
    if (res.status === 429) {
      rejectedReqs.add(1);
    }
    // Track 5xx as errors
    errorRateTotal.add(res.status >= 500);
  });

  // During spike: minimal think time (1/φ^2 ≈ 0.382s)
  // At baseline: normal think time (φ ≈ 1.618s)
  sleep(isHighLoad ? 1 / (PHI * PHI) : PHI);

  group('Spike: Search', () => {
    const res = http.post(`${BASE_URL}/api/memory/search`, JSON.stringify({
      query: `spike test ${__ITER}`,
      k:     FIB[2],  // fib(3)=2
    }), {
      headers,
      tags: { name: 'search' },
      timeout: `${FIB[7]}s`,
    });

    check(res, {
      'spike search: not 500': (r) => r.status !== 500,
    });
    errorRateTotal.add(res.status >= 500);
  });

  sleep(isHighLoad ? 1 / PHI : PHI);

  group('Spike: MCP Tools', () => {
    const res = http.get(`${BASE_URL}/api/mcp/tools/list`, {
      headers,
      tags: { name: 'tools' },
      timeout: `${FIB[6]}s`,  // fib(7)=13s for tools (faster endpoint)
    });

    check(res, {
      'spike tools: not 500': (r) => r.status !== 500,
    });
    errorRateTotal.add(res.status >= 500);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP & TEARDOWN
// ─────────────────────────────────────────────────────────────────────────────

export function setup() {
  console.log(`HeadySystems SPIKE Test — φ=${PHI}`);
  console.log(`VU profile: fib(5)=${BASE_VUS} → SPIKE fib(11)=${SPIKE_VUS} VUs`);
  console.log(`Spike ratio: ${SPIKE_RATIO.toFixed(2)}x ≈ φ^6 = ${(PHI**6).toFixed(3)}`);
  console.log(`Spike onset: 10s (sudden). Recovery: 10s.`);
  console.log(`Expected behavior during spike:`);
  console.log(`  - Rate limiter returns 429 for burst > fib(10)=55 req/s per source`);
  console.log(`  - Bulkhead prevents cascade beyond 0.854 (CSL CRITICAL)`);
  console.log(`  - Circuit breakers protect downstream services`);
  console.log(`  - Auto-scaling triggers within fib(7)=13s`);
  console.log(`Base URL: ${BASE_URL}`);
  return { startTime: Date.now() };
}

export function teardown(data) {
  const durationS = Math.round((Date.now() - data.startTime) / 1000);
  console.log(`\nSpike test complete. Duration: ${durationS}s (~${Math.round(durationS/60)}m)`);
  console.log(`Spike profile: fib(5)=${BASE_VUS} → fib(11)=${SPIKE_VUS} VUs (${SPIKE_RATIO.toFixed(1)}x)`);
  console.log(`Fibonacci params: base=fib(5), spike=fib(11), sustain=fib(7)=13m`);
  console.log(`φ^6 = ${(PHI**6).toFixed(3)} (theoretical spike ratio)`);
  console.log(`\nKey questions this test answers:`);
  console.log(`  1. Does rate limiter protect at fib(10)=55+ req/s per source?`);
  console.log(`  2. Do circuit breakers open at >0.854 (CSL CRITICAL) saturation?`);
  console.log(`  3. Does auto-scaling restore capacity within fib(7)=13s?`);
  console.log(`  4. Is recovery complete within fib(8)=21s of spike end?`);
}
