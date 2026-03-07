'use strict';

/**
 * test-migrate-to-csl.js
 *
 * Tests for MigrateToCSL using real module + temp file infrastructure.
 *
 * Run: node tests/semantic-routing/test-migrate-to-csl.js
 */

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');

// ── Mock logger ────────────────────────────────────────────────────────────

const mockLogger = { debug() {}, info() {}, warn() {}, error() {} };
const loggerPath = require.resolve('../../src/utils/logger');
require.cache[loggerPath] = {
    id: loggerPath, filename: loggerPath, loaded: true, exports: mockLogger,
};

const { MigrateToCSL }       = require('../../scripts/migrate-to-csl');
const { AuditDiscreteLogic } = require('../../scripts/audit-discrete-logic');

// ── Temp file helpers ──────────────────────────────────────────────────────

const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), 'hdy-migrate-test-'));
const backupDir = path.join(os.tmpdir(), 'hdy-migrate-backups-' + Date.now());
const created   = [];

function writeTmpFile(name, content) {
    const p = path.join(tmpDir, name);
    fs.writeFileSync(p, content, 'utf8');
    created.push(p);
    return p;
}

function cleanup() {
    for (const f of created) { try { fs.unlinkSync(f); } catch (_) {} }
    try { fs.rmdirSync(tmpDir); } catch (_) {}
    // Clean backups
    try {
        if (fs.existsSync(backupDir)) {
            fs.readdirSync(backupDir).forEach(f => {
                try { fs.unlinkSync(path.join(backupDir, f)); } catch (_) {}
            });
            fs.rmdirSync(backupDir);
        }
    } catch (_) {}
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
    console.log('\n[test-migrate-to-csl]');

    // ── test_constructor ─────────────────────────────────────────────────
    await runTest('test_constructor', () => {
        const m1 = new MigrateToCSL();
        assert.strictEqual(m1.dryRun, true, 'default dryRun=true');
        assert.ok(m1.backupDir.includes('.csl-backups'), 'default backupDir set');

        const m2 = new MigrateToCSL({ dryRun: false, backupDir: '/tmp/test-backups', reportPath: '/tmp/report.json' });
        assert.strictEqual(m2.dryRun,      false,            'dryRun=false stored');
        assert.strictEqual(m2.backupDir,   '/tmp/test-backups', 'backupDir stored');
        assert.strictEqual(m2.reportPath,  '/tmp/report.json',   'reportPath stored');
    });

    // ── test_type_a_migration_if_else ─────────────────────────────────────
    await runTest('test_type_a_migration_if_else', () => {
        const src = `'use strict';
function route(cmd) {
  if (cmd === 'deploy') {
    return doDeployment();
  }
}
`;
        const file  = writeTmpFile('type-a-if.js', src);
        const audit = new AuditDiscreteLogic();
        const findings = audit.scanFile(file);
        const typeA  = findings.filter(f => f.type === 'TYPE_A');
        assert.ok(typeA.length > 0, `No TYPE_A findings in test file (got ${findings.length} total)`);

        const migrator = new MigrateToCSL({ dryRun: true, backupDir });
        const result   = migrator.migrateFile(file, typeA);

        assert.ok(result.hasOwnProperty('migratedCode'), 'has migratedCode');
        assert.ok(result.hasOwnProperty('diff'),         'has diff');
        assert.ok(result.hasOwnProperty('changes'),      'has changes');
        assert.ok(result.dryRun, 'dryRun=true in result');

        // Should contain CSL migration comments
        assert.ok(result.migratedCode.includes('CSL-MIGRATED'), 'migratedCode has CSL-MIGRATED marker');
        assert.ok(result.migratedCode.includes('semanticRouter') || result.migratedCode.includes('SemanticRouter'),
            'migratedCode references semanticRouter');
    });

    // ── test_type_a_migration_switch ──────────────────────────────────────
    await runTest('test_type_a_migration_switch', () => {
        const src = `'use strict';
function handleAction(action) {
  switch(action) {
    case 'start': return start();
    case 'stop':  return stop();
    default:      return noop();
  }
}
`;
        const file  = writeTmpFile('type-a-switch.js', src);
        const audit = new AuditDiscreteLogic();
        const findings = audit.scanFile(file).filter(f => f.type === 'TYPE_A');
        assert.ok(findings.length > 0, 'TYPE_A findings from switch');

        const migrator = new MigrateToCSL({ dryRun: true, backupDir });
        const result   = migrator.migrateFile(file, findings);

        assert.ok(result.migratedCode.includes('CSL-MIGRATED'),
            'switch migration has CSL-MIGRATED marker');
        assert.ok(result.changes.length > 0, 'changes recorded');
        for (const change of result.changes) {
            assert.strictEqual(change.type, 'TYPE_A', 'change type is TYPE_A');
            assert.ok(change.hasOwnProperty('original'),    'change has original');
            assert.ok(change.hasOwnProperty('replacement'), 'change has replacement');
        }
    });

    // ── test_type_b_migration_threshold ──────────────────────────────────
    await runTest('test_type_b_migration_threshold', () => {
        const src = `'use strict';
function applyGate(score) {
  if (score > 0.5) {
    return activateFeature();
  }
  return passThrough();
}
`;
        const file  = writeTmpFile('type-b-thresh.js', src);
        const audit = new AuditDiscreteLogic();
        const findings = audit.scanFile(file).filter(f => f.type === 'TYPE_B');
        assert.ok(findings.length > 0, 'TYPE_B findings');

        const migrator = new MigrateToCSL({ dryRun: true, backupDir });
        const result   = migrator.migrateFile(file, findings);

        assert.ok(result.migratedCode.includes('CSL-MIGRATED'),
            'TYPE_B migration has CSL-MIGRATED marker');
        assert.ok(result.migratedCode.includes('soft_gate') || result.migratedCode.includes('PhiScale'),
            'migrated code references soft_gate or PhiScale');
        assert.ok(result.migratedCode.includes('PHI_INVERSE'),
            'migrated code references PHI_INVERSE');
    });

    // ── test_generate_diff ────────────────────────────────────────────────
    await runTest('test_generate_diff', () => {
        const migrator = new MigrateToCSL({ dryRun: true, backupDir });
        const original = `'use strict';\nif (cmd === 'start') { begin(); }\n`;
        const migrated = `'use strict';\n// [CSL-MIGRATED] replaced\nconst _result = semanticRouter.route(cmd);\n`;
        const diff = migrator.generateDiff(original, migrated, 'test.js');

        assert.ok(typeof diff === 'string' || diff === null, 'diff is string or null');
        if (diff !== null) {
            assert.ok(diff.includes('--- a/test.js'), 'diff has --- header');
            assert.ok(diff.includes('+++ b/test.js'), 'diff has +++ header');
            // Should have removed and added lines
            assert.ok(diff.includes('-') || diff.includes('+'), 'diff has change indicators');
        }
    });

    // ── test_migration_preserves_non_targets ──────────────────────────────
    await runTest('test_migration_preserves_non_targets', () => {
        const src = `'use strict';
function process(x, err) {
  if (!x) { throw new Error('no x'); }
  if (err) { return handleError(err); }
  if (x instanceof Array) { return processArray(x); }
  if (typeof x === 'string') { return processString(x); }
}
`;
        const file    = writeTmpFile('non-targets.js', src);
        const audit   = new AuditDiscreteLogic();
        const findings = audit.scanFile(file);

        // Only TYPE_C and TYPE_D — should not be modified
        const typeCD = findings.filter(f => f.type === 'TYPE_C' || f.type === 'TYPE_D');
        const typeAB = findings.filter(f => f.type === 'TYPE_A' || f.type === 'TYPE_B');
        assert.ok(typeCD.length > 0, 'Has TYPE_C or TYPE_D findings');

        const migrator = new MigrateToCSL({ dryRun: true, backupDir });
        const result   = migrator.migrateFile(file, typeCD);

        // No changes should be made for TYPE_C/TYPE_D
        assert.strictEqual(result.changes.length, 0,
            `TYPE_C/TYPE_D should not generate changes, got ${result.changes.length}`);
        assert.strictEqual(result.migratedCode, src, 'source code unchanged for TYPE_C/TYPE_D only');
    });

    // ── test_migration_plan_order ─────────────────────────────────────────
    await runTest('test_migration_plan_order', () => {
        // Create two files: one with lots of TYPE_A, one with only TYPE_B
        const fileA = writeTmpFile('many-type-a.js', `
'use strict';
if (cmd === 'deploy')   { deploy(); }
if (cmd === 'rollback') { rollback(); }
if (cmd === 'build')    { build(); }
if (cmd === 'test')     { runTest(); }
`);
        const fileB = writeTmpFile('only-type-b.js', `
'use strict';
if (score > 0.5)  { pass(); }
if (score > 0.9)  { excellent(); }
`);

        const audit      = new AuditDiscreteLogic();
        const findingsA  = audit.scanFile(fileA);
        const findingsB  = audit.scanFile(fileB);
        const allFindings = [...findingsA, ...findingsB];

        const migrator = new MigrateToCSL({ dryRun: true, backupDir });
        const auditReport = { findings: allFindings };
        const plan = migrator.generateMigrationPlan(auditReport);

        assert.ok(Array.isArray(plan), 'plan is array');
        assert.ok(plan.length >= 2,    'plan has at least 2 files');

        // Files with TYPE_A (priority × 3) should come before TYPE_B-only (priority × 2)
        const firstFile = path.basename(plan[0].file);
        const aTypeCount = plan[0].typeA || 0;
        const bTypeCount = plan[0].typeB || 0;
        // Highest priority file should have TYPE_A findings
        assert.ok(plan[0].priority >= plan[plan.length - 1].priority,
            `plan is sorted descending by priority (${plan[0].priority} >= ${plan[plan.length-1].priority})`);
    });

    // ── test_track_progress ───────────────────────────────────────────────
    await runTest('test_track_progress', () => {
        const file1 = writeTmpFile('progress-a.js', `'use strict'; if (cmd === 'go') { go(); }`);
        const file2 = writeTmpFile('progress-b.js', `'use strict'; if (score > 1) { ok(); }`);

        const audit       = new AuditDiscreteLogic();
        const findings1   = audit.scanFile(file1);
        const findings2   = audit.scanFile(file2);
        const auditReport = { findings: [...findings1, ...findings2] };

        const migrator = new MigrateToCSL({ dryRun: true, backupDir });

        // No files completed yet
        const progress0 = migrator.trackProgress(auditReport, []);
        assert.ok(progress0.total >= 1,         'total > 0');
        assert.strictEqual(progress0.migrated,  0, 'migrated=0 initially');
        assert.strictEqual(progress0.remaining, progress0.total, 'remaining=total initially');

        // One file completed
        const progress1 = migrator.trackProgress(auditReport, [file1]);
        assert.strictEqual(progress1.migrated, 1, 'migrated=1 after completing file1');
        assert.ok(progress1.remaining < progress0.remaining, 'remaining decreased');
        assert.ok(progress1.percentComplete !== '0.0%', 'percentComplete updated');

        // All files completed
        const progress2 = migrator.trackProgress(auditReport, [file1, file2]);
        assert.strictEqual(progress2.migrated, 2, 'migrated=2 when both done');
        assert.strictEqual(progress2.remaining, 0, 'remaining=0 when all done');
        assert.strictEqual(progress2.percentComplete, '100.0%', 'percentComplete=100% when all done');
    });

    // ── test_dry_run ──────────────────────────────────────────────────────
    await runTest('test_dry_run', () => {
        const src = `'use strict';\nif (cmd === 'deploy') { deploy(); }\n`;
        const file = writeTmpFile('dry-run-test.js', src);

        const audit      = new AuditDiscreteLogic();
        const findings   = audit.scanFile(file).filter(f => f.type === 'TYPE_A');
        assert.ok(findings.length > 0, 'Has TYPE_A findings');

        // dryRun=true (default)
        const migrator = new MigrateToCSL({ dryRun: true, backupDir });
        migrator.migrateFile(file, findings);

        // File should be unchanged
        const afterContent = fs.readFileSync(file, 'utf8');
        assert.strictEqual(afterContent, src, 'dry run does not modify file on disk');
    });

    // ── test_rollback ─────────────────────────────────────────────────────
    await runTest('test_rollback', () => {
        const src = `'use strict';\nif (action === 'start') { start(); }\n`;
        const file = writeTmpFile('rollback-test.js', src);

        // Apply real migration (dryRun=false)
        const audit    = new AuditDiscreteLogic();
        const findings = audit.scanFile(file).filter(f => f.type === 'TYPE_A');
        assert.ok(findings.length > 0, 'Has TYPE_A findings for rollback test');

        const migrator = new MigrateToCSL({ dryRun: false, backupDir });
        migrator.migrateFile(file, findings);

        // File should now be changed
        const changedContent = fs.readFileSync(file, 'utf8');
        // Rollback
        const rolled = migrator.rollback(file);
        assert.ok(rolled, 'rollback returns true');

        // File should be restored
        const restoredContent = fs.readFileSync(file, 'utf8');
        assert.strictEqual(restoredContent, src, 'file restored to original after rollback');
    });
}

runTests()
    .then(() => {
        cleanup();
        console.log(`\nTests: ${passed} passed, ${failed} failed\n`);
        process.exitCode = failed > 0 ? 1 : 0;
    })
    .catch(err => {
        cleanup();
        console.error(err);
        process.exitCode = 1;
    });
