/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Perplexity Research Service — Real API Integration ═══
 *
 * Direct Sonar Pro API calls with:
 *   - Mode switching (quick/deep/academic/news)
 *   - Context injection from project state
 *   - Response → 3D vector memory persistence
 *   - Citation extraction
 *   - Cost tracking via budget-tracker
 */

const _logger = require("../utils/logger");
const logger = {
    logNodeActivity: _logger.logNodeActivity?.bind(_logger) || ((_n, msg) => (_logger.info || console.log)(msg)),
    logError: _logger.logError?.bind(_logger) || ((_n, msg) => (_logger.error || console.error)(msg)),
    logSystem: _logger.logSystem?.bind(_logger) || ((msg) => (_logger.info || console.log)(msg)),
};

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

// Mode → model mapping
const MODE_MAP = {
    quick: { model: "sonar", maxTokens: 4096, systemPrompt: "Provide a concise, accurate answer." },
    deep: { model: "sonar-pro", maxTokens: 16384, systemPrompt: "You are a deep research specialist. Provide thorough analysis with citations, evidence, and actionable recommendations." },
    academic: { model: "sonar-pro", maxTokens: 16384, systemPrompt: "You are an academic research specialist. Provide scholarly analysis with references to papers, standards, and formal methodologies." },
    news: { model: "sonar", maxTokens: 4096, systemPrompt: "You are a news research specialist. Focus on the most recent developments, announcements, and breaking news. Include dates and sources." },
};

class PerplexityResearchService {
    constructor(opts = {}) {
        this.apiKey = opts.apiKey || process.env.PERPLEXITY_API_KEY;
        this.vectorMemory = opts.vectorMemory || null;
        this.budgetTracker = opts.budgetTracker || null;
        this.stats = { totalQueries: 0, totalTokensUsed: 0, byMode: {}, errors: 0 };
    }

    /**
     * Execute a research query via the Perplexity Sonar API.
     * @param {object} params
     * @param {string} params.query - Research question
     * @param {string} params.mode - quick | deep | academic | news
     * @param {string} params.timeframe - all | day | week | month | year
     * @param {number} params.maxSources - Max citation URLs
     * @param {string} params.context - Optional project context to inject
     * @param {boolean} params.persist - Whether to persist results to vector memory (default: true)
     */
    async research({ query, mode = "deep", timeframe = "all", maxSources = 10, context = "", persist = true }) {
        if (!this.apiKey) {
            throw new Error("PERPLEXITY_API_KEY not configured. Set it in the SecureKeyVault or environment.");
        }

        const config = MODE_MAP[mode] || MODE_MAP.deep;
        const startTime = Date.now();

        // Build system prompt with optional context injection
        let systemPrompt = config.systemPrompt;
        if (context) {
            systemPrompt += `\n\nProject Context:\n${context}`;
        }
        if (timeframe !== "all") {
            const timeframeMap = { day: "the last 24 hours", week: "the past week", month: "the past month", year: "the past year" };
            systemPrompt += `\n\nFocus on information from ${timeframeMap[timeframe] || timeframe}.`;
        }

        // Call Perplexity API
        const response = await fetch(PERPLEXITY_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: query },
                ],
                max_tokens: config.maxTokens,
                temperature: mode === "quick" ? 0.1 : 0.3,
            }),
            signal: AbortSignal.timeout(mode === "deep" || mode === "academic" ? 90000 : 30000),
        });

        if (!response.ok) {
            this.stats.errors++;
            const errText = await response.text().catch(() => "Unknown error");
            throw new Error(`Perplexity API error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const latencyMs = Date.now() - startTime;

        // Extract the answer and citations
        const answer = data.choices?.[0]?.message?.content || "";
        const citations = data.citations || [];
        const tokensUsed = data.usage?.total_tokens || 0;

        // Update stats
        this.stats.totalQueries++;
        this.stats.totalTokensUsed += tokensUsed;
        this.stats.byMode[mode] = (this.stats.byMode[mode] || 0) + 1;

        // Track cost via budget tracker
        if (this.budgetTracker) {
            try {
                const provider = config.model.includes("pro") ? "perplexity-sonar-pro" : "perplexity-sonar";
                this.budgetTracker.trackUsage?.(provider, {
                    inputTokens: data.usage?.prompt_tokens || 0,
                    outputTokens: data.usage?.completion_tokens || 0,
                });
            } catch (e) { /* non-critical */ }
        }

        // Persist to 3D vector memory if available
        if (persist && this.vectorMemory) {
            try {
                const embedding = this._simpleEmbed(query);
                await this.vectorMemory.ingestMemory?.({
                    content: `[Research:${mode}] Q: ${query}\n\nA: ${answer.substring(0, 2000)}`,
                    embedding,
                    metadata: {
                        type: "research",
                        mode,
                        query,
                        citationCount: citations.length,
                        tokensUsed,
                        timestamp: new Date().toISOString(),
                    },
                });
            } catch (e) {
                logger.logError("PERPLEXITY", `Vector persist failed: ${e.message}`, e);
            }
        }

        const result = {
            ok: true,
            service: "heady-perplexity-research",
            mode,
            model: config.model,
            query,
            answer,
            citations: citations.slice(0, maxSources),
            usage: {
                promptTokens: data.usage?.prompt_tokens || 0,
                completionTokens: data.usage?.completion_tokens || 0,
                totalTokens: tokensUsed,
            },
            latencyMs,
            persisted: persist && !!this.vectorMemory,
            timestamp: new Date().toISOString(),
        };

        logger.logNodeActivity("PERPLEXITY", `  🔍 Research [${mode}] "${query.substring(0, 60)}..." → ${tokensUsed} tokens, ${citations.length} citations, ${latencyMs}ms`);

        return result;
    }

    // Simple embedding for vector memory persistence (32-dim hash-based)
    _simpleEmbed(text) {
        const dims = 32;
        const vec = new Float32Array(dims);
        for (let i = 0; i < text.length; i++) {
            vec[i % dims] += text.charCodeAt(i) / 255;
        }
        const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
        return Array.from(vec).map(v => v / mag);
    }

    getStats() {
        return { ...this.stats, apiKeyConfigured: !!this.apiKey };
    }
}

/**
 * Register Perplexity research routes on Express app.
 * Replaces the stub from service-stubs.js.
 */
function registerPerplexityRoutes(app, opts = {}) {
    const service = new PerplexityResearchService(opts);

    // POST /api/perplexity/research — Main research endpoint
    app.post("/api/perplexity/research", async (req, res) => {
        try {
            const result = await service.research({
                query: req.body.query,
                mode: req.body.mode || "deep",
                timeframe: req.body.timeframe || "all",
                maxSources: req.body.maxSources || 10,
                context: req.body.context || "",
                persist: req.body.persist !== false,
            });
            res.json(result);
        } catch (err) {
            logger.logError("PERPLEXITY", `Research error: ${err.message}`, err);
            res.status(err.message.includes("not configured") ? 503 : 500).json({
                ok: false, service: "heady-perplexity-research",
                error: err.message, timestamp: new Date().toISOString(),
            });
        }
    });

    // POST /api/perplexity/search — Quick search alias
    app.post("/api/perplexity/search", async (req, res) => {
        try {
            const result = await service.research({
                query: req.body.query,
                mode: "quick",
                maxSources: req.body.maxSources || 5,
            });
            res.json(result);
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // GET /api/perplexity/health — Service health
    app.get("/api/perplexity/health", (req, res) => {
        res.json({
            ok: true, service: "heady-perplexity-research",
            ...service.getStats(), timestamp: new Date().toISOString(),
        });
    });

    logger.logSystem("  🔍 PerplexityResearch: LIVE → /api/perplexity/research (Sonar Pro direct API)");
    return service;
}

module.exports = { PerplexityResearchService, registerPerplexityRoutes };
