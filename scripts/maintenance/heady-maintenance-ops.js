#!/usr/bin/env node
/*
 * Maintenance ops audit for stale runtime files and obsolete edge tunnel/service worker artifacts.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CANDIDATE_PATTERNS = [
    /service-worker/i,
    /sw\.js$/i,
    /tunnel/i,
    /cloudflared/i,
    /server\.pid$/i,
    /\.log$/i,
    /\.jsonl$/i,
];

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next']);

function walk(dir, acc = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relative = path.relative(ROOT, fullPath);
        if (entry.isDirectory()) {
            if (!IGNORE_DIRS.has(entry.name)) walk(fullPath, acc);
            continue;
        }

        if (CANDIDATE_PATTERNS.some((pattern) => pattern.test(entry.name) || pattern.test(relative))) {
            acc.push(relative);
        }
    }
    return acc;
}

function main() {
    const matches = walk(ROOT);
    const grouped = {
        runtime: matches.filter((m) => /(server\.pid$|\.log$|\.jsonl$)/i.test(m)),
        serviceWorkers: matches.filter((m) => /(service-worker|sw\.js$)/i.test(m)),
        tunnels: matches.filter((m) => /(tunnel|cloudflared)/i.test(m)),
    };

    const report = {
        generatedAt: new Date().toISOString(),
        repoRoot: ROOT,
        totals: {
            matches: matches.length,
            runtime: grouped.runtime.length,
            serviceWorkers: grouped.serviceWorkers.length,
            tunnels: grouped.tunnels.length,
        },
        grouped,
        guidance: [
            'Review each candidate and remove entries not required for Cloudflare/GCloud production path.',
            'Keep only active deployment descriptors; avoid committing runtime state files.',
            'Re-run this script after cleanup to verify a zero-unnecessary-file baseline.',
        ],
    };

    process.stdout.write(JSON.stringify(report, null, 2));
}

main();
