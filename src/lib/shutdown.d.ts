export = shutdownManager;
declare const shutdownManager: ShutdownManager;
declare class ShutdownManager {
    _hooks: any[];
    _shuttingDown: boolean;
    _registered: boolean;
    register(name: any, fn: any, priority?: number): this;
    _attachSignals(): void;
    _shutdown(signal: any): Promise<void>;
    get isShuttingDown(): boolean;
}
//# sourceMappingURL=shutdown.d.ts.map