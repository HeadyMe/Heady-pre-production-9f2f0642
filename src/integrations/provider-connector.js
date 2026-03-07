/**
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Heady Provider Connector ═══
 *
 * Unified connector for ALL AI provider business seats and API keys.
 * Manages key rotation, failover, health tracking, and parallel fan-out
 * across OpenAI, Anthropic/Claude, Google/Gemini, Perplexity, HuggingFace.
 *
 * Design:
 *   - Each provider has multiple keys (business seats, API keys, service accounts)
 *   - Keys are health-checked and rotated automatically
 *   - Fan-out mode: query ALL providers simultaneously, collect ALL responses
 *   - Race mode: fastest response wins, but ALL responses are preserved
 *   - Failover: if a key fails, try the next key for that provider
 */

const EventEmitter = require("events");

// ═══ Provider Definitions ═══

const PROVIDER_CONFIGS = {
    openai: {
        name: "OpenAI",
        baseUrl: "https://api.openai.com/v1/chat/completions",
        models: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
        defaultModel: "gpt-4o",
        authHeader: "Authorization",
        authPrefix: "Bearer ",
        maxTokensField: "max_tokens",
        formatRequest: (model, system, message, maxTokens) => ({
            model,
            messages: [
                ...(system ? [{ role: "system", content: system }] : []),
                { role: "user", content: message },
            ],
            max_tokens: maxTokens,
        }),
        extractResponse: (data) => data.choices?.[0]?.message?.content,
        extractError: (data) => data.error?.message,
    },

    anthropic: {
        name: "Anthropic/Claude",
        baseUrl: "https://api.anthropic.com/v1/messages",
        models: ["claude-sonnet-4-20250514", "claude-haiku-4-20250514"],
        defaultModel: "claude-sonnet-4-20250514",
        authHeader: "x-api-key",
        authPrefix: "",
        extraHeaders: { "anthropic-version": "2023-06-01" },
        formatRequest: (model, system, message, maxTokens) => ({
            model,
            max_tokens: maxTokens,
            ...(system ? { system } : {}),
            messages: [{ role: "user", content: message }],
        }),
        extractResponse: (data) => data.content?.[0]?.text,
        extractError: (data) => data.error?.message,
    },

    gemini: {
        name: "Google Gemini",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        models: ["gemini-2.5-flash", "gemini-2.5-pro"],
        defaultModel: "gemini-2.5-flash",
        authType: "query", // key goes in URL ?key=
        formatRequest: (model, system, message, maxTokens) => ({
            contents: [{ parts: [{ text: (system ? system + "\n\n" : "") + message }] }],
            generationConfig: { maxOutputTokens: maxTokens },
        }),
        extractResponse: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text,
        extractError: (data) => data.error?.message,
    },

    perplexity: {
        name: "Perplexity",
        baseUrl: "https://api.perplexity.ai/chat/completions",
        models: ["sonar-pro", "sonar"],
        defaultModel: "sonar-pro",
        authHeader: "Authorization",
        authPrefix: "Bearer ",
        formatRequest: (model, system, message, maxTokens) => ({
            model,
            messages: [
                ...(system ? [{ role: "system", content: system }] : []),
                { role: "user", content: message },
            ],
            max_tokens: maxTokens,
        }),
        extractResponse: (data) => data.choices?.[0]?.message?.content,
        extractError: (data) => data.error?.message || data.detail,
    },

    huggingface: {
        name: "HuggingFace",
        baseUrl: "https://router.huggingface.co/novita/v3/openai/chat/completions",
        models: ["deepseek/deepseek-r1-0528"],
        defaultModel: "deepseek/deepseek-r1-0528",
        authHeader: "Authorization",
        authPrefix: "Bearer ",
        formatRequest: (model, system, message, maxTokens) => ({
            model,
            messages: [
                ...(system ? [{ role: "system", content: system }] : []),
                { role: "user", content: message },
            ],
            max_tokens: maxTokens,
            stream: false,
        }),
        extractResponse: (data) => data.choices?.[0]?.message?.content,
        extractError: (data) => data.error?.message || data.error,
    },

    groq: {
        name: "Groq",
        baseUrl: "https://api.groq.com/openai/v1/chat/completions",
        models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
        defaultModel: "llama-3.3-70b-versatile",
        authHeader: "Authorization",
        authPrefix: "Bearer ",
        formatRequest: (model, system, message, maxTokens) => ({
            model,
            messages: [
                ...(system ? [{ role: "system", content: system }] : []),
                { role: "user", content: message },
            ],
            max_tokens: maxTokens,
        }),
        extractResponse: (data) => data.choices?.[0]?.message?.content,
        extractError: (data) => data.error?.message,
    },
};

// ═══ Key Health Tracker ═══

class KeyHealth {
    constructor() {
        this.stats = new Map(); // keyId -> { successes, failures, lastSuccess, lastError, avgLatency }
    }

    record(keyId, success, latencyMs, error = null) {
        if (!this.stats.has(keyId)) {
            this.stats.set(keyId, { successes: 0, failures: 0, lastSuccess: 0, lastError: null, avgLatency: 0, totalLatency: 0 });
        }
        const s = this.stats.get(keyId);
        if (success) {
            s.successes++;
            s.lastSuccess = Date.now();
            s.totalLatency += latencyMs;
            s.avgLatency = Math.round(s.totalLatency / s.successes);
        } else {
            s.failures++;
            s.lastError = { message: error, at: Date.now() };
        }
    }

    isHealthy(keyId) {
        const s = this.stats.get(keyId);
        if (!s) return true; // Unknown = try it
        if (s.failures > 3 && s.lastError && (Date.now() - s.lastError.at) < 300000) return false; // 5min cooldown
        return true;
    }

    getStats() {
        const out = {};
        for (const [id, s] of this.stats) out[id] = { ...s };
        return out;
    }
}

// ═══ Provider Connector ═══

class ProviderConnector extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.keys = new Map();     // provider -> [{ id, key, label, account }]
        this.health = new KeyHealth();
        this.timeout = opts.timeout || 120000;
        this.maxTokens = opts.maxTokens || 8192;
    }

    /**
     * Register API keys for a provider.
     * @param {string} provider - Provider name (openai, anthropic, gemini, perplexity, huggingface)
     * @param {Array<{key: string, label: string, account?: string}>} keys - API keys
     */
    addKeys(provider, keys) {
        if (!PROVIDER_CONFIGS[provider]) throw new Error(`Unknown provider: ${provider}`);
        if (!this.keys.has(provider)) this.keys.set(provider, []);
        const existing = this.keys.get(provider);
        for (const k of keys) {
            const id = `${provider}:${k.label}`;
            if (!existing.find((e) => e.id === id)) {
                existing.push({ id, key: k.key, label: k.label, account: k.account || "default" });
            }
        }
        return this;
    }

    /**
     * Load keys from environment variables.
     */
    loadFromEnv() {
        // OpenAI
        if (process.env.OPENAI_API_KEY) this.addKeys("openai", [{ key: process.env.OPENAI_API_KEY, label: "env", account: "env" }]);

        // Anthropic
        if (process.env.ANTHROPIC_API_KEY) this.addKeys("anthropic", [{ key: process.env.ANTHROPIC_API_KEY, label: "env", account: "env" }]);
        if (process.env.CLAUDE_API_KEY) this.addKeys("anthropic", [{ key: process.env.CLAUDE_API_KEY, label: "claude", account: "env" }]);
        if (process.env.CLAUDE_API_KEY_PAYG) this.addKeys("anthropic", [{ key: process.env.CLAUDE_API_KEY_PAYG, label: "payg", account: "env" }]);

        // Gemini
        if (process.env.GEMINI_API_KEY) this.addKeys("gemini", [{ key: process.env.GEMINI_API_KEY, label: "env", account: "env" }]);
        if (process.env.GOOGLE_API_KEY) this.addKeys("gemini", [{ key: process.env.GOOGLE_API_KEY, label: "google", account: "env" }]);
        if (process.env.GOOGLE_CLOUD_API_KEY) this.addKeys("gemini", [{ key: process.env.GOOGLE_CLOUD_API_KEY, label: "gcloud", account: "env" }]);

        // Perplexity
        if (process.env.PERPLEXITY_API_KEY) this.addKeys("perplexity", [{ key: process.env.PERPLEXITY_API_KEY, label: "env", account: "env" }]);

        // HuggingFace
        if (process.env.HUGGINGFACE_TOKEN) this.addKeys("huggingface", [{ key: process.env.HUGGINGFACE_TOKEN, label: "env", account: "env" }]);
        if (process.env.HF_TOKEN) this.addKeys("huggingface", [{ key: process.env.HF_TOKEN, label: "hf", account: "env" }]);

        // Groq
        if (process.env.GROQ_API_KEY) this.addKeys("groq", [{ key: process.env.GROQ_API_KEY, label: "env", account: "env" }]);

        return this;
    }

    /**
     * Call a single provider with failover across its keys.
     */
    async callProvider(provider, message, system = null, opts = {}) {
        const config = PROVIDER_CONFIGS[provider];
        if (!config) throw new Error(`Unknown provider: ${provider}`);
        const keys = this.keys.get(provider) || [];
        if (keys.length === 0) return { provider, ok: false, error: "no keys registered" };

        const model = opts.model || config.defaultModel;
        const maxTokens = opts.maxTokens || this.maxTokens;

        // Try each healthy key
        for (const keyEntry of keys) {
            if (!this.health.isHealthy(keyEntry.id)) continue;

            const start = Date.now();
            try {
                let url = config.baseUrl.replace("{model}", model);
                const headers = { "Content-Type": "application/json", Accept: "application/json" };

                if (config.authType === "query") {
                    url += (url.includes("?") ? "&" : "?") + `key=${keyEntry.key}`;
                } else {
                    headers[config.authHeader] = (config.authPrefix || "") + keyEntry.key;
                }

                if (config.extraHeaders) Object.assign(headers, config.extraHeaders);

                const body = config.formatRequest(model, system, message, maxTokens);
                const res = await fetch(url, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(body),
                    signal: AbortSignal.timeout(this.timeout),
                });

                const ct = res.headers.get("content-type") || "";
                if (!ct.includes("json")) {
                    const txt = await res.text();
                    this.health.record(keyEntry.id, false, Date.now() - start, `non-JSON: ${txt.substring(0, 60)}`);
                    continue; // Try next key
                }

                const data = await res.json();
                const text = config.extractResponse(data);
                const error = config.extractError(data);
                const latency = Date.now() - start;

                if (text) {
                    this.health.record(keyEntry.id, true, latency);
                    this.emit("response", { provider, key: keyEntry.label, account: keyEntry.account, latency, chars: text.length });
                    return {
                        provider: config.name,
                        key: keyEntry.label,
                        account: keyEntry.account,
                        model,
                        response: text,
                        latency,
                        ok: true,
                    };
                }

                this.health.record(keyEntry.id, false, latency, error);
                // Don't continue to next key for auth errors on all keys of same account
            } catch (e) {
                this.health.record(keyEntry.id, false, Date.now() - start, e.message);
            }
        }

        return { provider: config.name, ok: false, error: "all keys exhausted" };
    }

    /**
     * Fan-out: Query ALL providers simultaneously, collect ALL responses.
     * This is the deep research mode — no race, no drops.
     */
    async fanOut(message, system = null, opts = {}) {
        const providers = opts.providers || [...this.keys.keys()];
        const start = Date.now();

        const results = await Promise.allSettled(
            providers.map((p) => this.callProvider(p, message, system, opts))
        );

        const responses = results.map((r) => (r.status === "fulfilled" ? r.value : { ok: false, error: r.reason?.message }));
        const successes = responses.filter((r) => r.ok);
        const totalMs = Date.now() - start;

        this.emit("fanout-complete", {
            total: providers.length,
            succeeded: successes.length,
            totalMs,
            providers: responses.map((r) => ({ provider: r.provider, ok: r.ok, latency: r.latency, chars: r.response?.length })),
        });

        return {
            responses: successes,
            allResponses: responses,
            meta: {
                totalProviders: providers.length,
                succeeded: successes.length,
                totalMs,
                timestamp: new Date().toISOString(),
            },
        };
    }

    /**
     * Fan-out across ALL keys (not just providers) — maximum coverage.
     * Every key gets its own call for maximum determinism data.
     */
    async fanOutAllKeys(message, system = null, opts = {}) {
        const allKeys = [];
        for (const [provider, keys] of this.keys) {
            for (const keyEntry of keys) {
                if (this.health.isHealthy(keyEntry.id)) {
                    allKeys.push({ provider, keyEntry });
                }
            }
        }

        const start = Date.now();
        const model = opts.model; // Let each provider use its default if not specified

        const results = await Promise.allSettled(
            allKeys.map(async ({ provider, keyEntry }) => {
                const config = PROVIDER_CONFIGS[provider];
                const m = model || config.defaultModel;
                const s = Date.now();

                let url = config.baseUrl.replace("{model}", m);
                const headers = { "Content-Type": "application/json", Accept: "application/json" };

                if (config.authType === "query") {
                    url += (url.includes("?") ? "&" : "?") + `key=${keyEntry.key}`;
                } else {
                    headers[config.authHeader] = (config.authPrefix || "") + keyEntry.key;
                }

                if (config.extraHeaders) Object.assign(headers, config.extraHeaders);

                const body = config.formatRequest(m, system, message, opts.maxTokens || this.maxTokens);
                const res = await fetch(url, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(body),
                    signal: AbortSignal.timeout(this.timeout),
                });

                const ct = res.headers.get("content-type") || "";
                if (!ct.includes("json")) throw new Error("non-JSON response");

                const data = await res.json();
                const text = config.extractResponse(data);
                if (!text) throw new Error(config.extractError(data) || "empty response");

                this.health.record(keyEntry.id, true, Date.now() - s);
                return {
                    provider: config.name,
                    key: keyEntry.label,
                    account: keyEntry.account,
                    model: m,
                    response: text,
                    latency: Date.now() - s,
                    ok: true,
                };
            })
        );

        const responses = results.map((r, i) => {
            if (r.status === "fulfilled") return r.value;
            const { provider, keyEntry } = allKeys[i];
            this.health.record(keyEntry.id, false, 0, r.reason?.message);
            return {
                provider: PROVIDER_CONFIGS[provider].name,
                key: keyEntry.label,
                account: keyEntry.account,
                ok: false,
                error: r.reason?.message,
            };
        });

        const successes = responses.filter((r) => r.ok);

        return {
            responses: successes,
            allResponses: responses,
            meta: {
                totalKeys: allKeys.length,
                succeeded: successes.length,
                totalMs: Date.now() - start,
                timestamp: new Date().toISOString(),
            },
        };
    }

    /**
     * Get connector status — all providers, keys, and health.
     */
    status() {
        const providers = {};
        for (const [p, keys] of this.keys) {
            providers[p] = {
                name: PROVIDER_CONFIGS[p].name,
                keys: keys.map((k) => ({
                    label: k.label,
                    account: k.account,
                    healthy: this.health.isHealthy(k.id),
                    stats: this.health.stats.get(k.id) || null,
                })),
                models: PROVIDER_CONFIGS[p].models,
            };
        }
        return { providers, totalKeys: [...this.keys.values()].reduce((s, k) => s + k.length, 0) };
    }
}

module.exports = { ProviderConnector, PROVIDER_CONFIGS, KeyHealth };
