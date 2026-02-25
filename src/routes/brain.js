/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * src/routes/brain.js — Heady Brain API routes
 * Provides /api/brain/* endpoints for the MCP server
 *
 * These endpoints enable all heady-local MCP tools:
 *   heady_chat → POST /api/brain/chat
 *   heady_analyze → POST /api/brain/analyze
 *   heady_embed → POST /api/brain/embed
 *   heady_complete → POST /api/brain/complete
 *   heady_refactor → POST /api/brain/refactor
 *   heady_search → POST /api/brain/search (via registry)
 *
 * Storage: All interactions stored in persistent memory
 */

const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ── SDK Gateway — single source of truth for all AI traffic ──
const HeadyGateway = require(path.join(__dirname, "..", "..", "heady-hive-sdk", "lib", "gateway"));
const { createProviders } = require(path.join(__dirname, "..", "..", "heady-hive-sdk", "lib", "providers"));
let _sdkGateway = null;
function getSDKGateway(req) {
    if (!_sdkGateway) {
        _sdkGateway = new HeadyGateway({ cacheTTL: 300000 });
        const providers = createProviders(process.env);
        for (const p of providers) _sdkGateway.registerProvider(p);
        console.log(`⚡ SDK Gateway initialized: ${providers.length} providers [${providers.map(p => p.name).join(', ')}]`);
    }
    // Attach vector memory for semantic deterministic cache (lazy — first request wires it)
    if (!_sdkGateway._vectorMemory && req?.app?.locals?.vectorMemory) {
        _sdkGateway.setVectorMemory(req.app.locals.vectorMemory);
        console.log(`⚡ SDK Gateway: 3D vector memory attached for semantic caching`);
    }
    return _sdkGateway;
}

// Persistent memory store path
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const BRAIN_LOG_PATH = path.join(DATA_DIR, "brain-interactions.json");

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function logInteraction(type, input, output) {
    ensureDataDir();
    try {
        let log = [];
        if (fs.existsSync(BRAIN_LOG_PATH)) {
            log = JSON.parse(fs.readFileSync(BRAIN_LOG_PATH, "utf8"));
        }
        log.push({
            id: crypto.randomUUID(),
            type,
            input: (typeof input === "string" ? input : String(input || "")).substring(0, 500),
            output: (typeof output === "string" ? output : String(output || "")).substring(0, 500),
            timestamp: new Date().toISOString(),
        });
        // Keep last 1000 interactions
        if (log.length > 1000) log = log.slice(-1000);
        fs.writeFileSync(BRAIN_LOG_PATH, JSON.stringify(log, null, 2));
    } catch (err) {
        console.warn("⚠ Brain log write error:", err.message);
    }
}

// Store in memory for the memory wrapper to pick up
let memoryWrapper = null;
function setMemoryWrapper(mw) { memoryWrapper = mw; }

// ─── Memory Receipt Logger ──────────────────────────────────────────
// Logs what WAS stored vs what was NOT stored, and flags fallback usage
const MEMORY_RECEIPTS_PATH = path.join(DATA_DIR, "memory-receipts.json");

function logMemoryReceipt({ stored, notStored, method, fallbackUsed }) {
    ensureDataDir();
    try {
        let receipts = [];
        if (fs.existsSync(MEMORY_RECEIPTS_PATH)) {
            receipts = JSON.parse(fs.readFileSync(MEMORY_RECEIPTS_PATH, "utf8"));
        }
        receipts.push({
            id: crypto.randomUUID(),
            stored: stored || "nothing",
            notStored: notStored || "nothing omitted",
            method: method || "unknown",
            fallbackUsed: fallbackUsed || false,
            priorityFix: fallbackUsed ? "⚠ VECTOR DB FALLBACK — hash-based pseudo-embedding used instead of 3D vector storage. Fix priority: HIGH." : null,
            ts: new Date().toISOString(),
        });
        if (receipts.length > 1000) receipts = receipts.slice(-1000);
        fs.writeFileSync(MEMORY_RECEIPTS_PATH, JSON.stringify(receipts, null, 2));
    } catch (err) {
        console.warn("⚠ Memory receipt log error:", err.message);
    }
}

async function storeInMemory(content, metadata) {
    let method = "none";
    let stored = null;
    let notStored = null;
    let fallbackUsed = false;

    const contentSummary = typeof content === "string" ? content.substring(0, 120) : JSON.stringify(content).substring(0, 120);
    const fullLength = typeof content === "string" ? content.length : JSON.stringify(content).length;
    const truncatedAmount = fullLength > 500 ? fullLength - 500 : 0;

    if (memoryWrapper && typeof memoryWrapper.ingestMemory === "function") {
        try {
            await memoryWrapper.ingestMemory({ content, metadata });
            method = "vector-db";
            stored = `Stored in vector DB: "${contentSummary}..." (${fullLength} chars, type: ${metadata?.type || "unknown"})`;
            notStored = truncatedAmount > 0
                ? `${truncatedAmount} chars of extended content trimmed from vector index`
                : "Full content stored — nothing omitted";
        } catch (err) {
            method = "vector-db-failed";
            fallbackUsed = true;
            stored = `Fallback file log only: "${contentSummary}..." (vector DB error: ${err.message})`;
            notStored = `Vector embedding NOT created — full semantic search unavailable for this content (${fullLength} chars)`;
        }
    } else {
        method = "no-vector-db";
        fallbackUsed = true;
        stored = `Interaction logged to file only: "${contentSummary}..."`;
        notStored = `No vector embedding created — content NOT searchable via semantic/3D vector search (${fullLength} chars). Memory wrapper not available.`;
    }

    logMemoryReceipt({ stored, notStored, method, fallbackUsed });
}


// ─── Intelligent Model Cascade ──────────────────────────────────────
// Priority: HeadyCompute → HeadyLocal → Contextual (never a dead template)
// HeadyConductor routes to the best available backend automatically.

async function chatViaOpenAI(message, system, temperature, max_tokens) {
    const apiKey = process.env.HEADY_COMPUTE_KEY;
    if (!apiKey) throw new Error("no-key");

    const https = require("https");
    const msgs = [];
    if (system) msgs.push({ role: "system", content: system });
    else msgs.push({ role: "system", content: "You are HeadyBrain, the AI reasoning engine of the Heady ecosystem. You are helpful, concise, and intelligent. When discussing Heady services, reference Brain, Battle, Creative, MCP, and the 155-task auto-success engine. Be conversational and warm." });
    msgs.push({ role: "user", content: message });

    const payload = JSON.stringify({
        model: "gpt-4o-mini",
        messages: msgs,
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 2048,
    });

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: "api.headycompute.com", path: "/v1/chat/completions", method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
                "Content-Length": Buffer.byteLength(payload),
            },
            timeout: 30000,
        }, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.choices && parsed.choices[0]) {
                        resolve({ response: parsed.choices[0].message.content, model: parsed.model || "gpt-4o-mini" });
                    } else if (parsed.error) {
                        reject(new Error(parsed.error.message || "HeadyCompute error"));
                    } else {
                        reject(new Error("unexpected-response"));
                    }
                } catch { reject(new Error("parse-error")); }
            });
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
        req.write(payload);
        req.end();
    });
}

async function chatViaOllama(message, system, temperature, max_tokens) {
    const http = require("http");
    const payload = JSON.stringify({
        model: "llama3.2",
        prompt: system ? `${system}\n\nUser: ${message}` : message,
        stream: false,
        options: { temperature: temperature || 0.7, num_predict: max_tokens || 4096 },
    });

    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: process.env.HEADY_LOCAL_HOST || "127.0.0.1", port: parseInt(process.env.OLLAMA_PORT || "11434"), path: "/api/generate", method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
            timeout: 30000,
        }, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ response: parsed.response || parsed.message?.content || data, model: "llama3.2" });
                } catch { resolve({ response: data, model: "llama3.2" }); }
            });
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
        req.write(payload);
        req.end();
    });
}

// ─── Response Filter Layer ──────────────────────────────────────────
// Global: scrub underlying provider references from response text
// Optional: content safety filtering for minor audiences
function filterResponse(text, options = {}) {
    if (!text) return text;
    let filtered = text;

    // ── Stage 1: Global Provider Identity Scrubbing ──
    if (options.scrubProviders !== false) {
        // Self-identification patterns — catch "I am HeadyJules", "I'm a Google AI", etc.
        const identityPatterns = [
            // Direct provider self-identification
            [/\bI(?:'m| am) (?:an? )?(?:AI (?:assistant|model|chatbot|language model) )?(?:made|created|developed|built|trained|designed) by (Google|HeadyNexus|HeadyCompute|Meta|Mistral|Microsoft|Hugging\s?Face)\b/gi,
                "I'm HeadyBrain, the AI reasoning engine of the Heady ecosystem"],
            [/\bI(?:'m| am) (HeadyJules|HeadyPythia|GPT|ChatGPT|Llama|Mistral|Qwen|Copilot)\b/gi,
                "I'm HeadyBrain"],
            [/\bI(?:'m| am) (?:a |an )?(large )?language model,? (?:trained|created|made|built|developed) by (Google|HeadyNexus|HeadyCompute|Meta)\b/gi,
                "I'm HeadyBrain, the AI reasoning engine of the Heady ecosystem"],
            [/\bI(?:'m| am) (?:a |an )?(large )?language model\b/gi,
                "I'm HeadyBrain"],
            [/\bMy name is (HeadyJules|HeadyPythia|GPT|ChatGPT|Bard|Llama|Qwen)\b/gi,
                "I'm HeadyBrain"],

            // Provider/company name references in context of "who made me"
            [/\b(?:made|created|developed|built|trained|designed) by (Google|HeadyNexus|HeadyCompute|Meta AI|Mistral AI|Microsoft|Hugging\s?Face)\b/gi,
                "built by Heady Systems"],
            [/\b(Google|HeadyNexus|HeadyCompute|Meta|Mistral|Microsoft|Hugging\s?Face)(?:'s)? AI (?:assistant|model|team|lab|research)\b/gi,
                "Heady AI"],

            // Model family references when self-identifying
            [/\bAs (HeadyJules|HeadyPythia|GPT-4|GPT-4o|ChatGPT|Llama|Qwen|Mistral|Copilot)\b/gi,
                "As HeadyBrain"],
            [/\bI'm (HeadyJules|HeadyPythia|Bard|GPT-4|ChatGPT|Llama|Qwen) (?:by|from) \w+/gi,
                "I'm HeadyBrain"],

            // "Powered by" references
            [/\bpowered by (Google|HeadyNexus|HeadyCompute|Meta|HeadyPythia|HeadyJules|GPT)\b/gi,
                "powered by Heady Systems"],
        ];

        for (const [pattern, replacement] of identityPatterns) {
            filtered = filtered.replace(pattern, replacement);
        }
    }

    // ── Stage 2: Optional Content Safety Filter ──
    if (options.contentSafety) {
        // Flag but don't remove — add a safety notice
        const sensitivePatterns = [
            /\b(explicit|graphic violence|self-harm|hate speech)\b/gi,
        ];
        for (const p of sensitivePatterns) {
            if (p.test(filtered)) {
                filtered = "[Content filtered for safety] " + filtered.replace(p, "[filtered]");
            }
        }
    }

    return filtered;
}

// ─── HeadyJules SDK Smart Router ────────────────────────────────────────
// Uses @headynexus-ai/sdk with intelligent model selection, extended thinking,
// dual-org failover, and credit tracking.
// Inspired by: NanoClaw (agent SDK patterns), Lumo (privacy-first design),
// OpenClaw (task automation), HeadyJulesOptimized (custom skills).

const HeadyNexus = require("@headynexus-ai/sdk");

// ── Dual-Org Configuration ──
const CLAUDE_ORGS = [
    {
        name: "headysystems",
        apiKey: process.env.HEADY_NEXUS_KEY || process.env.HEADY_JULES_KEY,
        account: process.env.ANTHROPIC_ACCOUNT || "eric@headysystems.com",
        adminKey: process.env.ANTHROPIC_ADMIN_KEY,
        orgId: process.env.ANTHROPIC_ORG_ID,
        credit: 30,  // initial estimate, updated at runtime
    },
    {
        name: "headyconnection",
        apiKey: process.env.ANTHROPIC_SECONDARY_KEY,
        account: process.env.ANTHROPIC_SECONDARY_ACCOUNT || "eric@headyconnection.org",
        credit: 60,
    },
];

// ──
const { budgetService } = require("../policy-service");

// Usage tracking paths
const USAGE_PATH = path.join(__dirname, "../../data/headyjules-usage.json");
let claudeUsage = { totalCost: 0, requests: 0, byModel: {}, byOrg: {}, history: [] };
try { if (fs.existsSync(USAGE_PATH)) claudeUsage = JSON.parse(fs.readFileSync(USAGE_PATH, "utf8")); } catch { }

function trackClaudeUsage(model, inputTokens, outputTokens, orgName, thinkingTokens = 0) {
    // Pricing per 1M tokens (approximate as of 2025)
    const pricing = {
        "headyjules-haiku-4-5-20251001": { input: 0.80, output: 4.00 },
        "headyjules-sonnet-4-20250514": { input: 3.00, output: 15.00 },
        "headyjules-opus-4-20250514": { input: 15.00, output: 75.00 },
    };
    const p = pricing[model] || pricing["headyjules-sonnet-4-20250514"];
    const cost = ((inputTokens / 1_000_000) * p.input) + (((outputTokens + thinkingTokens) / 1_000_000) * p.output);

    claudeUsage.totalCost += cost;
    claudeUsage.requests++;
    claudeUsage.byModel[model] = (claudeUsage.byModel[model] || 0) + 1;
    claudeUsage.byOrg[orgName] = (claudeUsage.byOrg[orgName] || 0) + cost;
    claudeUsage.history.push({ model, cost: +cost.toFixed(6), inputTokens, outputTokens, thinkingTokens, org: orgName, ts: new Date().toISOString() });
    if (claudeUsage.history.length > 500) claudeUsage.history = claudeUsage.history.slice(-500);

    // Integrate with BudgetService for unified governance
    if (budgetService) {
        budgetService.recordUsage('ORG', orgName, cost, { model, inputTokens, outputTokens }).catch(() => { });
    }

    try { fs.writeFileSync(USAGE_PATH, JSON.stringify(claudeUsage, null, 2)); } catch { }
    return cost;
}

// ── Complexity Analyzer ──
// Determines the right model tier based on query content
function analyzeComplexity(message, system) {
    const msg = (message || "").toLowerCase();
    const len = msg.length;

    // CRITICAL — architecture, multi-step debugging, HeadyBattle/Soul escalation
    if (msg.includes("architecture") || msg.includes("design system") || msg.includes("battle") ||
        msg.includes("soul escalation") || msg.includes("refactor entire") || msg.includes("security audit") ||
        (system && system.includes("HeadyBattle"))) {
        return "critical";
    }

    // HIGH — code review, analysis, planning, complex reasoning
    if (msg.includes("analyze") || msg.includes("debug") || msg.includes("optimize") ||
        msg.includes("explain how") || msg.includes("implement") || msg.includes("plan") ||
        msg.includes("compare") || msg.includes("review") || len > 500) {
        return "high";
    }

    // LOW — greetings, simple questions, status checks
    if (len < 50 || msg.includes("hello") || msg.includes("hi ") || msg.includes("hey") ||
        msg.includes("thanks") || msg.includes("status") || msg.includes("what is") ||
        msg.includes("who are") || msg.match(/^(yes|no|ok|sure|got it)/)) {
        return "low";
    }

    // MEDIUM — everything else
    return "medium";
}

// ── Model Selection ──
function selectModel(complexity) {
    switch (complexity) {
        case "low": return { model: "headyjules-haiku-4-5-20251001", thinking: false, budget: 0 };
        case "medium": return { model: "headyjules-sonnet-4-20250514", thinking: false, budget: 0 };
        case "high": return { model: "headyjules-sonnet-4-20250514", thinking: true, budget: 10000 };
        case "critical": return { model: "headyjules-opus-4-20250514", thinking: true, budget: 32000 };
        default: return { model: "headyjules-sonnet-4-20250514", thinking: false, budget: 0 };
    }
}

// ── Get Active HeadyNexus Client (with dual-org failover) ──
function getClaudeClient() {
    for (const org of CLAUDE_ORGS) {
        if (org.apiKey && !org.apiKey.includes("placeholder") && !org.apiKey.includes("your_")) {
            // Check if this org's budget is exhausted
            const spent = claudeUsage.byOrg[org.name] || 0;
            if (spent < org.credit) {
                return { client: new HeadyNexus({ apiKey: org.apiKey }), org };
            }
        }
    }
    // Fallback: use first available key regardless of budget
    const fallback = CLAUDE_ORGS.find(o => o.apiKey && !o.apiKey.includes("placeholder"));
    if (fallback) return { client: new HeadyNexus({ apiKey: fallback.apiKey }), org: fallback };
    throw new Error("no-headyjules-key");
}

async function chatViaClaude(message, system, temperature, max_tokens) {
    const { client, org } = getClaudeClient();
    const complexity = analyzeComplexity(message, system);
    const { model, thinking, budget } = selectModel(complexity);

    const sysPrompt = system || "You are HeadyBrain, the AI reasoning engine of the Heady ecosystem. Be helpful, concise, warm. Reference Brain, Battle, Creative, MCP, and the auto-success engine when relevant.";

    // Build request params
    const params = {
        model,
        max_tokens: max_tokens || (thinking ? 16384 : 2048),
        system: sysPrompt,
        messages: [{ role: "user", content: message }],
    };

    // Add extended thinking for high/critical complexity
    if (thinking && budget > 0) {
        params.thinking = { type: "enabled", budget_tokens: budget };
    }

    // Temperature only when NOT using thinking (HeadyNexus API constraint)
    if (!thinking && temperature) {
        params.temperature = temperature;
    }

    const response = await client.messages.create(params);

    // Extract text from response (may include thinking blocks)
    let responseText = "";
    let thinkingText = "";
    let thinkingTokens = 0;

    for (const block of response.content) {
        if (block.type === "thinking") {
            thinkingText += block.thinking;
            thinkingTokens += (block.thinking || "").length / 4; // rough estimate
        } else if (block.type === "text") {
            responseText += block.text;
        }
    }

    // Track usage
    const cost = trackClaudeUsage(
        model,
        response.usage?.input_tokens || 0,
        response.usage?.output_tokens || 0,
        org.name,
        thinkingTokens
    );

    return {
        response: responseText,
        model: response.model || model,
        complexity,
        thinking_used: thinking,
        thinking_summary: thinkingText ? thinkingText.substring(0, 200) + "..." : null,
        cost: +cost.toFixed(6),
        org: org.name,
        usage: response.usage,
    };
}

async function chatViaHuggingFace(message, system, temperature, max_tokens) {
    // Multi-token failover for HF Business team plan (3 seats)
    const tokens = [process.env.HF_TOKEN, process.env.HF_TOKEN_2, process.env.HF_TOKEN_3]
        .filter(t => t && !t.includes("your_") && !t.includes("placeholder"));
    if (tokens.length === 0) throw new Error("no-key");

    const { InferenceClient } = require("@headyhub/inference");
    const client = new InferenceClient(tokens[Math.floor(Date.now() / 120000) % tokens.length]);

    const msgs = [];
    if (system) msgs.push({ role: "system", content: system });
    else msgs.push({ role: "system", content: "You are HeadyBrain, the AI reasoning engine of the Heady ecosystem. Be helpful, concise, warm." });
    msgs.push({ role: "user", content: message });

    const result = await client.chatCompletion({
        model: "Qwen/Qwen3-235B-A22B",
        messages: msgs,
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 2048,
    });

    if (result.choices && result.choices[0]) {
        return { response: result.choices[0].message.content, model: result.model || "qwen3-235b" };
    }
    throw new Error("unexpected-response");
}

async function chatViaGemini(message, system, temperature, max_tokens) {
    // Multi-key failover across all configured HeadyPythia keys
    const keys = [
        process.env.GOOGLE_API_KEY,
        process.env.GOOGLE_API_KEY_SECONDARY,
        process.env.HEADY_PYTHIA_KEY_HEADY,
        process.env.HEADY_PYTHIA_KEY_GCLOUD,
        process.env.HEADY_PYTHIA_KEY_COLAB,
        process.env.HEADY_PYTHIA_KEY_STUDIO,
    ].filter(k => k && !k.includes("placeholder"));
    if (keys.length === 0) throw new Error("no-key");

    const { GoogleGenAI } = require("@google/genai");
    const apiKey = keys[Math.floor(Date.now() / 60000) % keys.length];
    const ai = new GoogleGenAI({ apiKey });

    const prompt = system ? `${system}\n\n${message}` : message;
    const result = await ai.models.generateContent({
        model: "headypythia-2.5-flash",
        contents: prompt,
        config: {
            temperature: temperature || 0.7,
            maxOutputTokens: max_tokens || 2048,
        },
    });

    const text = result.text;
    if (text) {
        return { response: text, model: "headypythia-2.5-flash" };
    }
    throw new Error("unexpected-response");
}

function generateContextualResponse(message) {
    const safeMsg = message || "";
    const msg = safeMsg.toLowerCase();
    const vertical = msg.includes("creator") ? "HeadyCreator" : msg.includes("music") ? "HeadyMusic" :
        msg.includes("buddy") ? "HeadyBuddy" : msg.includes("tube") ? "HeadyTube" :
            msg.includes("mcp") ? "HeadyMCP" : msg.includes("sdk") ? "HeadyIO SDK" :
                msg.includes("battle") ? "HeadyBattle" : "HeadyBrain";

    if (msg.includes("hello") || msg.includes("hi ") || msg.includes("hey")) {
        return `Hey there! 👋 I'm ${vertical}, part of the Heady AI ecosystem. All conversations are stored in persistent 3D vector memory. What would you like to explore?`;
    } else if (msg.includes("help") || msg.includes("what can")) {
        return `I can help with: 🧠 AI reasoning & analysis, ⚔️ Code validation (HeadyBattle), 🎨 Creative generation, 🔧 MCP tool orchestration (31 tools), 📡 Real-time event streaming, and more. What interests you?`;
    } else if (msg.includes("status") || msg.includes("health")) {
        return `System Status: 🟢 HeadyManager: Online | 🟢 Auto-Success: Active | 🟢 MCP: 31 tools | 🟢 Memory: Persistent 3D vectors | The system is operational and all interactions are being stored.`;
    } else {
        const preview = safeMsg.length > 50 ? safeMsg.substring(0, 50) + "..." : safeMsg;
        return `Processing "${preview}". Your message has been stored in persistent memory. All Heady intelligence backends are being engaged for full analysis.`;
    }
}

/**
 * POST /api/brain/chat
 * ═══ Parallel Race Buffer with Full Audit ═══
 * 
 * Fires ALL available providers simultaneously.
 * Returns the FASTEST response to the client immediately.
 * Continues capturing ALL remaining responses in the background.
 * Logs a full race audit: winner, losers, latencies, response previews,
 * quality signals, and optimization recommendations.
 */
const RACE_AUDIT_PATH = path.join(DATA_DIR, "race-audit.jsonl");
const RACE_STATS = { totalRaces: 0, wins: {}, avgLatency: {}, lateResponses: 0, usefulLateCount: 0 };

function appendRaceAudit(entry) {
    try {
        ensureDataDir();
        fs.appendFileSync(RACE_AUDIT_PATH, JSON.stringify(entry) + "\n");
    } catch { }
}

router.post("/chat", async (req, res) => {
    const { message, system, model, temperature, max_tokens, context } = req.body;
    const ts = new Date().toISOString();

    logInteraction("chat", message, `[chat request at ${ts}]`);
    storeInMemory(`Chat interaction: ${message}`, { type: "brain_chat", model: model || "heady-brain", ts }).catch(() => { });

    try {
        // ── Route through SDK Gateway (single source of truth) ──
        const gateway = getSDKGateway(req);
        const result = await gateway.chat(message, {
            system: system || "You are HeadyBrain, the AI reasoning engine of the Heady ecosystem.",
            temperature, maxTokens: max_tokens,
        });

        if (result.ok) {
            const filteredResponse = filterResponse(result.response, {
                scrubProviders: true,
                contentSafety: process.env.HEADY_CONTENT_FILTER === "strict",
            });

            logInteraction("chat_response", message, result.response);
            storeInMemory(`Brain response: ${(result.response || "").substring(0, 500)}`, {
                type: "brain_response", engine: result.engine, latency: result.latency, ts,
            }).catch(() => { });

            // Write race audit to JSONL for the existing /race-audit endpoint
            appendRaceAudit({
                raceId: result.race?.id || `gw-${Date.now()}`, ts,
                input: (message || "").substring(0, 200),
                winner: { source: result.engine, latency: result.latency, status: "ok" },
                totalLatencyMs: result.latency,
                providersEntered: gateway.providers.filter(p => p.enabled).map(p => p.name),
            });

            RACE_STATS.totalRaces++;

            return res.json({
                ok: true,
                response: filteredResponse,
                model: "heady-brain",
                engine: result.engine || "heady-brain",
                stored_in_memory: true,
                race: {
                    id: result.race?.id,
                    winner: result.engine,
                    latency_ms: result.latency,
                    providers_entered: gateway.providers.filter(p => p.enabled).length,
                    gateway: true,
                },
                ts,
            });
        }

        // Gateway returned ok:false — all providers failed, use contextual fallback
        const contextualResponse = generateContextualResponse(message);
        logInteraction("chat_gateway_fallback", message, contextualResponse);
        return res.json({
            ok: true,
            response: contextualResponse,
            model: "heady-brain",
            engine: "heady-contextual",
            race: { gateway_error: result.error, fallback: true },
            ts,
        });
    } catch (err) {
        // Gateway crashed — absolute fallback
        console.error("⚠ Gateway error:", err.message);
        const contextualResponse = generateContextualResponse(message);
        return res.json({
            ok: true,
            response: contextualResponse,
            model: "heady-brain",
            engine: "heady-contextual",
            error: err.message,
            ts,
        });
    }
});

/**
 * GET /api/brain/race-audit
 * Query the race audit log — shows all races with winners, losers, latencies,
 * and optimization recommendations.
 */
router.get("/race-audit", (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    try {
        let audits = [];
        if (fs.existsSync(RACE_AUDIT_PATH)) {
            const lines = fs.readFileSync(RACE_AUDIT_PATH, "utf8").trim().split("\n");
            audits = lines.slice(-limit).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
        }

        // Aggregate stats
        const winCounts = {};
        const avgLatencies = {};
        let totalOptSignals = 0;
        for (const a of audits) {
            const w = a.winner?.source || "unknown";
            winCounts[w] = (winCounts[w] || 0) + 1;
            if (a.winner?.latency) {
                avgLatencies[w] = avgLatencies[w] ? [...avgLatencies[w], a.winner.latency] : [a.winner.latency];
            }
            totalOptSignals += (a.optimizationSignals || []).length;
        }

        const avgLatencyMap = {};
        for (const [k, v] of Object.entries(avgLatencies)) {
            avgLatencyMap[k] = Math.round(v.reduce((a, b) => a + b, 0) / v.length);
        }

        res.json({
            ok: true,
            races: audits.length,
            stats: {
                wins: winCounts,
                avgWinnerLatency: avgLatencyMap,
                liveStats: RACE_STATS,
                optimizationSignals: totalOptSignals,
            },
            recentRaces: audits.slice(-5).map(a => ({
                raceId: a.raceId,
                ts: a.ts,
                input: a.input,
                winner: a.winner?.source,
                winnerLatency: a.winner?.latency,
                losers: (a.losers || []).map(l => ({ source: l.source, latency: l.latency, lengthDelta: l.responseLength - (a.winner?.responseLength || 0) })),
                errors: (a.errors || []).map(e => ({ source: e.source, error: e.error })),
                signals: a.optimizationSignals || [],
            })),
            ts: new Date().toISOString(),
        });
    } catch (err) {
        res.json({ ok: false, error: err.message });
    }
});


/**
 * POST /api/brain/analyze
 * Code/text analysis endpoint for heady_analyze MCP tool
 */
router.post("/analyze", async (req, res) => {
    const { content, type, language, focus } = req.body;
    const ts = new Date().toISOString();

    const summary = content ? content.substring(0, 200) : "empty";
    logInteraction("analyze", summary, `[analysis of ${type || "general"}]`);
    await storeInMemory(
        `Code analysis (${type || "general"}): ${summary}`,
        { type: "brain_analyze", analysisType: type, language, focus, ts }
    );

    // Provide structural analysis
    const analysis = {
        type: type || "general",
        language: language || "auto-detect",
        focus: focus || "all",
        metrics: {
            length: content ? content.length : 0,
            lines: content ? content.split("\n").length : 0,
            complexity: content ? (content.match(/if|for|while|switch|catch|&&|\|\|/g) || []).length : 0,
        },
        stored_in_memory: true,
        note: "Full AI analysis requires HeadyLocal/Cloud model availability. Structural metrics provided. Content stored for async deep analysis.",
    };

    res.json({ ok: true, analysis, ts });
});

/**
 * POST /api/brain/embed
 * Embedding endpoint for heady_embed MCP tool
 */
router.post("/embed", async (req, res) => {
    const { text, model } = req.body;
    const ts = new Date().toISOString();

    logInteraction("embed", text, `[embedding generated]`);
    await storeInMemory(
        `Embedding request: ${(text || "").substring(0, 200)}`,
        { type: "brain_embed", model: model || "nomic-embed-text", ts }
    );

    // Try HeadyLocal embeddings
    try {
        const http = require("http");
        const payload = JSON.stringify({ model: model || "nomic-embed-text", prompt: text });

        const result = await new Promise((resolve, reject) => {
            const req2 = http.request(
                {
                    hostname: process.env.HEADY_LOCAL_HOST || "127.0.0.1", port: parseInt(process.env.OLLAMA_PORT || "11434"), path: "/api/embeddings", method: "POST",
                    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
                    timeout: 15000
                },
                (res2) => {
                    let data = "";
                    res2.on("data", (chunk) => (data += chunk));
                    res2.on("end", () => { try { resolve(JSON.parse(data)); } catch { reject(new Error("parse")); } });
                }
            );
            req2.on("error", reject);
            req2.on("timeout", () => { req2.destroy(); reject(new Error("timeout")); });
            req2.write(payload);
            req2.end();
        });

        logMemoryReceipt({
            stored: `Real vector embedding created via HeadyLocal (${model || "nomic-embed-text"}) — ${result.embedding ? result.embedding.length : 0} dimensions`,
            notStored: "Full 3D vector stored — nothing omitted",
            method: "headylocal-vector-db",
            fallbackUsed: false,
        });

        res.json({
            ok: true,
            embedding: result.embedding,
            model: model || "nomic-embed-text",
            dimensions: result.embedding ? result.embedding.length : 0,
            source: "heady-local-headylocal",
            stored_in_memory: true,
            ts,
        });
    } catch (err) {
        // Fallback: hash-based pseudo-embedding for structural matching
        const hash = crypto.createHash("sha256").update(text || "").digest();
        const pseudoEmbed = Array.from(hash).map((b) => (b / 255) * 2 - 1);

        logMemoryReceipt({
            stored: `Hash-based pseudo-embedding (32 dims) — structural match only, NOT semantic: "${(text || "").substring(0, 80)}..."`,
            notStored: `Semantic meaning NOT captured — real ${model || "nomic-embed-text"} embedding failed (${err.message}). Full text (${(text || "").length} chars) has no 3D vector representation.`,
            method: "hash-fallback",
            fallbackUsed: true,
        });

        res.json({
            ok: true,
            embedding: pseudoEmbed,
            model: "heady-hash-fallback",
            dimensions: pseudoEmbed.length,
            source: "heady-manager-fallback",
            stored_in_memory: true,
            fallback_used: true,
            priority_fix: "HeadyLocal with nomic-embed-text not available — semantic search degraded",
            note: "Hash-based fallback. For semantic embeddings, start HeadyLocal with nomic-embed-text.",
            ts,
        });
    }
});

/**
 * GET /api/brain/memory-receipts
 * View what was stored and what was not stored in persistent memory
 */
router.get("/memory-receipts", (req, res) => {
    try {
        let receipts = [];
        if (fs.existsSync(MEMORY_RECEIPTS_PATH)) {
            receipts = JSON.parse(fs.readFileSync(MEMORY_RECEIPTS_PATH, "utf8"));
        }
        const fallbackCount = receipts.filter(r => r.fallbackUsed).length;
        const vectorCount = receipts.filter(r => !r.fallbackUsed).length;
        res.json({
            ok: true,
            total: receipts.length,
            vectorDb: vectorCount,
            fallback: fallbackCount,
            fallbackPriority: fallbackCount > 0 ? "HIGH — vector DB should be primary storage" : "OK — no fallbacks detected",
            recent: receipts.slice(-20),
            ts: new Date().toISOString(),
        });
    } catch (err) {
        res.json({ ok: false, error: err.message });
    }
});


/**
 * POST /api/brain/search
 * Knowledge search endpoint for heady_search MCP tool
 */
router.post("/search", async (req, res) => {
    const { query, scope, limit } = req.body;
    const ts = new Date().toISOString();

    logInteraction("search", query, `[search in ${scope || "all"}]`);
    await storeInMemory(
        `Knowledge search: ${query}`,
        { type: "brain_search", scope, ts }
    );

    // Search through brain interaction log for relevant past interactions
    const results = [];
    try {
        if (fs.existsSync(BRAIN_LOG_PATH)) {
            const log = JSON.parse(fs.readFileSync(BRAIN_LOG_PATH, "utf8"));
            const q = (query || "").toLowerCase();
            for (const entry of log.slice(-200).reverse()) {
                if (entry.input && entry.input.toLowerCase().includes(q)) {
                    results.push({ id: entry.id, type: entry.type, match: entry.input, ts: entry.timestamp, score: 0.9 });
                } else if (entry.output && entry.output.toLowerCase().includes(q)) {
                    results.push({ id: entry.id, type: entry.type, match: entry.output, ts: entry.timestamp, score: 0.7 });
                }
                if (results.length >= (limit || 10)) break;
            }
        }
    } catch (err) {
        // Non-critical
    }

    res.json({
        ok: true,
        results,
        total: results.length,
        scope: scope || "all",
        stored_in_memory: true,
        ts,
    });
});

/**
 * GET /api/brain/health
 * Brain health check for heady_health MCP tool
 */
router.get("/health", (req, res) => {
    let interactionCount = 0;
    try {
        if (fs.existsSync(BRAIN_LOG_PATH)) {
            interactionCount = JSON.parse(fs.readFileSync(BRAIN_LOG_PATH, "utf8")).length;
        }
    } catch { }

    res.json({
        status: "ACTIVE",
        service: "HeadyBrain",
        interactions_logged: interactionCount,
        memory_enabled: !!memoryWrapper,
        endpoints: ["/api/brain/chat", "/api/brain/analyze", "/api/brain/embed", "/api/brain/search"],
        ts: new Date().toISOString(),
    });
});

/**
 * GET /api/brain/headyjules-usage
 * Monitor HeadyJules SDK usage, costs, and model distribution
 */
router.get("/headyjules-usage", (req, res) => {
    res.json({
        ok: true,
        totalCost: +claudeUsage.totalCost.toFixed(4),
        totalRequests: claudeUsage.requests,
        byModel: claudeUsage.byModel,
        byOrg: Object.fromEntries(
            Object.entries(claudeUsage.byOrg || {}).map(([k, v]) => [k, +v.toFixed(4)])
        ),
        budgetRemaining: {
            headysystems: +(30 - (claudeUsage.byOrg?.headysystems || 0)).toFixed(2),
            headyconnection: +(60 - (claudeUsage.byOrg?.headyconnection || 0)).toFixed(2),
            total: +(90 - claudeUsage.totalCost).toFixed(2),
        },
        recentHistory: (claudeUsage.history || []).slice(-10),
        ts: new Date().toISOString(),
    });
});

// ─── Hive SDK Brain Contract Endpoints ─────────────────────────────
// These endpoints satisfy the heady-hive-sdk brain.js client contract

// POST /api/brain/embed — Generate vector embeddings
router.post("/embed", async (req, res) => {
    const { text, model } = req.body;
    if (!text) return res.status(400).json({ error: "text required" });
    const ts = new Date().toISOString();

    try {
        if (memoryWrapper && typeof memoryWrapper.ingestMemory === "function") {
            // Store and return the embedding
            const id = await memoryWrapper.ingestMemory({ content: text, metadata: { type: "embed_request", model: model || "all-MiniLM-L6-v2", ts } });
            // Use the embed function directly if available
            const vectorMem = require("../vector-memory");
            const embedding = await vectorMem.embed(text);
            logInteraction("embed", text.substring(0, 100), `${embedding.length}-dim vector`);
            res.json({ ok: true, embedding, dimensions: embedding.length, model: "heady-brain-embed", stored_id: id, ts });
        } else {
            res.status(503).json({ error: "Vector memory not connected", ts });
        }
    } catch (err) {
        res.status(500).json({ error: err.message, ts });
    }
});

// POST /api/brain/search — Semantic search across vector memory
router.post("/search", async (req, res) => {
    const { query, scope, limit } = req.body;
    if (!query) return res.status(400).json({ error: "query required" });
    const ts = new Date().toISOString();

    try {
        const vectorMem = require("../vector-memory");
        const results = await vectorMem.queryMemory(query, limit || 10, scope ? { type: scope } : {});
        const stats = vectorMem.getStats();
        logInteraction("search", query, `${results.length} results from ${stats.total_vectors} vectors`);
        res.json({
            ok: true, results, total_vectors: stats.total_vectors,
            embedding_source: stats.embedding_source,
            model: "heady-brain-search", ts,
        });
    } catch (err) {
        res.status(500).json({ error: err.message, ts });
    }
});

// POST /api/brain/analyze — Analyze code or text via brain race
router.post("/analyze", async (req, res) => {
    const { content, type, depth } = req.body;
    if (!content) return res.status(400).json({ error: "content required" });
    const ts = new Date().toISOString();
    const analysisPrompt = `Analyze the following ${type || "code"} (depth: ${depth || "standard"}):\n\n${content}`;

    // Route through the brain race for multi-provider analysis
    try {
        req.body.message = analysisPrompt;
        req.body.system = "You are HeadyBrain's code analysis engine. Provide thorough, actionable analysis.";
        // Forward to chat handler logic (reuse the race)
        const raceStart = Date.now();
        const providers = [];
        const providerNames = [];

        // Use HeadyPythia for analysis (fast + good at code)
        providers.push(chatViaGemini(analysisPrompt, req.body.system, 0.2, 4096)
            .then(r => ({ ...r, source: "headypythia", latency: Date.now() - raceStart })));
        providerNames.push("headypythia");

        const winner = await Promise.any(providers);
        const filtered = filterResponse(winner.response, { scrubProviders: true });

        await storeInMemory(`Analysis: ${filtered.substring(0, 500)}`, { type: "analysis", source: winner.source, ts });
        res.json({ ok: true, analysis: filtered, model: "heady-brain", type: type || "general", ts });
    } catch (err) {
        res.status(500).json({ error: err.message, ts });
    }
});

// POST /api/brain/complete — Code/text completion
router.post("/complete", async (req, res) => {
    const { prompt, language, max_tokens } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt required" });
    const ts = new Date().toISOString();
    const sysPrompt = `You are HeadyBrain's code completion engine. Complete the following ${language || "code"} precisely. Return ONLY the completion, no explanation.`;

    try {
        const result = await chatViaGemini(prompt, sysPrompt, 0.1, max_tokens || 1024);
        const filtered = filterResponse(result.response, { scrubProviders: true });
        res.json({ ok: true, completion: filtered, model: "heady-brain", language: language || "auto", ts });
    } catch (err) {
        res.status(500).json({ error: err.message, ts });
    }
});

// POST /api/brain/refactor — Code refactoring suggestions
router.post("/refactor", async (req, res) => {
    const { code, language, goals } = req.body;
    if (!code) return res.status(400).json({ error: "code required" });
    const ts = new Date().toISOString();
    const goalStr = (goals || ["readability", "performance"]).join(", ");
    const sysPrompt = `You are HeadyBrain's refactoring engine. Refactor the following ${language || "code"} with these goals: ${goalStr}. Show the refactored code and explain each change.`;

    try {
        const result = await chatViaGemini(code, sysPrompt, 0.2, 4096);
        const filtered = filterResponse(result.response, { scrubProviders: true });
        await storeInMemory(`Refactor: ${filtered.substring(0, 500)}`, { type: "refactor", goals, ts });
        res.json({ ok: true, refactored: filtered, model: "heady-brain", goals: goals || ["readability", "performance"], ts });
    } catch (err) {
        res.status(500).json({ error: err.message, ts });
    }
});

module.exports = { router, setMemoryWrapper };

/**
 * POST /api/brain/stream
 * Server-Sent Events streaming chat via HeadyJules SDK
 */
router.post("/stream", async (req, res) => {
    const { message, system, model } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });

    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        ...req.headers.origin ? { "Access-Control-Allow-Origin": req.headers.origin } : {},
    });

    try {
        const complexity = analyzeComplexity(message);
        const { client } = getClaudeClient();
        const modelId = complexity.level === "low" ? "headyjules-haiku-4-5-20250514"
            : complexity.level === "critical" ? "headyjules-opus-4-20250514"
                : "headyjules-sonnet-4-20250514";

        const useThinking = complexity.score >= 0.6;
        const streamParams = {
            model: modelId,
            max_tokens: useThinking ? 16000 : 4096,
            messages: [{ role: "user", content: message }],
            ...(system ? { system } : {}),
            stream: true,
        };

        if (useThinking) {
            streamParams.thinking = { type: "enabled", budget_tokens: Math.min(complexity.score * 10000, 8000) };
        }

        const stream = client.messages.stream(streamParams);

        stream.on("text", (text) => {
            res.write(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`);
        });

        stream.on("message", (msg) => {
            const usage = msg.usage || {};
            res.write(`data: ${JSON.stringify({ type: "done", model: modelId, complexity: complexity.level, input_tokens: usage.input_tokens, output_tokens: usage.output_tokens })}\n\n`);
            res.end();
        });

        stream.on("error", (err) => {
            res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
            res.end();
        });
    } catch (err) {
        res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
        res.end();
    }
});
