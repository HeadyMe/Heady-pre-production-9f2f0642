#!/usr/bin/env node
/**
 * ═══ Heady CLI — Unified Interface to the Heady Hive SDK ═══
 *
 * Usage: heady <command> [args]
 *        heady --help | -h
 *        heady --version | -v
 */

const { HeadyClient, HeadyGateway, createProviders, OpenAIBridge, GCloudBridge } = require("../index");

const args = process.argv.slice(2);
const cmd = args[0];
const rest = args.slice(1).join(" ");
const flags = new Set(args.filter(a => a.startsWith("-")));
const pkg = require("../package.json");

// Initialize client
const heady = new HeadyClient({
    url: process.env.HEADY_URL || "https://headyme.com",
    apiKey: process.env.HEADY_API_KEY || "",
    budget: {
        daily: parseFloat(process.env.HEADY_BUDGET_DAILY || "10"),
        monthly: parseFloat(process.env.HEADY_BUDGET_MONTHLY || "100"),
    },
});

// ─── Commands ───────────────────────────────────────────────────────

const COMMANDS = {
    // ── Brain ──
    async chat() {
        if (!rest) return console.log("Usage: heady chat \"message\"");
        const res = await heady.brain.chat(rest);
        console.log(res.response || res.text || JSON.stringify(res, null, 2));
    },

    async analyze() {
        if (!rest) return console.log("Usage: heady analyze \"content\"");
        const res = await heady.brain.analyze(rest);
        console.log(JSON.stringify(res, null, 2));
    },

    async search() {
        if (!rest) return console.log("Usage: heady search \"query\"");
        const edgeUrl = process.env.HEADY_EDGE_URL || "https://heady-edge-node.headyme.workers.dev";
        const start = Date.now();

        // Try edge worker first (Cloudflare AI + Vectorize)
        try {
            const edgeRes = await fetch(`${edgeUrl}/api/search`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: rest, limit: 10 }),
                signal: AbortSignal.timeout(5000),
            });
            const data = await edgeRes.json();
            const ms = Date.now() - start;

            if (data.matches?.length > 0) {
                console.log(`⚡ Edge Search (${data.meta?.colo || "?"} · ${ms}ms · ${data.matches.length} matches)`);
                if (data.answer) console.log(`\n${data.answer}\n`);
                for (const m of data.matches.slice(0, 5)) {
                    console.log(`  [${(m.score * 100).toFixed(0)}%] ${m.content?.substring(0, 100) || m.id} (${m.source})`);
                }
                return;
            }
        } catch { /* Edge unavailable — fall through to origin */ }

        // Fallback to origin Brain API
        const res = await heady.brain.search(rest);
        console.log(JSON.stringify(res, null, 2));
    },

    async embed() {
        if (!rest) return console.log("Usage: heady embed \"text\"");
        const res = await heady.embed(rest);
        console.log(JSON.stringify(res, null, 2));
    },

    async complete() {
        if (!rest) return console.log("Usage: heady complete \"prompt\"");
        const res = await heady.brain.complete(rest);
        console.log(JSON.stringify(res, null, 2));
    },

    async refactor() {
        if (!rest) return console.log("Usage: heady refactor \"code\"");
        const res = await heady.brain.refactor(rest);
        console.log(JSON.stringify(res, null, 2));
    },

    // ── Battle ──
    async battle() {
        if (!rest) return console.log("Usage: heady battle \"change description\"");
        const res = await heady.battle.validate(rest);
        console.log(JSON.stringify(res, null, 2));
    },

    // ── Creative ──
    async creative() {
        if (!rest) return console.log("Usage: heady creative \"prompt\"");
        const res = await heady.creative.generate(rest);
        console.log(JSON.stringify(res, null, 2));
    },

    // ── Lens (Visual Analysis) ──
    async lens() {
        const sub = args[1];
        const target = args.slice(2).join(" ") || args[1];
        if (!sub) return console.log("Usage: heady lens <analyze|detect|process> <image_path_or_url>\n       heady lens analyze photo.jpg\n       heady lens detect https://example.com/image.png");

        const action = ["analyze", "detect", "process"].includes(sub) ? sub : "analyze";
        const input = action === sub ? target : args.slice(1).join(" ");

        console.log(`\ud83d\udd0d HeadyLens — ${action}: ${input}`);
        try {
            const http = require("http");
            const body = JSON.stringify({ action, image_url: input, prompt: input });
            const url = new URL(heady.baseUrl);
            const req = http.request({
                hostname: url.hostname === "headyme.com" ? "127.0.0.1" : url.hostname,
                port: url.port || 3301,
                path: "/api/lens/" + action,
                method: "POST",
                headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
                timeout: 30000,
            }, (res) => {
                let data = "";
                res.on("data", c => data += c);
                res.on("end", () => {
                    try { console.log(JSON.stringify(JSON.parse(data), null, 2)); }
                    catch { console.log(data); }
                });
            });
            req.on("error", e => console.error(`\u274c ${e.message}`));
            req.write(body);
            req.end();
        } catch (err) {
            console.error(`\u274c ${err.message}`);
        }
    },

    // ── MCP ──
    async mcp() {
        const tools = await heady.mcp.listTools();
        console.log("🔧 MCP Tools:");
        if (Array.isArray(tools)) tools.forEach(t => console.log(`   ${t.name} — ${t.description?.substring(0, 60)}`));
        else console.log(JSON.stringify(tools, null, 2));
    },

    // ── Decompose ──
    async decompose() {
        if (!rest) return console.log("Usage: heady decompose \"complex task description\"");
        console.log("🔀 Decomposing task across all providers...");
        const res = await heady.decompose(rest);
        if (res.ok) {
            console.log(`✅ Completed in ${res.latency}ms using ${res.decomposition.providersUsed.length} providers`);
            console.log(`   Subtasks: ${res.decomposition.subtasks.length} completed, ${res.decomposition.failed} failed`);
            console.log(`   Strategy: ${res.decomposition.mergeStrategy}`);
            for (const s of res.decomposition.subtasks) {
                console.log(`   📌 [${s.provider}] ${s.task.substring(0, 60)}... (${s.latency}ms, ${s.responseLength} chars)`);
            }
            console.log("\n─── MERGED RESPONSE ───");
            console.log(res.response);
        } else {
            console.error(`❌ ${res.error}`);
        }
    },

    // ── Gateway ──
    async gateway() {
        const sub = args[1];
        if (sub === "stats" || !sub) {
            const stats = heady.gatewayStats();
            console.log("⚡ Gateway Stats:");
            console.log(JSON.stringify(stats, null, 2));
        } else if (sub === "audit") {
            const limit = parseInt(args[2]) || 10;
            const audit = heady.gatewayAudit(limit);
            console.log(`📊 Race Audit (last ${audit.length}):`);
            for (const a of audit) {
                const w = a.winner?.source || "?";
                const lat = a.winner?.latency || "?";
                console.log(`  ${a.raceId}: Winner=${w} (${lat}ms) | Losers: ${(a.lateResponses || []).length} | Errors: ${(a.errors || []).length}`);
            }
        } else if (sub === "optimize") {
            const opts = heady.gatewayOptimizations();
            console.log("🔬 Optimization Signals:");
            if (opts.signals.length === 0) console.log("   No signals yet — run more requests first");
            for (const s of opts.signals) console.log(`   ⚡ [${s.type}] ${s.recommendation}`);
            console.log("\nWin Rates:", JSON.stringify(opts.winRate));
            console.log("Avg Latency:", JSON.stringify(opts.avgLatency));
        } else if (sub === "providers") {
            const stats = heady.gatewayStats();
            console.log("🌐 Providers:");
            for (const p of stats.providers) {
                const h = p.health;
                const icon = h?.healthy ? "🟢" : "🔴";
                console.log(`   ${icon} ${p.name} (${p.serviceGroup}) — priority:${p.priority} caps:[${p.capabilities.join(",")}] calls:${h?.totalCalls || 0} errs:${h?.totalErrors || 0} avg:${h?.avgLatency || 0}ms`);
            }
        } else if (sub === "budget") {
            const stats = heady.gatewayStats();
            const b = stats.budget;
            console.log("💰 Budget:");
            console.log(`   Daily:   $${b.spent.daily.toFixed(4)} / $${b.daily}`);
            console.log(`   Monthly: $${b.spent.monthly.toFixed(4)} / $${b.monthly}`);
        } else {
            console.log("Usage: heady gateway [stats|audit|optimize|providers|budget]");
        }
    },

    // ── System ──
    async health() {
        const info = await heady.info();
        console.log("🧠 Heady System Info");
        console.log(`   Connected: ${info.connected}`);
        console.log(`   SDK: v${info.sdk.version}`);
        console.log(`   URL: ${info.sdk.url}`);
        const gw = info.gateway;
        if (gw) {
            console.log(`   Gateway: ${gw.providers.length} providers | ${gw.totalRequests} requests | ${gw.cacheHits} cache hits`);
            console.log(`   Budget: $${gw.budget.spent.daily.toFixed(4)}/$${gw.budget.daily} daily`);
        }
        if (info.autoSuccess && typeof info.autoSuccess === "object") {
            const as = info.autoSuccess;
            console.log(`   Engine: ${as.running ? "RUNNING" : "STOPPED"}`);
        }
    },

    async status() {
        const res = await heady.autoSuccess();
        console.log("⚡ Auto-Success Status");
        console.log(JSON.stringify(res, null, 2));
    },

    // ── Bridges ──
    async openai() {
        const bridge = new OpenAIBridge();
        const h = await bridge.health();
        console.log("🤖 OpenAI Bridge:", JSON.stringify(h));
    },

    async gcloud() {
        const bridge = new GCloudBridge();
        const h = await bridge.health();
        console.log("☁️  Google Cloud:", JSON.stringify(h));
    },

    // ── Help ──
    help() {
        console.log(`
═══════════════════════════════════════════════
  🐝 Heady Hive SDK — v${pkg.version}
  Liquid Unified AI Gateway
═══════════════════════════════════════════════

BRAIN
  heady chat "message"         Chat with HeadyBrain (routes through liquid gateway)
  heady analyze "content"      Analyze code/text via AI
  heady search "query"         Search Heady knowledge base
  heady embed "text"           Generate vector embeddings
  heady complete "prompt"      Text/code completion
  heady refactor "code"        AI-powered code refactoring

SERVICES
  heady battle "change"        Validate changes through HeadyBattle
  heady creative "prompt"      Generate creative content
  heady lens analyze <image>   Visual analysis of an image (path or URL)
  heady lens detect <image>    Object/feature detection in an image
  heady lens process <image>   Process/transform an image
  heady mcp                    List available MCP tools (31+)
  heady decompose "task"       Split complex task across ALL providers (fan-out/merge)

GATEWAY
  heady gateway stats          Provider health, cache, budget overview
  heady gateway providers      List all registered providers with status
  heady gateway audit [N]      Show last N race audit entries
  heady gateway optimize       AI-driven optimization recommendations
  heady gateway budget         Current budget spend/limits

SYSTEM
  heady health                 Full system health check
  heady status                 Auto-success engine status
  heady openai                 OpenAI bridge health
  heady gcloud                 Google Cloud bridge health

FLAGS
  --help, -h                   Show this help
  --version, -v                Show version

ENVIRONMENT
  HEADY_URL                    Heady Manager URL (default: https://headyme.com)
  HEADY_API_KEY                API authentication key
  HEADY_BUDGET_DAILY           Daily budget cap in USD (default: 10)
  HEADY_BUDGET_MONTHLY         Monthly budget cap in USD (default: 100)
  OPENAI_API_KEY               OpenAI API key
  CLAUDE_API_KEY               Anthropic Claude API key
  GOOGLE_API_KEY               Google/Gemini API key
  HF_TOKEN                     HuggingFace token
  HEADY_LOCAL_ENABLED          Enable local Ollama (default: false)
`);
    },
};

// ─── Entry Point ────────────────────────────────────────────────────

(async () => {
    try {
        if (flags.has("--version") || flags.has("-v")) return console.log(pkg.version);
        if (!cmd || cmd === "help" || flags.has("--help") || flags.has("-h")) return COMMANDS.help();

        // Smart dispatch: if the first arg isn't a known command, treat the
        // ENTIRE input as a natural-language message and route to chat.
        // This lets you just type:  heady "fix the login page"
        // instead of:               heady chat "fix the login page"
        if (!COMMANDS[cmd]) {
            const fullMessage = args.join(" ");
            const res = await heady.brain.chat(fullMessage);
            console.log(res.response || res.text || JSON.stringify(res, null, 2));
            return;
        }

        await COMMANDS[cmd]();
    } catch (err) {
        console.error(`❌ ${err.message}`);
        process.exit(1);
    }
})();
