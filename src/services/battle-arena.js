/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Battle Arena — 10-Model Full Project Rebuild ═══
 *
 * Dispatches the complete Heady project specification to 10 AI models,
 * each rebuilding the entire system from scratch in separate repos.
 * Monitors progress, compares results, and integrates improvements.
 *
 * Contenders:
 *   1. HeadyJules   (Claude Opus)         — Deep reasoning, architecture
 *   2. HeadyCompute (GPT-5.4)             — General intelligence, latest model
 *   3. HeadyPythia  (Gemini Pro)           — Large context, multimodal
 *   4. HeadyFast    (Groq)                 — Ultra-fast inference
 *   5. Jules        (Google Coding Agent)   — Autonomous coding agent
 *   6. Codex        (OpenAI Coding Agent)   — Code-specialized agent
 *   7. HeadyResearch (Perplexity Sonar)    — Research + real-time web
 *   8. HFModels     (HuggingFace)          — Open-source models
 *   9. HeadyCoder   (Heady's own engine)   — Multi-model code gen
 *  10. HeadyBuddy   (Synthesizer/Judge)    — Evaluates + integrates best parts
 */

'use strict';

const crypto = require('crypto');
const { getLogger } = require('./structured-logger');
const logger = getLogger('battle-arena');

// ── Contender Registry ─────────────────────────────────────────
const CONTENDERS = [
    {
        id: 'headyjules',
        name: 'HeadyJules',
        model: 'Claude Opus',
        provider: 'anthropic',
        strength: 'Deep reasoning, complex architecture, nuanced analysis',
        apiTool: 'heady_claude',
        apiParams: { action: 'think', thinkingBudget: 32768 },
        repoName: 'heady-rebuild-claude',
        status: 'READY',
    },
    {
        id: 'headycompute',
        name: 'HeadyCompute',
        model: 'GPT-5.4',
        provider: 'openai',
        strength: 'Latest flagship, general intelligence, function calling',
        apiTool: 'heady_openai',
        apiParams: { model: 'gpt-5.4' },
        repoName: 'heady-rebuild-gpt54',
        status: 'READY',
    },
    {
        id: 'headypythia',
        name: 'HeadyPythia',
        model: 'Gemini Pro',
        provider: 'google',
        strength: 'Massive context window, multimodal, code understanding',
        apiTool: 'heady_gemini',
        apiParams: { action: 'generate' },
        repoName: 'heady-rebuild-gemini',
        status: 'READY',
    },
    {
        id: 'headyfast',
        name: 'HeadyFast',
        model: 'Groq LPU',
        provider: 'groq',
        strength: 'Ultra-fast inference, rapid iteration, batch processing',
        apiTool: 'heady_groq',
        apiParams: { stream: false },
        repoName: 'heady-rebuild-groq',
        status: 'READY',
    },
    {
        id: 'jules',
        name: 'Jules',
        model: 'Google Coding Agent',
        provider: 'google',
        strength: 'Autonomous multi-file coding, understands full repos',
        apiTool: 'jules_agent',
        apiParams: {},
        repoName: 'heady-rebuild-jules',
        status: 'READY',
    },
    {
        id: 'codex',
        name: 'Codex',
        model: 'OpenAI Coding Agent',
        provider: 'openai',
        strength: 'Code-specialized, autonomous task execution',
        apiTool: 'codex_agent',
        apiParams: {},
        repoName: 'heady-rebuild-codex',
        status: 'READY',
    },
    {
        id: 'headyresearch',
        name: 'HeadyResearch',
        model: 'Perplexity Sonar Pro',
        provider: 'perplexity',
        strength: 'Real-time web research, citations, best practices sourcing',
        apiTool: 'heady_research',
        apiParams: {},
        repoName: 'heady-rebuild-perplexity',
        status: 'READY',
    },
    {
        id: 'hfmodels',
        name: 'HFModels',
        model: 'HuggingFace Open-Source',
        provider: 'huggingface',
        strength: 'Open-source transparency, community models, edge inference',
        apiTool: 'hf_inference',
        apiParams: {},
        repoName: 'heady-rebuild-huggingface',
        status: 'READY',
    },
    {
        id: 'headycoder',
        name: 'HeadyCoder',
        model: 'Heady Multi-Model Code Engine',
        provider: 'heady',
        strength: 'Multi-model code gen, refactoring, inline suggestions',
        apiTool: 'heady_coder',
        apiParams: {},
        repoName: 'heady-rebuild-headycoder',
        status: 'READY',
    },
    {
        id: 'headybuddy',
        name: 'HeadyBuddy',
        model: 'HeadyBuddy Synthesizer',
        provider: 'heady',
        strength: 'Persistent memory, evaluator, synthesizes best from all contenders',
        apiTool: 'heady_buddy',
        apiParams: { action: 'chat' },
        repoName: 'heady-rebuild-synthesized',
        status: 'JUDGE',
    },
];

// ── Battle State ───────────────────────────────────────────────
let _battleState = {
    sessionId: null,
    status: 'IDLE',          // IDLE | DISPATCHING | IN_PROGRESS | JUDGING | COMPLETE
    startedAt: null,
    blueprint: null,
    contenders: [],
    results: [],
    rankings: [],
    winner: null,
};

/**
 * Generate the comprehensive project blueprint that each model receives.
 * This is the "maximum intelligence" context package.
 */
function generateBlueprint() {
    const fs = require('fs');
    const path = require('path');
    const ROOT = path.resolve(__dirname, '..', '..');

    // Read key architecture files for context
    const readFile = (p) => {
        try { return fs.readFileSync(path.resolve(ROOT, p), 'utf8'); } catch { return null; }
    };

    const blueprint = {
        version: '3.0.1-OMEGA',
        generated: new Date().toISOString(),
        project: {
            name: 'Heady™ Latent Operating System',
            vision: 'A 46-year autonomous AI operating system that stores executable potential as AST nodes in pgvector, materializes code on-demand, and operates as a self-healing multi-swarm civilization.',
            architecture: 'Zero-Repo Liquid Architecture — code only exists during compilation. 18 swarms, 31+ bees, 742 aspirational tasks.',
            domains: ['headymcp.com', 'headyapi.com', 'headyio.com', 'headyme.com', 'headytrader.com', 'headymusic.com', 'headyfoundation.org', 'headysystems.com', 'myheady.ai'],
        },

        // ── Core Architecture Requirements ─────────────────────────
        coreModules: {
            'heady-manager': 'Express.js server — entry point, bootstraps all services, serves all 9 domains via domain routing',
            'vector-memory': 'pgvector-backed 3D vector memory with PCA-lite projection, 8-octant zone mapping, Fibonacci sharding',
            'domain-router': 'Maps hostnames to UI modules — 22 hostname entries, 12 unique UI modules',
            'site-renderer': 'Dynamic HTML generation with Sacred Geometry animations and chat widgets',
            'auto-projection': 'Pre-renders all 9 sites on boot, caches in RAM, pushes to Cloudflare KV edge',
            'vault-boot': 'Encrypted credential vault — AES-256-GCM, decrypts at boot, projects into process.env',
            'swarm-matrix': '18-swarm, 31-bee runtime registry with status tracking and activation APIs',
            'aspirational-registry': '742 unified aspirational tasks from 14 sources, mapped to swarms',
            'ast-schema': '4 pgvector tables (ast_nodes, ast_edges, ast_projections, ast_governance)',
            'hologram-bee': 'On-demand AST-to-edge compiler — replaces CI/CD entirely',
            'context-weaver-bee': 'Zero-file memory assembler — builds ephemeral LLM context from AST nodes',
            'projection-engine': 'Manages deployment targets: Cloud Run, Cloudflare Edge, Colab GPU, HuggingFace',
            'governance': 'Perfect Governance — cryptographic stamping, proof chains, immutable audit trail',
            'structured-logger': 'Pino-based JSON logging with OpenTelemetry correlation IDs',
            'health-registry': 'Service health monitoring with circuit breakers',
            'self-healing-mesh': 'Auto-recovery grid for service failures',
            'unified-enterprise-autonomy': 'Enterprise autonomy engine — auto-success pipeline',
            'continuous-embedder': 'Auto-embeds all project data into 3D vector memory',
        },

        // ── Bee System ─────────────────────────────────────────────
        beeSystem: {
            description: 'Bees are autonomous micro-services that perform specific tasks. Each bee has a class, role, status (ACTIVE/STANDBY/SLEEPER), and swarm assignment.',
            templateSystem: 'bees/bee-factory.js + bees/registry.js + bees/headybee-template-registry.js',
            totalBees: 31,
            categories: [
                'Infrastructure (VectorWeaverBee, PrunerBee, GovernanceGatekeeperBee, ChaosTesterBee)',
                'Engineering (ASTMutatorBee, UICompilerBee, DependencySniperBee, HologramBee, ContextWeaverBee)',
                'Finance (MarketStreamBee, BacktestBee)',
                'Creative (AbletonSysExBee, MelodicAnalysisBee)',
                'Observability (CostOptimizationBee, TelemetryAggregatorBee)',
                'Security (PenTestBee, ZeroDayPatchBee)',
                'Deep-Time (GlacierBee, TemporalRollbackBee)',
                'Federation (FederationHandshakeBee)',
                'Quantum (LatticeCryptographyBee)',
            ],
        },

        // ── Technology Stack ───────────────────────────────────────
        stack: {
            runtime: 'Node.js 20/22',
            framework: 'Express.js',
            database: 'Neon Postgres + pgvector (1536-dim embeddings)',
            cache: 'Upstash Redis + RAM (auto-projection)',
            edge: 'Cloudflare Workers + KV + R2',
            compute: 'Google Cloud Run (heady-manager service)',
            gpu: 'Google Colab Pro+ (ML training, batch inference)',
            cicd: 'GitHub Actions (5-phase: security → validate → Cloud Run → HF → Edge)',
            containerization: 'Docker multi-stage (node:20-slim)',
            ai: 'Multi-model: Claude, GPT-5.4, Gemini, Groq, Perplexity, HuggingFace',
            protocols: 'MCP (Model Context Protocol) for tool exposure',
        },

        // ── File Structure Requirements ────────────────────────────
        fileStructure: {
            'src/core/': 'Core modules (heady.js, audio-overview.js, auth-page-server.js)',
            'src/services/': 'Service layer (vault-boot, domain-router, projection-engine, etc.)',
            'src/bees/': 'Autonomous bee agents (one file per bee)',
            'src/mcp/': 'MCP bridge and tools (colab-mcp-bridge.js)',
            'src/shell/': 'HeadyWeb Universal Shell (Module Federation)',
            'src/utils/': 'Utilities (logger.js, redis-pool.js)',
            'src/bootstrap/': 'Service registration (service-routes.js)',
            'configs/': 'YAML/JSON configs (resources, autonomy, branding, governance)',
            'scripts/': 'CLI tools (vault-seed.js, deploy.js)',
            'docs/': 'Documentation and roadmaps',
        },

        // ── Key Design Patterns ────────────────────────────────────
        patterns: [
            'Zero-Repo Architecture — code stored as AST JSON in pgvector, materialized on-demand',
            'Liquid Architecture — every service is a projection that can be materialized anywhere',
            'RAM-First Operations — all ops in vector space, external stores are projections',
            'Perfect Governance — every mutation is cryptographically stamped and auditable',
            'Auto-Success Pipeline — all deployments self-verify and never fail the CI/CD',
            'Sacred Geometry — UI design system based on golden ratio, Fibonacci sequences',
            'Swarm Intelligence — 18 swarms collaborate autonomously via orchestration protocol',
            'Remote-Only Backups — no local storage, backups in Cloudflare R2 / GCS Coldline',
        ],

        // ── Dependencies ───────────────────────────────────────────
        dependencies: {
            production: [
                'express', '@anthropic-ai/sdk', 'openai', '@google-cloud/vertexai',
                'groq-sdk', 'pg', 'pgvector', 'ioredis', '@sentry/node',
                'pino', 'dotenv', 'cors', 'helmet', 'express-rate-limit',
                'node-cron', 'uuid', 'jsonwebtoken', 'bcryptjs',
                'marked', 'ws', '@modelcontextprotocol/sdk',
            ],
            dev: ['jest', 'eslint', 'nodemon', 'prettier'],
        },

        // ── Rebuild Instructions ───────────────────────────────────
        rebuildInstructions: `
You are rebuilding the Heady™ Latent OS from scratch.

CRITICAL REQUIREMENTS:
1. Each module must be its own file — NO monolithic files
2. Every bee gets its own file in src/bees/
3. Every service gets its own file in src/services/
4. Use the EXACT same API endpoints and route structure
5. Implement proper error handling with structured logging
6. Use pgvector for vector memory (1536-dim embeddings)
7. Implement the vault system (AES-256-GCM encrypted credentials)
8. Build the domain router to serve all 9 domains from one Express server
9. Implement the swarm matrix with all 18 swarms and 31 bees
10. Build the HologramBee (AST-to-edge compiler) and ContextWeaverBee (memory assembler)
11. Sacred Geometry CSS animations on all site renders
12. Health checks on every service with circuit breaker pattern
13. Dockerfile must be multi-stage with non-root user
14. GitHub Actions CI/CD with security scanning

OUTPUT FORMAT:
- Create a complete, runnable Node.js project
- Include package.json with all dependencies
- Include Dockerfile
- Include .github/workflows/deploy.yml
- Include README.md with architecture documentation
- Every file should be production-quality with JSDoc comments
`,
    };

    return blueprint;
}

/**
 * Start a new battle session — dispatch to all 10 contenders.
 */
function startBattle() {
    const sessionId = crypto.randomUUID();
    const blueprint = generateBlueprint();

    _battleState = {
        sessionId,
        status: 'DISPATCHING',
        startedAt: new Date().toISOString(),
        blueprint,
        contenders: CONTENDERS.map(c => ({
            ...c,
            dispatched: false,
            dispatchedAt: null,
            completed: false,
            completedAt: null,
            result: null,
            score: null,
        })),
        results: [],
        rankings: [],
        winner: null,
    };

    logger.info(`Battle Arena started: session ${sessionId}, ${CONTENDERS.length} contenders`);
    return _battleState;
}

/**
 * Get the context package optimized for a specific model.
 * Each model gets a context tailored to its strengths.
 */
function getContextForModel(contenderId) {
    const blueprint = _battleState.blueprint || generateBlueprint();
    const contender = CONTENDERS.find(c => c.id === contenderId);
    if (!contender) return null;

    const base = {
        role: 'system',
        content: `You are ${contender.name} (${contender.model}). Your strength: ${contender.strength}.\n\n` +
            `You have been tasked with rebuilding the Heady™ Latent Operating System from scratch.\n` +
            `This is a competitive evaluation — your output will be compared against ${CONTENDERS.length - 1} other AI models.\n\n` +
            `PROJECT SPECIFICATION:\n${JSON.stringify(blueprint, null, 2)}\n\n` +
            blueprint.rebuildInstructions,
    };

    // Add model-specific context optimizations
    const modelContext = { ...base };

    switch (contenderId) {
        case 'headyjules':
            modelContext.content += '\n\nFOCUS: Deep architecture reasoning. Think through every design decision step by step. Optimize for maintainability and 46-year longevity.';
            break;
        case 'headycompute':
            modelContext.content += '\n\nFOCUS: Leverage GPT-5.4 capabilities. Use function calling patterns. Optimize for modern Node.js best practices.';
            break;
        case 'headypythia':
            modelContext.content += '\n\nFOCUS: Use your massive context window to understand the entire system at once. Generate comprehensive, interconnected modules.';
            break;
        case 'headyfast':
            modelContext.content += '\n\nFOCUS: Speed. Generate the core modules first, then iterate. Optimize for rapid prototyping and iteration.';
            break;
        case 'jules':
            modelContext.content += '\n\nFOCUS: Autonomous multi-file coding. Create the complete file tree. Handle imports and cross-references correctly.';
            break;
        case 'codex':
            modelContext.content += '\n\nFOCUS: Code quality. Generate production-ready code with comprehensive error handling, types, and tests.';
            break;
        case 'headyresearch':
            modelContext.content += '\n\nFOCUS: Research current best practices for each technology. Cite sources. Use the latest patterns for Node.js, pgvector, Cloudflare Workers.';
            break;
        case 'hfmodels':
            modelContext.content += '\n\nFOCUS: Open-source approaches. Use well-tested community packages. Transparent, auditable code.';
            break;
        case 'headycoder':
            modelContext.content += '\n\nFOCUS: Multi-model code generation. Leverage HeadyCodex, HeadyCopilot, and HeadyRefactor for optimal code output.';
            break;
        case 'headybuddy':
            modelContext.content += '\n\nFOCUS: You are the JUDGE. After all other contenders submit, evaluate each rebuild on: architecture, code quality, completeness, security, performance, and innovation. Rank them and synthesize the best parts.';
            break;
    }

    return modelContext;
}

/**
 * Mark a contender as dispatched.
 */
function markDispatched(contenderId) {
    const c = _battleState.contenders.find(x => x.id === contenderId);
    if (c) {
        c.dispatched = true;
        c.dispatchedAt = new Date().toISOString();
        c.status = 'DISPATCHED';
    }
    // Check if all dispatched
    if (_battleState.contenders.every(x => x.dispatched || x.status === 'JUDGE')) {
        _battleState.status = 'IN_PROGRESS';
    }
}

/**
 * Record a contender's result.
 */
function recordResult(contenderId, result) {
    const c = _battleState.contenders.find(x => x.id === contenderId);
    if (c) {
        c.completed = true;
        c.completedAt = new Date().toISOString();
        c.result = result;
        c.status = 'COMPLETED';
    }
    _battleState.results.push({ contenderId, result, timestamp: new Date().toISOString() });

    // Check if all complete (excluding judge)
    const nonJudge = _battleState.contenders.filter(x => x.status !== 'JUDGE');
    if (nonJudge.every(x => x.completed)) {
        _battleState.status = 'JUDGING';
    }
}

/**
 * Get battle status.
 */
function getStatus() {
    return {
        sessionId: _battleState.sessionId,
        status: _battleState.status,
        startedAt: _battleState.startedAt,
        contenders: _battleState.contenders.map(c => ({
            id: c.id,
            name: c.name,
            model: c.model,
            status: c.status,
            dispatched: c.dispatched,
            completed: c.completed,
            score: c.score,
        })),
        resultsCount: _battleState.results.length,
        winner: _battleState.winner,
    };
}

/**
 * Get repo manifest — the repos that need to be created for each contender.
 */
function getRepoManifest() {
    return CONTENDERS.filter(c => c.status !== 'JUDGE').map(c => ({
        repoName: c.repoName,
        contender: c.name,
        model: c.model,
        provider: c.provider,
        description: `Heady™ rebuild by ${c.name} (${c.model}) — Battle Arena competitive evaluation`,
        isPrivate: true,
    }));
}

/**
 * Express routes.
 */
function battleArenaRoutes(app) {
    // Start a new battle
    app.post('/api/battle/start', (_req, res) => {
        const state = startBattle();
        res.json({ ok: true, sessionId: state.sessionId, contenders: state.contenders.length });
    });

    // Get battle status
    app.get('/api/battle/status', (_req, res) => {
        res.json(getStatus());
    });

    // Get blueprint (the full spec)
    app.get('/api/battle/blueprint', (_req, res) => {
        const bp = _battleState.blueprint || generateBlueprint();
        res.json(bp);
    });

    // Get context for a specific model
    app.get('/api/battle/context/:id', (req, res) => {
        const ctx = getContextForModel(req.params.id);
        if (!ctx) return res.status(404).json({ error: 'Contender not found' });
        res.json(ctx);
    });

    // Get repo manifest
    app.get('/api/battle/repos', (_req, res) => {
        res.json({ ok: true, repos: getRepoManifest() });
    });

    // Mark dispatched
    app.post('/api/battle/dispatch/:id', (req, res) => {
        markDispatched(req.params.id);
        res.json({ ok: true, contender: req.params.id, status: 'DISPATCHED' });
    });

    // Record result
    app.post('/api/battle/result/:id', (req, res) => {
        recordResult(req.params.id, req.body);
        res.json({ ok: true, contender: req.params.id, status: 'COMPLETED' });
    });

    // List all contenders
    app.get('/api/battle/contenders', (_req, res) => {
        res.json({ ok: true, count: CONTENDERS.length, contenders: CONTENDERS });
    });

    logger.info(`Battle Arena: ${CONTENDERS.length} contenders registered at /api/battle/*`);
}

module.exports = {
    CONTENDERS,
    generateBlueprint,
    startBattle,
    getContextForModel,
    markDispatched,
    recordResult,
    getStatus,
    getRepoManifest,
    battleArenaRoutes,
};
