export class VectorSpaceOps {
    constructor(vectorMemory: any);
    vectorMemory: any;
    antiSprawl: AntiSprawlEngine;
    security: VectorSecurityScanner;
    maintenance: VectorMaintenanceOps;
    projectionManager: ProjectionManager;
    preDeployValidator: PreDeployValidator;
    autoSuccess: any;
    _intervals: any[];
    started: boolean;
    /**
     * Start the continuous internal ops loop.
     * Uses PHI-derived intervals — organic, not cron.
     */
    start(): void;
    /**
     * Stop all internal ops loops.
     */
    stop(): void;
    /**
     * Pre-deployment gate — call BEFORE any external deployment.
     * Returns { clear, blockers, warnings }
     */
    preDeployCheck(): {
        clear: boolean;
        blockers: {
            check: string;
            message: string;
            details: any;
        }[];
        warnings: ({
            check: string;
            message: string;
            details: any;
        } | {
            check: string;
            message: string;
            details?: undefined;
        })[];
        vectorStats: any;
        validatedAt: string;
    };
    /**
     * Full status of all vector space internal operations.
     */
    getStatus(): {
        started: boolean;
        cycles: any;
        antiSprawl: {
            baselineZones: number;
            recentAlerts: any[];
        };
        security: {
            threatPatterns: number;
            recentScans: any[];
        };
        maintenance: {
            lastCompaction: {
                totalBefore: any;
                compacted: number;
                pruned: number;
                zonesRebalanced: number;
                ts: string;
            } | null;
            health: {
                healthy: boolean;
                reason: string;
                totalVectors?: undefined;
                zones?: undefined;
                shards?: undefined;
                graphEdges?: undefined;
                ingestRate?: undefined;
                queryRate?: undefined;
                lastCompaction?: undefined;
            } | {
                healthy: boolean;
                totalVectors: any;
                zones: any;
                shards: any;
                graphEdges: any;
                ingestRate: any;
                queryRate: any;
                lastCompaction: string;
                reason?: undefined;
            };
        };
        projections: {
            projections: {};
            perception: {};
        };
        intervals: {
            pulse: number;
            scan: number;
            analyze: number;
            compact: number;
            audit: number;
        };
    };
    /**
     * Register Express routes for vector space ops status + pre-deploy gate.
     */
    registerRoutes(app: any): void;
}
export class AntiSprawlEngine {
    constructor(vectorMemory: any);
    vectorMemory: any;
    baselineZoneDensities: Map<any, any>;
    sprawlAlerts: any[];
    maxAlerts: number;
    /**
     * Capture baseline zone densities — run once after stable state.
     * This becomes the "expected" architecture shape.
     */
    captureBaseline(): {
        zones: number;
        captured: string;
    } | undefined;
    /**
     * Detect sprawl: compare current zone densities against baseline.
     * If any zone grows > φ² (2.618x) beyond baseline, it's sprawling.
     * If new zones appear that weren't in baseline, it's uncontrolled growth.
     */
    detectSprawl(): {
        sprawlDetected: boolean;
        reason: string;
        alerts?: undefined;
        ts?: undefined;
    } | {
        sprawlDetected: boolean;
        reason?: undefined;
        alerts?: undefined;
        ts?: undefined;
    } | {
        sprawlDetected: boolean;
        alerts: ({
            type: string;
            zone: number;
            count: any;
            baseline: any;
            severity: string;
            ratio?: undefined;
            threshold?: undefined;
            totalCurrent?: undefined;
            totalBaseline?: undefined;
        } | {
            type: string;
            zone: number;
            count: any;
            baseline: any;
            ratio: number;
            threshold: number;
            severity: string;
            totalCurrent?: undefined;
            totalBaseline?: undefined;
        } | {
            type: string;
            totalCurrent: any;
            totalBaseline: any;
            ratio: number;
            severity: string;
            zone?: undefined;
            count?: undefined;
            baseline?: undefined;
            threshold?: undefined;
        })[];
        ts: string;
        reason?: undefined;
    };
}
export class VectorSecurityScanner {
    constructor(vectorMemory: any);
    vectorMemory: any;
    threatPatterns: any[];
    scanHistory: any[];
    maxHistory: number;
    /**
     * Register a threat pattern as an embedding signature.
     * Future ingestions near this pattern trigger alerts.
     */
    registerThreatPattern(label: any, embedding: any): void;
    /**
     * Scan recent vectors for anomalies:
     * 1. Outlier detection — vectors far from any zone centroid
     * 2. Injection detection — vectors with suspiciously high access frequency
     * 3. Poisoning detection — vectors that shifted zone membership
     */
    scan(): {
        healthy: boolean;
        threats: ({
            type: string;
            zone: number;
            count: any;
            avgExpected: number;
            severity: string;
            queryCount?: undefined;
            ingestCount?: undefined;
            note?: undefined;
        } | {
            type: string;
            queryCount: any;
            ingestCount: any;
            severity: string;
            note: string;
            zone?: undefined;
            count?: undefined;
            avgExpected?: undefined;
        })[];
        scannedAt: string;
        vectorStats: {
            total: any;
            zones: any;
        };
    } | {
        healthy: boolean;
        threats: never[];
    };
}
export class VectorMaintenanceOps {
    constructor(vectorMemory: any);
    vectorMemory: any;
    lastCompaction: {
        totalBefore: any;
        compacted: number;
        pruned: number;
        zonesRebalanced: number;
        ts: string;
    } | null;
    maintenanceLog: any[];
    /**
     * Compact vector memory:
     * 1. Identify near-duplicate vectors (cosine sim > 0.98)
     * 2. Merge duplicates, keeping the one with highest access frequency
     * 3. Prune vectors older than threshold with zero access
     */
    compact(maxAgeDays?: number): {
        totalBefore: any;
        compacted: number;
        pruned: number;
        zonesRebalanced: number;
        ts: string;
    } | {
        compacted: number;
        pruned: number;
    };
    /**
     * Health check: zone distribution, memory usage, graph integrity.
     */
    healthCheck(): {
        healthy: boolean;
        reason: string;
        totalVectors?: undefined;
        zones?: undefined;
        shards?: undefined;
        graphEdges?: undefined;
        ingestRate?: undefined;
        queryRate?: undefined;
        lastCompaction?: undefined;
    } | {
        healthy: boolean;
        totalVectors: any;
        zones: any;
        shards: any;
        graphEdges: any;
        ingestRate: any;
        queryRate: any;
        lastCompaction: string;
        reason?: undefined;
    };
}
export class PreDeployValidator {
    constructor(vectorMemory: any, antiSprawl: any, security: any, maintenance: any);
    vectorMemory: any;
    antiSprawl: any;
    security: any;
    maintenance: any;
    /**
     * Run full pre-deployment validation in vector space.
     * Returns { clear: boolean, blockers: [], warnings: [] }
     *
     * If not clear, deployment MUST NOT proceed.
     */
    validate(): {
        clear: boolean;
        blockers: {
            check: string;
            message: string;
            details: any;
        }[];
        warnings: ({
            check: string;
            message: string;
            details: any;
        } | {
            check: string;
            message: string;
            details?: undefined;
        })[];
        vectorStats: any;
        validatedAt: string;
    };
}
export class ProjectionManager {
    projections: Map<any, any>;
    _perception: {};
    registerTarget(name: any): void;
    markSynced(target: any, ramStateHash: any): void;
    markStale(target: any): void;
    allSynced(ramStateHash: any): boolean;
    /**
     * PERCEPTION SCAN — what does the system look like externally?
     * Reads from git, filesystem, and package.json to build awareness
     * of how users and external systems perceive Heady.
     */
    scanPerception(): Promise<{
        ts: string;
        sources: {};
    }>;
    /** Wire perception scans to eventBus events — auto-refresh on system changes */
    wireEventBus(eventBus: any): void;
    getStatus(): {
        projections: {};
        perception: {};
    };
}
export namespace PHI_INTERVALS {
    let pulse: number;
    let scan: number;
    let analyze: number;
    let compact: number;
    let audit: number;
}
//# sourceMappingURL=vector-space-ops.d.ts.map