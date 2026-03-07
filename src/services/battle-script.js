#!/usr/bin/env node
/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ heady battle — 10-Model Arena Dispatcher ═══
 *
 * Usage:
 *   npm run battle               # Start battle, create repos, dispatch all
 *   npm run battle -- --status   # Check battle status
 *   npm run battle -- --blueprint # Export blueprint JSON
 *   npm run battle -- --repos    # List repo manifest
 *
 * This script:
 *   1. Generates the comprehensive project blueprint
 *   2. Creates 9 private GitHub repos (one per contender)
 *   3. Seeds each repo with a README + context package optimized for that model
 *   4. Dispatches rebuild instructions to each model's API
 *   5. Monitors progress and collects results
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const arena = require('../src/services/battle-arena');

const args = process.argv.slice(2);
const ROOT = path.resolve(__dirname, '..');

// ── Helpers ────────────────────────────────────────────────────
function run(cmd, opts = {}) {
    try {
        return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
    } catch (err) {
        if (opts.allowFail) return err.stderr || err.message;
        console.error(`  ❌ ${cmd}\n     ${err.message}`);
        return null;
    }
}

// ── Commands ───────────────────────────────────────────────────

if (args.includes('--status')) {
    const status = arena.getStatus();
    console.log(JSON.stringify(status, null, 2));
    process.exit(0);
}

if (args.includes('--blueprint')) {
    const bp = arena.generateBlueprint();
    const outPath = path.join(ROOT, 'configs', 'battle-blueprint.json');
    fs.writeFileSync(outPath, JSON.stringify(bp, null, 2));
    console.log(`Blueprint exported to: ${outPath}`);
    console.log(`Modules: ${Object.keys(bp.coreModules).length}`);
    console.log(`Patterns: ${bp.patterns.length}`);
    console.log(`Dependencies: ${bp.dependencies.production.length}`);
    process.exit(0);
}

if (args.includes('--repos')) {
    const repos = arena.getRepoManifest();
    console.log('\n══ Battle Arena — Repo Manifest ══\n');
    repos.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.repoName}`);
        console.log(`     Model:    ${r.model}`);
        console.log(`     Provider: ${r.provider}`);
        console.log(`     Private:  ${r.isPrivate}`);
        console.log('');
    });
    console.log(`Total repos: ${repos.length}`);
    process.exit(0);
}

// ── Main Battle Dispatch ───────────────────────────────────────
async function main() {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ⚔️  HEADY BATTLE ARENA — 10-Model Full Project Rebuild');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    // Start battle session
    const state = arena.startBattle();
    console.log(`  Session: ${state.sessionId}`);
    console.log(`  Contenders: ${state.contenders.length}`);
    console.log('');

    // Export blueprint
    const bp = state.blueprint;
    const bpPath = path.join(ROOT, 'configs', 'battle-blueprint.json');
    fs.mkdirSync(path.dirname(bpPath), { recursive: true });
    fs.writeFileSync(bpPath, JSON.stringify(bp, null, 2));
    console.log(`  📋 Blueprint exported (${Object.keys(bp.coreModules).length} modules, ${bp.patterns.length} patterns)`);
    console.log('');

    // List contenders
    console.log('  ── Contenders ──────────────────────────────────────');
    const contenders = arena.CONTENDERS;
    contenders.forEach((c, i) => {
        const icon = c.status === 'JUDGE' ? '👨‍⚖️' : '🤖';
        console.log(`  ${icon} ${i + 1}. ${c.name.padEnd(16)} ${c.model.padEnd(30)} ${c.strength.slice(0, 50)}`);
    });
    console.log('');

    // Create repos via GitHub CLI (if available)
    const ghAvailable = run('gh --version', { allowFail: true });
    const useGH = ghAvailable && !ghAvailable.includes('not found');

    if (useGH) {
        console.log('  ── Creating GitHub Repos ────────────────────────────');
        const repos = arena.getRepoManifest();
        for (const repo of repos) {
            console.log(`  📦 Creating HeadyMe/${repo.repoName}...`);
            run(`gh repo create HeadyMe/${repo.repoName} --private --description "${repo.description}" 2>/dev/null`, { allowFail: true });

            // Seed repo with context-optimized README
            const ctx = arena.getContextForModel(contenders.find(c => c.repoName === repo.repoName)?.id);
            if (ctx) {
                const readmeContent = `# ${repo.repoName}\n\n` +
                    `> Heady™ rebuild by **${repo.contender}** (${repo.model})\n\n` +
                    `## Battle Arena Session\n\n` +
                    `This repo is part of the 10-Model Battle Arena — a competitive evaluation where each AI model rebuilds the Heady™ Latent OS from scratch.\n\n` +
                    `## Context\n\n\`\`\`json\n${JSON.stringify(bp.project, null, 2)}\n\`\`\`\n\n` +
                    `## Modules to Implement\n\n${Object.entries(bp.coreModules).map(([k, v]) => `- **${k}**: ${v}`).join('\n')}\n\n` +
                    `## Model-Specific Focus\n\n${ctx.content.split('\n').slice(-1)[0]}\n`;

                const tmpFile = `/tmp/battle-readme-${repo.repoName}.md`;
                fs.writeFileSync(tmpFile, readmeContent);
                // Push README via gh CLI
                run(`cd /tmp && git clone https://github.com/HeadyMe/${repo.repoName}.git battle-${repo.repoName} 2>/dev/null && ` +
                    `cp ${tmpFile} battle-${repo.repoName}/README.md && ` +
                    `cd battle-${repo.repoName} && git add . && git commit -m "🐝 Battle Arena: initial context for ${repo.contender}" && git push 2>/dev/null`, { allowFail: true });
            }
            arena.markDispatched(contenders.find(c => c.repoName === repo.repoName)?.id);
        }
        console.log('');
    } else {
        console.log('  ⚠️  GitHub CLI (gh) not available — repos need manual creation');
        console.log('     Install: https://cli.github.com/');
        console.log('     Or create repos manually from the manifest:');
        console.log(`     Run: npm run battle -- --repos`);
        console.log('');
    }

    // Export per-model context packages
    console.log('  ── Model Context Packages ──────────────────────────');
    const ctxDir = path.join(ROOT, 'configs', 'battle-contexts');
    fs.mkdirSync(ctxDir, { recursive: true });
    for (const c of contenders) {
        const ctx = arena.getContextForModel(c.id);
        if (ctx) {
            const ctxFile = path.join(ctxDir, `${c.id}-context.json`);
            fs.writeFileSync(ctxFile, JSON.stringify(ctx, null, 2));
            console.log(`  📄 ${c.name.padEnd(16)} → ${c.id}-context.json`);
        }
    }
    console.log('');

    // Summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ⚔️  BATTLE ARENA READY');
    console.log('');
    console.log('  Next steps:');
    console.log('     1. Create repos:  gh repo create HeadyMe/<repo-name> --private');
    console.log('     2. Dispatch each model with its context from configs/battle-contexts/');
    console.log('     3. For Jules:  Open GitHub Issues with the blueprint as the task');
    console.log('     4. For Codex:  Use OpenAI Codex API with the context package');
    console.log('     5. For Claude: Use HeadyJules think mode with full blueprint');
    console.log('     6. For GPT-5.4: Use HeadyCompute with latest model');
    console.log('     7. For Gemini: Use HeadyPythia with full context window');
    console.log('     8. For Groq:  Use HeadyFast for rapid iteration');
    console.log('     9. For Perplexity: Use HeadyResearch for best-practice sourcing');
    console.log('    10. For HF:    Use HuggingFace Inference API with open models');
    console.log('');
    console.log('  Monitor: npm run battle -- --status');
    console.log('  APIs:    GET /api/battle/status');
    console.log('           GET /api/battle/contenders');
    console.log('           GET /api/battle/blueprint');
    console.log('           GET /api/battle/context/:id');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
}

main().catch(err => {
    console.error('Battle dispatch failed:', err.message);
    process.exit(1);
});
