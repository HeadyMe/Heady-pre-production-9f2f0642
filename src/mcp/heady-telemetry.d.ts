export class HeadyTelemetry {
    constructor(vectorStore: any, learner: any);
    vectorStore: any;
    learner: any;
    sessionId: string;
    sessionStart: number;
    toolCalls: any[];
    errors: any[];
    optimizations: any[];
    _metricsInterval: NodeJS.Timeout | null;
    /**
     * Log a tool call with full context — the core audit entry.
     */
    logToolCall(toolName: any, args: any, result: any, durationMs: any, context?: {}): {
        type: string;
        sessionId: string;
        timestamp: string;
        epochMs: number;
        tool: any;
        args: any;
        resultSize: number;
        resultPreview: any;
        durationMs: any;
        success: boolean;
        env: {
            heapUsedMB: number;
            heapTotalMB: number;
            rssMB: number;
            uptimeS: number;
            cpuUser: number;
            cpuSystem: number;
            loadAvg: number[];
            freeMemGB: number;
            totalMemGB: number;
            platform: NodeJS.Platform;
            nodeVersion: string;
            vectorCount: any;
        };
        context: {
            sessionUptime: number;
            callIndex: number;
        };
    };
    /**
     * Log an error with full stack trace.
     */
    logError(source: any, error: any, context?: {}): void;
    /**
     * Log a user directive or preference change.
     */
    logDirective(directive: any, source?: string): void;
    /**
     * Capture a snapshot of environmental data.
     */
    _captureEnvSnapshot(): {
        heapUsedMB: number;
        heapTotalMB: number;
        rssMB: number;
        uptimeS: number;
        cpuUser: number;
        cpuSystem: number;
        loadAvg: number[];
        freeMemGB: number;
        totalMemGB: number;
        platform: NodeJS.Platform;
        nodeVersion: string;
        vectorCount: any;
    };
    /**
     * Start periodic environmental metric capture (every 30s).
     */
    _startEnvironmentalCapture(): void;
    /**
     * Analyze tool calls for optimization opportunities.
     */
    _checkOptimizations(entry: any): void;
    _recordOptimization(opt: any): void;
    /**
     * Get comprehensive telemetry stats.
     */
    getStats(): {
        session: {
            id: string;
            startedAt: string;
            uptimeS: number;
        };
        toolCalls: {
            total: number;
            successful: number;
            failed: number;
            totalDurationMs: any;
            avgDurationMs: number;
            topTools: {
                tool: string;
                count: any;
            }[];
        };
        errors: {
            total: number;
            recent: {
                source: any;
                message: any;
                at: any;
            }[];
        };
        optimizations: {
            total: number;
            active: {
                type: any;
                reason: any;
                impact: any;
            }[];
        };
        environment: {
            heapUsedMB: number;
            heapTotalMB: number;
            rssMB: number;
            uptimeS: number;
            cpuUser: number;
            cpuSystem: number;
            loadAvg: number[];
            freeMemGB: number;
            totalMemGB: number;
            platform: NodeJS.Platform;
            nodeVersion: string;
            vectorCount: any;
        };
        auditTrail: {
            file: string;
            metricsFile: string;
            optimizationsFile: string;
        };
    };
    _sanitize(obj: any): any;
    _preview(result: any): any;
    _appendLog(file: any, entry: any): void;
    destroy(): void;
}
//# sourceMappingURL=heady-telemetry.d.ts.map