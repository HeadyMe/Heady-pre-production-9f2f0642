export class HeadyMaintenanceOps {
    constructor({ rootDir }?: {
        rootDir?: string | undefined;
    });
    rootDir: string;
    lastAudit: {
        ok: boolean;
        scannedFiles: number;
        pruneCandidates: any;
        projection: {
            ok: boolean;
            reason: string;
        };
        staleProjectionReferences: any[];
        gitSourceOfTruth: {
            ok: boolean;
            branch: string;
            origin: string | null;
            hasOrigin: boolean;
            workingTreeClean: boolean;
            error?: undefined;
        } | {
            ok: boolean;
            error: any;
            branch?: undefined;
            origin?: undefined;
            hasOrigin?: undefined;
            workingTreeClean?: undefined;
        };
        prunePlan: {
            dryRun: boolean;
            candidateCount: any;
            candidates: any;
            applyCommand: string;
        };
        generatedAt: string;
    } | null;
    audit(): {
        ok: boolean;
        scannedFiles: number;
        pruneCandidates: any;
        projection: {
            ok: boolean;
            reason: string;
        };
        staleProjectionReferences: any[];
        gitSourceOfTruth: {
            ok: boolean;
            branch: string;
            origin: string | null;
            hasOrigin: boolean;
            workingTreeClean: boolean;
            error?: undefined;
        } | {
            ok: boolean;
            error: any;
            branch?: undefined;
            origin?: undefined;
            hasOrigin?: undefined;
            workingTreeClean?: undefined;
        };
        prunePlan: {
            dryRun: boolean;
            candidateCount: any;
            candidates: any;
            applyCommand: string;
        };
        generatedAt: string;
    };
    cleanup({ dryRun }?: {
        dryRun?: boolean | undefined;
    }): {
        ok: boolean;
        scannedFiles: number;
        pruneCandidates: any;
        projection: {
            ok: boolean;
            reason: string;
        };
        staleProjectionReferences: any[];
        gitSourceOfTruth: {
            ok: boolean;
            branch: string;
            origin: string | null;
            hasOrigin: boolean;
            workingTreeClean: boolean;
            error?: undefined;
        } | {
            ok: boolean;
            error: any;
            branch?: undefined;
            origin?: undefined;
            hasOrigin?: undefined;
            workingTreeClean?: undefined;
        };
        prunePlan: {
            dryRun: boolean;
            candidateCount: any;
            candidates: any;
            applyCommand: string;
        };
        generatedAt: string;
        dryRun: boolean;
        removed: never[];
        removedCount?: undefined;
    } | {
        ok: boolean;
        dryRun: boolean;
        removed: any[];
        removedCount: number;
        gitSourceOfTruth: {
            ok: boolean;
            branch: string;
            origin: string | null;
            hasOrigin: boolean;
            workingTreeClean: boolean;
            error?: undefined;
        } | {
            ok: boolean;
            error: any;
            branch?: undefined;
            origin?: undefined;
            hasOrigin?: undefined;
            workingTreeClean?: undefined;
        };
        prunePlan: {
            dryRun: boolean;
            candidateCount: any;
            candidates: any;
            applyCommand: string;
        };
        generatedAt: string;
    };
    reconcileProjectionState(): {
        ok: boolean;
        projectionOk: boolean;
        healthyProjectionTargets: number;
        staleReferenceCount: number;
        pruneCandidateCount: any;
        recommendation: string;
        gitSourceOfTruth: {
            ok: boolean;
            branch: string;
            origin: string | null;
            hasOrigin: boolean;
            workingTreeClean: boolean;
            error?: undefined;
        } | {
            ok: boolean;
            error: any;
            branch?: undefined;
            origin?: undefined;
            hasOrigin?: undefined;
            workingTreeClean?: undefined;
        };
        prunePlan: {
            dryRun: boolean;
            candidateCount: any;
            candidates: any;
            applyCommand: string;
        };
        generatedAt: string;
    };
    health(): {
        ok: boolean;
        hasAudit: boolean;
        lastAuditAt: string | null;
    };
}
export function registerMaintenanceOpsRoutes(app: any, maintenanceOps: any): any;
export function findPruneCandidates(files: any): any;
export function isNeverDelete(filePath: any): boolean;
export function findStaleProjectionReferences(files: any, rootDir: any): any[];
export function getGitSourceOfTruthStatus(rootDir: any): {
    ok: boolean;
    branch: string;
    origin: string | null;
    hasOrigin: boolean;
    workingTreeClean: boolean;
    error?: undefined;
} | {
    ok: boolean;
    error: any;
    branch?: undefined;
    origin?: undefined;
    hasOrigin?: undefined;
    workingTreeClean?: undefined;
};
export function buildPrunePlan(files: any): {
    dryRun: boolean;
    candidateCount: any;
    candidates: any;
    applyCommand: string;
};
//# sourceMappingURL=heady-maintenance-ops.d.ts.map