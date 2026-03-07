/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * scripts/security/rotate-secrets.js
 * CLI runner for Secret Rotation audits and alerts.
 */

const { SecretRotation } = require('../../src/security/secret-rotation');
const path = require('path');

const rotation = new SecretRotation();

async function main() {
    const args = process.argv.slice(2);
    const isAudit = args.includes('--audit');
    const isJson = args.includes('--json');

    const report = rotation.audit();

    if (isJson) {
        console.log(JSON.stringify(report, null, 2));
        return;
    }

    console.log(`\n═══ Heady Secret Audit [${report.auditedAt}] ═══`);
    console.log(`Score: ${report.score} (${report.healthy.length}/${report.total} healthy)`);

    if (report.expired.length > 0) {
        console.log('\n❌ EXPIRED SECRETS (Rotate ASAP):');
        report.expired.forEach(s => {
            console.log(`  - ${s.name.padEnd(20)} [Provider: ${s.provider}] (Age: ${s.ageDays}d, Expiry: 0d)`);
            if (s.rotationUrl) console.log(`    URL: ${s.rotationUrl}`);
        });
    }

    if (report.warning.length > 0) {
        console.log('\n⚠️  WARNING: Secrets Expiring Soon:');
        report.warning.forEach(s => {
            console.log(`  - ${s.name.padEnd(20)} [Provider: ${s.provider}] (Age: ${s.ageDays}d, Expires in: ${s.daysUntilExpiry}d)`);
        });
    }

    if (report.healthy.length === report.total) {
        console.log('\n✅ All secrets are healthy and within rotation bounds.');
    }

    console.log('\n═══ Audit Complete ═══\n');
}

main().catch(console.error);
