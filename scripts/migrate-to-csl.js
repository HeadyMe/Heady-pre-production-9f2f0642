'use strict';

/**
 * migrate-to-csl.js
 *
 * Automated migration tool that converts discrete logic findings produced by
 * AuditDiscreteLogic into CSL-flavoured JavaScript source code.
 *
 * Supports dry-run mode, unified-diff preview, per-file backups, and rollback.
 */

const fs   = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

// ---------------------------------------------------------------------------
// Utility: minimal unified-diff generator (no external deps)
// ---------------------------------------------------------------------------
function unifiedDiff(originalLines, newLines, filePath) {
  const header = [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
  ];

  const hunks = [];
  const CONTEXT = 3;
  let i = 0;
  let j = 0;

  // Simple LCS-free diff: compare line by line and emit replace hunks
  const maxLen = Math.max(originalLines.length, newLines.length);
  let hunkStart = null;
  const hunkLines = [];

  const flushHunk = () => {
    if (hunkLines.length === 0) return;
    hunks.push(`@@ -${hunkStart + 1} +${hunkStart + 1} @@`);
    hunks.push(...hunkLines);
    hunkLines.length = 0;
    hunkStart = null;
  };

  for (let ln = 0; ln < maxLen; ln++) {
    const orig = originalLines[ln];
    const next = newLines[ln];

    if (orig !== next) {
      if (hunkStart === null) hunkStart = Math.max(0, ln - CONTEXT);
      // Context before
      if (hunkLines.length === 0) {
        for (let c = hunkStart; c < ln; c++) {
          hunkLines.push(` ${originalLines[c] || ''}`);
        }
      }
      if (orig !== undefined) hunkLines.push(`-${orig}`);
      if (next !== undefined) hunkLines.push(`+${next}`);
    } else if (hunkStart !== null) {
      hunkLines.push(` ${orig}`);
      if (ln - hunkStart > CONTEXT * 2 + 5) {
        flushHunk();
      }
    }
  }
  flushHunk();

  if (hunks.length === 0) return null; // no changes
  return [...header, ...hunks].join('\n');
}

// ---------------------------------------------------------------------------
// MigrateToCSL
// ---------------------------------------------------------------------------
class MigrateToCSL {
  /**
   * @param {object} [options={}]
   * @param {boolean} [options.dryRun=true]     If true, never write to disk.
   * @param {string}  [options.backupDir]        Directory for .bak files. Defaults to {cwd}/.csl-backups
   * @param {string}  [options.reportPath]       Path to write migration report JSON.
   */
  constructor(options = {}) {
    this.dryRun     = options.dryRun !== false; // default true
    this.backupDir  = options.backupDir || path.join(process.cwd(), '.csl-backups');
    this.reportPath = options.reportPath || null;
    this._log       = [];  // in-memory migration log
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Migrate a single file based on audit findings.
   *
   * @param {string}          filePath   Absolute path to the source file
   * @param {Array<Finding>}  findings   Findings from AuditDiscreteLogic.scanFile()
   * @returns {{ filePath, originalCode, migratedCode, diff, changes, dryRun }}
   */
  migrateFile(filePath, findings) {
    let originalCode;
    try {
      originalCode = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      logger.error(`[MigrateToCSL] Cannot read: ${filePath} — ${err.message}`);
      return { filePath, error: err.message };
    }

    const sourceLines = originalCode.split('\n');
    let migratedLines = [...sourceLines];
    const changes     = [];

    // Sort findings in reverse-line order so replacements don't shift offsets
    const sortedFindings = [...findings].sort((a, b) => b.line - a.line);

    for (const finding of sortedFindings) {
      let result = null;

      if (finding.type === 'TYPE_A') {
        result = this._generateTypeAMigration(finding, migratedLines);
      } else if (finding.type === 'TYPE_B') {
        result = this._generateTypeBMigration(finding, migratedLines);
      }
      // TYPE_C and TYPE_D are kept as-is (no automated migration)

      if (result && result.lines) {
        // Splice the replacement lines in
        migratedLines.splice(result.startLine, result.deleteCount, ...result.lines);
        changes.push({
          type:        finding.type,
          line:        finding.line,
          original:    result.original,
          replacement: result.lines.join('\n'),
          note:        result.note,
        });
      }
    }

    // Add required imports if TYPE_A or TYPE_B migrations happened
    migratedLines = this._injectImports(migratedLines, findings);

    const migratedCode = migratedLines.join('\n');
    const diff = this.generateDiff(originalCode, migratedCode, filePath);

    const result = {
      filePath,
      originalCode,
      migratedCode,
      diff,
      changes,
      dryRun: this.dryRun,
    };

    this._log.push({
      file:     filePath,
      changes:  changes.length,
      dryRun:   this.dryRun,
      ts:       new Date().toISOString(),
    });

    if (!this.dryRun && changes.length > 0) {
      this.applyMigration(filePath, migratedCode);
    }

    return result;
  }

  /**
   * Generate a unified diff between two code strings.
   *
   * @param {string} originalCode
   * @param {string} migratedCode
   * @param {string} filePath
   * @returns {string|null}  Unified diff or null if no changes
   */
  generateDiff(originalCode, migratedCode, filePath) {
    const origLines = originalCode.split('\n');
    const newLines  = migratedCode.split('\n');
    return unifiedDiff(origLines, newLines, filePath);
  }

  /**
   * Write migrated code to disk (after backing up the original).
   *
   * @param {string} filePath
   * @param {string} migratedCode
   */
  applyMigration(filePath, migratedCode) {
    if (this.dryRun) {
      logger.info(`[MigrateToCSL] DRY-RUN — would write: ${filePath}`);
      return;
    }

    // Backup
    this._ensureBackupDir();
    const backupPath = this._backupPath(filePath);
    try {
      fs.copyFileSync(filePath, backupPath);
      logger.info(`[MigrateToCSL] Backed up: ${filePath} → ${backupPath}`);
    } catch (err) {
      logger.warn(`[MigrateToCSL] Backup failed for ${filePath}: ${err.message}`);
    }

    // Write migrated
    try {
      fs.writeFileSync(filePath, migratedCode, 'utf8');
      logger.info(`[MigrateToCSL] Migrated: ${filePath}`);
    } catch (err) {
      logger.error(`[MigrateToCSL] Write failed for ${filePath}: ${err.message}`);
    }
  }

  /**
   * Migrate all files from a complete audit report.
   *
   * @param {string}           dirPath        Root directory (for context)
   * @param {{ findings: Finding[] }} auditReport  Report from AuditDiscreteLogic.generateReport()
   * @returns {MigrationSummary}
   */
  migrateDirectory(dirPath, auditReport) {
    const plan    = this.generateMigrationPlan(auditReport);
    const results = [];

    for (const { file, findings } of plan) {
      logger.info(`[MigrateToCSL] Migrating: ${file}`);
      const result = this.migrateFile(file, findings);
      results.push(result);
    }

    const summary = {
      dirPath,
      totalFiles:   plan.length,
      migrated:     results.filter(r => !r.error && r.changes && r.changes.length > 0).length,
      unchanged:    results.filter(r => !r.error && r.changes && r.changes.length === 0).length,
      errors:       results.filter(r => r.error).length,
      dryRun:       this.dryRun,
      results,
      generatedAt:  new Date().toISOString(),
    };

    if (this.reportPath) {
      try {
        fs.writeFileSync(this.reportPath, JSON.stringify(summary, null, 2), 'utf8');
        logger.info(`[MigrateToCSL] Migration report written: ${this.reportPath}`);
      } catch (err) {
        logger.warn(`[MigrateToCSL] Could not write report: ${err.message}`);
      }
    }

    return summary;
  }

  /**
   * Return an ordered migration plan — files with most TYPE_A findings first,
   * then TYPE_B, then others.
   *
   * @param {{ findings: Finding[] }} auditReport
   * @returns {Array<{ file, findings, priority }>}
   */
  generateMigrationPlan(auditReport) {
    const findings = auditReport.findings || [];
    const fileMap  = new Map();

    for (const f of findings) {
      if (!fileMap.has(f.file)) fileMap.set(f.file, []);
      fileMap.get(f.file).push(f);
    }

    const plan = [];
    for (const [file, fList] of fileMap) {
      const typeA    = fList.filter(f => f.type === 'TYPE_A').length;
      const typeB    = fList.filter(f => f.type === 'TYPE_B').length;
      const priority = typeA * 3 + typeB * 2;
      plan.push({ file, findings: fList, typeA, typeB, priority });
    }

    plan.sort((a, b) => b.priority - a.priority);
    return plan;
  }

  /**
   * Return migration progress metrics.
   *
   * @param {{ findings: Finding[] }} auditReport
   * @param {string[]}                completedFiles
   * @returns {ProgressReport}
   */
  trackProgress(auditReport, completedFiles = []) {
    const plan       = this.generateMigrationPlan(auditReport);
    const total      = plan.length;
    const migrated   = completedFiles.length;
    const remaining  = total - migrated;
    const pct        = total > 0 ? ((migrated / total) * 100).toFixed(1) : '100.0';

    const remainingPlan = plan.filter(p => !completedFiles.includes(p.file));
    const effortLeft    = remainingPlan.reduce((acc, p) => {
      return acc + p.findings.reduce((a, f) => a + EFFORT_SCORE[f.effort], 0);
    }, 0);

    return {
      total,
      migrated,
      remaining,
      percentComplete:   `${pct}%`,
      estimatedEffort:   effortLeft,
      effortLabel:       EFFORT_LABEL(effortLeft),
      completedFiles,
      remainingFiles:    remainingPlan.map(p => p.file),
    };
  }

  /**
   * Restore a file from its backup.
   *
   * @param {string} filePath
   */
  rollback(filePath) {
    const backupPath = this._backupPath(filePath);
    if (!fs.existsSync(backupPath)) {
      logger.warn(`[MigrateToCSL] No backup found for: ${filePath}`);
      return false;
    }
    try {
      fs.copyFileSync(backupPath, filePath);
      logger.info(`[MigrateToCSL] Rolled back: ${filePath} ← ${backupPath}`);
      return true;
    } catch (err) {
      logger.error(`[MigrateToCSL] Rollback failed for ${filePath}: ${err.message}`);
      return false;
    }
  }

  // ── Private: per-type migration generators ────────────────────────────────

  /**
   * Generate TYPE_A (semantic routing) migration for a single finding.
   *
   * Strategy:
   *   1. Identify the line(s) containing the if/switch.
   *   2. Extract the string literals that are being compared.
   *   3. Emit anchor registration comments + SemanticRouter.route() usage.
   *   4. Wrap original branch code in CSL-style activated.find() guards.
   *
   * @param {Finding}  finding
   * @param {string[]} sourceLines  Current (possibly already-modified) source lines
   * @returns {{ startLine, deleteCount, lines, original, note }}
   * @private
   */
  _generateTypeAMigration(finding, sourceLines) {
    const lineIdx  = finding.line - 1;  // 0-based
    const lineText = sourceLines[lineIdx] || '';
    const indent   = this._detectIndent(lineText);

    // Extract string literals from the matched text
    const literals = this._extractStringLiterals(finding.matched || lineText);
    if (literals.length === 0) return null;

    // Build anchor IDs from the literals
    const anchors = literals.map(lit => ({
      id:          this._toAnchorId(lit),
      literal:     lit,
      description: `Semantic anchor for value '${lit}'`,
    }));

    const lines = [];

    // Emit anchor registration comments (developers should move to initialisation)
    lines.push(`${indent}// [CSL-MIGRATED TYPE_A] Original: ${lineText.trim().slice(0, 80)}`);
    lines.push(`${indent}// SemanticRouter anchors (register once at startup):`);
    for (const a of anchors) {
      lines.push(`${indent}// semanticRouter.register('${a.id}', '${a.description}');`);
    }

    // Determine the variable being compared (LHS of ===)
    const lhsMatch = (finding.matched || lineText).match(/\(\s*([\w.[\]]+)\s*===?/);
    const lhs      = lhsMatch ? lhsMatch[1] : 'inputValue';

    lines.push(`${indent}// Route using semantic similarity instead of strict equality`);
    lines.push(`${indent}const _routeResult_${anchors[0].id} = semanticRouter.route(${lhs}Vector || ${lhs});`);
    lines.push(`${indent}const _activated_${anchors[0].id} = _routeResult_${anchors[0].id}.filter(r => r.activated);`);
    lines.push('');

    // Replace the original if-line with a semantic activation check
    for (const a of anchors) {
      lines.push(
        `${indent}if (_activated_${anchors[0].id}.find(r => r.anchor === '${a.id}')) {`
      );
      lines.push(`${indent}  // TODO: original branch for '${a.literal}' goes here`);
      lines.push(`${indent}}`);
    }

    return {
      startLine:   lineIdx,
      deleteCount: 1,
      lines,
      original:    lineText,
      note:        `TYPE_A: replaced string routing on [${literals.join(', ')}] with SemanticRouter`,
    };
  }

  /**
   * Generate TYPE_B (value boundary) migration for a single finding.
   *
   * Strategy:
   *   1. Extract the threshold number.
   *   2. Replace the boolean comparison with CSL.soft_gate() for continuous activation.
   *
   * @param {Finding}  finding
   * @param {string[]} sourceLines
   * @returns {{ startLine, deleteCount, lines, original, note }}
   * @private
   */
  _generateTypeBMigration(finding, sourceLines) {
    const lineIdx  = finding.line - 1;
    const lineText = sourceLines[lineIdx] || '';
    const indent   = this._detectIndent(lineText);

    // Extract variable and threshold
    const numMatch = (finding.matched || lineText).match(
      /([\w.[\]]+)\s*([><=!]{1,3})\s*(\d+(?:\.\d+)?)/
    );
    if (!numMatch) return null;

    const variable  = numMatch[1];
    const operator  = numMatch[2];
    const threshold = numMatch[3];
    const varId     = this._toSafeId(variable);

    const lines = [];
    lines.push(`${indent}// [CSL-MIGRATED TYPE_B] Original: ${lineText.trim().slice(0, 80)}`);
    lines.push(`${indent}// Continuous activation replaces boolean threshold`);
    lines.push(`${indent}const _phiScale_${varId} = new PhiScale({`);
    lines.push(`${indent}  name: '${varId}', baseValue: ${threshold}, min: 0, max: ${threshold} * 2`);
    lines.push(`${indent}});`);
    lines.push(`${indent}const _activation_${varId} = CSL.soft_gate(${variable}, _phiScale_${varId}.value, 20);`);
    lines.push(`${indent}// _activation_${varId} is in [0, 1]  (was: ${variable} ${operator} ${threshold})`);
    lines.push(`${indent}if (_activation_${varId} > PHI_INVERSE) {`);
    lines.push(`${indent}  // TODO: original branch for (${variable} ${operator} ${threshold}) goes here`);
    lines.push(`${indent}}`);

    return {
      startLine:   lineIdx,
      deleteCount: 1,
      lines,
      original:    lineText,
      note:        `TYPE_B: replaced numeric threshold ${variable} ${operator} ${threshold} with CSL.soft_gate`,
    };
  }

  // ── Private: helpers ──────────────────────────────────────────────────────

  /**
   * Inject necessary CSL require() imports at the top of the file
   * if TYPE_A or TYPE_B migrations were made.
   * @private
   */
  _injectImports(lines, findings) {
    const hasTypeA = findings.some(f => f.type === 'TYPE_A');
    const hasTypeB = findings.some(f => f.type === 'TYPE_B');

    if (!hasTypeA && !hasTypeB) return lines;

    // Find the last existing require() line or 'use strict'
    let insertIdx = 0;
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      if (lines[i].includes("'use strict'") || lines[i].includes('"use strict"')) {
        insertIdx = i + 1;
      }
      if (lines[i].startsWith('const ') && lines[i].includes('require(')) {
        insertIdx = i + 1;
      }
    }

    const imports = [];
    imports.push('// [CSL-MIGRATED] Required CSL imports');

    if (hasTypeA) {
      // Only add if not already present
      if (!lines.join('\n').includes('SemanticRouter')) {
        imports.push("const { SemanticRouter } = require('../intelligence/semantic-router');");
        imports.push('const semanticRouter = new SemanticRouter();');
      }
    }

    if (hasTypeB) {
      if (!lines.join('\n').includes('PhiScale')) {
        imports.push("const { PhiScale, PHI_INVERSE } = require('../core/phi-scales');");
      }
      if (!lines.join('\n').includes("require('../core/semantic-logic')")) {
        imports.push("const CSL = require('../core/semantic-logic');");
      }
    }

    if (imports.length <= 1) return lines; // only the comment

    return [
      ...lines.slice(0, insertIdx),
      ...imports,
      '',
      ...lines.slice(insertIdx),
    ];
  }

  /** Extract quoted string literals from a code snippet. @private */
  _extractStringLiterals(code) {
    const results = [];
    const re      = /['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(code)) !== null) {
      results.push(m[1]);
    }
    return results;
  }

  /** Convert a string literal to a safe camelCase anchor ID. @private */
  _toAnchorId(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+(.)/g, (_, c) => c.toUpperCase())
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 40) || 'anchor';
  }

  /** Convert a variable name to a safe JS identifier. @private */
  _toSafeId(str) {
    return str.replace(/[^a-zA-Z0-9_$]/g, '_').slice(0, 30) || 'val';
  }

  /** Detect leading whitespace from a source line. @private */
  _detectIndent(line) {
    const m = line.match(/^(\s*)/);
    return m ? m[1] : '';
  }

  /** Build the backup file path for a given source file. @private */
  _backupPath(filePath) {
    const rel     = path.relative(process.cwd(), filePath).replace(/\//g, '__');
    const base    = `${rel}.bak`;
    return path.join(this.backupDir, base);
  }

  _ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers (shared with audit module logic)
// ---------------------------------------------------------------------------
const EFFORT_SCORE = { low: 1, medium: 3, high: 8 };

function EFFORT_LABEL(score) {
  if (score <= 5)   return 'trivial';
  if (score <= 20)  return 'minor';
  if (score <= 60)  return 'moderate';
  if (score <= 150) return 'significant';
  return 'major';
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = { MigrateToCSL };
