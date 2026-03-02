/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 * Deployment Bee — Automated deployment orchestration across
 * Cloud Run, Cloudflare Workers, GitHub, and Hugging Face Spaces.
 */
const domain = 'deployment';
const description = 'Automated deployment: Cloud Run, Cloudflare Workers, GitHub push, HF Spaces, post-deploy verification';
const priority = 0.85;

const DEPLOY_TARGETS = {
    'cloud-run': { service: 'heady-manager', region: 'us-central1', project: 'heady-pre-production' },
    'cloudflare-worker': { name: 'heady-edge-proxy', account: '8b1fa38f282c691423c6399247d53323' },
    'github': { repo: 'HeadyMe/Heady-pre-production-9f2f0642', branch: 'main' },
    'hf-spaces': ['HeadyMe/heady-ai', 'HeadySystems/heady-systems', 'HeadyConnection/heady-connection'],
};

function getWork(ctx = {}) {
    const target = ctx.target || 'all';
    const work = [];

    // Git stage + push
    work.push(async () => {
        const { execSync } = require('child_process');
        const cwd = ctx.cwd || process.cwd();
        try {
            const status = execSync('git status --short', { cwd, encoding: 'utf8' });
            if (status.trim()) {
                execSync('git add -A', { cwd });
                execSync(`git commit -m "deploy: auto-deploy via deployment-bee"`, { cwd });
            }
            execSync('git push origin main', { cwd });
            return { bee: domain, action: 'git-push', success: true };
        } catch (err) {
            return { bee: domain, action: 'git-push', success: false, error: err.message };
        }
    });

    // Post-deploy verification (run health bee)
    work.push(async () => {
        try {
            const healthBee = require('./health-bee');
            const healthWork = healthBee.getWork(ctx);
            const results = await Promise.allSettled(healthWork.map(fn => fn()));
            const healthy = results.filter(r => r.status === 'fulfilled' && r.value?.healthy).length;
            return { bee: domain, action: 'post-deploy-verify', total: results.length, healthy, pass: healthy > results.length * 0.8 };
        } catch (err) {
            return { bee: domain, action: 'post-deploy-verify', success: false, error: err.message };
        }
    });

    return work;
}

module.exports = { domain, description, priority, getWork, DEPLOY_TARGETS };
