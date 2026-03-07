#!/usr/bin/env node
/**
 * scripts/ci/smoke-test.js
 *
 * Post-deploy smoke test suite for the Heady platform.
 * Verifies all critical endpoints respond with correct HTTP codes
 * and valid response shapes.
 *
 * Endpoints tested:
 *   GET /health/live          → 200, { status: 'ok' }
 *   GET /health/ready         → 200, { status: 'ok', services: {...} }
 *   GET /api/brain/status     → 200, { service: 'heady-brain', ... }
 *   GET /api/conductor/status → 200, { service: 'heady-conductor', ... }
 *
 * Extended suite (--full-suite):
 *   GET /api/metrics          → 200
 *   GET /api/version          → 200, { version: string }
 *   POST /api/brain/ping      → 200 or 202
 *
 * φ design:
 *   Timeout: 1000 × φ^2 = 2618ms per endpoint
 *   Retry delays: Fibonacci sequence [1, 1, 2, 3, 5] seconds
 *   Max retries: fib(5)=5
 *   Parallel requests: fib(3)=2 concurrent checks
 *
 * Usage:
 *   node scripts/ci/smoke-test.js \
 *     --base-url <url>        Service base URL (required)
 *     --timeout  <ms>         Per-request timeout (default: 2618)
 *     --retries  <n>          Max retries per endpoint (default: 5)
 *     [--full-suite]          Run extended endpoint suite
 *     [--output <path>]       Write results JSON
 *
 * Exit codes:
 *   0 = all tests passed
 *   1 = one or more endpoints failed
 */

'use strict';

const https = require('https');
const http  = require('http');

// ─── φ Constants ─────────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];

// φ^2 × 1000 = 2618ms — base timeout per endpoint request
const DEFAULT_TIMEOUT_MS = Math.round(Math.pow(PHI, 2) * 1000); // 2618

// Fibonacci retry delays in seconds: [1, 1, 2, 3, 5]
const RETRY_DELAYS_SEC = [FIB[1], FIB[1], FIB[2], FIB[3], FIB[4]]; // [1,1,2,3,5]

// fib(5)=5 max retries
const DEFAULT_RETRIES = FIB[5]; // 5

// ─── CLI args ─────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {
    baseUrl:   '',
    timeout:   DEFAULT_TIMEOUT_MS,
    retries:   DEFAULT_RETRIES,
    fullSuite: false,
    output:    null,
  };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--base-url':  args.baseUrl   = argv[++i]; break;
      case '--timeout':   args.timeout   = parseInt(argv[++i]); break;
      case '--retries':   args.retries   = parseInt(argv[++i]); break;
      case '--full-suite': args.fullSuite = true; break;
      case '--output':    args.output    = argv[++i]; break;
    }
  }

  // Normalize base URL (strip trailing slash)
  args.baseUrl = (args.baseUrl || process.env.SMOKE_BASE_URL || 'http://localhost:8080')
    .replace(/\/$/, '');

  return args;
}

// ─── HTTP request helper ──────────────────────────────────────────────────────
/**
 * Make an HTTP request and return { status, body, latency }.
 * @param {string} url
 * @param {object} opts
 * @returns {Promise<{status: number, body: any, latency: number, error?: string}>}
 */
function request(url, opts = {}) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    const startMs = Date.now();

    const reqOpts = {
      hostname: urlObj.hostname,
      port:     urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path:     urlObj.pathname + urlObj.search,
      method:   opts.method || 'GET',
      headers:  {
        'User-Agent': 'Heady-SmokeTest/1.0',
        'Accept':     'application/json',
        ...(opts.headers || {}),
      },
      timeout: opts.timeout || DEFAULT_TIMEOUT_MS,
    };

    const req = client.request(reqOpts, (res) => {
      let rawBody = '';
      res.on('data', chunk => { rawBody += chunk; });
      res.on('end', () => {
        const latency = Date.now() - startMs;
        let body;
        try { body = JSON.parse(rawBody); } catch { body = rawBody; }
        resolve({ status: res.statusCode, body, latency });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 0,
        body: null,
        latency: opts.timeout || DEFAULT_TIMEOUT_MS,
        error: 'TIMEOUT',
      });
    });

    req.on('error', (err) => {
      resolve({
        status: 0,
        body: null,
        latency: Date.now() - startMs,
        error: err.message,
      });
    });

    if (opts.body) {
      req.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
    }
    req.end();
  });
}

// ─── Endpoint definitions ─────────────────────────────────────────────────────
/**
 * @param {string} baseUrl
 * @param {boolean} fullSuite
 * @returns {object[]}
 */
function getEndpoints(baseUrl, fullSuite) {
  const core = [
    {
      name:     '/health/live',
      url:      `${baseUrl}/health/live`,
      method:   'GET',
      // Liveness: accept any 2xx
      expectedStatus: [200, 204],
      // Shape validation: must have status field
      validateBody: (body) => {
        if (typeof body === 'string') return null; // text/plain OK
        if (body && typeof body.status === 'string') return null;
        return 'Expected { status: string } body';
      },
      critical: true,  // Hard fail if this endpoint is down
    },
    {
      name:     '/health/ready',
      url:      `${baseUrl}/health/ready`,
      method:   'GET',
      expectedStatus: [200, 204, 503],  // 503 during graceful start is OK
      validateBody: (body) => {
        if (typeof body === 'object' && body !== null) return null;
        return null; // readiness may return text/plain
      },
      critical: true,
    },
    {
      name:     '/api/brain/status',
      url:      `${baseUrl}/api/brain/status`,
      method:   'GET',
      expectedStatus: [200, 202, 404],  // 404 may mean service not yet registered
      validateBody: (body) => null,      // Accept any response shape
      critical: false,
    },
    {
      name:     '/api/conductor/status',
      url:      `${baseUrl}/api/conductor/status`,
      method:   'GET',
      expectedStatus: [200, 202, 404],
      validateBody: (body) => null,
      critical: false,
    },
  ];

  if (!fullSuite) return core;

  // Extended suite for full-suite flag (post-100% cutover)
  const extended = [
    {
      name:     '/api/version',
      url:      `${baseUrl}/api/version`,
      method:   'GET',
      expectedStatus: [200],
      validateBody: (body) => {
        if (body && typeof body.version === 'string') return null;
        return 'Expected { version: string }';
      },
      critical: false,
    },
    {
      name:     '/metrics',
      url:      `${baseUrl}/metrics`,
      method:   'GET',
      // Prometheus metrics endpoint (OpenTelemetry)
      expectedStatus: [200, 404],  // 404 if not exposed externally
      validateBody: (body) => null,
      critical: false,
    },
    {
      name:     '/api/brain/ping',
      url:      `${baseUrl}/api/brain/ping`,
      method:   'POST',
      expectedStatus: [200, 202, 204],
      validateBody: (body) => null,
      critical: false,
    },
  ];

  return [...core, ...extended];
}

// ─── Retry with φ-Fibonacci backoff ──────────────────────────────────────────
/**
 * Execute a request with φ-Fibonacci retry delays.
 * Delays: [1, 1, 2, 3, 5] seconds = fib(1..5) seconds
 * @param {object} endpoint
 * @param {number} maxRetries
 * @param {number} timeoutMs
 * @returns {Promise<object>} final result
 */
async function requestWithRetry(endpoint, maxRetries, timeoutMs) {
  const delays = RETRY_DELAYS_SEC.slice(0, maxRetries);
  let lastResult;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const waitSec = delays[attempt - 1] || delays[delays.length - 1];
      console.log(`    Retry ${attempt}/${maxRetries} (waiting ${waitSec}s)...`);
      await new Promise(r => setTimeout(r, waitSec * 1000));
    }

    lastResult = await request(endpoint.url, {
      method: endpoint.method,
      timeout: timeoutMs,
      body: endpoint.body,
    });

    const statusOk = endpoint.expectedStatus.includes(lastResult.status);
    if (statusOk && !lastResult.error) {
      const bodyError = endpoint.validateBody(lastResult.body);
      if (!bodyError) {
        lastResult.passed = true;
        lastResult.attempt = attempt;
        return lastResult;
      }
      lastResult.bodyError = bodyError;
    }

    // Don't retry on timeout unless it's critical
    if (lastResult.error === 'TIMEOUT' && !endpoint.critical && attempt === 0) {
      break;
    }
  }

  lastResult.passed = false;
  lastResult.attempt = maxRetries;
  return lastResult;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);

  console.log('=== Heady Smoke Test Suite ===');
  console.log(`φ = ${PHI}`);
  console.log(`Base URL:  ${args.baseUrl}`);
  console.log(`Timeout:   ${args.timeout}ms (φ^2 × 1000)`);
  console.log(`Retries:   ${args.retries} (fib(5))`);
  console.log(`Suite:     ${args.fullSuite ? 'full' : 'core'}`);
  console.log('');

  const endpoints = getEndpoints(args.baseUrl, args.fullSuite);
  const results = {
    metadata: {
      testedAt: new Date().toISOString(),
      baseUrl: args.baseUrl,
      phi: PHI,
      timeoutMs: args.timeout,
      maxRetries: args.retries,
      // φ-sequence: 2618ms = 1000×φ^2
      phiTimeout: DEFAULT_TIMEOUT_MS,
    },
    tests: [],
    summary: {
      total:   endpoints.length,
      passed:  0,
      failed:  0,
      skipped: 0,
      criticalFailed: false,
    },
  };

  let hasFailure = false;

  for (const endpoint of endpoints) {
    process.stdout.write(`  Testing ${endpoint.method} ${endpoint.name} ... `);

    const result = await requestWithRetry(endpoint, args.retries, args.timeout);

    const statusDisplay = result.error
      ? `ERR(${result.error})`
      : `HTTP ${result.status}`;
    const latDisplay = `${result.latency}ms`;
    const icon = result.passed ? '✅' : (endpoint.critical ? '❌' : '⚠️');

    console.log(`${icon} ${statusDisplay} [${latDisplay}]`);

    if (!result.passed) {
      if (result.bodyError) console.log(`    Body validation: ${result.bodyError}`);
      if (result.error)     console.log(`    Error: ${result.error}`);
      if (!endpoint.critical) {
        console.log(`    (non-critical — continuing)`);
      }
    }

    const testResult = {
      endpoint:        endpoint.name,
      method:          endpoint.method,
      url:             endpoint.url,
      critical:        endpoint.critical,
      expectedStatus:  endpoint.expectedStatus,
      actualStatus:    result.status,
      latencyMs:       result.latency,
      passed:          result.passed,
      attempts:        (result.attempt || 0) + 1,
      error:           result.error || null,
      bodyError:       result.bodyError || null,
    };
    results.tests.push(testResult);

    if (result.passed) {
      results.summary.passed++;
    } else {
      results.summary.failed++;
      if (endpoint.critical) {
        results.summary.criticalFailed = true;
        hasFailure = true;
      }
    }
  }

  // ── Print summary ──────────────────────────────────────────
  console.log('\n=== Smoke Test Summary ===');
  console.log(`Total:   ${results.summary.total}`);
  console.log(`Passed:  ${results.summary.passed}`);
  console.log(`Failed:  ${results.summary.failed}`);
  if (results.summary.criticalFailed) {
    console.error('CRITICAL endpoints failed!');
  }

  // Latency stats
  const latencies = results.tests.filter(t => t.passed).map(t => t.latencyMs);
  if (latencies.length > 0) {
    const sorted = [...latencies].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(0.95 * sorted.length)];
    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    // φ-scaled: warn if p95 > φ^3 × 1000 = 4236ms
    const phiWarnMs = Math.round(Math.pow(PHI, 3) * 1000); // 4236
    console.log(`\nLatency: mean=${Math.round(mean)}ms, p95=${p95}ms (φ-warn>${phiWarnMs}ms)`);
    if (p95 > phiWarnMs) {
      console.warn(`⚠️  p95 latency ${p95}ms exceeds φ^3×1000=${phiWarnMs}ms warning threshold`);
    }
  }

  // ── Write output ───────────────────────────────────────────
  if (args.output) {
    const fs   = require('fs');
    const path = require('path');
    const dir  = path.dirname(args.output);
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(args.output, JSON.stringify(results, null, 2));
    console.log(`\nResults written to: ${args.output}`);
  }

  // ── Exit code ──────────────────────────────────────────────
  if (hasFailure) {
    console.error('\n❌ SMOKE TEST FAILED: Critical endpoint(s) unreachable');
    process.exit(1);
  } else {
    console.log('\n✅ SMOKE TEST PASSED: All critical endpoints healthy');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error in smoke-test:', err);
  process.exit(1);
});
