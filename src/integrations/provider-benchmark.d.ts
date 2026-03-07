export function runFullBenchmark(vectorMem: any): Promise<{
    timestamp: string;
    totalDuration: number;
    results: ({
        provider: string;
        ok: any;
        pingLatency: any;
        totalLatency: number;
        connectionType: string;
        protocol: string;
    } | {
        provider: string;
        ok: boolean;
        error: string;
        sdkInit?: undefined;
        embedLatency?: undefined;
        chatLatency?: undefined;
        totalLatency?: undefined;
        tokens?: undefined;
        connectionType?: undefined;
        protocol?: undefined;
    } | {
        provider: string;
        ok: boolean;
        sdkInit: number;
        embedLatency: number;
        chatLatency: number;
        totalLatency: number;
        tokens: number;
        connectionType: string;
        protocol: string;
        error?: undefined;
    } | {
        provider: string;
        ok: boolean;
        error: any;
        totalLatency: number;
        sdkInit?: undefined;
        embedLatency?: undefined;
        chatLatency?: undefined;
        tokens?: undefined;
        connectionType?: undefined;
        protocol?: undefined;
    } | {
        provider: string;
        ok: boolean;
        error: string;
        sdkInit?: undefined;
        chatLatency?: undefined;
        totalLatency?: undefined;
        keys?: undefined;
        connectionType?: undefined;
        protocol?: undefined;
    } | {
        provider: string;
        ok: boolean;
        sdkInit: number;
        chatLatency: number;
        totalLatency: number;
        keys: number;
        connectionType: string;
        protocol: string;
        error?: undefined;
    } | {
        provider: string;
        ok: boolean;
        error: any;
        totalLatency: number;
        sdkInit?: undefined;
        chatLatency?: undefined;
        keys?: undefined;
        connectionType?: undefined;
        protocol?: undefined;
    } | {
        ok: boolean;
        error: any;
    })[];
    ranking: {
        rank: number;
        provider: any;
        totalLatency: any;
        connectionType: any;
        protocol: any;
    }[];
    fastest: any;
    recommended: {
        embedding: string;
        reasoning: any;
        fast_chat: any;
        edge_cache: string;
    };
}>;
export function registerRoutes(app: any, vectorMem: any): void;
export let benchResults: {};
//# sourceMappingURL=provider-benchmark.d.ts.map