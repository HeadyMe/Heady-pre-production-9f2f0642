export default TernaryIngestionEngine;
/**
 * ════════════════════════════════════════════════════════════════════
 * ☯ HEXAGONAL TERNARY INGESTION LOGIC
 * High-frequency market data parsing using Balanced Ternary (-1, 0, 1)
 * Zero-copy mem buffers mapping directly to the Quantitative Swarm.
 * ════════════════════════════════════════════════════════════════════
 */
declare class TernaryIngestionEngine {
    constructor(bufferSize?: number);
    buffer: ArrayBuffer;
    marketMatrix: Int8Array<ArrayBuffer>;
    pointer: number;
    TRUTH_TABLE: {
        SELL: number;
        HOLD: number;
        BUY: number;
    };
    /**
     * Ingest raw websocket binary frame straight into the slab (Zero-Copy)
     */
    ingestBinaryFrame(uint8Frame: any): void;
    _dispatchToSwarm(): void;
}
//# sourceMappingURL=trader-core.d.ts.map