export class SelfAwareness {
    /**
     * @param {object} [opts]
     * @param {string} [opts.systemId='heady-system']  identifier for this system instance
     * @param {number} [opts.defaultIntervalMs=30000]  default heartbeat interval
     */
    constructor(opts?: {
        systemId?: string | undefined;
        defaultIntervalMs?: number | undefined;
    });
    _systemId: string;
    _defaultIntervalMs: number;
    _embeddingProvider: EmbeddingProvider;
    _monte: MonteCarloEngine;
    /** @type {Float64Array|null} */
    _baselineEmbedding: Float64Array | null;
    /** @type {Float64Array|null} */
    _currentEmbedding: Float64Array | null;
    /** @type {Array<{ from: string, to: string, reason: string, ts: number }>} */
    _stateTransitions: Array<{
        from: string;
        to: string;
        reason: string;
        ts: number;
    }>;
    /** @type {Array<{ ts: number, coherence: number, alert: boolean }>} */
    _heartbeatLog: Array<{
        ts: number;
        coherence: number;
        alert: boolean;
    }>;
    _intervalHandle: NodeJS.Timeout | null;
    _startedAt: number;
    /**
     * Build a text snapshot of the current system state for embedding.
     * @returns {string}
     */
    _systemStateText(): string;
    /**
     * Re-embed the current system state and check coherence vs baseline.
     * @returns {Promise<{ embedding: Float64Array, coherence: number|null, alert: boolean }>}
     */
    heartbeat(): Promise<{
        embedding: Float64Array;
        coherence: number | null;
        alert: boolean;
    }>;
    /**
     * Check coherence of current embedding vs baseline.
     * @returns {{ coherence: number|null, alert: boolean }}
     */
    coherenceCheck(): {
        coherence: number | null;
        alert: boolean;
    };
    /**
     * Return the current system identity embedding and metadata.
     * @returns {{ systemId: string, embedding: Float64Array|null, baseline: Float64Array|null, coherence: number|null, uptime: number }}
     */
    getSystemIdentity(): {
        systemId: string;
        embedding: Float64Array | null;
        baseline: Float64Array | null;
        coherence: number | null;
        uptime: number;
    };
    /**
     * Log a state transition (for the autobiographer / audit trail).
     * @param {string} from  prior state label
     * @param {string} to    new state label
     * @param {string} reason
     */
    logStateTransition(from: string, to: string, reason: string): void;
    /**
     * Return all logged state transitions.
     * @returns {Array<{ from: string, to: string, reason: string, ts: number }>}
     */
    getStateTransitions(): Array<{
        from: string;
        to: string;
        reason: string;
        ts: number;
    }>;
    /**
     * Operational Readiness Score using MonteCarloEngine.quickReadiness.
     * Derives signals from live process/OS metrics.
     * @returns {{ score: number, grade: string, breakdown: object }}
     */
    getORS(): {
        score: number;
        grade: string;
        breakdown: object;
    };
    /**
     * Current resource utilization snapshot.
     * @returns {{ cpuCount: number, loadAvg1m: number, memTotalMB: number, memFreeMB: number, memUsedRatio: number, heapUsedMB: number, heapTotalMB: number, uptime: number }}
     */
    getResourceUtilization(): {
        cpuCount: number;
        loadAvg1m: number;
        memTotalMB: number;
        memFreeMB: number;
        memUsedRatio: number;
        heapUsedMB: number;
        heapTotalMB: number;
        uptime: number;
    };
    /**
     * Start the periodic heartbeat loop.
     * @param {number} [intervalMs]  defaults to constructor option
     * @returns {this}
     */
    start(intervalMs?: number): this;
    /**
     * Stop the heartbeat loop.
     * @returns {this}
     */
    stop(): this;
    /**
     * Heartbeat log (last N entries).
     * @param {number} [limit=50]
     * @returns {Array<{ ts: number, coherence: number, alert: boolean }>}
     */
    getHeartbeatLog(limit?: number): Array<{
        ts: number;
        coherence: number;
        alert: boolean;
    }>;
}
export const COHERENCE_THRESHOLD: 0.75;
import { EmbeddingProvider } from "./embedding-provider";
import { MonteCarloEngine } from "./monte-carlo";
//# sourceMappingURL=self-awareness.d.ts.map