export class AutonomousEngine extends EventEmitter<[never]> {
    /**
     * @param {object} opts
     * @param {string}  [opts.mode]            - Initial mode ('user-present'|'user-absent')
     * @param {object}  [opts.scheduler]       - HeadyScheduler instance
     * @param {number}  [opts.cycleIntervalMs] - Loop tick interval
     * @param {number}  [opts.maxConcurrent]   - Max parallel tasks
     */
    constructor(opts?: {
        mode?: string | undefined;
        scheduler?: object | undefined;
        cycleIntervalMs?: number | undefined;
        maxConcurrent?: number | undefined;
    });
    mode: string;
    cycleIntervalMs: number;
    maxConcurrent: number;
    _scheduler: any;
    /** @type {Map<string, QueuedTask>} taskId → task */
    _queue: Map<string, QueuedTask>;
    /** @type {Map<string, Promise>} taskId → running promise */
    _running: Map<string, Promise<any>>;
    _cycleTimer: NodeJS.Timeout | null;
    _cycleCount: number;
    _paused: boolean;
    _stats: {
        tasksEnqueued: number;
        tasksCompleted: number;
        tasksFailed: number;
        tasksSkipped: number;
        cyclesRun: number;
        startedAt: null;
    };
    _builtInTasks: ({
        name: string;
        type: string;
        priority: 1;
        intervalMs: number;
        lastRun: null;
        run: () => Promise<{
            action: string;
            result: string;
        }>;
    } | {
        name: string;
        type: string;
        priority: 2;
        intervalMs: number;
        lastRun: null;
        run: () => Promise<{
            action: string;
            result: string;
        }>;
    } | {
        name: string;
        type: string;
        priority: 4;
        intervalMs: number;
        lastRun: null;
        run: () => Promise<{
            action: string;
            result: string;
        }>;
    } | {
        name: string;
        type: string;
        priority: 5;
        intervalMs: number;
        lastRun: null;
        run: () => Promise<{
            action: string;
            result: string;
        }>;
    } | {
        name: string;
        type: string;
        priority: 7;
        intervalMs: number;
        lastRun: null;
        run: () => Promise<{
            action: string;
            result: string;
        }>;
    })[];
    start(): this;
    stop(): void;
    pause(): void;
    resume(): void;
    /**
     * Switch operating mode (called by cognitive-runtime-governor).
     * @param {'user-present'|'user-absent'} mode
     */
    setMode(mode: "user-present" | "user-absent"): void;
    get resourceCap(): any;
    /**
     * Enqueue a background task.
     * @param {object} task
     * @param {string}   task.id          - Unique ID
     * @param {string}   task.type        - Task type (from TASK_PRIORITIES keys)
     * @param {Function} task.run         - async function to execute
     * @param {number}   [task.priority]  - Lower = higher priority (default from type)
     * @param {string}   [task.name]
     * @param {object}   [task.meta]
     * @returns {QueuedTask}
     */
    enqueue(task: {
        id: string;
        type: string;
        run: Function;
        priority?: number | undefined;
        name?: string | undefined;
        meta?: object | undefined;
    }): QueuedTask;
    /**
     * Cancel a pending task.
     */
    cancel(taskId: any): boolean;
    _cycle(): Promise<void>;
    _availableSlots(): number;
    _runTask(task: any): Promise<void>;
    _injectBuiltIns(): void;
    _schedulerSetup(): void;
    _selfImprovementCycle(): Promise<void>;
    getStatus(): {
        mode: string;
        resourceCap: string;
        paused: boolean;
        running: number;
        queued: number;
        stats: {
            tasksEnqueued: number;
            tasksCompleted: number;
            tasksFailed: number;
            tasksSkipped: number;
            cyclesRun: number;
            startedAt: null;
        };
        queue: {
            id: any;
            name: any;
            type: any;
            priority: any;
            status: any;
            enqueuedAt: any;
        }[];
    };
}
export const MODES: Readonly<{
    USER_PRESENT: "user-present";
    USER_ABSENT: "user-absent";
}>;
export const TASK_PRIORITIES: Readonly<{
    ERROR_REPAIR: 1;
    PERFORMANCE_OPT: 2;
    SECURITY_SCAN: 3;
    DOCS_SYNC: 4;
    TRAINING: 5;
    CACHE_WARMUP: 6;
    HOUSEKEEPING: 7;
}>;
export const TASK_STATUS: Readonly<{
    PENDING: "pending";
    RUNNING: "running";
    COMPLETED: "completed";
    FAILED: "failed";
    SKIPPED: "skipped";
    CANCELLED: "cancelled";
}>;
export const RESOURCE_CAPS: {
    "user-absent": number;
    "user-present": number;
};
import { EventEmitter } from "events";
//# sourceMappingURL=autonomous-engine.d.ts.map