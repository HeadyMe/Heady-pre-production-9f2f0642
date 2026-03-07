export class RBACVendor {
    activeTokens: Map<any, any>;
    /**
     * @param {string} agentId e.g., 'procurement-agent-alpha'
     * @param {string[]} scopes e.g., ['system:read', 'salesforce:query']
     * @param {number} ttlMs Default 5 minutes (300000 ms)
     */
    issueTemporaryToken(agentId: string, scopes: string[], ttlMs?: number): string;
    validateToken(token: any, requiredScope: any): {
        valid: boolean;
        reason: string;
        agentId?: undefined;
    } | {
        valid: boolean;
        agentId: any;
        reason?: undefined;
    };
    revokeToken(token: any): void;
    _audit(entry: any): void;
}
export function getRBACVendor(): any;
//# sourceMappingURL=rbac-vendor.d.ts.map