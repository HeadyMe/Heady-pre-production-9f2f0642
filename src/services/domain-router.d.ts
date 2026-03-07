/**
 * Resolve which UI to project based on the incoming hostname.
 *
 * @param {string} hostname - The incoming request hostname
 * @returns {Object} The matched projection config, or the default fallback
 */
export function resolveProjection(hostname: string): Object;
/**
 * Express middleware that injects the domain projection into req.headyProjection.
 */
export function domainRoutingMiddleware(req: any, _res: any, next: any): void;
/**
 * Register a custom domain → UI mapping at runtime.
 */
export function registerDomain(hostname: any, uiId: any, module: any, category?: string): void;
/**
 * Get all registered domain projections.
 */
export function getDomainMatrix(): ({
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
} | {
    uiId: string;
    module: string;
    category: string;
    hostname: string;
})[];
export function domainRouterRoutes(app: any): void;
export const DOMAIN_PROJECTIONS: {
    'headymcp.com': {
        uiId: string;
        module: string;
        category: string;
    };
    'www.headymcp.com': {
        uiId: string;
        module: string;
        category: string;
    };
    'headysystems.com': {
        uiId: string;
        module: string;
        category: string;
    };
    'www.headysystems.com': {
        uiId: string;
        module: string;
        category: string;
    };
    'headyconnection.org': {
        uiId: string;
        module: string;
        category: string;
    };
    'www.headyconnection.org': {
        uiId: string;
        module: string;
        category: string;
    };
    'headyme.com': {
        uiId: string;
        module: string;
        category: string;
    };
    'www.headyme.com': {
        uiId: string;
        module: string;
        category: string;
    };
    'ai.headyme.com': {
        uiId: string;
        module: string;
        category: string;
    };
    'heady.headyme.com': {
        uiId: string;
        module: string;
        category: string;
    };
    'api.headyme.com': {
        uiId: string;
        module: string;
        category: string;
    };
    'demo.headyme.com': {
        uiId: string;
        module: string;
        category: string;
    };
    'headyos.com': {
        uiId: string;
        module: string;
        category: string;
    };
    'www.headyos.com': {
        uiId: string;
        module: string;
        category: string;
    };
    'headyapi.com': {
        uiId: string;
        module: string;
        category: string;
    };
    'www.headyapi.com': {
        uiId: string;
        module: string;
        category: string;
    };
    'headybot.com': {
        uiId: string;
        module: string;
        category: string;
    };
    'www.headybot.com': {
        uiId: string;
        module: string;
        category: string;
    };
    'headyio.com': {
        uiId: string;
        module: string;
        category: string;
    };
    'www.headyio.com': {
        uiId: string;
        module: string;
        category: string;
    };
    'headybuddy.org': {
        uiId: string;
        module: string;
        category: string;
    };
    'www.headybuddy.org': {
        uiId: string;
        module: string;
        category: string;
    };
    'headybuddy.com': {
        uiId: string;
        module: string;
        category: string;
    };
    localhost: {
        uiId: string;
        module: string;
        category: string;
    };
};
//# sourceMappingURL=domain-router.d.ts.map