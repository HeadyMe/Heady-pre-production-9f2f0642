#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const REPORT_PATH = path.join(ROOT, 'data', 'projection-maintenance-report.json');

const CRITICAL_PATH_MARKERS = [
    'cloudflare/heady-edge-proxy/',
    'cloudflare/heady-edge-node/',
    'cloudflare/heady-manager-proxy/',
    'configs/infrastructure/cloud/',
    'configs/cloudflare-workers/',
    'cloudflare/heady-cloudrun-failover/',
];

function isProtectedPath(filePath) {
    return CRITICAL_PATH_MARKERS.some((marker) => filePath.includes(marker));
}

function gitTrackedFiles() {
    const output = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' });
    return output.split('\n').map((v) => v.trim()).filter(Boolean);
}

function searchReferences(filePath) {
    const escaped = filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
        const out = execSync(`rg -n "${escaped}" src scripts configs docs cloudflare infrastructure`, { cwd: ROOT, encoding: 'utf8' });
        return out.split('\n').filter(Boolean).length;
    } catch {
        return 0;
    }
}

function scoreCandidate(filePath) {
    const refs = searchReferences(filePath);
    const protectedPath = isProtectedPath(filePath);
    const stale = refs <= 1 && !protectedPath;
    const confidence = refs === 0 ? 'high' : refs === 1 ? 'medium' : 'low';
    return { filePath, refs, protected: protectedPath, stale, confidence };
}

function detectCandidates(files) {
    const workerCandidates = files.filter((filePath) =>
        filePath.includes('cloudflare/') && filePath.endsWith('.js') && filePath.toLowerCase().includes('worker'));
    const tunnelCandidates = files.filter((filePath) =>
        filePath.toLowerCase().includes('tunnel') || filePath.includes('cloudflared'));
    const serviceWorkerCandidates = files.filter((filePath) =>
        filePath.toLowerCase().includes('service-worker') || /(^|\/)sw\.js$/i.test(filePath));
    const gcloudCandidates = files.filter((filePath) =>
        filePath.toLowerCase().includes('gcloud') || filePath.toLowerCase().includes('cloudrun'));

    const staleWorkers = workerCandidates.map(scoreCandidate).filter((entry) => entry.stale);
    const staleTunnels = tunnelCandidates.map(scoreCandidate).filter((entry) => entry.stale);
    const staleServiceWorkers = serviceWorkerCandidates.map(scoreCandidate).filter((entry) => entry.stale);
    const staleGCloud = gcloudCandidates.map(scoreCandidate).filter((entry) => entry.stale);

    return {
        staleWorkers,
        staleTunnels,
        staleServiceWorkers,
        staleGCloud,
        stale: staleWorkers.concat(staleTunnels, staleServiceWorkers, staleGCloud),
        protected: files.filter((p) => isProtectedPath(p)),
    };
}

function applyPrune(staleEntries, { strict = true } = {}) {
    let removed = 0;
    staleEntries.forEach(({ filePath, refs }) => {
        if (strict && refs > 0) return;
        const absolute = path.join(ROOT, filePath);
        if (fs.existsSync(absolute)) {
            fs.rmSync(absolute);
            removed += 1;
        }
    });
    return removed;
}

function runMaintenance({ apply = false, strict = true } = {}) {
    const files = gitTrackedFiles();
    const candidates = detectCandidates(files);

    const report = {
        generatedAt: new Date().toISOString(),
        apply,
        strict,
        totalFiles: files.length,
        staleWorkers: candidates.staleWorkers,
        staleTunnels: candidates.staleTunnels,
        staleServiceWorkers: candidates.staleServiceWorkers,
        staleGCloud: candidates.staleGCloud,
        staleCount: candidates.stale.length,
        removed: 0,
        protected: candidates.protected,
    };

    if (apply && candidates.stale.length > 0) {
        report.removed = applyPrune(candidates.stale, { strict });
    }

    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    process.stdout.write(`projection-maintenance-ops: ${apply ? 'apply' : 'dry-run'} complete (strict=${strict}, stale=${report.staleCount}, removed=${report.removed})\n`);

    return report;
}

if (require.main === module) {
    runMaintenance({
        apply: process.argv.includes('--apply'),
        strict: !process.argv.includes('--no-strict'),
    });
}

module.exports = {
    gitTrackedFiles,
    detectCandidates,
    runMaintenance,
    isProtectedPath,
    scoreCandidate,
};
