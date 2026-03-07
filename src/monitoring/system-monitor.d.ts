export class SystemMonitor extends EventEmitter<[never]> {
    /**
     * @param {object} opts
     * @param {number}   [opts.intervalMs=5000]   - Poll interval
     * @param {object}   [opts.thresholds]        - Override default thresholds
     * @param {object}   [opts.telemetry]         - Injected TelemetryCollector
     * @param {boolean}  [opts.autoStart=false]
     */
    constructor(opts?: {
        intervalMs?: number | undefined;
        thresholds?: object | undefined;
        telemetry?: object | undefined;
        autoStart?: boolean | undefined;
    });
    intervalMs: number;
    thresholds: {
        cpuPercent: {
            warn: number;
            critical: number;
            unit: string;
        };
        memoryPercent: {
            warn: number;
            critical: number;
            unit: string;
        };
        heapUsedMb: {
            warn: number;
            critical: number;
            unit: string;
        };
        eventLoopLagMs: {
            warn: number;
            critical: number;
            unit: string;
        };
        errorRate: {
            warn: number;
            critical: number;
            unit: string;
        };
    };
    _telemetry: object;
    /** subsystem health reporters: name → () => HealthReport */
    _subsystems: Map<any, any>;
    _timer: NodeJS.Timeout | null;
    _running: boolean;
    _lastCpuMs: {
        user: number;
        system: number;
        total: number;
    } | null;
    _alertHistory: any[];
    /** Snapshot from last poll */
    latestSnapshot: {
        timestamp: string;
        healthy: boolean;
        system: {
            cpu: {
                percent: number;
            };
            memory: {
                totalMb: number;
                usedMb: number;
                freeMb: number;
                percentUsed: number;
            };
            heap: {
                usedMb: number;
                totalMb: number;
                rssMb: number;
                externalMb: number;
            };
            eventLoopLagMs: any;
            openFds: number | null;
            uptimeSeconds: number;
            platform: NodeJS.Platform;
            nodeVersion: string;
            pid: number;
            loadAvg: number[];
        };
        subsystems: ({
            name: any;
            healthy: boolean;
            details: any;
            error?: undefined;
        } | {
            name: any;
            healthy: boolean;
            error: any;
            details?: undefined;
        })[];
        activeAlerts: ({
            metric: any;
            label: any;
            value: any;
            threshold: any;
            severity: "CRITICAL";
            unit: any;
        } | {
            metric: any;
            label: any;
            value: any;
            threshold: any;
            severity: "WARN";
            unit: any;
        })[];
    } | null;
    start(): this;
    stop(): void;
    /**
     * Register a subsystem health reporter.
     * @param {string}   name
     * @param {Function} reporterFn  - async () => { healthy: bool, details?: object }
     */
    registerSubsystem(name: string, reporterFn: Function): void;
    removeSubsystem(name: any): boolean;
    setThreshold(metric: any, level: any, value: any): void;
    /**
     * Run an immediate health check and return a snapshot.
     * @returns {Promise<SystemSnapshot>}
     */
    check(): Promise<SystemSnapshot>;
    /**
     * Express/Koa middleware that returns a health JSON response.
     */
    healthEndpoint(): (req: any, res: any) => Promise<void>;
    getAlertHistory(limit?: number): any[];
    clearAlertHistory(): void;
    _tick(): Promise<{
        timestamp: string;
        healthy: boolean;
        system: {
            cpu: {
                percent: number;
            };
            memory: {
                totalMb: number;
                usedMb: number;
                freeMb: number;
                percentUsed: number;
            };
            heap: {
                usedMb: number;
                totalMb: number;
                rssMb: number;
                externalMb: number;
            };
            eventLoopLagMs: any;
            openFds: number | null;
            uptimeSeconds: number;
            platform: NodeJS.Platform;
            nodeVersion: string;
            pid: number;
            loadAvg: number[];
        };
        subsystems: ({
            name: any;
            healthy: boolean;
            details: any;
            error?: undefined;
        } | {
            name: any;
            healthy: boolean;
            error: any;
            details?: undefined;
        })[];
        activeAlerts: ({
            metric: any;
            label: any;
            value: any;
            threshold: any;
            severity: "CRITICAL";
            unit: any;
        } | {
            metric: any;
            label: any;
            value: any;
            threshold: any;
            severity: "WARN";
            unit: any;
        })[];
    }>;
    _measureCpu(): Promise<number>;
    _measureMemory(): {
        totalMb: number;
        usedMb: number;
        freeMb: number;
        percentUsed: number;
    };
    _measureHeap(): {
        usedMb: number;
        totalMb: number;
        rssMb: number;
        externalMb: number;
    };
    _measureEventLoopLag(): Promise<any>;
    _pollSubsystems(): Promise<({
        name: any;
        healthy: boolean;
        details: any;
        error?: undefined;
    } | {
        name: any;
        healthy: boolean;
        error: any;
        details?: undefined;
    })[]>;
    _checkThreshold(metric: any, value: any, label: any): {
        metric: any;
        label: any;
        value: any;
        threshold: any;
        severity: "CRITICAL";
        unit: any;
    }[] | {
        metric: any;
        label: any;
        value: any;
        threshold: any;
        severity: "WARN";
        unit: any;
    }[];
    _emitAlert(alert: any): void;
}
export const SEVERITY: Readonly<{
    INFO: "INFO";
    WARN: "WARN";
    CRITICAL: "CRITICAL";
}>;
export namespace DEFAULT_THRESHOLDS {
    namespace cpuPercent {
        let warn: number;
        let critical: number;
        let unit: string;
    }
    namespace memoryPercent {
        let warn_1: number;
        export { warn_1 as warn };
        let critical_1: number;
        export { critical_1 as critical };
        let unit_1: string;
        export { unit_1 as unit };
    }
    namespace heapUsedMb {
        let warn_2: number;
        export { warn_2 as warn };
        let critical_2: number;
        export { critical_2 as critical };
        let unit_2: string;
        export { unit_2 as unit };
    }
    namespace eventLoopLagMs {
        let warn_3: number;
        export { warn_3 as warn };
        let critical_3: number;
        export { critical_3 as critical };
        let unit_3: string;
        export { unit_3 as unit };
    }
    namespace errorRate {
        let warn_4: number;
        export { warn_4 as warn };
        let critical_4: number;
        export { critical_4 as critical };
        let unit_4: string;
        export { unit_4 as unit };
    }
}
import { EventEmitter } from "events";
//# sourceMappingURL=system-monitor.d.ts.map