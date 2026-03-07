export class HeadySimsService extends EventEmitter<[never]> {
    constructor(config?: {});
    config: {
        algorithm: string;
        exploration_factor: number;
        simulation_runs: number;
        confidence_threshold: number;
        continuous_mode: boolean;
        task_queue_size: number;
        optimization_interval: number;
    };
    strategies: {
        fast_serial: {
            name: string;
            description: string;
            strengths: string[];
            weaknesses: string[];
            base_score: number;
        };
        fast_parallel: {
            name: string;
            description: string;
            strengths: string[];
            weaknesses: string[];
            base_score: number;
        };
        balanced: {
            name: string;
            description: string;
            strengths: string[];
            weaknesses: string[];
            base_score: number;
        };
        thorough: {
            name: string;
            description: string;
            strengths: string[];
            weaknesses: string[];
            base_score: number;
        };
        cached_fast: {
            name: string;
            description: string;
            strengths: string[];
            weaknesses: string[];
            base_score: number;
        };
        probe_then_commit: {
            name: string;
            description: string;
            strengths: string[];
            weaknesses: string[];
            base_score: number;
        };
        monte_carlo_optimal: {
            name: string;
            description: string;
            strengths: string[];
            weaknesses: string[];
            base_score: number;
        };
    };
    taskQueue: any[];
    processingTasks: Map<any, any>;
    completedTasks: any[];
    strategyPerformance: Map<any, any>;
    learningData: {
        patterns: Map<any, any>;
        optimizations: never[];
        failures: never[];
        successes: never[];
    };
    isRunning: boolean;
    metrics: {
        tasksProcessed: number;
        averageLatency: number;
        successRate: number;
        optimalStrategy: string;
        uptime: number;
        lastOptimization: number;
    };
    initializeStrategyPerformance(): void;
    start(): Promise<void>;
    startTime: number | undefined;
    optimizationLoop: NodeJS.Timeout | undefined;
    processingLoop: NodeJS.Timeout | undefined;
    metricsLoop: NodeJS.Timeout | undefined;
    learningLoop: NodeJS.Timeout | undefined;
    stop(): Promise<void>;
    addTask(task: any): Promise<any>;
    processTaskQueue(): Promise<void>;
    processTask(task: any): Promise<void>;
    selectOptimalStrategy(task: any): Promise<string>;
    calculateUCB1(performance: any): any;
    executeTaskWithStrategy(task: any, strategy: any): Promise<{
        strategy: any;
        latency: number;
        accuracy: number;
        efficiency: number;
        score: number;
        timestamp: number;
    }>;
    getStrategyLatency(strategy: any): any;
    getStrategyAccuracy(strategy: any): any;
    getStrategyEfficiency(strategy: any): any;
    updateStrategyPerformance(strategy: any, result: any): void;
    optimizeStrategies(): void;
    learningIntegration(): void;
    updateMetrics(): void;
    getStatus(): {
        isRunning: boolean;
        uptime: number;
        tasksProcessed: number;
        queueSize: number;
        processingTasks: number;
        averageLatency: number;
        successRate: number;
        optimalStrategy: string;
        strategies: any;
        lastOptimization: number;
    };
    getStrategyReport(): {
        timestamp: number;
        strategies: {};
        recommendations: never[];
    };
    sleep(ms: any): Promise<any>;
}
export function getHeadySimsService(config?: {}): any;
import EventEmitter = require("events");
//# sourceMappingURL=monte-carlo-service.d.ts.map