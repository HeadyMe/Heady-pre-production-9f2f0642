/**
 * HeadyBrain — Brain API client (chat, analyze, embed, search)
 */
class HeadyBrain {
    constructor(client) { this._c = client; }

    /** Chat with HeadyBrain (via HeadyManager or direct gateway) */
    async chat(prompt, opts = {}) {
        // Try gateway-direct first if available
        if (this._c.gateway) {
            try {
                const gwRes = await this._c.gateway.chat(prompt, {
                    system: opts.system,
                    priority: opts.priority || "medium",
                    temperature: opts.temperature,
                    maxTokens: opts.maxTokens || 2048,
                });
                if (gwRes.ok) return gwRes;
            } catch { /* gateway failed — fall through to Manager */ }
        }
        // Fallback to HeadyManager HTTP (always-on backend)
        return this._c.post("/api/brain/chat", {
            message: prompt, model: opts.model || "heady-brain",
            max_tokens: opts.maxTokens || 2048,
            temperature: opts.temperature || 0.3,
            context: opts.context || "sdk",
        });
    }

    /** Analyze code, text, or data */
    async analyze(content, opts = {}) {
        return this._c.post("/api/brain/analyze", {
            content, type: opts.type || "general",
            depth: opts.depth || "standard",
        });
    }

    /** Generate embeddings */
    async embed(text, opts = {}) {
        return this._c.post("/api/brain/embed", {
            text, model: opts.model || "text-embedding-3-small",
        });
    }

    /** Search knowledge base */
    async search(query, opts = {}) {
        return this._c.post("/api/brain/search", {
            query, scope: opts.scope || "all", limit: opts.limit || 10,
        });
    }

    /** Complete text/code */
    async complete(prompt, opts = {}) {
        return this._c.post("/api/brain/complete", {
            prompt, language: opts.language || "auto",
            max_tokens: opts.maxTokens || 1024,
        });
    }

    /** Refactor code */
    async refactor(code, opts = {}) {
        return this._c.post("/api/brain/refactor", {
            code, language: opts.language || "auto",
            goals: opts.goals || ["readability", "performance"],
        });
    }
}

module.exports = HeadyBrain;
