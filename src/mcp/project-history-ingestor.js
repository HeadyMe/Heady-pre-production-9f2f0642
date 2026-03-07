/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 *
 * Project History Ingestor — Full Codebase Context → 3D Vector Space
 *
 * Embeds on startup:
 *   - All git commits (messages, authors, dates)
 *   - Project file structure with role annotations
 *   - Key architecture docs and README
 *   - Known patterns and component relationships
 *   - Branch history and development trajectory
 *
 * This ensures every action has instant access to full project context.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

class ProjectHistoryIngestor {
    constructor(learner) {
        this.learner = learner;
        this.stats = { commits: 0, files: 0, docs: 0, patterns: 0 };
    }

    /**
     * Ingest everything — called once on bridge startup.
     */
    async ingestAll() {
        const start = Date.now();
        this._ingestCommits();
        this._ingestFileStructure();
        this._ingestArchitectureDocs();
        this._ingestPatterns();
        this._ingestBranches();
        const duration = Date.now() - start;
        console.log(`  📚 Project history: ${this.stats.commits} commits, ${this.stats.files} files, ${this.stats.docs} docs, ${this.stats.patterns} patterns (${duration}ms)`);
        return this.stats;
    }

    /**
     * Embed all git commits as vectors.
     */
    _ingestCommits() {
        try {
            const log = execSync(
                'git log --format="%H|%an|%ad|%s" --date=short -n 257',
                { cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 5000 }
            );
            const commits = log.trim().split('\n').filter(Boolean);

            // Batch in groups of 10 for efficient embedding
            for (let i = 0; i < commits.length; i += 10) {
                const batch = commits.slice(i, i + 10);
                const batchText = batch.map(c => {
                    const [hash, author, date, ...msgParts] = c.split('|');
                    return `[${date}] ${msgParts.join('|')} (${hash.substring(0, 7)})`;
                }).join(' | ');

                this.learner.learn(batchText, 'pattern', {
                    subtype: 'git_commits',
                    batchIndex: Math.floor(i / 10),
                    commitRange: `${i + 1}-${Math.min(i + 10, commits.length)}`,
                });
                this.stats.commits += batch.length;
            }
        } catch (err) {
            console.error(`  ⚠ Git commit ingest failed: ${err.message}`);
        }
    }

    /**
     * Embed file structure with role annotations.
     */
    _ingestFileStructure() {
        const roleMap = {
            'src/mcp': 'MCP bridge, telemetry, learning, templates',
            'src/bees': 'HeadyBee factory, templates, swarm intelligence',
            'src/routes': 'API routes: battle, budget, hive-sdk, services',
            'src/services': 'Heady services: Notion, edge-AI integration',
            'src/telemetry': 'Provider usage tracking, metrics',
            'src': 'Core: brain, soul, providers, orchestrator, security, auth',
            'sites': 'Web UIs: admin, headyos, landing pages',
            'docs/legal': 'Trademark filings, patent applications',
            'docs/research': 'Deep research reports, architecture analysis',
            'scripts': 'Automation: knowledge ingestion, Google Takeout processing',
            'configs': 'Installable packages, Sacred Geometry SDK configs',
            'notebooks': 'Colab runtime notebooks',
            'infrastructure': 'Cloud deployment: Terraform, Docker, Cloudflare',
        };

        for (const [dir, role] of Object.entries(roleMap)) {
            const fullDir = path.join(PROJECT_ROOT, dir);
            if (!fs.existsSync(fullDir)) continue;

            try {
                const files = execSync(
                    `find ${fullDir} -maxdepth 2 -type f -name "*.js" -o -name "*.json" -o -name "*.md" | head -30`,
                    { encoding: 'utf8', timeout: 3000 }
                ).trim().split('\n').filter(Boolean);

                const fileNames = files.map(f => path.basename(f)).join(', ');
                this.learner.learn(
                    `Project directory ${dir}: ${role}. Files: ${fileNames}`,
                    'pattern',
                    { subtype: 'file_structure', directory: dir }
                );
                this.stats.files += files.length;
            } catch { /* non-fatal */ }
        }
    }

    /**
     * Embed key architecture docs.
     */
    _ingestArchitectureDocs() {
        const docPatterns = [
            'README.md',
            'docs/research/*.md',
            'docs/legal/trademark-*.md',
            'ARCHITECTURE.md',
            'docs/*.md',
        ];

        for (const pattern of docPatterns) {
            try {
                const files = execSync(
                    `find ${PROJECT_ROOT} -maxdepth 3 -path "${PROJECT_ROOT}/${pattern}" -type f 2>/dev/null | head -10`,
                    { encoding: 'utf8', timeout: 3000 }
                ).trim().split('\n').filter(Boolean);

                for (const file of files) {
                    try {
                        const content = fs.readFileSync(file, 'utf8');
                        // Take first 800 chars as the summary
                        const summary = content.substring(0, 800).replace(/\n/g, ' ');
                        this.learner.learn(
                            `Doc: ${path.relative(PROJECT_ROOT, file)} — ${summary}`,
                            'pattern',
                            { subtype: 'documentation', file: path.relative(PROJECT_ROOT, file) }
                        );
                        this.stats.docs++;
                    } catch { /* non-fatal */ }
                }
            } catch { /* non-fatal */ }
        }
    }

    /**
     * Embed known architectural patterns and relationships.
     */
    _ingestPatterns() {
        const patterns = [
            'Heady uses a trinity architecture: Brain (reasoning) + Soul (consciousness) + Manager (orchestration)',
            'AI node hierarchy: 20+ specialized services — HeadyBrain, HeadySoul, HeadyJules (Claude), HeadyPythia (Gemini), HeadyCompute (OpenAI/GPT), HeadyFast (Groq), HeadyResearch (Perplexity/Sonar), HeadyCoder, HeadyBuilder (Codex), HeadyCopilot, HeadyLens (vision), HeadyVinci (pattern), HeadyBattle (arena), HeadyBuddy (assistant), HeadyOps, HeadyMaid, HeadyMaintenance, HeadyOrchestrator, HeadyHub (HuggingFace)',
            'HCFP (Heady Continuous Feedback Pipeline): auto-success engine with φ-scaled optimization, random optimizer, idle learning, provider failover chains',
            'Sacred Geometry SDK: φ (1.618) golden ratio used throughout — timing, scaling, layout, optimization stages',
            'Liquid Runtime Architecture: dynamic tier allocation (trial → free → pro → enterprise → god), per-user resource scaling',
            'HeadyBee system: 82 templates, swarm intelligence, bee-factory.js spawns specialized workers for any task',
            'Multi-provider AI gateway: routes to Claude, GPT, Gemini, Groq, Perplexity, HuggingFace based on task type + budget + latency constraints',
            'MCP bridge: 43 tools across 4 transports (stdio, HTTP, SSE, WebSocket), continuous learning, telemetry, template auto-gen',
            'IP portfolio: 10+ provisional patents (USPTO), trademark serial 99680540 (HeadyConnection), 9 domains',
            'Cloudflare edge: AI Workers (embeddings, chat, classify), Vectorize, R2 storage, D1 database',
            'Deployment: Cloud Run (GCP), HuggingFace Spaces, Cloudflare Workers, GitHub Actions CI/CD',
        ];

        for (const pattern of patterns) {
            this.learner.learn(pattern, 'pattern', { subtype: 'architecture' });
            this.stats.patterns++;
        }
    }

    /**
     * Embed branch history.
     */
    _ingestBranches() {
        try {
            const branches = execSync(
                'git branch --format="%(refname:short)" | head -20',
                { cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 3000 }
            ).trim().split('\n').filter(Boolean);

            this.learner.learn(
                `Active branches: ${branches.join(', ')}. Current: main. Total branches: ${branches.length}+`,
                'pattern',
                { subtype: 'branches', count: branches.length }
            );
        } catch { /* non-fatal */ }
    }
}

module.exports = { ProjectHistoryIngestor };
