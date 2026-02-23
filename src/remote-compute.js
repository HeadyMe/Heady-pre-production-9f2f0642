/**
 * ─── Heady Remote Compute Dispatcher ─────────────────────────────
 * Routes ALL compute to remote APIs, minimizes local resource use.
 * Every result is stored in 3D vector persistent storage.
 *
 * Remote Resources:
 *   - HF Business (3 seats): embeddings, inference, open-weight models
 *   - Gemini (4 keys): multimodal, code analysis, fast inference
 *   - Claude (2 keys): deep reasoning, code generation
 *   - OpenAI (2 seats): GPT-4o, embeddings, Codex
 *   - Groq: ultra-fast inference (Llama, Mixtral)
 *   - Perplexity: real-time research (Sonar Pro)
 *   - Cloudflare Workers AI: edge inference, vectorize
 *
 * All results → vector memory (3D persistent storage)
 * All operations → deterministic audit trail
 * ──────────────────────────────────────────────────────────────────
 */

const fs = require("fs");
const path = require("path");

const DISPATCH_AUDIT = path.join(__dirname, "..", "data", "remote-dispatch-audit.jsonl");
const dir = path.dirname(DISPATCH_AUDIT);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// Stats counters
const stats = {
    totalDispatched: 0,
    totalVectorStored: 0,
    byProvider: {},
    byAction: {},
    errors: 0,
    started: Date.now(),
};

function audit(entry) {
    try {
        fs.appendFileSync(DISPATCH_AUDIT, JSON.stringify({ ...entry, ts: new Date().toISOString() }) + "\n");
    } catch { }
}

function incStat(provider, action) {
    stats.totalDispatched++;
    stats.byProvider[provider] = (stats.byProvider[provider] || 0) + 1;
    stats.byAction[action] = (stats.byAction[action] || 0) + 1;
}

// ── Remote Provider Dispatchers ─────────────────────────────────

async function dispatchHF(action, payload, vectorMem) {
    const { InferenceClient } = require("@huggingface/inference");
    const tokens = [process.env.HF_TOKEN, process.env.HF_TOKEN_2, process.env.HF_TOKEN_3].filter(Boolean);
    const token = tokens[stats.totalDispatched % tokens.length]; // round-robin
    const client = new InferenceClient(token);

    let result;
    if (action === "embed") {
        result = await client.featureExtraction({
            model: "sentence-transformers/all-MiniLM-L6-v2",
            inputs: payload.text,
        });
        // Store in vector memory
        if (vectorMem) {
            await vectorMem.ingestMemory({
                content: payload.text,
                metadata: { type: "remote_embed", provider: "hf", model: "all-MiniLM-L6-v2" },
                embedding: Array.isArray(result) ? result : Array.from(result),
            });
            stats.totalVectorStored++;
        }
    } else if (action === "chat" || action === "analyze") {
        result = await client.chatCompletion({
            model: "Qwen/Qwen3-235B-A22B",
            messages: [
                { role: "system", content: "You are HeadyBrain, the AI reasoning engine." },
                { role: "user", content: payload.message || payload.content },
            ],
            max_tokens: payload.maxTokens || 2048,
        });
        const text = result.choices?.[0]?.message?.content || "";
        // Store analysis in vector memory
        if (vectorMem && text) {
            await vectorMem.ingestMemory({
                content: `HF Analysis: ${text.substring(0, 500)}`,
                metadata: { type: "remote_analysis", provider: "hf", action },
            });
            stats.totalVectorStored++;
        }
        result = { response: text, model: "heady-open-weights" };
    }

    incStat("hf", action);
    audit({ type: "dispatch", provider: "hf", action, success: true });
    return result;
}

async function dispatchGemini(action, payload, vectorMem) {
    const { GoogleGenAI } = require("@google/genai");
    const keys = [
        process.env.GOOGLE_API_KEY,
        process.env.GEMINI_API_KEY_HEADY,
        process.env.GEMINI_API_KEY_GCLOUD,
        process.env.GEMINI_API_KEY_HEADYBUDDY,
    ].filter(Boolean);
    const key = keys[stats.totalDispatched % keys.length]; // round-robin
    const ai = new GoogleGenAI({ apiKey: key });

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: payload.message || payload.content || payload.text,
    });
    const text = response.text || "";

    // Store in vector memory
    if (vectorMem && text) {
        await vectorMem.ingestMemory({
            content: `Gemini ${action}: ${text.substring(0, 500)}`,
            metadata: { type: `remote_${action}`, provider: "gemini", model: "gemini-2.5-flash" },
        });
        stats.totalVectorStored++;
    }

    incStat("gemini", action);
    audit({ type: "dispatch", provider: "gemini", action, success: true });
    return { response: text, model: "heady-multimodal" };
}

async function dispatchClaude(action, payload, vectorMem) {
    const Anthropic = require("@anthropic-ai/sdk");
    const keys = [process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_API_KEY_SECONDARY].filter(Boolean);
    const key = keys[stats.totalDispatched % keys.length];
    const client = new Anthropic({ apiKey: key });

    const msg = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: payload.maxTokens || 2048,
        system: "You are HeadyBrain, the AI reasoning engine powering the Heady ecosystem.",
        messages: [{ role: "user", content: payload.message || payload.content || payload.text }],
    });
    const text = msg.content?.[0]?.text || "";

    if (vectorMem && text) {
        await vectorMem.ingestMemory({
            content: `Claude ${action}: ${text.substring(0, 500)}`,
            metadata: { type: `remote_${action}`, provider: "claude", model: "claude-sonnet-4" },
        });
        stats.totalVectorStored++;
    }

    incStat("claude", action);
    audit({ type: "dispatch", provider: "claude", action, success: true });
    return { response: text, model: "heady-reasoning" };
}

// ── Intelligent Router ──────────────────────────────────────────
// Routes based on action type + load balancing across providers

async function dispatch(action, payload, vectorMem) {
    const available = [];
    if (process.env.HF_TOKEN) available.push({ name: "hf", fn: dispatchHF, priority: action === "embed" ? 10 : 5 });
    if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY_HEADY) available.push({ name: "gemini", fn: dispatchGemini, priority: action === "analyze" ? 10 : 7 });
    if (process.env.ANTHROPIC_API_KEY) available.push({ name: "claude", fn: dispatchClaude, priority: action === "refactor" ? 10 : 6 });

    if (available.length === 0) {
        audit({ type: "dispatch_fail", reason: "no remote providers configured" });
        throw new Error("No remote compute providers configured");
    }

    // Sort by priority for this action, then round-robin for load balancing
    available.sort((a, b) => b.priority - a.priority);

    // Try providers in order, failover on error
    for (const provider of available) {
        try {
            const result = await provider.fn(action, payload, vectorMem);
            return { ...result, provider: provider.name, remote: true };
        } catch (err) {
            stats.errors++;
            audit({ type: "dispatch_error", provider: provider.name, action, error: err.message });
            continue; // Try next provider
        }
    }
    throw new Error("All remote providers failed");
}

// ── Parallel Multi-Provider Dispatch ────────────────────────────
// Fire at ALL providers simultaneously, use fastest response

async function dispatchRace(action, payload, vectorMem) {
    const promises = [];
    if (process.env.HF_TOKEN) promises.push(dispatchHF(action, payload, vectorMem).catch(e => ({ error: e.message, provider: "hf" })));
    if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY_HEADY) promises.push(dispatchGemini(action, payload, vectorMem).catch(e => ({ error: e.message, provider: "gemini" })));
    if (process.env.ANTHROPIC_API_KEY) promises.push(dispatchClaude(action, payload, vectorMem).catch(e => ({ error: e.message, provider: "claude" })));

    if (promises.length === 0) throw new Error("No remote providers");

    // Race — fastest wins, all results stored in vector memory
    const winner = await Promise.any(promises);
    audit({ type: "race", action, winner: winner.model || "unknown", participants: promises.length });
    return { ...winner, raceMode: true, participants: promises.length };
}

// ── Express Routes ──────────────────────────────────────────────

function registerRoutes(app, vectorMem) {
    app.get("/api/remote/stats", (req, res) => {
        res.json({
            ok: true,
            ...stats,
            uptime: Date.now() - stats.started,
            auditEntries: (() => {
                try { return fs.readFileSync(DISPATCH_AUDIT, "utf-8").trim().split("\n").length; } catch { return 0; }
            })(),
        });
    });

    app.post("/api/remote/dispatch", async (req, res) => {
        const { action, payload, mode } = req.body;
        if (!action) return res.status(400).json({ error: "action required" });
        try {
            const result = mode === "race"
                ? await dispatchRace(action, payload || {}, vectorMem)
                : await dispatch(action, payload || {}, vectorMem);
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post("/api/remote/batch", async (req, res) => {
        const { tasks } = req.body;
        if (!Array.isArray(tasks)) return res.status(400).json({ error: "tasks array required" });
        const results = await Promise.allSettled(
            tasks.map(t => dispatch(t.action, t.payload || {}, vectorMem))
        );
        const mapped = results.map((r, i) => ({
            task: tasks[i].action,
            ...(r.status === "fulfilled" ? { ok: true, ...r.value } : { ok: false, error: r.reason?.message }),
        }));
        res.json({ ok: true, results: mapped, total: mapped.length, succeeded: mapped.filter(r => r.ok).length });
    });

    console.log("  ∞ RemoteCompute: LOADED (dispatch + race + batch → vector storage)");
}

module.exports = { dispatch, dispatchRace, registerRoutes, stats };
