export class SpatialEmbedder {
    constructor(options?: {});
    temporalWindow: any;
    temporalOrigin: any;
    maxDepth: any;
    domainMap: Map<any, any>;
    nextDomainSlot: number;
    /**
     * Embed a payload into 3D coordinates
     * @param {object} payload - { content, domain, timestamp, depth }
     * @returns {{ x: number, y: number, z: number, metadata: object }}
     */
    embed(payload: object): {
        x: number;
        y: number;
        z: number;
        metadata: object;
    };
    /**
     * Semantic X-axis: domain → golden-ratio-distributed [0,1]
     * Uses golden angle distribution for maximally distinct positioning
     */
    _semanticX(domain: any, content: any): number;
    /**
     * Temporal Y-axis: timestamp → normalized [0,1]
     * Recent = high Y, old = low Y
     */
    _temporalY(timestamp: any): number;
    /**
     * Hierarchy Z-axis: depth → φ-normalized [0,1]
     * Root agents are at Z=1, deeper agents at lower Z
     * Uses inverse φ power for natural golden ratio spacing
     */
    _hierarchyZ(depth: any): number;
    /**
     * Calculate distance between two 3D points
     * @param {object} a - { x, y, z }
     * @param {object} b - { x, y, z }
     * @returns {number} Euclidean distance
     */
    distance(a: object, b: object): number;
    /**
     * Find semantically related region using golden split
     * @param {number} x - semantic position
     * @returns {{ major: number, minor: number }}
     */
    semanticRegion(x: number): {
        major: number;
        minor: number;
    };
    _hash(content: any): string;
    /**
     * Get embedding stats
     */
    getStats(): {
        domainsRegistered: number;
        temporalWindow: any;
        maxDepth: any;
        domains: any;
    };
}
//# sourceMappingURL=spatial-embedder.d.ts.map