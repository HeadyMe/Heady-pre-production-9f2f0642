export = DriftDetector;
declare class DriftDetector extends EventEmitter<[never]> {
    /**
     * @param {object} opts
     * @param {string}  opts.databaseUrl          — PostgreSQL connection string
     * @param {string}  [opts.redisUrl]           — Redis connection string (for baseline cache)
     * @param {number}  [opts.threshold=0.75]     — Minimum cosine similarity before flagging
     * @param {string}  [opts.baselineTable]      — Table storing baseline vectors
     * @param {string}  [opts.currentTable]       — Table storing current memory vectors
     * @param {object}  [opts.alertConfig]        — Alert channels
     * @param {string}  [opts.alertConfig.slackWebhook]
     * @param {string}  [opts.alertConfig.webhookUrl]
     * @param {number}  [opts.historyRetentionDays=90] — Days of drift history to keep
     */
    constructor(opts?: {
        databaseUrl: string;
        redisUrl?: string | undefined;
        threshold?: number | undefined;
        baselineTable?: string | undefined;
        currentTable?: string | undefined;
        alertConfig?: {
            slackWebhook?: string | undefined;
            webhookUrl?: string | undefined;
        } | undefined;
        historyRetentionDays?: number | undefined;
    });
    config: {
        databaseUrl: string | undefined;
        redisUrl: string | undefined;
        threshold: number;
        baselineTable: string;
        currentTable: string;
        historyTable: string;
        historyRetentionDays: number;
        mc: any;
        alertConfig: {
            slackWebhook: string | undefined;
            webhookUrl: string | undefined;
        };
    };
    _pgPool: any;
    _redisClient: any;
    _baseline: any;
    _lastCheck: {
        overallScore: string;
        severity: string;
        critical: boolean;
        degraded: boolean;
        threshold: number;
        checks: {
            [DRIFT_CATEGORY.SEMANTIC]: any;
            [DRIFT_CATEGORY.STRUCTURAL]: any;
            [DRIFT_CATEGORY.MISSION_ALIGNMENT]: any;
        };
        trajectory: object;
        duration: number;
        timestamp: string;
    } | null;
    initialize(): Promise<this>;
    destroy(): Promise<void>;
    /**
     * Run a full drift check across all categories.
     * @returns {Promise<DriftResult>}
     */
    runFullCheck(): Promise<DriftResult>;
    /**
     * Force a baseline recalibration from current vectors.
     * Called by self-healing workflows when critical drift is detected.
     * @param {object} [opts]
     * @param {string} [opts.reason]
     * @param {string} [opts.severity]
     */
    triggerRecalibration(opts?: {
        reason?: string | undefined;
        severity?: string | undefined;
    }): Promise<void>;
    /**
     * Get drift history for pattern analysis.
     * @param {object} [opts]
     * @param {number} [opts.limit=100]
     * @param {string} [opts.since] — ISO date string
     * @returns {Promise<object[]>}
     */
    getHistory(opts?: {
        limit?: number | undefined;
        since?: string | undefined;
    }): Promise<object[]>;
    _checkSemanticDrift(): Promise<{
        category: string;
        similarity: number;
        status: string;
        detail: string;
        severity?: undefined;
        sampleSize?: undefined;
        threshold?: undefined;
    } | {
        category: string;
        similarity: number;
        severity: string;
        status: string;
        sampleSize: any;
        threshold: number;
        detail: {
            baselineVectorCount: any;
            baselineDate: any;
            currentSampleSize: any;
        };
    }>;
    _checkStructuralDrift(): Promise<{
        category: string;
        similarity: number;
        status: string;
        severity?: undefined;
        detail?: undefined;
    } | {
        category: string;
        similarity: number;
        severity: string;
        status: string;
        detail: {
            total: number;
            clusterCount: number;
            avgConfidence: number;
            stddevConfidence: number;
        };
    } | {
        category: string;
        similarity: number;
        status: string;
        detail: any;
        severity?: undefined;
    }>;
    _checkMissionAlignmentDrift(): Promise<{
        category: string;
        similarity: number;
        status: string;
        detail: string;
        severity?: undefined;
        missionThreshold?: undefined;
    } | {
        category: string;
        similarity: number;
        severity: string;
        status: string;
        missionThreshold: number;
        detail: {
            sampleSize: any;
            baselineDate: any;
            alignmentPct: string;
        };
    }>;
    /**
     * Simulate future drift trajectory using Monte Carlo sampling.
     * Projects where the system's drift score will be in N steps.
     *
     * @param {number} currentScore — current overall similarity (0–1)
     * @returns {object} trajectory prediction
     */
    _simulateTrajectory(currentScore: number): object;
    _loadBaseline(): Promise<void>;
    _getBaseline(category?: string): Promise<any>;
    _sampleCurrentVectors({ limit, tag }?: {
        limit?: number | undefined;
        tag?: null | undefined;
    }): Promise<any>;
    _getHistoricalDeltas(): Promise<number[]>;
    _persistDriftRecord(result: any): Promise<void>;
    _ensureSchema(): Promise<void>;
    _onCriticalDrift(result: any): Promise<void>;
    _sendAlert({ severity, result }: {
        severity: any;
        result: any;
    }): Promise<void>;
    _scoreToSeverity(score: any): string;
    _settle(promiseResult: any): any;
    _stddev(values: any): number;
}
declare namespace DriftDetector {
    export { DRIFT_CATEGORY, DRIFT_SEVERITY, EMBEDDING_DIMS, DEFAULT_DRIFT_THRESHOLD, cosineSimilarity, centroid };
}
import EventEmitter = require("events");
declare namespace DRIFT_CATEGORY {
    let SEMANTIC: string;
    let STRUCTURAL: string;
    let MISSION_ALIGNMENT: string;
}
declare namespace DRIFT_SEVERITY {
    let NOMINAL: string;
    let MINOR: string;
    let MODERATE: string;
    let CRITICAL: string;
}
/** Dimensionality of the embedding space */
declare const EMBEDDING_DIMS: 384;
/** Default cosine similarity threshold below which drift is flagged */
declare const DEFAULT_DRIFT_THRESHOLD: 0.75;
/**
 * Compute cosine similarity between two vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} similarity in [-1, 1]
 */
declare function cosineSimilarity(a: number[], b: number[]): number;
/**
 * Compute centroid (mean vector) of an array of vectors.
 * @param {number[][]} vectors
 * @returns {number[]}
 */
declare function centroid(vectors: number[][]): number[];
//# sourceMappingURL=drift-detector.d.ts.map