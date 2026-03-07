export const TIERS: {
    free: {
        name: string;
        price: number;
        billing: string;
        seats: number;
        limits: {
            requestsPerMinute: number;
            requestsPerDay: number;
            maxTokensPerRequest: number;
            concurrentRequests: number;
        };
        models: string[];
        features: string[];
        support: string;
        badge: string;
    };
    "pro-individual": {
        name: string;
        price: number;
        billing: string;
        seats: number;
        limits: {
            requestsPerMinute: number;
            requestsPerDay: number;
            maxTokensPerRequest: number;
            concurrentRequests: number;
        };
        models: string[];
        features: string[];
        support: string;
        badge: string;
    };
    "pro-business": {
        name: string;
        price: number;
        billing: string;
        seats: null;
        limits: {
            requestsPerMinute: number;
            requestsPerDay: number;
            maxTokensPerRequest: number;
            concurrentRequests: number;
        };
        models: string[];
        features: string[];
        support: string;
        badge: string;
    };
    max: {
        name: string;
        price: number;
        billing: string;
        seats: number;
        limits: {
            requestsPerMinute: number;
            requestsPerDay: number;
            maxTokensPerRequest: number;
            concurrentRequests: number;
        };
        models: string[];
        features: string[];
        support: string;
        badge: string;
    };
    family: {
        name: string;
        price: number;
        billing: string;
        seats: number;
        limits: {
            requestsPerMinute: number;
            requestsPerDay: number;
            maxTokensPerRequest: number;
            concurrentRequests: number;
        };
        models: string[];
        features: string[];
        support: string;
        badge: string;
    };
    "enterprise-max": {
        name: string;
        price: number;
        billing: string;
        seats: null;
        limits: {
            requestsPerMinute: number;
            requestsPerDay: number;
            maxTokensPerRequest: number;
            concurrentRequests: number;
        };
        models: string[];
        features: string[];
        support: string;
        badge: string;
    };
    "enterprise-payg": {
        name: string;
        price: null;
        billing: string;
        seats: null;
        limits: {
            requestsPerMinute: number;
            requestsPerDay: number;
            maxTokensPerRequest: number;
            concurrentRequests: number;
        };
        models: string[];
        features: string[];
        support: string;
        badge: string;
    };
    nonprofit: {
        name: string;
        price: null;
        billing: string;
        seats: null;
        description: string;
        limits: {
            requestsPerMinute: number;
            requestsPerDay: number;
            maxTokensPerRequest: number;
            concurrentRequests: number;
        };
        models: string[];
        features: string[];
        support: string;
        badge: string;
    };
    internal: {
        name: string;
        price: number;
        billing: string;
        seats: null;
        limits: {
            requestsPerMinute: number;
            requestsPerDay: number;
            maxTokensPerRequest: number;
            concurrentRequests: number;
        };
        models: string[];
        features: string[];
        support: string;
        badge: string;
    };
};
export function tierMiddleware(req: any, res: any, next: any): any;
export function registerTierRoutes(app: any): void;
export function generateApiKey(tier: any, meta?: {}): {
    key: string;
    tier: any;
    owner: any;
    email: any;
    name: any;
    org: any;
    created: string;
    active: boolean;
    usage: {
        totalRequests: number;
        todayRequests: number;
        lastReset: string;
    };
};
export function validateKey(apiKey: any): {
    valid: boolean;
    error: string;
    tier?: undefined;
    tierConfig?: undefined;
    record?: undefined;
} | {
    valid: boolean;
    tier: any;
    tierConfig: any;
    record: any;
    error?: undefined;
};
export function revokeKey(apiKey: any): boolean;
export function checkRateLimit(apiKey: any): {
    allowed: boolean;
    error: string | undefined;
    tier?: undefined;
    retryAfterMs?: undefined;
    limit?: undefined;
    used?: undefined;
    badge?: undefined;
    remaining?: undefined;
    models?: undefined;
    features?: undefined;
} | {
    allowed: boolean;
    error: string;
    tier: any;
    retryAfterMs: number;
    limit: any;
    used: any;
    badge?: undefined;
    remaining?: undefined;
    models?: undefined;
    features?: undefined;
} | {
    allowed: boolean;
    tier: any;
    badge: any;
    remaining: {
        minute: number;
        day: number;
    };
    models: any;
    features: any;
    error?: undefined;
    retryAfterMs?: undefined;
    limit?: undefined;
    used?: undefined;
};
export function createInvitation(email: any, tier?: string, meta?: {}): {
    id: `${string}-${string}-${string}-${string}-${string}`;
    email: any;
    tier: string;
    token: string;
    invitedBy: any;
    message: any;
    status: string;
    created: string;
    expiresAt: string;
    acceptUrl: string;
};
export function acceptInvitation(token: any): {
    success: boolean;
    error: string;
    apiKey?: undefined;
    tier?: undefined;
    email?: undefined;
} | {
    success: boolean;
    apiKey: string;
    tier: any;
    email: any;
    error?: undefined;
};
export function sendInvitationEmail(invite: any): {
    to: any;
    from: string;
    subject: string;
    html: string;
};
export function createInquiry(data: any): {
    id: `${string}-${string}-${string}-${string}-${string}`;
    name: any;
    email: any;
    company: any;
    role: any;
    teamSize: any;
    useCase: any;
    message: any;
    status: string;
    created: string;
};
//# sourceMappingURL=subscription-tiers.d.ts.map