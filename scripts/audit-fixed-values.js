#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * Heady Fixed Values Audit Script
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Scans the entire codebase and reports every hardcoded numeric constant
 * that should be converted to a PhiScale.
 * ═══════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');
const { PHI, PHI_INVERSE } = require('../src/core/phi-scales');

// Patterns to detect hardcoded values
const patterns = [
    { name: 'Threshold', regex: /threshold\s*[:=]\s*(0\.\d+|\d+)/gi },
    { name: 'Timeout', regex: /timeout\s*[:=]\s*(\d+)/gi },
    { name: 'Retry', regex: /retry\s*[:=]\s*(\d+)/gi },
    { name: 'MaxRetries', regex: /maxRetries\s*[:=]\s*(\d+)/gi },
    { name: 'Batch Size', regex: /batch[Ss]ize\s*[:=]\s*(\d+)/gi },
    { name: 'Limit', regex: /limit\s*[:=]\s*(\d+)/gi },
    { name: 'Max', regex: /max\w*\s*[:=]\s*(\d+)/gi },
    { name: 'Min', regex: /min\w*\s*[:=]\s*(\d+)/gi },
    { name: 'Confidence', regex: /confidence\s*[:=]\s*(0\.\d+)/gi },
    { name: 'Temperature', regex: /temperature\s*[:=]\s*(0\.\d+|\d+\.\d+)/gi },
    { name: 'Priority', regex: /priority\s*[:=]\s*(\d+)/gi },
    { name: 'Weight', regex: /weight\s*[:=]\s*(0\.\d+)/gi },
    { name: 'Alpha/Beta', regex: /(?:alpha|beta)\s*[:=]\s*(0\.\d+)/gi },
    { name: 'Steepness', regex: /steepness\s*[:=]\s*(\d+)/gi },
    { name: 'Sensitivity', regex: /sensitivity\s*[:=]\s*(0\.\d+)/gi },
    { name: 'Decay Rate', regex: /decay\s*[:=]\s*(0\.\d+)/gi },
    { name: 'Learning Rate', regex: /learningRate\s*[:=]\s*(0\.\d+)/gi },
    { name: 'Interval', regex: /interval\s*[:=]\s*(\d+)/gi },
    { name: 'Delay', regex: /delay\s*[:=]\s*(\d+)/gi },
    { name: 'Concurrency', regex: /concurrency\s*[:=]\s*(\d+)/gi },
    { name: 'Chunk Size', regex: /chunk[Ss]ize\s*[:=]\s*(\d+)/gi }
];

// Directories to scan
const srcDirs = [
    'src',
    'scripts',
    'bin'
];

// Files to exclude
const excludePatterns = [
    /node_modules/,
    /\.git/,
    /\.log$/,
    /\.json$/,
    /\.md$/,
    /package-lock\.json/,
    /phi-scales\.js$/,
    /dynamic-constants\.js$/,
    /audit-fixed-values\.js$/
];

const findings = [];

function shouldExclude(filePath) {
    return excludePatterns.some(pattern => pattern.test(filePath));
}

function scanFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        patterns.forEach(pattern => {
            let match;
            pattern.regex.lastIndex = 0; // Reset regex

            while ((match = pattern.regex.exec(content)) !== null) {
                const value = match[1];
                const lineNumber = content.substring(0, match.index).split('\n').length;

                // Skip common false positives
                if (value === '0' || value === '1' || value === '2') continue;

                findings.push({
                    file: filePath,
                    line: lineNumber,
                    type: pattern.name,
                    value: value,
                    context: lines[lineNumber - 1].trim()
                });
            }
        });
    } catch (err) {
        console.error(`Error scanning ${filePath}:`, err.message);
    }
}

function scanDirectory(dir) {
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        entries.forEach(entry => {
            const fullPath = path.join(dir, entry.name);

            if (shouldExclude(fullPath)) return;

            if (entry.isDirectory()) {
                scanDirectory(fullPath);
            } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
                scanFile(fullPath);
            }
        });
    } catch (err) {
        console.error(`Error scanning directory ${dir}:`, err.message);
    }
}

function generateReport() {
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('  Heady Fixed Values Audit Report');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    if (findings.length === 0) {
        console.log('✓ No hardcoded values found! All constants are phi-scaled.\n');
        return;
    }

    // Group by type
    const byType = {};
    findings.forEach(f => {
        if (!byType[f.type]) byType[f.type] = [];
        byType[f.type].push(f);
    });

    console.log(`Found ${findings.length} hardcoded value(s) across ${Object.keys(byType).length} categories:\n`);

    Object.keys(byType).sort().forEach(type => {
        const items = byType[type];
        console.log(`\n▸ ${type} (${items.length} instance(s))`);
        console.log('─'.repeat(70));

        items.slice(0, 10).forEach(item => {
            console.log(`  ${item.file}:${item.line}`);
            console.log(`    Value: ${item.value}`);
            console.log(`    Context: ${item.context}`);
            console.log(`    Recommendation: Replace with PhiScale`);
            console.log();
        });

        if (items.length > 10) {
            console.log(`  ... and ${items.length - 10} more\n`);
        }
    });

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('  Recommended PhiScale Conversions');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log('Example conversions:\n');
    console.log('  Before: const timeout = 5000;');
    console.log('  After:  const timeout = DynamicTimeout.asMs();\n');

    console.log('  Before: if (confidence > 0.7) { ... }');
    console.log('  After:  if (confidence > DynamicConfidenceThreshold.value) { ... }\n');

    console.log('  Before: for (let retry = 0; retry < 3; retry++) { ... }');
    console.log('  After:  for (let retry = 0; retry < DynamicRetryCount.asInt(); retry++) { ... }\n');

    console.log('═══════════════════════════════════════════════════════════════════\n');
}

function saveToCsv() {
    const csvPath = path.join(__dirname, '../audit-results.csv');
    const csv = [
        'File,Line,Type,Value,Context'
    ];

    findings.forEach(f => {
        const context = f.context.replace(/"/g, '""');
        csv.push(`"${f.file}",${f.line},"${f.type}","${f.value}","${context}"`);
    });

    fs.writeFileSync(csvPath, csv.join('\n'));
    console.log(`CSV report saved to: ${csvPath}\n`);
}

// Main execution
console.log('Starting audit...\n');

srcDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
        console.log(`Scanning ${dir}/...`);
        scanDirectory(dir);
    }
});

generateReport();
saveToCsv();

process.exit(findings.length > 0 ? 1 : 0);
