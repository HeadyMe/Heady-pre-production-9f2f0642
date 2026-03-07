export class DynamicConnectorService extends EventEmitter<[never]> {
    constructor(opts?: {});
    _registry: Map<any, any>;
    _allowedDomains: Set<any>;
    _metrics: {
        total: number;
        active: number;
        failed: number;
        discoveries: number;
        codeGenerated: number;
        dlpBlocked: number;
        protocolSwitches: number;
    };
    discover(targetUrl: any, opts?: {}): Promise<{
        id: string;
        targetUrl: any;
        state: string;
        createdAt: number;
        spec: null;
        generatedCode: null;
        protocol: null;
        auth: null;
        rateLimits: null;
        endpoints: never[];
        dlpPassed: boolean;
        lintPassed: boolean;
        errors: never[];
    }>;
    _fetchSpec(url: any, opts?: {}): Promise<{
        type: string;
        data: any;
        sourceUrl: string;
    } | {
        type: string;
        data: {
            url: any;
            statusCode: number;
        };
        sourceUrl: any;
    }>;
    _parseAuth(spec: any): {
        type: string;
        in?: undefined;
        name?: undefined;
    } | {
        type: string;
        in: any;
        name: any;
    };
    _parseEndpoints(spec: any): any;
    _detectProtocol(spec: any, opts: any): string;
    mapOntology(connectorId: any, headySchema: any): {
        fieldMappings: never[];
        mismatches: never[];
    };
    generateConnector(connectorId: any): Promise<{
        passed: boolean;
        errors: string[];
        connectorId?: undefined;
        protocol?: undefined;
    } | {
        passed: boolean;
        connectorId: any;
        protocol: any;
        errors?: undefined;
    }>;
    _buildCode(c: any): string;
    switchProtocol(id: any, proto: any): {
        id: any;
        from: any;
        to: any;
    };
    synthesize(url: any, schema?: null, opts?: {}): Promise<{
        endpoints: number;
        protocol: null;
        passed: boolean;
        errors: string[];
        connectorId: string;
    } | {
        endpoints: number;
        protocol: null;
        passed: boolean;
        connectorId: any;
        errors?: undefined;
    }>;
    getConnector(id: any): any;
    listConnectors(f?: {}): {
        id: any;
        targetUrl: any;
        state: any;
        protocol: any;
        auth: any;
        endpoints: any;
        createdAt: any;
    }[];
    removeConnector(id: any): boolean;
    getMetrics(): {
        registrySize: number;
        total: number;
        active: number;
        failed: number;
        discoveries: number;
        codeGenerated: number;
        dlpBlocked: number;
        protocolSwitches: number;
    };
    registerRoutes(app: any): void;
}
export function getInstance(opts: any): any;
export namespace STATE {
    let DISCOVERING: string;
    let MAPPING: string;
    let GENERATING: string;
    let LINTING: string;
    let QUARANTINED: string;
    let ACTIVE: string;
    let FAILED: string;
    let DISABLED: string;
}
export namespace PROTOCOLS {
    let REST: string;
    let WEBSOCKET: string;
    let SSE: string;
    let GRPC: string;
    let GRAPHQL: string;
}
export namespace DLP_RULES {
    namespace NO_PII_EGRESS {
        let enabled: boolean;
        let patterns: RegExp[];
    }
    namespace NO_CREDENTIALS {
        let enabled_1: boolean;
        export { enabled_1 as enabled };
        let patterns_1: RegExp[];
        export { patterns_1 as patterns };
    }
    namespace NO_MUSIC_IP {
        let enabled_2: boolean;
        export { enabled_2 as enabled };
        export let extensions: string[];
    }
}
import EventEmitter = require("events");
//# sourceMappingURL=dynamic-connector-service.d.ts.map