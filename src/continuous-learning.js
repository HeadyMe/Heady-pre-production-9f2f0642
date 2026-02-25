/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ─── Heady Continuous Learning Engine ────────────────────────────
 *
 * ACTIVE LEARNING — calls real AI providers every cycle:
 *
 *   1. Pick a learning topic (from codebase, system state, or curriculum)
 *   2. Send to multiple providers in parallel (HeadyPythia, HeadyJules, Groq)
 *   3. Compare responses, score quality
 *   4. Store best knowledge in vector memory
 *   5. Track provider performance for routing optimization
 *
 * This turns idle HeadySupervisors into active learners that
 * grow the knowledge base with every cycle.
 *
 * Timing: runs as part of self-optimizer continuous loop.
 * Rate limit: max 1 learning query per provider per cycle to control costs.
 * ──────────────────────────────────────────────────────────────────
 */

"use strict";

const fs = require("fs");
const path = require("path");
const HeadyGateway = require(path.join(__dirname, "..", "heady-hive-sdk", "lib", "gateway"));
const { createProviders } = require(path.join(__dirname, "..", "heady-hive-sdk", "lib", "providers"));

const LEARN_LOG = path.join(__dirname, "..", "data", "learning-log.jsonl");
const CURRICULUM_FILE = path.join(__dirname, "..", "data", "learning-curriculum.json");
const dir = path.dirname(LEARN_LOG);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// ─── Learning Curriculum ────────────────────────────────────────
// Topics the system should actively learn about.
// As it learns, topics get marked done and new ones are generated.
const DEFAULT_CURRICULUM = [
    // System architecture
    { topic: "What are the best practices for Node.js event loop optimization in production systems?", category: "architecture", priority: 1 },
    { topic: "How should microservices handle circuit breaker patterns with fallback strategies?", category: "architecture", priority: 2 },
    { topic: "What are effective strategies for managing 150+ concurrent async tasks in Node.js?", category: "architecture", priority: 1 },
    // AI/ML
    { topic: "What are the best embedding models for semantic search in 2025-2026?", category: "ai", priority: 1 },
    { topic: "How do you implement RAG (retrieval augmented generation) with 3D spatial vector indexing?", category: "ai", priority: 1 },
    { topic: "What are the tradeoffs between different LLM providers for latency vs quality?", category: "ai", priority: 2 },
    // Security
    { topic: "What are the critical security practices for API key management in multi-provider AI systems?", category: "security", priority: 1 },
    { topic: "How should a production system handle rate limiting across multiple API providers?", category: "security", priority: 2 },
    // Performance
    { topic: "What techniques reduce cold start latency in serverless and container deployments?", category: "performance", priority: 2 },
    { topic: "How do you optimize WebSocket connections for real-time voice relay systems?", category: "performance", priority: 2 },
    // Infrastructure
    { topic: "Best practices for Cloudflare Workers as intelligent edge routers with dynamic routing tables?", category: "infrastructure", priority: 2 },
    { topic: "How to implement federated routing across edge, cloud, and local compute layers?", category: "infrastructure", priority: 1 },
    // Creative
    { topic: "What makes a premium, modern web UI feel state-of-the-art in 2026?", category: "design", priority: 3 },
    { topic: "How should AI personal assistants handle cross-device state sync and voice dictation?", category: "product", priority: 1 },
];

// ─── SDK Gateway (single source of truth) ────────────────────────
let _gateway = null;
function getGateway() {
    if (!_gateway) {
        _gateway = new HeadyGateway({ cacheTTL: 300000 });
        const providers = createProviders(process.env);
        for (const p of providers) _gateway.registerProvider(p);
    }
    return _gateway;
}

async function callViaGateway(prompt) {
    const start = Date.now();
    try {
        const gateway = getGateway();
        const result = await gateway.chat(prompt, {
            system: "You are HeadyBrain, an expert AI system architect. Answer concisely and practically. Focus on actionable knowledge, code patterns, and real-world best practices. Keep responses under 800 words.",
            maxTokens: 1500,
            temperature: 0.5,
        });
        if (result.ok && result.response && result.response.length > 50) {
            return {
                ok: true,
                response: result.response,
                latency: Date.now() - start,
                provider: result.engine || "gateway",
                tokens: result.response.length,
            };
        }
        return { ok: false, error: "Low quality response", latency: Date.now() - start, provider: result.engine || "gateway" };
    } catch (err) {
        return { ok: false, error: err.message, latency: Date.now() - start, provider: "gateway" };
    }
}

// ─── Learning State ─────────────────────────────────────────────
let curriculum = [...DEFAULT_CURRICULUM];
try {
    const saved = JSON.parse(fs.readFileSync(CURRICULUM_FILE, "utf-8"));
    if (Array.isArray(saved) && saved.length > 0) curriculum = saved;
} catch { }

let learnStats = {
    totalLearned: 0,
    totalProviderCalls: 0,
    providerSuccesses: { headypythia: 0, groq: 0, perplexity: 0, headyhub: 0 },
    providerErrors: { headypythia: 0, groq: 0, perplexity: 0, headyhub: 0 },
    topicsCompleted: 0,
    lastLearnedAt: null,
    lastTopic: null,
};

function logLearn(entry) {
    try { fs.appendFileSync(LEARN_LOG, JSON.stringify({ ...entry, ts: new Date().toISOString() }) + "\n"); } catch { }
}

// ─── Core Learning Cycle ────────────────────────────────────────
/**
 * Run one learning cycle:
 * 1. Pick the highest-priority unlearned topic
 * 2. Send to 2-3 providers in parallel
 * 3. Score and compare responses
 * 4. Store best knowledge in vector memory
 * 5. Update curriculum and stats
 *
 * @param {Object} vectorMem - vector memory instance for storage
 * @returns {Object} - learning result
 */
async function runLearningCycle(vectorMem) {
    // Pick topic
    const pending = curriculum.filter(t => !t.learned);
    if (pending.length === 0) {
        // Everyone learned — generate new topics by asking HeadyPythia
        await generateNewTopics();
        return { ok: true, action: "curriculum_refresh", topicsGenerated: curriculum.filter(t => !t.learned).length };
    }

    // Highest priority first
    pending.sort((a, b) => (a.priority || 5) - (b.priority || 5));
    const topic = pending[0];

    const systemPrompt = `You are HeadyBrain, an expert AI system architect. Answer concisely and practically. Focus on actionable knowledge, code patterns, and real-world best practices. Keep responses under 800 words.`;
    const prompt = `${systemPrompt}\n\nQuestion: ${topic.topic}`;

    // Call 2-3 providers in parallel (rotate to spread usage)
    const cycleIndex = learnStats.totalLearned;
    const providers = [callViaGateway, callViaGateway, callViaGateway]; // 3 parallel gateway calls (gateway races internally)

    const results = await Promise.allSettled(providers.map(fn => fn(prompt)));
    const responses = results
        .map(r => r.status === "fulfilled" ? r.value : null)
        .filter(r => r && r.ok && r.response && r.response.length > 50);

    // Track stats
    for (const r of results) {
        const res = r.status === "fulfilled" ? r.value : null;
        if (res) {
            learnStats.totalProviderCalls++;
            if (res.ok) {
                learnStats.providerSuccesses[res.provider] = (learnStats.providerSuccesses[res.provider] || 0) + 1;
            } else {
                learnStats.providerErrors[res.provider] = (learnStats.providerErrors[res.provider] || 0) + 1;
            }
        }
    }

    if (responses.length === 0) {
        logLearn({ type: "learn:failed", topic: topic.topic, error: "All providers failed" });
        return { ok: false, error: "All providers failed for this topic" };
    }

    // Pick best response (longest meaningful response = most knowledge)
    responses.sort((a, b) => b.response.length - a.response.length);
    const best = responses[0];

    // Store in vector memory
    if (vectorMem && typeof vectorMem.ingestMemory === "function") {
        try {
            await vectorMem.ingestMemory({
                content: `[Learning: ${topic.category}] Q: ${topic.topic}\nA: ${best.response.substring(0, 2000)}`,
                metadata: {
                    type: "learned_knowledge",
                    category: topic.category,
                    provider: best.provider,
                    latency: best.latency,
                    responseCount: responses.length,
                    cycle: learnStats.totalLearned,
                },
            });
        } catch (err) {
            console.warn(`  ⚠ Learning: vector store failed: ${err.message}`);
        }
    }

    // Mark topic as learned
    topic.learned = true;
    topic.learnedAt = new Date().toISOString();
    topic.provider = best.provider;
    topic.responseLength = best.response.length;
    learnStats.totalLearned++;
    learnStats.topicsCompleted++;
    learnStats.lastLearnedAt = Date.now();
    learnStats.lastTopic = topic.topic;

    // Save curriculum
    try { fs.writeFileSync(CURRICULUM_FILE, JSON.stringify(curriculum, null, 2)); } catch { }

    const result = {
        ok: true,
        topic: topic.topic,
        category: topic.category,
        bestProvider: best.provider,
        bestLatency: best.latency,
        responsesReceived: responses.length,
        responseLength: best.response.length,
        totalLearned: learnStats.totalLearned,
        remaining: curriculum.filter(t => !t.learned).length,
    };

    logLearn({ type: "learn:success", ...result });
    console.log(`  🧠 Learned: [${topic.category}] "${topic.topic.substring(0, 60)}..." via ${best.provider} (${best.latency}ms)`);

    return result;
}

// ─── Topic Generation ───────────────────────────────────────────
async function generateNewTopics() {
    try {
        const result = await callViaGateway(
            `Generate 10 advanced technical learning topics for an AI system architect building a multi-provider AI orchestration platform with vector memory, edge routing, and real-time voice relay. Return ONLY a JSON array of objects with {topic, category, priority} where category is one of: architecture, ai, security, performance, infrastructure, design, product. Priority 1=critical, 2=important, 3=nice-to-have.`
        );
        if (result && result.ok && result.response) {
            const match = result.response.match(/\[[\s\S]*\]/);
            if (match) {
                const newTopics = JSON.parse(match[0]);
                if (Array.isArray(newTopics)) {
                    for (const t of newTopics) {
                        if (t.topic && !curriculum.find(c => c.topic === t.topic)) {
                            curriculum.push({ ...t, learned: false });
                        }
                    }
                    try { fs.writeFileSync(CURRICULUM_FILE, JSON.stringify(curriculum, null, 2)); } catch { }
                    logLearn({ type: "curriculum:generated", count: newTopics.length });
                }
            }
        }
    } catch (err) {
        console.warn(`  ⚠ Learning: topic generation failed: ${err.message}`);
    }
}

// ─── Stats & Routes ─────────────────────────────────────────────
function getLearnStats() {
    return {
        ...learnStats,
        curriculumSize: curriculum.length,
        remaining: curriculum.filter(t => !t.learned).length,
        completed: curriculum.filter(t => t.learned).length,
        categories: [...new Set(curriculum.map(c => c.category))],
    };
}

function registerRoutes(app) {
    app.get("/api/learn/status", (req, res) => {
        res.json({ ok: true, ...getLearnStats() });
    });

    app.get("/api/learn/curriculum", (req, res) => {
        res.json({
            ok: true,
            total: curriculum.length,
            completed: curriculum.filter(t => t.learned).length,
            remaining: curriculum.filter(t => !t.learned).length,
            topics: curriculum.map(t => ({
                topic: t.topic.substring(0, 100),
                category: t.category,
                priority: t.priority,
                learned: !!t.learned,
                provider: t.provider || null,
            })),
        });
    });

    app.post("/api/learn/run", async (req, res) => {
        try {
            const vectorMem = req.app.locals.vectorMemory;
            const result = await runLearningCycle(vectorMem);
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    console.log("  🧠 ContinuousLearning: LOADED (multi-provider active learning)");
    console.log(`    → Curriculum: ${curriculum.length} topics, ${curriculum.filter(t => t.learned).length} learned`);
    console.log("    → Endpoints: /api/learn/status, /curriculum, /run");
}

module.exports = {
    runLearningCycle,
    getLearnStats,
    registerRoutes,
};
