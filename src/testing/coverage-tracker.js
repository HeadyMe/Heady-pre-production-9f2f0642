'use strict';

/**
 * coverage-tracker.js
 * Maps src/ files to tests/ files, categorises coverage, and generates
 * HTML + JSON reports. Uses CSL.resonance_gate to score test-description
 * alignment with source intent.
 *
 * Part of the Heady Auto-Testing Framework (Part C2)
 */

const fs   = require('fs');
const path = require('path');

const logger = require('../utils/logger');
const CSL    = require('../core/semantic-logic');
const { PHI, PHI_INVERSE } = require('../core/phi-scales');

// ---------------------------------------------------------------------------
// Coverage categories
// ---------------------------------------------------------------------------
const COVERAGE_CATEGORY = {
  FULL:    'FULL',    // >80 % branches covered
  PARTIAL: 'PARTIAL', // >0 % but ≤80 %
  NONE:    'NONE',    // no test found
  AUTO:    'AUTO',    // auto-generated test exists (but may lack assertions)
};

// Roots (resolved relative to this file's location: src/testing/)
const SRC_ROOT   = path.resolve(__dirname, '../..');
const SRC_DIR    = path.join(SRC_ROOT, 'src');
const TESTS_DIR  = path.join(SRC_ROOT, 'tests');
const REPORTS_DIR = path.join(SRC_ROOT, 'reports');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Walk a directory and collect .js files */
function walkJs(dir) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return results;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules') {
      results.push(...walkJs(full));
    } else if (e.isFile() && e.name.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

/** Count describe/it blocks in a test file as a proxy for coverage depth */
function countTestBlocks(testFilePath) {
  try {
    const content = fs.readFileSync(testFilePath, 'utf8');
    const its      = (content.match(/\bit\s*\(/g) || []).length;
    const describes = (content.match(/\bdescribe\s*\(/g) || []).length;
    return { its, describes };
  } catch (_) {
    return { its: 0, describes: 0 };
  }
}

/** Extract exported function/class names from source via regex */
function extractSourceIntent(src) {
  const names = [];
  const patterns = [
    /module\.exports\.(\w+)\s*=/g,
    /exports\.(\w+)\s*=/g,
    /class\s+(\w+)/g,
    /function\s+(\w+)/g,
    /const\s+(\w+)\s*=\s*(?:async\s+)?\(/g,
  ];
  for (const rx of patterns) {
    let m;
    while ((m = rx.exec(src)) !== null) {
      if (!names.includes(m[1])) names.push(m[1]);
    }
  }
  return names;
}

/** Extract it('…') description strings from a test file */
function extractTestDescriptions(testContent) {
  const descriptions = [];
  const rx = /\bit\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = rx.exec(testContent)) !== null) {
    descriptions.push(m[1]);
  }
  return descriptions;
}

/** Convert a name string into a simple deterministic n-dim vector */
function nameToVec(name, dim = 16) {
  const v = new Array(dim).fill(0);
  for (let i = 0; i < name.length; i++) {
    v[i % dim] += name.charCodeAt(i);
  }
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map(x => x / mag);
}

/** Score test descriptions vs. source intent names using CSL.resonance_gate */
function scoreTestAlignment(sourceNames, testDescriptions) {
  if (!sourceNames.length || !testDescriptions.length) return 0;

  let totalScore = 0;
  let comparisons = 0;

  for (const sn of sourceNames.slice(0, 5)) {
    const snVec = nameToVec(sn.toLowerCase());
    for (const td of testDescriptions.slice(0, 10)) {
      const tdVec = nameToVec(td.toLowerCase());
      try {
        const result = CSL.resonance_gate(snVec, tdVec, PHI_INVERSE * 0.4);
        totalScore += result.score;
        comparisons++;
      } catch (_) {
        // dimension mismatch etc. — skip
      }
    }
  }

  return comparisons > 0 ? totalScore / comparisons : 0;
}

// ---------------------------------------------------------------------------
// CoverageTracker
// ---------------------------------------------------------------------------

class CoverageTracker {
  constructor(options = {}) {
    this.srcRoot    = options.srcRoot    || SRC_DIR;
    this.testsRoot  = options.testsRoot  || TESTS_DIR;
    this.reportsDir = options.reportsDir || REPORTS_DIR;
    this.log        = logger.child ? logger.child({ module: 'CoverageTracker' }) : logger;
    this._data      = null; // populated by scan()

    this.log.info('CoverageTracker initialised', { srcRoot: this.srcRoot });
  }

  // -------------------------------------------------------------------------
  // scan
  // -------------------------------------------------------------------------
  /**
   * Map all src/ files to their test counterparts and categorise coverage.
   * @returns {Object[]} array of coverage records
   */
  scan() {
    this.log.logSystem('CoverageTracker.scan starting');

    const srcFiles  = walkJs(this.srcRoot).filter(f => !f.endsWith('.test.js'));
    const testFiles = walkJs(this.testsRoot);

    // Build a quick lookup: stem → test file path
    const testMap = new Map();
    for (const tf of testFiles) {
      const stem = path.basename(tf).replace(/\.test\.js$/, '').replace(/\.spec\.js$/, '');
      testMap.set(stem, tf);
    }

    const records = [];

    for (const sf of srcFiles) {
      const stem = path.basename(sf, '.js');

      // 1. Look for matching test by stem name
      let testFile = testMap.get(stem) || null;

      // 2. Also check if a mirrored auto-generated test exists
      const relSrc     = path.relative(this.srcRoot, sf);
      const mirrorPath = path.join(this.testsRoot, 'auto-generated', relSrc.replace(/\.js$/, '.test.js'));
      const isAuto     = fs.existsSync(mirrorPath);

      if (!testFile && isAuto) testFile = mirrorPath;

      // 3. Determine category
      let category = COVERAGE_CATEGORY.NONE;
      let branchScore = 0;
      let alignmentScore = 0;

      if (testFile) {
        category = isAuto && testFile === mirrorPath
          ? COVERAGE_CATEGORY.AUTO
          : COVERAGE_CATEGORY.PARTIAL;

        const { its } = countTestBlocks(testFile);
        // Heuristic: ≥10 it() blocks = FULL, ≥3 = PARTIAL
        if (its >= 10) {
          branchScore = PHI * 0.55; // ~0.89
          category    = COVERAGE_CATEGORY.FULL;
        } else if (its >= 3) {
          branchScore = PHI_INVERSE;
          category    = COVERAGE_CATEGORY.PARTIAL;
        } else {
          branchScore = 0.1;
        }

        // CSL alignment scoring
        try {
          const srcContent  = fs.readFileSync(sf, 'utf8');
          const testContent = fs.readFileSync(testFile, 'utf8');
          const srcNames    = extractSourceIntent(srcContent);
          const testDescs   = extractTestDescriptions(testContent);
          alignmentScore    = scoreTestAlignment(srcNames, testDescs);
        } catch (_) { /* best-effort */ }
      }

      records.push({
        sourceFile:     path.relative(SRC_ROOT, sf),
        testFile:       testFile ? path.relative(SRC_ROOT, testFile) : null,
        category,
        branchScore:    parseFloat(branchScore.toFixed(4)),
        alignmentScore: parseFloat(alignmentScore.toFixed(4)),
        isAuto,
      });
    }

    this._data = records;
    this.log.info('CoverageTracker.scan complete', { total: records.length });
    return records;
  }

  // -------------------------------------------------------------------------
  // getReport
  // -------------------------------------------------------------------------
  /**
   * Return summary statistics.
   */
  getReport() {
    if (!this._data) this.scan();

    const counts = {
      [COVERAGE_CATEGORY.FULL]:    0,
      [COVERAGE_CATEGORY.PARTIAL]: 0,
      [COVERAGE_CATEGORY.NONE]:    0,
      [COVERAGE_CATEGORY.AUTO]:    0,
    };

    for (const r of this._data) counts[r.category]++;

    const total = this._data.length;
    const coveragePercent = total
      ? (((counts.FULL + counts.PARTIAL * 0.5 + counts.AUTO * 0.25) / total) * 100).toFixed(2)
      : '0.00';

    return {
      total,
      counts,
      coveragePercent: `${coveragePercent}%`,
      phiThreshold: PHI_INVERSE,
      cslStats: (() => { try { return CSL.getStats(); } catch (_) { return null; } })(),
      records: this._data,
    };
  }

  // -------------------------------------------------------------------------
  // generateHTML
  // -------------------------------------------------------------------------
  /**
   * Write an HTML report to reports/test-coverage.html
   */
  generateHTML() {
    if (!this._data) this.scan();
    fs.mkdirSync(this.reportsDir, { recursive: true });

    const outPath = path.join(this.reportsDir, 'test-coverage.html');
    const report  = this.getReport();

    const rows = this._data.map(r => {
      const categoryClass = {
        FULL:    'full',
        PARTIAL: 'partial',
        NONE:    'none',
        AUTO:    'auto',
      }[r.category] || 'none';

      return `
      <tr class="${categoryClass}">
        <td>${r.sourceFile}</td>
        <td class="cat">${r.category}</td>
        <td>${(r.branchScore * 100).toFixed(1)}%</td>
        <td>${(r.alignmentScore * 100).toFixed(1)}%</td>
        <td>${r.testFile || '<em>none</em>'}</td>
        <td>${r.isAuto ? 'Yes' : 'No'}</td>
      </tr>`;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Heady Test Coverage Report</title>
  <style>
    body { font-family: sans-serif; margin: 20px; background: #1a1a2e; color: #eee; }
    h1   { color: #e2c96c; }
    .summary { display: flex; gap: 16px; margin-bottom: 24px; }
    .badge { padding: 8px 16px; border-radius: 6px; font-weight: bold; }
    .full    { background: #1a3a1a; }
    .partial { background: #3a3a1a; }
    .none    { background: #3a1a1a; }
    .auto    { background: #1a2a3a; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #444; padding: 8px 12px; text-align: left; font-size: 13px; }
    th { background: #2a2a4a; }
    .cat { font-weight: bold; text-transform: uppercase; font-size: 11px; }
    tr.full    td { color: #7ddf7d; }
    tr.partial td { color: #dfdf7d; }
    tr.none    td { color: #df7d7d; }
    tr.auto    td { color: #7db8df; }
    .phi { font-size: 11px; color: #888; margin-top: 8px; }
  </style>
</head>
<body>
  <h1>Heady Auto-Testing Framework — Coverage Report</h1>
  <p>Generated: ${new Date().toISOString()}</p>

  <div class="summary">
    <div class="badge full">FULL: ${report.counts.FULL}</div>
    <div class="badge partial">PARTIAL: ${report.counts.PARTIAL}</div>
    <div class="badge auto">AUTO: ${report.counts.AUTO}</div>
    <div class="badge none">NONE: ${report.counts.NONE}</div>
    <div class="badge" style="background:#2a2a4a">TOTAL: ${report.total}</div>
    <div class="badge" style="background:#3a2a4a">Coverage: ${report.coveragePercent}</div>
  </div>

  <p class="phi">φ threshold: ${PHI_INVERSE.toFixed(6)} | PHI: ${PHI.toFixed(6)}</p>

  <table>
    <thead>
      <tr>
        <th>Source File</th>
        <th>Category</th>
        <th>Branch Score</th>
        <th>CSL Alignment</th>
        <th>Test File</th>
        <th>Auto-Generated</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;

    fs.writeFileSync(outPath, html, 'utf8');
    this.log.info('HTML coverage report written', { outPath });
    return outPath;
  }

  // -------------------------------------------------------------------------
  // generateJSON
  // -------------------------------------------------------------------------
  /**
   * Write JSON report to reports/test-coverage.json
   */
  generateJSON() {
    if (!this._data) this.scan();
    fs.mkdirSync(this.reportsDir, { recursive: true });

    const outPath = path.join(this.reportsDir, 'test-coverage.json');
    const report  = this.getReport();

    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    this.log.info('JSON coverage report written', { outPath });
    return outPath;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  CoverageTracker,
  COVERAGE_CATEGORY,
};
