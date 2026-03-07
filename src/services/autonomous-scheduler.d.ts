export function start(): void;
export function stop(): void;
/**
 * Trigger a schedule immediately (bypass interval timer).
 */
export function triggerNow(scheduleId: any): Promise<any>;
/**
 * Register a custom schedule.
 */
export function registerSchedule(config: any): void;
/**
 * Register a custom handler function.
 */
export function registerHandler(name: any, fn: any): void;
export function getSchedulerHealth(): {
    running: boolean;
    totalSchedules: number;
    activeTimers: number;
    totalExecutions: number;
    recentExecutions: any[];
    schedules: {
        id: any;
        description: any;
        enabled: any;
        priority: any;
        intervalMs: any;
        lastRun: any;
        nextRun: any;
        runCount: any;
    }[];
};
export function schedulerRoutes(app: any): void;
export const BUILT_IN_SCHEDULES: {
    id: string;
    description: string;
    cronExpression: string;
    intervalMs: number;
    handler: string;
    priority: string;
    enabled: boolean;
}[];
//# sourceMappingURL=autonomous-scheduler.d.ts.map