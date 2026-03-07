export function createRBACMiddleware(opts?: {}): (requiredPermission: any) => (req: any, res: any, next: any) => Promise<any>;
export function requireRole(minRole: any): (req: any, res: any, next: any) => any;
export function tenantFilter(query: any, tenantId: any): any;
export namespace ROLES {
    namespace admin {
        let level: number;
        let permissions: string[];
    }
    namespace operator {
        let level_1: number;
        export { level_1 as level };
        let permissions_1: string[];
        export { permissions_1 as permissions };
    }
    namespace developer {
        let level_2: number;
        export { level_2 as level };
        let permissions_2: string[];
        export { permissions_2 as permissions };
    }
    namespace analyst {
        let level_3: number;
        export { level_3 as level };
        let permissions_3: string[];
        export { permissions_3 as permissions };
    }
    namespace viewer {
        let level_4: number;
        export { level_4 as level };
        let permissions_4: string[];
        export { permissions_4 as permissions };
    }
    namespace service {
        let level_5: number;
        export { level_5 as level };
        let permissions_5: string[];
        export { permissions_5 as permissions };
    }
}
export function extractBearerToken(req: any): any;
//# sourceMappingURL=auth-rbac.d.ts.map