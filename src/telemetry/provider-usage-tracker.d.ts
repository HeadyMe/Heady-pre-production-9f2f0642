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
export function record(event: {
    provider: string;
    account?: string | undefined;
    model: string;
    tokensIn?: number | undefined;
    tokensOut?: number | undefined;
    costUsd: number;
    latencyMs?: number | undefined;
    action?: string | undefined;
    success?: boolean | undefined;
    error?: string | undefined;
    metadata?: object | undefined;
}): object;
/**
 * Get summary for a specific provider.
 * @param {string} provider
 * @param {string} [period] - "daily", "monthly", or "all" (default)
 * @returns {object} Provider analytics
 */
export function getProviderSummary(provider: string, period?: string): object;
/**
 * Get summary for a specific account.
 * @param {string} account
 * @returns {object} Account analytics
 */
export function getAccountSummary(account: string): object;
/**
 * Get summary across all providers.
 * @param {string} [period] - "daily", "monthly", or "all"
 * @returns {object} Dashboard-ready rollup
 */
export function getAllProvidersSummary(period?: string): object;
/**
 * Check budget status for a provider.
 * @param {string} provider
 * @returns {object} Budget status with alert level
 */
export function checkProviderBudget(provider: string): object;
/**
 * Get all providers budget status.
 * @returns {object[]} Array of budget statuses
 */
export function getAllBudgetStatus(): object[];
/**
 * Get providers that have exceeded their budget (for finops routing exclusion).
 * @returns {string[]} Array of provider names to exclude
 */
export function getExceededProviders(): string[];
/**
 * Get top providers ranked by a metric.
 * @param {string} [metric] - "cost", "calls", or "tokens"
 * @param {number} [limit] - Max results
 * @returns {object[]}
 */
export function getTopProviders(metric?: string, limit?: number): object[];
/**
 * Get the full account registry.
 * @returns {object} All known provider accounts
 */
export function getAccountRegistry(): object;
/**
 * Calculate latency percentiles from recent data.
 */
export function calculatePercentiles(): {
    p50: null;
    p95: null;
    p99: null;
    sampleSize?: undefined;
} | {
    p50: any;
    p95: any;
    p99: any;
    sampleSize: number;
};
export const ACCOUNT_REGISTRY: {
    gcloud: {
        id: string;
        label: string;
    }[];
    "google-ai-studio": {
        id: string;
        label: string;
    }[];
    "google-ai-ultra": {
        id: string;
        label: string;
    }[];
    "github-enterprise": {
        id: string;
        label: string;
    }[];
    cloudflare: {
        id: string;
        label: string;
    }[];
    groq: {
        id: string;
        label: string;
    }[];
    anthropic: {
        id: string;
        label: string;
    }[];
    openai: {
        id: string;
        label: string;
    }[];
    perplexity: {
        id: string;
        label: string;
    }[];
    xai: {
        id: string;
        label: string;
    }[];
    "gcloud-cloudrun": {
        id: string;
        label: string;
    }[];
    gemini: {
        id: string;
        label: string;
    }[];
    huggingface: {
        id: string;
        label: string;
    }[];
};
export const USAGE_LOG: string;
declare namespace aggregates {
    let byProvider: {};
    let byAccount: {};
    let byModel: {};
    let daily: {};
    let monthly: {};
    let totalCostUsd: number;
    let totalCalls: number;
    let latencyBuckets: never[];
}
/**
 * Initialize an empty stats bucket.
 */
declare function emptyStats(): {
    calls: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    latencySum: number;
    latencyCount: number;
    errors: number;
    firstSeen: null;
    lastSeen: null;
};
/**
 * Hydrate aggregates from existing JSONL log on startup.
 * Called once at require-time to restore state.
 */
declare function hydrateFromLog(): void;
export { aggregates as _aggregates, emptyStats as _emptyStats, hydrateFromLog as _hydrateFromLog };
//# sourceMappingURL=provider-usage-tracker.d.ts.map