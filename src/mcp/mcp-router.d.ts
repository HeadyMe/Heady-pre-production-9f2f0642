export class MCPRouter extends EventEmitter<[never]> {
    constructor();
    servers: Map<any, any>;
    tenants: Map<any, any>;
    routeCache: Map<any, any>;
    metrics: {
        routed: number;
        cached: number;
        discovered: number;
        errors: number;
    };
    /**
     * Register an MCP server with its capabilities.
     */
    registerServer(serverId: any, info: any): void;
    /**
     * Route a tool request to the best server.
     */
    route(toolName: any, tenantId?: string): {
        serverId: any;
        server: any;
        cached: boolean;
        error?: undefined;
    } | {
        serverId: null;
        error: string;
        server?: undefined;
        cached?: undefined;
    };
    /**
     * Register a tenant with allowed servers and permissions.
     */
    registerTenant(tenantId: any, config: any): void;
    /**
     * Auto-discover servers from a list of endpoints.
     */
    discover(endpoints?: any[]): Promise<{
        discovered: number;
    }>;
    /**
     * Health check all servers.
     */
    healthCheck(): {
        id: any;
        name: any;
        healthy: any;
        stale: boolean;
        lastSeen: any;
    }[];
    getStatus(): {
        ok: boolean;
        serverCount: number;
        tenantCount: number;
        cacheSize: number;
        metrics: {
            routed: number;
            cached: number;
            discovered: number;
            errors: number;
        };
        servers: {
            id: any;
            name: any;
            tools: any;
            healthy: any;
        }[];
    };
    registerRoutes(app: any): void;
}
export function getMCPRouter(): any;
import EventEmitter = require("events");
//# sourceMappingURL=mcp-router.d.ts.map