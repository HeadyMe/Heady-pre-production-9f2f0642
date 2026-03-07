export class HCTaskScheduler extends EventEmitter<[never]> {
    constructor(opts?: {});
    _queue: any[];
    _running: Map<any, any>;
    _completed: any[];
    _maxConcurrency: any;
    _safeMode: boolean;
    _concurrencyOverrides: {};
    enqueue(task: any): any;
    enterSafeMode(): void;
    exitSafeMode(): void;
    adjustConcurrency(type: any, value: any): void;
    tick(): Promise<void>;
    getHealth(): {
        ok: boolean;
        service: string;
        queued: number;
        running: number;
        completed: number;
        safeMode: boolean;
        maxConcurrency: any;
    };
}
export function registerSchedulerRoutes(app: any, scheduler: any): void;
import { EventEmitter } from "events";
//# sourceMappingURL=hc_task_scheduler.d.ts.map