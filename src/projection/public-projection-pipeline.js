/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Public Projection Pipeline ═══
 *
 * The bridge between the Heady Latent OS and the public open-source world.
 *
 * Flow:
 *   1. Eradication Protocol (prune stale files/vectors)
 *   2. Domain Slicer (extract per-domain file sets)
 *   3. GitHub API Push (tree/blob/commit cycle to each -core repo)
 *
 * Usage:
 *   const pipeline = require('./src/projection/public-projection-pipeline');
 *   await pipeline.projectAll();              // Project all 9 domains
 *   await pipeline.projectAll({ dryRun: true }); // Preview without pushing
 *   await pipeline.projectDomain('headymcp.com'); // Project single domain
 */

const { Octokit } = require('@octokit/rest');
const logger = require('../utils/logger').child('projection-pipeline');
const { slice, sliceAll, REPO_MAP } = require('./domain-slicer');
const { executeEradicationProtocol } = require('../../scripts/eradication-protocol');

// ── GitHub Client ──────────────────────────────────────────────
function getOctokit() {
    const token = process.env.HEADY_GITHUB_PAT || process.env.GITHUB_TOKEN;
    if (!token) {
        throw new Error('No GitHub PAT found. Set HEADY_GITHUB_PAT or GITHUB_TOKEN.');
    }
    return new Octokit({ auth: token });
}

// ── Git Data API Push ──────────────────────────────────────────
// Uses the low-level Git Data API (tree/blob/commit) for atomic pushes.
// Same pattern as the user's Python example, implemented in Node.js.

async function pushToRepo(octokit, repoFullName, files, commitMessage, options = {}) {
    const [owner, repo] = repoFullName.split('/');
    const branch = options.branch || 'main';

    logger.info(`Pushing ${Object.keys(files).length} files to ${repoFullName}`);

    // 1. Get the latest commit on the target branch
    let latestCommitSha;
    let baseTreeSha;
    try {
        const { data: ref } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
        latestCommitSha = ref.object.sha;
        const { data: commit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
        baseTreeSha = commit.tree.sha;
    } catch (err) {
        // Branch might not exist or repo is empty
        logger.warn(`Could not get ref for ${branch}: ${err.message}`);
        throw err;
    }

    // 2. Create blobs for each file
    const treeItems = [];
    for (const [filePath, content] of Object.entries(files)) {
        const { data: blob } = await octokit.git.createBlob({
            owner, repo,
            content: Buffer.from(content).toString('base64'),
            encoding: 'base64',
        });
        treeItems.push({
            path: filePath,
            mode: '100644',
            type: 'blob',
            sha: blob.sha,
        });
    }

    // 3. Create a new tree
    const { data: newTree } = await octokit.git.createTree({
        owner, repo,
        tree: treeItems,
        base_tree: baseTreeSha,
    });

    // 4. Create a new commit
    const { data: newCommit } = await octokit.git.createCommit({
        owner, repo,
        message: commitMessage,
        tree: newTree.sha,
        parents: [latestCommitSha],
    });

    // 5. Update the branch reference
    await octokit.git.updateRef({
        owner, repo,
        ref: `heads/${branch}`,
        sha: newCommit.sha,
    });

    logger.info(`✓ ${repoFullName} updated — commit ${newCommit.sha.substring(0, 7)}`);

    return {
        repo: repoFullName,
        commitSha: newCommit.sha,
        filesCount: Object.keys(files).length,
        treeItems: treeItems.length,
    };
}

// ── Project a Single Domain ────────────────────────────────────

async function projectDomain(domain, options = {}) {
    const repo = REPO_MAP[domain];
    if (!repo) {
        throw new Error(`No repo mapped for domain: ${domain}`);
    }

    logger.info(`>>> PROJECTING ${domain} TO ${repo} <<<`);

    // Slice the domain files from the monorepo
    const files = slice(domain);
    const fileCount = Object.keys(files).length;

    if (options.dryRun) {
        logger.info(`[DRY RUN] Would push ${fileCount} files to ${repo}:`);
        for (const fp of Object.keys(files)) {
            logger.info(`  → ${fp} (${files[fp].length} bytes)`);
        }
        return {
            domain,
            repo,
            fileCount,
            files: Object.keys(files),
            dryRun: true,
        };
    }

    const octokit = getOctokit();
    const ts = new Date().toISOString();
    const commitMessage = `Autonomous Latent OS Projection: Update ${domain}\n\nProjected at ${ts} by the Heady Continuous Public Projection Pipeline.\nSource: HeadyMe/Heady-pre-production-9f2f0642`;

    const result = await pushToRepo(octokit, repo, files, commitMessage);
    return { domain, ...result, projectedAt: ts };
}

// ── Project All Domains ────────────────────────────────────────

async function projectAll(options = {}) {
    const ts = new Date().toISOString();
    logger.info('═══════════════════════════════════════════════════');
    logger.info('  CONTINUOUS PUBLIC PROJECTION PIPELINE');
    logger.info(`  ${options.dryRun ? '[DRY RUN]' : 'LIVE'} — ${ts}`);
    logger.info('═══════════════════════════════════════════════════');

    // Phase 1: Eradication Protocol
    if (!options.skipEradication) {
        logger.info('\n── Phase 1: Eradication Protocol ──');
        const eradicationResult = await executeEradicationProtocol();
        logger.info(`Eradication complete: ${JSON.stringify(eradicationResult.ts)}`);
    }

    // Phase 2: Domain Slicing & Projection
    logger.info('\n── Phase 2: Domain Slicing & Projection ──');
    const results = {
        domains: {},
        startedAt: ts,
        completedAt: null,
        totalFiles: 0,
        totalRepos: 0,
        errors: [],
    };

    const domains = Object.keys(REPO_MAP);
    for (const domain of domains) {
        try {
            const result = await projectDomain(domain, options);
            results.domains[domain] = result;
            results.totalFiles += result.fileCount || result.filesCount || 0;
            results.totalRepos++;
        } catch (err) {
            logger.error(`Failed to project ${domain}: ${err.message}`);
            results.domains[domain] = { domain, error: err.message };
            results.errors.push({ domain, error: err.message });
        }
    }

    results.completedAt = new Date().toISOString();
    const duration = new Date(results.completedAt) - new Date(results.startedAt);

    logger.info('\n═══════════════════════════════════════════════════');
    logger.info(`  PROJECTION COMPLETE — ${results.totalRepos}/${domains.length} domains`);
    logger.info(`  ${results.totalFiles} files projected in ${duration}ms`);
    if (results.errors.length > 0) {
        logger.warn(`  ${results.errors.length} errors encountered`);
    }
    logger.info('═══════════════════════════════════════════════════\n');

    return results;
}

// ── Express Routes ─────────────────────────────────────────────

function registerRoutes(app) {
    // Trigger projection for all domains
    app.post('/api/projection/run', async (req, res) => {
        const dryRun = req.body?.dryRun || req.query.dryRun === 'true';
        try {
            const result = await projectAll({ dryRun });
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // Trigger projection for a single domain
    app.post('/api/projection/run/:domain', async (req, res) => {
        const dryRun = req.body?.dryRun || req.query.dryRun === 'true';
        try {
            const result = await projectDomain(req.params.domain, { dryRun });
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // Get the repo matrix
    app.get('/api/projection/matrix', (req, res) => {
        const matrix = {};
        for (const [domain, repo] of Object.entries(REPO_MAP)) {
            const siteConfig = REPO_MAP[domain] ? require('../sites/site-registry.json').preconfigured[domain] : null;
            matrix[domain] = {
                repo,
                url: `https://github.com/${repo}`,
                name: siteConfig?.name || domain,
                tagline: siteConfig?.tagline || '',
            };
        }
        res.json({ ok: true, domains: Object.keys(REPO_MAP).length, matrix });
    });

    // Preview what would be projected for a domain
    app.get('/api/projection/preview/:domain', (req, res) => {
        try {
            const files = slice(req.params.domain);
            const preview = {};
            for (const [fp, content] of Object.entries(files)) {
                preview[fp] = {
                    size: content.length,
                    preview: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
                };
            }
            res.json({ ok: true, domain: req.params.domain, repo: REPO_MAP[req.params.domain], files: preview });
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });

    logger.info('Projection Pipeline routes registered at /api/projection/*');
}

module.exports = {
    projectDomain,
    projectAll,
    registerRoutes,
    REPO_MAP,
};
