export class BrainConnector extends EventEmitter<[never]> {
    constructor(opts?: {});
    poolSize: any;
    healthCheckInterval: any;
    endpoints: Map<any, any>;
    failures: Map<any, any>;
    circuitBreakers: Map<any, any>;
    _healthInterval: NodeJS.Timeout;
    _registerEndpoint(id: any, config: any): void;
    _runHealthChecks(): Promise<void>;
    getHealthyEndpoint(): any;
    destroy(): void;
}
export function getBrainConnector(opts: any): any;
import EventEmitter = require("events");
//# sourceMappingURL=brain_connector.d.ts.map