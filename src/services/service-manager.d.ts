export class ServiceManager extends EventEmitter<[never]> {
    constructor(config?: {});
    config: {
        auto_start: boolean;
        monitoring_interval: number;
        health_check_interval: number;
        recovery_enabled: boolean;
        graceful_shutdown: boolean;
    };
    services: Map<any, any>;
    serviceStatus: Map<any, any>;
    healthMetrics: Map<any, any>;
    isRunning: boolean;
    initializeServices(): void;
    registerService(name: any, factory: any, config?: {}): void;
    start(): Promise<void>;
    startTime: number | undefined;
    monitoringLoop: NodeJS.Timeout | undefined;
    healthCheckLoop: NodeJS.Timeout | undefined;
    metricsLoop: NodeJS.Timeout | undefined;
    stop(): Promise<void>;
    startAllServices(): Promise<void>;
    startService(name: any): Promise<void>;
    stopService(name: any): Promise<void>;
    stopAllServices(): Promise<void>;
    setupServiceListeners(name: any, service: any): void;
    scheduleRestart(name: any): Promise<void>;
    restartService(name: any): Promise<void>;
    monitorServices(): void;
    performHealthChecks(): void;
    updateMetrics(): void;
    getStatus(): {
        isRunning: boolean;
        uptime: number;
        services: {};
        summary: {
            total: number;
            running: number;
            stopped: number;
            failed: number;
        };
    };
    getServiceStatus(name: any): any;
    getHealthReport(): {
        timestamp: number;
        overall_health: number;
        services: {};
        recommendations: never[];
    };
    restartAllServices(): Promise<void>;
    sleep(ms: any): Promise<any>;
}
export function getServiceManager(config?: {}): any;
import EventEmitter = require("events");
//# sourceMappingURL=service-manager.d.ts.map