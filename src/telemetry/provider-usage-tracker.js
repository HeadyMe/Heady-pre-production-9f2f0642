/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ Provider Usage Tracker ═══
 *
 * Persistent, account-aware provider usage analytics for intelligent budgeting.
 * Tracks every AI provider call with per-account granularity:
 *   - 2 GCloud accounts, 3 Google AI Studio accounts
 *   - Google AI Ultra subscription
 *   - GitHub Enterprise
 *   - Cloudflare Workers AI, Groq, Anthropic, OpenAI, Perplexity, xAI
 *
 * Persists to JSONL for durability. Aggregates on-demand for dashboards.
 * Emits budget alerts at configurable thresholds.
 *
 * Heady AI Nodes: OBSERVER, SENTINEL, CONDUCTOR
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const USAGE_LOG = path.join(DATA_DIR, "provider-usage.jsonl");
const BUDGET_CONFIG_PATH = path.join(__dirname, "..", "..", "configs", "provider-budgets.yaml");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── In-Memory Aggregation Cache ──────────────────────────────────
const aggregates = {
    byProvider: {},    // provider -> { calls, tokensIn, tokensOut, costUsd, latencySum, latencyCount, errors }
    byAccount: {},     // account -> { calls, tokensIn, tokensOut, costUsd, latencySum, latencyCount, errors }
    byModel: {},       // model -> { calls, tokensIn, tokensOut, costUsd }
    daily: {},         // YYYY-MM-DD -> { provider -> stats }
    monthly: {},       // YYYY-MM -> { provider -> stats }
    totalCostUsd: 0,
    totalCalls: 0,
    latencyBuckets: [], // last 1000 latencies for percentile calculation
};

// ── Known Accounts Registry ─────────────────────────────────────
// Maps provider names to known accounts/subscriptions
const ACCOUNT_REGISTRY = {
    "gcloud": [
        { id: "gcloud-account-1", label: "GCloud Primary" },
        { id: "gcloud-account-2", label: "GCloud Secondary" },
    ],
    "google-ai-studio": [
        { id: "google-ai-studio-1", label: "AI Studio Account 1" },
        { id: "google-ai-studio-2", label: "AI Studio Account 2" },
        { id: "google-ai-studio-3", label: "AI Studio Account 3" },
    ],
    "google-ai-ultra": [
        { id: "google-ai-ultra", label: "Google AI Ultra Subscription" },
    ],
    "github-enterprise": [
        { id: "github-enterprise", label: "GitHub Enterprise" },
    ],
    "cloudflare": [
        { id: "cloudflare-workers-ai", label: "Cloudflare Workers AI" },
    ],
    "groq": [
        { id: "groq-cloud", label: "Groq Cloud" },
    ],
    "anthropic": [
        { id: "anthropic-api", label: "Anthropic API" },
    ],
    "openai": [
        { id: "openai-api", label: "OpenAI API" },
    ],
    "perplexity": [
        { id: "perplexity-sonar", label: "Perplexity Sonar" },
    ],
    "xai": [
        { id: "xai-grok", label: "xAI Grok" },
    ],
    "gcloud-cloudrun": [
        { id: "gcloud-cloudrun-1", label: "Cloud Run Primary" },
        { id: "gcloud-cloudrun-2", label: "Cloud Run Secondary" },
    ],
    "gemini": [
        { id: "gemini-api", label: "Gemini API (Google AI Studio)" },
    ],
    "huggingface": [
        { id: "huggingface-spaces", label: "HuggingFace Spaces" },
    ],
};

/**
 * Load budget configuration from YAML.
 * @returns {object} Budget config with per-provider/account limits and alert thresholds
 */
function loadBudgetConfig() {
    try {
        if (fs.existsSync(BUDGET_CONFIG_PATH)) {
            return yaml.load(fs.readFileSync(BUDGET_CONFIG_PATH, "utf8"));
        }
    } catch (err) {
        console.error("[ProviderTracker] Budget config load error:", err.message);
    }
    return { budgets: {}, alerts: { warning_threshold: 0.80, critical_threshold: 1.00 } };
}

/**
 * Initialize an empty stats bucket.
 */
function emptyStats() {
    return {
        calls: 0,
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        latencySum: 0,
        latencyCount: 0,
        errors: 0,
        firstSeen: null,
        lastSeen: null,
    };
}

/**
 * Increment stats bucket with new data.
 */
function incrementStats(bucket, data) {
    bucket.calls++;
    bucket.tokensIn += data.tokensIn || 0;
    bucket.tokensOut += data.tokensOut || 0;
    bucket.costUsd += data.costUsd || 0;
    if (data.latencyMs) {
        bucket.latencySum += data.latencyMs;
        bucket.latencyCount++;
    }
    if (data.error) bucket.errors++;
    const now = new Date().toISOString();
    if (!bucket.firstSeen) bucket.firstSeen = now;
    bucket.lastSeen = now;
}

/**
 * Record a provider usage event.
 *
 * @param {object} event
 * @param {string} event.provider     - Provider name (e.g., "anthropic", "gcloud")
 * @param {string} [event.account]    - Account/subscription ID (auto-resolved if omitted)
 * @param {string} event.model        - Model name
 * @param {number} [event.tokensIn]   - Input tokens
 * @param {number} [event.tokensOut]  - Output tokens
 * @param {number} event.costUsd      - Cost in USD
 * @param {number} [event.latencyMs]  - Response latency in ms
 * @param {string} [event.action]     - Action type (chat, analyze, etc.)
 * @param {boolean} [event.success]   - Whether the call succeeded
 * @param {string} [event.error]      - Error message if failed
 * @param {object} [event.metadata]   - Extra context
 * @returns {object} The recorded entry with budget status
 */
function record(event) {
    const {
        provider,
        model,
        tokensIn = 0,
        tokensOut = 0,
        costUsd = 0,
        latencyMs = null,
        action = "chat",
        success = true,
        error = null,
        metadata = {},
    } = event;

    // Resolve account — use explicit, or auto-resolve from provider
    const account = event.account || resolveAccount(provider);

    const entry = {
        id: `pu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ts: new Date().toISOString(),
        provider,
        account,
        model,
        tokensIn,
        tokensOut,
        costUsd: Math.round(costUsd * 1000000) / 1000000, // 6 decimal precision
        latencyMs,
        action,
        success,
        error,
        ...metadata,
    };

    // ── 1. Persist to JSONL ─────────────────────────────────────────
    try {
        fs.appendFileSync(USAGE_LOG, JSON.stringify(entry) + "\n");
    } catch (err) {
        console.error("[ProviderTracker] Write error:", err.message);
    }

    // ── 2. Update in-memory aggregates ──────────────────────────────
    const data = { tokensIn, tokensOut, costUsd, latencyMs, error };

    // By provider
    if (!aggregates.byProvider[provider]) aggregates.byProvider[provider] = emptyStats();
    incrementStats(aggregates.byProvider[provider], data);

    // By account
    if (!aggregates.byAccount[account]) aggregates.byAccount[account] = emptyStats();
    incrementStats(aggregates.byAccount[account], data);

    // By model
    if (!aggregates.byModel[model]) aggregates.byModel[model] = emptyStats();
    incrementStats(aggregates.byModel[model], data);

    // Daily
    const day = entry.ts.split("T")[0];
    if (!aggregates.daily[day]) aggregates.daily[day] = {};
    if (!aggregates.daily[day][provider]) aggregates.daily[day][provider] = emptyStats();
    incrementStats(aggregates.daily[day][provider], data);

    // Monthly
    const month = day.slice(0, 7);
    if (!aggregates.monthly[month]) aggregates.monthly[month] = {};
    if (!aggregates.monthly[month][provider]) aggregates.monthly[month][provider] = emptyStats();
    incrementStats(aggregates.monthly[month][provider], data);

    // Totals
    aggregates.totalCostUsd += costUsd;
    aggregates.totalCalls++;

    // Latency percentile bucket (keep last 1000)
    if (latencyMs) {
        aggregates.latencyBuckets.push(latencyMs);
        if (aggregates.latencyBuckets.length > 1000) aggregates.latencyBuckets.shift();
    }

    // ── 3. Check budget ─────────────────────────────────────────────
    const budgetStatus = checkProviderBudget(provider);

    return { entry, budgetStatus };
}

/**
 * Auto-resolve account from provider name.
 */
function resolveAccount(provider) {
    const accounts = ACCOUNT_REGISTRY[provider];
    if (accounts && accounts.length === 1) return accounts[0].id;
    if (accounts && accounts.length > 1) return accounts[0].id; // default to first; override via event.account
    return `${provider}-default`;
}

/**
 * Get summary for a specific provider.
 * @param {string} provider
 * @param {string} [period] - "daily", "monthly", or "all" (default)
 * @returns {object} Provider analytics
 */
function getProviderSummary(provider, period = "all") {
    if (period === "daily") {
        const today = new Date().toISOString().split("T")[0];
        return aggregates.daily[today]?.[provider] || emptyStats();
    }
    if (period === "monthly") {
        const month = new Date().toISOString().slice(0, 7);
        return aggregates.monthly[month]?.[provider] || emptyStats();
    }
    return aggregates.byProvider[provider] || emptyStats();
}

/**
 * Get summary for a specific account.
 * @param {string} account
 * @returns {object} Account analytics
 */
function getAccountSummary(account) {
    return aggregates.byAccount[account] || emptyStats();
}

/**
 * Get summary across all providers.
 * @param {string} [period] - "daily", "monthly", or "all"
 * @returns {object} Dashboard-ready rollup
 */
function getAllProvidersSummary(period = "all") {
    const source = period === "daily"
        ? aggregates.daily[new Date().toISOString().split("T")[0]] || {}
        : period === "monthly"
            ? aggregates.monthly[new Date().toISOString().slice(0, 7)] || {}
            : aggregates.byProvider;

    const providers = Object.entries(source).map(([name, stats]) => ({
        provider: name,
        ...stats,
        avgLatencyMs: stats.latencyCount > 0 ? Math.round(stats.latencySum / stats.latencyCount) : null,
        errorRate: stats.calls > 0 ? ((stats.errors / stats.calls) * 100).toFixed(2) + "%" : "0%",
    }));

    return {
        period,
        timestamp: new Date().toISOString(),
        totalCostUsd: period === "all" ? aggregates.totalCostUsd : providers.reduce((s, p) => s + p.costUsd, 0),
        totalCalls: period === "all" ? aggregates.totalCalls : providers.reduce((s, p) => s + p.calls, 0),
        providers: providers.sort((a, b) => b.costUsd - a.costUsd),
        accounts: Object.entries(aggregates.byAccount).map(([id, stats]) => ({
            account: id,
            ...stats,
        })),
        latencyPercentiles: calculatePercentiles(),
    };
}

/**
 * Check budget status for a provider.
 * @param {string} provider
 * @returns {object} Budget status with alert level
 */
function checkProviderBudget(provider) {
    const config = loadBudgetConfig();
    const budget = config.budgets?.[provider];
    if (!budget) return { provider, hasBudget: false, status: "unlimited" };

    const month = new Date().toISOString().slice(0, 7);
    const monthlyStats = aggregates.monthly[month]?.[provider] || emptyStats();
    const spent = monthlyStats.costUsd;
    const limit = budget.monthly_limit_usd || Infinity;
    const usage = limit > 0 ? spent / limit : 0;

    const warningThreshold = config.alerts?.warning_threshold || 0.80;
    const criticalThreshold = config.alerts?.critical_threshold || 1.00;

    let status = "ok";
    let alert = null;
    if (usage >= criticalThreshold) {
        status = "exceeded";
        alert = `🚨 BUDGET EXCEEDED: ${provider} spent $${spent.toFixed(4)} / $${limit.toFixed(2)} (${(usage * 100).toFixed(1)}%)`;
    } else if (usage >= warningThreshold) {
        status = "warning";
        alert = `⚠️ BUDGET WARNING: ${provider} at $${spent.toFixed(4)} / $${limit.toFixed(2)} (${(usage * 100).toFixed(1)}%)`;
    }

    return {
        provider,
        hasBudget: true,
        status,
        alert,
        spent: Math.round(spent * 10000) / 10000,
        limit,
        remaining: Math.max(0, limit - spent),
        usagePercent: (usage * 100).toFixed(1) + "%",
        period: month,
    };
}

/**
 * Get all providers budget status.
 * @returns {object[]} Array of budget statuses
 */
function getAllBudgetStatus() {
    const config = loadBudgetConfig();
    const providers = Object.keys(config.budgets || {});
    return providers.map(p => checkProviderBudget(p));
}

/**
 * Get providers that have exceeded their budget (for finops routing exclusion).
 * @returns {string[]} Array of provider names to exclude
 */
function getExceededProviders() {
    return getAllBudgetStatus()
        .filter(b => b.status === "exceeded")
        .map(b => b.provider);
}

/**
 * Get top providers ranked by a metric.
 * @param {string} [metric] - "cost", "calls", or "tokens"
 * @param {number} [limit] - Max results
 * @returns {object[]}
 */
function getTopProviders(metric = "cost", limit = 10) {
    const entries = Object.entries(aggregates.byProvider).map(([name, stats]) => ({
        provider: name,
        ...stats,
    }));

    switch (metric) {
        case "calls": entries.sort((a, b) => b.calls - a.calls); break;
        case "tokens": entries.sort((a, b) => (b.tokensIn + b.tokensOut) - (a.tokensIn + a.tokensOut)); break;
        default: entries.sort((a, b) => b.costUsd - a.costUsd);
    }

    return entries.slice(0, limit);
}

/**
 * Calculate latency percentiles from recent data.
 */
function calculatePercentiles() {
    const sorted = [...aggregates.latencyBuckets].sort((a, b) => a - b);
    if (sorted.length === 0) return { p50: null, p95: null, p99: null };

    return {
        p50: sorted[Math.floor(sorted.length * 0.50)] || null,
        p95: sorted[Math.floor(sorted.length * 0.95)] || null,
        p99: sorted[Math.floor(sorted.length * 0.99)] || null,
        sampleSize: sorted.length,
    };
}

/**
 * Get the full account registry.
 * @returns {object} All known provider accounts
 */
function getAccountRegistry() {
    return ACCOUNT_REGISTRY;
}

/**
 * Hydrate aggregates from existing JSONL log on startup.
 * Called once at require-time to restore state.
 */
function hydrateFromLog() {
    try {
        if (!fs.existsSync(USAGE_LOG)) return;
        const lines = fs.readFileSync(USAGE_LOG, "utf8").trim().split("\n").filter(Boolean);
        for (const line of lines) {
            try {
                const entry = JSON.parse(line);
                const data = {
                    tokensIn: entry.tokensIn || 0,
                    tokensOut: entry.tokensOut || 0,
                    costUsd: entry.costUsd || 0,
                    latencyMs: entry.latencyMs || null,
                    error: entry.error || null,
                };

                // Provider
                if (!aggregates.byProvider[entry.provider]) aggregates.byProvider[entry.provider] = emptyStats();
                incrementStats(aggregates.byProvider[entry.provider], data);

                // Account
                const account = entry.account || `${entry.provider}-default`;
                if (!aggregates.byAccount[account]) aggregates.byAccount[account] = emptyStats();
                incrementStats(aggregates.byAccount[account], data);

                // Model
                if (entry.model) {
                    if (!aggregates.byModel[entry.model]) aggregates.byModel[entry.model] = emptyStats();
                    incrementStats(aggregates.byModel[entry.model], data);
                }

                // Daily
                if (entry.ts) {
                    const day = entry.ts.split("T")[0];
                    if (!aggregates.daily[day]) aggregates.daily[day] = {};
                    if (!aggregates.daily[day][entry.provider]) aggregates.daily[day][entry.provider] = emptyStats();
                    incrementStats(aggregates.daily[day][entry.provider], data);

                    const month = day.slice(0, 7);
                    if (!aggregates.monthly[month]) aggregates.monthly[month] = {};
                    if (!aggregates.monthly[month][entry.provider]) aggregates.monthly[month][entry.provider] = emptyStats();
                    incrementStats(aggregates.monthly[month][entry.provider], data);
                }

                aggregates.totalCostUsd += data.costUsd;
                aggregates.totalCalls++;
                if (data.latencyMs) aggregates.latencyBuckets.push(data.latencyMs);

            } catch { /* skip malformed lines */ }
        }
        // Trim latency buckets
        if (aggregates.latencyBuckets.length > 1000) {
            aggregates.latencyBuckets = aggregates.latencyBuckets.slice(-1000);
        }
        console.log(`[ProviderTracker] Hydrated ${lines.length} entries from log`);
    } catch (err) {
        console.error("[ProviderTracker] Hydration error:", err.message);
    }
}

// Hydrate on load
hydrateFromLog();

module.exports = {
    record,
    getProviderSummary,
    getAccountSummary,
    getAllProvidersSummary,
    checkProviderBudget,
    getAllBudgetStatus,
    getExceededProviders,
    getTopProviders,
    getAccountRegistry,
    calculatePercentiles,
    ACCOUNT_REGISTRY,
    USAGE_LOG,
    // Exposed for testing
    _aggregates: aggregates,
    _emptyStats: emptyStats,
    _hydrateFromLog: hydrateFromLog,
};
