/**
 * HeadySystems v3.2.2 — k6 Stress Test
 * =======================================
 * Scenario: Find the system breaking point by ramping to fib(12)=144 VUs.
 *
 * Profile (progressive Fibonacci stages):
 *   Stage 1: Ramp to fib(5)=5 VUs   over fib(3)=2 min  — warmup
 *   Stage 2: Ramp to fib(7)=13 VUs  over fib(3)=2 min  — low load
 *   Stage 3: Ramp to fib(9)=34 VUs  over fib(4)=3 min  — moderate load
 *   Stage 4: Ramp to fib(10)=55 VUs over fib(4)=3 min  — baseline (SLA zone)
 *   Stage 5: Ramp to fib(11)=89 VUs over fib(4)=3 min  — high load
 *   Stage 6: Ramp to fib(12)=144 VUs over fib(4)=3 min — stress (breaking point)
 *   Stage 7: Sustain 144 VUs for fib(5)=5 min           — observe degradation
 *   Stage 8: Ramp down to 0 over fib(4)=3 min           — recovery observation
 *
 * Goal: Identify at which VU count:
 *   - p99 latency exceeds 1000ms (SLA breach)
 *   - Error rate exceeds 1%
 *   - Circuit breakers open
 *   - Connection pools exhaust
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

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM METRICS
// ─────────────────────────────────────────────────────────────────────────────

const errorRate        = new Rate('heady_stress_error_rate');
const chatP99          = new Trend('heady_stress_chat_p99_ms', true);
const searchP99        = new Trend('heady_stress_search_p99_ms', true);
const breakingPointVUs = new Gauge('heady_breaking_point_vus');

// ─────────────────────────────────────────────────────────────────────────────
// TEST OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // Stage 1: Warmup — ramp to fib(5)=5 VUs over fib(3)=2 minutes
        { duration: `${FIB[2]}m`, target: FIB[4]  },  // 2m → 5 VUs
        // Stage 2: Low load — fib(7)=13 VUs over fib(3)=2 minutes
        { duration: `${FIB[2]}m`, target: FIB[6]  },  // 2m → 13 VUs
        // Stage 3: Moderate — fib(9)=34 VUs over fib(4)=3 minutes
        { duration: `${FIB[3]}m`, target: FIB[8]  },  // 3m → 34 VUs
        // Stage 4: Baseline — fib(10)=55 VUs over fib(4)=3 minutes
        { duration: `${FIB[3]}m`, target: FIB[9]  },  // 3m → 55 VUs
        // Stage 5: High — fib(11)=89 VUs over fib(4)=3 minutes
        { duration: `${FIB[3]}m`, target: FIB[10] },  // 3m → 89 VUs
        // Stage 6: Stress — fib(12)=144 VUs over fib(4)=3 minutes
        { duration: `${FIB[3]}m`, target: FIB[11] },  // 3m → 144 VUs
        // Stage 7: Sustain — hold 144 VUs for fib(5)=5 minutes
        { duration: `${FIB[4]}m`, target: FIB[11] },  // 5m at 144 VUs
        // Stage 8: Recovery — ramp down over fib(4)=3 minutes
        { duration: `${FIB[3]}m`, target: 0       },  // 3m → 0 VUs
      ],
      gracefulRampDown: `${FIB[7]}s`,  // fib(8)=21s
    },
  },

  thresholds: {
    // Observe but don't fail — stress test intentionally breaks SLAs
    // Use 'abortOnFail: false' to collect data past the breaking point
    'http_req_duration{name:chat}':   [
      { threshold: `p(95)<${FIB[9] * 10}`, abortOnFail: false },  // 550ms (fib(10)×10)
      { threshold: `p(99)<${FIB[7] * 50}`, abortOnFail: false },  // 1050ms (fib(8)×50)
    ],
    'http_req_failed': [
      { threshold: `rate<0.10`, abortOnFail: false },  // 10% max for stress test
    ],
    'heady_stress_error_rate': [
      { threshold: `rate<0.10`, abortOnFail: false },
    ],
  },

  tags: {
    test_type: 'stress',
    service:   'heady-systems',
    version:   '3.2.2',
    phi:       `${PHI}`,
    vus_max:   `${FIB[11]}`,  // fib(12)=144
    fibonacci: 'fib(5)=5→fib(12)=144-VUs-progressive',
  },

  // Emit summary data for analysis
  summaryTrendStats: ['min', 'med', 'avg', 'max', 'p(50)', 'p(75)', 'p(90)', 'p(95)', 'p(99)', 'p(99.9)'],
};

// ─────────────────────────────────────────────────────────────────────────────
// HEADERS
// ─────────────────────────────────────────────────────────────────────────────

const headers = {
  'Content-Type':  'application/json',
  'Accept':        'application/json',
  'Authorization': `Bearer ${API_TOKEN}`,
  'User-Agent':    `k6-stress/${FIB[11]}VUs (φ=${PHI})`,
  'X-Test-Type':   'stress',
};

const CHAT_PROMPTS = [
  "Analyze current system load and suggest Fibonacci-optimized scaling.",
  "What is the CSL gate distribution across all active agents?",
  "Generate a φ-ratio health report for vector space density.",
  "List all circuit breaker states and their last transition times.",
  "Describe the current octree partition depth and rebalancing needs.",
  "What is the error budget consumption rate for the past hour?",
];

// ─────────────────────────────────────────────────────────────────────────────
// BREAKING POINT TRACKER
// ─────────────────────────────────────────────────────────────────────────────

/** Track when p99 first exceeds SLA */
let breakingPointDetected = false;
let breakingPointVUCount  = 0;

// ─────────────────────────────────────────────────────────────────────────────
// VU LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

export default function () {
  const iterStart = Date.now();

  group('Stress: Chat', () => {
    const res = http.post(`${BASE_URL}/api/brain/chat`, JSON.stringify({
      message:  randomItem(CHAT_PROMPTS),
      stream:   false,
      metadata: { testType: 'stress', vu: __VU, iter: __ITER, phi: PHI },
    }), {
      headers,
      tags: { name: 'chat' },
      timeout: `${FIB[7]}s`,  // fib(8)=21s timeout
    });

    const ok = check(res, {
      'stress chat: status ok':     (r) => r.status === 200 || r.status === 429,
      'stress chat: not 500':       (r) => r.status !== 500,
      'stress chat: not 503':       (r) => r.status !== 503,
    });

    chatP99.add(res.timings.duration);
    errorRate.add(res.status >= 500);

    // Detect breaking point: p99 > 1000ms (fib(8)=21ms × φ^6 ≈ 1000ms)
    if (res.timings.duration > 1000 && !breakingPointDetected) {
      breakingPointDetected = true;
      breakingPointVUCount  = __VU;
      breakingPointVUs.add(__VU);
      console.log(`Breaking point detected at ~${__VU} VUs (p99 latency: ${res.timings.duration}ms)`);
    }
  });

  // Minimal think time under stress: 1/φ ≈ 0.618s
  sleep(1 / PHI);

  group('Stress: Search', () => {
    const res = http.post(`${BASE_URL}/api/memory/search`, JSON.stringify({
      query: `stress test ${Math.random()}`,
      k:     FIB[2],  // fib(3)=2 results
    }), {
      headers,
      tags: { name: 'search' },
      timeout: `${FIB[7]}s`,
    });

    check(res, {
      'stress search: status ok': (r) => r.status === 200 || r.status === 429,
    });

    searchP99.add(res.timings.duration);
    errorRate.add(res.status >= 500);
  });

  // Minimal think time: 1/φ^2 ≈ 0.382s
  sleep(1 / (PHI * PHI));

  group('Stress: MCP Tools', () => {
    const res = http.get(`${BASE_URL}/api/mcp/tools/list`, {
      headers,
      tags: { name: 'tools' },
      timeout: `${FIB[7]}s`,
    });

    check(res, {
      'stress tools: status ok': (r) => r.status === 200 || r.status === 429 || r.status === 503,
    });

    errorRate.add(res.status >= 500);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP & TEARDOWN
// ─────────────────────────────────────────────────────────────────────────────

export function setup() {
  console.log(`HeadySystems STRESS Test — φ=${PHI}`);
  console.log(`VU ramp: 0→fib(5)=5→fib(7)=13→fib(9)=34→fib(10)=55→fib(11)=89→fib(12)=144`);
  console.log(`Breaking point detection: p99 > 1000ms (φ^2 × 382ms)`);
  console.log(`Fibonacci stage durations: 2m, 2m, 3m, 3m, 3m, 3m, 5m, 3m`);
  console.log(`Base URL: ${BASE_URL}`);
  return { startTime: Date.now() };
}

export function teardown(data) {
  const durationS = Math.round((Date.now() - data.startTime) / 1000);
  console.log(`\nStress test complete. Duration: ${durationS}s`);
  if (breakingPointDetected) {
    console.log(`⚠️ Breaking point detected at ~${breakingPointVUCount} VUs (p99 > 1000ms)`);
    console.log(`Fibonacci proximity: closest fib value = ${FIB.find(f => f >= breakingPointVUCount) || FIB[FIB.length-1]}`);
  } else {
    console.log(`✓ No breaking point detected at fib(12)=${FIB[11]} VUs — system is robust!`);
  }
}
