#!/usr/bin/env node
/**
 * heady-output-lint — Anti-Template & Placeholder Scanner
 * ═══════════════════════════════════════════════════════
 * Scans prompts, system instructions, docs, and code comments
 * for vendor-style boilerplate, TODO/FIXME in user-facing contexts,
 * and "AI language model" disclaimers.
 *
 * USAGE:
 *   node scripts/heady-output-lint.js [--paths <dirs>] [--fix] [--json]
 *
 * EXIT CODES:
 *   0 — No violations found
 *   1 — Violations detected (CI gate fails)
 *   2 — Configuration error
 */

const fs = require('fs');
const path = require('path');

// ─── Forbidden Patterns ─────────────────────────────────────
const FORBIDDEN_PATTERNS = [
    { pattern: /As an AI language model/gi, category: 'vendor-boilerplate', severity: 'critical' },
    { pattern: /I am unable to/gi, category: 'vendor-boilerplate', severity: 'critical' },
    { pattern: /I cannot browse the internet/gi, category: 'vendor-boilerplate', severity: 'critical' },
    { pattern: /this is just an example/gi, category: 'placeholder', severity: 'high' },
    { pattern: /replace this with/gi, category: 'placeholder', severity: 'high' },
    { pattern: /lorem ipsum/gi, category: 'placeholder', severity: 'high' },
    { pattern: /template response/gi, category: 'placeholder', severity: 'high' },
    { pattern: /boilerplate/gi, category: 'placeholder', severity: 'medium' },
    { pattern: /I don't have access to/gi, category: 'vendor-boilerplate', severity: 'high' },
    { pattern: /I'm sorry, but I/gi, category: 'vendor-boilerplate', severity: 'high' },
    { pattern: /placeholder/gi, category: 'placeholder', severity: 'medium' },
    { pattern: /example only/gi, category: 'placeholder', severity: 'medium' },
    // TODO/FIXME in user-facing files (not code)
    { pattern: /^TODO:/gm, category: 'unresolved', severity: 'medium' },
    { pattern: /^FIXME/gm, category: 'unresolved', severity: 'medium' },
];

// ─── Default scan paths ─────────────────────────────────────
const DEFAULT_PATHS = [
    'docs',
    'CLAUDE.md',
    '.windsurfrules',
    'prompts',
    'agents',
    'configs',
];

// ─── File extensions to scan ────────────────────────────────
const SCAN_EXTENSIONS = ['.md', '.txt', '.yaml', '.yml', '.json', '.js', '.ts', '.html'];

// ─── Allowlist (files/patterns that are OK) ─────────────────
const ALLOWLIST_PATTERNS = [
    /examples?\//i,
    /training\//i,
    /heady-output-lint/i,  // this file itself
    /node_modules/i,
    /heady-coder\.yaml/i,        // defines the policy patterns
    /heady-intelligence\.yaml/i, // defines the policy patterns
    /heady-output-policies/i,    // policy definition files
];

function shouldSkip(filePath) {
    return ALLOWLIST_PATTERNS.some(p => p.test(filePath));
}

function scanFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (!SCAN_EXTENSIONS.includes(ext)) return [];
    if (shouldSkip(filePath)) return [];

    let content;
    try {
        content = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
        return [];
    }

    const violations = [];
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
        FORBIDDEN_PATTERNS.forEach(({ pattern, category, severity }) => {
            // Reset regex (global flag)
            pattern.lastIndex = 0;
            if (pattern.test(line)) {
                violations.push({
                    file: filePath,
                    line: idx + 1,
                    content: line.trim().substring(0, 120),
                    category,
                    severity,
                    pattern: pattern.source,
                });
            }
        });
    });

    return violations;
}

function scanDirectory(dirPath, violations = []) {
    if (!fs.existsSync(dirPath)) return violations;

    const stat = fs.statSync(dirPath);
    if (stat.isFile()) {
        return violations.concat(scanFile(dirPath));
    }

    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        try {
            const entryStat = fs.statSync(fullPath);
            if (entryStat.isDirectory()) {
                scanDirectory(fullPath, violations);
            } else {
                violations.push(...scanFile(fullPath));
            }
        } catch (e) {
            // Skip unreadable files
        }
    }
    return violations;
}

// ─── Main ───────────────────────────────────────────────────
function main() {
    const args = process.argv.slice(2);
    const jsonOutput = args.includes('--json');
    const customPaths = args.includes('--paths')
        ? args[args.indexOf('--paths') + 1]?.split(',')
        : null;

    const scanPaths = customPaths || DEFAULT_PATHS;
    const basePath = process.cwd();

    let allViolations = [];

    for (const scanPath of scanPaths) {
        const fullPath = path.resolve(basePath, scanPath);
        allViolations = scanDirectory(fullPath, allViolations);
    }

    if (allViolations.length === 0) {
        if (!jsonOutput) {
            console.log('✅ heady-output-lint: No placeholder or template violations found.');
        }
        process.exit(0);
    }

    // Group by severity
    const critical = allViolations.filter(v => v.severity === 'critical');
    const high = allViolations.filter(v => v.severity === 'high');
    const medium = allViolations.filter(v => v.severity === 'medium');

    if (jsonOutput) {
        console.log(JSON.stringify({ violations: allViolations, counts: { critical: critical.length, high: high.length, medium: medium.length } }, null, 2));
    } else {
        console.log(`\n🚫 heady-output-lint: ${allViolations.length} violation(s) found\n`);
        console.log(`   Critical: ${critical.length}  |  High: ${high.length}  |  Medium: ${medium.length}\n`);

        allViolations.forEach(v => {
            const icon = v.severity === 'critical' ? '🔴' : v.severity === 'high' ? '🟡' : '🟢';
            console.log(`   ${icon} ${v.file}:${v.line} [${v.category}]`);
            console.log(`      "${v.content}"\n`);
        });

        console.log('   Fix: Replace template patterns with Heady-native responses.');
        console.log('   See: configs/heady-intelligence.yaml → on_placeholder_detected\n');
    }

    process.exit(1);
}

main();
