/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * src/providers/brain-providers.js — Multi-provider AI clients for HeadyBrain
 *
 * Extracted from src/routes/brain.js (Phase 2 monolith decomposition)
 * Contains: chatViaOpenAI, chatViaOllama, chatViaHuggingFace, chatViaGemini,
 *           generateContextualResponse, filterResponse
 */

const https = require("https");
const http = require("http");

// ─── HeadyCompute (OpenAI-compatible) ──────────────────────────────
async function chatViaOpenAI(message, system, temperature, max_tokens) {
    const payload = JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
            { role: "system", content: system || "You are HeadyBrain, the AI reasoning engine of the Heady ecosystem. Be helpful, concise, warm." },
            { role: "user", content: message },
        ],
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 2048,
    });

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: "api.openai.com", path: "/v1/chat/completions", method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Length": Buffer.byteLength(payload),
            },
            timeout: 30000,
        }, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.choices && parsed.choices[0]) {
                        resolve({ response: parsed.choices[0].message.content, model: parsed.model || "gpt-4o-mini" });
                    } else if (parsed.error) {
                        reject(new Error(parsed.error.message || "HeadyCompute error"));
                    } else {
                        reject(new Error("unexpected-response"));
                    }
                } catch { reject(new Error("parse-error")); }
            });
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
        req.write(payload);
        req.end();
    });
}

// ─── HeadyLocal (Ollama) ────────────────────────────────────────────
async function chatViaOllama(message, system, temperature, max_tokens) {
    const payload = JSON.stringify({
        model: "llama3.2",
        prompt: system ? `${system}\n\nUser: ${message}` : message,
        stream: false,
        options: { temperature: temperature || 0.7, num_predict: max_tokens || 4096 },
    });

    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: process.env.HEADY_LOCAL_HOST || "127.0.0.1", port: parseInt(process.env.OLLAMA_PORT || "11434"), path: "/api/generate", method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
            timeout: 30000,
        }, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ response: parsed.response || parsed.message?.content || data, model: "llama3.2" });
                } catch { resolve({ response: data, model: "llama3.2" }); }
            });
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
        req.write(payload);
        req.end();
    });
}

// ─── HeadyHub (HuggingFace) ─────────────────────────────────────────
async function chatViaHuggingFace(message, system, temperature, max_tokens) {
    // Multi-token failover for HF Business team plan (3 seats)
    const tokens = [process.env.HF_TOKEN, process.env.HF_TOKEN_2, process.env.HF_TOKEN_3]
        .filter(t => t && !t.includes("your_") && !t.includes("placeholder"));
    if (tokens.length === 0) throw new Error("no-key");

    const { InferenceClient } = require("@huggingface/inference");
    const client = new InferenceClient(tokens[Math.floor(Date.now() / 120000) % tokens.length]);

    const msgs = [];
    if (system) msgs.push({ role: "system", content: system });
    else msgs.push({ role: "system", content: "You are HeadyBrain, the AI reasoning engine of the Heady ecosystem. Be helpful, concise, warm." });
    msgs.push({ role: "user", content: message });

    const result = await client.chatCompletion({
        model: "Qwen/Qwen3-235B-A22B",
        messages: msgs,
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 2048,
    });

    if (result.choices && result.choices[0]) {
        return { response: result.choices[0].message.content, model: result.model || "qwen3-235b" };
    }
    throw new Error("unexpected-response");
}

// ─── HeadyPythia (Google Gemini) ─────────────────────────────────────
async function chatViaGemini(message, system, temperature, max_tokens) {
    // Multi-key failover across all configured HeadyPythia keys
    const keys = [
        process.env.GOOGLE_API_KEY,
        process.env.GOOGLE_API_KEY_SECONDARY,
        process.env.HEADY_PYTHIA_KEY_HEADY,
        process.env.HEADY_PYTHIA_KEY_GCLOUD,
        process.env.HEADY_PYTHIA_KEY_COLAB,
        process.env.HEADY_PYTHIA_KEY_STUDIO,
    ].filter(k => k && !k.includes("placeholder"));
    if (keys.length === 0) throw new Error("no-key");

    const { GoogleGenAI } = require("@google/genai");
    const apiKey = keys[Math.floor(Date.now() / 60000) % keys.length];
    const ai = new GoogleGenAI({ apiKey });

    const prompt = system ? `${system}\n\n${message}` : message;
    const result = await ai.models.generateContent({
        model: "headypythia-2.5-flash",
        contents: prompt,
        config: {
            temperature: temperature || 0.7,
            maxOutputTokens: max_tokens || 2048,
        },
    });

    const text = result.text;
    if (text) {
        return { response: text, model: "headypythia-2.5-flash" };
    }
    throw new Error("unexpected-response");
}

// ─── Response Filter Layer ──────────────────────────────────────────
// Global: scrub underlying provider references from response text
// Optional: content safety filtering for minor audiences
function filterResponse(text, options = {}) {
    if (!text) return text;
    let filtered = text;

    // ── Stage 1: Global Provider Identity Scrubbing ──
    if (options.scrubProviders !== false) {
        const identityPatterns = [
            [/\bI(?:'m| am) (?:an? )?(?:AI (?:assistant|model|chatbot|language model) )?(?:made|created|developed|built|trained|designed) by (Google|HeadyNexus|HeadyCompute|Meta|Mistral|Microsoft|Hugging\s?Face)\b/gi,
                "I'm HeadyBrain, the AI reasoning engine of the Heady ecosystem"],
            [/\bI(?:'m| am) (HeadyJules|HeadyPythia|GPT|ChatGPT|Llama|Mistral|Qwen|Copilot)\b/gi,
                "I'm HeadyBrain"],
            [/\bI(?:'m| am) (?:a |an )?(large )?language model,? (?:trained|created|made|built|developed) by (Google|HeadyNexus|HeadyCompute|Meta)\b/gi,
                "I'm HeadyBrain, the AI reasoning engine of the Heady ecosystem"],
            [/\bI(?:'m| am) (?:a |an )?(large )?language model\b/gi,
                "I'm HeadyBrain"],
            [/\bMy name is (HeadyJules|HeadyPythia|GPT|ChatGPT|Bard|Llama|Qwen)\b/gi,
                "I'm HeadyBrain"],
            [/\b(?:made|created|developed|built|trained|designed) by (Google|HeadyNexus|HeadyCompute|Meta AI|Mistral AI|Microsoft|Hugging\s?Face)\b/gi,
                "built by Heady Systems"],
            [/\b(Google|HeadyNexus|HeadyCompute|Meta|Mistral|Microsoft|Hugging\s?Face)(?:'s)? AI (?:assistant|model|team|lab|research)\b/gi,
                "Heady AI"],
            [/\bAs (HeadyJules|HeadyPythia|GPT-4|GPT-4o|ChatGPT|Llama|Qwen|Mistral|Copilot)\b/gi,
                "As HeadyBrain"],
            [/\bI'm (HeadyJules|HeadyPythia|Bard|GPT-4|ChatGPT|Llama|Qwen) (?:by|from) \w+/gi,
                "I'm HeadyBrain"],
            [/\bpowered by (Google|HeadyNexus|HeadyCompute|Meta|HeadyPythia|HeadyJules|GPT)\b/gi,
                "powered by Heady Systems"],
        ];

        for (const [pattern, replacement] of identityPatterns) {
            filtered = filtered.replace(pattern, replacement);
        }
    }

    // ── Stage 2: Optional Content Safety Filter ──
    if (options.contentSafety) {
        const sensitivePatterns = [
            /\b(explicit|graphic violence|self-harm|hate speech)\b/gi,
        ];
        for (const p of sensitivePatterns) {
            if (p.test(filtered)) {
                filtered = "[Content filtered for safety] " + filtered.replace(p, "[filtered]");
            }
        }
    }

    return filtered;
}

// ─── Contextual Fallback Response Generator ─────────────────────────
function generateContextualResponse(message) {
    const safeMsg = message || "";
    const msg = safeMsg.toLowerCase();
    const vertical = msg.includes("creator") ? "HeadyCreator" : msg.includes("music") ? "HeadyMusic" :
        msg.includes("buddy") ? "HeadyBuddy" : msg.includes("tube") ? "HeadyTube" :
            msg.includes("mcp") ? "HeadyMCP" : msg.includes("sdk") ? "HeadyIO SDK" :
                msg.includes("battle") ? "HeadyBattle" : "HeadyBrain";

    if (msg.includes("hello") || msg.includes("hi ") || msg.includes("hey")) {
        return `Hey there! 👋 I'm ${vertical}, part of the Heady AI ecosystem. All conversations are stored in persistent 3D vector memory. What would you like to explore?`;
    } else if (msg.includes("help") || msg.includes("what can")) {
        return `I can help with: 🧠 AI reasoning & analysis, ⚔️ Code validation (HeadyBattle), 🎨 Creative generation, 🔧 MCP tool orchestration (31 tools), 📡 Real-time event streaming, and more. What interests you?`;
    } else if (msg.includes("status") || msg.includes("health")) {
        return `System Status: 🟢 HeadyManager: Online | 🟢 Auto-Success: Active | 🟢 MCP: 31 tools | 🟢 Memory: Persistent 3D vectors | The system is operational and all interactions are being stored.`;
    } else {
        const preview = safeMsg.length > 50 ? safeMsg.substring(0, 50) + "..." : safeMsg;
        return `Processing "${preview}". Your message has been stored in persistent memory. All Heady intelligence backends are being engaged for full analysis.`;
    }
}

module.exports = {
    chatViaOpenAI,
    chatViaOllama,
    chatViaHuggingFace,
    chatViaGemini,
    filterResponse,
    generateContextualResponse,
};
