/**
 * Heady™ Enterprise Health Probes
 * PR 7: Kubernetes-style liveness + readiness probes with dependency checks
 */
export class HealthProbes {
    constructor(options?: {});
    service: any;
    version: any;
    startTime: number;
    checks: Map<any, any>;
    ready: boolean;
    /** Register a dependency health check */
    registerCheck(name: any, checkFn: any): void;
    /** Mark the service as ready (call after boot completes) */
    markReady(): void;
    /** Liveness probe — is the process alive? */
    liveness(): Promise<{
        status: string;
        service: any;
        version: any;
        uptime: number;
        timestamp: string;
    }>;
    /** Readiness probe — is the service ready to handle traffic? */
    readiness(): Promise<{
        status: string;
        service: any;
        version: any;
        uptime: number;
        checks: {};
        timestamp: string;
    }>;
    /** Mount Express routes */
    mount(app: any): void;
}
//# sourceMappingURL=health-probes.d.ts.map