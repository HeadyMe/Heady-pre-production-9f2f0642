export = bridge;
declare const bridge: ErrorPipelineBridge;
declare class ErrorPipelineBridge extends EventEmitter<[never]> {
    constructor();
    swarm: any;
    _fingerprints: Map<any, any>;
    _pending: any[];
    _stats: {
        captured: number;
        deduplicated: number;
        injected: number;
        flushed: number;
    };
    /**
     * Connect to the HeadySwarm instance.
     * Must be called after the swarm is initialized.
     */
    connectSwarm(swarm: any): void;
    /**
     * Capture an error from any source.
     * @param {Object} opts
     * @param {string} opts.source - 'express', 'uncaught', 'rejection', 'swarm-bee', 'log-scanner', 'external'
     * @param {string} opts.message - error message
     * @param {string} [opts.stack] - stack trace
     * @param {string} [opts.severity] - 'critical', 'warning', 'info'
     * @param {Object} [opts.context] - additional context (route, status code, etc.)
     */
    capture(opts: {
        source: string;
        message: string;
        stack?: string | undefined;
        severity?: string | undefined;
        context?: Object | undefined;
    }): {
        id: string;
        source: string;
        message: string;
        stack: string;
        severity: string;
        context: Object;
        fingerprint: string;
        status: string;
        ts: string;
    } | undefined;
    /**
     * Inject an error into the swarm as a high-priority flower.
     */
    _injectToSwarm(errorRecord: any): void;
    /**
     * Generate an AI diagnostic prompt from an error record.
     */
    _generateDiagnosticPrompt(err: any): string;
    /**
     * Classify severity based on error characteristics.
     */
    _classifySeverity(opts: any): "info" | "critical" | "warning";
    /**
     * Generate a fingerprint for deduplication.
     */
    _fingerprint(source: any, message: any, context: any): string;
    /**
     * Clean expired fingerprints.
     */
    _cleanFingerprints(): void;
    /**
     * Append to the error ledger (JSONL file for audit).
     */
    _appendLedger(record: any): void;
    /**
     * Save pending error flowers to disk (for errors captured before swarm starts).
     */
    _savePendingFlowers(): void;
    /**
     * Load pending error flowers from disk (from previous session).
     */
    _loadPendingFlowers(): void;
    /**
     * Read the error ledger for the API.
     */
    readLedger(limit?: number): any[];
    /**
     * Flush — write all pending state to disk. Called during graceful shutdown.
     */
    flush(): void;
    /**
     * Stats for monitoring.
     */
    stats(): {
        pendingCount: number;
        fingerprintCacheSize: number;
        swarmConnected: boolean;
        captured: number;
        deduplicated: number;
        injected: number;
        flushed: number;
    };
}
import EventEmitter = require("events");
//# sourceMappingURL=error-pipeline-bridge.d.ts.map