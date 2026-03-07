export class ConnectorDiscovery {
    constructor(opts?: {});
    registry: Map<any, any>;
    scanInterval: any;
    endpoints: any;
    _timer: NodeJS.Timeout | null;
    /**
     * Probe an endpoint for MCP capabilities.
     */
    probe(endpoint: any): Promise<{
        endpoint: any;
        alive: boolean;
        capabilities: never[];
        ts: number;
    }>;
    /**
     * Scan all configured endpoints.
     */
    scan(): Promise<{
        endpoint: any;
        alive: boolean;
        capabilities: never[];
        ts: number;
    }[]>;
    /**
     * Start periodic scanning.
     */
    start(): this | undefined;
    stop(): void;
    getStatus(): {
        ok: boolean;
        endpointCount: any;
        scanned: number;
        alive: number;
        endpoints: any[];
    };
}
export function getDiscovery(opts: any): any;
//# sourceMappingURL=connector-discovery.d.ts.map