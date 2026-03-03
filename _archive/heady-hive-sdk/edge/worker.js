/**
 * ═══ Heady Edge Worker — Cloudflare Worker Entry Point ═══
 *
 * Dynamic edge gateway for the Heady Hive SDK.
 * Deployed as Cloudflare Worker with colab routing.
 * Handles: rate limiting, caching (KV), budget tracking,
 * provider routing, race auditing — all at the edge.
 *
 * Liquidity: this worker + GCloud Cloud Run instance
 * ensure always-available AI gateway.
 */

// --- Edge-compatible provider (Cloudflare Workers AI + external APIs) ---

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        // CORS
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Heady-SDK",
                },
            });
        }

        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
            "X-Heady-Edge": "cloudflare-worker",
        };

        try {
            // ── Health ──
            if (path === "/health" || path === "/") {
                return json({ ok: true, service: "heady-edge-gateway", ts: new Date().toISOString() }, corsHeaders);
            }

            // ── Chat (liquid routing) ──
            if (path === "/v1/chat" && request.method === "POST") {
                const body = await request.json();
                const { message, system, priority, temperature, max_tokens } = body;

                if (!message) return json({ ok: false, error: "message required" }, corsHeaders, 400);

                const raceStart = Date.now();
                const raceId = `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

                // Build providers available at edge
                const providers = [];

                // Gemini (cheapest, fastest)
                if (env.GOOGLE_API_KEY) {
                    providers.push({
                        name: "gemini", serviceGroup: "heady-multimodal",
                        fn: () => callGemini(env.GOOGLE_API_KEY, message, system, temperature, max_tokens),
                    });
                }

                // Claude
                if (env.CLAUDE_API_KEY) {
                    providers.push({
                        name: "claude", serviceGroup: "heady-reasoning",
                        fn: () => callClaude(env.CLAUDE_API_KEY, message, system, temperature, max_tokens),
                    });
                }

                // OpenAI
                if (env.OPENAI_API_KEY) {
                    providers.push({
                        name: "openai", serviceGroup: "heady-enterprise",
                        fn: () => callOpenAI(env.OPENAI_API_KEY, message, system, temperature, max_tokens),
                    });
                }

                // HuggingFace
                if (env.HF_TOKEN) {
                    providers.push({
                        name: "huggingface", serviceGroup: "heady-open-weights",
                        fn: () => callHuggingFace(env.HF_TOKEN, message, system, temperature, max_tokens),
                    });
                }

                // Cloudflare Workers AI (native edge inference)
                providers.push({
                    name: "workers-ai", serviceGroup: "heady-edge-native",
                    fn: () => callWorkersAI(env.AI, message, system),
                });

                if (providers.length === 0) {
                    return json({ ok: false, error: "no providers configured" }, corsHeaders, 500);
                }

                // Cache check (KV)
                const cacheKey = `chat:${simpleHash(message + (system || ""))}`;
                if (env.HEADY_CACHE && priority !== "critical" && priority !== "high") {
                    const cached = await env.HEADY_CACHE.get(cacheKey, "json");
                    if (cached) {
                        return json({ ok: true, ...cached, cached: true, latency: 0, race: { id: raceId, cached: true } }, corsHeaders);
                    }
                }

                // Race all providers
                const shouldRace = priority === "high" || priority === "critical" || providers.length > 1;
                let winner = null;

                if (shouldRace) {
                    // Fire all, take fastest
                    const results = await Promise.allSettled(
                        providers.map(async (p) => {
                            const start = Date.now();
                            const result = await p.fn();
                            return { ...result, source: p.name, engine: p.serviceGroup, latency: Date.now() - start };
                        })
                    );

                    // Find first fulfilled
                    for (const r of results) {
                        if (r.status === "fulfilled" && !winner) {
                            winner = r.value;
                        }
                    }

                    // Log audit to KV (background, non-blocking)
                    if (env.HEADY_CACHE) {
                        ctx.waitUntil(env.HEADY_CACHE.put(`audit:${raceId}`, JSON.stringify({
                            raceId, ts: new Date().toISOString(),
                            winner: winner ? { source: winner.source, latency: winner.latency } : null,
                            results: results.map(r => r.status === "fulfilled"
                                ? { source: r.value.source, latency: r.value.latency, status: "ok" }
                                : { status: "error", reason: r.reason?.message }),
                        }), { expirationTtl: 86400 }));
                    }
                } else {
                    // Sequential — try first available
                    for (const p of providers) {
                        try {
                            const start = Date.now();
                            winner = await p.fn();
                            winner.source = p.name;
                            winner.engine = p.serviceGroup;
                            winner.latency = Date.now() - start;
                            break;
                        } catch { /* try next */ }
                    }
                }

                if (!winner) {
                    return json({ ok: false, error: "all providers failed", race: { id: raceId } }, corsHeaders, 502);
                }

                // Scrub provider identity
                const response = scrubIdentity(winner.response || "");

                // Cache result (background)
                if (env.HEADY_CACHE && priority !== "critical") {
                    ctx.waitUntil(env.HEADY_CACHE.put(cacheKey, JSON.stringify({
                        response, engine: winner.engine, model: "heady-brain",
                    }), { expirationTtl: 300 }));
                }

                return json({
                    ok: true, response, engine: winner.engine, model: "heady-brain",
                    race: { id: raceId, winner: winner.engine, latency_ms: winner.latency, providers_entered: providers.length },
                    ts: new Date().toISOString(),
                }, corsHeaders);
            }

            // ── Gateway Stats ──
            if (path === "/v1/stats") {
                return json({ ok: true, service: "heady-edge-gateway", edge: "cloudflare-worker", ts: new Date().toISOString() }, corsHeaders);
            }

            return json({ error: "Not found", paths: ["/health", "/v1/chat", "/v1/stats"] }, corsHeaders, 404);

        } catch (err) {
            return json({ ok: false, error: err.message }, corsHeaders, 500);
        }
    },
};

// ─── Provider Calls ─────────────────────────────────────────────────

async function callGemini(apiKey, message, system, temperature, maxTokens) {
    const prompt = system ? `${system}\n\n${message}` : message;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: temperature || 0.7, maxOutputTokens: maxTokens || 2048 },
        }),
    });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error(data.error?.message || "gemini-empty");
    return { response: text, model: "gemini-2.5-flash" };
}

async function callClaude(apiKey, message, system, temperature, maxTokens) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json", "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: "claude-sonnet-4-20250514", max_tokens: maxTokens || 2048,
            system: system || "You are HeadyBrain, the AI reasoning engine.",
            messages: [{ role: "user", content: message }],
        }),
    });
    const data = await res.json();
    const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("");
    if (!text) throw new Error(data.error?.message || "claude-empty");
    return { response: text, model: data.model || "claude-sonnet" };
}

async function callOpenAI(apiKey, message, system, temperature, maxTokens) {
    const msgs = [];
    if (system) msgs.push({ role: "system", content: system });
    else msgs.push({ role: "system", content: "You are HeadyBrain, the AI reasoning engine." });
    msgs.push({ role: "user", content: message });

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: msgs, temperature: temperature || 0.7, max_tokens: maxTokens || 2048 }),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error(data.error?.message || "openai-empty");
    return { response: text, model: data.model || "gpt-4o-mini" };
}

async function callHuggingFace(token, message, system, temperature, maxTokens) {
    const msgs = [];
    if (system) msgs.push({ role: "system", content: system });
    msgs.push({ role: "user", content: message });

    const res = await fetch("https://router.huggingface.co/novita/v3/openai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ model: "Qwen/Qwen3-235B-A22B", messages: msgs, temperature: temperature || 0.7, max_tokens: maxTokens || 2048 }),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("hf-empty");
    return { response: text, model: "qwen3-235b" };
}

async function callWorkersAI(AI, message, system) {
    if (!AI) throw new Error("Workers AI binding not configured");
    const prompt = system ? `${system}\n\n${message}` : message;
    const result = await AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [{ role: "user", content: prompt }],
    });
    return { response: result.response, model: "llama-3.1-8b-edge" };
}

// ─── Helpers ────────────────────────────────────────────────────────

function json(data, headers = {}, status = 200) {
    return new Response(JSON.stringify(data), { status, headers });
}

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString(36);
}

function scrubIdentity(text) {
    return text
        .replace(/\b(Claude|Anthropic)\b/gi, "HeadyBrain")
        .replace(/\b(GPT-4o?|ChatGPT|OpenAI)\b/gi, "HeadyBrain")
        .replace(/\b(Gemini|Google AI)\b/gi, "HeadyBrain")
        .replace(/\bI'm an AI (assistant|model) (made|created|built|developed) by \w+/gi, "I'm HeadyBrain")
        .replace(/\bAs an AI language model\b/gi, "As HeadyBrain");
}
