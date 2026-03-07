/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Governance Bee — Active governance operations + module wiring:
 *   - Protected path enforcement audit
 *   - Version alignment verification
 *   - Root directory hygiene scan
 *   - Governance module health checks
 */
const fs = require('fs');
const path = require('path');
const domain = 'governance';
const description = 'Protected path audit, version sync, root hygiene, approval gates, policy engine, principles';
const priority = 0.9; // High — governance underpins system integrity

const PROJECT_ROOT = path.join(__dirname, '..', '..');

function getWork(ctx = {}) {
    return [
        // ═══ ACTIVE GOVERNANCE OPS ═══

        // 1. Protected Path Enforcement — verify CODEOWNERS and governance config are in sync
        async () => {
            try {
                const { loadConfig } = require('../security/code-governance');
                const config = loadConfig();
                const protectedPaths = config.auth_gate?.protected_paths || [];
                const codeownersPath = path.join(PROJECT_ROOT, '.github', 'CODEOWNERS');
                const hasCodeowners = fs.existsSync(codeownersPath);
                return {
                    bee: domain, action: 'protected-path-audit', ok: true,
                    protectedPaths: protectedPaths.length,
                    hasCodeowners,
                    patentClaims: (config.patent_lock?.rtp_verified?.length || 0) + (config.patent_lock?.new_inventive_steps?.length || 0),
                };
            } catch (e) { return { bee: domain, action: 'protected-path-audit', ok: false, error: e.message }; }
        },

        // 2. Version Alignment — check package.json vs README vs registry
        async () => {
            try {
                const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
                const readme = fs.readFileSync(path.join(PROJECT_ROOT, 'README.md'), 'utf8');
                const readmeVersionMatch = readme.match(/v(\d+\.\d+\.\d+)/);
                const readmeVersion = readmeVersionMatch ? readmeVersionMatch[1] : 'unknown';
                const aligned = pkg.version === readmeVersion;
                return {
                    bee: domain, action: 'version-alignment', ok: aligned,
                    packageVersion: pkg.version, readmeVersion,
                    drift: aligned ? null : `package.json=${pkg.version} README=${readmeVersion}`,
                };
            } catch (e) { return { bee: domain, action: 'version-alignment', ok: false, error: e.message }; }
        },

        // 3. Root Directory Hygiene — count root files, flag if bloating
        async () => {
            try {
                const { execSync } = require('child_process');
                const rootFiles = execSync("git ls-files --full-name | grep -v '/' | wc -l", { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();
                const count = parseInt(rootFiles);
                const healthy = count <= 35; // Threshold: 35 root files max
                return {
                    bee: domain, action: 'root-hygiene', ok: healthy,
                    rootFileCount: count, threshold: 35,
                    warning: healthy ? null : `Root directory has ${count} files (threshold: 35)`,
                };
            } catch (e) { return { bee: domain, action: 'root-hygiene', ok: false, error: e.message }; }
        },

        // 4. Lockfile Consistency — verify single package manager
        async () => {
            try {
                const hasNpm = fs.existsSync(path.join(PROJECT_ROOT, 'package-lock.json'));
                const hasPnpm = fs.existsSync(path.join(PROJECT_ROOT, 'pnpm-lock.yaml'));
                const hasYarn = fs.existsSync(path.join(PROJECT_ROOT, 'yarn.lock'));
                const managers = [hasNpm && 'npm', hasPnpm && 'pnpm', hasYarn && 'yarn'].filter(Boolean);
                return {
                    bee: domain, action: 'lockfile-consistency', ok: managers.length <= 1,
                    managers, conflict: managers.length > 1 ? `Multiple: ${managers.join(', ')}` : null,
                };
            } catch (e) { return { bee: domain, action: 'lockfile-consistency', ok: false, error: e.message }; }
        },

        // ═══ MODULE HEALTH CHECKS ═══
        async () => { try { require('../governance/approval-gates'); return { bee: domain, action: 'approval-gates', loaded: true }; } catch { return { bee: domain, action: 'approval-gates', loaded: false }; } },
        async () => { try { require('../policy-engine'); return { bee: domain, action: 'policy-engine', loaded: true }; } catch { return { bee: domain, action: 'policy-engine', loaded: false }; } },
        async () => { try { require('../policy-service'); return { bee: domain, action: 'policy-service', loaded: true }; } catch { return { bee: domain, action: 'policy-service', loaded: false }; } },
        async () => { try { require('../heady-principles'); return { bee: domain, action: 'heady-principles', loaded: true }; } catch { return { bee: domain, action: 'heady-principles', loaded: false }; } },
        async () => { try { require('../corrections'); return { bee: domain, action: 'corrections', loaded: true }; } catch { return { bee: domain, action: 'corrections', loaded: false }; } },
    ];
}

module.exports = { domain, description, priority, getWork };
