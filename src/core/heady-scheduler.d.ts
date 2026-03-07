export type ParsedCron = {
    seconds: Set<number>;
    minutes: Set<number>;
    hours: Set<number>;
    dayOfMonth: Set<number>;
    month: Set<number>;
    dayOfWeek: Set<number>;
};
export type Task = {
    /**
     * - Unique task identifier
     */
    name: string;
    /**
     * - Async task function
     */
    fn: Function;
    type: "interval" | "cron" | "once";
    /**
     * - For type='interval'
     */
    intervalMs?: number | undefined;
    /**
     * - For type='cron'
     */
    cron?: ParsedCron | undefined;
    /**
     * - Epoch ms for type='once'
     */
    runAt?: number | undefined;
    /**
     * - Whether the task is active
     */
    running: boolean;
    /**
     * - How many times it has run
     */
    runCount: number;
    /**
     * - Epoch ms of last run
     */
    lastRunAt: number | null;
    /**
     * - Last execution error
     */
    lastError: Error | null;
    /**
     * - Internal timer handle
     */
    _handle: NodeJS.Timeout | null;
};
/**
 * @typedef {Object} Task
 * @property {string} name - Unique task identifier
 * @property {Function} fn - Async task function
 * @property {'interval'|'cron'|'once'} type
 * @property {number} [intervalMs] - For type='interval'
 * @property {ParsedCron} [cron] - For type='cron'
 * @property {number} [runAt] - Epoch ms for type='once'
 * @property {boolean} running - Whether the task is active
 * @property {number} runCount - How many times it has run
 * @property {number|null} lastRunAt - Epoch ms of last run
 * @property {Error|null} lastError - Last execution error
 * @property {NodeJS.Timeout|null} _handle - Internal timer handle
 */
export class HeadyScheduler {
    /** @type {Map<string, Task>} */
    _tasks: Map<string, Task>;
    /** @type {NodeJS.Timeout|null} */
    _cronTicker: NodeJS.Timeout | null;
    /**
     * Schedules a task to run at a fixed interval.
     * @param {string} name - Unique task name
     * @param {number} intervalMs - Interval in milliseconds
     * @param {Function} fn - Async task function
     * @param {Object} [options={}]
     * @param {boolean} [options.runImmediately=false] - Run once right away
     * @returns {Task}
     */
    every(name: string, intervalMs: number, fn: Function, options?: {
        runImmediately?: boolean | undefined;
    }): Task;
    /**
     * Schedules a task using a cron expression.
     * Polling resolution is 1 second.
     *
     * @param {string} name - Unique task name
     * @param {string} expression - Cron expression (5 or 6 fields)
     * @param {Function} fn - Async task function
     * @returns {Task}
     */
    cron(name: string, expression: string, fn: Function): Task;
    /**
     * Schedules a task to run once after a delay.
     * @param {string} name
     * @param {number} delayMs - Delay in milliseconds
     * @param {Function} fn
     * @returns {Task}
     */
    once(name: string, delayMs: number, fn: Function): Task;
    /**
     * Executes a task function with error handling.
     * @param {Task} task
     */
    _execute(task: Task): Promise<void>;
    /**
     * Starts the 1-second polling ticker for cron tasks.
     */
    _ensureCronTicker(): void;
    /**
     * Pauses a task (won't run until resumed).
     * @param {string} name
     */
    pause(name: string): void;
    /**
     * Resumes a paused task.
     * @param {string} name
     */
    resume(name: string): void;
    /**
     * Removes and cancels a scheduled task.
     * @param {string} name
     */
    remove(name: string): void;
    /**
     * Stops all tasks and clears all timers.
     */
    destroy(): void;
    /**
     * Returns a snapshot of all registered tasks.
     * @returns {Object[]}
     */
    list(): Object[];
    /** @private */
    private _getTask;
}
/** Global default scheduler instance. */
export const defaultScheduler: HeadyScheduler;
/**
 * Creates a new isolated scheduler instance.
 * @returns {HeadyScheduler}
 */
export function createScheduler(): HeadyScheduler;
/**
 * @typedef {Object} ParsedCron
 * @property {Set<number>} seconds
 * @property {Set<number>} minutes
 * @property {Set<number>} hours
 * @property {Set<number>} dayOfMonth
 * @property {Set<number>} month
 * @property {Set<number>} dayOfWeek
 */
/**
 * Parses a cron expression string (5 or 6 fields).
 * 6 fields: second minute hour dayOfMonth month dayOfWeek
 * 5 fields: minute hour dayOfMonth month dayOfWeek (second defaults to 0)
 *
 * @param {string} expression
 * @returns {ParsedCron}
 */
export function parseCronExpression(expression: string): ParsedCron;
//# sourceMappingURL=heady-scheduler.d.ts.map