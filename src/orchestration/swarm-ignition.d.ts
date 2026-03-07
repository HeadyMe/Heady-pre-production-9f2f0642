/**
 * Ignite the swarm — register all template bees with the conductor
 * and start autonomous maintenance cycles.
 *
 * @param {Object} options - { enablePruner, enableTester, enableEmbedder }
 * @returns {Object} Ignition result
 */
export function igniteSwarm(options?: Object): Object;
/**
 * Shutdown the swarm — stop all cycles and unregister bees.
 */
export function shutdownSwarm(): {
    ok: boolean;
    shutdownAt: string;
};
/**
 * Launch a one-shot swarm of all bees using createSwarm.
 * Useful for on-demand full-system health checks.
 */
export function launchFullSwarm(): Object;
/**
 * Get the current swarm status.
 */
export function getSwarmStatus(): {
    ignited: boolean;
    ignitedAt: null;
    registeredBees: never[];
    activeCycles: string[];
    totalCyclesRun: number;
    recentCycles: never[];
    conductorStatus: {
        bees: {};
        totalRegistered: number;
        totalDispatched: number;
        totalCompleted: number;
        totalFailed: number;
        activeExecutions: number;
        recentExecutions: any[];
        heartbeatActive: boolean;
        heartbeatIntervalMs: number;
        priorityModes: {
            STANDARD: string;
            ADMIN: string;
        };
    };
};
export function swarmIgnitionRoutes(app: any): void;
export namespace CYCLES {
    let PRUNER_INTERVAL_MS: number;
    let TESTER_INTERVAL_MS: number;
    let EMBEDDER_INTERVAL_MS: number;
}
//# sourceMappingURL=swarm-ignition.d.ts.map