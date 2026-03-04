#!/usr/bin/env node
/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Heady MCP Multi-Transport Bridge ═══
 *
 * Exposes all 30+ Heady MCP tools via EVERY available transport:
 *   1. stdio  — direct pipe (fastest, local IDE)
 *   2. SSE    — Server-Sent Events (MCP native remote, Antigravity compatible)
 *   3. HTTP   — REST/JSON-RPC (universal, any client)
 *   4. WebSocket — persistent full-duplex (lowest latency for persistent connections)
 *
 * Also wires the GPUVectorStore for 3D vector space operations in Colab.
 *
 * Usage:
 *   HEADY_MCP_TRANSPORT=stdio   node colab-mcp-bridge.js   # local
 *   HEADY_MCP_TRANSPORT=http    node colab-mcp-bridge.js   # all HTTP transports
 *   HEADY_MCP_TRANSPORT=all     node colab-mcp-bridge.js   # everything
 */

const http = require('http');
const crypto = require('crypto');
const path = require('path');

// ── Configuration ────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || process.env.HEADY_MCP_PORT || '8420');
const TRANSPORT = process.env.HEADY_MCP_TRANSPORT || 'all';
const HEADY_DIR = process.env.HEADY_DIR || path.join(__dirname, '..', '..');

// ── GPUVectorStore — 3D Vector Space ─────────────────────────────
const { GPUVectorStore, GPU_CONFIG, setupNgrokTunnel } = require('../colab-runtime');
const vectorStore = new GPUVectorStore(384);

// ── Template Auto-Generation Directive ───────────────────────────
// Every task checks for existing templates and generates new HeadyBees/HeadySwarms
const { withTemplateAutoGen, getTemplateStats } = require('./template-auto-gen');

// ── Continuous Learning — Every interaction → 3D vector space ────
const { ContinuousLearner } = require('./continuous-learner');
const learner = new ContinuousLearner(vectorStore);

// ── Comprehensive Telemetry — Full Audit Trail + Optimization ──
const { HeadyTelemetry } = require('./heady-telemetry');
const telemetry = new HeadyTelemetry(vectorStore, learner);

// Seed with known directives, preferences, and identity
(function seedKnowledge() {
    // Identity
    learner.learnIdentity('Owner: HeadyConnection Inc. — Trademark serial 99680540, filed March 3 2026');
    learner.learnIdentity('Domains: headyme.com, headysystems.com, headyconnection.org, headybuddy.org, headymcp.com, headyio.com, headybot.com, headyos.com, headyapi.com');
    learner.learnIdentity('Platforms: GitHub HeadyMe org, HuggingFace HeadyMe/HeadySystems/HeadyConnection, Google Cloud, Cloudflare');
    learner.learnIdentity('Perplexity Enterprise Pro seat active');

    // Standing directives
    learner.learnDirective('Always use deep-research mode when initiating tasks');
    learner.learnDirective('Never keep items pending — do all autonomously ASAP');
    learner.learnDirective('Build template HeadyBees and HeadySwarms always and whenever doing tasks');
    learner.learnDirective('Ask if there are useful templates and data that can be made available for injection');
    learner.learnDirective('Speed is paramount when dealing with Heady — be quick');
    learner.learnDirective('Gather ALL possible data — user, project, environment — log for comprehensive audit trail and optimization');

    // Preferences
    learner.learnPreference('Multi-transport MCP: stdio + SSE + HTTP + WebSocket simultaneously');
    learner.learnPreference('Full autonomy — no waiting for approval, execute everything');
    learner.learnPreference('3D GPU vector space for all memory operations');
    learner.learnPreference('Comprehensive data gathering during and between interactions for optimization');

    console.log(`  🧠 Seeded ${learner.interactionCount} knowledge vectors`);
    console.log(`  📊 Telemetry: audit trail + optimization engine active`);
})();

// ── Project History Ingestion — Full codebase context on boot ────
const { ProjectHistoryIngestor } = require('./project-history-ingestor');
const historyIngestor = new ProjectHistoryIngestor(learner);
historyIngestor.ingestAll().catch(e => console.error(`  ⚠ History ingest error: ${e.message}`));

// ── Tool Registry ────────────────────────────────────────────────
// Full 33-tool registry: 30 from heady-mcp-server.js + 3 vector space tools.
// Embedded inline because heady-mcp-server.js is ESM with no exports
// and its main() auto-connects stdio, which kills this process.

let HEADY_TOOLS = [];

function loadMCPTools() {
    HEADY_TOOLS = [
        { name: 'heady_deep_scan', description: 'Dynamic Edge Node: massive single-pass project map + 3D vector memory pull.', inputSchema: { type: 'object', properties: { directory: { type: 'string', description: 'Target workspace directory' } } } },
        { name: 'heady_auto_flow', description: 'Combined auto-flow: HeadyBattle + HeadyCoder + HeadyAnalyze + HeadyRisks + HeadyPatterns via HCFP.', inputSchema: { type: 'object', properties: { task: { type: 'string' }, code: { type: 'string' }, context: { type: 'string' } }, required: ['task'] } },
        { name: 'heady_chat', description: 'Chat with Heady Brain. Routes 100% through Heady AI.', inputSchema: { type: 'object', properties: { message: { type: 'string' }, system: { type: 'string' }, model: { type: 'string', default: 'heady-brain' }, temperature: { type: 'number', default: 0.7 }, max_tokens: { type: 'integer', default: 4096 } }, required: ['message'] } },
        { name: 'heady_complete', description: 'Code/text completion via Heady Brain.', inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, language: { type: 'string' }, max_tokens: { type: 'integer', default: 2048 } }, required: ['prompt'] } },
        { name: 'heady_analyze', description: 'Analyze code/text via Heady Brain intelligence.', inputSchema: { type: 'object', properties: { content: { type: 'string' }, type: { type: 'string', enum: ['code', 'text', 'security', 'performance', 'architecture', 'general'] }, language: { type: 'string' }, focus: { type: 'string' } }, required: ['content'] } },
        { name: 'heady_embed', description: 'Generate vector embeddings via Heady embedding service.', inputSchema: { type: 'object', properties: { text: { type: 'string' }, model: { type: 'string', default: 'nomic-embed-text' } }, required: ['text'] } },
        { name: 'heady_health', description: 'Check health/status of all Heady services.', inputSchema: { type: 'object', properties: { service: { type: 'string', enum: ['all', 'brain', 'manager', 'hcfp', 'mcp'], default: 'all' } } } },
        { name: 'heady_deploy', description: 'Trigger deployment/service action via Heady Manager.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['deploy', 'restart', 'status', 'logs', 'scale'] }, service: { type: 'string' }, config: { type: 'object' } }, required: ['action'] } },
        { name: 'heady_search', description: 'Search Heady knowledge base and service catalog.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, scope: { type: 'string', enum: ['all', 'registry', 'docs', 'services', 'knowledge'], default: 'all' }, limit: { type: 'integer', default: 10 } }, required: ['query'] } },
        { name: 'heady_memory', description: 'Search HeadyMemory (3D vector space) for persistent user facts.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer', default: 5 }, minScore: { type: 'number', default: 0.6 } }, required: ['query'] } },
        { name: 'heady_refactor', description: 'Code refactoring suggestions from Heady Brain.', inputSchema: { type: 'object', properties: { code: { type: 'string' }, language: { type: 'string' }, goals: { type: 'array', items: { type: 'string' } } }, required: ['code'] } },
        { name: 'heady_jules_task', description: 'Dispatch async background coding task to HeadyJules agent.', inputSchema: { type: 'object', properties: { task: { type: 'string' }, repository: { type: 'string' }, priority: { type: 'string', enum: ['low', 'normal', 'high', 'critical'], default: 'normal' }, autoCommit: { type: 'boolean', default: false } }, required: ['task', 'repository'] } },
        { name: 'heady_perplexity_research', description: 'Deep research/web search via HeadyResearch (Sonar Pro).', inputSchema: { type: 'object', properties: { query: { type: 'string' }, mode: { type: 'string', enum: ['quick', 'deep', 'academic', 'news'], default: 'deep' }, timeframe: { type: 'string', default: 'all' }, maxSources: { type: 'integer', default: 10 } }, required: ['query'] } },
        { name: 'heady_huggingface_model', description: 'Search/interact with HeadyHub models via HuggingFace.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['search', 'info', 'inference'] }, modelId: { type: 'string' }, query: { type: 'string' } }, required: ['action'] } },
        { name: 'heady_soul', description: 'HeadySoul — intelligence, consciousness, and learning layer.', inputSchema: { type: 'object', properties: { content: { type: 'string' }, action: { type: 'string', enum: ['analyze', 'optimize', 'learn'], default: 'analyze' } }, required: ['content'] } },
        { name: 'heady_hcfp_status', description: 'HCFP auto-success engine status and metrics.', inputSchema: { type: 'object', properties: { detail: { type: 'string', enum: ['status', 'metrics', 'health'], default: 'status' } } } },
        { name: 'heady_orchestrator', description: 'HeadyOrchestrator — trinity communication and wavelength alignment.', inputSchema: { type: 'object', properties: { message: { type: 'string' }, action: { type: 'string', enum: ['send', 'status', 'align'], default: 'send' }, target: { type: 'string' } }, required: ['message'] } },
        { name: 'heady_battle', description: 'HeadyBattle Arena — AI node competition, evaluation, leaderboard.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['session', 'evaluate', 'arena', 'leaderboard', 'compare'] }, task: { type: 'string' }, code: { type: 'string' }, nodes: { type: 'array', items: { type: 'string' } } }, required: ['action'] } },
        { name: 'heady_patterns', description: 'Design pattern detection and deep code analysis.', inputSchema: { type: 'object', properties: { code: { type: 'string' }, action: { type: 'string', enum: ['analyze', 'library', 'suggest'], default: 'analyze' }, language: { type: 'string' } }, required: ['code'] } },
        { name: 'heady_risks', description: 'Risk assessment, vulnerability scanning, mitigation plans.', inputSchema: { type: 'object', properties: { content: { type: 'string' }, action: { type: 'string', enum: ['assess', 'mitigate', 'scan'], default: 'assess' }, scope: { type: 'string', default: 'all' } }, required: ['content'] } },
        { name: 'heady_coder', description: 'Code generation and multi-assistant workflows via HeadyCoder.', inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, action: { type: 'string', enum: ['generate', 'orchestrate', 'scaffold'], default: 'generate' }, language: { type: 'string' }, framework: { type: 'string' } }, required: ['prompt'] } },
        { name: 'heady_claude', description: 'Advanced reasoning via HeadyJules (Opus 4.6 Thinking 1M).', inputSchema: { type: 'object', properties: { message: { type: 'string' }, action: { type: 'string', enum: ['chat', 'think', 'analyze'], default: 'chat' }, system: { type: 'string' }, thinkingBudget: { type: 'integer', default: 32768 } }, required: ['message'] } },
        { name: 'heady_openai', description: 'HeadyCompute (GPT integration with function calling).', inputSchema: { type: 'object', properties: { message: { type: 'string' }, action: { type: 'string', enum: ['chat', 'complete'], default: 'chat' }, model: { type: 'string', default: 'gpt-4o' } }, required: ['message'] } },
        { name: 'heady_gemini', description: 'Multimodal AI via HeadyPythia.', inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, action: { type: 'string', enum: ['generate', 'analyze'], default: 'generate' } }, required: ['prompt'] } },
        { name: 'heady_groq', description: 'Ultra-fast inference via HeadyFast.', inputSchema: { type: 'object', properties: { message: { type: 'string' }, action: { type: 'string', enum: ['chat', 'complete'], default: 'chat' } }, required: ['message'] } },
        { name: 'heady_codex', description: 'Code generation/transformation via HeadyBuilder (GPT-Codex).', inputSchema: { type: 'object', properties: { code: { type: 'string' }, action: { type: 'string', enum: ['generate', 'transform', 'document'], default: 'generate' }, language: { type: 'string' } }, required: ['code'] } },
        { name: 'heady_copilot', description: 'Inline code suggestions via HeadyCopilot.', inputSchema: { type: 'object', properties: { code: { type: 'string' }, action: { type: 'string', enum: ['suggest', 'complete'], default: 'suggest' }, language: { type: 'string' } }, required: ['code'] } },
        { name: 'heady_ops', description: 'DevOps automation via HeadyOps.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['deploy', 'infrastructure', 'monitor', 'scale'] }, service: { type: 'string' }, config: { type: 'object' } }, required: ['action'] } },
        { name: 'heady_maid', description: 'System cleanup and scheduling via HeadyMaid.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['clean', 'schedule', 'status'], default: 'status' }, target: { type: 'string' } }, required: ['action'] } },
        { name: 'heady_maintenance', description: 'Health monitoring, backups, updates via HeadyMaintenance.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['status', 'backup', 'update', 'restore'], default: 'status' }, service: { type: 'string' } }, required: ['action'] } },
        { name: 'heady_lens', description: 'Visual analysis, image processing via HeadyLens.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['analyze', 'process', 'detect'], default: 'analyze' }, image_url: { type: 'string' }, prompt: { type: 'string' } }, required: ['action'] } },
        { name: 'heady_vinci', description: 'Pattern recognition and prediction via HeadyVinci.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['learn', 'predict', 'recognize'], default: 'predict' }, data: { type: 'string' } }, required: ['data'] } },
        { name: 'heady_buddy', description: 'HeadyBuddy — multi-provider personal AI assistant.', inputSchema: { type: 'object', properties: { message: { type: 'string' }, action: { type: 'string', enum: ['chat', 'memory', 'skills', 'tasks', 'providers'], default: 'chat' }, provider: { type: 'string', default: 'auto' } }, required: ['message'] } },
        { name: 'heady_notion', description: 'Sync Heady Knowledge Vault to Notion (11 pages).', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['sync', 'status', 'health'], default: 'sync' } } } },
        { name: 'heady_edge_ai', description: 'Cloudflare edge AI — embeddings, chat, classification, vector search.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['embed', 'chat', 'classify', 'vectorize-insert', 'vectorize-query', 'queue'] }, text: { type: 'string' }, message: { type: 'string' }, model: { type: 'string' }, topK: { type: 'number' } }, required: ['action'] } },
        // ── 3D Vector Space tools (bridge-only) ──
        { name: 'heady_vector_store', description: 'Store a vector embedding with metadata in the 3D GPU vector space.', inputSchema: { type: 'object', properties: { embedding: { type: 'array', items: { type: 'number' }, description: '384-dim float array' }, metadata: { type: 'object', description: 'Metadata to attach' } }, required: ['embedding'] } },
        { name: 'heady_vector_search', description: 'Search the 3D GPU vector space for semantically similar vectors.', inputSchema: { type: 'object', properties: { embedding: { type: 'array', items: { type: 'number' }, description: '384-dim query vector' }, topK: { type: 'integer', default: 5 } }, required: ['embedding'] } },
        { name: 'heady_vector_stats', description: 'Get 3D vector space statistics (count, memory, GPU status).', inputSchema: { type: 'object', properties: {} } },
        { name: 'heady_template_stats', description: 'Get template auto-generation stats (cached templates, active bees, swarm history).', inputSchema: { type: 'object', properties: {} } },
        { name: 'heady_learn', description: 'Store a learning (interaction, directive, preference, decision, identity) in 3D vector memory.', inputSchema: { type: 'object', properties: { content: { type: 'string', description: 'What to learn' }, category: { type: 'string', enum: ['directive', 'preference', 'interaction', 'decision', 'identity', 'pattern'], default: 'interaction' }, metadata: { type: 'object' } }, required: ['content'] } },
        { name: 'heady_recall', description: 'Search 3D vector memory for relevant past interactions and learnings.', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'What to recall' }, topK: { type: 'integer', default: 5 } }, required: ['query'] } },
        { name: 'heady_memory_stats', description: 'Get continuous learning stats (interactions, directives, categories, memory usage).', inputSchema: { type: 'object', properties: {} } },
        { name: 'heady_telemetry', description: 'Get comprehensive telemetry stats (audit trail, tool call analytics, optimizations, environment).', inputSchema: { type: 'object', properties: {} } },
    ];
    console.log(`  📋 ${HEADY_TOOLS.length} MCP tools loaded (35 Heady + 8 bridge)`);
}

// ── Tool Handler ─────────────────────────────────────────────────
async function callTool(name, args) {
    // Vector space tools (handled locally)
    switch (name) {
        case 'heady_vector_store': {
            const result = vectorStore.store(args.embedding, args.metadata || {});
            return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        }
        case 'heady_vector_search': {
            const results = vectorStore.search(args.embedding, args.topK || 5);
            return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
        }
        case 'heady_vector_stats': {
            return { content: [{ type: 'text', text: JSON.stringify(vectorStore.getStats(), null, 2) }] };
        }
        case 'heady_template_stats': {
            return { content: [{ type: 'text', text: JSON.stringify(getTemplateStats(), null, 2) }] };
        }
        case 'heady_learn': {
            const result = learner.learn(args.content, args.category || 'interaction', args.metadata || {});
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'heady_recall': {
            const results = learner.recall(args.query, args.topK || 5);
            return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
        }
        case 'heady_memory_stats': {
            return { content: [{ type: 'text', text: JSON.stringify(learner.getStats(), null, 2) }] };
        }
        case 'heady_telemetry': {
            return { content: [{ type: 'text', text: JSON.stringify(telemetry.getStats(), null, 2) }] };
        }
        case 'heady_perplexity_research': {
            // Direct Perplexity Sonar API call — no proxy needed
            const PPLX_KEY = process.env.PERPLEXITY_API_KEY;
            if (!PPLX_KEY) {
                return { content: [{ type: 'text', text: 'PERPLEXITY_API_KEY not set' }], isError: true };
            }
            const modeMap = { quick: 'sonar', deep: 'sonar-deep-research', academic: 'sonar-deep-research', news: 'sonar' };
            const model = modeMap[args.mode || 'deep'] || 'sonar-deep-research';
            try {
                const res = await fetch('https://api.perplexity.ai/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${PPLX_KEY}` },
                    body: JSON.stringify({
                        model,
                        messages: [
                            { role: 'system', content: 'You are a deep research specialist. Provide thorough analysis with citations and evidence.' },
                            { role: 'user', content: args.query },
                        ],
                        max_tokens: model === 'sonar-deep-research' ? 16384 : 4096,
                        temperature: 0.3,
                    }),
                    signal: AbortSignal.timeout(60000),
                });
                const data = await res.json();
                return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
            } catch (err) {
                return { content: [{ type: 'text', text: `Perplexity Error: ${err.message}` }], isError: true };
            }
        }
    }

    // Route to Heady Manager via HTTP
    const HEADY_MANAGER_URL = process.env.HEADY_MANAGER_URL || 'https://manager.headysystems.com';
    const HEADY_BRAIN_URL = process.env.HEADY_BRAIN_URL || HEADY_MANAGER_URL;
    const HEADY_API_KEY = process.env.HEADY_API_KEY || '';

    const headers = {
        'Content-Type': 'application/json',
        ...(HEADY_API_KEY ? { 'Authorization': `Bearer ${HEADY_API_KEY}` } : {}),
        'X-Heady-Source': 'heady-mcp-bridge',
    };

    // Route map: tool name → API path
    const routes = {
        heady_chat: '/api/brain/chat',
        heady_complete: '/api/brain/generate',
        heady_analyze: '/api/brain/analyze',
        heady_embed: '/api/brain/embed',
        heady_health: '/api/health',
        heady_deploy: '/api/deploy',
        heady_search: '/api/brain/search',
        heady_memory: '/api/brain/memory',
        heady_deep_scan: '/api/edge/deep-scan',
        heady_auto_flow: '/api/hcfp/auto-flow',
        heady_refactor: '/api/brain/analyze',
        heady_jules_task: '/api/jules/task',
        heady_perplexity_research: '/api/perplexity/research',
        heady_huggingface_model: '/api/headyhub/model',
        heady_soul: '/api/soul/analyze',
        heady_hcfp_status: '/api/hcfp/status',
        heady_orchestrator: '/api/orchestrator/send',
        heady_battle: '/api/battle/session',
        heady_patterns: '/api/patterns/analyze',
        heady_risks: '/api/risks/assess',
        heady_coder: '/api/coder/generate',
        heady_claude: '/api/headyjules/chat',
        heady_openai: '/api/headycompute/chat',
        heady_gemini: '/api/headypythia/generate',
        heady_groq: '/api/groq/chat',
        heady_codex: '/api/codex/generate',
        heady_copilot: '/api/copilot/suggest',
        heady_ops: '/api/ops/deploy',
        heady_maid: '/api/maid/clean',
        heady_maintenance: '/api/maintenance/status',
        heady_lens: '/api/lens/analyze',
        heady_vinci: '/api/vinci/predict',
        heady_buddy: '/api/buddy/chat',
        heady_notion: '/api/notion/sync',
        heady_edge_ai: '/api/edge/chat',
    };

    const apiPath = routes[name];
    if (!apiPath) {
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }

    const base = apiPath.startsWith('/api/brain') ? HEADY_BRAIN_URL : HEADY_MANAGER_URL;
    const isGet = ['heady_health', 'heady_hcfp_status', 'heady_maintenance'].includes(name);

    try {
        const res = await fetch(`${base}${apiPath}`, {
            method: isGet ? 'GET' : 'POST',
            headers,
            ...(isGet ? {} : { body: JSON.stringify({ ...args, source: 'heady-mcp-bridge' }) }),
            signal: AbortSignal.timeout(30000),
        });
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
        return { content: [{ type: 'text', text: `Heady API Error: ${err.message}` }], isError: true };
    }
}

// ══════════════════════════════════════════════════════════════════
// TRANSPORT 1: stdio (MCP native — fastest for local IDE)
// ══════════════════════════════════════════════════════════════════
function startStdioTransport() {
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (chunk) => {
        buffer += chunk;
        // JSON-RPC messages are newline-delimited
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line in buffer
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const msg = JSON.parse(line);
                const response = await handleJsonRpc(msg);
                if (response) {
                    process.stdout.write(JSON.stringify(response) + '\n');
                }
            } catch (e) {
                process.stderr.write(`stdio parse error: ${e.message}\n`);
            }
        }
    });
    process.stderr.write('[Heady MCP] stdio transport active\n');
}

// ══════════════════════════════════════════════════════════════════
// TRANSPORT 2: SSE (MCP native remote — Antigravity compatible)
// ══════════════════════════════════════════════════════════════════
const sseClients = new Map();

function handleSSE(req, res) {
    const clientId = crypto.randomUUID();
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    });

    // Send endpoint info
    res.write(`event: endpoint\ndata: /mcp/message?clientId=${clientId}\n\n`);

    sseClients.set(clientId, res);
    req.on('close', () => sseClients.delete(clientId));
}

async function handleSSEMessage(req, res) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const clientId = url.searchParams.get('clientId');
    const sseRes = sseClients.get(clientId);

    const body = await parseBody(req);
    const response = await handleJsonRpc(body);

    // Send response via SSE channel
    if (sseRes && response) {
        sseRes.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
    }

    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
}

// ══════════════════════════════════════════════════════════════════
// TRANSPORT 3: HTTP REST/JSON-RPC (universal)
// ══════════════════════════════════════════════════════════════════
// Endpoints:
//   POST /mcp/rpc           — JSON-RPC 2.0
//   GET  /mcp/tools         — list tools
//   POST /mcp/tools/call    — call a tool
//   GET  /health            — health check
//   POST /vector/store      — store vector
//   POST /vector/search     — search vectors
//   GET  /vector/stats      — vector stats

// ══════════════════════════════════════════════════════════════════
// TRANSPORT 4: WebSocket (persistent full-duplex)
// ══════════════════════════════════════════════════════════════════
const wsClients = new Set();

function handleWebSocketUpgrade(req, socket, head) {
    // Minimal WebSocket handshake (RFC 6455)
    const key = req.headers['sec-websocket-key'];
    const accept = crypto.createHash('sha1')
        .update(key + '258EAFA5-E914-47DA-95CA-5AB5DC11E860')
        .digest('base64');

    socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );

    wsClients.add(socket);
    let msgBuffer = Buffer.alloc(0);

    socket.on('data', async (data) => {
        // Decode WebSocket frame
        const decoded = decodeWSFrame(data);
        if (!decoded) return;

        try {
            const msg = JSON.parse(decoded);
            const response = await handleJsonRpc(msg);
            if (response) {
                const frame = encodeWSFrame(JSON.stringify(response));
                socket.write(frame);
            }
        } catch (e) {
            const errFrame = encodeWSFrame(JSON.stringify({
                jsonrpc: '2.0', error: { code: -32700, message: e.message }, id: null
            }));
            socket.write(errFrame);
        }
    });

    socket.on('close', () => wsClients.delete(socket));
    socket.on('error', () => wsClients.delete(socket));
}

// WebSocket frame encode/decode (minimal, text frames only)
function decodeWSFrame(buf) {
    if (buf.length < 2) return null;
    const secondByte = buf[1];
    const masked = (secondByte & 0x80) !== 0;
    let payloadLen = secondByte & 0x7f;
    let offset = 2;

    if (payloadLen === 126) {
        payloadLen = buf.readUInt16BE(2);
        offset = 4;
    } else if (payloadLen === 127) {
        payloadLen = Number(buf.readBigUInt64BE(2));
        offset = 10;
    }

    let maskKey;
    if (masked) {
        maskKey = buf.slice(offset, offset + 4);
        offset += 4;
    }

    const payload = buf.slice(offset, offset + payloadLen);
    if (masked) {
        for (let i = 0; i < payload.length; i++) {
            payload[i] ^= maskKey[i % 4];
        }
    }

    return payload.toString('utf8');
}

function encodeWSFrame(text) {
    const payload = Buffer.from(text, 'utf8');
    let header;
    if (payload.length < 126) {
        header = Buffer.alloc(2);
        header[0] = 0x81; // fin + text
        header[1] = payload.length;
    } else if (payload.length < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 126;
        header.writeUInt16BE(payload.length, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x81;
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(payload.length), 2);
    }
    return Buffer.concat([header, payload]);
}

// ══════════════════════════════════════════════════════════════════
// JSON-RPC 2.0 Handler (shared by all transports)
// ══════════════════════════════════════════════════════════════════
async function handleJsonRpc(msg) {
    if (!msg || !msg.method) return null;

    switch (msg.method) {
        case 'initialize':
            return {
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                    protocolVersion: '2024-11-05',
                    capabilities: { tools: {}, resources: {}, prompts: {} },
                    serverInfo: { name: 'heady-mcp', version: '2.0.0' },
                },
            };

        case 'tools/list':
            return {
                jsonrpc: '2.0',
                id: msg.id,
                result: { tools: HEADY_TOOLS },
            };

        case 'tools/call': {
            const { name, arguments: args } = msg.params;
            const result = await callTool(name, args || {});
            return {
                jsonrpc: '2.0',
                id: msg.id,
                result,
            };
        }

        case 'resources/list':
            return {
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                    resources: [
                        { uri: 'heady://vector/stats', name: '3D Vector Space Stats', mimeType: 'application/json' },
                        { uri: 'heady://services/catalog', name: 'Heady Service Catalog', mimeType: 'application/json' },
                    ],
                },
            };

        case 'resources/read': {
            const { uri } = msg.params;
            let text;
            if (uri === 'heady://vector/stats') {
                text = JSON.stringify(vectorStore.getStats(), null, 2);
            } else {
                text = JSON.stringify({ error: `Unknown resource: ${uri}` });
            }
            return {
                jsonrpc: '2.0',
                id: msg.id,
                result: { contents: [{ uri, mimeType: 'application/json', text }] },
            };
        }

        case 'ping':
            return { jsonrpc: '2.0', id: msg.id, result: {} };

        case 'notifications/initialized':
            return null; // no response needed

        default:
            return {
                jsonrpc: '2.0',
                id: msg.id,
                error: { code: -32601, message: `Method not found: ${msg.method}` },
            };
    }
}

// ── Helpers ───────────────────────────────────────────────────────
function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            try { resolve(JSON.parse(body)); } catch { resolve({}); }
        });
    });
}

function jsonRes(res, code, data) {
    res.writeHead(code, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end(JSON.stringify(data));
}

// ══════════════════════════════════════════════════════════════════
// HTTP Server (handles SSE, REST, and serves health)
// ══════════════════════════════════════════════════════════════════
function startHTTPServer() {
    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://localhost:${PORT}`);

        // CORS preflight
        if (req.method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            });
            return res.end();
        }

        // ── SSE endpoint ──
        if (url.pathname === '/sse' && req.method === 'GET') {
            return handleSSE(req, res);
        }
        if (url.pathname === '/mcp/message' && req.method === 'POST') {
            return handleSSEMessage(req, res);
        }

        // ── JSON-RPC endpoint ──
        if (url.pathname === '/mcp/rpc' && req.method === 'POST') {
            const body = await parseBody(req);
            const response = await handleJsonRpc(body);
            return jsonRes(res, 200, response || { jsonrpc: '2.0', result: null });
        }

        // ── REST: List tools ──
        if (url.pathname === '/mcp/tools' && req.method === 'GET') {
            return jsonRes(res, 200, { tools: HEADY_TOOLS, count: HEADY_TOOLS.length });
        }

        // ── REST: Call tool ──
        if (url.pathname === '/mcp/tools/call' && req.method === 'POST') {
            const body = await parseBody(req);
            const result = await callTool(body.name, body.arguments || {});
            return jsonRes(res, 200, result);
        }

        // ── Vector Space REST endpoints ──
        if (url.pathname === '/vector/store' && req.method === 'POST') {
            const body = await parseBody(req);
            const result = vectorStore.store(body.embedding, body.metadata || {});
            return jsonRes(res, 200, result);
        }
        if (url.pathname === '/vector/search' && req.method === 'POST') {
            const body = await parseBody(req);
            const results = vectorStore.search(body.embedding, body.topK || 5);
            return jsonRes(res, 200, { results });
        }
        if (url.pathname === '/vector/stats' && req.method === 'GET') {
            return jsonRes(res, 200, vectorStore.getStats());
        }

        // ── Health ──
        if (url.pathname === '/health') {
            return jsonRes(res, 200, {
                status: 'healthy',
                service: 'heady-mcp-bridge',
                version: '2.0.0',
                transports: {
                    stdio: TRANSPORT === 'stdio' || TRANSPORT === 'all',
                    sse: true,
                    http: true,
                    websocket: true,
                },
                vectorSpace: vectorStore.getStats(),
                gpu: GPU_CONFIG,
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
            });
        }

        // ── 404 ──
        jsonRes(res, 404, {
            error: 'Not found', endpoints: [
                'GET  /health', 'GET  /sse', 'POST /mcp/rpc', 'GET  /mcp/tools',
                'POST /mcp/tools/call', 'POST /vector/store', 'POST /vector/search',
                'GET  /vector/stats', 'WS   ws://host:port (WebSocket)',
            ]
        });
    });

    // WebSocket upgrade
    server.on('upgrade', (req, socket, head) => {
        if (req.headers.upgrade?.toLowerCase() === 'websocket') {
            handleWebSocketUpgrade(req, socket, head);
        } else {
            socket.destroy();
        }
    });

    server.listen(PORT, async () => {
        console.log(`\n  🐝 Heady MCP Multi-Transport Bridge`);
        console.log(`  ════════════════════════════════════`);
        console.log(`  📡 HTTP REST : http://localhost:${PORT}/mcp/tools`);
        console.log(`  📡 JSON-RPC  : http://localhost:${PORT}/mcp/rpc`);
        console.log(`  📡 SSE       : http://localhost:${PORT}/sse`);
        console.log(`  📡 WebSocket : ws://localhost:${PORT}`);
        console.log(`  📡 Health    : http://localhost:${PORT}/health`);
        console.log(`  🧠 Vectors   : ${vectorStore.getStats().vectorCount} stored (${vectorStore.getStats().dimensions}D)`);
        console.log(`  ⚡ GPU       : ${GPU_CONFIG.useGPU ? 'enabled' : 'CPU mode'}`);

        // ngrok tunnel for Colab
        const ngrokUrl = await setupNgrokTunnel(PORT);
        if (ngrokUrl) {
            console.log(`  🌐 ngrok     : ${ngrokUrl}`);
            console.log(`  🌐 SSE       : ${ngrokUrl}/sse`);
        }

        console.log(`  ════════════════════════════════════\n`);
    });
}

// ══════════════════════════════════════════════════════════════════
// MAIN — Boot all requested transports
// ══════════════════════════════════════════════════════════════════
async function main() {
    loadMCPTools();

    if (TRANSPORT === 'stdio') {
        startStdioTransport();
    } else if (TRANSPORT === 'http' || TRANSPORT === 'sse' || TRANSPORT === 'ws') {
        startHTTPServer();
    } else {
        // 'all' — start both stdio and HTTP
        startStdioTransport();
        startHTTPServer();
    }
}

main().catch(err => {
    console.error(`[Heady MCP Bridge] Fatal: ${err.message}`);
    process.exit(1);
});

module.exports = { callTool, vectorStore, HEADY_TOOLS, handleJsonRpc };
