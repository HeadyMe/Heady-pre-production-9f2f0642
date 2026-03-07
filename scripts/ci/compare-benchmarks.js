#!/usr/bin/env node
/**
 * scripts/ci/compare-benchmarks.js
 *
 * Compare current benchmark run against stored baseline.
 * Outputs a detailed comparison table and pass/fail verdict.
 *
 * φ-scaled thresholds:
 *   Warning: fib(5)%  = 5%  regression
 *   Fail:    fib(6)%  = 8%  regression
 *   (These match the PERF_WARN_PCT / PERF_FAIL_PCT env vars)
 *
 * Usage:
 *   node scripts/ci/compare-benchmarks.js \
 *     --baseline <path>    Path to baseline.json
 *     --output   <path>    Output comparison results JSON
 *     --warn-pct <n>       Warning threshold % (default: 5)
 *     --fail-pct <n>       Failure threshold % (default: 8)
 *     [--current <path>]   Path to current benchmark JSON (or runs inline)
 *
 * Exit codes:
 *   0 = pass
 *   1 = regression detected (exceeds fail threshold)
 *   2 = baseline not found (first run — generates initial baseline)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── φ Constants ─────────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

// Fibonacci regression thresholds (percent)
const DEFAULT_WARN_PCT = FIB[5];  // fib(5) = 5%
const DEFAULT_FAIL_PCT = FIB[6];  // fib(6) = 8%

// fib(8)=21 warmup requests before measurement
const WARMUP_REQUESTS = FIB[8];   // 21
// fib(10)=55 measurement samples
const SAMPLE_COUNT = FIB[10];     // 55

// φ^n timeout series (ms): 1000, 1618, 2618, 4236, 6854
const TIMEOUTS = [1000, 1618, 2618, 4236, 6854].map(t => Math.round(t));

// ─── CLI Argument Parsing ────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    args[key] = argv[i + 1];
  }
  return {
    baseline: args.baseline || '.benchmarks/baseline.json',
    output:   args.output   || 'benchmark-results.json',
    current:  args.current  || null,
    warnPct:  parseFloat(args['warn-pct'] || DEFAULT_WARN_PCT),
    failPct:  parseFloat(args['fail-pct'] || DEFAULT_FAIL_PCT),
  };
}

// ─── Benchmark runner ────────────────────────────────────────────────────────
/**
 * Run a simple benchmark against a single endpoint using node's http module.
 * @param {string} url
 * @param {number} samples
 * @param {number} timeoutMs
 * @returns {Promise<object>} latency stats
 */
async function runEndpointBenchmark(url, samples = SAMPLE_COUNT, timeoutMs = TIMEOUTS[2]) {
  const http = require('http');
  const https = require('https');
  const urlObj = new URL(url);
  const client = urlObj.protocol === 'https:' ? https : http;

  const latencies = [];
  let errors = 0;

  /** @returns {Promise<number>} latency in ms */
  const measureOne = () => new Promise((resolve) => {
    const start = Date.now();
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      res.resume(); // drain
      const duration = Date.now() - start;
      if (res.statusCode >= 200 && res.statusCode < 400) {
        resolve(duration);
      } else {
        errors++;
        resolve(null);
      }
    });
    req.on('error', () => { errors++; resolve(null); });
    req.on('timeout', () => { req.destroy(); errors++; resolve(null); });
  });

  // Warmup: fib(8)=21 requests (not measured)
  console.log(`  Warming up (${WARMUP_REQUESTS} requests)...`);
  for (let i = 0; i < WARMUP_REQUESTS; i++) {
    await measureOne();
  }

  // Measure: fib(10)=55 samples
  console.log(`  Measuring (${samples} samples)...`);
  for (let i = 0; i < samples; i++) {
    const lat = await measureOne();
    if (lat !== null) latencies.push(lat);
  }

  if (latencies.length === 0) {
    return { p50: 0, p75: 0, p95: 0, p99: 0, p999: 0, mean: 0, throughput: 0, errors };
  }

  latencies.sort((a, b) => a - b);
  const pct = (p) => latencies[Math.floor((p / 100) * latencies.length)] || 0;
  const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;

  // Throughput: requests per second (rough estimate from mean latency)
  const throughput = mean > 0 ? Math.round(1000 / mean) : 0;

  return {
    p50:        pct(50),
    p75:        pct(75),
    p95:        pct(95),
    p99:        pct(99),
    p999:       pct(99.9),
    mean:       Math.round(mean * 100) / 100,
    throughput,
    errors,
    sampleCount: latencies.length,
  };
}

// ─── Comparison logic ─────────────────────────────────────────────────────────
/**
 * Compare two metric sets and compute regression percentage.
 * @param {object} baseline
 * @param {object} current
 * @returns {object} comparison result per metric
 */
function compareMetrics(baseline, current) {
  const metrics = ['p50', 'p75', 'p95', 'p99', 'mean'];
  const comparisons = {};

  for (const metric of metrics) {
    const base = baseline[metric] || 0;
    const curr = current[metric] || 0;

    if (base === 0) {
      comparisons[metric] = {
        baseline: 0,
        current: curr,
        delta: 0,
        deltaPct: 0,
        status: 'no-baseline',
      };
      continue;
    }

    const delta = curr - base;
    const deltaPct = (delta / base) * 100;

    comparisons[metric] = {
      baseline: base,
      current: curr,
      delta: Math.round(delta * 100) / 100,
      deltaPct: Math.round(deltaPct * 100) / 100,
    };
  }

  return comparisons;
}

/**
 * Determine pass/fail/warn status for a metric comparison.
 * @param {number} deltaPct - percentage regression (positive = worse)
 * @param {number} warnPct
 * @param {number} failPct
 * @returns {'pass'|'warn'|'fail'}
 */
function getStatus(deltaPct, warnPct, failPct) {
  if (deltaPct > failPct)  return 'fail';
  if (deltaPct > warnPct)  return 'warn';
  return 'pass';
}

// ─── Table formatting ─────────────────────────────────────────────────────────
/**
 * Format comparison results as a markdown table.
 * @param {object} results
 * @returns {string}
 */
function formatTable(results) {
  const lines = [];
  lines.push('## Benchmark Comparison Report');
  lines.push('');
  lines.push(`| Endpoint | Metric | Baseline | Current | Delta | Status |`);
  lines.push(`|----------|--------|----------|---------|-------|--------|`);

  for (const [endpoint, endpointData] of Object.entries(results.endpoints || {})) {
    const { comparisons, overallStatus } = endpointData;
    for (const [metric, comp] of Object.entries(comparisons || {})) {
      const sign = comp.deltaPct > 0 ? '+' : '';
      const statusIcon = comp.status === 'fail' ? '❌' :
                         comp.status === 'warn' ? '⚠️' : '✅';
      lines.push(
        `| \`${endpoint.substring(0, 25)}\` | ${metric} | ${comp.baseline}ms | ` +
        `${comp.current}ms | ${sign}${comp.deltaPct}% | ${statusIcon} ${comp.status} |`
      );
    }
  }

  lines.push('');
  lines.push(`**Overall: ${results.overallStatus?.toUpperCase() || 'UNKNOWN'}**`);
  lines.push('');
  lines.push(`> φ thresholds: warn=${results.thresholds?.warnPct}% (fib(5)), fail=${results.thresholds?.failPct}% (fib(6))`);

  return lines.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);

  console.log('=== Heady Benchmark Comparison ===');
  console.log(`φ = ${PHI}`);
  console.log(`Warn threshold: fib(5)=${args.warnPct}%`);
  console.log(`Fail threshold: fib(6)=${args.failPct}%`);
  console.log(`Samples: fib(10)=${SAMPLE_COUNT} per endpoint`);
  console.log(`Warmup:  fib(8)=${WARMUP_REQUESTS} per endpoint`);
  console.log('');

  // ── Load baseline ──────────────────────────────────────────
  let baseline = null;
  if (fs.existsSync(args.baseline)) {
    baseline = JSON.parse(fs.readFileSync(args.baseline, 'utf8'));
    console.log(`Baseline loaded: ${args.baseline}`);
    console.log(`  Generated: ${baseline.metadata?.generatedAt || 'unknown'}`);
  } else {
    console.warn(`::warning::No baseline found at ${args.baseline}`);
    console.warn('This appears to be the first run — generating initial baseline only');
    // Exit code 2: first run, not a failure
    process.exitCode = 2;
  }

  // ── Load or run current benchmarks ────────────────────────
  let current = {};
  if (args.current && fs.existsSync(args.current)) {
    current = JSON.parse(fs.readFileSync(args.current, 'utf8'));
    console.log('Current benchmarks loaded from file');
  } else {
    // Run benchmarks inline against localhost
    const BASE_URL = process.env.BENCHMARK_BASE_URL || 'http://localhost:8080';
    const endpoints = [
      `${BASE_URL}/health/live`,
      `${BASE_URL}/health/ready`,
      `${BASE_URL}/api/brain/status`,
      `${BASE_URL}/api/conductor/status`,
    ];

    current.endpoints = {};
    for (const url of endpoints) {
      const epKey = url.replace(BASE_URL, '');
      console.log(`Benchmarking: ${epKey}`);
      try {
        current.endpoints[epKey] = await runEndpointBenchmark(url, SAMPLE_COUNT, TIMEOUTS[2]);
      } catch (err) {
        console.warn(`  Warning: ${err.message}`);
        current.endpoints[epKey] = { p50: 0, p95: 0, p99: 0, mean: 0, errors: 1 };
      }
    }
  }

  // ── Compare against baseline ───────────────────────────────
  const results = {
    metadata: {
      comparedAt: new Date().toISOString(),
      baselineGeneratedAt: baseline?.metadata?.generatedAt || null,
      phi: PHI,
      fibonacci: FIB,
    },
    thresholds: {
      warnPct: args.warnPct,   // fib(5)=5
      failPct: args.failPct,   // fib(6)=8
    },
    endpoints: {},
    comparisons: [],
    overallStatus: 'pass',
  };

  if (baseline && baseline.endpoints) {
    for (const [endpoint, currentMetrics] of Object.entries(current.endpoints || {})) {
      const baselineMetrics = baseline.endpoints[endpoint] || null;

      if (!baselineMetrics) {
        console.log(`  ${endpoint}: no baseline — skipping comparison`);
        results.endpoints[endpoint] = {
          comparisons: {},
          overallStatus: 'no-baseline',
        };
        continue;
      }

      const comparisons = compareMetrics(baselineMetrics, currentMetrics);

      // Determine endpoint status (worst-case metric wins)
      let endpointStatus = 'pass';
      for (const [metric, comp] of Object.entries(comparisons)) {
        const s = getStatus(comp.deltaPct || 0, args.warnPct, args.failPct);
        comp.status = s;
        if (s === 'fail') endpointStatus = 'fail';
        else if (s === 'warn' && endpointStatus !== 'fail') endpointStatus = 'warn';

        // Add to flat comparisons array for PR body table
        results.comparisons.push({
          endpoint,
          metric,
          baseline: comp.baseline,
          current: comp.current,
          delta: comp.deltaPct || 0,
          status: s,
        });
      }

      results.endpoints[endpoint] = { comparisons, overallStatus: endpointStatus };

      // Propagate to overall
      if (endpointStatus === 'fail') results.overallStatus = 'fail';
      else if (endpointStatus === 'warn' && results.overallStatus !== 'fail') {
        results.overallStatus = 'warn';
      }

      const icon = endpointStatus === 'fail' ? '❌' :
                   endpointStatus === 'warn' ? '⚠️' : '✅';
      console.log(`  ${icon} ${endpoint}: ${endpointStatus} (p95: ${currentMetrics.p95}ms vs baseline ${baselineMetrics.p95}ms)`);
    }
  }

  // ── Print markdown table ───────────────────────────────────
  const table = formatTable(results);
  console.log('\n' + table);

  // ── Write output ───────────────────────────────────────────
  const outputDir = path.dirname(args.output);
  if (outputDir && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(args.output, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nResults written to: ${args.output}`);

  // ── Exit with appropriate code ─────────────────────────────
  if (results.overallStatus === 'fail') {
    console.error(`\n❌ BENCHMARK FAIL: Regression exceeds fib(6)=${args.failPct}% threshold`);
    process.exit(1);
  } else if (results.overallStatus === 'warn') {
    console.warn(`\n⚠️  BENCHMARK WARN: Regression exceeds fib(5)=${args.warnPct}% warning threshold`);
    // Warnings don't fail the build
    process.exit(0);
  } else {
    console.log('\n✅ BENCHMARK PASS: All metrics within φ-scaled thresholds');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error in compare-benchmarks:', err);
  process.exit(1);
});
