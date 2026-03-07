export function start(vectorMemory: any): Promise<void>;
export function stop(): void;
export function getStats(): {
    running: boolean;
    queueLength: number;
    projections: {
        [k: string]: {
            lastHash: null;
            stale: boolean;
            lastSynced: null;
        };
    };
    ramHash: any;
    started: null;
    totalIngested: number;
    totalFiltered: number;
    totalErrors: number;
    totalProjections: number;
    cycles: number;
    bySource: {};
    lastIngestAt: null;
    lastContextRefreshAt: null;
    lastTemplateProjectionAt: null;
};
export function ingest(content: any, metadata?: {}): Promise<{
    ok: boolean;
    queued: number;
}>;
export function queueForEmbed(content: any, metadata: any): boolean;
export function registerRoutes(app: any): void;
export function syncProjections(): Promise<void>;
export function buildLiveContextSnapshot(): Promise<{
    ok: boolean;
    mode: string;
    generatedAt: string;
    slices: {};
    counts?: undefined;
} | {
    ok: boolean;
    mode: string;
    generatedAt: null;
    counts: {
        [k: string]: number;
    };
    slices: {
        userActions: any;
        analystActions: any;
        systemActions: any;
        environment: any;
    };
}>;
export function buildInjectableTemplates({ topK, channel }?: {
    topK?: number | undefined;
    channel?: string | undefined;
}): Promise<{
    ok: boolean;
    mode: string;
    templates: never[];
    generatedAt: string;
    channel?: undefined;
    profile?: undefined;
    templateCount?: undefined;
} | {
    ok: boolean;
    channel: string;
    profile: any;
    generatedAt: string;
    templateCount: any;
    templates: any;
    mode?: undefined;
}>;
export function runAutonomyOptimizationCycle(): Promise<{
    ok: boolean;
    contextCounts: {
        [k: string]: number;
    };
    templateCount: any;
    ranAt: string;
    error?: undefined;
} | {
    ok: boolean;
    error: any;
    ranAt: string;
    contextCounts?: undefined;
    templateCount?: undefined;
}>;
/**
 * Auto re-embed when a projection file updates.
 * Called by projection-engine or file watchers.
 * @param {string} filePath - Path of the updated file
 */
export function onProjectionUpdate(filePath: string): void;
/**
 * Get embedding pipeline health metrics.
 * Returns staleness info, throughput, and error rates.
 */
export function getEmbeddingHealth(): {
    status: string;
    queueDepth: number;
    totalIngested: number;
    totalFiltered: number;
    totalErrors: number;
    errorRatePercent: number;
    avgVectorsPerCycle: number;
    lastIngestAgeMs: number | null;
    isIngestStale: boolean;
    staleProjections: string[];
    projectionsHealth: {
        [k: string]: {
            stale: boolean;
            lastSynced: null;
            syncAgeMs: number | null;
        };
    };
    intervals: {
        embedMs: number;
        projectionMs: number;
        envMs: number;
    };
    checkedAt: string;
};
export function onUserInteraction(data: any): void;
export function onAnalystAction(data: any): void;
export function onSystemAction(data: any): void;
export function onTelemetry(data: any): void;
export function onDeployment(data: any): void;
export function onError(data: any): void;
export function onConfigChange(data: any): void;
export function onBeeReaction(data: any): void;
export function onHealthCheck(data: any): void;
export function onCodeChange(data: any): void;
export function captureEnvironment(): void;
//# sourceMappingURL=continuous-embedder.d.ts.map