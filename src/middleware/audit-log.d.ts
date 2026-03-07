export class AuditLogger {
    constructor(opts?: {});
    _store: any;
    _hashChain: any;
    log(entry: any): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        timestamp: string;
        actor: any;
        actorId: any;
        tenantId: any;
        action: any;
        resource: any;
        resourceId: any;
        outcome: any;
        metadata: any;
        ip: any;
        userAgent: any;
        previousHash: any;
    }>;
    query(filters?: {}, limit?: number): Promise<any>;
    verifyChain(records: any): Promise<{
        valid: boolean;
        brokenAt: number;
        record: any;
        count?: undefined;
    } | {
        valid: boolean;
        count: any;
        brokenAt?: undefined;
        record?: undefined;
    }>;
}
export class InMemoryAuditStore {
    _records: any[];
    append(record: any): Promise<void>;
    query(filters: any, limit: any): Promise<any[]>;
}
export function auditMiddleware(auditLogger: any): (req: any, res: any, next: any) => void;
//# sourceMappingURL=audit-log.d.ts.map