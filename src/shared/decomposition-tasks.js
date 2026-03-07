/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 *
 * God Class Decomposition Tasks — Auto-Success tasks to break
 * monolithic files into blast-compatible HeadyBees work units.
 *
 * Strategy: Each god class gets decomposed into work arrays that
 * HeadyBees can blast() across with however many bees it calculates.
 * The swarm decides the parallelism — we just define the work.
 *
 * Generated from arch sprawl audit (March 2026).
 */

module.exports = [
    // ═══ routes/brain.js (1105 lines → blast-compatible provider workers) ═══
    {
        id: "decomp-001", name: "Extract AI provider connectors into blastable workers",
        cat: "architecture", pool: "hot", w: 5,
        desc: "Extract chatViaOpenAI, chatViaClaude, chatViaOllama, chatViaHuggingFace, chatViaGemini from routes/brain.js into src/bees/brain-providers.js — each provider becomes a work function HeadyBees can blast() across dynamically"
    },
    {
        id: "decomp-002", name: "Extract model cascade logic into blastable selector",
        cat: "architecture", pool: "hot", w: 5,
        desc: "Extract analyzeComplexity, selectModel, getClaudeClient from routes/brain.js into src/bees/model-cascade.js — swarm can race model selection across bees"
    },
    {
        id: "decomp-003", name: "Extract response filter pipeline into blastable stage",
        cat: "architecture", pool: "warm", w: 4,
        desc: "Extract filterResponse + content safety from routes/brain.js into src/bees/response-filter.js — swarm can parallelize filtering"
    },
    {
        id: "decomp-004", name: "Extract memory receipt logging into blastable audit",
        cat: "architecture", pool: "warm", w: 3,
        desc: "Extract logMemoryReceipt, storeInMemory, logInteraction from routes/brain.js into src/bees/memory-audit.js — swarm can blast audit writes"
    },
    {
        id: "decomp-005", name: "Extract race audit & usage tracking into blastable analytics",
        cat: "architecture", pool: "warm", w: 4,
        desc: "Extract trackClaudeUsage, appendRaceAudit, RACE_STATS from routes/brain.js into src/bees/race-analytics.js — swarm can blast analytics in parallel"
    },

    // ═══ hc_auto_success.js (1462 lines → blast-compatible task executors) ══
    {
        id: "decomp-006", name: "Extract task category executors into blastable workers",
        cat: "architecture", pool: "hot", w: 5,
        desc: "Extract 9 task category handlers (learning, optimization, integration, monitoring, maintenance, discovery, verification, creative, deep-intel) from hc_auto_success.js into src/bees/task-executors/ — each category is a work array HeadyBees blasts across"
    },
    {
        id: "decomp-007", name: "Extract task scheduler into blast-driven scheduler",
        cat: "architecture", pool: "hot", w: 5,
        desc: "Replace fixed-interval task scheduling in hc_auto_success.js with HeadyBees.blastAll() — swarm decides how many tasks to run per cycle based on resource availability"
    },
    {
        id: "decomp-008", name: "Extract external task loader into blastable loader",
        cat: "architecture", pool: "warm", w: 4,
        desc: "Extract loadExternalTasks, getTaskCatalog, getHistory from hc_auto_success.js into src/bees/task-catalog.js — swarm can blast task loading"
    },
    {
        id: "decomp-009", name: "Extract telemetry aggregation into blastable collector",
        cat: "architecture", pool: "warm", w: 3,
        desc: "Extract telemetry, metrics, event bus handling from hc_auto_success.js into src/bees/telemetry-collector.js"
    },

    // ═══ hc_pipeline.js (1043 lines → blast-compatible pipeline stages) ═════
    {
        id: "decomp-010", name: "Extract pipeline stage runners into blastable stages",
        cat: "architecture", pool: "hot", w: 5,
        desc: "Extract stage execution functions from hc_pipeline.js into src/bees/pipeline-stages.js — each stage is a work function, HeadyBees blasts independent stages in parallel"
    },
    {
        id: "decomp-011", name: "Extract checkpoint protocol into blastable validator",
        cat: "architecture", pool: "warm", w: 4,
        desc: "Extract runCheckpoint, executeCheckpointResponsibility from hc_pipeline.js into src/bees/checkpoint-validators.js — swarm can blast checkpoint validations"
    },
    {
        id: "decomp-012", name: "Extract task cache layer into blastable cache",
        cat: "architecture", pool: "warm", w: 3,
        desc: "Extract loadTaskCache, getCachedResult, setCachedResult from hc_pipeline.js into src/bees/task-cache.js — isolate caching from pipeline logic"
    },
    {
        id: "decomp-013", name: "Extract inline circuit breaker to use consolidated breaker",
        cat: "architecture", pool: "warm", w: 4,
        desc: "Replace hc_pipeline.js inline CircuitBreaker class with require('../resilience/circuit-breaker') — eliminate 4th copy of circuit breaker"
    },

    // ═══ mcp/heady-mcp-server.js (1183 lines → blast-compatible tools) ══════
    {
        id: "decomp-014", name: "Extract MCP tool handlers into blastable tool modules",
        cat: "architecture", pool: "hot", w: 5,
        desc: "Extract each MCP tool handler from heady-mcp-server.js into src/bees/mcp-tools/ — one work module per tool domain (brain, deploy, memory, search, creative, patterns, orchestrator, etc.) — HeadyBees blasts tool execution across dynamic bee count"
    },
    {
        id: "decomp-015", name: "Extract MCP HTTP helpers into shared client module",
        cat: "architecture", pool: "warm", w: 3,
        desc: "Extract headyPost, headyGet, headers config from heady-mcp-server.js into src/bees/mcp-client.js — shared by all tool modules"
    },
    {
        id: "decomp-016", name: "Extract MCP resource/prompt handlers into blastable modules",
        cat: "architecture", pool: "warm", w: 3,
        desc: "Extract ListResources, ReadResource, ListPrompts, GetPrompt handlers into src/bees/mcp-resources.js — swarm can blast resource listing"
    },

    // ═══ heady-manager.js (1298 lines → already improving) ═════════════════
    {
        id: "decomp-017", name: "Extract security middleware into blastable security layer",
        cat: "architecture", pool: "warm", w: 4,
        desc: "Extract Helmet, CORS, rate limiting, auth middleware from heady-manager.js into src/bees/security-middleware.js — clean separation from boot orchestration"
    },
    {
        id: "decomp-018", name: "Extract SSE broadcasting into blastable event broadcaster",
        cat: "architecture", pool: "warm", w: 3,
        desc: "Extract SSE event broadcasting from heady-manager.js into src/bees/event-broadcaster.js — swarm can blast event fanout"
    },
    {
        id: "decomp-019", name: "Extract secrets management into blastable secrets engine",
        cat: "architecture", pool: "warm", w: 4,
        desc: "Extract secrets loading, rotation, validation from heady-manager.js into src/bees/secrets-engine.js — swarm can blast secret health checks"
    },
    {
        id: "decomp-020", name: "Extract engine wiring into blastable boot sequence",
        cat: "architecture", pool: "hot", w: 5,
        desc: "Extract wireEngines() and conductor setup from heady-manager.js into src/bees/boot-sequence.js — swarm can blast engine initialization in parallel"
    },

    // ═══ backend/index.js (1363 lines → blast-compatible backend) ════════════
    {
        id: "decomp-021", name: "Extract backend route handlers into blastable modules",
        cat: "architecture", pool: "warm", w: 4,
        desc: "Extract route handlers from backend/index.js into backend/bees/ modules — each domain (auth, api, pages) becomes a work array"
    },
    {
        id: "decomp-022", name: "Extract backend middleware stack into blastable pipeline",
        cat: "architecture", pool: "warm", w: 3,
        desc: "Extract middleware chain from backend/index.js into backend/bees/middleware.js"
    },

    // ═══ cloudflare/heady-edge-proxy (3028 lines) ═══════════════════════════
    {
        id: "decomp-023", name: "Extract edge proxy routing table into blastable router",
        cat: "architecture", pool: "hot", w: 5,
        desc: "Extract handleRequest domain routing from heady-edge-proxy.js into cloudflare/bees/edge-router.js — swarm can blast route resolution"
    },
    {
        id: "decomp-024", name: "Extract edge proxy static handler into blastable handler",
        cat: "architecture", pool: "warm", w: 3,
        desc: "Extract HTML template rendering from heady-edge-proxy.js into cloudflare/bees/static-handler.js"
    },
    {
        id: "decomp-025", name: "Extract edge proxy middleware into blastable filter chain",
        cat: "architecture", pool: "warm", w: 4,
        desc: "Extract KV caching, auth, rate limiting from heady-edge-proxy.js into cloudflare/bees/edge-middleware.js"
    },

    // ═══ scripts/generate-sites.js (1433 lines) ═════════════════════════════
    {
        id: "decomp-026", name: "Extract site generator templates into blastable generators",
        cat: "architecture", pool: "warm", w: 4,
        desc: "Extract per-site HTML generators from generate-sites.js into scripts/bees/site-generators.js — HeadyBees blasts all site generations in parallel"
    },
    {
        id: "decomp-027", name: "Extract asset pipeline into blastable processor",
        cat: "architecture", pool: "warm", w: 3,
        desc: "Extract favicon, CSS, JS asset processing from generate-sites.js into scripts/bees/asset-pipeline.js"
    },

    // ═══ META: INTEGRATE BEES INTO DECOMPOSED MODULES ═══════════════════════
    {
        id: "decomp-028", name: "Add blastDecompose() to HeadyBees for module splitting",
        cat: "architecture", pool: "hot", w: 5,
        desc: "Add blastDecompose(godClass, domains) method to HeadyBees — dynamically splits work across domains and blasts them. The swarm decides parallelism, not the developer."
    },
    {
        id: "decomp-029", name: "Create bee registry for auto-discovered worker modules",
        cat: "architecture", pool: "warm", w: 4,
        desc: "Create src/bees/registry.js — auto-discovers all bee worker modules in src/bees/, registers them as blastable work units. HeadyBees queries registry to find available workers."
    },
    {
        id: "decomp-030", name: "Wire decomposed bees into auto-success cycle",
        cat: "ops", pool: "hot", w: 5,
        desc: "Modify auto-success engine to use HeadyBees.blast() for task execution — the swarm decides how many tasks to run per cycle instead of fixed batch sizes"
    },
];
