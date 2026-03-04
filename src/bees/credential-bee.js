/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ─── Credential Bee ─────────────────────────────────────────────
 *
 * Swarm worker for cross-domain credential health monitoring.
 *
 * Workers:
 *   1. Expiry Monitor  — flags credentials approaching expiration
 *   2. Domain Coverage — reports which domains have credentials vs gaps
 *   3. Rotation Alert  — recommends credential rotation schedules
 *
 * Discovered by bee-factory.js via auto-scan of src/bees/*.
 * ──────────────────────────────────────────────────────────────────
 */

const path = require('path');

const BEE_ID = 'credential-bee';
const CREDENTIAL_ROTATION_DAYS = {
    github: 90,
    cloudflare: 180,
    gcloud: 365,
    workspace: 365,
    huggingface: 180,
    email: 90,
    ssh: 365,
    gpg: 365,
    custom: 90,
};

let vault = null;
try {
    vault = require(path.join(__dirname, '..', 'services', 'secure-key-vault')).vault;
} catch { /* vault not loaded yet */ }

const workers = [
    {
        id: `${BEE_ID}:expiry-monitor`,
        name: 'Credential Expiry Monitor',
        interval: 60 * 60 * 1000, // hourly
        async run() {
            if (!vault || !vault.isUnlocked()) return { skipped: true, reason: 'vault locked' };

            const all = await vault.list();
            const now = Date.now();
            const expiring = all.filter(c =>
                c.expiresAt && (c.expiresAt - now) < 7 * 24 * 60 * 60 * 1000 // within 7 days
            );
            const expired = all.filter(c => c.expired);

            if (global.eventBus && (expiring.length || expired.length)) {
                global.eventBus.emit('vault:expiry-alert', {
                    expiring: expiring.map(c => c.credentialId),
                    expired: expired.map(c => c.credentialId),
                });
            }

            return {
                total: all.length,
                expiringSoon: expiring.length,
                expired: expired.length,
                details: [...expired, ...expiring].map(c => ({
                    id: c.credentialId,
                    domain: c.domain,
                    status: c.expired ? 'EXPIRED' : 'EXPIRING_SOON',
                })),
            };
        },
    },
    {
        id: `${BEE_ID}:domain-coverage`,
        name: 'Domain Coverage Report',
        interval: 4 * 60 * 60 * 1000, // every 4 hours
        async run() {
            if (!vault || !vault.isUnlocked()) return { skipped: true, reason: 'vault locked' };

            const health = vault.getHealth();
            const allDomains = health.domainsAvailable;
            const covered = Object.keys(health.domainCoverage);
            const missing = allDomains.filter(d => !covered.includes(d));

            return {
                covered,
                missing,
                coveragePercent: Math.round((covered.length / allDomains.length) * 100),
                counts: health.domainCoverage,
            };
        },
    },
    {
        id: `${BEE_ID}:rotation-alert`,
        name: 'Credential Rotation Advisor',
        interval: 24 * 60 * 60 * 1000, // daily
        async run() {
            if (!vault || !vault.isUnlocked()) return { skipped: true, reason: 'vault locked' };

            const all = await vault.list();
            const now = Date.now();
            const needsRotation = [];

            for (const cred of all) {
                const maxAge = CREDENTIAL_ROTATION_DAYS[cred.domain] || 90;
                const ageMs = now - (cred.createdAt || 0);
                const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));

                if (ageDays >= maxAge) {
                    needsRotation.push({
                        credentialId: cred.credentialId,
                        domain: cred.domain,
                        ageDays,
                        maxDays: maxAge,
                        overdueDays: ageDays - maxAge,
                    });
                }
            }

            if (global.eventBus && needsRotation.length) {
                global.eventBus.emit('vault:rotation-needed', { credentials: needsRotation });
            }

            return {
                total: all.length,
                needsRotation: needsRotation.length,
                credentials: needsRotation,
            };
        },
    },
];

module.exports = {
    id: BEE_ID,
    name: 'Credential Bee',
    description: 'Cross-domain credential health monitoring and rotation advisory',
    workers,
};
