export class HCResourceManager extends EventEmitter<[never]> {
    constructor(opts?: {});
    pollIntervalMs: any;
    _timer: NodeJS.Timeout | null;
    _history: any[];
    _safeModeActive: boolean;
    start(): void;
    stop(): void;
    _poll(): void;
    getSnapshot(): any;
    getHealth(): {
        ok: boolean;
        service: string;
        polling: boolean;
        history: number;
        safeMode: boolean;
    };
}
export function registerRoutes(app: any, manager: any): void;
import { EventEmitter } from "events";
//# sourceMappingURL=hc_resource_manager.d.ts.map