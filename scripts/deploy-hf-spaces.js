#!/usr/bin/env node
/**
 * Deploy Heady HuggingFace Spaces — Dynamic Delivery Pipeline
 * 
 * Usage:
 *   node scripts/deploy-hf-spaces.js              # Deploy all spaces
 *   node scripts/deploy-hf-spaces.js --dry-run     # Build without pushing
 *   node scripts/deploy-hf-spaces.js --space main  # Deploy single space
 * 
 * Requires: HF_TOKEN env var for actual deployment
 */
const fs = require('fs');
const fsp = require('fs/promises');
const { join } = require('path');
const { execSync } = require('child_process');

const ROOT = join(__dirname, '..');
const SPACES_DIR = join(ROOT, 'heady-hf-spaces');
const SHARED_DIR = join(SPACES_DIR, 'shared');
const BUILD_DIR = join(ROOT, '.hf-build');
const VERSION = '3.0.0';

// ── Space Definitions ──
const SPACES = [
    { id: 'main', org: 'HeadyMe', repo: 'heady-ai', source: join(SPACES_DIR, 'main'), apiUrl: 'https://api.headysystems.com' },
    { id: 'systems', org: 'HeadySystems', repo: 'heady-systems', source: join(SPACES_DIR, 'systems'), apiUrl: 'https://api.headysystems.com' },
    { id: 'connection', org: 'HeadyConnection', repo: 'heady-connection', source: join(SPACES_DIR, 'connection'), apiUrl: 'https://api.headysystems.com' },
];

const SHARED_ASSETS = ['buddy-widget.js', 'heady-runtime.js', 'icon.png', 'logo.png'];

// ── CLI Args ──
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const spaceFilter = args.includes('--space') ? args[args.indexOf('--space') + 1] : null;

function log(msg) { console.log(`[HF-Deploy] ${msg}`); }
function warn(msg) { console.warn(`[HF-Deploy] ⚠️  ${msg}`); }
function ok(msg) { console.log(`[HF-Deploy] ✅ ${msg}`); }

// ── Helpers ──
async function ensureDir(dir) {
    await fsp.mkdir(dir, { recursive: true });
}

async function emptyDir(dir) {
    try { await fsp.rm(dir, { recursive: true, force: true }); } catch { }
    await fsp.mkdir(dir, { recursive: true });
}

async function copyFile(src, dest) {
    await fsp.copyFile(src, dest);
}

async function pathExists(p) {
    try { await fsp.access(p); return true; } catch { return false; }
}

// ── Runtime Config Injection ──
function createRuntimeConfig(space) {
    return `
<!-- Heady Dynamic Runtime Config — injected at deploy time -->
<script>
window.HEADY_CONFIG = {
    apiUrl: "${space.apiUrl}",
    spaceId: "${space.id}",
    spaceOrg: "${space.org}",
    spaceRepo: "${space.repo}",
    version: "${VERSION}",
    buildTs: "${new Date().toISOString()}",
    statusPollMs: 30000
};
window.HEADY_API = "${space.apiUrl}";
</script>
<script src="heady-runtime.js"></script>
`;
}

function injectRuntime(html, space) {
    const runtimeBlock = createRuntimeConfig(space);

    if (html.includes('window.HEADY_CONFIG')) {
        // Already has config — replace it
        html = html.replace(
            /<!-- Heady Dynamic Runtime Config[^]*?<\/script>\s*<script src="heady-runtime\.js"><\/script>/,
            runtimeBlock.trim()
        );
    } else if (html.includes('window.HEADY_API=')) {
        html = html.replace(
            /<script>window\.HEADY_API=[^<]*<\/script>\s*<script src="buddy-widget\.js"><\/script>/,
            `${runtimeBlock}\n<script src="buddy-widget.js"></script>`
        );
    } else if (html.includes('</body>')) {
        html = html.replace(
            '</body>',
            `${runtimeBlock}\n<script src="buddy-widget.js"></script>\n</body>`
        );
    }

    if (space.id === 'main' && html.includes('All Systems Operational · SDK v1.0.0')) {
        html = html.replace(
            '🟢 All Systems Operational · SDK v1.0.0',
            '<span id="heady-live-status">⏳ Checking...</span> · SDK v' + VERSION
        );
    }

    return html;
}

// ── Build a Single Space ──
async function buildSpace(space) {
    log(`Building space: ${space.id} (${space.org}/${space.repo})`);

    const buildPath = join(BUILD_DIR, space.id);
    await emptyDir(buildPath);

    // Copy source files
    const sourceFiles = await fsp.readdir(space.source);
    for (const file of sourceFiles) {
        const srcPath = join(space.source, file);
        const stat = await fsp.stat(srcPath);
        if (stat.isFile()) {
            await copyFile(srcPath, join(buildPath, file));
        }
    }

    // Copy shared assets
    for (const asset of SHARED_ASSETS) {
        const src = join(SHARED_DIR, asset);
        if (await pathExists(src)) {
            await copyFile(src, join(buildPath, asset));
        }
    }

    // Inject runtime into HTML
    const htmlPath = join(buildPath, 'index.html');
    if (await pathExists(htmlPath)) {
        let html = await fsp.readFile(htmlPath, 'utf8');
        html = injectRuntime(html, space);
        await fsp.writeFile(htmlPath, html, 'utf8');
        ok(`Injected runtime config into ${space.id}/index.html`);
    }

    // Verify README.md exists (required by HF)
    const readmePath = join(buildPath, 'README.md');
    if (!(await pathExists(readmePath))) {
        warn(`No README.md found for ${space.id}, creating minimal one`);
        await fsp.writeFile(readmePath, `---\ntitle: ${space.repo}\nemoji: 🐝\nsdk: static\npinned: false\n---\n`);
    }

    return buildPath;
}

// ── Push to HuggingFace ──
async function pushToHF(space, buildPath) {
    const token = process.env.HF_TOKEN;
    if (!token) {
        warn('HF_TOKEN not set — skipping push');
        return false;
    }

    const repoUrl = `https://huggingface.co/spaces/${space.org}/${space.repo}`;
    const authUrl = `https://user:${token}@huggingface.co/spaces/${space.org}/${space.repo}`;

    log(`Pushing to ${repoUrl}...`);

    // Ensure repo exists (create if needed)
    try {
        const checkRes = await fetch(`https://huggingface.co/api/spaces/${space.org}/${space.repo}`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (checkRes.status === 404) {
            log(`Creating space ${space.org}/${space.repo}...`);
            const createRes = await fetch('https://huggingface.co/api/repos/create', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'space', name: space.repo, organization: space.org, sdk: 'static', private: false }),
            });
            if (createRes.ok) {
                ok(`Created space ${space.org}/${space.repo}`);
            } else {
                const errText = await createRes.text();
                warn(`Could not create space: ${errText}`);
            }
        }
    } catch (e) {
        warn(`Repo check failed: ${e.message}`);
    }

    try {
        execSync('git init', { cwd: buildPath, stdio: 'pipe' });
        // Configure git-lfs for binary files (required by HF hub)
        try {
            execSync('git lfs install', { cwd: buildPath, stdio: 'pipe' });
            execSync('git lfs track "*.png" "*.jpg" "*.jpeg" "*.gif" "*.ico" "*.svg" "*.woff" "*.woff2" "*.ttf" "*.mp4" "*.webm" "*.webp"', { cwd: buildPath, stdio: 'pipe' });
        } catch (e) {
            // If git-lfs not available, try xet
            try {
                execSync('git xet install', { cwd: buildPath, stdio: 'pipe' });
            } catch {
                warn(`Neither git-lfs nor git-xet available — binary push may fail`);
            }
        }
        execSync('git add .', { cwd: buildPath, stdio: 'pipe' });
        execSync(`git commit -m "Deploy ${space.id} v${VERSION} — ${new Date().toISOString()}"`, {
            cwd: buildPath, stdio: 'pipe',
            env: { ...process.env, GIT_AUTHOR_NAME: 'HeadyDeploy', GIT_AUTHOR_EMAIL: 'deploy@headysystems.com', GIT_COMMITTER_NAME: 'HeadyDeploy', GIT_COMMITTER_EMAIL: 'deploy@headysystems.com' },
        });
        execSync('git branch -M main', { cwd: buildPath, stdio: 'pipe' });
        execSync(`git push ${authUrl} main --force`, { cwd: buildPath, stdio: 'pipe' });
        ok(`Pushed ${space.id} to ${repoUrl}`);
        return true;
    } catch (e) {
        warn(`Push failed for ${space.id}: ${e.message}`);
        return false;
    }
}

// ── Main ──
async function main() {
    log(`Heady HF Spaces Deploy — v${VERSION} ${dryRun ? '(DRY RUN)' : ''}`);
    log(`Build dir: ${BUILD_DIR}`);

    await ensureDir(BUILD_DIR);

    const targets = spaceFilter ? SPACES.filter(s => s.id === spaceFilter) : SPACES;

    if (!targets.length) {
        warn(`No space found matching: ${spaceFilter}`);
        process.exit(1);
    }

    const results = [];

    for (const space of targets) {
        try {
            const buildPath = await buildSpace(space);

            if (dryRun) {
                ok(`[DRY RUN] Built ${space.id} → ${buildPath}`);
                const files = await fsp.readdir(buildPath);
                log(`  Files: ${files.join(', ')}`);
                const html = await fsp.readFile(join(buildPath, 'index.html'), 'utf8');
                const hasConfig = html.includes('window.HEADY_CONFIG');
                const hasRuntime = html.includes('heady-runtime.js');
                log(`  Runtime injected: ${hasConfig && hasRuntime ? '✅' : '❌'}`);
                results.push({ space: space.id, status: 'built', files: files.length });
            } else {
                const pushed = await pushToHF(space, buildPath);
                results.push({ space: space.id, status: pushed ? 'deployed' : 'build-only' });
            }
        } catch (e) {
            warn(`Failed to process ${space.id}: ${e.message}`);
            results.push({ space: space.id, status: 'error', error: e.message });
        }
    }

    console.log('\n' + '─'.repeat(50));
    log('Deploy Summary:');
    for (const r of results) {
        const icon = r.status === 'deployed' ? '✅' : r.status === 'built' ? '📦' : '❌';
        log(`  ${icon} ${r.space}: ${r.status}${r.files ? ` (${r.files} files)` : ''}${r.error ? ` — ${r.error}` : ''}`);
    }

    if (!dryRun) {
        await fsp.rm(BUILD_DIR, { recursive: true, force: true });
        log('Build dir cleaned up.');
    }
}

main().catch(e => { console.error(e); process.exit(1); });
