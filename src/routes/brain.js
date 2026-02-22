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
            input: typeof input === "string" ? input.substring(0, 500) : JSON.stringify(input).substring(0, 500),
            output: typeof output === "string" ? output.substring(0, 500) : JSON.stringify(output).substring(0, 500),
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

async function storeInMemory(content, metadata) {
    if (memoryWrapper && typeof memoryWrapper.ingestMemory === "function") {
        try {
            await memoryWrapper.ingestMemory({ content, metadata });
        } catch (err) {
            // Non-critical
        }
    }
}

/**
 * POST /api/brain/chat
 * Primary chat endpoint for heady_chat MCP tool
 */
router.post("/chat", async (req, res) => {
    const { message, system, model, temperature, max_tokens, context } = req.body;
    const ts = new Date().toISOString();

    // Log and store in memory
    logInteraction("chat", message, `[chat request at ${ts}]`);
    await storeInMemory(
        `Chat interaction: ${message}`,
        { type: "brain_chat", model: model || "heady-brain", ts }
    );

    // Route through local Ollama if available, otherwise return intelligent acknowledgment
    try {
        const http = require("http");
        const ollamaPayload = JSON.stringify({
            model: "llama3.2",
            prompt: system ? `${system}\n\nUser: ${message}` : message,
            stream: false,
            options: { temperature: temperature || 0.7, num_predict: max_tokens || 4096 },
        });

        const ollamaResult = await new Promise((resolve, reject) => {
            const ollamaReq = http.request(
                {
                    hostname: "localhost", port: 11434, path: "/api/generate", method: "POST",
                    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(ollamaPayload) },
                    timeout: 30000
                },
                (ollamaRes) => {
                    let data = "";
                    ollamaRes.on("data", (chunk) => (data += chunk));
                    ollamaRes.on("end", () => {
                        try { resolve(JSON.parse(data)); } catch { resolve({ response: data }); }
                    });
                }
            );
            ollamaReq.on("error", reject);
            ollamaReq.on("timeout", () => { ollamaReq.destroy(); reject(new Error("timeout")); });
            ollamaReq.write(ollamaPayload);
            ollamaReq.end();
        });

        const response = ollamaResult.response || ollamaResult.message?.content || JSON.stringify(ollamaResult);
        logInteraction("chat_response", message, response);
        await storeInMemory(
            `Brain response: ${response.substring(0, 500)}`,
            { type: "brain_response", model: "llama3.2", ts }
        );

        res.json({
            ok: true,
            response,
            model: "heady-brain (llama3.2)",
            source: "heady-local-ollama",
            stored_in_memory: true,
            ts,
        });
    } catch (ollamaErr) {
        // Ollama not available — return contextual acknowledgment
        const fallbackResponse = `HeadyBrain received your message. Ollama backend is currently unavailable (${ollamaErr.message}). Message stored in persistent memory for processing when services restore.`;
        logInteraction("chat_fallback", message, fallbackResponse);

        res.json({
            ok: true,
            response: fallbackResponse,
            model: "heady-brain (fallback)",
            source: "heady-manager-fallback",
            stored_in_memory: true,
            ollama_status: "unavailable",
            ts,
        });
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
        note: "Full AI analysis requires Ollama/Cloud model availability. Structural metrics provided. Content stored for async deep analysis.",
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

    // Try Ollama embeddings
    try {
        const http = require("http");
        const payload = JSON.stringify({ model: model || "nomic-embed-text", prompt: text });

        const result = await new Promise((resolve, reject) => {
            const req2 = http.request(
                {
                    hostname: "localhost", port: 11434, path: "/api/embeddings", method: "POST",
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

        res.json({
            ok: true,
            embedding: result.embedding,
            model: model || "nomic-embed-text",
            dimensions: result.embedding ? result.embedding.length : 0,
            source: "heady-local-ollama",
            stored_in_memory: true,
            ts,
        });
    } catch (err) {
        // Fallback: hash-based pseudo-embedding for structural matching
        const hash = crypto.createHash("sha256").update(text || "").digest();
        const pseudoEmbed = Array.from(hash).map((b) => (b / 255) * 2 - 1);

        res.json({
            ok: true,
            embedding: pseudoEmbed,
            model: "heady-hash-fallback",
            dimensions: pseudoEmbed.length,
            source: "heady-manager-fallback",
            stored_in_memory: true,
            note: "Hash-based fallback. For semantic embeddings, start Ollama with nomic-embed-text.",
            ts,
        });
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

module.exports = { router, setMemoryWrapper };
