/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * AI Inference Gateway — Multi-provider, credit-aware, latency-optimized.
 *
 * Routes requests to the optimal AI provider based on:
 *   1. Task complexity & context window needs
 *   2. Credit balance / cost optimization
 *   3. Latency requirements
 *   4. Provider availability
 *
 * Priority order (burn free resources first):
 *   Groq (free/fast) → Gemini (GCloud credits) → Claude (membership/API) → OpenAI (fallback)
 *
 * Supports parallel "race" mode for instantaneous response.
 */
const EventEmitter = require('events');
const logger = require('./utils/logger');

// ─── Provider Definitions ───────────────────────────────────────
const PROVIDERS = {
    groq: {
        name: 'Groq',
        tier: 'speed',
        costPerMTok: 0,  // free tier
        latencyMs: 100,  // ultra-fast inference
        maxContext: 128000,
        envKey: 'GROQ_API_KEY',
        models: {
            fast: 'llama-3.1-70b-versatile',
            small: 'llama-3.1-8b-instant',
            default: 'llama-3.1-70b-versatile',
        },
        async complete(messages, opts = {}) {
            const apiKey = process.env.GROQ_API_KEY;
            if (!apiKey) throw new Error('GROQ_API_KEY not set');
            const model = opts.model || this.models[opts.tier] || this.models.default;
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model, messages,
                    max_tokens: opts.maxTokens || 4096,
                    temperature: opts.temperature ?? 0.7,
                    stream: false,
                }),
            });
            if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
            const data = await res.json();
            return {
                content: data.choices[0].message.content,
                model: data.model,
                provider: 'groq',
                usage: data.usage,
                latencyMs: data.usage?.total_time ? Math.round(data.usage.total_time * 1000) : null,
            };
        },
    },

    gemini: {
        name: 'Gemini (GCloud)',
        tier: 'credits',
        costPerMTok: 0.075, // paid via $530 GCloud credits
        latencyMs: 300,
        maxContext: 1000000, // 1M context window
        envKey: 'GOOGLE_API_KEY',
        models: {
            fast: 'gemini-2.0-flash',
            quality: 'gemini-1.5-pro',
            default: 'gemini-2.0-flash',
        },
        async complete(messages, opts = {}) {
            const apiKey = process.env.GOOGLE_API_KEY;
            if (!apiKey) throw new Error('GOOGLE_API_KEY not set');
            const model = opts.model || this.models[opts.tier] || this.models.default;
            // Convert OpenAI-style messages to Gemini format
            const contents = messages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }));
            // Extract system instruction
            const systemMsg = messages.find(m => m.role === 'system');
            const nonSystemContents = contents.filter((_, i) => messages[i].role !== 'system');

            const body = { contents: nonSystemContents, generationConfig: { maxOutputTokens: opts.maxTokens || 4096, temperature: opts.temperature ?? 0.7 } };
            if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return {
                content: text,
                model,
                provider: 'gemini',
                usage: data.usageMetadata || null,
            };
        },
    },

    claude: {
        name: 'Claude (Anthropic)',
        tier: 'quality',
        costPerMTok: 3.0,  // Sonnet pricing
        latencyMs: 800,
        maxContext: 200000,
        envKey: 'ANTHROPIC_API_KEY',
        models: {
            fast: 'claude-3-haiku-20240307',
            quality: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
            default: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
        },
        async complete(messages, opts = {}) {
            // Try secondary key first to save primary for interactive
            const apiKey = (opts.useSecondary && process.env.ANTHROPIC_SECONDARY_KEY)
                || process.env.ANTHROPIC_API_KEY;
            if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
            const model = opts.model || this.models[opts.tier] || this.models.default;
            const systemMsg = messages.find(m => m.role === 'system');
            const chatMessages = messages.filter(m => m.role !== 'system');

            const body = {
                model,
                max_tokens: opts.maxTokens || parseInt(process.env.CLAUDE_MAX_TOKENS) || 4096,
                messages: chatMessages,
            };
            if (systemMsg) body.system = systemMsg.content;

            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(`Claude ${res.status}: ${err.error?.message || res.statusText}`);
            }
            const data = await res.json();
            return {
                content: data.content?.[0]?.text || '',
                model: data.model,
                provider: 'claude',
                usage: data.usage,
            };
        },
    },

    openai: {
        name: 'OpenAI (Business)',
        tier: 'diversity',
        costPerMTok: 2.5,  // GPT-4o — business seat may include credits
        latencyMs: 600,
        maxContext: 128000,
        envKey: 'OPENAI_API_KEY',
        models: {
            fast: 'gpt-4o-mini',
            quality: 'gpt-4o',
            default: 'gpt-4o',
        },
        async complete(messages, opts = {}) {
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) throw new Error('OPENAI_API_KEY not set');
            const model = opts.model || this.models[opts.tier] || this.models.default;
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model, messages,
                    max_tokens: opts.maxTokens || 4096,
                    temperature: opts.temperature ?? 0.7,
                }),
            });
            if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
            const data = await res.json();
            return {
                content: data.choices[0].message.content,
                model: data.model,
                provider: 'openai',
                usage: data.usage,
            };
        },
    },

    huggingface: {
        name: 'Hugging Face (Business)',
        tier: 'value',
        costPerMTok: 0,  // business seat includes inference
        latencyMs: 500,
        maxContext: 32000,
        envKey: 'HF_TOKEN',
        models: {
            fast: 'meta-llama/Llama-3.1-8B-Instruct',
            quality: 'meta-llama/Llama-3.1-70B-Instruct',
            default: 'meta-llama/Llama-3.1-70B-Instruct',
        },
        async complete(messages, opts = {}) {
            const apiKey = process.env.HF_TOKEN || process.env.HF_API_KEY;
            if (!apiKey) throw new Error('HF_TOKEN not set');
            const model = opts.model || this.models[opts.tier] || this.models.default;
            const res = await fetch(`https://api-inference.huggingface.co/models/${model}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model, messages,
                    max_tokens: opts.maxTokens || 4096,
                    temperature: opts.temperature ?? 0.7,
                    stream: false,
                }),
            });
            if (!res.ok) throw new Error(`HuggingFace ${res.status}: ${await res.text()}`);
            const data = await res.json();
            return {
                content: data.choices?.[0]?.message?.content || '',
                model,
                provider: 'huggingface',
                usage: data.usage || null,
            };
        },
    },
};

// ─── Inference Gateway ──────────────────────────────────────────
class InferenceGateway extends EventEmitter {
    constructor() {
        super();
        this.stats = { total: 0, byProvider: {}, errors: 0, raceModeWins: {} };
        this.circuitBreakers = {}; // provider -> { failures, lastFailure, open }
        this.CIRCUIT_THRESHOLD = 3; // failures before opening circuit
        this.CIRCUIT_RESET_MS = 60000; // 1 min reset
    }

    // Get available providers (key set + circuit closed)
    getAvailable() {
        const available = [];
        for (const [key, provider] of Object.entries(PROVIDERS)) {
            if (!process.env[provider.envKey]) continue;
            const cb = this.circuitBreakers[key];
            if (cb && cb.open && (Date.now() - cb.lastFailure < this.CIRCUIT_RESET_MS)) continue;
            available.push(key);
        }
        return available;
    }

    // Select optimal provider based on request context
    selectProvider(opts = {}) {
        const available = this.getAvailable();
        if (available.length === 0) throw new Error('No AI providers available');

        // Explicit provider request
        if (opts.provider && available.includes(opts.provider)) return opts.provider;

        // Task-based routing
        const complexity = opts.complexity || 5;
        const contextLength = opts.contextLength || 0;

        // Route based on strategy
        if (complexity <= 3 && available.includes('groq')) return 'groq';
        if (contextLength > 100000 && available.includes('gemini')) return 'gemini';
        if (opts.bulk && available.includes('gemini')) return 'gemini';
        if (opts.quality && available.includes('claude')) return 'claude';
        if (opts.battle) return null; // null = race mode

        // Default priority cascade: free/included → credits → paid API
        // Groq (free) → HF (business seat) → Gemini (GCloud $530) → OpenAI (business seat) → Claude (API $60)
        const priority = ['groq', 'huggingface', 'gemini', 'openai', 'claude'];
        return priority.find(p => available.includes(p)) || available[0];
    }

    // Single-provider completion
    async complete(messages, opts = {}) {
        const provider = this.selectProvider(opts);
        if (provider === null) return this.race(messages, opts);

        const start = Date.now();
        try {
            const result = await PROVIDERS[provider].complete(messages, opts);
            result.gatewayLatencyMs = Date.now() - start;
            this._recordSuccess(provider);
            this.emit('complete', { provider, latencyMs: result.gatewayLatencyMs });
            return result;
        } catch (err) {
            this._recordFailure(provider, err);
            // Fallback to next available
            const fallback = this.getAvailable().filter(p => p !== provider);
            if (fallback.length > 0) {
                logger.warn(`[InferenceGateway] ${provider} failed, falling back to ${fallback[0]}`, { error: err.message });
                return this.complete(messages, { ...opts, provider: fallback[0] });
            }
            throw err;
        }
    }

    // Race mode — fire at multiple providers, return fastest
    async race(messages, opts = {}) {
        const available = this.getAvailable();
        if (available.length === 0) throw new Error('No providers available for race');
        const racers = available.slice(0, Math.min(3, available.length)); // race up to 3

        logger.info(`[InferenceGateway] 🏁 Race mode: ${racers.join(' vs ')}`);
        const start = Date.now();

        const racePromises = racers.map(provider =>
            PROVIDERS[provider].complete(messages, { ...opts, tier: 'fast' })
                .then(result => {
                    result.gatewayLatencyMs = Date.now() - start;
                    result.raceWinner = true;
                    this._recordSuccess(provider);
                    return result;
                })
                .catch(err => {
                    this._recordFailure(provider, err);
                    return null; // don't reject, let others win
                })
        );

        // Promise.any — first non-null wins
        const results = await Promise.allSettled(racePromises);
        const winner = results.find(r => r.status === 'fulfilled' && r.value);
        if (!winner) throw new Error('All race participants failed');

        const result = winner.value;
        this.stats.raceModeWins[result.provider] = (this.stats.raceModeWins[result.provider] || 0) + 1;
        this.emit('race_complete', { winner: result.provider, latencyMs: result.gatewayLatencyMs, racers });
        return result;
    }

    // Battle mode — run all providers, return all results for comparison
    async battle(messages, opts = {}) {
        const available = this.getAvailable();
        logger.info(`[InferenceGateway] ⚔️ Battle mode: ${available.join(', ')}`);

        const results = await Promise.allSettled(
            available.map(provider =>
                PROVIDERS[provider].complete(messages, { ...opts, tier: 'quality' })
                    .then(result => ({ ...result, provider }))
            )
        );

        return results
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value);
    }

    // Circuit breaker helpers
    _recordSuccess(provider) {
        this.stats.total++;
        this.stats.byProvider[provider] = (this.stats.byProvider[provider] || 0) + 1;
        this.circuitBreakers[provider] = { failures: 0, lastFailure: 0, open: false };
    }

    _recordFailure(provider, err) {
        this.stats.errors++;
        const cb = this.circuitBreakers[provider] || { failures: 0, lastFailure: 0, open: false };
        cb.failures++;
        cb.lastFailure = Date.now();
        if (cb.failures >= this.CIRCUIT_THRESHOLD) {
            cb.open = true;
            logger.error(`[InferenceGateway] Circuit OPEN for ${provider}`, { failures: cb.failures, error: err.message });
        }
        this.circuitBreakers[provider] = cb;
    }

    getStatus() {
        const providers = {};
        for (const [key, p] of Object.entries(PROVIDERS)) {
            const cb = this.circuitBreakers[key] || { failures: 0, open: false };
            providers[key] = {
                name: p.name,
                tier: p.tier,
                configured: !!process.env[p.envKey],
                circuitOpen: cb.open,
                failures: cb.failures,
                requests: this.stats.byProvider[key] || 0,
                costPerMTok: `$${p.costPerMTok}`,
                latencyEstMs: p.latencyMs,
                maxContext: p.maxContext,
            };
        }
        return {
            totalRequests: this.stats.total,
            errors: this.stats.errors,
            raceModeWins: this.stats.raceModeWins,
            providers,
        };
    }
}

// ─── Express Routes ─────────────────────────────────────────────
function registerGatewayRoutes(app, gateway) {
    // POST /api/ai/complete — intelligent routed completion
    app.post('/api/ai/complete', async (req, res) => {
        try {
            const { messages, provider, complexity, quality, battle, maxTokens, temperature } = req.body;
            if (!messages?.length) return res.status(400).json({ error: 'messages required' });

            const result = await gateway.complete(messages, { provider, complexity, quality, battle, maxTokens, temperature });
            res.json({ ok: true, ...result });
        } catch (err) {
            logger.error('[AI Gateway] Completion failed', { error: err.message });
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/ai/race — race mode (fastest wins)
    app.post('/api/ai/race', async (req, res) => {
        try {
            const { messages, maxTokens, temperature } = req.body;
            if (!messages?.length) return res.status(400).json({ error: 'messages required' });
            const result = await gateway.race(messages, { maxTokens, temperature });
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/ai/battle — all providers compete
    app.post('/api/ai/battle', async (req, res) => {
        try {
            const { messages, maxTokens, temperature } = req.body;
            if (!messages?.length) return res.status(400).json({ error: 'messages required' });
            const results = await gateway.battle(messages, { maxTokens, temperature });
            res.json({ ok: true, results, count: results.length });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET /api/ai/status — gateway health & stats
    app.get('/api/ai/status', (req, res) => {
        res.json({ ok: true, ...gateway.getStatus() });
    });

    // GET /api/ai/providers — list configured providers
    app.get('/api/ai/providers', (req, res) => {
        const providers = {};
        for (const [key, p] of Object.entries(PROVIDERS)) {
            providers[key] = {
                name: p.name,
                tier: p.tier,
                configured: !!process.env[p.envKey],
                maxContext: p.maxContext,
                models: Object.entries(p.models).map(([tier, model]) => ({ tier, model })),
            };
        }
        res.json({ ok: true, providers });
    });

    logger.info('[AI Gateway] Routes registered: /api/ai/complete, /api/ai/race, /api/ai/battle, /api/ai/status, /api/ai/providers');
}

module.exports = { InferenceGateway, registerGatewayRoutes, PROVIDERS };
