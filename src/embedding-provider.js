/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ Embedding Provider Abstraction — SPEC-3 ═══
 *
 * Unified interface for embedding generation.
 * Supports: LOCAL (HeadyLocal/nomic-embed-text), CLOUD (Workers AI @cf/bge),
 *           and OPENAI (text-embedding-3-small).
 *
 * Auto-selects provider: tries local → edge → cloud.
 */

class EmbeddingProvider {
    constructor(opts = {}) {
        this.providers = {
            local: {
                enabled: opts.localEnabled !== false,
                endpoint: opts.localEndpoint || "http://127.0.0.1:11434/api/embeddings",
                model: opts.localModel || "nomic-embed-text",
                dims: 768,
            },
            edge: {
                enabled: opts.edgeEnabled !== false,
                endpoint: opts.edgeEndpoint || "https://heady-edge-node.headyme.workers.dev/api/embed",
                model: "@cf/bge-base-en-v1.5",
                dims: 768,
            },
            headycompute: {
                enabled: opts.openaiEnabled || false,
                endpoint: "https://api.headycompute.com/v1/embeddings",
                model: opts.openaiModel || "text-embedding-3-small",
                dims: 1536,
                apiKey: opts.openaiApiKey || process.env.HEADY_COMPUTE_KEY || null,
            },
        };
        this.preferredOrder = opts.preferredOrder || ["local", "edge", "headycompute"];
        this.cache = new Map();
        this.maxCacheSize = opts.maxCacheSize || 1000;
        this.stats = { local: 0, edge: 0, headycompute: 0, cached: 0, errors: 0 };
    }

    // ─── Embed text (auto-select provider) ───────────────────────
    async embed(text, opts = {}) {
        if (!text || !text.trim()) return null;

        // Check cache
        const cacheKey = text.trim().substring(0, 200);
        if (this.cache.has(cacheKey)) {
            this.stats.cached++;
            return this.cache.get(cacheKey);
        }

        const provider = opts.provider || null;
        const order = provider ? [provider] : this.preferredOrder;

        for (const name of order) {
            const config = this.providers[name];
            if (!config || !config.enabled) continue;

            try {
                const embedding = await this._callProvider(name, config, text);
                if (embedding && embedding.length > 0) {
                    // Cache result
                    this.cache.set(cacheKey, embedding);
                    if (this.cache.size > this.maxCacheSize) {
                        const firstKey = this.cache.keys().next().value;
                        this.cache.delete(firstKey);
                    }
                    this.stats[name]++;
                    return embedding;
                }
            } catch (err) {
                this.stats.errors++;
                // Fall through to next provider
            }
        }

        return null; // All providers failed
    }

    // ─── Batch embed ─────────────────────────────────────────────
    async embedBatch(texts, opts = {}) {
        const results = [];
        for (const text of texts) {
            const embedding = await this.embed(text, opts);
            results.push(embedding);
        }
        return results;
    }

    // ─── Provider dispatch ───────────────────────────────────────
    async _callProvider(name, config, text) {
        switch (name) {
            case "local":
                return this._callLocal(config, text);
            case "edge":
                return this._callEdge(config, text);
            case "headycompute":
                return this._callOpenAI(config, text);
            default:
                throw new Error(`Unknown provider: ${name}`);
        }
    }

    async _callLocal(config, text) {
        const res = await fetch(config.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: config.model, prompt: text }),
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) throw new Error(`Local embed failed: ${res.status}`);
        const data = await res.json();
        return data.embedding || null;
    }

    async _callEdge(config, text) {
        const res = await fetch(config.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`Edge embed failed: ${res.status}`);
        const data = await res.json();
        return data.embedding || data.data?.[0]?.embedding || null;
    }

    async _callOpenAI(config, text) {
        if (!config.apiKey) throw new Error("HeadyCompute API key not configured");
        const res = await fetch(config.endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({ model: config.model, input: text }),
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`HeadyCompute embed failed: ${res.status}`);
        const data = await res.json();
        return data.data?.[0]?.embedding || null;
    }

    // ─── Provider management ─────────────────────────────────────
    enableProvider(name, config = {}) {
        if (this.providers[name]) {
            this.providers[name].enabled = true;
            Object.assign(this.providers[name], config);
        }
    }

    disableProvider(name) {
        if (this.providers[name]) {
            this.providers[name].enabled = false;
        }
    }

    listProviders() {
        return Object.entries(this.providers).map(([name, config]) => ({
            name,
            enabled: config.enabled,
            model: config.model,
            dims: config.dims,
        }));
    }

    // ─── Status ──────────────────────────────────────────────────
    status() {
        return {
            providers: this.listProviders(),
            preferredOrder: this.preferredOrder,
            cacheSize: this.cache.size,
            stats: { ...this.stats },
        };
    }
}

module.exports = EmbeddingProvider;
