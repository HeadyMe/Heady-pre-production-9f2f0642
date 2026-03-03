#!/usr/bin/env node
/**
 * Heady Knowledge Mass Ingestion
 * Crawls entire project, extracts knowledge chunks, fires them into /api/vector/store
 * Uses real HF embeddings (sentence-transformers/all-MiniLM-L6-v2)
 */
const fs = require('fs');
const path = require('path');

const API = 'http://localhost:3301/api/vector/store';
const ROOT = '/home/headyme/Heady';
let ingested = 0, failed = 0, skipped = 0;

async function ingest(content, metadata = {}) {
    const text = content.substring(0, 1800);
    if (text.length < 30) { skipped++; return; }
    try {
        const res = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: text, metadata }),
        });
        if (res.ok) { ingested++; }
        else { failed++; }
    } catch { failed++; }
    // Rate limit: HF free tier ~10 req/s
    await new Promise(r => setTimeout(r, 150));
}

function chunkText(text, maxLen = 1500) {
    const chunks = [];
    const paragraphs = text.split(/\n\n+/);
    let current = '';
    for (const p of paragraphs) {
        if ((current + '\n\n' + p).length > maxLen && current.length > 50) {
            chunks.push(current.trim());
            current = p;
        } else {
            current += '\n\n' + p;
        }
    }
    if (current.trim().length > 30) chunks.push(current.trim());
    return chunks;
}

async function ingestFile(filePath, type = 'semantic') {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const rel = path.relative(ROOT, filePath);
        const chunks = chunkText(content);
        for (let i = 0; i < chunks.length; i++) {
            await ingest(chunks[i], {
                type, source: rel, chunk: i + 1, totalChunks: chunks.length,
                file: path.basename(filePath),
            });
        }
        process.stdout.write(`  ✓ ${rel} (${chunks.length} chunks)\n`);
    } catch (e) {
        process.stdout.write(`  ✗ ${path.relative(ROOT, filePath)}: ${e.message}\n`);
    }
}

function findFiles(dir, exts, maxDepth = 3, depth = 0) {
    if (depth > maxDepth) return [];
    const results = [];
    try {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, ent.name);
            if (ent.name.startsWith('.') || ent.name === 'node_modules' || ent.name === 'dist') continue;
            if (ent.isDirectory()) results.push(...findFiles(full, exts, maxDepth, depth + 1));
            else if (exts.some(e => ent.name.endsWith(e))) results.push(full);
        }
    } catch { }
    return results;
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║  HEADY KNOWLEDGE MASS INGESTION — ALL PROJECT DATA  ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    const start = Date.now();

    // ── 1. Architecture & System Design ──
    console.log('\n━━━ Architecture & System Design ━━━');
    await ingest(`Heady is an AI Platform ecosystem built by Heady Systems LLC. The core runtime is heady-manager.js (~2300 lines), an Express.js server running on port 3301. It orchestrates 20+ AI service nodes, manages persistent 3D vector memory, runs an MCP server, hosts Swagger API docs, and coordinates the Aloha Protocol for system stability. The platform uses PM2 for process management with ~23 services including the core manager, HCFP auto-success engine, and 20+ static site servers.`, { type: 'architecture', source: 'system-overview' });

    await ingest(`The Heady memory system has 3 layers: (1) vector-memory.js — 3D spatial sharded storage with 5 Fibonacci shards, 8 octant zones, and real HuggingFace embeddings via sentence-transformers/all-MiniLM-L6-v2; (2) duckdb-memory.js — DuckDB-backed production vector store with HNSW indexing at ~/.headyme/heady-brain-v2.duckdb; (3) routes/memory.js — gain-or-reject protocol with significance scoring, deduplication, and JSONL persistence. Embeddings are generated via router.huggingface.co with fallback to Ollama local then hash-based embedding.`, { type: 'architecture', source: 'memory-system' });

    await ingest(`The Heady AI nodes are 20+ specialized services: HeadyBrain (reasoning), HeadySoul (consciousness/learning), HeadyJules (Claude/Anthropic), HeadyPythia (Gemini), HeadyCompute (OpenAI/GPT), HeadyFast (Groq), HeadyResearch (Perplexity/Sonar), HeadyCoder (code generation), HeadyBuilder (GPT-Codex), HeadyCopilot (inline suggestions), HeadyLens (vision/GPU), HeadyVinci (pattern recognition), HeadyBattle (arena mode), HeadyBuddy (personal assistant), HeadyOps (DevOps), HeadyMaid (housekeeping), HeadyMaintenance (backups/updates), HeadyOrchestrator (trinity communication), HeadyHub (HuggingFace integration).`, { type: 'architecture', source: 'ai-nodes' });

    await ingest(`The Heady service orchestrator (hc_sys_orchestrator.js) routes requests to appropriate AI providers using a handler registry pattern. It supports multi-model routing where requests are dispatched to Claude, GPT, Gemini, Groq, or Perplexity based on task type. The orchestrator exposes /api/brain/health, /api/brain/plan, /api/brain/feedback, /api/brain/status endpoints. The brain_api.js layer handles direct AI interactions through the HeadyGateway SDK.`, { type: 'architecture', source: 'orchestrator' });

    await ingest(`HCFP (Heady Core Functionality Platform) is the auto-success engine that runs as a separate PM2 process (hcfp-full-auto.js). It enforces production policies like zero_headysystems.com and production_domains_only, intercepts events via HeadyBattle_interceptor, and maintains system invariants. HCFP operates in full-auto mode with enforced HeadyBattle_mode.`, { type: 'architecture', source: 'hcfp' });

    // ── 2. Infrastructure & Deployment ──
    console.log('\n━━━ Infrastructure & Deployment ━━━');
    await ingest(`Heady runs on a mini-computer (headyme@heady) with PM2 managing all processes. The ecosystem.config.cjs defines: heady-manager on port 3301, hcfp-auto-success, and 20+ static site servers on ports 9000-9019 plus headyweb on port 3000. Sites are served via 'npx serve dist -l PORT -s'. The system uses Cloudflare tunnels for external access, nginx for reverse proxy with mTLS, and Syncthing for file synchronization.`, { type: 'infrastructure', source: 'deployment' });

    await ingest(`Domain infrastructure: headysystems.com (main), headybuddy.org (assistant), headyconnection.org (nonprofit), headyme.com (personal hub), headyio.com (platform), headymcp.com (MCP protocol), headyos.io (agent OS), 1ime1.com (brand). All domains route through Cloudflare with tunnel-based ingress rules defined in configs/cloudflared/ingress-rules.yaml. Internal hosts are mapped in configs/hosts.internal.`, { type: 'infrastructure', source: 'domains' });

    await ingest(`The Heady design system (packages/heady-design-system/heady-design-system.css) provides a unified visual identity with CSS variables for colors (--heady-primary through accent), glassmorphic effects, neon breathing animations, gradient shifts, and premium hover effects. The Swagger API docs are themed with heady-swagger.css for dark glassmorphism. Terminal output uses ANSI escape codes for branded ASCII art banners.`, { type: 'infrastructure', source: 'design-system' });

    // ── 3. Source Modules ──
    console.log('\n━━━ Source Modules ━━━');
    const srcFiles = findFiles(path.join(ROOT, 'src'), ['.js'], 2);
    for (const f of srcFiles) await ingestFile(f, 'procedural');

    // ── 4. Services ──
    console.log('\n━━━ Services ━━━');
    const svcFiles = findFiles(path.join(ROOT, 'services'), ['.js'], 2);
    for (const f of svcFiles) await ingestFile(f, 'procedural');

    // ── 5. Documentation ──
    console.log('\n━━━ Documentation ━━━');
    const topDocs = [
        'README.md', 'STANDING_DIRECTIVE.md', 'README-WORKSPACE.md',
        'WORKSPACE-ARCHITECTURE.md', 'Heady_Project_Overview.md',
        'CHANGELOG.md', 'SECURITY.md', 'CONTRIBUTING.md',
    ];
    for (const doc of topDocs) {
        const fp = path.join(ROOT, doc);
        if (fs.existsSync(fp)) await ingestFile(fp, 'semantic');
    }

    // ── 6. Archived Docs ──
    console.log('\n━━━ Archived Documentation ━━━');
    const archiveDocs = findFiles(path.join(ROOT, 'docs'), ['.md', '.txt'], 2);
    for (const f of archiveDocs) await ingestFile(f, 'semantic');

    // ── 7. Configs ──
    console.log('\n━━━ Configuration Files ━━━');
    const configFiles = findFiles(path.join(ROOT, 'configs'), ['.yaml', '.yml', '.json', '.conf'], 2);
    for (const f of configFiles) await ingestFile(f, 'contextual');

    // ── 8. Packages ──
    console.log('\n━━━ Packages ━━━');
    const pkgFiles = findFiles(path.join(ROOT, 'packages'), ['.js'], 2);
    for (const f of pkgFiles) await ingestFile(f, 'procedural');

    // ── 9. MCP Server ──
    console.log('\n━━━ MCP Server ━━━');
    const mcpFiles = findFiles(path.join(ROOT, 'src', 'mcp'), ['.js'], 2);
    for (const f of mcpFiles) await ingestFile(f, 'procedural');

    // ── 10. Ecosystem Knowledge ──
    console.log('\n━━━ Ecosystem Relationships ━━━');
    await ingest(`PM2 Process Map: heady-manager (port 3301, core runtime) → orchestrates all services. hcfp-auto-success (policy enforcement). Site servers: headysystems(9000), headyme(9001), headyconnection(9002), headybuddy(9003), headymcp(9004), headyio(9005), headyapi(9006), headyos(9007), heady-discord(9008), heady-discord-connector(9009), headyio-com(9010), headybuddy-org(9011), headyconnection-org(9012), headyme-com(9013), headymcp-com(9014), headysystems-com(9015), 1ime1(9016), admin-ui(9017), instant(9018), headydocs(9019), headyweb(3000).`, { type: 'contextual', source: 'pm2-process-map' });

    await ingest(`API Endpoint Catalog — HeadyManager (port 3301): /api/brain/health (orchestrator health), /api/brain/plan (AI planning), /api/brain/chat (conversational AI), /api/brain/search (knowledge search), /api/brain/feedback (feedback collection), /api/brain/status (brain status), /api/vector/query (semantic vector search), /api/vector/store (ingest vector), /api/vector/stats (vector stats), /api/vector/3d/map (3D spatial visualization), /api/memory/health (memory health), /api/memory/process (gain/reject memory), /api/memory/recall (recall by query), /api/memory/stats (memory stats), /api/memory/audit (audit log), /api/memory/report (gain/reject summary), /api/memory/vectors (vector export), /api/memory/import (bulk import), /api/memory/ingest-chat (chat knowledge extraction).`, { type: 'contextual', source: 'api-catalog' });

    await ingest(`HeadyBuddy SDK (heady-hive-sdk): Gateway pattern with provider abstraction. HeadyGateway class manages provider registration, request routing, and response caching. Providers include Claude (Anthropic), GPT (OpenAI), Gemini (Google), Groq, Perplexity, and HuggingFace. The SDK handles API key management, rate limiting, and fallback chains. Used by vector-memory.js for embeddings and brain.js for AI completions.`, { type: 'procedural', source: 'heady-hive-sdk' });

    await ingest(`The Aloha Protocol is the system stability layer. It manages crash detection, stability diagnostics, and protocol enforcement. State is stored in app.locals.alohaState with mode, protocols list, stabilityDiagnosticMode flag, and crashReports array. The protocol was extracted from heady-manager.js into src/routes/aloha.js as a pillar module during the decomposition phase.`, { type: 'procedural', source: 'aloha-protocol' });

    await ingest(`HeadyBattle Arena Mode: Multi-node AI competition system where AI nodes compete on tasks. Supports session, evaluate, arena, leaderboard, and compare actions. 7 default nodes compete with customizable criteria. Results include scores, rankings, and detailed evaluations. The arena interceptor in HCFP captures events for policy enforcement.`, { type: 'procedural', source: 'heady-battle' });

    await ingest(`Vector Memory 3D Architecture: Each vector embedding (384 dims from all-MiniLM-L6-v2) is projected to 3D coordinates via PCA-lite: split dims into 3 groups of 128, average each group → (x, y, z). Octant zone assignment: 8 zones based on signs of (x,y,z). Query strategy: search same-zone first (fast path), expand to adjacent zones if score < 0.5, full scan as fallback. 5 shards with max 2000 vectors each, persisted to data/vector-shards/shard-N.json. Golden ratio (φ=1.618) used for persistence debounce timing.`, { type: 'procedural', source: '3d-vector-architecture' });

    await ingest(`Key dependencies: Express.js (web framework), PM2 (process manager), DuckDB (vector database), @anthropic-ai/sdk (Claude), @huggingface/inference (HF models), swagger-ui-express (API docs), node-fetch, js-yaml, crypto (hashing). The heady-hive-sdk is a local package providing the HeadyGateway abstraction layer. Frontend uses Tailwind CSS with Vite build. Discord bot uses discord.js.`, { type: 'contextual', source: 'dependencies' });

    // ── Summary ──
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n╔══════════════════════════════════════════════════════╗`);
    console.log(`║  INGESTION COMPLETE                                  ║`);
    console.log(`║  Ingested: ${String(ingested).padEnd(6)} | Failed: ${String(failed).padEnd(6)} | Skipped: ${String(skipped).padEnd(5)}║`);
    console.log(`║  Time: ${elapsed}s                                       ║`);
    console.log(`╚══════════════════════════════════════════════════════╝`);
}

main().catch(console.error);
