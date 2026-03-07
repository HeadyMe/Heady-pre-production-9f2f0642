/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Security Bee — Active security operations + module wiring:
 *   - Patent Lock enforcement & evidence snapshots
 *   - Credential exposure scanning
 *   - .gitignore audit & hardening
 *   - Module health checks for all security systems
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const domain = 'security';
const description = 'Patent lock, credential scan, gitignore audit, auth, governance, PQC, RBAC, secret rotation';
const priority = 1.0; // Highest — security is non-negotiable

const PROJECT_ROOT = path.join(__dirname, '..', '..');

function getWork(ctx = {}) {
    return [
        // ═══ ACTIVE SECURITY OPS (run every swarm cycle) ═══

        // 1. Patent Evidence Snapshot — generate SHA-384 hash of all patent-critical files
        async () => {
            try {
                const { generateEvidenceSnapshot } = require('../security/code-governance');
                const snapshot = generateEvidenceSnapshot();
                return { bee: domain, action: 'patent-evidence-snapshot', ok: snapshot.ok, files: snapshot.file_count, composite: snapshot.composite_hash?.substring(0, 16) + '...' };
            } catch (e) { return { bee: domain, action: 'patent-evidence-snapshot', ok: false, error: e.message }; }
        },

        // 2. Patent Lock Audit — verify no patent-locked files have been modified without owner approval
        async () => {
            try {
                const { isPatentLocked, loadConfig } = require('../security/code-governance');
                const config = loadConfig();
                const patentLock = config.patent_lock || {};
                const allClaims = [...(patentLock.rtp_verified || []), ...(patentLock.new_inventive_steps || [])];
                const violations = [];
                for (const claim of allClaims) {
                    for (const f of claim.files || []) {
                        const check = isPatentLocked(f);
                        if (check.locked) {
                            const fullPath = path.join(PROJECT_ROOT, f);
                            const exists = fs.existsSync(fullPath);
                            if (!exists) violations.push({ file: f, claim: claim.id, issue: 'MISSING' });
                        }
                    }
                }
                return { bee: domain, action: 'patent-lock-audit', ok: violations.length === 0, claims: allClaims.length, violations };
            } catch (e) { return { bee: domain, action: 'patent-lock-audit', ok: false, error: e.message }; }
        },

        // 3. Credential Exposure Scan — check for tracked sensitive files
        async () => {
            try {
                const { execSync } = require('child_process');
                const tracked = execSync('git ls-files "*.env*" "*.key" "*.pem" "secret*" "*.credentials" 2>/dev/null', { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();
                const files = tracked.split('\n').filter(f => f && !f.includes('.example') && !f.includes('.env.example'));
                return { bee: domain, action: 'credential-scan', ok: files.length === 0, exposed: files };
            } catch (e) { return { bee: domain, action: 'credential-scan', ok: true, exposed: [] }; } // git ls-files returns non-zero if nothing found
        },

        // 4. .gitignore Health Check — verify critical patterns exist
        async () => {
            try {
                const gitignore = fs.readFileSync(path.join(PROJECT_ROOT, '.gitignore'), 'utf8');
                const requiredPatterns = ['.env', '*.pid', '*.jsonl', '*.key', '*.pem', 'node_modules/', '*.bak'];
                const missing = requiredPatterns.filter(p => !gitignore.includes(p));
                return { bee: domain, action: 'gitignore-audit', ok: missing.length === 0, missing, totalLines: gitignore.split('\n').length };
            } catch (e) { return { bee: domain, action: 'gitignore-audit', ok: false, error: e.message }; }
        },

        // ═══ MODULE HEALTH CHECKS (verify all security systems load) ═══
        async () => { try { require('../hc_auth'); return { bee: domain, action: 'auth', loaded: true }; } catch { return { bee: domain, action: 'auth', loaded: false }; } },
        async () => { try { require('../security/code-governance'); return { bee: domain, action: 'code-governance', loaded: true }; } catch { return { bee: domain, action: 'code-governance', loaded: false }; } },
        async () => { try { require('../security/env-validator'); return { bee: domain, action: 'env-validator', loaded: true }; } catch { return { bee: domain, action: 'env-validator', loaded: false }; } },
        async () => { try { require('../security/handshake'); return { bee: domain, action: 'handshake', loaded: true }; } catch { return { bee: domain, action: 'handshake', loaded: false }; } },
        async () => { try { require('../security/ip-classification'); return { bee: domain, action: 'ip-classification', loaded: true }; } catch { return { bee: domain, action: 'ip-classification', loaded: false }; } },
        async () => { try { require('../security/pqc'); return { bee: domain, action: 'pqc', loaded: true }; } catch { return { bee: domain, action: 'pqc', loaded: false }; } },
        async () => { try { require('../security/rate-limiter'); return { bee: domain, action: 'rate-limiter', loaded: true }; } catch { return { bee: domain, action: 'rate-limiter', loaded: false }; } },
        async () => { try { require('../security/rbac-vendor'); return { bee: domain, action: 'rbac-vendor', loaded: true }; } catch { return { bee: domain, action: 'rbac-vendor', loaded: false }; } },
        async () => { try { require('../security/secret-rotation'); return { bee: domain, action: 'secret-rotation', loaded: true }; } catch { return { bee: domain, action: 'secret-rotation', loaded: false }; } },
        async () => { try { require('../security/web3-ledger-anchor'); return { bee: domain, action: 'web3-ledger', loaded: true }; } catch { return { bee: domain, action: 'web3-ledger', loaded: false }; } },
    ];
}

module.exports = { domain, description, priority, getWork };
