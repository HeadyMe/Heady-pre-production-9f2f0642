export class HeadyQA extends EventEmitter<[never]> {
    constructor(opts?: {});
    projectRoot: any;
    managerUrl: any;
    managerPort: any;
    running: boolean;
    loopId: NodeJS.Timeout | null;
    stats: {
        totalRuns: number;
        totalPassed: number;
        totalFailed: number;
        totalWarnings: number;
        lastRunAt: null;
        lastReport: null;
    };
    runFullSuite(trigger?: string): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        trigger: string;
        startedAt: string;
        results: never[];
        summary: {
            pass: number;
            fail: number;
            warn: number;
            skip: number;
        };
    }>;
    _probeEndpoint(test: any): Promise<any>;
    _validateSchema(schema: any): {
        test: any;
        type: string;
        verdict: string;
        error?: undefined;
    } | {
        test: any;
        type: string;
        verdict: string;
        error: any;
    };
    _checkConfigIntegrity(configPath: any): {
        test: string;
        type: string;
        verdict: string;
        size: number;
        error?: undefined;
    } | {
        test: string;
        type: string;
        verdict: string;
        error: any;
        size?: undefined;
    };
    _smokeTestIntegration(): Promise<{
        test: string;
        type: string;
        verdict: string;
        error?: undefined;
    } | {
        test: string;
        type: string;
        verdict: string;
        error: any;
    }>;
    _httpGet(urlPath: any): Promise<any>;
    startContinuousLoop(): void;
    stopContinuousLoop(): void;
    getStatus(): {
        testCatalog: number;
        schemaChecks: number;
        configChecks: number;
        totalRuns: number;
        totalPassed: number;
        totalFailed: number;
        totalWarnings: number;
        lastRunAt: null;
        lastReport: null;
        running: boolean;
    };
    _auditLog(entry: any): void;
}
export function registerQARoutes(app: any, qa: any): void;
import EventEmitter = require("events");
//# sourceMappingURL=hc_qa.d.ts.map