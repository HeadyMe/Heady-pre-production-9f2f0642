export class BudgetService {
    constructor(opts?: {});
    db: any;
    cache: Map<any, any>;
    cacheTTL: any;
    usageLog: any[];
    _initialized: boolean;
    /**
     * Initialize budget tables in Neon if they don't exist.
     */
    init(): Promise<void>;
    /**
     * Get or create a budget for a given scope.
     */
    getBudget(scopeType: any, scopeId: any, period?: string): Promise<any>;
    /**
     * Check if a request fits within the remaining budget.
     */
    checkBudget(scopeType: any, scopeId: any, estimatedCostUsd: any): Promise<{
        allowed: boolean;
        reason: string;
        remaining?: undefined;
        budget?: undefined;
        spent?: undefined;
        required?: undefined;
        suggestion?: undefined;
    } | {
        allowed: boolean;
        remaining: number;
        budget: any;
        spent: any;
        reason?: undefined;
        required?: undefined;
        suggestion?: undefined;
    } | {
        allowed: boolean;
        remaining: number;
        required: any;
        budget: any;
        spent: any;
        reason: string;
        suggestion: string;
    }>;
    /**
     * Record usage and update the budget.
     */
    recordUsage(scopeType: any, scopeId: any, actualCostUsd: any, details?: {}): Promise<boolean>;
    /**
     * Get usage summary for a scope.
     */
    getUsageSummary(scopeType: any, scopeId: any): {
        totalCost: number;
        totalTokens: any;
        requestCount: number;
        byModel: {};
        recentEntries: any[];
    };
    /**
     * Get overall budget health.
     */
    getHealth(): Promise<{
        status: string;
        mode: string;
        cachedBudgets: number;
        usageLogSize: number;
        systemBudget: any;
    }>;
    _queryBudget(scopeType: any, scopeId: any, period: any): Promise<any>;
    _updateSpent(scopeType: any, scopeId: any, amount: any): Promise<void>;
}
export function budgetRoutes(app: any, budgetService: any): void;
export namespace DEFAULT_BUDGETS {
    namespace system {
        let daily: number;
        let monthly: number;
    }
    namespace user {
        let daily_1: number;
        export { daily_1 as daily };
        let monthly_1: number;
        export { monthly_1 as monthly };
    }
    namespace service {
        let daily_2: number;
        export { daily_2 as daily };
        let monthly_2: number;
        export { monthly_2 as monthly };
    }
    namespace battle {
        let daily_3: number;
        export { daily_3 as daily };
        let monthly_3: number;
        export { monthly_3 as monthly };
    }
}
//# sourceMappingURL=budget-service.d.ts.map