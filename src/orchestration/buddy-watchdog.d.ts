export class BuddyWatchdog extends EventEmitter<[never]> {
    constructor(buddyInstance: any);
    _buddy: any;
    _running: boolean;
    _intervalId: NodeJS.Timeout | null;
    _consecutiveFailures: number;
    _restartCount: number;
    _baselineRSS: number;
    _patternHistory: any[];
    _lastDecisionCount: number;
    _stallTicks: number;
    stats: {
        checks: number;
        failures: number;
        restarts: number;
        hallucinationDetections: number;
        memoryAlerts: number;
        stallDetections: number;
        startedAt: null;
    };
    /**
     * Start the watchdog loop.
     */
    start(): void;
    /**
     * Stop the watchdog.
     */
    stop(): void;
    /**
     * Primary check routine.
     */
    _check(): Promise<void>;
    /**
     * Check if Buddy is responsive.
     */
    _checkBuddyHealth(): boolean;
    /**
     * Detect hallucination loops by checking for repetitive patterns
     * in recent decisions.
     */
    _detectHallucinationLoop(): string | null;
    /**
     * Trigger a Buddy restart — clear volatile memory, preserve vector storage.
     */
    _triggerRestart(reason: any): Promise<void>;
    /**
     * Get watchdog status.
     */
    getStatus(): {
        running: boolean;
        stats: {
            checks: number;
            failures: number;
            restarts: number;
            hallucinationDetections: number;
            memoryAlerts: number;
            stallDetections: number;
            startedAt: null;
        };
        consecutiveFailures: number;
        stallTicks: number;
        memoryGrowthMB: string;
        intervalMs: number;
        buddyAlive: boolean;
    };
    /**
     * Register Express routes for watchdog status.
     */
    registerRoutes(app: any): void;
}
import EventEmitter = require("events");
//# sourceMappingURL=buddy-watchdog.d.ts.map