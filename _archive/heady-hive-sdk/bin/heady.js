#!/usr/bin/env node
/**
 * ═══ Heady CLI — Unified Interface to the Heady Hive SDK ═══
 *
 * Smart Default: Just type `heady "anything"` — if the first word isn't a
 * recognized command, the entire input is auto-routed to Heady Brain chat.
 * No command needed. Paste code, ask questions, dump scattered notes.
 *
 * Explicit commands:
 *   heady <command> [args]     Run a specific command (chat, search, battle, etc.)
 *   heady --help | -h          Show all commands
 *   heady --version | -v       Show version
 */

// Load .env from project root (Heady/)
try { require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") }); } catch { /* dotenv not installed — use system env */ }

const { HeadyClient, HeadyGateway, createProviders } = require("../index");
const { pp, banner, barChart, progressBar, statusLine, section, kvBox, sparkline, C, fmtValue } = (() => {
    try { return require("../../src/lib/pretty"); }
    catch {
        const noop = () => { };
        return { pp: (d) => console.log(JSON.stringify(d, null, 2)), banner: (t) => console.log(`\n=== ${t} ===`), barChart: noop, progressBar: noop, statusLine: noop, section: (l) => console.log(`\n--- ${l} ---`), kvBox: (d) => console.log(d), sparkline: () => "", C: {}, fmtValue: (v) => String(v) };
    }
})();

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
        banner("HeadyBrain Chat", "Liquid Gateway → Best Provider");
        const start = Date.now();
        const res = await heady.brain.chat(rest);
        const ms = Date.now() - start;
        const text = res.response || res.text || JSON.stringify(res, null, 2);
        section("Response");
        console.log(`\n  ${text}\n`);
        console.log(`  ${C.dim}Engine: ${res.engine || res.model || "heady-brain"} · ${ms}ms${res.cached ? " · cached" : ""}${C.reset}\n`);
    },

    async analyze() {
        if (!rest) return console.log("Usage: heady analyze \"content\"");
        banner("HeadyBrain Analysis");
        const res = await heady.brain.analyze(rest);
        pp(res, { title: "Analysis Results" });
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
        pp(res, { title: "Search Results" });
    },

    async embed() {
        if (!rest) return console.log("Usage: heady embed \"text\"");
        const res = await heady.embed(rest);
        pp(res, { title: "Embedding" });
    },

    async complete() {
        if (!rest) return console.log("Usage: heady complete \"prompt\"");
        const res = await heady.brain.complete(rest);
        pp(res, { title: "Completion" });
    },

    async refactor() {
        if (!rest) return console.log("Usage: heady refactor \"code\"");
        const res = await heady.brain.refactor(rest);
        pp(res, { title: "Refactored" });
    },

    // ── Battle ──
    async battle() {
        if (!rest) return console.log("Usage: heady battle \"change description\"");
        banner("HeadyBattle Arena", "AI-vs-AI Validation");
        const res = await heady.battle.validate(rest);
        pp(res, { title: "Arena Results" });
    },

    // ── Creative ──
    async creative() {
        if (!rest) return console.log("Usage: heady creative \"prompt\"");
        const res = await heady.creative.generate(rest);
        pp(res, { title: "Creative" });
    },

    // ── Lens (Visual Analysis) ──
    async lens() {
        const sub = args[1];
        const actions = new Set(["analyze", "detect", "process"]);
        const action = actions.has(sub) ? sub : "analyze";
        const input = actions.has(sub)
            ? args.slice(2).join(" ").trim()
            : args.slice(1).join(" ").trim();

        if (!input) {
            return console.log("Usage: heady lens <analyze|detect|process> <image_path_or_url>\n       heady lens analyze photo.jpg\n       heady lens detect https://example.com/image.png");
        }

        console.log(`🔍 HeadyLens — ${action}: ${input}`);
        try {
            const url = new URL(heady.baseUrl);
            const host = url.hostname === "headyme.com" ? "127.0.0.1" : url.hostname;
            const isLocalTarget = host === "127.0.0.1" || host === "localhost";
            const useHttps = url.protocol === "https:" && !isLocalTarget;
            const transport = useHttps ? require("https") : require("http");
            const port = url.port || (isLocalTarget ? 3301 : (useHttps ? 443 : 80));

            const body = JSON.stringify({ action, image_url: input });
            const headers = {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
            };
            if (process.env.HEADY_API_KEY) headers["x-api-key"] = process.env.HEADY_API_KEY;

            const requestOptions = {
                hostname: host,
                port,
                path: `/api/lens/${action}`,
                method: "POST",
                headers,
                timeout: 30000,
            };

            if (useHttps) requestOptions.rejectUnauthorized = true;

            const req = transport.request(requestOptions, (res) => {
                let data = "";
                res.on("data", c => data += c);
                res.on("end", () => {
                    try { pp(JSON.parse(data), { title: "Lens Result" }); }
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
        else pp(tools, { title: "MCP Tools" });
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
            pp(stats, { title: "Gateway Stats" });
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
            pp(opts.winRate, { title: "Win Rates" });
            pp(opts.avgLatency, { title: "Avg Latency" });
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
        banner("Heady System Health", `SDK v${pkg.version}`);
        const info = await heady.info();

        section("Connection");
        statusLine("HeadyManager", info.connected ? "active" : "down", info.sdk.url);

        if (info.gateway) {
            const gw = info.gateway;
            section("Gateway");
            kvBox({
                "Providers": gw.providers.length,
                "Total Requests": gw.totalRequests,
                "Cache Hits": gw.cacheHits,
                "Budget (Daily)": `$${gw.budget.spent.daily.toFixed(4)} / $${gw.budget.daily}`,
            });

            if (gw.providers.length > 0) {
                section("Provider Health");
                for (const p of gw.providers) {
                    const h = p.health;
                    statusLine(`${p.name} (${p.serviceGroup})`, h?.healthy ? "active" : "warning",
                        `pri:${p.priority} calls:${h?.totalCalls || 0} avg:${h?.avgLatency || 0}ms`);
                }

                // Bar chart of provider usage
                const provData = gw.providers
                    .filter(p => p.health?.totalCalls > 0)
                    .map(p => ({ label: p.name, value: p.health.totalCalls }));
                if (provData.length > 0) {
                    barChart(provData, { title: "Provider Usage", showPercent: false });
                }

                // Budget progress bar
                section("Budget");
                progressBar("Daily Spend", Math.round(gw.budget.spent.daily * 100) / 100, gw.budget.daily);
                progressBar("Monthly Spend", Math.round(gw.budget.spent.monthly * 100) / 100, gw.budget.monthly);
            }
        }

        if (info.autoSuccess && typeof info.autoSuccess === "object") {
            section("Auto-Success");
            statusLine("Engine", info.autoSuccess.running ? "active" : "warning",
                info.autoSuccess.running ? "cycling" : "stopped");
        }

        console.log();
    },

    async status() {
        banner("Auto-Success Engine");
        const res = await heady.autoSuccess();
        pp(res, { title: "Engine Status" });
    },

    // ── Services — Functional Service Group Discovery ──
    async services() {
        const sub = args[1];
        const filter = args[2];

        // Fetch nodes from registry
        const http = require("http");
        const url = new URL(heady.baseUrl);
        const host = url.hostname === "headyme.com" ? "127.0.0.1" : url.hostname;
        const port = url.port || 3301;

        const fetchRegistry = () => new Promise((resolve, reject) => {
            const req = http.get({ hostname: host, port, path: "/api/registry/components", timeout: 5000 }, (res) => {
                let data = "";
                res.on("data", c => data += c);
                res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
            });
            req.on("error", reject);
            req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
        });

        let nodes;
        try {
            // Try live API first
            const regData = await fetchRegistry();
            if (regData && regData.components) {
                nodes = {};
                regData.components.forEach(c => { nodes[c.id] = c; });
            }
        } catch { /* fallback to local file */ }

        // Fallback: read local registry file
        if (!nodes) {
            const fs = require("fs");
            const path = require("path");
            const candidates = [
                path.join(__dirname, "../../heady-registry.json"),
                path.join(__dirname, "../../../Heady/heady-registry.json"),
                path.resolve(process.cwd(), "heady-registry.json"),
                path.resolve(process.env.HOME || "~", "Heady/heady-registry.json"),
            ];
            let reg;
            for (const p of candidates) {
                try { reg = JSON.parse(fs.readFileSync(p, "utf8")); break; } catch { /* next */ }
            }
            if (!reg) {
                console.error("❌ Cannot read registry. Is Heady Manager running?");
                return;
            }
            nodes = reg.nodes || {};
        }

        const entries = Object.entries(nodes);
        const total = entries.length;

        // Build group map
        const groups = {};
        for (const [id, node] of entries) {
            const g = node.serviceGroup || "ungrouped";
            if (!groups[g]) groups[g] = [];
            groups[g].push({ id, ...node });
        }

        const groupNames = Object.keys(groups).sort();

        if (!sub || sub === "list") {
            banner("Heady Service Groups", `${total} services · ${groupNames.length} groups`);
            for (const g of groupNames) {
                const members = groups[g];
                const active = members.filter(m => m.status === "active").length;
                section(`${g.toUpperCase()} (${active}/${members.length})`);
                for (const m of members) {
                    statusLine(m.id, m.status === "active" ? "active" : "down",
                        `${m.type || ""} · ${m.layer || ""}`);
                }
            }
            section("Group Distribution");
            barChart(groupNames.map(g => ({ label: g, value: groups[g].length })),
                { title: "Members per Group", showPercent: false });
            section("Summary");
            progressBar("Active Services", entries.filter(([, n]) => n.status === "active").length, total);
            console.log();

        } else if (sub === "groups") {
            banner("Service Group Summary", `${groupNames.length} groups`);
            barChart(groupNames.map(g => ({
                label: g, value: groups[g].length,
            })), { title: "Group Sizes", showPercent: false });
            section("Detail Table");
            for (const g of groupNames) {
                const members = groups[g];
                const active = members.filter(m => m.status === "active").length;
                const layers = [...new Set(members.map(m => m.layer || "?"))].join(", ");
                console.log(`  ${C.yellow}${g.padEnd(24)}${C.reset} ${C.cyan}${String(members.length).padEnd(5)}${C.reset} ${C.green}${String(active).padEnd(5)}${C.reset} ${C.dim}${layers}${C.reset}`);
            }
            console.log(`\n  ${C.bold}Total: ${total} services across ${groupNames.length} groups${C.reset}\n`);

        } else if (sub === "inspect") {
            const target = filter || args.slice(2).join(" ");
            if (!target) return console.log("Usage: heady services inspect <group-name>\n  Groups: " + groupNames.join(", "));
            const match = groupNames.find(g => g.toLowerCase() === target.toLowerCase());
            if (!match) { console.log(`❌ Unknown group: "${target}"\n  Available: ${groupNames.join(", ")}`); return; }
            const members = groups[match];
            banner(`Service Group: ${match}`, `${members.length} members`);
            for (const m of members) {
                statusLine(m.name || m.id, m.status === "active" ? "active" : "down",
                    `${m.criticality || "standard"} · v${m.version || "?"} · ${m.layer || "?"}`);
                if (m.source) console.log(`     ${C.dim}Source: ${m.source}${C.reset}`);
            }
            section("Criticality");
            barChart(
                ["critical", "high", "standard"].map(c => ({
                    label: c, value: members.filter(m => (m.criticality || "standard") === c).length
                })).filter(i => i.value > 0),
                { title: "By Criticality", showPercent: false }
            );
            console.log();

        } else if (sub === "health") {
            const active = entries.filter(([, n]) => n.status === "active").length;
            const critical = entries.filter(([, n]) => n.criticality === "critical").length;
            const critActive = entries.filter(([, n]) => n.criticality === "critical" && n.status === "active").length;
            banner("Service Mesh Health", `${total} services`);
            section("Overall");
            progressBar("Active", active, total);
            progressBar("Critical", critActive, critical);
            section("By Group");
            barChart(groupNames.map(g => {
                const members = groups[g];
                return { label: g, value: members.filter(m => m.status === "active").length };
            }), { title: "Active per Group", showPercent: false, maxVal: Math.max(...groupNames.map(g => groups[g].length)) });
            const down = entries.filter(([, n]) => n.criticality === "critical" && n.status !== "active");
            if (down.length > 0) {
                section("⚠️  Inactive Critical");
                down.forEach(([id, n]) => statusLine(id, "down", n.serviceGroup));
            } else {
                console.log(`\n  ${C.green}${C.bold}✅ All critical services operational${C.reset}\n`);
            }
        } else {
            console.log("Usage: heady services [list|groups|inspect <name>|health]");
        }
    },

    // ── Swarm ──
    async swarm() {
        if (!rest) return console.log("Usage: heady swarm \"task description\"\n  Routes the task to HeadySwarm for distributed AI foraging.");
        console.log(`🐝 HeadySwarm — submitting task...`);
        const res = await heady.brain.chat(`[SWARM TASK] ${rest}`);
        const msg = res.response || res.text;
        if (msg) console.log(msg); else pp(res, { title: "Swarm Result" });
    },

    // ── Coding ──
    async code() {
        if (!rest) return console.log("Usage: heady code \"coding task\"\n  Routes to HeadyCoder for ensemble coding orchestration.");
        console.log(`⚡ HeadyCoder — generating...`);
        const res = await heady.brain.chat(`[CODE TASK] ${rest}`);
        const msg = res.response || res.text;
        if (msg) console.log(msg); else pp(res, { title: "Code Result" });
    },

    // ── Simulate ──
    async simulate() {
        if (!rest) return console.log("Usage: heady simulate \"scenario\"\n  Routes to HeadySims for Monte Carlo simulation.");
        console.log(`🎲 HeadySims — simulating...`);
        const res = await heady.brain.analyze(`[SIMULATION] ${rest}`);
        pp(res, { title: "Simulation Result" });
    },

    // ── Governance ──
    async audit() {
        if (!rest) return console.log("Usage: heady audit \"target\"\n  Routes to HeadyGovernance for policy/compliance audit.");
        console.log(`📋 HeadyGovernance — auditing...`);
        const res = await heady.brain.analyze(`[AUDIT] ${rest}`);
        pp(res, { title: "Audit Result" });
    },

    // ── HuggingFace Spaces & Models ──
    async hf() {
        const sub = args[1];
        const target = args.slice(2).join(" ") || rest;
        const token = process.env.HF_TOKEN;

        if (!token) {
            console.log("❌ HF_TOKEN not set. Add it to .env to use Hugging Face features.");
            return;
        }

        if (!sub || sub === "help") {
            banner("HeadyHF — Hugging Face Integration");
            console.log(`
  ${C.bold}COMMANDS${C.reset}

  ${C.yellow}heady hf search "query"${C.reset}     Search HuggingFace models
  ${C.yellow}heady hf info <model-id>${C.reset}     Get model details (e.g. Qwen/Qwen3-235B-A22B)
  ${C.yellow}heady hf infer "prompt"${C.reset}      Run inference via Heady's HF provider
  ${C.yellow}heady hf spaces${C.reset}              List Heady HuggingFace Spaces
  ${C.yellow}heady hf demo${C.reset}                Open/deploy the Heady interactive demo Space
`);
            return;
        }

        if (sub === "search") {
            if (!target || target === "search") return console.log("Usage: heady hf search \"query\"");
            banner("HuggingFace Model Search", target);
            const start = Date.now();
            try {
                const res = await fetch(`https://huggingface.co/api/models?search=${encodeURIComponent(target)}&limit=10&sort=likes&direction=-1`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: AbortSignal.timeout(10000),
                });
                const models = await res.json();
                const ms = Date.now() - start;
                section(`Results (${models.length} models · ${ms}ms)`);
                for (const m of models) {
                    const likes = m.likes || 0;
                    const dl = m.downloads || 0;
                    statusLine(m.id || m.modelId, "active",
                        `❤️ ${likes.toLocaleString()} · ⬇️ ${dl.toLocaleString()} · ${m.pipeline_tag || "?"}`);
                }
                if (models.length > 0) {
                    section("Popularity");
                    barChart(models.slice(0, 8).map(m => ({
                        label: (m.id || m.modelId || "?").split("/").pop().substring(0, 18),
                        value: m.likes || 0,
                    })), { title: "Likes", showPercent: false });
                }
                console.log(`\n  ${C.dim}Tip: heady hf info <model-id> for full details${C.reset}\n`);
            } catch (err) {
                console.error(`❌ Search failed: ${err.message}`);
            }

        } else if (sub === "info") {
            const modelId = args[2] || "Qwen/Qwen3-235B-A22B";
            banner("Model Info", modelId);
            try {
                const res = await fetch(`https://huggingface.co/api/models/${modelId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: AbortSignal.timeout(10000),
                });
                const m = await res.json();
                section("Overview");
                kvBox({
                    "Model": m.id || m.modelId,
                    "Author": m.author || "—",
                    "Pipeline": m.pipeline_tag || "—",
                    "Library": m.library_name || "—",
                    "Likes": (m.likes || 0).toLocaleString(),
                    "Downloads": (m.downloads || 0).toLocaleString(),
                    "Created": m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "—",
                    "Updated": m.lastModified ? new Date(m.lastModified).toLocaleDateString() : "—",
                });
                if (m.tags && m.tags.length > 0) {
                    section("Tags");
                    console.log(`  ${m.tags.slice(0, 15).map(t => `${C.cyan}${t}${C.reset}`).join(" · ")}`);
                }
                if (m.siblings && m.siblings.length > 0) {
                    section(`Files (${m.siblings.length})`);
                    const top = m.siblings.slice(0, 8);
                    for (const f of top) {
                        console.log(`  ${C.dim}📄${C.reset} ${f.rfilename}`);
                    }
                    if (m.siblings.length > 8) console.log(`  ${C.dim}... and ${m.siblings.length - 8} more${C.reset}`);
                }
                console.log(`\n  ${C.dim}🔗 https://huggingface.co/${modelId}${C.reset}\n`);
            } catch (err) {
                console.error(`❌ Info failed: ${err.message}`);
            }

        } else if (sub === "infer") {
            if (!target || target === "infer") return console.log("Usage: heady hf infer \"prompt\"");
            banner("HuggingFace Inference", "Qwen3-235B-A22B via HF Router");
            const start = Date.now();
            try {
                const { InferenceClient } = require("@huggingface/inference");
                const client = new InferenceClient(token);
                const result = await client.chatCompletion({
                    model: "Qwen/Qwen3-235B-A22B",
                    messages: [
                        { role: "system", content: "You are HeadyBrain, the AI reasoning engine of the Heady ecosystem. Be concise and insightful." },
                        { role: "user", content: target },
                    ],
                    temperature: 0.7, max_tokens: 2048,
                });
                const ms = Date.now() - start;
                if (result.choices?.[0]) {
                    section("Response");
                    console.log(`\n  ${result.choices[0].message.content}\n`);
                    section("Metadata");
                    kvBox({
                        "Model": "Qwen3-235B-A22B",
                        "Latency": `${ms}ms`,
                        "Tokens (input)": result.usage?.prompt_tokens || "—",
                        "Tokens (output)": result.usage?.completion_tokens || "—",
                        "Provider": "HuggingFace Router",
                    });
                } else {
                    console.log("⚠️ No response returned.");
                    pp(result);
                }
            } catch (err) {
                console.error(`❌ Inference failed: ${err.message}`);
            }

        } else if (sub === "spaces") {
            banner("Heady HuggingFace Spaces");
            section("Active Spaces");
            statusLine("heady-ai-demo", "active", "Interactive Heady Brain demo");
            console.log(`     ${C.dim}🔗 https://huggingface.co/spaces/HeadyAI/heady-demo${C.reset}`);
            statusLine("heady-service-explorer", "active", "77-service ecosystem explorer");
            console.log(`     ${C.dim}🔗 https://huggingface.co/spaces/HeadyAI/service-explorer${C.reset}`);
            section("Deploy New Space");
            console.log(`  ${C.dim}Use 'heady hf demo' to deploy the interactive demo Space${C.reset}`);
            console.log();

        } else if (sub === "demo") {
            banner("Deploy Heady Demo Space", "HuggingFace Spaces");
            section("Building Space");
            console.log("  📦 Packaging Heady Demo for HuggingFace Spaces...");
            console.log(`  ${C.dim}Space: HeadyAI/heady-demo${C.reset}`);
            console.log(`  ${C.dim}SDK:   static (HTML/JS)${C.reset}`);
            console.log(`  ${C.dim}Theme: Sacred Geometry${C.reset}\n`);

            // Check if space files exist
            const fs = require("fs");
            const path = require("path");
            const spacePath = path.resolve(process.env.HOME || "~", "Heady/heady-hf-space");
            if (fs.existsSync(spacePath)) {
                statusLine("Space Directory", "active", spacePath);
                section("Contents");
                const files = fs.readdirSync(spacePath);
                for (const f of files) {
                    console.log(`  📄 ${f}`);
                }
                console.log(`\n  ${C.bold}To deploy:${C.reset}`);
                console.log(`  ${C.cyan}cd ${spacePath} && git push${C.reset}\n`);
            } else {
                console.log(`  ${C.yellow}Space not yet created.${C.reset}`);
                console.log(`  Run this to initialize:`);
                console.log(`  ${C.cyan}mkdir -p ${spacePath} && cd ${spacePath}${C.reset}\n`);
            }
        } else {
            console.log("Usage: heady hf [search|info|infer|spaces|demo]");
        }
    },

    // ── Intelligence ──
    async brain() {
        if (!rest) return console.log("Usage: heady brain \"deep question\"\n  Routes to HeadyBrain intelligence layer for meta-reasoning.");
        const res = await heady.brain.chat(`[INTELLIGENCE] ${rest}`);
        const msg = res.response || res.text;
        if (msg) console.log(msg); else pp(res, { title: "Brain Result" });
    },

    // ── Help ──
    help() {
        console.log(`
═══════════════════════════════════════════════
  🐝 Heady Hive SDK — v${pkg.version}
  Liquid Unified AI Gateway
═══════════════════════════════════════════════

USAGE
  heady <service-group> "your task"

  Every command routes to a Heady service group. All processing happens within
  the Heady Intelligence Layer. If you omit the group, Heady auto-routes your
  input to the best-matching group.

SERVICE GROUPS

  heady swarm "task"             Distributed AI foraging — multiple worker nodes
                                 race to produce the best result. Ideal for broad
                                 research or multi-perspective tasks.

  heady code "task"              Ensemble coding orchestrator — multi-node code
                                 generation with HeadyBattle validation. Ideal
                                 for refactors, migrations, and test generation.

  heady battle "change"          Adversarial validation — catches regressions,
                                 security issues, and quality problems before
                                 they ship.

  heady creative "prompt"        Creative content via parallel variant generation.
                                 UI designs, copywriting, and visual assets.

  heady simulate "scenario"      Monte Carlo simulation — UCB1-based plan
                                 selection for optimization under uncertainty.

  heady audit "target"           Policy, compliance, and security audits — checks
                                 code placement, secret exposure, and domain
                                 policy enforcement.

  heady brain "question"         Meta-intelligence layer — deep reasoning for
                                 system-level decisions, concept alignment, and
                                 readiness evaluation.

  heady lens <action> <image>    Visual analysis and image processing.
                                 Actions: analyze, detect, process.

  heady decompose "task"         Fan-out/merge — splits complex tasks across all
                                 available nodes with automatic result merging.

MANAGEMENT

  heady services                 List all service groups and their members
  heady services groups          Summary table (count, active, layers)
  heady services inspect <grp>   Deep-inspect a specific group
  heady services health          Quick health report for all services
  heady gateway stats            Provider health, cache, and budget overview
  heady gateway providers        List all registered Heady providers
  heady health                   Full system health check
  heady status                   Auto-success engine status

FLAGS
  --help, -h                     Show this help
  --version, -v                  Show version

ENVIRONMENT
  HEADY_URL                      Heady Manager URL (default: https://headyme.com)
  HEADY_API_KEY                  API authentication key
  HEADY_BUDGET_DAILY             Daily budget cap in USD (default: 10)
  HEADY_BUDGET_MONTHLY           Monthly budget cap in USD (default: 100)
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
            banner("HeadyBrain", "Smart Auto-Route");
            const start = Date.now();
            const res = await heady.brain.chat(fullMessage);
            const ms = Date.now() - start;
            const msg = res.response || res.text;
            section("Response");
            if (msg) console.log(`\n  ${msg}\n`);
            else pp(res, { title: "Response" });
            const eng = res.engine || res.model || "heady-brain";
            console.log(`  ${C.dim || ""}Engine: ${eng} · ${ms}ms${res.cached ? " · cached" : ""}${C.reset || ""}\n`);
            return;
        }

        await COMMANDS[cmd]();
    } catch (err) {
        console.error(`❌ ${err.message}`);
        process.exit(1);
    }
})();
