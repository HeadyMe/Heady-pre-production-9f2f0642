export function init(): void;
export function ingestMemory({ content, metadata, embedding }: {
    content: any;
    metadata?: {} | undefined;
    embedding?: null | undefined;
}): Promise<string>;
export function queryMemory(query: any, topK?: number, filter?: {}): Promise<any[]>;
/**
 * Hybrid RAG query: vector similarity + graph traversal.
 * 1. Run standard vector query for top-K
 * 2. For each result, traverse graph edges (1-hop)
 * 3. Score = vector_score × (1 + relationship_weight)
 * 4. Return merged, enriched results
 */
export function queryWithRelationships(query: any, topK?: number, filter?: {}, maxHops?: number): Promise<any[]>;
/**
 * Add a directional relationship edge between two memory nodes.
 * @param {string} sourceId - Source vector ID
 * @param {string} targetId - Target vector ID
 * @param {string} relation - Relationship type (e.g., "caused_by", "resolved_by", "led_to")
 * @param {number} weight - Edge weight (0.0 - 1.0)
 */
export function addRelationship(sourceId: string, targetId: string, relation: string, weight?: number): {
    sourceId: string;
    targetId: string;
    relation: string;
    weight: number;
};
/**
 * Get all relationships for a given node.
 */
export function getRelationships(nodeId: any): any;
export function getStats(): {
    architecture: string;
    total_vectors: any;
    num_shards: number;
    max_per_shard: number;
    embedding_model: string;
    hf_workers: number;
    embedding_source: string;
    dimensions: number;
    spatial: {
        zones: number;
        zone_distribution: {};
        zone_expand_threshold: number;
        queries: number;
        zone_hits: number;
        expansions: number;
        zone_hit_rate: number;
        projection_profiles: ("cartesian" | "spherical" | "isometric")[];
    };
    graph: {
        totalEdges: number;
        totalNodes: number;
        architecture: string;
    };
    ingest_count: number;
    query_count: number;
    remote_embeds: number;
    local_fallbacks: number;
    persist_debounce_ms: number;
    shards: {
        id: any;
        vectors: any;
        dirty: any;
    }[];
};
export function registerRoutes(app: any): void;
export function embed(text: any): Promise<any>;
/**
 * PCA-lite: project 384-dim embedding → (x, y, z) coordinates
 * Split dims into 3 groups of 128, average each group
 */
export function to3D(embedding: any): {
    x: number;
    y: number;
    z: number;
};
/**
 * Map 3D coords to octant zone (0-7)
 * Zone 0: (-, -, -), Zone 1: (+, -, -), ... Zone 7: (+, +, +)
 */
export function assignZone(x: any, y: any, z: any): number;
export function cosineSim(a: any, b: any): any;
export function projectPoint(point: any, profile?: "cartesian"): {
    r: number;
    theta: number;
    phi: number;
    ix?: undefined;
    iy?: undefined;
    x?: undefined;
    y?: undefined;
    z?: undefined;
} | {
    ix: number;
    iy: number;
    r?: undefined;
    theta?: undefined;
    phi?: undefined;
    x?: undefined;
    y?: undefined;
    z?: undefined;
} | {
    x: number;
    y: number;
    z: number;
    r?: undefined;
    theta?: undefined;
    phi?: undefined;
    ix?: undefined;
    iy?: undefined;
};
export function resolveProjectionProfile({ profile, channel }?: {}): any;
export function buildOutboundRepresentation({ channel, profile, topK }?: {
    channel?: string | undefined;
    topK?: number | undefined;
}): {
    ok: boolean;
    channel: string;
    profile: any;
    architecture: string;
    projection_mode: string;
    top_k: number;
    total_vectors: any;
    active_zones: number;
    generated_at: string;
    constraints: {
        max_outbound_sample: number;
        default_outbound_sample: number;
    };
    sample: {
        id: any;
        zone: any;
        representation: {
            r: number;
            theta: number;
            phi: number;
            ix?: undefined;
            iy?: undefined;
            x?: undefined;
            y?: undefined;
            z?: undefined;
        } | {
            ix: number;
            iy: number;
            r?: undefined;
            theta?: undefined;
            phi?: undefined;
            x?: undefined;
            y?: undefined;
            z?: undefined;
        } | {
            x: number;
            y: number;
            z: number;
            r?: undefined;
            theta?: undefined;
            phi?: undefined;
            ix?: undefined;
            iy?: undefined;
        };
        type: any;
        ts: any;
        importance: number;
    }[];
};
export function normalizeChannel(channel?: string): string;
export function normalizeTopK(topK?: number): number;
export function getAutonomousState(): {
    timerActive: boolean;
    enabled: boolean;
    intervalMs: number;
    lastRunAt: null;
    lastStatus: string;
    lastSummary: null;
    runs: number;
    errors: number;
};
export function runAutonomousMaintenance({ decayThreshold, ltmThreshold, }?: {
    decayThreshold?: number | undefined;
    ltmThreshold?: number | undefined;
}): Promise<{
    decay: Object;
    consolidation: Object;
    duration_ms: number;
    ts: string;
    ok: boolean;
    error?: undefined;
} | {
    ok: boolean;
    error: any;
    ts: null;
}>;
export function startAutonomousMaintenance(intervalMs?: number): {
    timerActive: boolean;
    enabled: boolean;
    intervalMs: number;
    lastRunAt: null;
    lastStatus: string;
    lastSummary: null;
    runs: number;
    errors: number;
};
export function stopAutonomousMaintenance(): {
    timerActive: boolean;
    enabled: boolean;
    intervalMs: number;
    lastRunAt: null;
    lastStatus: string;
    lastSummary: null;
    runs: number;
    errors: number;
};
/**
 * Compute memory importance score for a vector entry.
 * I(m) = αFreq(m) + βe^(-γΔt) + δSurp(m)
 *
 * @param {Object} entry - Vector entry with embedding, metadata
 * @returns {number} Importance score (0.0 - 1.0+)
 */
export function computeImportance(entry: Object): number;
/**
 * Track a memory access (for frequency scoring).
 * Called automatically during queryMemory.
 */
export function trackAccess(id: any): void;
/**
 * Apply decay to all memories — reduce importance of old, unused content.
 * Memories below the decay threshold are candidates for eviction.
 *
 * @param {number} threshold - Importance score below which to mark for decay (default: 0.15)
 * @returns {Object} { decayed, total, preserved }
 */
export function applyDecay(threshold?: number): Object;
/**
 * Selective Density Gating — filters semantically redundant content.
 * Before ingesting, checks if highly similar content already exists.
 * Only stores content that adds new semantic information.
 *
 * @param {string} content - Content to check
 * @param {number} gateThreshold - Similarity above which to reject (default: 0.92)
 * @returns {Promise<boolean>} true if content should be stored (passes gate)
 */
export function densityGate(content: string, gateThreshold?: number): Promise<boolean>;
/**
 * Smart ingest with density gating — only stores non-redundant content.
 *
 * @param {Object} params - Same as ingestMemory
 * @param {number} gateThreshold - Similarity threshold (default: 0.92)
 * @returns {Promise<string|null>} Vector ID if stored, null if rejected as redundant
 */
export function smartIngest({ content, metadata, embedding }: Object, gateThreshold?: number): Promise<string | null>;
/**
 * STM → LTM Consolidation — distill episodic sequences into semantic facts.
 * Scores all memories by importance, keeps top-scoring as LTM,
 * compacts low-scoring into summary entries.
 *
 * @param {number} ltmThreshold - Importance score for LTM promotion (default: 0.5)
 * @returns {Object} { promoted, compacted, total }
 */
export function consolidateMemory(ltmThreshold?: number): Object;
/**
 * Snapshot current embedding for a given vector ID as its drift baseline.
 * Future drift checks compare the current embedding against this snapshot.
 */
export function snapshotBaseline(vectorId: any): {
    ok: boolean;
    id: any;
    snapshotAt: any;
    error?: undefined;
} | {
    ok: boolean;
    error: string;
    id?: undefined;
    snapshotAt?: undefined;
};
/**
 * Snapshot ALL current vectors as baselines (full system checkpoint).
 */
export function snapshotAllBaselines(): {
    ok: boolean;
    baselined: number;
};
/**
 * Detect semantic drift: compare current embeddings vs baselines.
 * Returns vectors where cosine similarity has dropped below the threshold.
 * §Autonomous Refactoring Feedback Loop — detects when meaning has degraded.
 */
export function detectDrift(threshold?: number): {
    ok: boolean;
    threshold: number;
    checked: number;
    baselines: number;
    drifted: number;
    alerts: any[];
    checkedAt: string;
};
/**
 * Compute centroid for each zone and check pairwise cosine similarity.
 * Alerts if zone coherence drops below threshold (modules are diverging).
 */
export function checkZoneCoherence(alertThreshold?: number): {
    ok: boolean;
    activeZones: number;
    pairwiseChecks: number;
    intraZoneChecks: number;
    alerts: ({
        alert: string;
        threshold: number;
        zoneA: any;
        zoneB: any;
        similarity: number;
        zone?: undefined;
        avgSimilarity?: undefined;
    } | {
        zone: any;
        avgSimilarity: number;
        alert: string;
        threshold: number;
    })[];
    pairs: {
        zoneA: any;
        zoneB: any;
        similarity: number;
    }[];
    intraZone: {
        zone: any;
        avgSimilarity: number;
        vectorCount: number;
    }[];
    checkedAt: string;
};
/**
 * Spawn a new agent thread in the 3D vector space.
 * @param {Object} opts - Agent configuration
 * @param {string} opts.type - Agent type (refactor, test, security, deploy, research)
 * @param {string} opts.task - Task description
 * @param {number} opts.zone - Preferred zone (0-7), or auto-assigned
 */
export function spawnAgent({ type, task, zone }?: {
    type: string;
    task: string;
    zone: number;
}): {
    id: string;
    type: string;
    task: string;
    zone: number;
    position: {
        x: number;
        y: number;
        z: number;
    };
    status: string;
    spawnedAt: string;
    lastUpdate: string;
    metrics: {
        actionsCompleted: number;
        vectorsModified: number;
        errors: number;
    };
};
/**
 * Observe all active agents — returns positions, status, and group state.
 * §Group-structured state spaces: each agent models the boundaries of others.
 */
export function observeAgents(): {
    ok: boolean;
    totalAgents: number;
    byType: any;
    byZone: any;
    agents: any[];
    observedAt: string;
};
/**
 * Update an agent's status and metrics.
 */
export function updateAgent(agentId: any, update?: {}): {
    ok: boolean;
    error: string;
    agent?: undefined;
} | {
    ok: boolean;
    agent: any;
    error?: undefined;
};
/**
 * Terminate an agent thread.
 */
export function terminateAgent(agentId: any): {
    ok: boolean;
    error: string;
    agent?: undefined;
} | {
    ok: boolean;
    agent: any;
    error?: undefined;
};
//# sourceMappingURL=vector-memory.d.ts.map