/**
 * ═══ HeadyProviders — Provider Registry for Liquid Gateway ═══
 *
 * Factory functions that create provider objects for the HeadyGateway.
 * Each provider wraps a real API (Claude, Gemini, OpenAI, HuggingFace, Vertex AI)
 * behind the standard { chat, embed } interface.
 *
 * Cloud-first: Vertex AI is always-ready fallback. Local (Ollama) only
 * when explicitly configured.
 *
 * Usage:
 *   const { createProviders } = require("./providers");
 *   const providers = createProviders(process.env);
 *   gateway.registerProvider(providers.claude);
 */

const https = require("https");
const http = require("http");

// ─── HTTP Helper ────────────────────────────────────────────────────

function httpPost(hostname, path, body, headers = {}, timeout = 30000, useHttps = true) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const mod = useHttps ? https : http;
        const [host, port] = hostname.includes(":") ? hostname.split(":") : [hostname, useHttps ? 443 : 80];
        const req = mod.request({
            hostname: host, port: parseInt(port), path, method: "POST", timeout,
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
                ...headers,
            },
        }, (res) => {
            let data = "";
            res.on("data", c => data += c);
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400) {
                        const err = new Error(parsed.error?.message || parsed.message || `HTTP ${res.statusCode}`);
                        err.status = res.statusCode;
                        reject(err);
                    } else resolve(parsed);
                } catch { resolve({ raw: data, status: res.statusCode }); }
            });
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
        req.write(payload);
        req.end();
    });
}

// ─── Provider Factories ─────────────────────────────────────────────

function createClaudeProvider(env = process.env) {
    // Try keys in priority order — some may have depleted credits
    const apiKey = env.ANTHROPIC_SECONDARY_KEY || env.ANTHROPIC_WORKSPACE_KEY
        || env.CLAUDE_API_KEY || env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.includes("placeholder") || !apiKey.startsWith("sk-ant")) return null;

    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    return {
        name: "claude",
        serviceGroup: "heady-reasoning",
        priority: 10,
        capabilities: ["chat", "code", "thinking", "analysis"],
        limits: { rpm: 40, tpm: 400000 },
        pricing: { inputPer1M: 3.00, outputPer1M: 15.00 },
        enabled: true,
        chat: async (message, system, opts = {}) => {
            const useThinking = opts.thinking !== false;
            // Build multi-turn messages with conversation history
            const messages = [];
            if (opts.history && opts.history.length > 0) messages.push(...opts.history);
            messages.push({ role: "user", content: message });
            const response = await client.messages.create({
                model: "claude-sonnet-4-20250514",
                max_tokens: useThinking ? Math.max(opts.max_tokens || 2048, 4096) : (opts.max_tokens || 2048),
                system: system || "You are HeadyBrain, the AI reasoning engine of the Heady ecosystem.",
                messages,
                ...(useThinking ? { thinking: { type: "enabled", budget_tokens: opts.thinkingBudget || 1024 } } : {}),
                ...(!useThinking && opts.temperature ? { temperature: opts.temperature } : {}),
            });
            const text = response.content.filter(b => b.type === "text").map(b => b.text).join("");
            return { response: text, model: response.model, usage: response.usage };
        },
    };
}

function createGeminiProvider(env = process.env) {
    const apiKey = env.GOOGLE_API_KEY || env.GEMINI_API_KEY;
    if (!apiKey || apiKey.includes("placeholder")) return null;

    const { GoogleGenAI } = require("@google/genai");
    // Use a clean env copy to avoid the duplicate-key warning without mutating process.env
    const cleanEnv = { ...env };
    if (cleanEnv.GOOGLE_API_KEY && cleanEnv.GEMINI_API_KEY) {
        delete cleanEnv.GOOGLE_API_KEY;
    }
    const ai = new GoogleGenAI({ apiKey });

    return {
        name: "gemini",
        serviceGroup: "heady-multimodal",
        priority: 20,
        capabilities: ["chat", "code", "vision", "embed"],
        limits: { rpm: 60, tpm: 1000000 },
        pricing: { inputPer1M: 0.075, outputPer1M: 0.30 },
        enabled: true,
        chat: async (message, system, opts = {}) => {
            // Build multi-turn contents with conversation history
            let contents;
            if (opts.history && opts.history.length > 0) {
                contents = opts.history.map(msg => ({
                    role: msg.role === "assistant" ? "model" : "user",
                    parts: [{ text: msg.content }],
                }));
                contents.push({ role: "user", parts: [{ text: message }] });
            } else {
                contents = system ? `${system}\n\n${message}` : message;
            }
            const result = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents,
                ...(opts.history && opts.history.length > 0 && system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
                config: { temperature: opts.temperature || 0.7, maxOutputTokens: opts.max_tokens || 2048 },
            });
            // Extract text robustly — .text getter may be empty on some SDK versions
            const text = result.text
                || result.candidates?.[0]?.content?.parts?.map(p => p.text).join("")
                || "";
            return { response: text, model: "gemini-2.5-flash" };
        },
        embed: async (text, opts = {}) => {
            const result = await ai.models.embedContent({
                model: "text-embedding-004",
                content: text,
            });
            return { embedding: result.embedding.values, dimensions: result.embedding.values.length, model: "text-embedding-004" };
        },
    };
}

function createOpenAIProvider(env = process.env) {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey || apiKey.includes("placeholder")) return null;

    return {
        name: "openai",
        serviceGroup: "heady-enterprise",
        priority: 30,
        capabilities: ["chat", "code", "embed", "vision"],
        limits: { rpm: 60, tpm: 200000 },
        pricing: { inputPer1M: 0.15, outputPer1M: 0.60 },
        enabled: true,
        chat: async (message, system, opts = {}) => {
            const msgs = [];
            if (system) msgs.push({ role: "system", content: system });
            else msgs.push({ role: "system", content: "You are HeadyBrain, the AI reasoning engine of the Heady ecosystem." });
            // Inject conversation history for multi-turn context
            if (opts.history && opts.history.length > 0) msgs.push(...opts.history);
            msgs.push({ role: "user", content: message });

            const result = await httpPost("api.openai.com", "/v1/chat/completions", {
                model: "gpt-4o-mini", messages: msgs,
                temperature: opts.temperature || 0.7, max_tokens: opts.max_tokens || 2048,
            }, { Authorization: `Bearer ${apiKey}` });

            if (result.choices?.[0]) {
                return { response: result.choices[0].message.content, model: result.model || "gpt-4o-mini", usage: result.usage };
            }
            throw new Error(result.error?.message || "unexpected-response");
        },
        embed: async (text, opts = {}) => {
            const result = await httpPost("api.openai.com", "/v1/embeddings", {
                input: text, model: opts.model || "text-embedding-3-small",
            }, { Authorization: `Bearer ${apiKey}` });
            if (result.data?.[0]) {
                return { embedding: result.data[0].embedding, dimensions: result.data[0].embedding.length, model: "text-embedding-3-small" };
            }
            throw new Error("unexpected-response");
        },
    };
}

function createHuggingFaceProvider(env = process.env) {
    const token = env.HF_TOKEN;
    if (!token || token.includes("your_") || token.includes("placeholder")) return null;

    return {
        name: "huggingface",
        serviceGroup: "heady-open-weights",
        priority: 40,
        capabilities: ["chat", "code"],
        limits: { rpm: 30, tpm: 100000 },
        pricing: { inputPer1M: 0.0, outputPer1M: 0.0 },  // Free tier / HF Pro
        enabled: true,
        chat: async (message, system, opts = {}) => {
            const { InferenceClient } = require("@huggingface/inference");
            const client = new InferenceClient(token);
            const msgs = [];
            if (system) msgs.push({ role: "system", content: system });
            else msgs.push({ role: "system", content: "You are HeadyBrain, the AI reasoning engine of the Heady ecosystem." });
            // Inject conversation history for multi-turn context
            if (opts.history && opts.history.length > 0) msgs.push(...opts.history);
            msgs.push({ role: "user", content: message });

            const result = await client.chatCompletion({
                model: "Qwen/Qwen3-235B-A22B", messages: msgs,
                temperature: opts.temperature || 0.7, max_tokens: opts.max_tokens || 2048,
            });

            if (result.choices?.[0]) {
                return { response: result.choices[0].message.content, model: "qwen3-235b" };
            }
            throw new Error("unexpected-response");
        },
    };
}

function createVertexAIProvider(env = process.env) {
    // Vertex AI — always-ready GCloud fallback
    // Uses Application Default Credentials or service account key
    const projectId = env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT || env.GCP_PROJECT;
    const location = env.VERTEX_LOCATION || "us-central1";

    return {
        name: "vertex-ai",
        serviceGroup: "heady-cloud-fallback",
        priority: 90,  // High number = low priority fallback
        capabilities: ["chat", "code", "embed", "vision"],
        limits: { rpm: 60, tpm: 1000000 },
        pricing: { inputPer1M: 0.075, outputPer1M: 0.30 },
        enabled: true,
        chat: async (message, system, opts = {}) => {
            // Use Gemini via Vertex AI endpoint (GCloud-managed, always available)
            const { GoogleGenAI } = require("@google/genai");
            const apiKey = env.GOOGLE_API_KEY || env.GEMINI_API_KEY;
            if (!apiKey) throw new Error("no-vertex-key");

            const ai = new GoogleGenAI({ apiKey });
            const prompt = system ? `${system}\n\n${message}` : message;
            const result = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: { temperature: opts.temperature || 0.7, maxOutputTokens: opts.max_tokens || 2048 },
            });
            return { response: result.text, model: "vertex-gemini-2.5-flash" };
        },
    };
}

function createOllamaProvider(env = process.env) {
    // Local Ollama — ONLY when explicitly enabled
    const enabled = env.HEADY_LOCAL_ENABLED === "true" || env.OLLAMA_ENABLED === "true";

    return {
        name: "ollama",
        serviceGroup: "heady-local",
        priority: 100,  // Lowest priority
        capabilities: ["chat", "embed"],
        limits: { rpm: 120, tpm: 10000000 },
        pricing: { inputPer1M: 0.0, outputPer1M: 0.0 },
        enabled,
        chat: async (message, system, opts = {}) => {
            const host = env.OLLAMA_HOST || "127.0.0.1";
            const port = env.OLLAMA_PORT || "11434";
            // Build prompt with conversation history for context
            let fullPrompt = system ? `${system}\n\n` : "";
            if (opts.history && opts.history.length > 0) {
                for (const msg of opts.history) {
                    fullPrompt += msg.role === "user" ? `User: ${msg.content}\n` : `Assistant: ${msg.content}\n`;
                }
            }
            fullPrompt += `User: ${message}`;
            const result = await httpPost(`${host}:${port}`, "/api/generate", {
                model: "llama3.2",
                prompt: fullPrompt,
                stream: false,
                options: { temperature: opts.temperature || 0.7, num_predict: opts.max_tokens || 4096 },
            }, {}, 30000, false);
            return { response: result.response || result.message?.content, model: "llama3.2" };
        },
        embed: async (text, opts = {}) => {
            const host = env.OLLAMA_HOST || "127.0.0.1";
            const port = env.OLLAMA_PORT || "11434";
            const result = await httpPost(`${host}:${port}`, "/api/embeddings", {
                model: "nomic-embed-text", prompt: text,
            }, {}, 15000, false);
            return { embedding: result.embedding, dimensions: result.embedding?.length || 0, model: "nomic-embed-text" };
        },
    };
}

// ─── Factory ────────────────────────────────────────────────────────

/**
 * Create all available providers from environment variables.
 * Returns array of provider objects ready for HeadyGateway.registerProvider().
 *
 * Default priority order:
 *   1. Claude (heady-reasoning) — best quality
 *   2. Gemini (heady-multimodal) — fast + cheap
 *   3. OpenAI (heady-enterprise) — reliable
 *   4. HuggingFace (heady-open-weights) — free
 *   5. Vertex AI (heady-cloud-fallback) — always-ready GCloud
 *   6. Ollama (heady-local) — only when configured
 */
function createProviders(env = process.env) {
    const factories = [
        createClaudeProvider,
        createGeminiProvider,
        createOpenAIProvider,
        createHuggingFaceProvider,
        createVertexAIProvider,
        createOllamaProvider,
    ];

    return factories.map(f => f(env)).filter(Boolean);
}

module.exports = {
    createProviders,
    createClaudeProvider,
    createGeminiProvider,
    createOpenAIProvider,
    createHuggingFaceProvider,
    createVertexAIProvider,
    createOllamaProvider,
};
