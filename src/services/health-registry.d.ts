export class HealthRegistry {
    services: Map<any, any>;
    startedAt: number;
    /**
     * Register a service for health monitoring.
     * @param {string} name - Service name
     * @param {Function|Object} healthFn - Function returning health status or object with getHealth()
     */
    register(name: string, healthFn: Function | Object): void;
    /**
     * Unregister a service.
     */
    unregister(name: any): void;
    /**
     * Get health status for a specific service.
     */
    getServiceHealth(name: any): Promise<any>;
    /**
     * Get aggregated health for all registered services.
     */
    getAggregatedHealth(): Promise<{
        status: string;
        services: {};
        summary: {
            total: number;
            healthy: number;
            unhealthy: number;
            uptime: number;
        };
        timestamp: string;
    }>;
    /**
     * Register Express routes for health endpoints.
     * Provides: /health, /health/:service, /health/metrics
     */
    registerRoutes(app: any): void;
}
export const healthRegistry: HealthRegistry;
//# sourceMappingURL=health-registry.d.ts.map