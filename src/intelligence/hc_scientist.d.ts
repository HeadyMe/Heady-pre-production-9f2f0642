export class HeadyScientist extends EventEmitter<[never]> {
    constructor(opts?: {});
    projectRoot: any;
    dataDir: any;
    scanInterval: any;
    running: boolean;
    timer: NodeJS.Timeout | null;
    scans: any[];
    driftHistory: any[];
    proofChain: any[];
    lastChainHash: string;
    predictions: any[];
    totalScans: number;
    totalDriftsDetected: number;
    totalDriftsResolved: number;
    determinismScore: number;
    start(): void;
    stop(): void;
    wireEventBus(eventBus: any): void;
    eventBus: any;
    wireDeepIntel(deepIntelEngine: any): void;
    deepIntel: any;
    wireAutoSuccess(asEngine: any): void;
    autoSuccessEngine: any;
    runConsistencyScan(trigger?: string): Promise<{
        id: string;
        trigger: string;
        ts: string;
        findings: never[];
        passed: number;
        failed: number;
        warnings: number;
        determinismScore: number;
    }>;
    _checkRuntimeConsistency(scan: any): Promise<void>;
    _evaluateDriftResponse(alert: any): void;
    _triggerScan(reason: any): void;
    _lastTriggerScan: number | undefined;
    _addToProofChain(scan: any): {
        index: number;
        scanId: any;
        ts: any;
        hash: string;
        prevHash: string;
        determinismScore: any;
    };
    _generatePrediction(scan: any): void;
    _loadState(): void;
    _saveState(): void;
    getStatus(): {
        status: string;
        determinismScore: string;
        totalScans: number;
        totalDriftsDetected: number;
        scanInterval: string;
        proofChainLength: number;
        lastChainHash: string;
        latestScan: {
            id: any;
            trigger: any;
            passed: any;
            failed: any;
            warnings: any;
            determinismScore: any;
            ts: any;
        } | null;
        prediction: any;
        rulesCount: number;
        consistencyRules: {
            id: string;
            description: string;
            expected: string | number;
            files: string[];
        }[];
    };
}
export function registerScientistRoutes(app: any, scientist: any): any;
export const CONSISTENCY_RULES: ({
    id: string;
    description: string;
    expectedValue: number;
    locations: {
        file: string;
        pattern: RegExp;
    }[];
    severity: string;
} | {
    id: string;
    description: string;
    expectedValue: string;
    locations: {
        file: string;
        pattern: RegExp;
    }[];
    severity: string;
})[];
import EventEmitter = require("events");
//# sourceMappingURL=hc_scientist.d.ts.map