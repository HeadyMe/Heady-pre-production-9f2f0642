export class HeadyConductor extends EventEmitter<[never]> {
    constructor();
    bees: Map<any, any>;
    taskQueue: any[];
    activeExecutions: Map<any, any>;
    executionLog: any[];
    heartbeatTimer: NodeJS.Timeout | null;
    totalDispatched: number;
    totalCompleted: number;
    totalFailed: number;
    registerBee(beeId: any, bee: any): void;
    unregisterBee(beeId: any): void;
    /**
     * Dispatch a task to the best-matched bee.
     * @param {string} taskType - Type hint for routing (e.g., 'research', 'code', 'ops')
     * @param {object} payload  - Task payload (passed as context to bee worker)
     * @param {object} opts     - { priority, timeout, beeId }
     * @returns {Promise<object>} Execution result
     */
    dispatch(taskType: string, payload: object, opts?: object): Promise<object>;
    _executeBee(bee: any, payload: any): Promise<any>;
    startHeartbeat(): void;
    stopHeartbeat(): void;
    /**
     * Priority dispatch — bypasses the task queue entirely.
     * Used for admin/owner triggered tasks that must not wait.
     * Allocates maximum timeout (10 min) and forces immediate execution.
     *
     * @param {string} taskType - Task type hint
     * @param {object} payload  - Task payload
     * @returns {Promise<object>} Execution result
     */
    adminDispatch(taskType: string, payload: object): Promise<object>;
    getStatus(): {
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
}
export const conductor: HeadyConductor;
export function registerConductorRoutes(app: any): void;
export namespace PRIORITY_MODES {
    let STANDARD: string;
    let ADMIN: string;
}
import EventEmitter = require("events");
//# sourceMappingURL=heady-conductor.d.ts.map