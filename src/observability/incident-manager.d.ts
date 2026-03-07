export = IncidentManager;
declare class IncidentManager {
    constructor(opts?: {});
    incidents: any[];
    maxIncidents: any;
    thresholds: any;
    create(incident: any): {
        id: `${string}-${string}-${string}-${string}-${string}`;
        severity: any;
        title: any;
        status: string;
        source: any;
        detectedAt: string;
        resolvedAt: null;
        actions: never[];
        details: any;
    };
    evaluateSignals(signals?: {}): {
        id: `${string}-${string}-${string}-${string}-${string}`;
        severity: any;
        title: any;
        status: string;
        source: any;
        detectedAt: string;
        resolvedAt: null;
        actions: never[];
        details: any;
    }[];
    update(id: any, updates: any): any;
    generatePostmortem(id: any): {
        incidentId: any;
        title: any;
        severity: any;
        detectedAt: any;
        resolvedAt: any;
        durationSeconds: number | null;
        timeline: any;
        rootCause: any;
        impact: any;
        lessonsLearned: any;
        preventionActions: any;
    } | null;
    getOpen(): any[];
    getAll(limit?: number): any[];
    status(): {
        total: number;
        open: number;
        critical: number;
        high: number;
    };
}
//# sourceMappingURL=incident-manager.d.ts.map