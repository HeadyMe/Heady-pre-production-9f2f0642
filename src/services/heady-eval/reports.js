'use strict';

/**
 * HeadyEval Reports
 *
 * Generates evaluation reports with:
 *  - Summary statistics (mean, median, std, min, max)
 *  - Per-example detailed results
 *  - Model comparison tables
 *  - Score distribution histograms (data)
 *  - HTML, JSON, CSV exports
 *  - Trend tracking across runs
 */

const config = require('./config');

// ─── Statistics helpers ───────────────────────────────────────────────────────

function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function sortedArr(arr) {
  return [...arr].sort((a, b) => a - b);
}

function median(arr) {
  if (!arr.length) return null;
  const s = sortedArr(arr);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function stddev(arr) {
  if (arr.length < 2) return null;
  const m = mean(arr);
  const variance = arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function percentile(arr, p) {
  if (!arr.length) return null;
  const s = sortedArr(arr);
  const idx = (p / 100) * (s.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  return lower === upper ? s[lower] : s[lower] + (idx - lower) * (s[upper] - s[lower]);
}

function histogram(arr, bins = 5) {
  if (!arr.length) return [];
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const range = max - min || 1;
  const binWidth = range / bins;
  const counts = Array(bins).fill(0);
  for (const val of arr) {
    let binIdx = Math.floor((val - min) / binWidth);
    if (binIdx >= bins) binIdx = bins - 1;
    counts[binIdx]++;
  }
  return Array.from({ length: bins }, (_, i) => ({
    from: parseFloat((min + i * binWidth).toFixed(3)),
    to: parseFloat((min + (i + 1) * binWidth).toFixed(3)),
    count: counts[i],
    frequency: parseFloat((counts[i] / arr.length).toFixed(4)),
  }));
}

function fmt(n) {
  return n === null || n === undefined ? null : parseFloat(n.toFixed(4));
}

// ─── Report generator ─────────────────────────────────────────────────────────

class ReportGenerator {
  /**
   * Build a comprehensive report from an EvalRun.
   *
   * @param {EvalRun} run
   * @param {object}  [opts]
   * @param {boolean} [opts.includeExamples=true]  - Include per-example breakdown
   * @param {boolean} [opts.includeHistograms=true]
   * @returns {object} report
   */
  buildReport(run, opts = {}) {
    const includeExamples = opts.includeExamples !== false;
    const includeHistograms = opts.includeHistograms !== false;

    const scorerStats = this._computeScorerStats(run.results, includeHistograms);
    const overallStats = this._computeOverallStats(run.results);

    const report = {
      runId: run.id,
      runName: run.name,
      status: run.status,
      createdAt: run.createdAt,
      completedAt: run.completedAt,
      durationMs: run.durationMs,
      totalExamples: run.totalExamples,
      processedExamples: run.processedExamples,
      failedExamples: run.failedExamples,
      passRate: overallStats.passRate,
      overall: overallStats,
      scorers: scorerStats,
      costEstimate: run.costEstimate || null,
      metadata: run.metadata || {},
    };

    if (includeExamples) {
      report.examples = run.results.map((r) => this._formatExampleResult(r));
    }

    return report;
  }

  _computeScorerStats(results, includeHistograms) {
    const byScorer = {};

    for (const result of results) {
      for (const [scorerName, sr] of Object.entries(result.scorerResults || {})) {
        if (!byScorer[scorerName]) {
          byScorer[scorerName] = { scores: [], passes: 0, errors: 0, dimensions: {} };
        }
        const s = byScorer[scorerName];
        if (sr.score !== null) {
          s.scores.push(sr.score);
          if (sr.pass) s.passes++;
        }
        if (sr.error) s.errors++;

        // Collect dimension scores
        for (const [dim, dimScore] of Object.entries(sr.breakdown || {})) {
          if (dimScore !== null && dimScore !== undefined) {
            if (!s.dimensions[dim]) s.dimensions[dim] = [];
            s.dimensions[dim].push(dimScore);
          }
        }
      }
    }

    const stats = {};
    for (const [name, data] of Object.entries(byScorer)) {
      const { scores, passes, errors, dimensions } = data;
      const dimStats = {};
      for (const [dim, vals] of Object.entries(dimensions)) {
        dimStats[dim] = {
          mean: fmt(mean(vals)),
          median: fmt(median(vals)),
          std: fmt(stddev(vals)),
          min: fmt(Math.min(...vals)),
          max: fmt(Math.max(...vals)),
          p25: fmt(percentile(vals, 25)),
          p75: fmt(percentile(vals, 75)),
        };
      }

      stats[name] = {
        sampleCount: scores.length,
        errorCount: errors,
        passCount: passes,
        passRate: scores.length > 0 ? fmt(passes / scores.length) : null,
        mean: fmt(mean(scores)),
        median: fmt(median(scores)),
        std: fmt(stddev(scores)),
        min: scores.length ? fmt(Math.min(...scores)) : null,
        max: scores.length ? fmt(Math.max(...scores)) : null,
        p25: fmt(percentile(scores, 25)),
        p75: fmt(percentile(scores, 75)),
        dimensions: dimStats,
        ...(includeHistograms && { histogram: histogram(scores) }),
      };
    }
    return stats;
  }

  _computeOverallStats(results) {
    const aggregates = results
      .map((r) => r.aggregateScore)
      .filter((s) => s !== null);

    const passes = results.filter((r) => r.pass).length;

    return {
      sampleCount: aggregates.length,
      passCount: passes,
      passRate: aggregates.length > 0 ? fmt(passes / results.length) : null,
      mean: fmt(mean(aggregates)),
      median: fmt(median(aggregates)),
      std: fmt(stddev(aggregates)),
      min: aggregates.length ? fmt(Math.min(...aggregates)) : null,
      max: aggregates.length ? fmt(Math.max(...aggregates)) : null,
    };
  }

  _formatExampleResult(r) {
    return {
      exampleId: r.exampleId,
      input: r.input,
      output: r.output,
      expected_output: r.expected_output,
      aggregateScore: r.aggregateScore,
      pass: r.pass,
      durationMs: r.durationMs,
      scorers: Object.fromEntries(
        Object.entries(r.scorerResults || {}).map(([name, sr]) => [
          name,
          {
            score: sr.score,
            pass: sr.pass,
            breakdown: sr.breakdown,
            explanation: sr.explanation,
            error: sr.error || null,
          },
        ])
      ),
      error: r.error || null,
    };
  }

  /**
   * Build a model comparison table from multiple runs.
   *
   * @param {Array<{run: EvalRun, modelName: string}>} runModels
   * @returns {object} comparison
   */
  buildComparisonReport(runModels) {
    const rows = runModels.map(({ run, modelName }) => {
      const report = this.buildReport(run, { includeExamples: false, includeHistograms: false });
      return {
        modelName: modelName || run.name,
        runId: run.id,
        overall: report.overall,
        scorers: Object.fromEntries(
          Object.entries(report.scorers).map(([name, s]) => [
            name,
            { mean: s.mean, passRate: s.passRate },
          ])
        ),
      };
    });

    // Determine best model per scorer
    const allScorerNames = [...new Set(rows.flatMap((r) => Object.keys(r.scorers)))];
    const winners = {};
    for (const scorer of allScorerNames) {
      const scored = rows
        .filter((r) => r.scorers[scorer]?.mean !== null)
        .sort((a, b) => (b.scorers[scorer]?.mean || 0) - (a.scorers[scorer]?.mean || 0));
      winners[scorer] = scored[0]?.modelName || null;
    }

    // Overall winner by aggregate mean
    const overallWinner = [...rows]
      .filter((r) => r.overall.mean !== null)
      .sort((a, b) => (b.overall.mean || 0) - (a.overall.mean || 0))[0]?.modelName || null;

    return {
      models: rows,
      winners,
      overallWinner,
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── Export formats ──────────────────────────────────────────────────────

  /**
   * Export report to JSON string.
   */
  toJSON(report) {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Export report examples to CSV.
   */
  toCSV(report) {
    if (!report.examples || report.examples.length === 0) {
      return 'No examples in report';
    }

    const scorerNames = Object.keys(report.examples[0]?.scorers || {});
    const headers = [
      'example_id',
      'input',
      'output',
      'expected_output',
      'aggregate_score',
      'pass',
      'duration_ms',
      ...scorerNames.map((s) => `${s}_score`),
      ...scorerNames.map((s) => `${s}_pass`),
      ...scorerNames.map((s) => `${s}_explanation`),
      'error',
    ];

    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const rows = [headers.join(',')];
    for (const ex of report.examples) {
      const row = [
        ex.exampleId,
        ex.input,
        ex.output || '',
        ex.expected_output || '',
        ex.aggregateScore,
        ex.pass,
        ex.durationMs,
        ...scorerNames.map((s) => ex.scorers[s]?.score ?? ''),
        ...scorerNames.map((s) => ex.scorers[s]?.pass ?? ''),
        ...scorerNames.map((s) => ex.scorers[s]?.explanation || ''),
        ex.error || '',
      ];
      rows.push(row.map(escape).join(','));
    }
    return rows.join('\n');
  }

  /**
   * Export report to HTML string.
   */
  toHTML(report) {
    const pct = (n) => (n !== null && n !== undefined ? `${Math.round(n * 100)}%` : 'N/A');
    const num = (n) => (n !== null && n !== undefined ? n.toFixed(3) : 'N/A');

    const scorerRows = Object.entries(report.scorers || {})
      .map(([name, s]) => `
        <tr>
          <td><strong>${name}</strong></td>
          <td>${num(s.mean)}</td>
          <td>${num(s.median)}</td>
          <td>${num(s.std)}</td>
          <td>${num(s.min)}</td>
          <td>${num(s.max)}</td>
          <td>${pct(s.passRate)}</td>
          <td>${s.sampleCount}</td>
          <td>${s.errorCount}</td>
        </tr>`).join('');

    const exampleRows = (report.examples || []).slice(0, 50)
      .map((ex) => {
        const scorerCells = Object.entries(ex.scorers || {})
          .map(([name, sr]) => `<td class="${sr.pass ? 'pass' : 'fail'}">${sr.score !== null ? sr.score.toFixed(2) : 'N/A'}</td>`)
          .join('');
        return `
        <tr class="${ex.pass ? 'pass-row' : 'fail-row'}">
          <td title="${ex.exampleId}">${(ex.input || '').slice(0, 80)}...</td>
          <td>${ex.aggregateScore !== null ? ex.aggregateScore.toFixed(3) : 'N/A'}</td>
          ${scorerCells}
        </tr>`;
      }).join('');

    const scorerHeaders = Object.keys(report.scorers || {})
      .map((n) => `<th>${n}</th>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>HeadyEval Report — ${report.runName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
    h1, h2 { margin-bottom: 1rem; }
    h1 { font-size: 1.8rem; color: #f8fafc; }
    h2 { font-size: 1.2rem; color: #94a3b8; margin-top: 2rem; }
    .card { background: #1e293b; border-radius: 0.75rem; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid #334155; }
    .meta { display: flex; gap: 2rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .meta-item { }
    .meta-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .meta-value { font-size: 1.4rem; font-weight: 700; color: #f1f5f9; }
    .pass { color: #34d399; } .fail { color: #f87171; }
    .pass-row td:first-child { border-left: 3px solid #34d399; }
    .fail-row td:first-child { border-left: 3px solid #f87171; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th { background: #0f172a; color: #94a3b8; padding: 0.5rem 0.75rem; text-align: left; font-weight: 600; }
    td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #1e293b; color: #cbd5e1; }
    tr:hover td { background: #0f172a; }
    .badge { display: inline-block; padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .badge-completed { background: #064e3b; color: #34d399; }
    .badge-failed { background: #450a0a; color: #f87171; }
    .badge-running { background: #1e3a5f; color: #60a5fa; }
  </style>
</head>
<body>
  <h1>HeadyEval Report</h1>
  <div class="card">
    <div class="meta">
      <div class="meta-item"><div class="meta-label">Run</div><div class="meta-value">${report.runName}</div></div>
      <div class="meta-item"><div class="meta-label">Status</div><div class="meta-value"><span class="badge badge-${report.status}">${report.status}</span></div></div>
      <div class="meta-item"><div class="meta-label">Examples</div><div class="meta-value">${report.processedExamples}</div></div>
      <div class="meta-item"><div class="meta-label">Pass Rate</div><div class="meta-value ${(report.overall?.passRate || 0) >= 0.7 ? 'pass' : 'fail'}">${pct(report.overall?.passRate)}</div></div>
      <div class="meta-item"><div class="meta-label">Avg Score</div><div class="meta-value">${num(report.overall?.mean)}</div></div>
      <div class="meta-item"><div class="meta-label">Duration</div><div class="meta-value">${report.durationMs ? (report.durationMs / 1000).toFixed(1) + 's' : 'N/A'}</div></div>
    </div>
  </div>

  <h2>Scorer Summary</h2>
  <div class="card">
    <table>
      <thead><tr><th>Scorer</th><th>Mean</th><th>Median</th><th>Std</th><th>Min</th><th>Max</th><th>Pass Rate</th><th>Samples</th><th>Errors</th></tr></thead>
      <tbody>${scorerRows}</tbody>
    </table>
  </div>

  <h2>Examples (top 50)</h2>
  <div class="card">
    <table>
      <thead><tr><th>Input</th><th>Aggregate</th>${scorerHeaders}</tr></thead>
      <tbody>${exampleRows}</tbody>
    </table>
  </div>

  <p style="color:#475569; font-size:0.75rem; margin-top:2rem;">
    Generated by HeadyEval · Run ID: ${report.runId} · ${report.createdAt}
  </p>
</body>
</html>`;
  }

  // ─── Trend tracking ──────────────────────────────────────────────────────

  /**
   * Compare multiple reports over time and return trend data.
   * @param {object[]} reports  - Array of reports, ordered oldest → newest
   * @returns {object} trends
   */
  buildTrends(reports) {
    const scorerNames = [...new Set(reports.flatMap((r) => Object.keys(r.scorers || {})))];
    const trends = {};

    for (const scorer of scorerNames) {
      trends[scorer] = reports.map((r) => ({
        runId: r.runId,
        runName: r.runName,
        date: r.createdAt,
        mean: r.scorers[scorer]?.mean ?? null,
        passRate: r.scorers[scorer]?.passRate ?? null,
      }));
    }

    trends._overall = reports.map((r) => ({
      runId: r.runId,
      runName: r.runName,
      date: r.createdAt,
      mean: r.overall?.mean ?? null,
      passRate: r.overall?.passRate ?? null,
    }));

    return trends;
  }
}

module.exports = { ReportGenerator, mean, median, stddev, percentile, histogram };
