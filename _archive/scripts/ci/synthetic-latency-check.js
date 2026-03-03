#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, rank)];
}

async function timedFetch(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = process.hrtime.bigint();

  try {
    const res = await fetch(url, { signal: controller.signal });
    await res.text();
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    return { ok: res.ok, status: res.status, elapsedMs };
  } catch (error) {
    return { ok: false, status: 'ERR', elapsedMs: timeoutMs, error: error.message };
  } finally {
    clearTimeout(timer);
  }
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function run() {
  const configPath = process.argv[2] || 'configs/slo-latency.yaml';
  const outputDir = process.argv[3] || 'artifacts/perf';
  const configRaw = fs.readFileSync(configPath, 'utf8');
  const config = YAML.parse(configRaw);

  if (!config?.ci_synthetic?.endpoints?.length) {
    throw new Error(`No ci_synthetic.endpoints defined in ${configPath}`);
  }

  const { base_url: baseUrl, samples_per_endpoint: samples, timeout_ms: timeoutMs, baseline_file: baselineFile } = config.ci_synthetic;
  const results = [];
  let hasViolation = false;

  for (const endpoint of config.ci_synthetic.endpoints) {
    const latencies = [];
    let errorCount = 0;
    let statusMismatchCount = 0;

    for (let i = 0; i < samples; i += 1) {
      const probe = await timedFetch(`${baseUrl}${endpoint.path}`, timeoutMs);
      latencies.push(Math.round(probe.elapsedMs));

      if (!probe.ok) {
        if (typeof probe.status === 'number') {
          statusMismatchCount += 1;
        } else {
          errorCount += 1;
        }
      }
    }

    const p95 = percentile(latencies, 95);
    const violation = p95 > endpoint.p95_target_ms || errorCount > 0 || statusMismatchCount > 0;
    if (violation) {
      hasViolation = true;
    }

    results.push({
      name: endpoint.name,
      path: endpoint.path,
      class: endpoint.class,
      p95_target_ms: endpoint.p95_target_ms,
      latency_ms: latencies,
      p95_ms: p95,
      errors: errorCount,
      bad_status: statusMismatchCount,
      violation,
    });
  }

  const baselinePath = baselineFile || 'configs/slo-latency-baseline.json';
  let baseline = { endpoints: {} };
  if (fs.existsSync(baselinePath)) {
    baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  }

  const trend = {
    generated_at: new Date().toISOString(),
    baseline_file: baselinePath,
    deltas_ms: {},
  };

  for (const result of results) {
    const baselineValue = baseline?.endpoints?.[result.name];
    if (typeof baselineValue === 'number') {
      trend.deltas_ms[result.name] = result.p95_ms - baselineValue;
    }
  }

  const summary = {
    generated_at: new Date().toISOString(),
    config_path: configPath,
    base_url: baseUrl,
    samples_per_endpoint: samples,
    results,
    passed: !hasViolation,
  };

  const resultPath = path.join(outputDir, 'latency-results.json');
  const trendPath = path.join(outputDir, 'latency-trend.json');
  ensureDir(resultPath);
  ensureDir(trendPath);
  fs.writeFileSync(resultPath, `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(trendPath, `${JSON.stringify(trend, null, 2)}\n`);

  console.log(`Synthetic latency check results written to ${resultPath}`);
  console.log(`Trend comparison written to ${trendPath}`);

  for (const row of results) {
    const icon = row.violation ? '❌' : '✅';
    console.log(`${icon} ${row.name} (${row.path}) p95=${row.p95_ms}ms target=${row.p95_target_ms}ms errors=${row.errors} bad_status=${row.bad_status}`);
  }

  if (hasViolation) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(`Synthetic latency check failed: ${error.message}`);
  process.exit(1);
});
