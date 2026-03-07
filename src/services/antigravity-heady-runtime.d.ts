export const POLICY_PATH: string;
export function readPolicy(filePath?: string): any;
export function isOwnerInitiated(initiatedBy: any, policy?: any): any;
export function enforceHeadyForAntigravityOperation(input: any, options?: {}): {
    enforced: any;
    gateway: any;
    workspaceMode: any;
    autonomousMode: any;
    operation: {
        initiatedBy: any;
        source: any;
        task: any;
        situation: any;
        metadata: any;
    };
    selectedTemplates: any;
    requiredSwarmTasks: any;
    vectorWorkspace: {
        enabled: boolean;
        dimensions: number;
        zoneRouting: boolean;
        instantExecution: boolean;
    };
};
export function getHealthStatus(): {
    endpoint: any;
    status: string;
    workspaceMode: any;
    gateway: any;
    autonomousMode: any;
};
//# sourceMappingURL=antigravity-heady-runtime.d.ts.map