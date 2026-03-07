/**
 * Projection Maintenance Operations
 * Detects stale public projection candidates for the digital presence orchestrator.
 * © 2026 HeadySystems Inc.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

// How old (in ms) a projection must be to be considered stale
const DEFAULT_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Detect public projection candidates that are stale or need re-projection.
 * @param {object} opts
 * @param {number} [opts.staleThresholdMs] - Age threshold in ms (default 24h)
 * @param {string[]} [opts.domains] - Domains to check (default: all)
 * @param {boolean} [opts.dryRun=false]
 * @returns {Promise<{candidates: Array, source: string, checkedAt: string}>}
 */
async function detectCandidates(opts = {}) {
    const {
        staleThresholdMs = DEFAULT_STALE_THRESHOLD_MS,
        domains,
        dryRun = false,
    } = opts;

    const manifestPath = path.join(ROOT, 'configs', 'services', 'public-vector-projections.json');
    const candidates = [];
    const checkedAt = new Date().toISOString();

    let manifest = null;
    try {
        if (fs.existsSync(manifestPath)) {
            manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        }
    } catch (_e) {}

    if (!manifest) {
        return { candidates: [], source: 'no-manifest', checkedAt };
    }

    const projections = manifest.projections || manifest.domains || [];
    const now = Date.now();

    for (const proj of projections) {
        const domain = proj.domain || proj.name;
        if (domains && !domains.includes(domain)) continue;

        const lastProjected = proj.lastProjected ? new Date(proj.lastProjected).getTime() : 0;
        const ageMs = now - lastProjected;
        const isStale = ageMs > staleThresholdMs;

        if (isStale || proj.needsReprojection) {
            candidates.push({
                domain,
                lastProjected: proj.lastProjected || null,
                ageMs,
                reason: proj.needsReprojection ? 'forced' : 'stale',
                repo: proj.repo || null,
                dryRun,
            });
        }
    }

    return {
        candidates,
        source: 'projection-maintenance-ops',
        checkedAt,
        total: projections.length,
        staleCount: candidates.length,
    };
}

/**
 * Mark a domain as recently projected in the manifest.
 * @param {string} domain
 * @returns {Promise<boolean>}
 */
async function markProjected(domain) {
    const manifestPath = path.join(ROOT, 'configs', 'services', 'public-vector-projections.json');

    try {
        if (!fs.existsSync(manifestPath)) return false;
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const projections = manifest.projections || manifest.domains || [];

        const proj = projections.find((p) => (p.domain || p.name) === domain);
        if (proj) {
            proj.lastProjected = new Date().toISOString();
            proj.needsReprojection = false;
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
            return true;
        }
    } catch (_e) {}

    return false;
}

module.exports = { detectCandidates, markProjected };
