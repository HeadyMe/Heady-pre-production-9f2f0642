export = HealthMonitor;
declare class HealthMonitor extends EventEmitter<[never]> {
    /**
     * @param {object} opts
     * @param {string}   opts.databaseUrl       — PostgreSQL connection string
     * @param {string}   opts.redisUrl          — Redis connection string
     * @param {string[]} [opts.llmEndpoints]    — LLM provider health URLs
     * @param {object}   [opts.alerts]          — Alert channel configs
     * @param {string}   [opts.alerts.slackWebhook]
     * @param {string}   [opts.alerts.webhookUrl]
     * @param {number}   [opts.checkInterval=60000] — Background check interval (ms)
     * @param {object}   [opts.thresholds]      — Override default resource thresholds
     */
    constructor(opts?: {
        databaseUrl: string;
        redisUrl: string;
        llmEndpoints?: string[] | undefined;
        alerts?: {
            slackWebhook?: string | undefined;
            webhookUrl?: string | undefined;
        } | undefined;
        checkInterval?: number | undefined;
        thresholds?: object | undefined;
    });
    config: {
        databaseUrl: string | undefined;
        redisUrl: string | undefined;
        llmEndpoints: string[];
        checkInterval: number;
        thresholds: {
            memoryPct: any;
            cpuLoad1mPct: any;
            diskUsedPct: any;
            maxConnections: any;
            maxQueueDepth: any;
            vectorDriftMin: any;
        };
        alerts: {
            slackWebhook: string | undefined;
            webhookUrl: string | undefined;
        };
    };
    _pgPool: any;
    _redisClient: any;
    _lastCheck: {
        status: string;
        score: number;
        timestamp: string;
        duration: number;
        uptime: number;
        version: string;
        checks: {
            database: any;
            redis: any;
            vectorMemory: any;
            llmProvider: any;
            memory: any;
            cpu: any;
            diskSpace: any;
            activeConnections: any;
            queueDepth: any;
        };
    } | null;
    _checkTimer: NodeJS.Timeout | null;
    _healingLock: boolean;
    _metrics: {
        healthScore: any;
        checkScores: any;
        checkDuration: any;
        healingActions: any;
    } | null;
    initialize(): Promise<this>;
    destroy(): Promise<void>;
    /**
     * Run all health checks in parallel and return a composite result.
     * @returns {Promise<HealthResult>}
     */
    check(): Promise<HealthResult>;
    _checkDatabase(): Promise<{
        score: number;
        status: string;
        detail: any;
    }>;
    _checkRedis(): Promise<{
        score: number;
        status: string;
        detail: any;
    }>;
    _checkVectorMemory(): Promise<{
        score: number;
        status: string;
        detail: any;
    }>;
    _checkLlmProviders(): Promise<{
        score: number;
        status: string;
        detail: {
            providers: {
                name: string;
                status: any;
                available: boolean;
            }[];
            checks?: undefined;
        };
    } | {
        score: number;
        status: string;
        detail: {
            checks: {
                url: string;
                available: boolean;
            }[];
            providers?: undefined;
        };
    }>;
    _checkMemory(): Promise<{
        score: number;
        status: string;
        detail: {
            totalBytes: number;
            freeBytes: number;
            usedPct: string;
            thresholdPct: any;
            heapUsed: number;
            heapTotal: number;
            rss: number;
        };
    }>;
    _checkCpu(): Promise<{
        score: number;
        status: string;
        detail: {
            numCpus: number;
            loadAvg: {
                '1m': string;
                '5m': string;
                '15m': string;
            };
            load1mPct: string;
            thresholdPct: any;
        };
    }>;
    _checkDisk(): Promise<{
        score: number;
        status: string;
        detail: {
            totalGb: string;
            usedGb: string;
            freeGb: string;
            usedPct: string;
            thresholdPct: any;
        };
    } | {
        score: number;
        status: string;
        detail: string;
    }>;
    _checkActiveConnections(): Promise<{
        score: number;
        status: string;
        detail: string;
    } | {
        score: number;
        status: string;
        detail: {
            current: any;
            max: any;
            usedPct: string;
        };
    }>;
    _checkQueueDepth(): Promise<{
        score: number;
        status: string;
        detail: any;
    }>;
    _computeScore(checks: any): number;
    _scoreToState(score: any): string;
    _settle(promiseResult: any): any;
    _triggerHealing(result: any): Promise<void>;
    _sendAlert({ level, message, result }: {
        level: any;
        message: any;
        result: any;
    }): Promise<void>;
    _startBackgroundChecks(): void;
    _initPrometheus(): {
        healthScore: any;
        checkScores: any;
        checkDuration: any;
        healingActions: any;
    } | null;
    _updateMetrics(result: any): void;
    /**
     * Returns an Express router with all health endpoints mounted.
     * Usage: app.use(healthMonitor.router())
     */
    router(): any;
}
declare namespace HealthMonitor {
    export { STATE, THRESHOLD, WEIGHTS, PHI };
}
import EventEmitter = require("events");
declare namespace STATE {
    let HEALTHY: string;
    let DEGRADED: string;
    let CRITICAL: string;
    let UNKNOWN: string;
}
declare namespace THRESHOLD {
    let HEALTHY_1: number;
    export { HEALTHY_1 as HEALTHY };
    let DEGRADED_1: number;
    export { DEGRADED_1 as DEGRADED };
}
declare namespace WEIGHTS {
    export let database: number;
    export let vectorMemory: number;
    export { PHI as redis };
    export { PHI as llmProvider };
    export let memory: number;
    export let cpu: number;
    export let diskSpace: number;
    export let activeConnections: number;
    export let queueDepth: number;
}
declare const PHI: 1.618033988749895;
//# sourceMappingURL=health-monitor.d.ts.map