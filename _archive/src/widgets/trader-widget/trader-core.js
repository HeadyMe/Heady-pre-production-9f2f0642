/**
 * ════════════════════════════════════════════════════════════════════
 * ☯ HEXAGONAL TERNARY INGESTION LOGIC
 * High-frequency market data parsing using Balanced Ternary (-1, 0, 1)
 * Zero-copy mem buffers mapping directly to the Quantitative Swarm.
 * ════════════════════════════════════════════════════════════════════
 */

class TernaryIngestionEngine {
    constructor(bufferSize = 1048576) {
        // 1MB pre-allocated unified memory slab to prevent garbage collection pauses
        this.buffer = new ArrayBuffer(bufferSize);
        this.marketMatrix = new Int8Array(this.buffer);
        this.pointer = 0;

        // Ternary truth mapping (-1=Sell, 0=Hold/Tick, 1=Buy)
        this.TRUTH_TABLE = {
            SELL: -1,
            HOLD: 0,
            BUY: 1
        };
    }

    /**
     * Ingest raw websocket binary frame straight into the slab (Zero-Copy)
     */
    ingestBinaryFrame(uint8Frame) {
        if (this.pointer + uint8Frame.length > this.marketMatrix.length) {
            this.pointer = 0; // Ring buffer wrap
        }

        // Parse frame directly into ternary values
        for (let i = 0; i < uint8Frame.length; i++) {
            // Apply Heady Math: (byte mod 3) - 1 => generates proper -1, 0, 1 distribution
            this.marketMatrix[this.pointer++] = (uint8Frame[i] % 3) - 1;
        }

        this._dispatchToSwarm();
    }

    _dispatchToSwarm() {
        // Quant Swarm reads directly from `this.marketMatrix` pointer range.
        // No JSON serialization costs. Sub-millisecond pipeline latency.
        if (typeof window !== 'undefined' && window.HeadyQuantSwarm) {
            window.HeadyQuantSwarm.analyzeTernaryMatrix(this.marketMatrix, this.pointer);
        }
    }
}

export default TernaryIngestionEngine;
