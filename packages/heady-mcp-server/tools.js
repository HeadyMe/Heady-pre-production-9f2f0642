/**
 * Heady MCP Tools — all service groups + deep research + device control
 */
module.exports = [
    {
        name: "heady_chat",
        description: "Chat with HeadyBrain — routes through the liquid AI gateway for general questions, analysis, and conversation.",
        inputSchema: { type: "object", properties: { message: { type: "string", description: "Your message or question" } }, required: ["message"] },
        handler: async (args, api) => { const r = await api("/api/brain/chat", { message: args.message, model: "auto" }); return r.response || r.text || JSON.stringify(r); },
    },
    {
        name: "heady_deep_research",
        description: "Deep research via multi-provider fan-out — simultaneously queries all available AI providers in their deep/extended research modes, deduplicates and synthesizes results into a unified answer with source attribution and consensus scoring. Superior to single-provider research.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "Research question or topic" },
                providers: { type: "array", items: { type: "string" }, description: "Specific providers to use (optional — defaults to all available)" },
                depth: { type: "string", enum: ["standard", "deep", "exhaustive"], description: "Research depth level (default: deep)" },
                max_wait_ms: { type: "number", description: "Maximum wait time in ms before returning partial results (default: 60000)" },
            },
            required: ["query"],
        },
        handler: async (args, api) => {
            const r = await api("/api/buddy/deep-research", {
                query: args.query,
                providers: args.providers || "all",
                depth: args.depth || "deep",
                maxWaitMs: args.max_wait_ms || 60000,
            });
            return r.response || r.text || JSON.stringify(r);
        },
    },
    {
        name: "heady_swarm",
        description: "Distributed AI foraging — multiple worker nodes race to produce the best result. Ideal for broad research or multi-perspective tasks.",
        inputSchema: { type: "object", properties: { task: { type: "string", description: "Task to distribute across swarm nodes" } }, required: ["task"] },
        handler: async (args, api) => { const r = await api("/api/brain/chat", { message: `[SWARM TASK] ${args.task}`, model: "auto" }); return r.response || r.text || JSON.stringify(r); },
    },
    {
        name: "heady_code",
        description: "Ensemble coding orchestrator — multi-node code generation with HeadyBattle validation. Ideal for refactors, migrations, and test generation.",
        inputSchema: { type: "object", properties: { task: { type: "string", description: "Coding task description" }, language: { type: "string", description: "Programming language (optional)" } }, required: ["task"] },
        handler: async (args, api) => { const lang = args.language ? ` (language: ${args.language})` : ""; const r = await api("/api/brain/chat", { message: `[CODE TASK]${lang} ${args.task}`, model: "auto" }); return r.response || r.text || JSON.stringify(r); },
    },
    {
        name: "heady_battle",
        description: "Adversarial validation — catches regressions, security issues, and quality problems before they ship.",
        inputSchema: { type: "object", properties: { change: { type: "string", description: "Code or change to validate" } }, required: ["change"] },
        handler: async (args, api) => { const r = await api("/api/brain/chat", { message: `[BATTLE] ${args.change}`, model: "auto" }); return r.response || r.text || JSON.stringify(r); },
    },
    {
        name: "heady_creative",
        description: "Creative content via parallel variant generation — UI designs, copywriting, and visual assets.",
        inputSchema: { type: "object", properties: { prompt: { type: "string", description: "Creative prompt" } }, required: ["prompt"] },
        handler: async (args, api) => { const r = await api("/api/brain/chat", { message: `[CREATIVE] ${args.prompt}`, model: "auto" }); return r.response || r.text || JSON.stringify(r); },
    },
    {
        name: "heady_simulate",
        description: "Monte Carlo simulation — UCB1-based plan selection for optimization under uncertainty.",
        inputSchema: { type: "object", properties: { scenario: { type: "string", description: "Scenario to simulate" } }, required: ["scenario"] },
        handler: async (args, api) => { const r = await api("/api/brain/analyze", { content: `[SIMULATION] ${args.scenario}` }); return r.response || r.text || JSON.stringify(r); },
    },
    {
        name: "heady_audit",
        description: "Policy, compliance, and security audits — checks code placement, secret exposure, and domain policy enforcement.",
        inputSchema: { type: "object", properties: { target: { type: "string", description: "Code or system to audit" } }, required: ["target"] },
        handler: async (args, api) => { const r = await api("/api/brain/analyze", { content: `[AUDIT] ${args.target}` }); return r.response || r.text || JSON.stringify(r); },
    },
    {
        name: "heady_brain",
        description: "Meta-intelligence layer — deep reasoning for system-level decisions, concept alignment, and readiness evaluation.",
        inputSchema: { type: "object", properties: { question: { type: "string", description: "Deep question for meta-reasoning" } }, required: ["question"] },
        handler: async (args, api) => { const r = await api("/api/brain/chat", { message: `[INTELLIGENCE] ${args.question}`, model: "auto" }); return r.response || r.text || JSON.stringify(r); },
    },
    {
        name: "heady_analyze",
        description: "Analyze code, text, or data using the Heady AI ensemble.",
        inputSchema: { type: "object", properties: { content: { type: "string", description: "Content to analyze" }, focus: { type: "string", description: "Specific focus area (optional)" } }, required: ["content"] },
        handler: async (args, api) => { const focus = args.focus ? ` Focus: ${args.focus}` : ""; const r = await api("/api/brain/analyze", { content: args.content + focus }); return r.response || r.text || JSON.stringify(r); },
    },
    {
        name: "heady_memory_search",
        description: "Search Buddy's persistent 3D vector memory — retrieves semantically relevant context from past interactions, decisions, and learned patterns.",
        inputSchema: { type: "object", properties: { query: { type: "string", description: "Search query" }, limit: { type: "number", description: "Max results (default: 5)" } }, required: ["query"] },
        handler: async (args, api) => {
            const r = await api("/api/vector/query", { query: args.query, top_k: args.limit || 5 });
            return JSON.stringify(r, null, 2);
        },
    },
    {
        name: "heady_memory_store",
        description: "Store information in Buddy's persistent 3D vector memory — remembered across sessions and devices.",
        inputSchema: { type: "object", properties: { content: { type: "string", description: "Content to remember" }, type: { type: "string", description: "Memory type (e.g., insight, decision, learning, fact)" } }, required: ["content"] },
        handler: async (args, api) => {
            const r = await api("/api/vector/store", { content: args.content, metadata: { type: args.type || "memory", ts: Date.now(), source: "mcp-tool" } });
            return JSON.stringify(r, null, 2);
        },
    },
    {
        name: "heady_buddy_decide",
        description: "Route a decision through Buddy Core — the sovereign orchestrator with metacognitive awareness, task locks, and φ-scaled routing.",
        inputSchema: {
            type: "object",
            properties: {
                action: { type: "string", description: "Action to perform" },
                payload: { type: "object", description: "Action payload" },
                live: { type: "boolean", description: "Enable live/realtime orchestration" },
            },
            required: ["action"],
        },
        handler: async (args, api) => {
            const r = await api("/api/buddy/decide", { action: args.action, payload: args.payload || {}, live: args.live || false });
            return JSON.stringify(r, null, 2);
        },
    },
    {
        name: "heady_buddy_status",
        description: "Get Buddy Core system status — metacognitive health, decision count, active locks, wiring status.",
        inputSchema: { type: "object", properties: {} },
        handler: async (args, api) => {
            const http = require("http");
            const url = process.env.HEADY_URL || "http://127.0.0.1:3301";
            return new Promise((resolve) => {
                http.get(`${url}/api/buddy/status`, (res) => {
                    let d = ""; res.on("data", c => d += c);
                    res.on("end", () => resolve(d));
                }).on("error", e => resolve(`Offline: ${e.message}`));
            });
        },
    },
    {
        name: "heady_health",
        description: "Check Heady system health — service status, uptime, memory, and provider availability.",
        inputSchema: { type: "object", properties: {} },
        handler: async (args, api) => {
            const http = require("http");
            const url = process.env.HEADY_URL || "http://127.0.0.1:3301";
            return new Promise((resolve) => {
                http.get(`${url}/api/pulse`, (res) => {
                    let d = ""; res.on("data", c => d += c);
                    res.on("end", () => resolve(d));
                }).on("error", e => resolve(`Offline: ${e.message}`));
            });
        },
    },
];
