export interface Vector3D {
    x: number;
    y: number;
    z: number;
    embedding: number[];
    metadata: Record<string, any>;
    timestamp: number;
}
export declare class VectorMemoryStore {
    private memories;
    store(userId: string, memory: Vector3D): void;
    query(userId: string, embedding: number[], limit?: number): Vector3D[];
    private cosineSimilarity;
    getStats(userId: string): {
        count: number;
        octants: number;
    };
}
//# sourceMappingURL=index.d.ts.map