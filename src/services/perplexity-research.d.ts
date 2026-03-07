export class PerplexityResearchService {
    constructor(opts?: {});
    apiKey: any;
    vectorMemory: any;
    budgetTracker: any;
    stats: {
        totalQueries: number;
        totalTokensUsed: number;
        byMode: {};
        errors: number;
    };
    /**
     * Execute a research query via the Perplexity Sonar API.
     * @param {object} params
     * @param {string} params.query - Research question
     * @param {string} params.mode - quick | deep | academic | news
     * @param {string} params.timeframe - all | day | week | month | year
     * @param {number} params.maxSources - Max citation URLs
     * @param {string} params.context - Optional project context to inject
     * @param {boolean} params.persist - Whether to persist results to vector memory (default: true)
     */
    research({ query, mode, timeframe, maxSources, context, persist }: {
        query: string;
        mode: string;
        timeframe: string;
        maxSources: number;
        context: string;
        persist: boolean;
    }): Promise<{
        ok: boolean;
        service: string;
        mode: string;
        model: any;
        query: string;
        answer: any;
        citations: any;
        usage: {
            promptTokens: any;
            completionTokens: any;
            totalTokens: any;
        };
        latencyMs: number;
        persisted: boolean;
        timestamp: string;
    }>;
    _simpleEmbed(text: any): number[];
    getStats(): {
        apiKeyConfigured: boolean;
        totalQueries: number;
        totalTokensUsed: number;
        byMode: {};
        errors: number;
    };
}
/**
 * Register Perplexity research routes on Express app.
 * Replaces the stub from service-stubs.js.
 */
export function registerPerplexityRoutes(app: any, opts?: {}): PerplexityResearchService;
//# sourceMappingURL=perplexity-research.d.ts.map