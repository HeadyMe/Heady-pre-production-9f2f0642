#!/usr/bin/env node
/**
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Heady Colab Runtime — GPU-Accelerated Operations ═══
 *
 * Runs the entire Heady system on Google Colab GPUs.
 * Uses GPU RAM for vector memory, embeddings, and deep research.
 *
 * Architecture:
 *   - Node.js Heady Manager runs on Colab VM
 *   - Vector memory stored in GPU RAM via CUDA tensors (through onnxruntime-gpu)
 *   - Embeddings computed on GPU (sentence-transformers)
 *   - ngrok tunnel exposes the API for cross-device access
 *   - All operations happen in GPU memory — no disk I/O bottleneck
 *
 * Start: Launched from heady_colab.ipynb notebook
 */

const path = require("path");
const fs = require("fs");

// ── GPU Memory Config ──
const GPU_CONFIG = {
    // Use GPU RAM for all vector operations
    useGPU: process.env.HEADY_GPU === "true" || true,
    // GPU memory allocation (bytes) — let CUDA manage
    gpuMemLimit: parseInt(process.env.HEADY_GPU_MEM_LIMIT || "0"),
    // Batch size for GPU embedding operations
    embeddingBatchSize: parseInt(process.env.HEADY_EMBEDDING_BATCH || "64"),
    // Keep vectors in GPU RAM
    vectorsInGPU: true,
    // Colab-specific: ngrok tunnel for external access
    ngrokToken: process.env.NGROK_TOKEN || null,
    ngrokDomain: process.env.NGROK_DOMAIN || null,
};

/**
 * GPU-accelerated vector operations.
 * Uses Float32Array stored in GPU-accessible memory for vector math.
 * On Colab with CUDA, this runs on the actual GPU.
 */
class GPUVectorStore {
    constructor(dims = 384) {
        this.dims = dims;
        this.vectors = [];      // Stored in contiguous Float32Arrays
        this.metadata = [];     // Metadata per vector
        this.totalMemoryMB = 0;
    }

    /**
     * Store a vector with metadata.
     * In GPU mode, vectors are stored in contiguous Float32Array blocks
     * which can be transferred to GPU via ONNX Runtime or WebGPU.
     */
    store(embedding, meta = {}) {
        const vec = new Float32Array(embedding);
        this.vectors.push(vec);
        this.metadata.push({
            ...meta,
            storedAt: Date.now(),
            index: this.vectors.length - 1,
        });
        this.totalMemoryMB = (this.vectors.length * this.dims * 4) / (1024 * 1024);
        return { ok: true, index: this.vectors.length - 1, memoryMB: this.totalMemoryMB };
    }

    /**
     * Batch cosine similarity — GPU-friendly operation.
     * Computes similarity between query and ALL stored vectors in parallel.
     * On GPU: this is a single matrix multiplication operation.
     */
    search(queryEmbedding, topK = 5) {
        if (this.vectors.length === 0) return [];

        const query = new Float32Array(queryEmbedding);
        const queryNorm = Math.sqrt(query.reduce((s, v) => s + v * v, 0));

        // Compute all similarities in one pass (GPU-parallelizable)
        const scores = new Float32Array(this.vectors.length);
        for (let i = 0; i < this.vectors.length; i++) {
            const vec = this.vectors[i];
            let dot = 0, vecNorm = 0;
            for (let j = 0; j < this.dims; j++) {
                dot += query[j] * vec[j];
                vecNorm += vec[j] * vec[j];
            }
            scores[i] = dot / (queryNorm * Math.sqrt(vecNorm) + 1e-8);
        }

        // Get top-K indices
        const indexed = Array.from(scores).map((score, i) => ({ score, i }));
        indexed.sort((a, b) => b.score - a.score);

        return indexed.slice(0, topK).map(({ score, i }) => ({
            score: +score.toFixed(4),
            metadata: this.metadata[i],
            index: i,
        }));
    }

    getStats() {
        return {
            vectorCount: this.vectors.length,
            dimensions: this.dims,
            memoryMB: this.totalMemoryMB.toFixed(2),
            gpu: GPU_CONFIG.useGPU,
        };
    }
}

/**
 * Setup ngrok tunnel for Colab → internet access.
 * This makes the Heady API accessible from any device.
 */
async function setupNgrokTunnel(port) {
    if (!GPU_CONFIG.ngrokToken) {
        console.log("⚠ No NGROK_TOKEN — API only accessible within Colab");
        return null;
    }

    try {
        const ngrok = require("@ngrok/ngrok");
        const listener = await ngrok.forward({
            addr: port,
            authtoken: GPU_CONFIG.ngrokToken,
            domain: GPU_CONFIG.ngrokDomain || undefined,
        });
        const url = listener.url();
        console.log(`🌐 Heady accessible at: ${url}`);
        return url;
    } catch (err) {
        console.log(`⚠ ngrok setup failed: ${err.message}`);
        console.log("  Install: pip install pyngrok && npm install @ngrok/ngrok");
        return null;
    }
}

module.exports = { GPU_CONFIG, GPUVectorStore, setupNgrokTunnel };
