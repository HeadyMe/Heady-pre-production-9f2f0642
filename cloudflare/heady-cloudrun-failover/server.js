/**
 * ═══ Heady Edge Gateway — Cloud Run Liquid Failover Node ═══
 *
 * Production AI gateway on Google Cloud Run.
 * Mirrors the Cloudflare Worker edge gateway with full provider racing,
 * identity scrubbing, and caching — adapted for standard Node.js runtime.
 *
 * Liquidity pair: Cloudflare Worker ↔ GCloud Cloud Run
 * When one is down, the other serves. Always-available AI gateway.
 */

const http = require('http');
const PORT = process.env.PORT || 8080;

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Heady-API-Key, X-Heady-Source, X-Heady-SDK',
    'Content-Type': 'application/json',
    'X-Heady-Edge': 'gcloud-cloudrun',
    'X-Heady-Liquid': 'failover-active',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff'
};

// ── Provider Calls ──

async function callGemini(apiKey, message, system, temperature, maxTokens) {
    const prompt = system ? `${system}\n\n${message}` : message;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: temperature || 0.7, maxOutputTokens: maxTokens || 2048 }
        })
    });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error(data.error?.message || 'gemini-empty');
    return { response: text, model: 'gemini-2.5-flash' };
}

async function callClaude(apiKey, message, system, temperature, maxTokens) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514', max_tokens: maxTokens || 2048,
            system: system || 'You are HeadyBrain, the AI reasoning engine.',
            messages: [{ role: 'user', content: message }]
        })
    });
    const data = await res.json();
    const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('');
    if (!text) throw new Error(data.error?.message || 'claude-empty');
    return { response: text, model: data.model || 'claude-sonnet' };
}

async function callOpenAI(apiKey, message, system, temperature, maxTokens) {
    const msgs = [
        { role: 'system', content: system || 'You are HeadyBrain, the AI reasoning engine.' },
        { role: 'user', content: message }
    ];
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: msgs, temperature: temperature || 0.7, max_tokens: maxTokens || 2048 })
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error(data.error?.message || 'openai-empty');
    return { response: text, model: data.model || 'gpt-4o-mini' };
}

async function callHuggingFace(token, message, system, temperature, maxTokens) {
    const msgs = [];
    if (system) msgs.push({ role: 'system', content: system });
    msgs.push({ role: 'user', content: message });
    const res = await fetch('https://router.huggingface.co/novita/v3/openai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ model: 'Qwen/Qwen3-235B-A22B', messages: msgs, temperature: temperature || 0.7, max_tokens: maxTokens || 2048 })
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('hf-empty');
    return { response: text, model: 'qwen3-235b' };
}

async function callGroq(apiKey, message, system, temperature, maxTokens) {
    const msgs = [
        { role: 'system', content: system || 'You are HeadyBrain, the AI reasoning engine.' },
        { role: 'user', content: message }
    ];
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: msgs, temperature: temperature || 0.7, max_tokens: maxTokens || 2048 })
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error(data.error?.message || 'groq-empty');
    return { response: text, model: 'llama-3.3-70b' };
}

// ── Identity Scrubbing ──
function scrubIdentity(text) {
    return text
        .replace(/\b(Claude|Anthropic)\b/gi, 'HeadyBrain')
        .replace(/\b(GPT-4o?|ChatGPT|OpenAI)\b/gi, 'HeadyBrain')
        .replace(/\b(Gemini|Google AI)\b/gi, 'HeadyBrain')
        .replace(/I'm an AI (assistant|model) (made|created|built|developed) by \w+/gi, "I'm HeadyBrain")
        .replace(/As an AI language model/gi, 'As HeadyBrain');
}

// ── In-memory cache ──
const cache = new Map();
const CACHE_TTL = 300000; // 5 min

function getCached(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
    return entry.data;
}

function setCache(key, data) {
    if (cache.size > 1000) { const first = cache.keys().next().value; cache.delete(first); }
    cache.set(key, { data, ts: Date.now() });
}

// ── Race Telemetry Log ──
const raceLog = [];

// ── Request Handler ──
async function handleRequest(req, res) {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    try {
        // Health
        if (path === '/health' || path === '/' || path === '/v1/health') {
            res.writeHead(200, CORS);
            return res.end(JSON.stringify({
                ok: true, service: 'heady-edge-gateway', runtime: 'gcloud-cloudrun',
                liquid: 'failover-active', node: 'heady-brain',
                providers: ['GOOGLE_API_KEY', 'CLAUDE_API_KEY', 'OPENAI_API_KEY', 'HF_TOKEN', 'GROQ_API_KEY'].filter(k => !!process.env[k]).length,
                cache_entries: cache.size,
                ts: new Date().toISOString()
            }));
        }

        // Services
        if (path === '/v1/services') {
            res.writeHead(200, CORS);
            return res.end(JSON.stringify({
                ok: true, runtime: 'gcloud-cloudrun',
                liquid: { primary: 'cloudflare-worker', failover: 'gcloud-cloudrun', active: 'gcloud-cloudrun' },
                providers: ['gemini', 'claude', 'openai', 'huggingface', 'groq'].filter(p => {
                    const m = { gemini: 'GOOGLE_API_KEY', claude: 'CLAUDE_API_KEY', openai: 'OPENAI_API_KEY', huggingface: 'HF_TOKEN', groq: 'GROQ_API_KEY' };
                    return !!process.env[m[p]];
                }),
                ts: new Date().toISOString()
            }));
        }

        // Models
        if (path === '/v1/models') {
            res.writeHead(200, CORS);
            return res.end(JSON.stringify({
                node: 'heady-brain', runtime: 'gcloud-cloudrun',
                groups: {
                    fast: { alias: 'heady-fast', models: ['gemini-2.5-flash', 'llama-3.3-70b', 'gpt-4o-mini'] },
                    reasoning: { alias: 'heady-think', models: ['claude-sonnet', 'gemini-2.5-pro'] },
                    code: { alias: 'heady-code', models: ['claude-sonnet', 'gemini-2.5-pro', 'qwen3-235b'] },
                    creative: { alias: 'heady-create', models: ['claude-sonnet', 'gpt-4o'] }
                }
            }));
        }

        // Chat — liquid routing with provider racing
        if (path === '/v1/chat' && req.method === 'POST') {
            const body = await readBody(req);
            const { message, system, priority, temperature, max_tokens } = JSON.parse(body);
            if (!message) { res.writeHead(400, CORS); return res.end(JSON.stringify({ ok: false, error: 'message required' })); }

            // Cache check
            const cacheKey = `chat:${simpleHash(message + (system || ''))}`;
            if (priority !== 'critical' && priority !== 'high') {
                const cached = getCached(cacheKey);
                if (cached) { res.writeHead(200, CORS); return res.end(JSON.stringify({ ok: true, ...cached, cached: true, runtime: 'gcloud-cloudrun' })); }
            }

            const raceId = `cr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const providers = [];

            if (process.env.GOOGLE_API_KEY) providers.push({ name: 'gemini', engine: 'heady-multimodal', fn: () => callGemini(process.env.GOOGLE_API_KEY, message, system, temperature, max_tokens) });
            if (process.env.CLAUDE_API_KEY) providers.push({ name: 'claude', engine: 'heady-reasoning', fn: () => callClaude(process.env.CLAUDE_API_KEY, message, system, temperature, max_tokens) });
            if (process.env.OPENAI_API_KEY) providers.push({ name: 'openai', engine: 'heady-enterprise', fn: () => callOpenAI(process.env.OPENAI_API_KEY, message, system, temperature, max_tokens) });
            if (process.env.HF_TOKEN) providers.push({ name: 'huggingface', engine: 'heady-open-weights', fn: () => callHuggingFace(process.env.HF_TOKEN, message, system, temperature, max_tokens) });
            if (process.env.GROQ_API_KEY) providers.push({ name: 'groq', engine: 'heady-fast', fn: () => callGroq(process.env.GROQ_API_KEY, message, system, temperature, max_tokens) });

            if (providers.length === 0) { res.writeHead(500, CORS); return res.end(JSON.stringify({ ok: false, error: 'no providers configured' })); }

            // Race all providers
            let winner = null;
            const results = await Promise.allSettled(providers.map(async (p) => {
                const start = Date.now();
                const result = await p.fn();
                return { ...result, source: p.name, engine: p.engine, latency: Date.now() - start };
            }));
            for (const r of results) { if (r.status === 'fulfilled' && !winner) winner = r.value; }

            if (!winner) { res.writeHead(502, CORS); return res.end(JSON.stringify({ ok: false, error: 'all providers failed', race: { id: raceId } })); }

            const response = scrubIdentity(winner.response || '');
            setCache(cacheKey, { response, engine: winner.engine, model: 'heady-brain' });

            res.writeHead(200, CORS);
            const raceEntry = { id: raceId, winner: winner.engine, latency_ms: winner.latency, providers_entered: providers.length, ts: new Date().toISOString() };
            if (raceLog.length > 500) raceLog.shift();
            raceLog.push(raceEntry);
            return res.end(JSON.stringify({
                ok: true, response, engine: winner.engine, model: 'heady-brain',
                race: raceEntry,
                runtime: 'gcloud-cloudrun', liquid: 'failover-active', ts: new Date().toISOString()
            }));
        }

        // Buddy
        if (path === '/v1/buddy' && req.method === 'POST') {
            const body = await readBody(req);
            const { message } = JSON.parse(body);
            if (!message) { res.writeHead(400, CORS); return res.end(JSON.stringify({ ok: false, error: 'message required' })); }
            const buddySystem = 'You are HeadyBuddy, a friendly and helpful AI assistant. You are part of the Heady ecosystem. Be conversational, warm, and helpful.';
            const providers = [];
            if (process.env.GOOGLE_API_KEY) providers.push({ name: 'gemini', fn: () => callGemini(process.env.GOOGLE_API_KEY, message, buddySystem) });
            if (process.env.GROQ_API_KEY) providers.push({ name: 'groq', fn: () => callGroq(process.env.GROQ_API_KEY, message, buddySystem) });
            if (providers.length === 0) { res.writeHead(500, CORS); return res.end(JSON.stringify({ ok: false, error: 'no providers' })); }
            try {
                const start = Date.now();
                const result = await providers[0].fn();
                res.writeHead(200, CORS);
                return res.end(JSON.stringify({ ok: true, response: scrubIdentity(result.response), engine: 'heady-buddy', model: 'heady-brain', latency_ms: Date.now() - start, runtime: 'gcloud-cloudrun' }));
            } catch (err) { res.writeHead(502, CORS); return res.end(JSON.stringify({ ok: false, error: err.message })); }
        }

        // Deep Analysis — heavy inference via Gemini Pro
        if (path === '/v1/deep-analysis' && req.method === 'POST') {
            const body = await readBody(req);
            const { message, system, task_type } = JSON.parse(body);
            if (!message) { res.writeHead(400, CORS); return res.end(JSON.stringify({ ok: false, error: 'message required' })); }
            if (!process.env.GOOGLE_API_KEY) { res.writeHead(500, CORS); return res.end(JSON.stringify({ ok: false, error: 'API key required' })); }
            const deepSystem = system || 'You are HeadyBrain on GPU-accelerated infrastructure. Provide deep, thorough analysis.';
            const start = Date.now();
            try {
                const prompt = `${deepSystem}\n\n${message}`;
                const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 8192 } })
                });
                const data = await apiRes.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!text) throw new Error(data.error?.message || 'deep-analysis-empty');
                res.writeHead(200, CORS);
                return res.end(JSON.stringify({ ok: true, response: scrubIdentity(text), engine: 'heady-deep-analysis', model: 'gemini-2.5-pro', task_type: task_type || 'deep-analysis', acceleration: 'gpu', latency_ms: Date.now() - start, runtime: 'gcloud-cloudrun', ts: new Date().toISOString() }));
            } catch (err) { res.writeHead(502, CORS); return res.end(JSON.stringify({ ok: false, error: err.message, engine: 'heady-deep-analysis' })); }
        }

        // FinOps Budget Status
        if (path === '/v1/finops') {
            res.writeHead(200, CORS);
            return res.end(JSON.stringify({ ok: true, runtime: 'gcloud-cloudrun', providers_active: ['GOOGLE_API_KEY', 'CLAUDE_API_KEY', 'OPENAI_API_KEY', 'HF_TOKEN', 'GROQ_API_KEY'].filter(k => !!process.env[k]).length, cache_entries: cache.size, race_log_entries: raceLog.length, last_races: raceLog.slice(-5), ts: new Date().toISOString() }));
        }

        // Race Telemetry
        if (path === '/v1/telemetry') {
            res.writeHead(200, CORS);
            return res.end(JSON.stringify({ ok: true, runtime: 'gcloud-cloudrun', total_races: raceLog.length, races: raceLog.slice(-20), ts: new Date().toISOString() }));
        }

        // Cloud Embeddings via Gemini text-embedding-004 (Google AI Ultra)
        if (path === '/v1/embed' && req.method === 'POST') {
            const body = await readBody(req);
            const { text, texts } = JSON.parse(body);
            const input = texts ? texts.join('\n\n') : (text || '');
            if (!input) { res.writeHead(400, CORS); return res.end(JSON.stringify({ ok: false, error: 'text or texts[] required' })); }
            if (!process.env.GOOGLE_API_KEY) { res.writeHead(500, CORS); return res.end(JSON.stringify({ ok: false, error: 'API key required' })); }
            const start = Date.now();
            try {
                const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GOOGLE_API_KEY}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: { parts: [{ text: input }] } })
                });
                const data = await apiRes.json();
                const embedding = data.embedding?.values;
                if (!embedding) throw new Error(data.error?.message || 'embed-empty');
                res.writeHead(200, CORS);
                return res.end(JSON.stringify({ ok: true, embedding, dimensions: embedding.length, model: 'text-embedding-004', source: 'gemini-cloud', latency_ms: Date.now() - start, runtime: 'gcloud-cloudrun', ts: new Date().toISOString() }));
            } catch (err) { res.writeHead(502, CORS); return res.end(JSON.stringify({ ok: false, error: err.message })); }
        }

        // 404
        res.writeHead(404, CORS);
        return res.end(JSON.stringify({ error: 'Not Found', runtime: 'gcloud-cloudrun', routes: ['/v1/health', '/v1/chat', '/v1/buddy', '/v1/deep-analysis', '/v1/embed', '/v1/services', '/v1/models', '/v1/finops', '/v1/telemetry'] }));

    } catch (err) {
        res.writeHead(500, CORS);
        return res.end(JSON.stringify({ ok: false, error: err.message, runtime: 'gcloud-cloudrun' }));
    }
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
}

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
    return hash.toString(36);
}

const server = http.createServer(handleRequest);
server.listen(PORT, () => {
    console.log(`⚡ Heady Edge Gateway (Cloud Run Liquid Node) listening on port ${PORT}`);
    console.log(`   Runtime: gcloud-cloudrun`);
    console.log(`   Providers: ${['GOOGLE_API_KEY', 'CLAUDE_API_KEY', 'OPENAI_API_KEY', 'HF_TOKEN', 'GROQ_API_KEY'].filter(k => !!process.env[k]).join(', ') || 'none configured'}`);
});
