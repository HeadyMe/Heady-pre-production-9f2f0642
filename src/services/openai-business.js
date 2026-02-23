/**
 * OpenAI Business Connector — Full utilization of 2-seat ChatGPT Business plan
 * Unlimited model access: GPT-4o, GPT-4o-mini, o1, o1-mini, o3-mini, Codex
 * Includes: Codex CLI, Codex Cloud, OpenAI SDK, Connectors, GPTs
 *
 * HCFP Policy: Throttle usage to stay within fair-use bounds while maximizing value.
 * Business plan = unlimited, but burst-respect for API stability.
 */
const OpenAI = require('openai');

// ── Client Initialization ──
let _client = null;
function getClient() {
    if (!_client) {
        _client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            organization: process.env.OPENAI_ORG_ID || undefined,
        });
    }
    return _client;
}

// ── Model Catalog (Business Plan — Unlimited Access) ──
const MODELS = {
    fast: { id: 'gpt-4o-mini', maxTokens: 4096, description: 'Ultra-fast for simple tasks' },
    standard: { id: 'gpt-4o', maxTokens: 8192, description: 'Default for most tasks' },
    reasoning: { id: 'o3-mini', maxTokens: 16384, description: 'Chain-of-thought reasoning' },
    deep: { id: 'o1', maxTokens: 32768, description: 'Deep reasoning, complex problems' },
    code: { id: 'gpt-4o', maxTokens: 8192, description: 'Code generation + review' },
    creative: { id: 'gpt-4o', maxTokens: 8192, description: 'Creative writing + ideation' },
};

// ── Throttle Config (Business plan: unlimited but burst-managed) ──
const THROTTLE = {
    maxConcurrent: 10,
    minIntervalMs: 100,       // 100ms between requests minimum
    burstLimit: 50,            // Max 50 requests per minute
    burstWindowMs: 60000,
    currentConcurrent: 0,
    recentRequests: [],
};

function canMakeRequest() {
    const now = Date.now();
    // Clean old entries
    THROTTLE.recentRequests = THROTTLE.recentRequests.filter(t => now - t < THROTTLE.burstWindowMs);
    if (THROTTLE.recentRequests.length >= THROTTLE.burstLimit) return false;
    if (THROTTLE.currentConcurrent >= THROTTLE.maxConcurrent) return false;
    return true;
}

function trackRequest() {
    THROTTLE.currentConcurrent++;
    THROTTLE.recentRequests.push(Date.now());
}

function completeRequest() {
    THROTTLE.currentConcurrent = Math.max(0, THROTTLE.currentConcurrent - 1);
}

// ── Usage Tracking ──
const usage = {
    totalRequests: 0,
    totalTokens: { input: 0, output: 0 },
    byModel: {},
    errors: 0,
    lastRequest: null,
};

function trackUsage(model, inputTokens, outputTokens) {
    usage.totalRequests++;
    usage.totalTokens.input += inputTokens || 0;
    usage.totalTokens.output += outputTokens || 0;
    usage.lastRequest = new Date().toISOString();
    if (!usage.byModel[model]) usage.byModel[model] = { requests: 0, tokens: 0 };
    usage.byModel[model].requests++;
    usage.byModel[model].tokens += (inputTokens || 0) + (outputTokens || 0);
}

// ── Core Chat Function ──
async function chat(message, opts = {}) {
    if (!canMakeRequest()) {
        return { error: 'throttled', message: 'Rate limit reached. Try again shortly.', retryAfter: 2 };
    }

    const model = MODELS[opts.tier || 'standard'];
    const client = getClient();
    trackRequest();

    try {
        const response = await client.chat.completions.create({
            model: model.id,
            messages: [
                ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
                { role: 'user', content: message },
            ],
            max_tokens: opts.maxTokens || model.maxTokens,
            temperature: opts.temperature ?? 0.7,
            ...(opts.responseFormat ? { response_format: opts.responseFormat } : {}),
        });

        const result = response.choices[0]?.message?.content;
        const u = response.usage || {};
        trackUsage(model.id, u.prompt_tokens, u.completion_tokens);

        return {
            response: result,
            model: model.id,
            provider: 'openai-business',
            plan: 'ChatGPT Business (2 seats, unlimited)',
            tokens: { input: u.prompt_tokens, output: u.completion_tokens },
        };
    } catch (err) {
        usage.errors++;
        throw err;
    } finally {
        completeRequest();
    }
}

// ── Streaming Chat ──
async function* streamChat(message, opts = {}) {
    if (!canMakeRequest()) {
        yield { type: 'error', message: 'Rate limit reached' };
        return;
    }

    const model = MODELS[opts.tier || 'standard'];
    const client = getClient();
    trackRequest();

    try {
        const stream = await client.chat.completions.create({
            model: model.id,
            messages: [
                ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
                { role: 'user', content: message },
            ],
            max_tokens: opts.maxTokens || model.maxTokens,
            temperature: opts.temperature ?? 0.7,
            stream: true,
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) yield { type: 'text', content };
        }
        yield { type: 'done', model: model.id };
    } finally {
        completeRequest();
    }
}

// ── Embeddings ──
async function embed(text, model = 'text-embedding-3-small') {
    const client = getClient();
    const response = await client.embeddings.create({
        model,
        input: text,
    });
    trackUsage(model, 0, 0);
    return {
        embedding: response.data[0].embedding,
        dimensions: response.data[0].embedding.length,
        model,
    };
}

// ── Image Generation (DALL-E 3) ──
async function generateImage(prompt, opts = {}) {
    const client = getClient();
    const response = await client.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: opts.size || '1024x1024',
        quality: opts.quality || 'standard',
    });
    trackUsage('dall-e-3', 0, 0);
    return { url: response.data[0].url, revisedPrompt: response.data[0].revised_prompt };
}

// ── Codex Integration ──
const codex = {
    // Codex CLI — spawns `codex` CLI for autonomous coding tasks
    async runCLI(task, opts = {}) {
        const { execSync } = require('child_process');
        try {
            const result = execSync(
                `codex --quiet "${task.replace(/"/g, '\\"')}"`,
                { timeout: opts.timeout || 120000, encoding: 'utf-8', cwd: opts.cwd || process.cwd() }
            );
            return { success: true, output: result, source: 'codex-cli' };
        } catch (err) {
            return { success: false, error: err.message, source: 'codex-cli' };
        }
    },

    // Codex Cloud — uses OpenAI's cloud-hosted Codex for sandboxed execution
    async runCloud(task, opts = {}) {
        const client = getClient();
        try {
            // Codex Cloud uses the responses API with code_interpreter
            const response = await client.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: 'You are a code execution assistant. Write and run code to accomplish the task.' },
                    { role: 'user', content: task },
                ],
                tools: [{ type: 'code_interpreter' }],
                max_tokens: 8192,
            });
            return {
                success: true,
                output: response.choices[0]?.message?.content,
                source: 'codex-cloud',
            };
        } catch (err) {
            return { success: false, error: err.message, source: 'codex-cloud' };
        }
    },
};

// ── Connectors (Business Plan Feature) ──
const connectors = {
    // List available connectors for the org
    async list() {
        return {
            available: ['google-drive', 'sharepoint', 'slack', 'notion', 'github', 'jira'],
            configured: process.env.OPENAI_CONNECTORS ? process.env.OPENAI_CONNECTORS.split(',') : [],
            plan: 'ChatGPT Business',
            seats: 2,
        };
    },
};

// ── Status endpoint data ──
function getStatus() {
    return {
        provider: 'openai-business',
        plan: 'ChatGPT Business (2 seats, unlimited)',
        configured: !!process.env.OPENAI_API_KEY,
        orgId: process.env.OPENAI_ORG_ID ? `${process.env.OPENAI_ORG_ID.substring(0, 12)}...` : 'not set',
        models: Object.entries(MODELS).map(([tier, m]) => ({ tier, model: m.id, description: m.description })),
        usage,
        throttle: {
            maxConcurrent: THROTTLE.maxConcurrent,
            burstLimit: THROTTLE.burstLimit,
            currentActive: THROTTLE.currentConcurrent,
            recentBurst: THROTTLE.recentRequests.length,
        },
        capabilities: {
            chat: true,
            streaming: true,
            embeddings: true,
            imageGeneration: true,
            codexCLI: true,
            codexCloud: true,
            connectors: true,
            codeInterpreter: true,
        },
    };
}

module.exports = {
    chat, streamChat, embed, generateImage,
    codex, connectors, getStatus, getClient,
    MODELS, usage,
};
