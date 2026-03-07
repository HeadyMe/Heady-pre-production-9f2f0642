#!/usr/bin/env node
/**
 * scripts/ci/analyze-bundle.js
 *
 * Analyze built bundle sizes per package, compare against baseline,
 * and report total + per-package sizes with φ-scaled thresholds.
 *
 * φ thresholds:
 *   Warning:  fib(5)% = 5%  increase
 *   Fail:     fib(5)% = 5%  increase (same — bundle fail is tighter)
 *
 * Usage:
 *   node scripts/ci/analyze-bundle.js \
 *     --baseline <path>    Path to bundle baseline JSON (optional)
 *     --output   <path>    Output analysis JSON path
 *     --fail-pct <n>       Fail threshold % (default: 5 = fib(5))
 *     --src      <dir>     Root directory to scan (default: .)
 *
 * Exit codes:
 *   0 = pass (or no baseline yet)
 *   1 = bundle increase exceeds threshold
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── φ Constants ─────────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

// fib(5)=5% — bundle size increase limit
const DEFAULT_FAIL_PCT = FIB[5];  // 5
// fib(5)=5% — same as fail for bundles (any measurable increase is notable)
const DEFAULT_WARN_PCT = FIB[4];  // 3

// ─── CLI args ─────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    args[key] = argv[i + 1];
  }
  return {
    baseline: args.baseline || '.benchmarks/bundles/bundle-baseline.json',
    output:   args.output   || 'bundle-analysis.json',
    failPct:  parseFloat(args['fail-pct'] || DEFAULT_FAIL_PCT),
    warnPct:  parseFloat(args['warn-pct'] || DEFAULT_WARN_PCT),
    src:      args.src      || '.',
  };
}

// ─── Bundle discovery ─────────────────────────────────────────────────────────
/**
 * Heady monorepo known package locations and their dist paths.
 * Organized by the @heady-ai/* and @headysystems/* scopes.
 */
const PACKAGE_PATHS = [
  // Core platform packages
  { name: '@heady-ai/core',              dist: 'packages/core/dist' },
  { name: '@heady-ai/gateway',           dist: 'packages/gateway/dist' },
  { name: '@heady-ai/sacred-geometry-sdk', dist: 'packages/sacred-geometry-sdk/dist' },
  { name: '@heady-ai/mcp-server',        dist: 'packages/mcp-server/dist' },
  { name: '@heady-ai/orchestrator',      dist: 'packages/orchestrator/dist' },
  { name: '@heady-ai/sdk',               dist: 'packages/sdk/dist' },
  { name: '@heady-ai/shared',            dist: 'packages/shared/dist' },
  { name: '@heady-ai/vector-memory',     dist: 'packages/vector-memory/dist' },
  // System packages
  { name: '@headysystems/semantic-logic', dist: 'packages/semantic-logic/dist' },
  { name: '@headysystems/types',          dist: 'packages/types/dist' },
  { name: '@headysystems/redis',          dist: 'packages/redis/dist' },
  // Entry point
  { name: 'heady-manager',               dist: 'heady-manager.js', isFile: true },
  // Microservices (check src/services/ or services/)
  { name: 'heady-brain',                 dist: 'src/services/heady-brain/dist' },
  { name: 'heady-conductor',             dist: 'src/services/heady-conductor/dist' },
  { name: 'heady-cache',                 dist: 'src/services/heady-cache/dist' },
  { name: 'heady-security',              dist: 'src/services/heady-security/dist' },
  { name: 'heady-ui',                    dist: 'src/services/heady-ui/dist' },
  { name: 'heady-web',                   dist: 'src/services/heady-web/dist' },
];

/**
 * Get file/directory size in bytes.
 * @param {string} p - path
 * @returns {number} bytes (0 if not found)
 */
function getSize(p) {
  if (!fs.existsSync(p)) return 0;

  const stat = fs.statSync(p);
  if (stat.isFile()) return stat.size;

  // Directory: use du -sb for recursive size
  try {
    const result = execSync(`du -sb "${p}" 2>/dev/null`, { encoding: 'utf8' });
    return parseInt(result.split('\t')[0]) || 0;
  } catch {
    // Fallback: manual recursive sum
    let total = 0;
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        const s = fs.statSync(full);
        if (s.isDirectory()) walk(full);
        else total += s.size;
      }
    };
    walk(p);
    return total;
  }
}

/**
 * Format bytes to human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  // φ-scaled units: use 1024 (binary) for disk sizes
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Measure current bundle sizes for all known packages.
 * @param {string} rootDir
 * @returns {object} package name → { bytes, human, path }
 */
function measureCurrentSizes(rootDir) {
  const sizes = {};

  for (const pkg of PACKAGE_PATHS) {
    const fullPath = path.resolve(rootDir, pkg.dist);
    const bytes = getSize(fullPath);

    sizes[pkg.name] = {
      bytes,
      human: formatBytes(bytes),
      path: pkg.dist,
      exists: fs.existsSync(fullPath),
    };
  }

  // Also auto-discover any packages with dist/ dirs not in the list
  try {
    const found = execSync(
      `find ${rootDir}/packages -name "dist" -type d -not -path "*/node_modules/*" 2>/dev/null | head -55`,
      { encoding: 'utf8' }
    ).trim().split('\n').filter(Boolean);

    for (const distDir of found) {
      const pkgJson = path.join(path.dirname(distDir), 'package.json');
      let pkgName = path.dirname(distDir).replace(rootDir, '');
      if (fs.existsSync(pkgJson)) {
        try {
          pkgName = JSON.parse(fs.readFileSync(pkgJson, 'utf8')).name || pkgName;
        } catch {}
      }
      if (!sizes[pkgName]) {
        sizes[pkgName] = {
          bytes: getSize(distDir),
          human: formatBytes(getSize(distDir)),
          path: distDir.replace(rootDir + '/', ''),
          exists: true,
          autoDiscovered: true,
        };
      }
    }
  } catch {}

  return sizes;
}

// ─── Comparison logic ─────────────────────────────────────────────────────────
/**
 * @param {object} baseline - { pkgName: bytes }
 * @param {object} current  - { pkgName: { bytes } }
 * @param {number} warnPct
 * @param {number} failPct
 * @returns {object} per-package comparison
 */
function comparePackages(baseline, current, warnPct, failPct) {
  const results = {};
  let totalBaseline = 0;
  let totalCurrent  = 0;

  for (const [pkg, currData] of Object.entries(current)) {
    const baseBytes = baseline[pkg] || 0;
    const currBytes = currData.bytes || 0;

    totalBaseline += baseBytes;
    totalCurrent  += currBytes;

    const delta = currBytes - baseBytes;
    const deltaPct = baseBytes > 0 ? (delta / baseBytes) * 100 : 0;

    let status = 'pass';
    if (baseBytes > 0) {
      if (deltaPct > failPct)  status = 'fail';
      else if (deltaPct > warnPct) status = 'warn';
    } else {
      status = 'new';
    }

    results[pkg] = {
      baselineBytes: baseBytes,
      currentBytes:  currBytes,
      baselineHuman: formatBytes(baseBytes),
      currentHuman:  formatBytes(currBytes),
      deltaBytes:    delta,
      deltaPct:      Math.round(deltaPct * 100) / 100,
      status,
    };
  }

  return {
    packages: results,
    totals: {
      baselineBytes: totalBaseline,
      currentBytes:  totalCurrent,
      baselineHuman: formatBytes(totalBaseline),
      currentHuman:  formatBytes(totalCurrent),
      deltaBytes:    totalCurrent - totalBaseline,
      deltaPct: totalBaseline > 0
        ? Math.round(((totalCurrent - totalBaseline) / totalBaseline) * 100 * 100) / 100
        : 0,
    },
  };
}

// ─── Report formatting ────────────────────────────────────────────────────────
function formatReport(analysis) {
  const lines = [];
  lines.push('## Bundle Analysis Report');
  lines.push('');
  lines.push(`| Package | Baseline | Current | Δ Bytes | Δ % | Status |`);
  lines.push(`|---------|----------|---------|---------|-----|--------|`);

  for (const [pkg, data] of Object.entries(analysis.comparison?.packages || {})) {
    if (!data.exists && data.currentBytes === 0) continue; // Skip non-existent
    const sign = data.deltaBytes > 0 ? '+' : '';
    const icon = data.status === 'fail' ? '❌' :
                 data.status === 'warn' ? '⚠️' :
                 data.status === 'new'  ? '🆕' : '✅';
    lines.push(
      `| \`${pkg.substring(0, 30)}\` | ${data.baselineHuman || 'N/A'} | ` +
      `${data.currentHuman} | ${sign}${formatBytes(Math.abs(data.deltaBytes))} | ` +
      `${sign}${data.deltaPct}% | ${icon} ${data.status} |`
    );
  }

  lines.push('');
  const t = analysis.comparison?.totals || {};
  lines.push(`**Total: ${t.currentHuman} (was ${t.baselineHuman}, Δ ${t.deltaPct > 0 ? '+' : ''}${t.deltaPct}%)**`);
  lines.push('');
  lines.push(`> φ threshold: fail if any package increases by >${analysis.thresholds?.failPct}% (fib(5))`);
  lines.push(`> Overall: **${(analysis.overallStatus || 'unknown').toUpperCase()}**`);

  return lines.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);

  console.log('=== Heady Bundle Analysis ===');
  console.log(`φ = ${PHI}`);
  console.log(`Fail threshold: fib(5)=${args.failPct}%`);
  console.log(`Warn threshold: fib(4)=${args.warnPct}%`);
  console.log('');

  // ── Load baseline ──────────────────────────────────────────
  let baseline = {};
  if (fs.existsSync(args.baseline)) {
    const raw = JSON.parse(fs.readFileSync(args.baseline, 'utf8'));
    // Baseline format: { packageName: bytes } or { packageName: { bytes } }
    for (const [k, v] of Object.entries(raw)) {
      baseline[k] = typeof v === 'object' ? (v.bytes || 0) : v;
    }
    console.log(`Baseline loaded: ${Object.keys(baseline).length} packages`);
  } else {
    console.warn(`No bundle baseline at ${args.baseline} — treating as first run`);
  }

  // ── Measure current sizes ──────────────────────────────────
  console.log('Measuring current bundle sizes...');
  const current = measureCurrentSizes(args.src);

  const existing = Object.entries(current).filter(([, v]) => v.bytes > 0);
  console.log(`Measured ${existing.length} packages with build output`);

  for (const [pkg, data] of existing) {
    console.log(`  ${data.human.padStart(10)} — ${pkg}${data.autoDiscovered ? ' (auto)' : ''}`);
  }

  // ── Compare ────────────────────────────────────────────────
  const comparison = comparePackages(baseline, current, args.warnPct, args.failPct);

  // ── Determine overall status ───────────────────────────────
  let overallStatus = 'pass';
  for (const data of Object.values(comparison.packages)) {
    if (data.status === 'fail')  { overallStatus = 'fail'; break; }
    if (data.status === 'warn' && overallStatus !== 'fail') overallStatus = 'warn';
  }
  // Also check totals
  if (comparison.totals.deltaPct > args.failPct) overallStatus = 'fail';

  // ── Build result object ───────────────────────────────────
  const analysis = {
    metadata: {
      analyzedAt: new Date().toISOString(),
      phi: PHI,
      fibonacci: FIB,
    },
    thresholds: {
      warnPct: args.warnPct,  // fib(4)=3
      failPct: args.failPct,  // fib(5)=5
    },
    current,
    comparison,
    // Convenience fields for PR body
    totalSize:  comparison.totals.currentHuman,
    totalDelta: `${comparison.totals.deltaPct > 0 ? '+' : ''}${comparison.totals.deltaPct}%`,
    overallStatus,
  };

  // ── Print report ───────────────────────────────────────────
  console.log('\n' + formatReport(analysis));

  // ── Write output ───────────────────────────────────────────
  const dir = path.dirname(args.output);
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(args.output, JSON.stringify(analysis, null, 2));
  console.log(`\nAnalysis written to: ${args.output}`);

  // ── Exit code ──────────────────────────────────────────────
  if (overallStatus === 'fail') {
    console.error(`\n❌ BUNDLE FAIL: Size increase exceeds fib(5)=${args.failPct}% threshold`);
    process.exit(1);
  } else if (overallStatus === 'warn') {
    console.warn(`\n⚠️  BUNDLE WARN: Size increase exceeds fib(4)=${args.warnPct}% warning threshold`);
    process.exit(0);
  } else {
    console.log(`\n✅ BUNDLE PASS: All sizes within φ-scaled thresholds`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error in analyze-bundle:', err);
  process.exit(1);
});
