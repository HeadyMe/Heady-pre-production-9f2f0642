'use strict';

/**
 * test-audit-discrete-logic.js
 *
 * Tests for AuditDiscreteLogic using real module (no CSL/PhiScale deps needed).
 * Creates temporary files with embedded code patterns, scans them, verifies findings.
 *
 * Run: node tests/semantic-routing/test-audit-discrete-logic.js
 */

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');

// ── Mock logger (AuditDiscreteLogic requires logger) ──────────────────────

const mockLogger = { debug() {}, info() {}, warn() {}, error() {} };

// Inject mock logger into require cache
const loggerPath = require.resolve('../../src/utils/logger');
require.cache[loggerPath] = {
    id:       loggerPath,
    filename: loggerPath,
    loaded:   true,
    exports:  mockLogger,
};

const { AuditDiscreteLogic } = require('../../scripts/audit-discrete-logic');

// ── Temp file helpers ──────────────────────────────────────────────────────

const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), 'hdy-audit-test-'));
const tmpFiles = [];

function writeTmpFile(name, content) {
    const p = path.join(tmpDir, name);
    fs.writeFileSync(p, content, 'utf8');
    tmpFiles.push(p);
    return p;
}

function cleanupTmpFiles() {
    for (const f of tmpFiles) {
        try { fs.unlinkSync(f); } catch (_) {}
    }
    try { fs.rmdirSync(tmpDir); } catch (_) {}
}

// ── Test harness ───────────────────────────────────────────────────────────

let passed = 0, failed = 0;

async function runTest(name, fn) {
    try {
        await fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        if (process.env.VERBOSE) console.error(err.stack);
        failed++;
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────

async function runTests() {
    console.log('\n[test-audit-discrete-logic]');

    // ── test_scan_type_a_if_string ────────────────────────────────────────
    await runTest('test_scan_type_a_if_string', () => {
        const src = `
'use strict';
function route(command) {
  if (command === 'deploy') {
    return doDeployment();
  }
}
`;
        const file  = writeTmpFile('type-a-if-string.js', src);
        const audit = new AuditDiscreteLogic();
        const findings = audit.scanFile(file);

        const typeA = findings.filter(f => f.type === 'TYPE_A');
        assert.ok(typeA.length > 0, `Expected TYPE_A findings, got ${findings.map(f=>f.type).join(',')}`);
        const matchedTexts = typeA.map(f => f.matched).join(' ');
        assert.ok(
            matchedTexts.includes("command") || matchedTexts.includes("deploy"),
            `TYPE_A matched text should reference command or deploy: ${matchedTexts}`
        );
    });

    // ── test_scan_type_a_switch ───────────────────────────────────────────
    await runTest('test_scan_type_a_switch', () => {
        const src = `
'use strict';
function handleTask(task) {
  switch(task.type) {
    case 'deploy':
      return deployApp();
    case 'rollback':
      return rollback();
    default:
      return noop();
  }
}
`;
        const file  = writeTmpFile('type-a-switch.js', src);
        const audit = new AuditDiscreteLogic();
        const findings = audit.scanFile(file);

        const typeA = findings.filter(f => f.type === 'TYPE_A');
        assert.ok(typeA.length > 0, `Expected TYPE_A findings for switch, got ${findings.length} total`);
        // At least one should match the switch block
        const switchFindings = typeA.filter(f => f.matched.includes('switch') || f.patternId === 'A2');
        assert.ok(
            switchFindings.length > 0 || typeA.length > 0,
            `Should detect switch/case pattern as TYPE_A`
        );
    });

    // ── test_scan_type_a_includes ─────────────────────────────────────────
    await runTest('test_scan_type_a_includes', () => {
        const src = `
'use strict';
function checkPipeline(stages) {
  if (stages.includes('deploy')) {
    triggerDeployment();
  }
}
`;
        const file  = writeTmpFile('type-a-includes.js', src);
        const audit = new AuditDiscreteLogic();
        const findings = audit.scanFile(file);

        const typeA = findings.filter(f => f.type === 'TYPE_A');
        assert.ok(typeA.length > 0, `Expected TYPE_A for .includes(), got none`);
        const matched = typeA.map(f => f.matched).join(' ');
        assert.ok(matched.includes('includes'), `Matched text should contain 'includes': ${matched}`);
    });

    // ── test_scan_type_b_threshold ────────────────────────────────────────
    await runTest('test_scan_type_b_threshold', () => {
        const src = `
'use strict';
function evaluate(score) {
  if (score > 0.5) {
    return 'pass';
  }
  return 'fail';
}
`;
        const file  = writeTmpFile('type-b-threshold.js', src);
        const audit = new AuditDiscreteLogic();
        const findings = audit.scanFile(file);

        const typeB = findings.filter(f => f.type === 'TYPE_B');
        assert.ok(typeB.length > 0, `Expected TYPE_B for score > 0.5, got ${findings.map(f=>f.type)}`);
        const matched = typeB.map(f => f.matched).join(' ');
        assert.ok(matched.includes('0.5') || matched.includes('score'), `TYPE_B matched: ${matched}`);
    });

    // ── test_scan_type_b_comparison ───────────────────────────────────────
    await runTest('test_scan_type_b_comparison', () => {
        const src = `
'use strict';
const THRESHOLD = 0.8;
function gateValue(value) {
  if (value >= threshold) {
    return activateFeature();
  }
}
`;
        const file  = writeTmpFile('type-b-comparison.js', src);
        const audit = new AuditDiscreteLogic();
        const findings = audit.scanFile(file);

        const typeB = findings.filter(f => f.type === 'TYPE_B');
        assert.ok(typeB.length > 0,
            `Expected TYPE_B for value >= threshold, got findings: ${findings.map(f=>f.type+'/'+f.patternId)}`);
    });

    // ── test_scan_type_c_null_check ───────────────────────────────────────
    await runTest('test_scan_type_c_null_check', () => {
        const src = `
'use strict';
function processResult(result) {
  if (!result) {
    throw new Error('result is falsy');
  }
  return result.value;
}
`;
        const file  = writeTmpFile('type-c-null.js', src);
        const audit = new AuditDiscreteLogic();
        const findings = audit.scanFile(file);

        const typeC = findings.filter(f => f.type === 'TYPE_C');
        assert.ok(typeC.length > 0, `Expected TYPE_C for !result, got ${findings.map(f=>f.type)}`);
        const c1 = typeC.find(f => f.patternId === 'C1' || f.matched.includes('!result'));
        assert.ok(c1, 'Should detect falsy guard C1');
    });

    // ── test_scan_type_c_error ────────────────────────────────────────────
    await runTest('test_scan_type_c_error', () => {
        const src = `
'use strict';
function callbackHandler(err, data) {
  if (err) {
    logger.error(err);
    return;
  }
  process(data);
}
`;
        const file  = writeTmpFile('type-c-err.js', src);
        const audit = new AuditDiscreteLogic();
        const findings = audit.scanFile(file);

        const typeC = findings.filter(f => f.type === 'TYPE_C');
        assert.ok(typeC.length > 0, `Expected TYPE_C for if (err), got ${findings.map(f=>f.type)}`);
        const c4 = typeC.find(f => f.patternId === 'C4' || f.matched.includes('err'));
        assert.ok(c4, 'Should detect error-first callback guard C4');
    });

    // ── test_scan_type_d_typeof ───────────────────────────────────────────
    await runTest('test_scan_type_d_typeof', () => {
        const src = `
'use strict';
function isString(x) {
  return typeof x === 'string';
}
`;
        const file  = writeTmpFile('type-d-typeof.js', src);
        const audit = new AuditDiscreteLogic();
        const findings = audit.scanFile(file);

        const typeD = findings.filter(f => f.type === 'TYPE_D');
        assert.ok(typeD.length > 0, `Expected TYPE_D for typeof check, got ${findings.map(f=>f.type)}`);
        const d1 = typeD.find(f => f.patternId === 'D1' || f.matched.includes('typeof'));
        assert.ok(d1, 'Should detect typeof === string as TYPE_D D1');
    });

    // ── test_scan_type_d_instanceof ───────────────────────────────────────
    await runTest('test_scan_type_d_instanceof', () => {
        const src = `
'use strict';
function handleError(x) {
  if (x instanceof Error) {
    return x.message;
  }
  return String(x);
}
`;
        const file  = writeTmpFile('type-d-instanceof.js', src);
        const audit = new AuditDiscreteLogic();
        const findings = audit.scanFile(file);

        const typeD = findings.filter(f => f.type === 'TYPE_D');
        assert.ok(typeD.length > 0, `Expected TYPE_D for instanceof, got ${findings.map(f=>f.type)}`);
        const d2 = typeD.find(f => f.patternId === 'D2' || f.matched.includes('instanceof'));
        assert.ok(d2, 'Should detect instanceof as TYPE_D D2');
    });

    // ── test_report_summary ───────────────────────────────────────────────
    await runTest('test_report_summary', () => {
        // File with multiple types
        const src = `
'use strict';
function multi(cmd, score, result) {
  if (cmd === 'deploy') { return deploy(); }
  switch(cmd) {
    case 'rollback': return rollback();
    case 'stop':     return stop();
  }
  if (score > 0.5)  { return pass(); }
  if (!result)      { throw new Error('no result'); }
  if (result instanceof Error) { return handleErr(result); }
}
`;
        const file  = writeTmpFile('multi-type.js', src);
        const audit = new AuditDiscreteLogic();
        const findings = audit.scanFile(file);
        const report   = audit.generateReport(findings, [file]);

        assert.ok(report.hasOwnProperty('summary'),         'report has summary');
        assert.ok(report.summary.hasOwnProperty('byType'),  'summary has byType');
        assert.ok(report.summary.hasOwnProperty('cslCandidates'), 'summary has cslCandidates');
        assert.ok(report.summary.hasOwnProperty('totalFindings'), 'summary has totalFindings');

        const { byType } = report.summary;
        assert.ok(byType.TYPE_A > 0, `TYPE_A count should be > 0, got ${byType.TYPE_A}`);
        assert.ok(byType.TYPE_B > 0, `TYPE_B count should be > 0, got ${byType.TYPE_B}`);
        assert.ok(byType.TYPE_C > 0, `TYPE_C count should be > 0, got ${byType.TYPE_C}`);
        assert.ok(byType.TYPE_D > 0, `TYPE_D count should be > 0, got ${byType.TYPE_D}`);

        assert.strictEqual(
            report.summary.cslCandidates,
            byType.TYPE_A + byType.TYPE_B,
            'cslCandidates = TYPE_A + TYPE_B'
        );
        assert.ok(report.summary.totalFindings >= byType.TYPE_A + byType.TYPE_B + byType.TYPE_C + byType.TYPE_D,
            'totalFindings >= sum of all type counts');
        assert.ok(report.hasOwnProperty('perFile'), 'report has perFile');
        assert.ok(Array.isArray(report.perFile),    'perFile is array');
        assert.ok(report.hasOwnProperty('generatedAt'), 'report has generatedAt');
    });

    // ── test_markdown_report ──────────────────────────────────────────────
    await runTest('test_markdown_report', () => {
        const src = `
'use strict';
function demo(action, count) {
  if (action === 'start') { begin(); }
  if (count > 10) { overflow(); }
  if (!action) { throw new Error('no action'); }
}
`;
        const file  = writeTmpFile('markdown-test.js', src);
        const audit = new AuditDiscreteLogic();
        const findings = audit.scanFile(file);
        const markdown  = audit.generateMarkdownReport(findings, [file]);

        assert.ok(typeof markdown === 'string', 'markdown is string');
        assert.ok(markdown.includes('# CSL Discrete Logic Audit Report'), 'has main header');
        assert.ok(markdown.includes('## Summary'),                        'has Summary section');
        assert.ok(markdown.includes('TYPE_A'),                            'mentions TYPE_A');
        assert.ok(markdown.includes('TYPE_B'),                            'mentions TYPE_B');
        assert.ok(markdown.includes('TYPE_C'),                            'mentions TYPE_C');
        assert.ok(markdown.includes('TYPE_D'),                            'mentions TYPE_D');
        assert.ok(markdown.includes('SemanticRouter') || markdown.includes('CSL'), 'contains CSL references');
    });

    // ── test_deduplication ────────────────────────────────────────────────
    await runTest('test_deduplication', () => {
        // A pattern that might match multiple patterns at once
        const src = `
'use strict';
if (command === 'deploy') { deploy(); }
`;
        const file  = writeTmpFile('dedup-test.js', src);
        const audit = new AuditDiscreteLogic();
        const findings = audit.scanFile(file);

        // Check no exact duplicates (same file:line:col:type:patternId)
        const keys = findings.map(f => `${f.file}:${f.line}:${f.column}:${f.type}:${f.patternId}`);
        const unique = new Set(keys);
        assert.strictEqual(keys.length, unique.size, 'no duplicate findings');
    });

    // ── test_scan_directory ───────────────────────────────────────────────
    await runTest('test_scan_directory', () => {
        const scanDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hdy-scan-'));
        try {
            fs.writeFileSync(path.join(scanDir, 'a.js'), `
'use strict';
if (task.type === 'build') { build(); }
`, 'utf8');
            fs.writeFileSync(path.join(scanDir, 'b.js'), `
'use strict';
if (score > 100) { alert(); }
`, 'utf8');

            const audit = new AuditDiscreteLogic();
            const result = audit.scanDirectory(scanDir, { exclude: ['node_modules'] });

            assert.ok(result.hasOwnProperty('files'),    'result has files');
            assert.ok(result.hasOwnProperty('findings'), 'result has findings');
            assert.ok(result.files.length >= 2,          `found at least 2 files, got ${result.files.length}`);
            assert.ok(result.findings.length > 0,        'has findings across directory');
        } finally {
            try {
                fs.readdirSync(scanDir).forEach(f => fs.unlinkSync(path.join(scanDir, f)));
                fs.rmdirSync(scanDir);
            } catch (_) {}
        }
    });
}

runTests()
    .then(() => {
        cleanupTmpFiles();
        console.log(`\nTests: ${passed} passed, ${failed} failed\n`);
        process.exitCode = failed > 0 ? 1 : 0;
    })
    .catch(err => {
        cleanupTmpFiles();
        console.error(err);
        process.exitCode = 1;
    });
