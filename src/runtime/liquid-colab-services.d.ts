export class LiquidColabEngine extends EventEmitter<[never]> {
    constructor();
    allocator: LiquidAllocator;
    executionLog: any[];
    totalExecutions: number;
    startedAt: string;
    /**
     * Execute a component action in vector space.
     * Uses LiquidAllocator to determine optimal components,
     * then runs the corresponding vector executor.
     */
    execute(componentId: any, input?: {}): Promise<any>;
    /**
     * Smart execute: let the LiquidAllocator decide which components to use,
     * then execute the top-ranked ones.
     */
    smartExecute(request?: {}): Promise<{
        ok: boolean;
        flow: {
            id: string;
            context: {
                type: any;
                urgency: any;
                labels: any;
            };
            allocated: {
                component: string;
                affinity: number;
                presences: any;
                role: any;
            }[];
            ts: string;
        };
        results: {
            component: string;
            affinity: number;
            result: any;
        }[];
        totalExecutions: number;
    }>;
    /**
     * Get engine health and workspace state.
     */
    getHealth(): {
        status: string;
        service: string;
        mode: string;
        startedAt: string;
        totalExecutions: number;
        components: number;
        allocator: {
            totalFlows: number;
            registeredComponents: number;
        };
        workspace: {
            totalVectors: any;
            architecture: any;
            zones: any;
            graph: any;
        };
        gpu: any;
        ts: string;
    };
    getExecutionLog(limit?: number): any[];
}
export function registerLiquidColabRoutes(app: any, engine?: LiquidColabEngine): LiquidColabEngine;
export const EXECUTORS: {
    /**
     * LENS: Observe system state, store as differential vector.
     * Input: { source, metric, value, context }
     * Vector op: smartIngest → zone placement → graph link to prior observations
     */
    lens(input: any): Promise<{
        component: string;
        action: string;
        stored: boolean;
        vectorId: any;
        relatedObservations: any;
        significance: number;
    }>;
    /**
     * BRAIN: Reason over vector memory with graph traversal.
     * Input: { query, depth }
     * Vector op: queryWithRelationships → multi-hop graph → enriched results
     */
    brain(input: any): Promise<{
        component: string;
        action: string;
        results: any;
        totalResults: any;
        hybrid: any;
    }>;
    /**
     * SOUL: Reflect on memory quality via importance scoring.
     * Input: { scope } — "all" or "recent"
     * Vector op: computeImportance across vectors → quality report
     */
    soul(input: any): Promise<{
        component: string;
        action: string;
        memoryQuality: {
            avgImportance: number;
            totalVectors: any;
            zones: any;
            zoneHitRate: any;
            graphEdges: any;
        };
        sampleScores: any;
    }>;
    /**
     * CONDUCTOR: Orchestrate system state from zone distribution.
     * Vector op: getStats + buildOutboundRepresentation → orchestration view
     */
    conductor(input: any): Promise<{
        component: string;
        action: string;
        systemState: {
            totalVectors: any;
            shards: any;
            zones: any;
            activeZones: any;
            graph: any;
            embeddingSource: any;
        };
        projection: {
            profile: any;
            sampleCount: any;
        };
        gpu: any;
    }>;
    /**
     * BATTLE: Cross-zone competition — query all zones, compare scores.
     * Input: { challenge }
     * Vector op: parallel zone queries → score comparison → winner
     */
    battle(input: any): Promise<{
        component: string;
        action: string;
        challenge: any;
        winner: {
            zone: number;
            topScore: any;
            champion: any;
            contenders: any;
        };
        zoneCompetition: {
            zone: number;
            topScore: any;
            champion: any;
            contenders: any;
        }[];
        totalZonesCompeted: number;
    }>;
    /**
     * VINCI: Creative pattern detection — find novel vectors.
     * Input: { topic }
     * Vector op: densityGate at LOW threshold → find unique content
     */
    vinci(input: any): Promise<{
        component: string;
        action: string;
        topic: any;
        patterns: any;
        noveltyScore: number;
    }>;
    /**
     * PATTERNS: Resilience analysis from zone stats.
     * Vector op: zoneStats + applyDecay analysis
     */
    patterns(input: any): Promise<{
        component: string;
        action: string;
        resilience: {
            zoneHitRate: any;
            expansions: any;
            queries: any;
            zoneDistribution: any;
        };
        decay: {
            decayed: any;
            preserved: any;
            total: any;
        };
    }>;
    /**
     * NOTION: Knowledge ingestion + graph retrieval.
     * Input: { content, query }
     * Vector op: ingest with relationships → queryWithRelationships
     */
    notion(input: any): Promise<{
        component: string;
        action: string;
        storedId: any;
        results: any;
        totalKnowledge: any;
    }>;
    /**
     * OPS: Infrastructure health from shard and zone state.
     * Vector op: getStats + persistAllShards
     */
    ops(input: any): Promise<{
        component: string;
        action: string;
        health: {
            shards: any;
            totalVectors: any;
            embeddingSource: any;
            remoteEmbeds: any;
            localFallbacks: any;
        };
        gpu: any;
    }>;
    /**
     * MAINTENANCE: Run autonomous memory maintenance.
     * Vector op: runAutonomousMaintenance → decay + consolidation
     */
    maintenance(input: any): Promise<{
        component: string;
        action: string;
        result: any;
        autonomousState: any;
    }>;
    /**
     * AUTO-SUCCESS: Continuous improvement loop.
     * Vector op: consolidateMemory + importance re-scoring
     */
    "auto-success"(input: any): Promise<{
        component: string;
        action: string;
        consolidation: any;
        memoryHealth: {
            totalVectors: any;
            graphEdges: any;
            zoneHitRate: any;
        };
    }>;
    /**
     * STREAM: Real-time 3D projection of memory state.
     * Vector op: buildOutboundRepresentation for live channels
     */
    stream(input: any): Promise<{
        component: string;
        action: string;
        projection: any;
    }>;
    /**
     * BUDDY: Quick-access memory retrieval with user context.
     * Input: { query }
     * Vector op: queryMemory with user-facing context
     */
    buddy(input: any): Promise<{
        component: string;
        action: string;
        query: any;
        suggestions: any;
    }>;
    /**
     * CLOUD: Outbound projection for external APIs.
     * Vector op: buildOutboundRepresentation for external channels
     */
    cloud(input: any): Promise<{
        component: string;
        action: string;
        projection: any;
    }>;
};
import EventEmitter = require("events");
import { LiquidAllocator } from "./hc_liquid";
//# sourceMappingURL=liquid-colab-services.d.ts.map