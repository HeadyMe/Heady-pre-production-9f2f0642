/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ─── Heady Remote Compute Dispatcher ─────────────────────────────
 * Routes ALL compute to remote APIs, minimizes local resource use.
 * Every result is stored in 3D vector persistent storage.
 *
 * Remote Resources:
 *   - HF Business (3 seats): embeddings, inference, open-weight models
 *   - HeadyPythia (4 keys): multimodal, code analysis, fast inference
 *   - HeadyJules (2 keys): deep reasoning, code generation
 *   - HeadyCompute (2 seats): GPT-4o, embeddings, Codex
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
const HeadyGateway = require(path.join(__dirname, "..", "heady-hive-sdk", "lib", "gateway"));
const { createProviders } = require(path.join(__dirname, "..", "heady-hive-sdk", "lib", "providers"));

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

// ── SDK Gateway (single source of truth) ────────────────────────
let _gateway = null;
function getGateway() {
    if (!_gateway) {
        _gateway = new HeadyGateway({ cacheTTL: 300000 });
        const providers = createProviders(process.env);
        for (const p of providers) _gateway.registerProvider(p);
    }
    return _gateway;
}

async function dispatchViaGateway(action, payload, vectorMem) {
    const gateway = getGateway();
    const message = payload.message || payload.content || payload.text || "";

    if (action === "embed") {
        const result = await gateway.embed(message);
        if (result.ok && vectorMem) {
            await vectorMem.ingestMemory({
                content: message,
                metadata: { type: "remote_embed", provider: result.engine || "gateway" },
                embedding: result.embedding,
            });
            stats.totalVectorStored++;
        }
        incStat(result.engine || "gateway", action);
        audit({ type: "dispatch", provider: result.engine, action, success: result.ok });
        return result;
    }

    // chat / analyze / refactor / any
    const result = await gateway.chat(message, {
        system: "You are HeadyBrain, the AI reasoning engine powering the Heady ecosystem.",
        temperature: payload.temperature,
        maxTokens: payload.maxTokens,
    });

    if (result.ok && vectorMem) {
        await vectorMem.ingestMemory({
            content: `${action}: ${(result.response || "").substring(0, 500)}`,
            metadata: { type: `remote_${action}`, provider: result.engine },
        });
        stats.totalVectorStored++;
    }

    incStat(result.engine || "gateway", action);
    audit({ type: "dispatch", provider: result.engine, action, success: result.ok });
    return { response: result.response, model: result.engine || "heady-brain", provider: result.engine, remote: true };
}

// ── Dispatch (routes through SDK gateway) ────────────────────────
async function dispatch(action, payload, vectorMem) {
    return dispatchViaGateway(action, payload, vectorMem);
}

// ── Race (SDK gateway races all providers by default) ────────────
async function dispatchRace(action, payload, vectorMem) {
    return dispatchViaGateway(action, payload, vectorMem);
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
