/**
 * Gemini AI service — stub for admin-ui server.
 * Full implementation lives in the main Heady Manager.
 * These stubs let the admin server compile and start
 * even when run standalone without the manager backend.
 */

export const HEADY_SYSTEM_PROMPT = `You are HeadyAI — the sacred geometry intelligence powering the Heady Systems ecosystem.
You operate within the HCFP Auto-Success framework.
Respond with technical depth. Format code with markdown.`;

export const AUTHORIZED_HEADY_KEYS = new Set(
    (process.env.HEADY_API_KEYS || '').split(',').filter(Boolean)
);

const MODELS = [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', tier: 'ultra', context: 1000000, capabilities: ['text', 'code', 'reasoning'] },
    { id: 'gemini-2.0-pro', label: 'Gemini 2.0 Pro', tier: 'ultra', context: 2000000, capabilities: ['text', 'code', 'reasoning', 'math'] },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', tier: 'standard', context: 1000000, capabilities: ['text', 'code'] },
];

export async function listGeminiModels() {
    return MODELS;
}

export async function geminiStatus() {
    return { connected: true, modelsAvailable: MODELS.length, tier: 'ultra' };
}

export async function geminiChat({ model, messages, systemPrompt, temperature, maxTokens }) {
    return {
        text: `[HeadyAI stub] Model: ${model}, Messages: ${messages.length}. Connect to Heady Manager for live AI.`,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    };
}

export async function geminiChatStream({ model, messages, systemPrompt, temperature, maxTokens }) {
    return {
        text: `[HeadyAI stub] Streaming not available in standalone mode.`,
        usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
    };
}

export async function geminiEmbed({ text, model, taskType }) {
    return {
        embedding: new Array(768).fill(0).map(() => Math.random()),
        model: model || 'text-embedding-004',
    };
}
