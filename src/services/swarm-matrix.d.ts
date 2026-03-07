/**
 * Boot the swarm matrix — load and validate the Master Matrix.
 */
export function boot(): {
    totalSwarms: number;
    totalBees: number;
    active?: undefined;
    standby?: undefined;
    sleeper?: undefined;
    categories?: undefined;
    ok: boolean;
    error?: undefined;
} | {
    totalSwarms: any;
    totalBees: any;
    active: any;
    standby: any;
    sleeper: any;
    categories: any;
    ok: boolean;
    error?: undefined;
} | {
    ok: boolean;
    error: any;
};
/**
 * Get the full matrix (for Colab Overmind injection).
 */
export function getMatrix(): any;
/**
 * Get matrix statistics.
 */
export function getStats(): {
    totalSwarms: number;
    totalBees: number;
    active?: undefined;
    standby?: undefined;
    sleeper?: undefined;
    categories?: undefined;
} | {
    totalSwarms: any;
    totalBees: any;
    active: any;
    standby: any;
    sleeper: any;
    categories: any;
};
/**
 * Look up a specific bee by class name.
 */
export function getBee(className: any): any;
/**
 * Get all bees in a specific swarm.
 */
export function getSwarm(swarmName: any): any;
/**
 * Activate a standby/sleeper bee.
 */
export function activateBee(className: any): {
    ok: boolean;
    error: string;
    bee?: undefined;
    status?: undefined;
} | {
    ok: boolean;
    bee: any;
    status: string;
    error?: undefined;
};
/**
 * Record a task completion for a bee.
 */
export function recordBeeTask(className: any): void;
/**
 * Get bees by category.
 */
export function getBeesByCategory(category: any): any;
/**
 * Express API routes.
 */
export function swarmMatrixRoutes(app: any): void;
//# sourceMappingURL=swarm-matrix.d.ts.map