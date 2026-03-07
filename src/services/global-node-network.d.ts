export class GlobalNodeNetwork {
    constructor({ heartbeatIntervalMs, staleThresholdMs, maxNodes }?: {
        heartbeatIntervalMs?: number | undefined;
        staleThresholdMs?: number | undefined;
        maxNodes?: number | undefined;
    });
    heartbeatIntervalMs: number;
    staleThresholdMs: number;
    maxNodes: number;
    nodes: Map<any, any>;
    regions: Map<any, any>;
    routes: Map<any, any>;
    stats: {
        totalRegistered: number;
        totalDeregistered: number;
        totalRouted: number;
        totalHeartbeats: number;
    };
    _heartbeatTimer: NodeJS.Timeout | null;
    registerNode(nodeId: any, { region, country, role, capabilities, endpoint }?: {
        role?: string | undefined;
        capabilities?: never[] | undefined;
    }): {
        nodeId: any;
        region: any;
        country: any;
        role: string;
        capabilities: Set<any>;
        endpoint: any;
        status: string;
        lastHeartbeat: number;
        registeredAt: string;
        load: number;
        tasksProcessed: number;
        latencyMs: number;
    };
    deregisterNode(nodeId: any): void;
    heartbeat(nodeId: any, { load, latencyMs }?: {
        load?: number | undefined;
        latencyMs?: number | undefined;
    }): any;
    startHeartbeatMonitor(): void;
    stopHeartbeatMonitor(): void;
    routeToNearest(requiredCapability: any, { preferRegion, excludeNodes }?: {
        excludeNodes?: never[] | undefined;
    }): {
        nodeId: any;
        endpoint: any;
        region: any;
    } | null;
    getNodesByRegion(region: any): any[];
    getActiveNodes(): any[];
    getRegionStats(): {};
    getHealth(): {
        totalNodes: number;
        activeNodes: number;
        staleNodes: number;
        regions: number;
        stats: {
            totalRegistered: number;
            totalDeregistered: number;
            totalRouted: number;
            totalHeartbeats: number;
        };
        regionStats: {};
    };
}
export namespace NODE_ROLES {
    let PRIMARY: string;
    let REPLICA: string;
    let EDGE: string;
    let RELAY: string;
}
export function registerGlobalNodeRoutes(app: any): GlobalNodeNetwork;
//# sourceMappingURL=global-node-network.d.ts.map