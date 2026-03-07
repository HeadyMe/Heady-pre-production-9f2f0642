export class HeadyAutonomy extends EventEmitter<[never]> {
    constructor(opts?: {});
    mode: string;
    lastUserActivity: number;
    idleThresholdMs: any;
    pivotLatencyTarget: number;
    started: boolean;
    allocation: {
        knowledge_gathering: number;
        code_improvement: number;
        experience_building: number;
        health_monitoring: number;
        user_task: number;
    };
    stats: {
        memoriesGathered: number;
        codeImprovements: number;
        patternsDetected: number;
        pivotCount: number;
        avgPivotLatencyMs: number;
        totalLearningTimeMs: number;
        totalUserTimeMs: number;
        lastPivotAt: null;
    };
    memoryWrapper: any;
    patternEngine: any;
    resourceManager: any;
    _idleCheckInterval: NodeJS.Timeout | null;
    _knowledgeGatherInterval: NodeJS.Timeout | null;
    _rampTimer: any;
    _activeTasks: Set<any>;
    /**
     * Start the autonomy service
     */
    start(): void;
    /**
     * Stop the autonomy service
     */
    stop(): void;
    /**
     * Call this on ANY user input — API request, chat message, keystroke
     * Instantly pivots 100% resources to user task
     */
    onUserActivity(context?: {}): void;
    /**
     * Check if user has gone idle → ramp back to autonomous
     */
    _checkIdleState(): void;
    /**
     * Gradual return to autonomous mode
     * 30s: 50/50 → 60s: 80/20 → 120s: 100/0
     */
    _beginReturnToAutonomous(): void;
    _gatherKnowledge(): Promise<void>;
    _scanCodebase(): Promise<void>;
    _indexDocumentation(): Promise<void>;
    _buildExperience(): Promise<void>;
    _checkStorageHealth(): Promise<void>;
    _saveLearnState(): void;
    _restoreLearnState(): void;
    getStatus(): {
        mode: string;
        allocation: {
            knowledge_gathering: number;
            code_improvement: number;
            experience_building: number;
            health_monitoring: number;
            user_task: number;
        };
        stats: {
            memoriesGathered: number;
            codeImprovements: number;
            patternsDetected: number;
            pivotCount: number;
            avgPivotLatencyMs: number;
            totalLearningTimeMs: number;
            totalUserTimeMs: number;
            lastPivotAt: null;
        };
        idleSinceMs: number;
        activeTasks: number;
        started: boolean;
        ts: string;
    };
    getResourceAllocation(): {
        knowledge_gathering: number;
        code_improvement: number;
        experience_building: number;
        health_monitoring: number;
        user_task: number;
    };
}
/**
 * Express route registration
 */
export function registerAutonomyRoutes(app: any, autonomy: any): void;
export namespace MODES {
    let AUTONOMOUS: string;
    let USER_PRIORITY: string;
    let TRANSITIONING: string;
}
import EventEmitter = require("events");
//# sourceMappingURL=heady-autonomy.d.ts.map