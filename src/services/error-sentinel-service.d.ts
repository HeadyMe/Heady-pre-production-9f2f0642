export class HeadyErrorSentinel extends EventEmitter<[never]> {
    constructor(config?: {});
    config: {
        aggregation_interval_ms: number;
        severity_threshold: string;
    };
    isRunning: boolean;
    errorLog: any[];
    activeAnomalies: Map<any, any>;
    layers: {
        UX: {
            count: number;
            critical: number;
        };
        IO: {
            count: number;
            critical: number;
        };
        Intelligence: {
            count: number;
            critical: number;
        };
        Core: {
            count: number;
            critical: number;
        };
        Infrastructure: {
            count: number;
            critical: number;
        };
        Edge: {
            count: number;
            critical: number;
        };
    };
    start(): void;
    aggregationLoop: NodeJS.Timeout | undefined;
    stop(): void;
    reportError(layer: any, errorDetails: any): void;
    handleCriticalImmediate(errorEntry: any): void;
    analyzeAndRoute(): void;
    getStatus(): {
        isRunning: boolean;
        totalErrorsLogged: {
            UX: {
                count: number;
                critical: number;
            };
            IO: {
                count: number;
                critical: number;
            };
            Intelligence: {
                count: number;
                critical: number;
            };
            Core: {
                count: number;
                critical: number;
            };
            Infrastructure: {
                count: number;
                critical: number;
            };
            Edge: {
                count: number;
                critical: number;
            };
        };
        activeAnomalies: [any, any][];
    };
}
export function getErrorSentinel(config?: {}): any;
import EventEmitter = require("events");
//# sourceMappingURL=error-sentinel-service.d.ts.map