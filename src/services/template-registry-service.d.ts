export class TemplateRegistryService extends EventEmitter<[never]> {
    constructor(config?: {});
    config: {
        enabled: boolean;
        auditIntervalMs: number;
        autoIndexScenarios: boolean;
    };
    isRunning: boolean;
    lastProjection: any;
    start(): Promise<void>;
    auditLoop: NodeJS.Timeout | undefined;
    stop(): Promise<void>;
    runAuditCycle(): Promise<any>;
    getStatus(): {
        running: boolean;
        lastProjection: any;
    };
}
export function getTemplateRegistryService(config?: {}): any;
import EventEmitter = require("events");
//# sourceMappingURL=template-registry-service.d.ts.map