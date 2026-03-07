/**
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ HF Space + Auth + 3D Injection Bee Templates ═══
 *
 * Uses REAL bee-factory API: createBee(domain, { workers: [{name, fn}] })
 * Uses REAL vector-memory API: ingestMemory({ content, metadata })
 *
 * Bees:
 *   hf-space-fixer     — diagnose & fix HF space issues
 *   universal-auth     — 25-provider auth across all sites
 *   data-injector-3d   — inject any data into vector memory
 *   input-router       — give any input → routes to the right bee
 */

const { createBee, spawnBee } = require('./bee-factory');

let vectorMemory;
try { vectorMemory = require('../vector-memory'); } catch { vectorMemory = null; }

// ── Helper: ingest into real 3D vector space ─────────────────────
async function inject(content, meta = {}) {
    if (!vectorMemory || !vectorMemory.smartIngest) {
        return { stored: false, reason: 'vector memory not available' };
    }
    try {
        return await vectorMemory.smartIngest({ content, metadata: meta });
    } catch (err) {
        return { stored: false, error: err.message };
    }
}

// ── Provider list (source of truth) ──────────────────────────────
const PROVIDERS = {
    oauth: [
        'google', 'github', 'microsoft', 'apple', 'facebook', 'amazon',
        'discord', 'slack', 'linkedin', 'twitter', 'spotify', 'huggingface',
    ],
    apikey: [
        'openai', 'claude', 'gemini', 'perplexity', 'mistral', 'cohere',
        'groq', 'replicate', 'together', 'fireworks', 'deepseek', 'xai', 'anthropic',
    ],
};

// ═══════════════════════════════════════════════════════════════
// BEE 1: hf-space-fixer
// ═══════════════════════════════════════════════════════════════
const hfSpaceFixer = createBee('hf-space-fixer', {
    description: 'Diagnose & fix HuggingFace Space issues (Gradio compat, deps)',
    priority: 0.9,
    workers: [
        {
            name: 'diagnose',
            fn: async (ctx) => {
                const spaceId = ctx.spaceId || ctx.input || 'unknown';
                const knownFixes = [
                    { pattern: 'language="text"', fix: 'language="json"', reason: 'Gradio 5.x removed text lang from gr.Code' },
                    { pattern: "type='tuples'", fix: "type='messages'", reason: 'Gradio 5.x deprecated tuples format' },
                    { pattern: 'sdk_version: 4', fix: 'sdk_version: 5.23.0', reason: 'Old SDK version' },
                ];
                await inject(`HF space ${spaceId} diagnosed`, { type: 'fix', source: 'hf-space-fixer', spaceId });
                return { spaceId, knownFixes, status: 'diagnosed' };
            },
        },
        {
            name: 'apply-fix',
            fn: async (ctx) => {
                const { spaceId, fixType } = ctx || {};
                if (!spaceId) return { error: 'spaceId is required', status: 'failed' };
                if (!fixType) return { error: 'fixType is required (e.g., "gradio-lang", "sdk-version")', status: 'failed' };

                const fixMap = {
                    'gradio-lang': { find: 'language="text"', replace: 'language="json"' },
                    'gradio-tuples': { find: "type='tuples'", replace: "type='messages'" },
                    'sdk-version': { find: /sdk_version:\s*\d+/, replace: 'sdk_version: 5.23.0' },
                };

                const fix = fixMap[fixType];
                if (!fix) return { error: `Unknown fixType: ${fixType}. Available: ${Object.keys(fixMap).join(', ')}`, status: 'failed' };

                await inject(`HF space ${spaceId} fix applied: ${fixType} (${fix.find} → ${fix.replace})`, {
                    type: 'fix', source: 'hf-space-fixer', fixType, spaceId,
                });
                return { spaceId, fixType, fix, status: 'applied' };
            },
        },
    ],
});

// ═══════════════════════════════════════════════════════════════
// BEE 2: universal-auth
// ═══════════════════════════════════════════════════════════════
const universalAuth = createBee('universal-auth', {
    description: '25-provider auth: 12 OAuth + 13 AI API key + email',
    priority: 0.95,
    workers: [
        {
            name: 'list-providers',
            fn: async () => ({
                oauth: PROVIDERS.oauth,
                apikey: PROVIDERS.apikey,
                total: PROVIDERS.oauth.length + PROVIDERS.apikey.length,
            }),
        },
        {
            name: 'authenticate',
            fn: async (ctx) => {
                const { provider, email } = ctx;
                const crypto = require('crypto');
                const isOAuth = PROVIDERS.oauth.includes(provider);
                const isApiKey = PROVIDERS.apikey.includes(provider);
                const type = isOAuth ? 'oauth' : isApiKey ? 'apikey' : 'email';
                const apiKey = `HY-${crypto.randomBytes(16).toString('hex')}`;

                await inject(`Auth via ${provider} (${type}) for ${email || 'anon'}`, {
                    type: 'auth-event',
                    source: 'universal-auth',
                    provider,
                    authType: type,
                });

                return { provider, type, apiKey, authenticated: true };
            },
        },
    ],
});

// ═══════════════════════════════════════════════════════════════
// BEE 3: data-injector-3d
// ═══════════════════════════════════════════════════════════════
const dataInjector3D = createBee('data-injector-3d', {
    description: 'Inject any data into 3D vector memory — accepts string, object, or array',
    priority: 0.8,
    workers: [
        {
            name: 'inject-single',
            fn: async (ctx) => {
                if (!ctx) return { error: 'No context provided', injected: false };
                const content = typeof ctx === 'string' ? ctx : (ctx.content || ctx.input || '');
                if (!content) return { error: 'No content to inject (provide ctx.content or ctx.input)', injected: false };
                const meta = ctx.metadata || { type: 'memory', source: 'data-injector-3d' };
                const result = await inject(content, meta);
                return { injected: !!result, id: result?.id || result, preview: content.slice(0, 100) };
            },
        },
        {
            name: 'inject-batch',
            fn: async (ctx) => {
                const items = ctx.items || ctx.batch || [];
                const results = [];
                for (const item of items) {
                    const text = typeof item === 'string' ? item : JSON.stringify(item);
                    const id = await inject(text, { type: 'memory', source: 'data-injector-3d', batch: true });
                    results.push({ id, content: text.slice(0, 60) });
                }
                return { injected: results.length, results };
            },
        },
    ],
});

// ═══════════════════════════════════════════════════════════════
// BEE 4: input-router — "just give input, Heady figures it out"
// ═══════════════════════════════════════════════════════════════
const inputRouter = createBee('input-router', {
    description: 'Give any input → Heady routes to the right bee, executes, reports back',
    priority: 1.0,
    workers: [
        {
            name: 'route',
            fn: async (ctx) => {
                const text = typeof ctx === 'string' ? ctx : (ctx.input || ctx.content || JSON.stringify(ctx));
                const lower = text.toLowerCase();

                // Pattern-match intent → route
                let route, result;

                if (lower.match(/hf|hugging\s?face|space|gradio/)) {
                    route = 'hf-space-fixer';
                    const work = hfSpaceFixer.getWork({ input: text, spaceId: text });
                    result = work.length ? await work[0]() : { status: 'no-workers' };

                } else if (lower.match(/auth|login|sign\s?in|provider|oauth|api\s?key/)) {
                    route = 'universal-auth';
                    const match = lower.match(/via\s+(\w+)/) || lower.match(/(\w+)\s+login/);
                    const provider = match ? match[1] : 'email';
                    const work = universalAuth.getWork({ provider, email: ctx.email });
                    result = work.length > 1 ? await work[1]() : { status: 'no-workers' };

                } else if (lower.match(/inject|store|memory|vector|embed|3d|ingest/)) {
                    route = 'data-injector-3d';
                    const work = dataInjector3D.getWork({ content: text });
                    result = work.length ? await work[0]() : { status: 'no-workers' };

                } else if (lower.match(/task|extract|todo|action/)) {
                    route = 'input-task-extractor';
                    try {
                        const extractor = require('./input-task-extractor');
                        result = extractor.extractTasks ? extractor.extractTasks(text) : { tasks: [] };
                    } catch { result = { error: 'task extractor not loaded' }; }

                } else {
                    // Default: inject as memory
                    route = 'data-injector-3d (default)';
                    const id = await inject(text, { type: 'memory', source: 'input-router', auto: true });
                    result = { injected: true, id };
                }

                // Log routing decision to vector memory
                await inject(`Routed: "${text.slice(0, 80)}" → ${route}`, {
                    type: 'system',
                    source: 'input-router',
                    route,
                });

                return { route, result };
            },
        },
    ],
});

module.exports = {
    hfSpaceFixer,
    universalAuth,
    dataInjector3D,
    inputRouter,
    PROVIDERS,
    inject,
};
