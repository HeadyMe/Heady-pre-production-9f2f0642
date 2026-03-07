/**
 * Returns all swarm configs sorted by priorityLevel ascending (lowest = highest priority).
 *
 * @returns {HeadySwarmConfig[]}
 */
export function getSwarmsByPriority(): HeadySwarmConfig[];
/**
 * Returns all swarm configs sorted by Fibonacci allocation descending.
 *
 * @returns {HeadySwarmConfig[]}
 */
export function getSwarmsByAllocation(): HeadySwarmConfig[];
/**
 * Returns the swarm config responsible for a given HeadyBee template ID.
 *
 * @param {string} templateId
 * @returns {HeadySwarmConfig|null}
 */
export function getSwarmForTemplate(templateId: string): HeadySwarmConfig | null;
/**
 * Returns all communication channels between two swarms (bidirectional lookup).
 *
 * @param {string} swarmIdA
 * @param {string} swarmIdB
 * @returns {object[]} Channel descriptors
 */
export function getChannelsBetween(swarmIdA: string, swarmIdB: string): object[];
/**
 * Validates that the total Fibonacci allocation across all swarms sums to
 * the expected Fibonacci-aligned total. Emits warnings for mis-alignments.
 *
 * @returns {{ valid: boolean, totalAllocation: number, warning?: string }}
 */
export function validateFibonacciAllocation(): {
    valid: boolean;
    totalAllocation: number;
    warning?: string;
};
/**
 * Complete HeadySwarm UI configuration registry.
 * Keyed by swarmId.
 *
 * @type {Object.<string, HeadySwarmConfig>}
 */
export const HEADY_SWARM_CONFIGS: {
    [x: string]: HeadySwarmConfig;
};
export type HeadySwarmConfig = {
    swarmId: string;
    name: string;
    description: string;
    /**
     * - Raw Fibonacci number
     */
    fibAllocation: number;
    /**
     * - Effective resource allocation percentage
     */
    allocationPct: number;
    /**
     * - 1 = highest priority
     */
    priorityLevel: number;
    /**
     * - UI_REGION value
     */
    uiLayoutRegion: string;
    /**
     * - HeadyBee template IDs managed by this swarm
     */
    includedTemplates: string[];
    workerAssignments: object[];
    interSwarmChannels: object[];
    autoScalingRules: object[];
    healthChecks: object[];
    uiWidgetRegions: object;
    slaTargets: object;
};
//# sourceMappingURL=headyswarm-ui-configs.d.ts.map