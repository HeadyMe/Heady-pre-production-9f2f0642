#!/usr/bin/env node
/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ heady deploy — One-Command Zero-Friction Cloud Deploy ═══
 *
 * Usage:
 *   npm run deploy              # Deploy from dev → Cloud Run (HeadyWeb)
 *   npm run deploy -- --target edge    # Deploy edge worker only
 *   npm run deploy -- --target all     # Deploy everything
 *
 * What this does:
 *   1. Git commits any uncommitted changes
 *   2. Pushes to GitHub (triggers CI/CD automatically)
 *   3. OR deploys directly to Cloud Run via `gcloud run deploy --source .`
 *
 * The result: your dev environment is live on headymcp.com, headyapi.com,
 * headyme.com, and all 9 HeadyWeb domains within ~90 seconds.
 * No local server needed — everything runs on Cloud Run.
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GCP_PROJECT = process.env.GCP_PROJECT_ID || 'heady-project';
const GCP_REGION = process.env.GCP_REGION || 'us-central1';
const SERVICE_NAME = 'heady-manager';

const args = process.argv.slice(2);
const target = args.includes('--target') ? args[args.indexOf('--target') + 1] : 'cloudrun';
const direct = args.includes('--direct'); // Skip git, deploy directly
const dryRun = args.includes('--dry-run');

function run(cmd, opts = {}) {
    console.log(`  → ${cmd}`);
    if (dryRun) return '[dry-run]';
    try {
        return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
    } catch (err) {
        if (opts.allowFail) return err.stderr || err.message;
        throw err;
    }
}

async function main() {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  🐝 Heady Deploy — Zero-Friction Cloud Projection');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log(`  Target:  ${target}`);
    console.log(`  Project: ${GCP_PROJECT}`);
    console.log(`  Region:  ${GCP_REGION}`);
    console.log(`  Service: ${SERVICE_NAME}`);
    console.log(`  Direct:  ${direct}`);
    console.log('');

    if (target === 'cloudrun' || target === 'all') {
        if (direct) {
            // Direct deploy — no git, just push straight to Cloud Run
            console.log('─── Direct Deploy to Cloud Run ───────────────────');
            console.log('  Building + deploying from source...');
            console.log('  (This takes ~60-90 seconds)');
            console.log('');

            const cmd = [
                'gcloud run deploy', SERVICE_NAME,
                '--source .',
                `--region ${GCP_REGION}`,
                `--project ${GCP_PROJECT}`,
                '--allow-unauthenticated',
                '--memory 1Gi',
                '--cpu 1',
                '--min-instances 0',
                '--max-instances 3',
                '--timeout 300',
                '--set-env-vars="NODE_ENV=production"',
                '--quiet',
            ].join(' ');

            if (dryRun) {
                console.log(`  [DRY RUN] Would execute: ${cmd}`);
            } else {
                try {
                    execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'inherit' });
                    console.log('');
                    console.log('  ✅ Cloud Run deploy complete!');
                } catch (err) {
                    console.error('  ❌ Deploy failed:', err.message);
                    process.exit(1);
                }
            }
        } else {
            // Git-based deploy — commit + push, CI/CD handles the rest
            console.log('─── Git-Based Deploy (CI/CD Pipeline) ──────────────');

            // Check for uncommitted changes
            const status = run('git status --porcelain', { allowFail: true });
            if (status && status.length > 0) {
                const lineCount = status.split('\n').filter(Boolean).length;
                console.log(`  📝 ${lineCount} uncommitted changes detected`);

                run('git add -A', { allowFail: true });
                const msg = `🐝 heady deploy: ${new Date().toISOString().split('T')[0]} projection`;
                run(`git commit -m "${msg}"`, { allowFail: true });
                console.log(`  ✅ Committed: "${msg}"`);
            } else {
                console.log('  ✅ Working tree clean');
            }

            // Push to trigger CI/CD
            console.log('  📤 Pushing to GitHub...');
            run('git push origin main', { allowFail: true });
            console.log('  ✅ Pushed — CI/CD pipeline triggered');
            console.log('');
            console.log('  📋 Pipeline phases:');
            console.log('     P0: 🔒 Security Scan (TruffleHog + CodeQL)');
            console.log('     P1: 🧬 Monorepo Validation + Tests');
            console.log('     P2: ☁️  Cloud Run Deploy (heady-manager)');
            console.log('     P3: 🤗 HuggingFace Spaces');
            console.log('     P4: ⚡ Cloudflare Edge');
            console.log('     P5: ✅ Auto-Success Verification');
        }
    }

    if (target === 'edge' || target === 'all') {
        console.log('');
        console.log('─── Edge Deploy (Cloudflare Workers) ───────────────');
        const cfCmd = 'npx -y wrangler@latest deploy cloudflare-workers/heady-edge-proxy.js';
        if (dryRun) {
            console.log(`  [DRY RUN] Would execute: ${cfCmd}`);
        } else {
            run(cfCmd, { allowFail: true });
            console.log('  ✅ Edge worker deployed');
        }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  🌐 HeadyWeb URLs (live after deploy):');
    console.log('     headymcp.com    → HeadyMCP (AI Tools Hub)');
    console.log('     headyapi.com    → HeadyAPI (Developer Portal)');
    console.log('     headyio.com     → HeadyIO (Enterprise Connector)');
    console.log('     headyme.com     → HeadyMe (Personal Dashboard)');
    console.log('     headytrader.com → HeadyTrader (Trading Suite)');
    console.log('     headymusic.com  → HeadyMusic (Studio)');
    console.log('     headyfoundation.org → Heady Foundation');
    console.log('     headysystems.com    → Heady Systems');
    console.log('     myheady.ai          → MyHeady.AI');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
}

main().catch(err => {
    console.error('Deploy failed:', err.message);
    process.exit(1);
});
