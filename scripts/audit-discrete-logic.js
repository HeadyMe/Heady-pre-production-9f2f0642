'use strict';

/**
 * audit-discrete-logic.js
 *
 * AST-free (regex + heuristic) scanner that discovers every discrete logic
 * construct in a JavaScript codebase and recommends CSL replacements.
 *
 * Classification:
 *   TYPE_A  — Semantic routing  (if/switch on string literals)
 *   TYPE_B  — Value boundary    (numeric threshold comparisons)
 *   TYPE_C  — Error handling    (null / error guards)
 *   TYPE_D  — Type guard        (typeof / instanceof / Array.isArray)
 */

const fs   = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

// ---------------------------------------------------------------------------
// Patterns registry
// ---------------------------------------------------------------------------
const PATTERNS = [
  // ── TYPE_A  Semantic routing ──────────────────────────────────────────────
  {
    id: 'A1',
    regex: /if\s*\(\s*\w[\w.]*\s*===?\s*['"][^'"]+['"]\s*\)/g,
    type: 'TYPE_A',
    description: 'Strict equality check against string literal',
    recommendation: 'Replace with SemanticRouter — register the string as an anchor and call semanticRouter.route(inputVector)',
    effort: 'medium',
  },
  {
    id: 'A2',
    regex: /switch\s*\(\s*[\w.]+\s*\)\s*\{[^}]*case\s+['"][^'"]+['"]\s*:/gs,
    type: 'TYPE_A',
    description: 'switch/case on string literal',
    recommendation: 'Replace switch block with SemanticRouter.route() — map each case string to an anchor',
    effort: 'medium',
  },
  {
    id: 'A3',
    regex: /\.\s*includes\s*\(\s*['"][^'"]+['"]\s*\)/g,
    type: 'TYPE_A',
    description: '.includes() check against string literal',
    recommendation: 'Replace .includes() check with SemanticRouter similarity gate (threshold ≥ PHI_INVERSE)',
    effort: 'low',
  },
  {
    id: 'A4',
    regex: /\.\s*startsWith\s*\(\s*['"][^'"]+['"]\s*\)/g,
    type: 'TYPE_A',
    description: '.startsWith() check against string literal',
    recommendation: 'Replace .startsWith() prefix gate with SemanticRouter anchor for prefix semantics',
    effort: 'low',
  },
  {
    id: 'A5',
    regex: /\b(?:command|type|action|task\.type|event\.type)\s*===?\s*['"][^'"]+['"]/g,
    type: 'TYPE_A',
    description: 'Domain-specific semantic routing property (command/type/action)',
    recommendation: 'Highest-priority CSL migration — replace with SemanticRouter.route() on intent vector',
    effort: 'medium',
  },
  {
    id: 'A6',
    regex: /\b(?:command|type|action|task\.type|event\.type)\s*!==?\s*['"][^'"]+['"]/g,
    type: 'TYPE_A',
    description: 'Domain-specific semantic NOT-routing property',
    recommendation: 'Replace inequality guard with orthogonal_gate or negated SemanticRouter activation',
    effort: 'medium',
  },

  // ── TYPE_B  Value boundary ────────────────────────────────────────────────
  {
    id: 'B1',
    regex: /if\s*\(\s*[\w.[\]]+\s*[><=!]{1,3}\s*\d+(?:\.\d+)?\s*\)/g,
    type: 'TYPE_B',
    description: 'Numeric threshold comparison in if-condition',
    recommendation: 'Replace with CSL.soft_gate(value, phiScale.value, 20) for continuous activation',
    effort: 'low',
  },
  {
    id: 'B2',
    regex: /[\w.[\]]+\s*[><=!]{1,3}\s*(?:threshold|limit|max|min|cutoff|score)\b/g,
    type: 'TYPE_B',
    description: 'Comparison against named threshold variable',
    recommendation: 'Replace with PhiScale-managed threshold + CSL.soft_gate or CSL.ternary_gate',
    effort: 'medium',
  },
  {
    id: 'B3',
    regex: /if\s*\(\s*[\w.[\]]+\s*(?:>=?|<=?)\s*(?:PHI|PHI_INVERSE|SQRT_PHI|PHI_SQUARED)\b/g,
    type: 'TYPE_B',
    description: 'Phi-constant threshold — already phi-aware but boolean',
    recommendation: 'Upgrade boolean to continuous: use CSL.soft_gate with matching phi constant',
    effort: 'low',
  },

  // ── TYPE_C  Error handling ────────────────────────────────────────────────
  {
    id: 'C1',
    regex: /if\s*\(\s*!\s*[\w.[\]]+\s*\)/g,
    type: 'TYPE_C',
    description: 'Falsy guard (!x)',
    recommendation: 'Keep guard; optionally wrap critical path with CSL.risk_gate for severity tracking',
    effort: 'low',
  },
  {
    id: 'C2',
    regex: /if\s*\(\s*[\w.[\]]+\s*===?\s*(?:null|undefined)\s*\)/g,
    type: 'TYPE_C',
    description: 'Explicit null/undefined check',
    recommendation: 'Keep as-is; consider CSL.risk_gate if null indicates degraded-state risk',
    effort: 'low',
  },
  {
    id: 'C3',
    regex: /if\s*\(\s*[\w.[\]]+\s*!==?\s*(?:null|undefined)\s*\)/g,
    type: 'TYPE_C',
    description: 'Truthy null/undefined guard',
    recommendation: 'Keep as-is; no CSL migration required',
    effort: 'low',
  },
  {
    id: 'C4',
    regex: /if\s*\(\s*err\b/g,
    type: 'TYPE_C',
    description: 'Error-first callback error guard',
    recommendation: 'Keep; wrap error path with CSL.risk_gate(severity, riskLimit) for circuit-breaker semantics',
    effort: 'medium',
  },
  {
    id: 'C5',
    regex: /\bcatch\s*\(\s*\w+\s*\)/g,
    type: 'TYPE_C',
    description: 'try/catch block',
    recommendation: 'Keep; add CSL.risk_gate inside catch handler to track risk accumulation',
    effort: 'medium',
  },
  {
    id: 'C6',
    regex: /\bthrow\s+(?:new\s+)?\w+/g,
    type: 'TYPE_C',
    description: 'Throw statement',
    recommendation: 'Keep; consider replacing assertion throws with SemanticConstraintViolation for CSL context',
    effort: 'low',
  },

  // ── TYPE_D  Type guard ────────────────────────────────────────────────────
  {
    id: 'D1',
    regex: /typeof\s+[\w.[\]]+\s*===?\s*['"][a-z]+['"]/g,
    type: 'TYPE_D',
    description: 'typeof equality check',
    recommendation: 'Keep as-is — type guards are structural, not semantic',
    effort: 'low',
  },
  {
    id: 'D2',
    regex: /[\w.[\]]+\s+instanceof\s+\w+/g,
    type: 'TYPE_D',
    description: 'instanceof check',
    recommendation: 'Keep as-is — structural type check, no CSL migration needed',
    effort: 'low',
  },
  {
    id: 'D3',
    regex: /Array\.isArray\s*\(/g,
    type: 'TYPE_D',
    description: 'Array.isArray() type check',
    recommendation: 'Keep as-is — structural type check, no CSL migration needed',
    effort: 'low',
  },
];

// ---------------------------------------------------------------------------
// AuditDiscreteLogic
// ---------------------------------------------------------------------------
class AuditDiscreteLogic {
  /**
   * @param {object} [options={}]
   * @param {boolean} [options.verbose=false]  Emit debug-level logs per finding
   */
  constructor(options = {}) {
    this.verbose   = options.verbose || false;
    this.patterns  = PATTERNS;
    this._scanned  = 0;   // files processed in last scanDirectory call
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Scan a single JS file and return an array of findings.
   *
   * @param {string} filePath  Absolute or relative path to the .js file
   * @returns {Array<Finding>}
   */
  scanFile(filePath) {
    let source;
    try {
      source = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      logger.warn(`[AuditDiscreteLogic] Cannot read file: ${filePath} — ${err.message}`);
      return [];
    }

    const lines   = source.split('\n');
    const findings = [];

    for (const pattern of this.patterns) {
      // Clone regex to reset lastIndex between files
      const re = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match;

      while ((match = re.exec(source)) !== null) {
        const pos    = this._offsetToLineCol(source, match.index);
        const snippet = this._extractSnippet(lines, pos.line - 1, 3);

        const finding = {
          file:           filePath,
          line:           pos.line,
          column:         pos.column,
          code:           snippet,
          type:           pattern.type,
          patternId:      pattern.id,
          pattern:        pattern.description,
          matched:        match[0].slice(0, 120),
          recommendation: pattern.recommendation,
          effort:         pattern.effort,
        };

        findings.push(finding);

        if (this.verbose) {
          logger.debug(
            `[Audit] ${pattern.type}/${pattern.id} @ ${filePath}:${pos.line}:${pos.column} — ${match[0].slice(0, 60)}`
          );
        }

        // Prevent infinite loop on zero-length matches
        if (match.index === re.lastIndex) re.lastIndex++;
      }
    }

    // De-duplicate: same line/col/type should only appear once
    return this._deduplicate(findings);
  }

  /**
   * Recursively scan a directory for JS files.
   *
   * @param {string} dirPath
   * @param {object} [options={}]
   * @param {string[]} [options.extensions=['.js']]
   * @param {string[]} [options.exclude=['node_modules','dist','.git']]
   * @param {number}   [options.maxDepth=10]
   * @returns {{ files: string[], findings: Finding[] }}
   */
  scanDirectory(dirPath, options = {}) {
    const extensions = options.extensions || ['.js'];
    const exclude    = options.exclude    || ['node_modules', 'dist', '.git', 'coverage', 'build'];
    const maxDepth   = options.maxDepth   != null ? options.maxDepth : 10;

    this._scanned = 0;
    const allFiles   = [];
    const allFindings = [];

    this._walkDir(dirPath, extensions, exclude, maxDepth, 0, allFiles);

    for (const file of allFiles) {
      const findings = this.scanFile(file);
      allFindings.push(...findings);
      this._scanned++;
    }

    logger.info(
      `[AuditDiscreteLogic] Scanned ${this._scanned} files — ${allFindings.length} findings in ${dirPath}`
    );

    return { files: allFiles, findings: allFindings };
  }

  /**
   * Generate a structured (JSON-serialisable) migration report.
   *
   * @param {Array<Finding>} findings
   * @param {string[]}       [scannedFiles=[]]
   * @returns {Report}
   */
  generateReport(findings, scannedFiles = []) {
    const byType = { TYPE_A: [], TYPE_B: [], TYPE_C: [], TYPE_D: [] };
    for (const f of findings) {
      if (byType[f.type]) byType[f.type].push(f);
    }

    // Per-file breakdown
    const fileMap = new Map();
    for (const f of findings) {
      if (!fileMap.has(f.file)) fileMap.set(f.file, []);
      fileMap.get(f.file).push(f);
    }

    const perFile = [];
    for (const [file, fList] of fileMap) {
      const typeCount = { TYPE_A: 0, TYPE_B: 0, TYPE_C: 0, TYPE_D: 0 };
      for (const f of fList) typeCount[f.type]++;

      const effortScore = fList.reduce((acc, f) => acc + EFFORT_SCORE[f.effort], 0);

      perFile.push({
        file,
        totalFindings: fList.length,
        byType: typeCount,
        estimatedEffort: effortScore,
        priority: typeCount.TYPE_A * 3 + typeCount.TYPE_B * 2,
      });
    }

    // Sort by priority desc
    perFile.sort((a, b) => b.priority - a.priority);

    const totalCSLCandidates = byType.TYPE_A.length + byType.TYPE_B.length;
    const totalFindings      = findings.length;
    const pctCandidates      = totalFindings > 0
      ? ((totalCSLCandidates / totalFindings) * 100).toFixed(1)
      : '0.0';

    const totalEffort = findings.reduce((acc, f) => acc + EFFORT_SCORE[f.effort], 0);

    return {
      summary: {
        filesScanned:          scannedFiles.length || this._scanned,
        totalFindings,
        byType:                { TYPE_A: byType.TYPE_A.length, TYPE_B: byType.TYPE_B.length, TYPE_C: byType.TYPE_C.length, TYPE_D: byType.TYPE_D.length },
        cslCandidates:         totalCSLCandidates,
        percentCSLCandidates:  `${pctCandidates}%`,
        estimatedTotalEffort:  totalEffort,
        effortLabel:           EFFORT_LABEL(totalEffort),
      },
      priorityRanking: perFile.slice(0, 20),
      perFile,
      findings,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate a human-readable Markdown report.
   *
   * @param {Array<Finding>} findings
   * @param {string[]}       [scannedFiles=[]]
   * @returns {string}
   */
  generateMarkdownReport(findings, scannedFiles = []) {
    const report = this.generateReport(findings, scannedFiles);
    const s      = report.summary;
    const lines  = [];

    lines.push('# CSL Discrete Logic Audit Report');
    lines.push('');
    lines.push(`Generated: ${report.generatedAt}`);
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Files scanned | ${s.filesScanned} |`);
    lines.push(`| Total findings | ${s.totalFindings} |`);
    lines.push(`| TYPE_A Semantic routing | ${s.byType.TYPE_A} |`);
    lines.push(`| TYPE_B Value boundary | ${s.byType.TYPE_B} |`);
    lines.push(`| TYPE_C Error handling | ${s.byType.TYPE_C} |`);
    lines.push(`| TYPE_D Type guard | ${s.byType.TYPE_D} |`);
    lines.push(`| CSL migration candidates | ${s.cslCandidates} (${s.percentCSLCandidates}) |`);
    lines.push(`| Estimated migration effort | ${s.effortLabel} (score: ${s.estimatedTotalEffort}) |`);
    lines.push('');

    lines.push('## Priority Migration Targets');
    lines.push('');
    lines.push('Files ranked by CSL migration priority (TYPE_A × 3 + TYPE_B × 2):');
    lines.push('');
    lines.push('| # | File | TYPE_A | TYPE_B | Priority | Effort |');
    lines.push('|---|------|--------|--------|----------|--------|');
    report.priorityRanking.forEach((pf, i) => {
      lines.push(
        `| ${i + 1} | \`${path.basename(pf.file)}\` | ${pf.byType.TYPE_A} | ${pf.byType.TYPE_B} | ${pf.priority} | ${pf.estimatedEffort} |`
      );
    });
    lines.push('');

    lines.push('## TYPE_A — Semantic Routing (Replace with SemanticRouter)');
    lines.push('');
    this._findingsSection(lines, findings.filter(f => f.type === 'TYPE_A'));

    lines.push('## TYPE_B — Value Boundaries (Replace with CSL gates)');
    lines.push('');
    this._findingsSection(lines, findings.filter(f => f.type === 'TYPE_B'));

    lines.push('## TYPE_C — Error Handling (Keep / add risk_gate)');
    lines.push('');
    this._findingsSection(lines, findings.filter(f => f.type === 'TYPE_C'));

    lines.push('## TYPE_D — Type Guards (Keep as-is)');
    lines.push('');
    this._findingsSection(lines, findings.filter(f => f.type === 'TYPE_D'));

    return lines.join('\n');
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Walk directory tree and collect file paths matching given extensions.
   * @private
   */
  _walkDir(dir, extensions, exclude, maxDepth, currentDepth, results) {
    if (currentDepth > maxDepth) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      logger.warn(`[AuditDiscreteLogic] Cannot read dir: ${dir} — ${err.message}`);
      return;
    }

    for (const entry of entries) {
      if (exclude.includes(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        this._walkDir(fullPath, extensions, exclude, maxDepth, currentDepth + 1, results);
      } else if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
        results.push(fullPath);
      }
    }
  }

  /**
   * Convert a character offset to { line, column } (1-based).
   * @private
   */
  _offsetToLineCol(source, offset) {
    const before = source.slice(0, offset);
    const line   = (before.match(/\n/g) || []).length + 1;
    const lastNL = before.lastIndexOf('\n');
    const column = offset - (lastNL === -1 ? 0 : lastNL + 1) + 1;
    return { line, column };
  }

  /**
   * Extract a N-line context snippet centred on targetLine.
   * @private
   */
  _extractSnippet(lines, lineIdx, contextLines = 2) {
    const start = Math.max(0, lineIdx - Math.floor(contextLines / 2));
    const end   = Math.min(lines.length - 1, lineIdx + Math.ceil(contextLines / 2));
    return lines.slice(start, end + 1).map((l, i) => {
      const no = start + i + 1;
      return `${String(no).padStart(4)}: ${l}`;
    }).join('\n');
  }

  /**
   * Remove duplicate findings (same file/line/column/type).
   * @private
   */
  _deduplicate(findings) {
    const seen = new Set();
    return findings.filter(f => {
      const key = `${f.file}:${f.line}:${f.column}:${f.type}:${f.patternId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Append a findings table to Markdown lines array.
   * @private
   */
  _findingsSection(lines, findings) {
    if (findings.length === 0) {
      lines.push('_No findings._');
      lines.push('');
      return;
    }
    lines.push(`**${findings.length} finding(s)**`);
    lines.push('');
    for (const f of findings) {
      lines.push(`### \`${path.basename(f.file)}\` line ${f.line}`);
      lines.push('');
      lines.push(`- **Pattern:** ${f.pattern}`);
      lines.push(`- **Matched:** \`${f.matched.replace(/`/g, "'")}\``);
      lines.push(`- **Effort:** ${f.effort}`);
      lines.push(`- **Recommendation:** ${f.recommendation}`);
      lines.push('');
      lines.push('```js');
      lines.push(f.code);
      lines.push('```');
      lines.push('');
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const EFFORT_SCORE = { low: 1, medium: 3, high: 8 };

function EFFORT_LABEL(score) {
  if (score <= 5)  return 'trivial';
  if (score <= 20) return 'minor';
  if (score <= 60) return 'moderate';
  if (score <= 150) return 'significant';
  return 'major';
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = { AuditDiscreteLogic };
