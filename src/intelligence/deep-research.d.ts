export class DeepResearchEngine {
    constructor(gateway: any, opts?: {});
    gateway: any;
    maxWaitMs: any;
    minProviders: any;
    consensusThreshold: any;
    _researchCount: number;
    /**
     * Execute deep research across all available providers.
     * Returns unified answer with consensus scoring.
     */
    research(query: any, opts?: {}): Promise<{
        ok: boolean;
        error: string;
        query?: undefined;
        depth?: undefined;
        duration_ms?: undefined;
        providers?: undefined;
        synthesis?: undefined;
        findings?: undefined;
        consensus?: undefined;
        sources?: undefined;
        metadata?: undefined;
    } | {
        ok: boolean;
        query: any;
        depth: any;
        duration_ms: number;
        providers: {
            queried: number;
            responded: number;
            list: {
                name: any;
                latency_ms: any;
                tokens: any;
            }[];
        };
        synthesis: any;
        findings: any;
        consensus: {
            score: number;
            providerCount: number;
            agreement?: undefined;
        } | {
            score: number;
            providerCount: any;
            agreement: string;
        };
        sources: any;
        metadata: {
            researchId: string;
            timestamp: string;
        };
        error?: undefined;
    }>;
    _resolveProviders(requested: any): any[];
    _queryProvider(providerName: any, query: any, depth: any, maxWait: any): Promise<{
        provider: any;
        mode: any;
        response: any;
        latency: number;
        tokens: any;
        ok: boolean;
        error?: undefined;
    } | {
        provider: any;
        mode: any;
        response: null;
        latency: number;
        error: any;
        ok: boolean;
        tokens?: undefined;
    }>;
    _collectWithTimeout(promises: any, providers: any, maxWait: any): Promise<any[]>;
    _synthesize(results: any, query: any): {
        unified: string;
        findings: never[];
        consensus: {
            score: number;
            providerCount: number;
            agreement?: undefined;
        };
        sources: never[];
    } | {
        unified: any;
        findings: any;
        consensus: {
            score: number;
            providerCount: any;
            agreement: string;
        };
        sources: any;
    };
    _mergeResponses(results: any, query: any): string;
    getStats(): {
        researchCount: number;
        availableProviders: string[];
        maxWaitMs: any;
        consensusThreshold: any;
    };
}
export namespace DEEP_MODES {
    namespace gemini {
        let model: string;
        let maxTokens: number;
        let mode: string;
    }
    namespace openai {
        let model_1: string;
        export { model_1 as model };
        let maxTokens_1: number;
        export { maxTokens_1 as maxTokens };
        let mode_1: string;
        export { mode_1 as mode };
    }
    namespace anthropic {
        let model_2: string;
        export { model_2 as model };
        let maxTokens_2: number;
        export { maxTokens_2 as maxTokens };
        let mode_2: string;
        export { mode_2 as mode };
    }
    namespace perplexity {
        let model_3: string;
        export { model_3 as model };
        let maxTokens_3: number;
        export { maxTokens_3 as maxTokens };
        let mode_3: string;
        export { mode_3 as mode };
    }
    namespace mistral {
        let model_4: string;
        export { model_4 as model };
        let maxTokens_4: number;
        export { maxTokens_4 as maxTokens };
        let mode_4: string;
        export { mode_4 as mode };
    }
    namespace deepseek {
        let model_5: string;
        export { model_5 as model };
        let maxTokens_5: number;
        export { maxTokens_5 as maxTokens };
        let mode_5: string;
        export { mode_5 as mode };
    }
    namespace groq {
        let model_6: string;
        export { model_6 as model };
        let maxTokens_6: number;
        export { maxTokens_6 as maxTokens };
        let mode_6: string;
        export { mode_6 as mode };
    }
}
//# sourceMappingURL=deep-research.d.ts.map