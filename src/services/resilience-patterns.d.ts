export class SagaOrchestrator {
    constructor(name: any);
    name: any;
    steps: any[];
    completedSteps: any[];
    state: string;
    addStep(name: any, execute: any, compensate: any): this;
    run(context?: {}): Promise<{
        success: boolean;
        sagaId: `${string}-${string}-${string}-${string}-${string}`;
        failedStep: any;
        error: any;
        context?: undefined;
    } | {
        success: boolean;
        sagaId: `${string}-${string}-${string}-${string}-${string}`;
        context: {};
        failedStep?: undefined;
        error?: undefined;
    }>;
    _compensate(sagaId: any, context: any): Promise<void>;
}
export class BulkheadIsolation {
    constructor(name: any, { maxConcurrent, maxQueue, timeoutMs }?: {
        maxConcurrent?: number | undefined;
        maxQueue?: number | undefined;
        timeoutMs?: number | undefined;
    });
    name: any;
    maxConcurrent: number;
    maxQueue: number;
    timeoutMs: number;
    active: number;
    queue: any[];
    stats: {
        executed: number;
        rejected: number;
        timedOut: number;
        queued: number;
    };
    execute(fn: any): Promise<any>;
    _run(fn: any): Promise<any>;
    _enqueue(fn: any): Promise<any>;
    _dequeue(): void;
    getHealth(): {
        name: any;
        active: number;
        queued: number;
        stats: {
            executed: number;
            rejected: number;
            timedOut: number;
            queued: number;
        };
    };
}
export class EventStore {
    constructor(name?: string);
    name: string;
    events: any[];
    snapshots: any[];
    subscribers: Map<any, any>;
    sequenceNumber: number;
    append(aggregateId: any, eventType: any, payload: any, metadata?: {}): {
        sequenceNumber: number;
        aggregateId: any;
        eventType: any;
        payload: any;
        metadata: {
            timestamp: string;
            correlationId: any;
        };
    };
    getEvents(aggregateId: any, afterSequence?: number): any[];
    getEventsByType(eventType: any, limit?: number): any[];
    replay(aggregateId: any, reducer: any, initialState?: {}): any;
    snapshot(aggregateId: any, state: any): void;
    getLatestSnapshot(aggregateId: any): any;
    subscribe(eventType: any, handler: any): void;
    _notify(eventType: any, event: any): void;
    getHealth(): {
        name: string;
        totalEvents: number;
        totalSnapshots: number;
        currentSequence: number;
        subscriberCount: any;
    };
}
export class CQRSBus {
    constructor(eventStore: any);
    eventStore: any;
    commandHandlers: Map<any, any>;
    queryHandlers: Map<any, any>;
    readModels: Map<any, any>;
    stats: {
        commands: number;
        queries: number;
    };
    registerCommand(name: any, handler: any): void;
    registerQuery(name: any, handler: any): void;
    registerReadModel(name: any, projector: any): void;
    executeCommand(name: any, payload: any, metadata?: {}): Promise<any>;
    executeQuery(name: any, params?: {}): Promise<any>;
    getReadModel(name: any): any;
    getHealth(): {
        commands: number;
        queries: number;
        registeredCommands: number;
        registeredQueries: number;
        readModels: number;
    };
}
export class AutoTuner {
    constructor(name: any, { sampleWindowMs, adjustIntervalMs }?: {
        sampleWindowMs?: number | undefined;
        adjustIntervalMs?: number | undefined;
    });
    name: any;
    sampleWindowMs: number;
    adjustIntervalMs: number;
    metrics: any[];
    thresholds: {};
    adjustmentHistory: any[];
    _timer: NodeJS.Timeout | null;
    defineThreshold(key: any, { min, max, target, step, current }: {
        min: any;
        max: any;
        target: any;
        step?: number | undefined;
        current: any;
    }): this;
    recordMetric(key: any, value: any): void;
    start(): void;
    stop(): void;
    _adjust(): void;
    getCurrentThresholds(): {};
    getHealth(): {
        name: any;
        thresholds: {};
        sampleCount: number;
        adjustments: number;
        lastAdjustments: any[];
    };
}
export class HotColdRouter {
    constructor({ hotThresholdMs, hotCapacity, coldBatchSize, coldFlushIntervalMs }?: {
        hotThresholdMs?: number | undefined;
        hotCapacity?: number | undefined;
        coldBatchSize?: number | undefined;
        coldFlushIntervalMs?: number | undefined;
    });
    hotThresholdMs: number;
    hotCapacity: number;
    coldBatchSize: number;
    coldFlushIntervalMs: number;
    hotCache: Map<any, any>;
    coldBuffer: any[];
    hotHandler: any;
    coldHandler: any;
    stats: {
        hotHits: number;
        coldHits: number;
        coldFlushes: number;
        promotions: number;
        demotions: number;
    };
    _flushTimer: NodeJS.Timeout | null;
    setHotHandler(fn: any): this;
    setColdHandler(fn: any): this;
    start(): void;
    stop(): void;
    route(key: any, data: any, { latencySensitive }?: {
        latencySensitive?: boolean | undefined;
    }): Promise<any>;
    _evictHot(): void;
    _flushCold(): Promise<void>;
    getHealth(): {
        hotCacheSize: number;
        coldBufferSize: number;
        stats: {
            hotHits: number;
            coldHits: number;
            coldFlushes: number;
            promotions: number;
            demotions: number;
        };
    };
}
export class SkillBasedRouter {
    agents: Map<any, any>;
    routingHistory: any[];
    stats: {
        routed: number;
        rejected: number;
        fallbacks: number;
    };
    registerAgent(agentId: any, { skills, maxLoad, latencyMs }?: {
        skills?: never[] | undefined;
        maxLoad?: number | undefined;
        latencyMs?: number | undefined;
    }): void;
    unregisterAgent(agentId: any): void;
    route(requiredSkill: any, { preferLowLatency, preferLowLoad }?: {
        preferLowLatency?: boolean | undefined;
        preferLowLoad?: boolean | undefined;
    }): {
        agentId: any;
        skill: any;
        assignedAt: any;
    } | null;
    _assign(agentId: any, skill: any): {
        agentId: any;
        skill: any;
        assignedAt: any;
    } | null;
    releaseLoad(agentId: any): void;
    getHealth(): {
        agents: {};
        stats: {
            routed: number;
            rejected: number;
            fallbacks: number;
        };
    };
}
export const eventStore: EventStore;
export const cqrsBus: CQRSBus;
export const autoTuner: AutoTuner;
export const hotColdRouter: HotColdRouter;
export const skillRouter: SkillBasedRouter;
export function registerResilienceRoutes(app: any): void;
//# sourceMappingURL=resilience-patterns.d.ts.map