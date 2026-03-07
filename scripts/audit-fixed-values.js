#!/usr/bin/env node
'use strict';
/**
 * ═══════════════════════════════════════════════════════════════════
 * Heady Phi Audit — Fixed Value Scanner
 * ═══════════════════════════════════════════════════════════════════
 *
 * Scans the codebase for every hardcoded numeric constant that should
 * be replaced with a PhiScale dynamic constant. Groups findings by
 * type, generates per-finding recommendations, and writes CSV + JSON
 * reports to the scripts directory.
 *
 * Usage:
 *   node scripts/audit-fixed-values.js [--dir <dir>] [--quiet]
 *
 * Exit codes:
 *   0 — no findings
 *   1 — findings detected
 * ═══════════════════════════════════════════════════════════════════
 */

const fs   = require('fs');
const path = require('path');

// ─── Golden ratio constants ───────────────────────────────────────
let PHI, PHI_INVERSE;
try {
    ({ PHI, PHI_INVERSE } = require('../src/core/phi-scales'));
} catch (_) {
    PHI         = 1.618033988749895;
    PHI_INVERSE = 0.618033988749895;
}

// ─── ANSI helpers ─────────────────────────────────────────────────
const C = {
    reset:  '\x1b[0m',
    bold:   '\x1b[1m',
    dim:    '\x1b[2m',
    red:    '\x1b[31m',
    green:  '\x1b[32m',
    yellow: '\x1b[33m',
    cyan:   '\x1b[36m',
    white:  '\x1b[37m',
    gray:   '\x1b[90m',
};
const isCI = process.env.CI === 'true' || !process.stdout.isTTY;
const c = (color, str) => isCI ? str : `${color}${str}${C.reset}`;

// ─── Detection patterns ───────────────────────────────────────────
const PATTERNS = [
    { name: 'Threshold',         regex: /threshold\s*[:=]\s*(0\.\d+|\d+)/gi },
    { name: 'Timeout',           regex: /timeout\s*[:=]\s*(\d+)/gi },
    { name: 'Retry',             regex: /(?:retry|maxRetries|MAX_RETRIES)\s*[:=]\s*(\d+)/gi },
    { name: 'BatchSize',         regex: /(?:batch[Ss]ize|BATCH_SIZE)\s*[:=]\s*(\d+)/gi },
    { name: 'Limit',             regex: /limit\s*[:=]\s*(\d+)/gi },
    { name: 'Max',               regex: /max\w*\s*[:=]\s*(\d+)/gi },
    { name: 'Min',               regex: /min\w*\s*[:=]\s*(\d+)/gi },
    { name: 'Confidence',        regex: /confidence\s*[:=]\s*(0\.\d+)/gi },
    { name: 'Temperature',       regex: /temperature\s*[:=]\s*(0\.\d+|\d+\.\d+)/gi },
    { name: 'Priority',          regex: /(?:priority\s*[:=]|const priority\s*=)\s*(\d+\.?\d*)/gi },
    { name: 'Weight',            regex: /weight\s*[:=]\s*(0\.\d+)/gi },
    { name: 'AlphaBeta',         regex: /(?:alpha|beta)\s*[:=]\s*(0\.\d+)/gi },
    { name: 'Steepness',         regex: /steepness\s*[:=]\s*(\d+)/gi },
    { name: 'Sensitivity',       regex: /sensitivity\s*[:=]\s*(0\.\d+)/gi },
    { name: 'DecayRate',         regex: /(?:decay|momentumDecay)\s*[:=]\s*(0\.\d+)/gi },
    { name: 'LearningRate',      regex: /learningRate\s*[:=]\s*(0\.\d+)/gi },
    { name: 'Interval',          regex: /interval\s*[:=]\s*(\d+)/gi },
    { name: 'Delay',             regex: /delay\s*[:=]\s*(\d+)/gi },
    { name: 'Concurrency',       regex: /concurrency\s*[:=]\s*(\d+)/gi },
    { name: 'ChunkSize',         regex: /chunk[Ss]ize\s*[:=]\s*(\d+)/gi },
    { name: 'MaxTokens',         regex: /(?:max_tokens|maxTokens)\s*[:=]\s*(\d+)/gi },
    { name: 'CacheTTL',          regex: /(?:cacheTTL|TTL)\s*[:=]\s*(\d+)/gi },
    { name: 'FailureThreshold',  regex: /failureThreshold\s*[:=]\s*(\d+)/gi },
    { name: 'SuccessThreshold',  regex: /successThreshold\s*[:=]\s*(\d+)/gi },
    { name: 'MagicComparison',   regex: /(?:>= ?0\.95|> ?0\.[78]|> ?0\.5|< ?0\.3)/g },
];

// ─── Recommended constant mappings ────────────────────────────────
const RECOMMENDATIONS = {
    Threshold:        { constant: 'DynamicConfidenceThreshold', module: 'dynamic-constants' },
    Timeout:          { constant: 'DynamicTimeout',             module: 'dynamic-constants' },
    Retry:            { constant: 'DynamicRetryCount',          module: 'dynamic-constants' },
    BatchSize:        { constant: 'DynamicBatchSize',           module: 'dynamic-constants' },
    Limit:            { constant: 'DynamicRateLimit',           module: 'dynamic-constants' },
    Max:              { constant: 'DynamicBatchSize',           module: 'dynamic-constants' },
    Min:              { constant: 'DynamicRetryCount',          module: 'dynamic-constants' },
    Confidence:       { constant: 'DynamicConfidenceThreshold', module: 'dynamic-constants' },
    Temperature:      { constant: 'DynamicTemperature',         module: 'dynamic-constants' },
    Priority:         { constant: 'DynamicPriority',            module: 'dynamic-constants' },
    Weight:           { constant: 'DynamicConfidenceThreshold', module: 'dynamic-constants' },
    AlphaBeta:        { constant: 'DynamicRiskSensitivity',     module: 'dynamic-constants' },
    Steepness:        { constant: 'DynamicSoftGateSteepness',   module: 'dynamic-constants' },
    Sensitivity:      { constant: 'DynamicRiskSensitivity',     module: 'dynamic-constants' },
    DecayRate:        { constant: 'PhiDecay',                   module: 'phi-scales' },
    LearningRate:     { constant: 'DynamicRiskSensitivity',     module: 'dynamic-constants' },
    Interval:         { constant: 'DynamicBackoffInterval',     module: 'dynamic-constants' },
    Delay:            { constant: 'DynamicTimeout',             module: 'dynamic-constants' },
    Concurrency:      { constant: 'DynamicConcurrency',         module: 'dynamic-constants' },
    ChunkSize:        { constant: 'DynamicBatchSize',           module: 'dynamic-constants' },
    MaxTokens:        { constant: 'DynamicBatchSize',           module: 'dynamic-constants' },
    CacheTTL:         { constant: 'DynamicCacheTTL',            module: 'dynamic-constants' },
    FailureThreshold: { constant: 'DynamicResonanceThreshold',  module: 'dynamic-constants' },
    SuccessThreshold: { constant: 'DynamicResonanceThreshold',  module: 'dynamic-constants' },
    MagicComparison:  { constant: 'DynamicConfidenceThreshold', module: 'dynamic-constants' },
};

// ─── Files / dirs to exclude ──────────────────────────────────────
const EXCLUDE_NAMES = new Set([
    'node_modules', '.git', 'package-lock.json', 'phi-scales.js',
    'dynamic-constants.js', 'audit-fixed-values.js', 'test-phi-scales.js',
    'phi-telemetry-feed.js', 'phi-scale-middleware.js', '_archive',
]);
const EXCLUDE_EXTENSIONS = new Set(['.json', '.md', '.lock', '.yaml', '.yml', '.map', '.d.ts']);

// ─── Scan directories ─────────────────────────────────────────────
const SCAN_DIRS = ['src', 'scripts', 'bin'];

// ─── Utility: walk directory recursively ──────────────────────────
function walkDir(dir, files = []) {
    if (!fs.existsSync(dir)) return files;

    for (const entry of fs.readdirSync(dir)) {
        if (EXCLUDE_NAMES.has(entry)) continue;

        const fullPath = path.join(dir, entry);
        const stat     = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            walkDir(fullPath, files);
        } else if (stat.isFile()) {
            const ext = path.extname(entry);
            if (!EXCLUDE_EXTENSIONS.has(ext) && !EXCLUDE_NAMES.has(path.basename(fullPath))) {
                files.push(fullPath);
            }
        }
    }
    return files;
}

// ─── Utility: extract context window around a match ───────────────
function getContext(lines, lineIdx, radius = 1) {
    const start = Math.max(0, lineIdx - radius);
    const end   = Math.min(lines.length - 1, lineIdx + radius);
    return lines.slice(start, end + 1).map(l => l.trim()).join(' | ');
}

// ─── Build a recommendation string ────────────────────────────────
function buildRecommendation(patternName, matchedValue, lineText) {
    const rec = RECOMMENDATIONS[patternName];
    if (!rec) return { importLine: '', before: lineText.trim(), after: lineText.trim() };

    const importLine = `const { ${rec.constant} } = require('../src/core/${rec.module}');`;

    // Build a rough "after" substitution example
    const trimmed = lineText.trim();
    let after;
    if (patternName === 'MagicComparison') {
        after = trimmed.replace(
            /(?:>= ?0\.95|> ?0\.[78]|> ?0\.5|< ?0\.3)/,
            `>= ${rec.constant}.value`
        );
    } else {
        after = trimmed.replace(
            new RegExp(`(${escapeRegex(matchedValue)})(?![\\d.])`, ''),
            `${rec.constant}.value`
        );
    }

    return { importLine, before: trimmed, after };
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Nearest phi-scale suggestion for a numeric value ─────────────
function nearestPhiSuggestion(numericValue) {
    const v = parseFloat(numericValue);
    if (isNaN(v)) return '';
    const phiMultiples = [
        { label: 'PHI',         val: PHI },
        { label: 'PHI_INVERSE', val: PHI_INVERSE },
        { label: 'PHI²',        val: PHI * PHI },
        { label: '1/PHI²',      val: 1 / (PHI * PHI) },
        { label: '2×PHI',       val: 2 * PHI },
    ];
    let best = '', bestDist = Infinity;
    for (const { label, val } of phiMultiples) {
        const dist = Math.abs(v - val);
        if (dist < bestDist) { bestDist = dist; best = label; }
    }
    if (bestDist < 0.1) return ` (≈ ${best})`;
    return '';
}

// ─── Core scanner ─────────────────────────────────────────────────
function scanFile(filePath) {
    const findings = [];
    let source;
    try {
        source = fs.readFileSync(filePath, 'utf8');
    } catch (_) {
        return findings;
    }

    const lines = source.split('\n');

    for (const { name, regex } of PATTERNS) {
        // Reset lastIndex for global regexes
        regex.lastIndex = 0;

        let match;
        while ((match = regex.exec(source)) !== null) {
            // Find line number
            const before  = source.slice(0, match.index);
            const lineIdx = before.split('\n').length - 1;
            const line    = lines[lineIdx] || '';

            // Skip comments
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) continue;

            const matchedValue = match[1] || match[0];
            const rec          = buildRecommendation(name, matchedValue, line);
            const phiHint      = nearestPhiSuggestion(matchedValue);

            findings.push({
                type:       name,
                file:       filePath,
                line:       lineIdx + 1,
                value:      matchedValue,
                context:    getContext(lines, lineIdx),
                importLine: rec.importLine,
                before:     rec.before,
                after:      rec.after,
                phiHint,
                recommendation: RECOMMENDATIONS[name]
                    ? `Replace with ${RECOMMENDATIONS[name].constant}.value${phiHint}`
                    : 'Consider a PhiScale dynamic constant',
            });

            // Advance to avoid catastrophic backtracking on some patterns
            if (!regex.global) break;
        }

        regex.lastIndex = 0;
    }

    return findings;
}

// ─── Main ──────────────────────────────────────────────────────────
function main() {
    const args     = process.argv.slice(2);
    const quiet    = args.includes('--quiet');
    const rootDir  = path.resolve(__dirname, '..');
    const scriptDir = __dirname;

    if (!quiet) {
        console.log(c(C.bold + C.cyan, '\n╔══════════════════════════════════════════════════╗'));
        console.log(c(C.bold + C.cyan, '║   Heady Phi Audit — Fixed Value Scanner          ║'));
        console.log(c(C.bold + C.cyan, '╚══════════════════════════════════════════════════╝\n'));
        console.log(c(C.gray, `Root: ${rootDir}`));
        console.log(c(C.gray, `PHI = ${PHI.toFixed(6)}   PHI⁻¹ = ${PHI_INVERSE.toFixed(6)}\n`));
    }

    // Collect all files
    const allFiles = [];
    for (const dir of SCAN_DIRS) {
        walkDir(path.join(rootDir, dir), allFiles);
    }

    if (!quiet) {
        console.log(c(C.dim, `Scanning ${allFiles.length} file(s) across [${SCAN_DIRS.join(', ')}]...\n`));
    }

    // Scan
    const allFindings = [];
    for (const file of allFiles) {
        const findings = scanFile(file);
        allFindings.push(...findings);
    }

    // Group by type
    const byType = {};
    for (const f of allFindings) {
        if (!byType[f.type]) byType[f.type] = [];
        byType[f.type].push(f);
    }

    // ── Console report ────────────────────────────────────────────
    if (!quiet) {
        const types = Object.keys(byType).sort();
        for (const type of types) {
            const group = byType[type];
            console.log(c(C.bold + C.yellow, `\n▶ ${type} (${group.length} finding${group.length !== 1 ? 's' : ''})`));
            console.log(c(C.gray, '─'.repeat(60)));

            for (const f of group) {
                const relPath = path.relative(rootDir, f.file);
                console.log(
                    c(C.cyan,  `  ${relPath}`) +
                    c(C.gray,  ':') +
                    c(C.white, `${f.line}`) +
                    c(C.gray,  `  value=`) +
                    c(C.red,   `${f.value}`)
                );
                console.log(c(C.gray, `    context: ${f.context}`));
                console.log(c(C.green, `    ✦ ${f.recommendation}`));
                if (f.importLine) {
                    console.log(c(C.dim,   `    import:  ${f.importLine}`));
                }
                console.log(c(C.dim,   `    before:  ${f.before}`));
                console.log(c(C.green,  `    after:   ${f.after}`));
            }
        }

        // Summary statistics
        const fileSet  = new Set(allFindings.map(f => f.file));
        const typeSet  = new Set(allFindings.map(f => f.type));

        console.log(c(C.bold + C.cyan, '\n╔══════════════════════════════════════════════════╗'));
        console.log(c(C.bold + C.cyan, '║   Summary                                        ║'));
        console.log(c(C.bold + C.cyan, '╚══════════════════════════════════════════════════╝'));
        console.log(`  Total findings : ${c(C.bold + (allFindings.length > 0 ? C.red : C.green), String(allFindings.length))}`);
        console.log(`  Files affected : ${c(C.yellow, String(fileSet.size))}`);
        console.log(`  Files scanned  : ${c(C.white,  String(allFiles.length))}`);
        console.log(`  Pattern types  : ${c(C.white,  String(typeSet.size))}`);
        console.log('');
        console.log(c(C.dim, '  By type:'));
        for (const [type, group] of Object.entries(byType).sort((a, b) => b[1].length - a[1].length)) {
            console.log(`    ${c(C.yellow, type.padEnd(22))} ${c(C.white, String(group.length).padStart(4))}`);
        }
        console.log('');
    }

    // ── CSV output ────────────────────────────────────────────────
    const csvPath  = path.join(scriptDir, 'audit-results.csv');
    const csvLines = ['type,file,line,value,recommendation,before,after'];
    for (const f of allFindings) {
        const relPath = path.relative(rootDir, f.file);
        const csvRow  = [
            f.type,
            relPath,
            f.line,
            f.value,
            f.recommendation.replace(/,/g, ';'),
            `"${f.before.replace(/"/g, '""')}"`,
            `"${f.after.replace(/"/g, '""')}"`,
        ].join(',');
        csvLines.push(csvRow);
    }
    fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
    if (!quiet) console.log(c(C.green, `  CSV  → ${csvPath}`));

    // ── JSON output ───────────────────────────────────────────────
    const jsonPath = path.join(scriptDir, 'audit-results.json');
    const jsonOut  = {
        meta: {
            generatedAt:    new Date().toISOString(),
            rootDir,
            scannedDirs:    SCAN_DIRS,
            totalFiles:     allFiles.length,
            totalFindings:  allFindings.length,
            phi:            PHI,
            phiInverse:     PHI_INVERSE,
        },
        summary: Object.fromEntries(
            Object.entries(byType).map(([k, v]) => [k, v.length])
        ),
        findings: allFindings.map(f => ({
            ...f,
            file: path.relative(rootDir, f.file),
        })),
    };
    fs.writeFileSync(jsonPath, JSON.stringify(jsonOut, null, 2), 'utf8');
    if (!quiet) console.log(c(C.green, `  JSON → ${jsonPath}\n`));

    // ── Exit code ─────────────────────────────────────────────────
    if (allFindings.length > 0) {
        if (!quiet) {
            console.log(c(C.bold + C.red,
                `  ✖  ${allFindings.length} fixed value(s) found — replace with PhiScale dynamics.\n`
            ));
        }
        process.exit(1);
    } else {
        if (!quiet) {
            console.log(c(C.bold + C.green, '  ✔  No fixed values detected — codebase is phi-clean!\n'));
        }
        process.exit(0);
    }
}

main();
