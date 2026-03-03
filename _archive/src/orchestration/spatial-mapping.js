/**
 * ════════════════════════════════════════════════════════════════════
 * 🌐 SPATIAL ACTION MAPPING (3D VECTORS)
 * Translates UI interactions, code generation events, and user queries 
 * into 3D continuous vectors (X: Intent urgency, Y: Domain complexity,
 * Z: Deterministic vs. Probabilistic routing).
 * ════════════════════════════════════════════════════════════════════
 */

class SpatialActionMapper {
    constructor() {
        this.vectorSpace = new Map();
    }

    /**
     * Maps an incoming event onto the 3D grid.
     */
    async mapEvent(eventContext) {
        const vector = this._calculateEmbedding(eventContext);
        this.vectorSpace.set(eventContext.id, vector);

        // Return routing decision based on the Z-axis (Determinism boundary)
        const routing = this._evaluateRouting(vector);

        return {
            vector: vector,
            assignedPool: routing.pool,
            requiresHumanReview: routing.hitl
        };
    }

    _calculateEmbedding(event) {
        // Pseudo-embedding logic:
        // X: Urgency derived from user request semantic intensity
        // Y: Architectural complexity derived from ast/depth
        // Z: Pure determinism vs probabilistic LLM creativity

        let x = event.priority === 'urgent' ? 1.0 : (event.priority === 'high' ? 0.7 : 0.3);
        let y = (event.filesTargeted || 1) * 0.1; // 10 files = max complexity 1.0
        let z = event.requiresCreativity ? -1.0 : 1.0;

        // Normalize
        y = Math.min(y, 1.0);

        return { x, y, z };
    }

    _evaluateRouting(vector) {
        // Map vectors to HCFullPipeline pools
        let pool = 'Cold'; // Default batch
        if (vector.x > 0.8) pool = 'Hot';
        else if (vector.x > 0.4) pool = 'Warm';

        // High complexity + High probability = HITL Interception
        let hitl = (vector.y > 0.7 && vector.z < 0);

        return { pool, hitl };
    }
}

module.exports = new SpatialActionMapper();
