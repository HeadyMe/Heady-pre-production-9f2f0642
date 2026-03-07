/**
 * Create a full bee domain dynamically at runtime.
 * Registers it in-memory AND optionally persists to disk for future boots.
 *
 * @param {string} domain - Domain name for the bee
 * @param {Object} config - Bee configuration
 * @param {string} config.description - What this bee does
 * @param {number} config.priority - Urgency (0.0 - 1.0)
 * @param {Array} config.workers - Array of { name, fn } work units
 * @param {boolean} config.persist - If true, writes a bee file to disk (default: false)
 * @returns {Object} The registered bee entry
 */
export function createBee(domain: string, config?: {
    description: string;
    priority: number;
    workers: any[];
    persist: boolean;
}): Object;
/**
 * Spawn a single-purpose ephemeral bee for one-off tasks.
 * Lives only in memory for this process lifecycle.
 *
 * @param {string} name - Name for this bee
 * @param {Function|Function[]} work - Work function(s) to execute
 * @param {number} priority - Urgency (default: 0.8)
 * @returns {Object} The ephemeral bee entry
 */
export function spawnBee(name: string, work: Function | Function[], priority?: number): Object;
/**
 * Add a single work unit to an existing domain.
 * If the domain doesn't exist, creates it.
 *
 * @param {string} domain - Domain to add work to
 * @param {string} name - Name of the work unit
 * @param {Function} fn - The work function
 * @returns {Object} The updated/created bee entry
 */
export function createWorkUnit(domain: string, name: string, fn: Function): Object;
/**
 * Create a bee from a template/pattern.
 * Useful for spawning service-monitoring bees, health-check bees, etc.
 *
 * @param {string} template - Template name ('health-check', 'monitor', 'processor', 'scanner')
 * @param {Object} config - Template-specific configuration
 * @returns {Object} The created bee entry
 */
export function createFromTemplate(template: string, config?: Object): Object;
/**
 * Create a coordinated swarm of bees with an orchestration policy.
 * Swarms run multiple bees together with consensus collection.
 *
 * @param {string} name - Swarm name
 * @param {Array} beeConfigs - Array of { domain, config } for each bee
 * @param {Object} policy - Orchestration policy
 * @param {string} policy.mode - 'parallel', 'sequential', or 'pipeline'
 * @param {boolean} policy.requireConsensus - If true, all bees must succeed
 * @param {number} policy.timeoutMs - Max execution time per bee (default: 30000)
 * @returns {Object} The swarm bee entry
 */
export function createSwarm(name: string, beeConfigs?: any[], policy?: {
    mode: string;
    requireConsensus: boolean;
    timeoutMs: number;
}): Object;
/**
 * Get all dynamic and ephemeral bees.
 */
export function listDynamicBees(): {
    domain: any;
    description: any;
    priority: any;
    type: string;
    createdAt: any;
}[];
/**
 * Dissolve (remove) a dynamic or ephemeral bee.
 */
export function dissolveBee(domain: any): void;
declare const _dynamicRegistry: Map<any, any>;
declare const _ephemeralBees: Map<any, any>;
export { _dynamicRegistry as dynamicRegistry, _ephemeralBees as ephemeralBees };
//# sourceMappingURL=bee-factory.d.ts.map