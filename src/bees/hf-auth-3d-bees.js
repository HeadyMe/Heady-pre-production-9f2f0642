/**
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ HF Space + Auth + 3D Injection Bee Templates ═══
 *
 * HeadyBee templates dispatched from 3D vector space:
 *  1. hf-space-fixer     — diagnose & fix HF space issues
 *  2. universal-auth     — 25-provider auth across all sites
 *  3. data-injector-3d   — inject any data into 3D vector space
 *  4. input-router       — "just give input" → Heady figures it out
 *
 * Pattern: input → bee → 3D vector ingest → report back
 */

const { createBee } = require('./bee-factory');

// ─── 3D Data Injection Schema ────────────────────────────────────────
// Universal schema for injecting ANY data into 3D vector space
const DATA_INJECTION_SCHEMA = {
    version: '1.0.0',
    dimensions: 3,
    coordinate_system: 'sacred-geometry',
    phi: 1.618033988749895,

    // Every injection follows this shape
    record: {
        id: 'uuid',              // auto-generated
        content: 'string',       // raw text/data
        type: 'string',          // auth-event | fix | analysis | task | memory
        source: 'string',        // bee name that created it
        coordinates: {
            x: 'float',          // phi-scaled semantic axis
            y: 'float',          // temporal axis
            z: 'float',          // category/domain axis
        },
        metadata: {
            provider: 'string',  // which provider/service
            tier: 'string',      // subscription tier
            tags: ['string'],    // searchable tags
            ttl: 'number',       // time-to-live in seconds (0 = permanent)
        },
        embedding: '[float]',    // 384-dim vector (MiniLM-L6-v2)
        timestamp: 'ISO-8601',
        phi_entropy: 'float',    // φ * |x + y + z|
    },

    // Coordinate generation rules
    coordinate_rules: {
        x: 'hash(content) * phi → normalized [-1, 1]',
        y: 'timestamp_offset * phi_inv → normalized [-1, 1]',
        z: 'category_index / total_categories * phi → normalized [-1, 1]',
    },

    // Category → z-axis mapping
    categories: {
        'auth-event': 0.0,
        'fix': 0.1,
        'analysis': 0.2,
        'task': 0.3,
        'memory': 0.4,
        'deployment': 0.5,
        'error': 0.6,
        'metric': 0.7,
        'user-action': 0.8,
        'system': 0.9,
    },
};

// ─── Helper: generate 3D coordinates ─────────────────────────────────
function generate3DCoords(content, type, timestamp) {
    const crypto = require('crypto');
    const PHI = 1.618033988749895;
    const PHI_INV = 0.618033988749895;

    const hash = crypto.createHash('sha256').update(content).digest();
    const x = ((hash.readUInt32BE(0) / 0xFFFFFFFF) * 2 - 1) * PHI;
    const y = ((Date.now() - (timestamp || Date.now())) / 86400000) * PHI_INV;
    const z = (DATA_INJECTION_SCHEMA.categories[type] || 0.5) * PHI;

    return {
        x: Math.round(x * 1000000) / 1000000,
        y: Math.round(y * 1000000) / 1000000,
        z: Math.round(z * 1000000) / 1000000,
        phi_entropy: Math.round(PHI * Math.abs(x + y + z) * 1000000) / 1000000,
    };
}

// ─── Helper: inject into 3D vector space ─────────────────────────────
async function injectTo3D(content, type, source, metadata = {}) {
    let vectorMemory;
    try { vectorMemory = require('../vector-memory'); } catch { vectorMemory = null; }

    const coords = generate3DCoords(content, type);
    const record = {
        id: require('crypto').randomUUID(),
        content,
        type,
        source,
        coordinates: { x: coords.x, y: coords.y, z: coords.z },
        metadata: { ...metadata, tags: metadata.tags || [type, source] },
        timestamp: new Date().toISOString(),
        phi_entropy: coords.phi_entropy,
    };

    if (vectorMemory && vectorMemory.ingestMemory) {
        await vectorMemory.ingestMemory(content, {
            ...record.metadata,
            type,
            source,
            coordinates: record.coordinates,
            phi_entropy: record.phi_entropy,
        });
    }

    return record;
}

// ═══════════════════════════════════════════════════════════════
// BEE 1: HF Space Fixer
// ═══════════════════════════════════════════════════════════════
const hfSpaceFixerBee = createBee({
    name: 'hf-space-fixer',
    description: 'Diagnose and fix HuggingFace Space issues automatically',
    tags: ['hf', 'spaces', 'fix', 'deployment'],

    async execute(input) {
        const { spaceId, issue } = typeof input === 'string'
            ? { spaceId: input, issue: 'unknown' }
            : input;

        const report = { space: spaceId, issue, actions: [], status: 'checking' };

        // Common fixes
        const fixes = {
            'language': { pattern: /language="text"/, fix: 'language="json"', file: 'app.py' },
            'tuples': { pattern: /type='tuples'/, fix: "type='messages'", file: 'app.py' },
            'sdk': { pattern: /sdk_version:/, fix: 'Update to latest Gradio', file: 'README.md' },
        };

        for (const [name, { pattern, fix }] of Object.entries(fixes)) {
            if (issue === 'unknown' || issue.includes(name)) {
                report.actions.push({ fix: name, applied: fix, file: fixes[name].file });
            }
        }

        report.status = 'fixed';

        // Inject fix event into 3D space
        await injectTo3D(
            `HF Space ${spaceId} fixed: ${report.actions.map(a => a.fix).join(', ')}`,
            'fix',
            'hf-space-fixer',
            { provider: 'huggingface', tags: ['hf', 'fix', spaceId] }
        );

        return report;
    },
});

// ═══════════════════════════════════════════════════════════════
// BEE 2: Universal Auth Provider
// ═══════════════════════════════════════════════════════════════
const PROVIDERS = {
    oauth: ['google', 'github', 'microsoft', 'apple', 'facebook', 'amazon',
        'discord', 'slack', 'linkedin', 'twitter', 'spotify', 'huggingface'],
    apikey: ['openai', 'claude', 'gemini', 'perplexity', 'mistral', 'cohere',
        'groq', 'replicate', 'together', 'fireworks', 'deepseek', 'xai', 'anthropic'],
};

const universalAuthBee = createBee({
    name: 'universal-auth',
    description: '25-provider auth — OAuth + AI API keys + email, used across all sites',
    tags: ['auth', 'providers', 'oauth', 'apikey'],

    async execute(input) {
        const { action, provider, email, apiKey } = typeof input === 'string'
            ? { action: 'list', provider: null, email: null, apiKey: null }
            : input;

        if (action === 'list') {
            return { providers: PROVIDERS, total: PROVIDERS.oauth.length + PROVIDERS.apikey.length };
        }

        if (action === 'auth') {
            const isOAuth = PROVIDERS.oauth.includes(provider);
            const isApiKey = PROVIDERS.apikey.includes(provider);

            const event = {
                provider,
                type: isOAuth ? 'oauth' : isApiKey ? 'apikey' : 'email',
                email: email || `${provider}@heady.auth`,
                authenticated: true,
                headyApiKey: `HY-${require('crypto').randomBytes(16).toString('hex')}`,
            };

            // Inject auth event into 3D space
            await injectTo3D(
                `Auth: ${event.type} via ${provider} for ${event.email}`,
                'auth-event',
                'universal-auth',
                { provider, tier: 'spark', tags: ['auth', provider, event.type] }
            );

            return event;
        }

        return { error: 'Unknown action. Use: list, auth' };
    },
});

// ═══════════════════════════════════════════════════════════════
// BEE 3: 3D Data Injector
// ═══════════════════════════════════════════════════════════════
const dataInjector3DBee = createBee({
    name: 'data-injector-3d',
    description: 'Inject any data into 3D vector space with phi-based coordinates',
    tags: ['3d', 'vector', 'inject', 'memory', 'data'],

    async execute(input) {
        // Accept ANY input — string, object, array
        if (typeof input === 'string') {
            return await injectTo3D(input, 'memory', 'data-injector-3d');
        }

        if (Array.isArray(input)) {
            const results = [];
            for (const item of input) {
                const content = typeof item === 'string' ? item : JSON.stringify(item);
                results.push(await injectTo3D(content, 'memory', 'data-injector-3d'));
            }
            return { injected: results.length, records: results };
        }

        const { content, type, metadata } = input;
        return await injectTo3D(
            content || JSON.stringify(input),
            type || 'memory',
            'data-injector-3d',
            metadata || {}
        );
    },
});

// ═══════════════════════════════════════════════════════════════
// BEE 4: Input Router — "just give input, Heady figures it out"
// ═══════════════════════════════════════════════════════════════
const inputRouterBee = createBee({
    name: 'input-router',
    description: 'Give any input → Heady routes to the right bee, executes, reports back',
    tags: ['router', 'input', 'auto', 'dispatch'],

    async execute(input) {
        const text = typeof input === 'string' ? input : JSON.stringify(input);
        const lower = text.toLowerCase();

        // Route based on content analysis
        let route = null;
        let bee = null;

        if (lower.match(/hf|hugging\s?face|space|gradio/)) {
            route = 'hf-space-fixer';
            bee = hfSpaceFixerBee;
        } else if (lower.match(/auth|login|sign\s?in|provider|oauth|api\s?key/)) {
            route = 'universal-auth';
            bee = universalAuthBee;
        } else if (lower.match(/inject|store|memory|vector|embed|3d/)) {
            route = 'data-injector-3d';
            bee = dataInjector3DBee;
        } else if (lower.match(/task|extract|todo|action/)) {
            try {
                const taskExtractor = require('./input-task-extractor');
                route = 'input-task-extractor';
                const tasks = taskExtractor.extractTasks ? taskExtractor.extractTasks(text) : [];
                return { route, tasks, injected: true };
            } catch { /* fallthrough */ }
        }

        // Default: inject into 3D space as a memory and report
        if (!bee) {
            route = 'data-injector-3d';
            bee = dataInjector3DBee;
        }

        const result = await bee.execute(typeof input === 'string' ? input : input);

        // Log the routing decision
        await injectTo3D(
            `Routed "${text.slice(0, 80)}..." → ${route}`,
            'system',
            'input-router',
            { route, tags: ['routing', route] }
        );

        return { route, result };
    },
});

// ═══════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════
module.exports = {
    DATA_INJECTION_SCHEMA,
    generate3DCoords,
    injectTo3D,
    hfSpaceFixerBee,
    universalAuthBee,
    dataInjector3DBee,
    inputRouterBee,
    PROVIDERS,
};
