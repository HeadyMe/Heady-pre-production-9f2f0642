export class PatternEngine extends EventEmitter<[never]> {
    constructor();
    _patterns: Map<any, any>;
    _timer: NodeJS.Timeout | null;
    _analysisCount: number;
    start(): void;
    stop(): void;
    observeLatency(key: any, latencyMs: any, meta?: {}): void;
    observeSuccess(key: any, durationMs: any, meta?: {}): void;
    observeError(key: any, error: any, meta?: {}): void;
    observe(category: any, key: any, value: any, meta?: {}): void;
    _record(key: any, category: any, value: any, meta: any): void;
    _analyze(): void;
    getHealth(): {
        ok: boolean;
        service: string;
        patterns: number;
        analyses: number;
        running: boolean;
    };
}
export const patternEngine: PatternEngine;
export function registerPatternRoutes(app: any, engine: any): void;
import { EventEmitter } from "events";
//# sourceMappingURL=hc_pattern_engine.d.ts.map