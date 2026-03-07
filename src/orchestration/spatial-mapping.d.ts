declare const _exports: SpatialActionMapper;
export = _exports;
/**
 * ════════════════════════════════════════════════════════════════════
 * 🌐 SPATIAL ACTION MAPPING (3D VECTORS)
 * Translates UI interactions, code generation events, and user queries
 * into 3D continuous vectors (X: Intent urgency, Y: Domain complexity,
 * Z: Deterministic vs. Probabilistic routing).
 * ════════════════════════════════════════════════════════════════════
 */
declare class SpatialActionMapper {
    vectorSpace: Map<any, any>;
    /**
     * Maps an incoming event onto the 3D grid.
     */
    mapEvent(eventContext: any): Promise<{
        vector: {
            x: number;
            y: number;
            z: number;
        };
        assignedPool: string;
        requiresHumanReview: boolean;
    }>;
    _calculateEmbedding(event: any): {
        x: number;
        y: number;
        z: number;
    };
    _evaluateRouting(vector: any): {
        pool: string;
        hitl: boolean;
    };
}
//# sourceMappingURL=spatial-mapping.d.ts.map