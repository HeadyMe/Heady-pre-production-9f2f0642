export class AutoHeal {
    constructor(conductor: any);
    conductor: any;
    healingInProgress: Set<any>;
    logs: any[];
    /**
     * Perform a health check and trigger healing if needed
     */
    check(): Promise<void>;
    /**
     * Trigger recovery for a specific component
     */
    heal(componentId: any, status: any): Promise<void>;
    log(msg: any): void;
    getStatus(): {
        active: boolean;
        healingCount: number;
        recentLogs: any[];
    };
}
//# sourceMappingURL=auto-heal.d.ts.map