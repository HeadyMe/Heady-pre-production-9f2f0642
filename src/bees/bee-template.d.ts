export class BaseBee extends EventEmitter<[never]> {
    /**
     * @param {object} config
     * @param {string} config.domain           - Bee domain (e.g. 'coding', 'research')
     * @param {string} [config.id]             - Unique bee ID (auto-generated if omitted)
     * @param {string} [config.name]           - Human-readable name
     * @param {string} [config.type]           - 'persistent' | 'ephemeral'
     * @param {number} [config.heartbeatMs]    - Heartbeat interval in ms
     * @param {number} [config.taskTimeoutMs]  - Per-task timeout in ms
     * @param {object} [config.conductor]      - Reference to HeadyConductor for routing
     */
    constructor(config?: {
        domain: string;
        id?: string | undefined;
        name?: string | undefined;
        type?: string | undefined;
        heartbeatMs?: number | undefined;
        taskTimeoutMs?: number | undefined;
        conductor?: object | undefined;
    });
    id: string;
    domain: string;
    name: string;
    type: string;
    metadata: any;
    _lifecycle: string;
    _taskQueue: TaskQueue;
    _currentTask: any;
    _heartbeatIntervalMs: number;
    _taskTimeoutMs: number;
    _heartbeatTimer: NodeJS.Timeout | null;
    _lastHeartbeat: number | null;
    _conductor: object | null;
    _stats: {
        tasksCompleted: number;
        tasksFailed: number;
        tasksSkipped: number;
        uptime: number;
        startedAt: null;
    };
    _processing: boolean;
    _stopLoop: boolean;
    get lifecycle(): string;
    _setState(newState: any): void;
    /**
     * Initialize bee (called before start).
     * Override onInit() for domain-specific setup.
     */
    init(): Promise<void>;
    /**
     * Start the bee (begin processing task queue).
     */
    start(): Promise<void>;
    /**
     * Pause the bee (suspend task processing, keep queue).
     */
    pause(): Promise<void>;
    /**
     * Resume from paused state.
     */
    resume(): Promise<void>;
    /**
     * Terminate the bee (graceful shutdown).
     */
    terminate(reason?: string): Promise<void>;
    onInit(): Promise<void>;
    onStart(): Promise<void>;
    onPause(): Promise<void>;
    onResume(): Promise<void>;
    onTerminate(): Promise<void>;
    /**
     * Execute a single task. Subclasses MUST override this.
     * @param {object} task
     * @returns {Promise<any>} result
     */
    executeTask(task: object): Promise<any>;
    enqueue(task: any): any;
    cancelTask(taskId: any): boolean;
    _processLoop(): Promise<void>;
    _withTimeout(fn: any, ms: any, message: any): Promise<any>;
    _startHeartbeat(): void;
    _stopHeartbeat(): void;
    _heartbeat(): void;
    routeTask(task: any): Promise<any>;
    getStatus(): {
        id: string;
        name: string;
        domain: string;
        type: string;
        lifecycle: string;
        queueSize: number;
        currentTask: any;
        lastHeartbeat: number | null;
        stats: {
            tasksCompleted: number;
            tasksFailed: number;
            tasksSkipped: number;
            uptime: number;
            startedAt: null;
        };
        metadata: any;
    };
    getQueue(): any[];
}
export class TaskQueue {
    constructor(maxSize?: number);
    _maxSize: number;
    _queue: any[];
    enqueue(task: any): any;
    dequeue(): any;
    peek(): any;
    get size(): number;
    get isEmpty(): boolean;
    remove(taskId: any): boolean;
    clear(): number;
    toArray(): any[];
}
export namespace LIFECYCLE {
    let CREATED: string;
    let READY: string;
    let RUNNING: string;
    let PAUSED: string;
    let TERMINATED: string;
}
export namespace PRIORITY {
    let CRITICAL: number;
    let HIGH: number;
    let NORMAL: number;
    let LOW: number;
    let IDLE: number;
}
export const PHI: 1.6180339887;
import { EventEmitter } from "events";
//# sourceMappingURL=bee-template.d.ts.map