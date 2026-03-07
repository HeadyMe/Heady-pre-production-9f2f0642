export function federatedInsert(entry: any): Promise<{
    tiersWritten: number;
    tiers: string[];
}>;
export function federatedQuery(queryEmbedding: any, topK?: number): Promise<{
    results: any;
    tier: string;
    latency: number;
} | null>;
export function registerRoutes(app: any): void;
export namespace tierMetrics {
    namespace edge {
        let hits: number;
        let misses: number;
        let errors: number;
        let avgLatency: number;
        let latencies: never[];
    }
    namespace gcloud {
        let hits_1: number;
        export { hits_1 as hits };
        let misses_1: number;
        export { misses_1 as misses };
        let errors_1: number;
        export { errors_1 as errors };
        let avgLatency_1: number;
        export { avgLatency_1 as avgLatency };
        let latencies_1: never[];
        export { latencies_1 as latencies };
    }
    namespace colab {
        let hits_2: number;
        export { hits_2 as hits };
        let misses_2: number;
        export { misses_2 as misses };
        let errors_2: number;
        export { errors_2 as errors };
        let avgLatency_2: number;
        export { avgLatency_2 as avgLatency };
        let latencies_2: never[];
        export { latencies_2 as latencies };
    }
    namespace local {
        let hits_3: number;
        export { hits_3 as hits };
        let misses_3: number;
        export { misses_3 as misses };
        let errors_3: number;
        export { errors_3 as errors };
        let avgLatency_3: number;
        export { avgLatency_3 as avgLatency };
        let latencies_3: never[];
        export { latencies_3 as latencies };
    }
}
//# sourceMappingURL=vector-federation.d.ts.map