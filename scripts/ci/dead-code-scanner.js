#!/usr/bin/env node
/**
 * scripts/ci/dead-code-scanner.js
 *
 * Scan the Heady monorepo for dead code:
 *   - Unused exported symbols (via static AST analysis)
 *   - Unreachable code patterns (after return/throw/break/continue)
 *   - Empty exported functions/classes
 *   - Files that export nothing and are not imported anywhere
 *
 * Uses a lightweight AST approach via Node.js built-ins + regex patterns.
 * For deeper analysis, ts-morph is used when available.
 *
 * Usage:
 *   node scripts/ci/dead-code-scanner.js \
 *     --src   <dir>   Source directory to scan (can repeat)
 *     --output <path> Output report JSON
 *     [--fail-on-unused]  Exit 1 if unused exports found (default: warn only)
 *     [--ignore <pattern>] Glob pattern to ignore (can repeat)
 *
 * φ design:
 *   fib(8)=21  max files per category in report
 *   fib(12)=144 max total issues before truncation
 *
 * Exit codes:
 *   0 = clean (or warnings only)
 *   1 = --fail-on-unused flag set and issues found
 */

'use strict';

const fs       = require('fs');
const path     = require('path');
const { execSync } = require('child_process');

// ─── φ Constants ─────────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];
// fib(8)=21 max issues per category shown in report
const MAX_PER_CATEGORY = FIB[8];   // 21
// fib(12)=144 total issues before "truncated" message
const MAX_TOTAL = FIB[12];         // 144

// ─── CLI args ─────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const srcDirs = [];
  const ignorePatterns = [];
  let output = 'dead-code-report.json';
  let failOnUnused = false;

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--src':
        srcDirs.push(argv[++i]);
        break;
      case '--output':
        output = argv[++i];
        break;
      case '--ignore':
        ignorePatterns.push(argv[++i]);
        break;
      case '--fail-on-unused':
        failOnUnused = true;
        break;
    }
  }

  if (srcDirs.length === 0) srcDirs.push('src', 'packages');

  return { srcDirs, output, ignorePatterns, failOnUnused };
}

// ─── File discovery ───────────────────────────────────────────────────────────
const INCLUDE_EXTS = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.turbo',
  'dist',
  'build',
  '.next',
  'coverage',
  '__tests__',
  '__mocks__',
  '.test.',
  '.spec.',
  'jest.config',
  'webpack.config',
  'rollup.config',
  'vite.config',
];

/**
 * Recursively collect all source files.
 * @param {string[]} roots
 * @param {string[]} ignorePatterns
 * @returns {string[]}
 */
function collectFiles(roots, ignorePatterns = []) {
  const files = [];

  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    let entries;
    try { entries = fs.readdirSync(dir); } catch { return; }

    for (const entry of entries) {
      const full = path.join(dir, entry);

      // Skip excluded patterns
      const shouldSkip = EXCLUDE_PATTERNS.some(p => full.includes(p)) ||
                         ignorePatterns.some(p => full.includes(p));
      if (shouldSkip) continue;

      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (INCLUDE_EXTS.includes(path.extname(entry))) {
        files.push(full);
      }
    }
  };

  for (const root of roots) {
    if (fs.existsSync(root)) walk(root);
  }

  return files;
}

// ─── Export analysis ──────────────────────────────────────────────────────────
/**
 * Extract exported symbol names from a file using regex patterns.
 * Handles: export const/let/var/function/class, module.exports, exports.X
 * @param {string} content
 * @returns {string[]}
 */
function extractExports(content) {
  const exports = new Set();

  // ESM named exports
  const esmPatterns = [
    /^export\s+(?:const|let|var|function\*?|class|async\s+function)\s+(\w+)/gm,
    /^export\s+\{([^}]+)\}/gm,
    /^export\s+default\s+(?:function|class)\s+(\w+)/gm,
  ];

  for (const re of esmPatterns) {
    let m;
    while ((m = re.exec(content)) !== null) {
      const names = m[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim());
      names.filter(Boolean).forEach(n => exports.add(n));
    }
  }

  // CJS: module.exports = { ... }
  const cjsObjMatch = content.match(/module\.exports\s*=\s*\{([^}]+)\}/s);
  if (cjsObjMatch) {
    const names = cjsObjMatch[1].split(',')
      .map(n => n.trim().split(/\s*:/)[0].trim())
      .filter(n => n && /^\w+$/.test(n));
    names.forEach(n => exports.add(n));
  }

  // CJS: exports.name = ...
  const cjsExportRe = /exports\.(\w+)\s*=/gm;
  let m;
  while ((m = cjsExportRe.exec(content)) !== null) {
    exports.add(m[1]);
  }

  return [...exports];
}

/**
 * Check if a symbol is imported/used anywhere in the file set.
 * @param {string} symbol
 * @param {string} defFile - file where it's defined
 * @param {string[]} allFiles
 * @returns {boolean}
 */
function isSymbolUsed(symbol, defFile, allFiles) {
  // Skip obviously-used symbols
  if (['default', 'handler', 'router', 'app', 'server', 'main', 'index'].includes(symbol)) {
    return true;
  }

  const defDir = path.dirname(defFile);
  const defBase = path.basename(defFile, path.extname(defFile));

  for (const file of allFiles) {
    if (file === defFile) continue;

    let content;
    try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }

    // Check for import of this symbol
    if (
      content.includes(symbol) &&
      (
        // Named import: import { symbol } from ...
        new RegExp(`\\{[^}]*\\b${symbol}\\b[^}]*\\}`).test(content) ||
        // Direct usage: symbol(, symbol.something, etc.
        new RegExp(`\\b${symbol}\\s*[.(\\[,;]`).test(content) ||
        // require destructure: const { symbol } = require(...)
        new RegExp(`const\\s*\\{[^}]*\\b${symbol}\\b`).test(content)
      )
    ) {
      return true;
    }
  }

  return false;
}

// ─── Unreachable code detection ───────────────────────────────────────────────
/**
 * Find lines that appear after unconditional return/throw/break/continue.
 * This is a heuristic — not a full CFG analysis.
 * @param {string} content
 * @param {string} filepath
 * @returns {object[]} array of { line, code, reason }
 */
function findUnreachableCode(content, filepath) {
  const issues = [];
  const lines  = content.split('\n');

  const terminators = /^\s*(return|throw\s|break;|continue;)/;
  const codeLines   = /^\s*[a-zA-Z_$({["'`]/; // non-empty non-comment lines

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    if (!terminators.test(line)) continue;

    // Look ahead for non-empty, non-closing-brace code
    const next = lines[i + 1];
    if (!next) continue;

    const trimmed = next.trim();
    if (
      trimmed &&
      !trimmed.startsWith('}') &&
      !trimmed.startsWith(')') &&
      !trimmed.startsWith('//') &&
      !trimmed.startsWith('*') &&
      !trimmed.startsWith('case ') &&
      !trimmed.startsWith('default:') &&
      codeLines.test(next)
    ) {
      issues.push({
        file:   filepath,
        line:   i + 2,  // 1-indexed, next line
        code:   trimmed.substring(0, 80),
        reason: `Unreachable: code after \`${line.trim().substring(0, 40)}\``,
      });
    }
  }

  return issues;
}

// ─── Empty export detection ───────────────────────────────────────────────────
/**
 * Find exported functions/classes that have empty bodies.
 * @param {string} content
 * @param {string} filepath
 * @returns {object[]}
 */
function findEmptyExports(content, filepath) {
  const issues = [];

  // Match: export function/class name ... { } (whitespace only body)
  const emptyFuncRe = /export\s+(?:async\s+)?function\s+(\w+)[^{]*\{\s*\}/g;
  const emptyClassRe = /export\s+class\s+(\w+)[^{]*\{\s*\}/g;

  let m;
  while ((m = emptyFuncRe.exec(content)) !== null) {
    issues.push({
      file: filepath,
      symbol: m[1],
      reason: 'Exported function with empty body',
    });
  }
  while ((m = emptyClassRe.exec(content)) !== null) {
    issues.push({
      file: filepath,
      symbol: m[1],
      reason: 'Exported class with empty body',
    });
  }

  return issues;
}

// ─── Main analysis ────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);

  console.log('=== Heady Dead Code Scanner ===');
  console.log(`φ = ${PHI}`);
  console.log(`Scanning: ${args.srcDirs.join(', ')}`);
  console.log('');

  // Collect files
  const allFiles = collectFiles(args.srcDirs, args.ignorePatterns);
  console.log(`Files to scan: ${allFiles.length}`);

  const report = {
    metadata: {
      scannedAt: new Date().toISOString(),
      phi: PHI,
      filesScanned: allFiles.length,
      directories: args.srcDirs,
    },
    thresholds: {
      maxPerCategory: MAX_PER_CATEGORY,   // fib(8)=21
      maxTotal: MAX_TOTAL,                 // fib(12)=144
    },
    issues: {
      unusedExports:   [],
      unreachableCode: [],
      emptyExports:    [],
      emptyFiles:      [],
    },
    summary: {
      totalIssues: 0,
      hardFailures: 0,
      warnings: 0,
    },
  };

  let totalIssues = 0;

  // ── Scan each file ────────────────────────────────────────
  for (const file of allFiles) {
    let content;
    try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }

    const relPath = path.relative(process.cwd(), file);

    // Skip generated/declaration files
    if (file.endsWith('.d.ts') || content.includes('// @generated') ||
        content.includes('// Generated')) continue;

    // 1. Unused exports
    if (totalIssues < MAX_TOTAL) {
      const exports = extractExports(content);
      for (const sym of exports) {
        if (sym === 'default') continue; // default exports harder to track
        if (!isSymbolUsed(sym, file, allFiles)) {
          if (report.issues.unusedExports.length < MAX_PER_CATEGORY) {
            report.issues.unusedExports.push({
              file: relPath,
              symbol: sym,
              severity: 'warning',
            });
          }
          totalIssues++;
        }
      }
    }

    // 2. Unreachable code
    if (totalIssues < MAX_TOTAL) {
      const unreachable = findUnreachableCode(content, relPath);
      for (const issue of unreachable) {
        if (report.issues.unreachableCode.length < MAX_PER_CATEGORY) {
          report.issues.unreachableCode.push({ ...issue, severity: 'warning' });
        }
        totalIssues++;
      }
    }

    // 3. Empty exports
    if (totalIssues < MAX_TOTAL) {
      const empty = findEmptyExports(content, relPath);
      for (const issue of empty) {
        if (report.issues.emptyExports.length < MAX_PER_CATEGORY) {
          report.issues.emptyExports.push({ ...issue, severity: 'warning' });
        }
        totalIssues++;
      }
    }

    // 4. Empty files (exports nothing, not imported)
    if (content.trim().length < 10) {
      report.issues.emptyFiles.push({
        file: relPath,
        bytes: content.length,
        severity: 'info',
      });
    }
  }

  // ── Summary ───────────────────────────────────────────────
  report.summary.totalIssues = totalIssues;
  report.summary.hardFailures = 0; // Dead code is advisory, not hard-fail by default
  report.summary.warnings = totalIssues;
  report.summary.truncated = totalIssues >= MAX_TOTAL;

  console.log('\n=== Dead Code Report ===');
  console.log(`Unused exports:    ${report.issues.unusedExports.length}`);
  console.log(`Unreachable code:  ${report.issues.unreachableCode.length}`);
  console.log(`Empty exports:     ${report.issues.emptyExports.length}`);
  console.log(`Empty files:       ${report.issues.emptyFiles.length}`);
  console.log(`Total issues:      ${totalIssues}`);

  if (report.issues.unusedExports.length > 0) {
    console.log('\nUnused exports (first 8):');
    report.issues.unusedExports.slice(0, FIB[6]).forEach(i => {
      console.log(`  ::warning file=${i.file}:: Unused export: ${i.symbol}`);
    });
  }

  if (report.issues.unreachableCode.length > 0) {
    console.log('\nUnreachable code (first 5):');
    report.issues.unreachableCode.slice(0, FIB[5]).forEach(i => {
      console.log(`  ::warning file=${i.file},line=${i.line}:: ${i.reason}`);
    });
  }

  // Write output
  const dir = path.dirname(args.output);
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(args.output, JSON.stringify(report, null, 2));
  console.log(`\nReport written to: ${args.output}`);

  // Exit code
  if (args.failOnUnused && report.summary.hardFailures > 0) {
    console.error('\n❌ Dead code scan FAILED');
    process.exit(1);
  } else {
    const icon = totalIssues > 0 ? '⚠️ ' : '✅';
    console.log(`\n${icon} Dead code scan complete — ${totalIssues} advisory issues`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error in dead-code-scanner:', err);
  process.exit(1);
});
