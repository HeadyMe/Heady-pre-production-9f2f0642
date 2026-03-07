export class SelfHealingMesh {
    nodes: Map<any, any>;
    attestations: Map<any, any>;
    meshConsensus: {
        avgConfidence: number;
        nodeCount: number;
    } | null;
    healingLog: any[];
    stats: {
        healed: number;
        quarantined: number;
        respawned: number;
        total: number;
    };
    registerNode(nodeId: any, config?: {}): {
        id: any;
        state: string;
        role: any;
        geometricPosition: any;
        consecutiveFailures: number;
        lastHeartbeat: number;
        lastLatency: number;
        confidence: number;
        taskQueue: never[];
        spawnedAt: number;
        generation: any;
    };
    /**
     * Process an attestation heartbeat from a node.
     * Returns: { accepted: bool, issues: string[] }
     */
    attest(nodeId: any, attestation: any): {
        accepted: boolean;
        issues: string[];
    };
    _quarantineNode(nodeId: any, reasons: any): void;
    _respawnNode(quarantinedId: any): {
        id: any;
        state: string;
        role: any;
        geometricPosition: any;
        consecutiveFailures: number;
        lastHeartbeat: number;
        lastLatency: number;
        confidence: number;
        taskQueue: never[];
        spawnedAt: number;
        generation: any;
    } | undefined;
    /**
     * Check all nodes for stale heartbeats and heal the mesh.
     */
    maintain(): void;
    _updateConsensus(): void;
    _cosineSimilarity(a: any, b: any): number;
    getHealth(): {
        totalNodes: number;
        activeNodes: number;
        byState: {};
        stats: {
            healed: number;
            quarantined: number;
            respawned: number;
            total: number;
        };
        lastHealing: any[];
        meshConsensus: {
            avgConfidence: number;
            nodeCount: number;
        } | null;
    };
}
export const mesh: SelfHealingMesh;
export function registerSelfHealingRoutes(app: any): void;
export namespace NODE_STATES {
    let HEALTHY: string;
    let DEGRADED: string;
    let QUARANTINED: string;
    let RESPAWNING: string;
    let DEAD: string;
}
//# sourceMappingURL=self-healing-mesh.d.ts.map