export class MCPlanScheduler extends EventEmitter<[never]> {
    constructor();
    _strategies: Map<any, any>;
    _speedMode: string;
    _results: any[];
    setSpeedMode(mode: any): void;
    registerStrategy(id: any, config: any): void;
    recordResult(taskType: any, strategyId: any, actualLatencyMs: any): void;
    getHealth(): {
        ok: boolean;
        service: string;
        strategies: number;
        results: number;
        speedMode: string;
    };
}
export class MCGlobal extends EventEmitter<[never]> {
    constructor();
    _running: boolean;
    _timer: NodeJS.Timeout | null;
    _pipeline: any;
    _registry: any;
    _cycleCount: number;
    bind({ pipeline, registry }: {
        pipeline: any;
        registry: any;
    }): void;
    startAutoRun(): void;
    stopAutoRun(): void;
    getHealth(): {
        ok: boolean;
        service: string;
        running: boolean;
        cycles: number;
    };
}
export const mcPlanScheduler: MCPlanScheduler;
export const mcGlobal: MCGlobal;
export function registerHeadySimsRoutes(app: any, scheduler: any, global: any): void;
import { EventEmitter } from "events";
//# sourceMappingURL=hc_monte_carlo.d.ts.map