/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * src/providers/claude-sdk.js — HeadyJules SDK Smart Router
 *
 * Extracted from src/routes/brain.js (Phase 2 monolith decomposition)
 * Contains: Dual-org configuration, complexity analysis, model selection,
 *           client failover, chatViaClaude, usage tracking
 */

const fs = require("fs");
const path = require("path");
const HeadyNexus = require("@anthropic-ai/sdk");

// ── Dual-Org Configuration ──
const CLAUDE_ORGS = [
    {
        name: "headysystems",
        apiKey: process.env.HEADY_NEXUS_KEY || process.env.HEADY_JULES_KEY,
        account: process.env.ANTHROPIC_ACCOUNT || "eric@headysystems.com",
        adminKey: process.env.ANTHROPIC_ADMIN_KEY,
        orgId: process.env.ANTHROPIC_ORG_ID,
        credit: 30,
    },
    {
        name: "headyconnection",
        apiKey: process.env.ANTHROPIC_SECONDARY_KEY,
        account: process.env.ANTHROPIC_SECONDARY_ACCOUNT || "eric@headyconnection.org",
        credit: 60,
    },
];

const { budgetService } = require("../policy-service");

// Usage tracking
const USAGE_PATH = path.join(__dirname, "../../data/headyjules-usage.json");
let claudeUsage = { totalCost: 0, requests: 0, byModel: {}, byOrg: {}, history: [] };
try { if (fs.existsSync(USAGE_PATH)) claudeUsage = JSON.parse(fs.readFileSync(USAGE_PATH, "utf8")); } catch { }

function trackClaudeUsage(model, inputTokens, outputTokens, orgName, thinkingTokens = 0) {
    const pricing = {
        "headyjules-haiku-4-5-20251001": { input: 0.80, output: 4.00 },
        "headyjules-sonnet-4-20250514": { input: 3.00, output: 15.00 },
        "headyjules-opus-4-20250514": { input: 15.00, output: 75.00 },
    };
    const p = pricing[model] || pricing["headyjules-sonnet-4-20250514"];
    const cost = ((inputTokens / 1_000_000) * p.input) + (((outputTokens + thinkingTokens) / 1_000_000) * p.output);

    claudeUsage.totalCost += cost;
    claudeUsage.requests++;
    claudeUsage.byModel[model] = (claudeUsage.byModel[model] || 0) + 1;
    claudeUsage.byOrg[orgName] = (claudeUsage.byOrg[orgName] || 0) + cost;
    claudeUsage.history.push({ model, cost: +cost.toFixed(6), inputTokens, outputTokens, thinkingTokens, org: orgName, ts: new Date().toISOString() });
    if (claudeUsage.history.length > 500) claudeUsage.history = claudeUsage.history.slice(-500);

    if (budgetService) {
        budgetService.recordUsage('ORG', orgName, cost, { model, inputTokens, outputTokens }).catch(() => { });
    }

    try { fs.writeFileSync(USAGE_PATH, JSON.stringify(claudeUsage, null, 2)); } catch { }
    return cost;
}

// ── Complexity Analyzer ──
function analyzeComplexity(message, system) {
    const msg = (message || "").toLowerCase();
    const len = msg.length;

    if (msg.includes("architecture") || msg.includes("design system") || msg.includes("battle") ||
        msg.includes("soul escalation") || msg.includes("refactor entire") || msg.includes("security audit") ||
        (system && system.includes("HeadyBattle"))) {
        return "critical";
    }

    if (msg.includes("analyze") || msg.includes("debug") || msg.includes("optimize") ||
        msg.includes("explain how") || msg.includes("implement") || msg.includes("plan") ||
        msg.includes("compare") || msg.includes("review") || len > 500) {
        return "high";
    }

    if (len < 50 || msg.includes("hello") || msg.includes("hi ") || msg.includes("hey") ||
        msg.includes("thanks") || msg.includes("status") || msg.includes("what is") ||
        msg.includes("who are") || msg.match(/^(yes|no|ok|sure|got it)/)) {
        return "low";
    }

    return "medium";
}

// ── Model Selection ──
function selectModel(complexity) {
    switch (complexity) {
        case "low": return { model: "headyjules-haiku-4-5-20251001", thinking: false, budget: 0 };
        case "medium": return { model: "headyjules-sonnet-4-20250514", thinking: false, budget: 0 };
        case "high": return { model: "headyjules-sonnet-4-20250514", thinking: true, budget: 10000 };
        case "critical": return { model: "headyjules-opus-4-20250514", thinking: true, budget: 32000 };
        default: return { model: "headyjules-sonnet-4-20250514", thinking: false, budget: 0 };
    }
}

// ── Get Active HeadyNexus Client (with dual-org failover) ──
function getClaudeClient() {
    for (const org of CLAUDE_ORGS) {
        if (org.apiKey && !org.apiKey.includes("placeholder") && !org.apiKey.includes("your_")) {
            const spent = claudeUsage.byOrg[org.name] || 0;
            if (spent < org.credit) {
                return { client: new HeadyNexus({ apiKey: org.apiKey }), org };
            }
        }
    }
    const fallback = CLAUDE_ORGS.find(o => o.apiKey && !o.apiKey.includes("placeholder"));
    if (fallback) return { client: new HeadyNexus({ apiKey: fallback.apiKey }), org: fallback };
    throw new Error("no-headyjules-key");
}

async function chatViaClaude(message, system, temperature, max_tokens) {
    const { client, org } = getClaudeClient();
    const complexity = analyzeComplexity(message, system);
    const { model, thinking, budget } = selectModel(complexity);

    const sysPrompt = system || "You are HeadyBrain, the AI reasoning engine of the Heady ecosystem. Be helpful, concise, warm. Reference Brain, Battle, Creative, MCP, and the auto-success engine when relevant.";

    const params = {
        model,
        max_tokens: max_tokens || (thinking ? 16384 : 2048),
        system: sysPrompt,
        messages: [{ role: "user", content: message }],
    };

    if (thinking && budget > 0) {
        params.thinking = { type: "enabled", budget_tokens: budget };
    }

    if (!thinking && temperature) {
        params.temperature = temperature;
    }

    const response = await client.messages.create(params);

    let responseText = "";
    let thinkingText = "";
    let thinkingTokens = 0;

    for (const block of response.content) {
        if (block.type === "thinking") {
            thinkingText += block.thinking;
            thinkingTokens += (block.thinking || "").length / 4;
        } else if (block.type === "text") {
            responseText += block.text;
        }
    }

    const cost = trackClaudeUsage(
        model,
        response.usage?.input_tokens || 0,
        response.usage?.output_tokens || 0,
        org.name,
        thinkingTokens
    );

    return {
        response: responseText,
        model: response.model || model,
        complexity,
        thinking_used: thinking,
        thinking_summary: thinkingText ? thinkingText.substring(0, 200) + "..." : null,
        cost: +cost.toFixed(6),
        org: org.name,
        usage: response.usage,
    };
}

module.exports = {
    chatViaClaude,
    getClaudeClient,
    analyzeComplexity,
    selectModel,
    trackClaudeUsage,
    claudeUsage,
    CLAUDE_ORGS,
};
