export = EmbeddingProvider;
/**
 * ═══ Embedding Provider Abstraction — SPEC-3 ═══
 *
 * Unified interface for embedding generation.
 * Supports: LOCAL (HeadyLocal/nomic-embed-text), CLOUD (Workers AI @cf/bge),
 *           and OPENAI (text-embedding-3-small).
 *
 * Auto-selects provider: tries local → edge → cloud.
 */
declare class EmbeddingProvider {
    constructor(opts?: {});
    providers: {
        local: {
            enabled: boolean;
            endpoint: any;
            model: any;
            dims: number;
        };
        edge: {
            enabled: boolean;
            endpoint: any;
            model: string;
            dims: number;
        };
        headycompute: {
            enabled: any;
            endpoint: string;
            model: any;
            dims: number;
            apiKey: any;
        };
    };
    preferredOrder: any;
    cache: Map<any, any>;
    maxCacheSize: any;
    stats: {
        local: number;
        edge: number;
        headycompute: number;
        cached: number;
        errors: number;
    };
    embed(text: any, opts?: {}): Promise<any>;
    embedBatch(texts: any, opts?: {}): Promise<any[]>;
    _callProvider(name: any, config: any, text: any): Promise<any>;
    _callLocal(config: any, text: any): Promise<any>;
    _callEdge(config: any, text: any): Promise<any>;
    _callOpenAI(config: any, text: any): Promise<any>;
    enableProvider(name: any, config?: {}): void;
    disableProvider(name: any): void;
    listProviders(): {
        name: string;
        enabled: any;
        model: any;
        dims: number;
    }[];
    status(): {
        providers: {
            name: string;
            enabled: any;
            model: any;
            dims: number;
        }[];
        preferredOrder: any;
        cacheSize: number;
        stats: {
            local: number;
            edge: number;
            headycompute: number;
            cached: number;
            errors: number;
        };
    };
}
//# sourceMappingURL=embedding-provider.d.ts.map