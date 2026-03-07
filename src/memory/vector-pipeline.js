/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ─── Heady Vector-Augmented Response Pipeline ─────────────────────
 * 
 * THE CRITICAL MISSING PIECE: Before ANY brain response is generated,
 * this middleware queries vector memory for relevant context and
 * injects it into the prompt/response. Without this, vector memory
 * is just collecting dust.
 *
 * Flow:
 *   1. Request arrives at /brain/chat, /brain/analyze, etc.
 *   2. BEFORE calling the AI provider, query vector memory
 *   3. Include top-K relevant memories as context
 *   4. AFTER getting response, store the Q+A in vector memory
 *   5. Return augmented response
 *
 * Timing uses φ (golden ratio = 1.618) derived intervals:
 *   φ¹ = 1.618s, φ² = 2.618s, φ³ = 4.236s, φ⁴ = 6.854s
 *   φ⁵ = 11.09s, φ⁶ = 17.94s, φ⁷ = 29.03s
 * ──────────────────────────────────────────────────────────────────
 */

const logger = require("./utils/logger");
const PHI = 1.6180339887; // Golden ratio

// φ-derived intervals (ms)
const PHI_INTERVALS = {
    micro: Math.round(PHI * 1000),          // 1,618ms  — fast pulse
    short: Math.round(PHI ** 2 * 1000),      // 2,618ms  — quick check
    medium: Math.round(PHI ** 3 * 1000),      // 4,236ms  — standard scan
    normal: Math.round(PHI ** 4 * 1000),      // 6,854ms  — registry scan
    long: Math.round(PHI ** 5 * 1000),      // 11,090ms — optimization cycle
    slow: Math.round(PHI ** 6 * 1000),      // 17,944ms — deep analysis
    deep: Math.round(PHI ** 7 * 1000),      // 29,034ms — full system review
};

/**
 * Creates Express middleware that augments brain endpoints with vector memory.
 * @param {Object} vectorMem — { queryMemory, ingestMemory }
 */
function createVectorAugmentedMiddleware(vectorMem) {
    if (!vectorMem || typeof vectorMem.queryMemory !== "function") {
        logger.warn("  ⚠ VectorPipeline: No vector memory — responses will not be augmented");
        return (req, res, next) => next();
    }

    return async function vectorAugment(req, res, next) {
        // Augment brain endpoints ONLY on public path — NOT /_brain_internal/
        // (internal loopback from orchestrator must NOT re-enter middleware or it deadlocks)
        if (!req.path.startsWith("/api/brain/")) return next();

        const body = req.body || {};
        const query = body.message || body.content || body.text || body.query || body.code || body.prompt || "";

        if (!query || query.length < 3) return next();

        try {
            // ── RETRIEVE: Query vector memory for relevant context ──
            const memories = await vectorMem.queryMemory(query, 3);
            const relevantContext = memories
                .filter(m => m.score > 0.3) // Only include if reasonably similar
                .map(m => m.content)
                .join("\n---\n");

            if (relevantContext) {
                // Inject context into the request body
                req._vectorContext = relevantContext;
                req._vectorMatches = memories.filter(m => m.score > 0.3).length;

                // Augment the message/content with retrieved context
                const contextPrefix = `[HeadyBrain Context — ${req._vectorMatches} relevant memories found]\n${relevantContext}\n[End Context]\n\n`;
                if (body.message) body.message = contextPrefix + body.message;
                else if (body.content) body.content = contextPrefix + body.content;
                else if (body.text) body.text = contextPrefix + body.text;
                else if (body.prompt) body.prompt = contextPrefix + body.prompt;
            }

            // ── STORE: Capture the response for future retrieval ──
            const origJson = res.json.bind(res);
            res.json = function (data) {
                // After responding, store the Q+A pair in vector memory
                if (data && query) {
                    const responseText = typeof data === "string" ? data :
                        data.response || data.result || data.content || "";
                    if (responseText && responseText.length > 10) {
                        vectorMem.ingestMemory({
                            content: `Q: ${query.substring(0, 500)}\nA: ${String(responseText).substring(0, 1000)}`,
                            metadata: { type: "brain_qa", endpoint: req.path, augmented: !!relevantContext },
                        }).catch(() => { });
                    }
                }
                return origJson(data);
            };
        } catch (err) {
            // Don't block the request if vector memory fails
            logger.warn("  ⚠ VectorPipeline: augment failed:", err.message);
        }

        next();
    };
}

/**
 * Express routes for the vector pipeline status + φ constants
 */
function registerRoutes(app, vectorMem) {
    app.get("/api/vector/pipeline", (req, res) => {
        res.json({
            ok: true,
            description: "Vector-Augmented Response Pipeline",
            active: !!vectorMem && typeof vectorMem.queryMemory === "function",
            flow: [
                "1. Request arrives at /brain/* endpoint",
                "2. Query vector memory for relevant context (top-3, score > 0.3)",
                "3. Inject context into prompt as [HeadyBrain Context]",
                "4. Call AI provider with augmented prompt",
                "5. Store Q+A pair in vector memory for future retrieval",
            ],
            phi: PHI,
            intervals: PHI_INTERVALS,
        });
    });
}

module.exports = { createVectorAugmentedMiddleware, registerRoutes, PHI, PHI_INTERVALS };
