export class StructuredLogger {
    constructor(service?: string, options?: {});
    service: string;
    minLevel: any;
    metrics: {
        totalLogs: number;
        byLevel: {
            debug: number;
            info: number;
            warn: number;
            error: number;
            fatal: number;
        };
        byService: {};
    };
    circuitBreakerState: {};
    cacheHitCounters: {};
    _emit(level: any, message: any, meta?: {}): {
        timestamp: string;
        level: any;
        service: string;
        traceId: any;
        message: any;
    } | null;
    debug(msg: any, meta: any): {
        timestamp: string;
        level: any;
        service: string;
        traceId: any;
        message: any;
    } | null;
    info(msg: any, meta: any): {
        timestamp: string;
        level: any;
        service: string;
        traceId: any;
        message: any;
    } | null;
    warn(msg: any, meta: any): {
        timestamp: string;
        level: any;
        service: string;
        traceId: any;
        message: any;
    } | null;
    error(msg: any, meta: any): {
        timestamp: string;
        level: any;
        service: string;
        traceId: any;
        message: any;
    } | null;
    fatal(msg: any, meta: any): {
        timestamp: string;
        level: any;
        service: string;
        traceId: any;
        message: any;
    } | null;
    recordAcceptedTraffic(endpoint: any, deviceId: any): void;
    recordRejectedTraffic(endpoint: any, deviceId: any, reason: any): void;
    recordStaleDisconnect(deviceId: any, lastSeenMs: any): void;
    recordCircuitBreaker(service: any, state: any, errorRate: any): void;
    recordCacheHit(cacheKey: any, isHit: any): void;
    recordEdgeLatency(edgeId: any, latencyMs: any): void;
    recordSwarmSaturation(swarmId: any, saturationPercent: any): void;
    recordProjectionQueueDepth(queueName: any, depth: any): void;
    getMetrics(): {
        circuitBreakers: {};
        cacheCounters: {};
        totalLogs: number;
        byLevel: {
            debug: number;
            info: number;
            warn: number;
            error: number;
            fatal: number;
        };
        byService: {};
    };
    getHealth(): {
        service: string;
        status: string;
        metrics: {
            circuitBreakers: {};
            cacheCounters: {};
            totalLogs: number;
            byLevel: {
                debug: number;
                info: number;
                warn: number;
                error: number;
                fatal: number;
            };
            byService: {};
        };
        uptime: number;
    };
}
export function getLogger(service?: string, options?: {}): any;
//# sourceMappingURL=structured-logger.d.ts.map