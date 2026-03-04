#!/usr/bin/env node
/*
 * Vault Initialization — stores credentials and registers devices.
 * Tokens are read from environment variables (never hardcoded in source).
 *
 * Usage:
 *   VAULT_PASS=<passphrase> \
 *   GITHUB_HEADYME_PAT=ghp_... \
 *   GITHUB_HEADYCONN_PAT=ghp_... \
 *   CF_API_TOKEN=... \
 *   node scripts/vault-init.js
 *
 * Or pass just the passphrase and it will auto-discover local keys:
 *   VAULT_PASS=<passphrase> node scripts/vault-init.js
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

const vectorMemory = require(path.join(ROOT, 'src', 'vector-memory'));
const { vault } = require(path.join(ROOT, 'src', 'services', 'secure-key-vault'));
const { crossDeviceFS } = require(path.join(ROOT, 'src', 'services', 'cross-device-fs'));

async function main() {
    const passphrase = process.env.VAULT_PASS || process.argv[2];
    if (!passphrase) {
        console.error('Usage: VAULT_PASS=<passphrase> node scripts/vault-init.js');
        console.error('  Or: node scripts/vault-init.js <passphrase>');
        process.exit(1);
    }

    console.log('─── Heady Vault Initialization ───');
    console.log('');

    // 1. Init vector memory
    console.log('[1/5] Initializing vector memory...');
    if (vectorMemory.init) await vectorMemory.init();

    // 2. Unlock vault
    console.log('[2/5] Unlocking vault...');
    const unlockResult = await vault.unlock(passphrase);
    console.log(`  ✅ Vault unlocked — ${unlockResult.credentialCount} existing credentials`);

    // 3. Collect and store credentials from env vars
    console.log('[3/5] Storing credentials from environment...');

    const credentials = [];

    // ── Shared (personal + Heady system) ───────────────────────
    if (process.env.GITHUB_HEADYME_PAT) {
        credentials.push({
            name: 'headyme-pat', domain: 'github',
            value: process.env.GITHUB_HEADYME_PAT,
            meta: {
                label: 'GitHub PAT — HeadyMe org', owner: 'shared',
                scopes: ['repo', 'admin:org', 'write:packages']
            },
        });
    }
    if (process.env.GITHUB_HEADYCONN_PAT) {
        credentials.push({
            name: 'headyconnection-pat', domain: 'github',
            value: process.env.GITHUB_HEADYCONN_PAT,
            meta: {
                label: 'GitHub PAT — HeadyConnection org', owner: 'shared',
                scopes: ['repo', 'admin:org']
            },
        });
    }

    // ── System (Heady platform secrets) ────────────────────────
    if (process.env.CF_API_TOKEN) {
        credentials.push({
            name: 'heady-api-token', domain: 'cloudflare',
            value: process.env.CF_API_TOKEN,
            meta: {
                label: 'Cloudflare API Token — Heady account', owner: 'system',
                scopes: ['workers', 'dns', 'zones', 'kv', 'r2', 'vectorize']
            },
        });
    }

    // ── Personal (auto-discovered from local device) ───────────
    const sshKeyPath = path.join(os.homedir(), '.ssh', 'id_ed25519');
    const sshKeyPathRSA = path.join(os.homedir(), '.ssh', 'id_rsa');
    if (fs.existsSync(sshKeyPath)) {
        credentials.push({
            name: 'ssh-default', domain: 'ssh',
            value: fs.readFileSync(sshKeyPath, 'utf8'),
            meta: { label: 'Default SSH key (ed25519)', owner: 'personal' },
        });
    } else if (fs.existsSync(sshKeyPathRSA)) {
        credentials.push({
            name: 'ssh-default', domain: 'ssh',
            value: fs.readFileSync(sshKeyPathRSA, 'utf8'),
            meta: { label: 'Default SSH key (RSA)', owner: 'personal' },
        });
    }

    // GPG key
    try {
        const { execSync } = require('child_process');
        const gpgKey = execSync('gpg --export-secret-keys --armor headyme 2>/dev/null', { encoding: 'utf8' });
        if (gpgKey && gpgKey.length > 100) {
            credentials.push({
                name: 'gpg-headyme', domain: 'gpg',
                value: gpgKey,
                meta: { label: 'GPG signing key — headyme', owner: 'personal' },
            });
        }
    } catch { /* no GPG key */ }

    // GCloud service account
    const gcloudKeyPath = path.join(os.homedir(), '.config', 'gcloud', 'heady-deployer-key.json');
    if (fs.existsSync(gcloudKeyPath)) {
        credentials.push({
            name: 'deployer-sa', domain: 'gcloud',
            value: fs.readFileSync(gcloudKeyPath, 'utf8'),
            meta: { label: 'GCloud deployer service account key', owner: 'system' },
        });
    }

    if (credentials.length === 0) {
        console.log('  ⚠ No credentials found in environment or local keys.');
        console.log('  Set env vars: GITHUB_HEADYME_PAT, GITHUB_HEADYCONN_PAT, CF_API_TOKEN');
    }

    for (const cred of credentials) {
        try {
            await vault.store(cred.name, cred.domain, cred.value, cred.meta);
            console.log(`  ✅ [${cred.meta.owner}] ${cred.domain}/${cred.name} — ${cred.meta.label}`);
        } catch (err) {
            console.log(`  ❌ ${cred.domain}/${cred.name} — ${err.message}`);
        }
    }

    // 4. Register this device
    console.log('[4/5] Registering local device...');
    await crossDeviceFS.registerDevice('heady-workstation', {
        hostname: os.hostname(),
        user: os.userInfo().username,
        sshKeyName: 'ssh-default',
        root: '/',
        capabilities: ['read', 'write', 'exec', 'sudo'],
    });
    console.log(`  ✅ Device: heady-workstation (${os.hostname()})`);

    // 5. Verify round-trip
    console.log('[5/5] Verifying vault round-trip...');
    const creds = await vault.list();
    if (creds.length > 0) {
        const first = creds[0];
        const retrieved = await vault.get(first.name, first.domain);
        if (retrieved && retrieved.value) {
            console.log(`  ✅ Encrypt → store → retrieve → decrypt verified (${first.credentialId})`);
        } else {
            console.log('  ❌ Round-trip verification failed');
        }
    }

    // Summary
    const health = vault.getHealth();
    console.log('');
    console.log('─── Vault Summary ───');
    console.log(`  Total credentials: ${health.totalCredentials}`);
    console.log(`  Ownership: ${JSON.stringify(health.ownershipBreakdown)}`);
    console.log(`  Domain coverage: ${JSON.stringify(health.domainCoverage)}`);
    console.log(`  Expired: ${health.expiredCredentials}`);
    console.log('');
    console.log('Done. Vault is unlocked and ready.');

    // Persist
    if (vectorMemory.persistAllShards) {
        await vectorMemory.persistAllShards();
        console.log('  Vector memory persisted.');
    }
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
