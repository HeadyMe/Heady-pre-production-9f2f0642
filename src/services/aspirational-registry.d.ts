/**
 * Boot the registry — load all task files and unify.
 */
export function boot(): void;
export function getAllTasks(): any[];
export function getBySwarm(swarmName: any): any[];
export function getByCategory(cat: any): any[];
export function getByPool(pool: any): any[];
export function getByPriority(priority: any): any[];
export function getById(id: any): any;
export function search(query: any): any[];
export function getStats(): {
    totalTasks: number;
    sourceFiles: number;
    categories: {};
    swarmDistribution: {};
    pools: {
        hot: number;
        warm: number;
        cold: number;
    };
    priorities: {
        CRITICAL: number;
        HIGH: number;
        MEDIUM: number;
        LOW: number;
    };
};
export function aspirationalRoutes(app: any): void;
//# sourceMappingURL=aspirational-registry.d.ts.map