/**
 * Auto-discover all bee worker modules in this directory.
 * Each module that exports a `domain` and `getWork()` is registered.
 */
export function discover(): number;
/**
 * Get blast-compatible work arrays for a given domain.
 * HeadyBees calls this to get the work, then blast() decides parallelism.
 *
 * @param {string} domain - The domain to get work for (e.g., 'brain-providers')
 * @param {Object} context - Context passed to the work functions
 * @returns {Function[]} Array of work functions for HeadyBees.blast()
 */
export function getWork(domain: string, context?: Object): Function[];
/**
 * Get all registered domains with their metadata.
 */
export function listDomains(): {
    domain: any;
    file: any;
    description: any;
    priority: any;
}[];
/**
 * Get all work from all domains — for full-swarm blasts.
 * HeadyBees can blast ALL available work dynamically.
 *
 * @param {Object} context - Context passed to all work functions
 * @returns {{ name: string, work: Function[], urgency: number }[]}
 */
export function getAllWork(context?: Object): {
    name: string;
    work: Function[];
    urgency: number;
}[];
/**
 * Get health status of the bee registry.
 * Shows discovery stats: loaded, failed, total.
 */
export function getHealth(): {
    domains: any[];
    loaded: number;
    failed: number;
    failedFiles: never[];
    discoveredAt: null;
    registered: number;
};
declare const _registry: Map<any, any>;
export declare let createBee: (domain: string, config?: {
    description: string;
    priority: number;
    workers: any[];
    persist: boolean;
}) => Object;
export declare let spawnBee: (name: string, work: Function | Function[], priority?: number) => Object;
export declare let createWorkUnit: (domain: string, name: string, fn: Function) => Object;
export declare let createFromTemplate: (template: string, config?: Object) => Object;
export declare let listDynamicBees: () => {
    domain: any;
    description: any;
    priority: any;
    type: string;
    createdAt: any;
}[];
export declare let dissolveBee: (domain: any) => void;
export { _registry as registry };
//# sourceMappingURL=registry.d.ts.map