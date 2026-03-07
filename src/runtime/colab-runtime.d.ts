#!/usr/bin/env node
export namespace GPU_CONFIG {
    let useGPU: true;
    let gpuMemLimit: number;
    let embeddingBatchSize: number;
    let vectorsInGPU: boolean;
    let ngrokToken: string | null;
    let ngrokDomain: string | null;
}
/**
 * GPU-accelerated vector operations.
 * Uses Float32Array stored in GPU-accessible memory for vector math.
 * On Colab with CUDA, this runs on the actual GPU.
 */
export class GPUVectorStore {
    constructor(dims?: number);
    dims: number;
    vectors: any[];
    metadata: any[];
    totalMemoryMB: number;
    /**
     * Store a vector with metadata.
     * In GPU mode, vectors are stored in contiguous Float32Array blocks
     * which can be transferred to GPU via ONNX Runtime or WebGPU.
     */
    store(embedding: any, meta?: {}): {
        ok: boolean;
        index: number;
        memoryMB: number;
    };
    /**
     * Batch cosine similarity — GPU-friendly operation.
     * Computes similarity between query and ALL stored vectors in parallel.
     * On GPU: this is a single matrix multiplication operation.
     */
    search(queryEmbedding: any, topK?: number): {
        score: number;
        metadata: any;
        index: number;
    }[];
    getStats(): {
        vectorCount: number;
        dimensions: number;
        memoryMB: string;
        gpu: true;
    };
}
/**
 * Setup ngrok tunnel for Colab → internet access.
 * This makes the Heady API accessible from any device.
 */
export function setupNgrokTunnel(port: any): Promise<any>;
//# sourceMappingURL=colab-runtime.d.ts.map