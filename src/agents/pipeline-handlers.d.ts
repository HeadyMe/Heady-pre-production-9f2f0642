/**
 * Register all task handlers with the pipeline engine.
 * Call this during startup after pipeline.load().
 */
export function registerAllHandlers(registerTaskHandler: any): void;
export function initializeSubsystems(configs?: {}): {
    supervisor: any;
    brain: any;
    checkpointAnalyzer: any;
    readinessEvaluator: any;
    healthRunner: any;
};
/**
 * Get subsystem instances for API exposure.
 */
export function getSubsystems(): {
    supervisor: any;
    brain: any;
    checkpointAnalyzer: any;
    readinessEvaluator: any;
    healthRunner: any;
};
export namespace TASK_HANDLERS {
    export { ingestNewsFeeds as ingest_news_feeds };
    export { ingestRepoChanges as ingest_repo_changes };
    export { ingestExternalApis as ingest_external_apis };
    export { ingestHealthMetrics as ingest_health_metrics };
    export { generateTaskGraph as generate_task_graph };
    export { assignPriorities as assign_priorities };
    export { estimateCosts as estimate_costs };
    export { validateGovernance as validate_governance };
    export { routeToAgents as route_to_agents };
    export { monitorAgentExecution as monitor_agent_execution };
    export { collectAgentResults as collect_agent_results };
    export { evaluateFailures as evaluate_failures };
    export { applyCompensation as apply_compensation };
    export { retryRecoverable as retry_recoverable };
    export { escalateUnrecoverable as escalate_unrecoverable };
    export { persistResults as persist_results };
    export { updateConceptIndex as update_concept_index };
    export { computeReadinessScore as compute_readiness_score };
    export { sendCheckpointEmail as send_checkpoint_email };
    export { logRunConfigHash as log_run_config_hash };
    export { eodAssertionProtocol as eod_assertion_protocol };
    export { dynamicFocusShift as dynamic_focus_shift };
    export { randomOptimizerCycle as random_optimizer_cycle };
    export { idlePowerLearning as idle_power_learning };
    export { autoResearchIngest as auto_research_ingest };
}
export function handleAutomatedFlow(task: any): Promise<void>;
declare function ingestNewsFeeds(context: any): Promise<{
    task: string;
    status: string;
    result: string;
    sources: never[];
    itemsIngested: number;
}>;
declare function ingestRepoChanges(context: any): Promise<{
    task: string;
    status: string;
    result: string;
    dirtyFiles: number;
}>;
declare function ingestExternalApis(context: any): Promise<{
    task: string;
    status: string;
    result: string;
    apis: string[];
}>;
declare function ingestHealthMetrics(context: any): Promise<any>;
declare function generateTaskGraph(context: any): Promise<{
    task: string;
    status: string;
    result: string;
    stageCount: any;
}>;
declare function assignPriorities(context: any): Promise<{
    task: string;
    status: string;
    result: string;
}>;
declare function estimateCosts(context: any): Promise<{
    task: string;
    status: string;
    result: string;
    budget: any;
}>;
declare function validateGovernance(context: any): Promise<any>;
declare function routeToAgents(context: any): Promise<any>;
declare function monitorAgentExecution(context: any): Promise<{
    task: string;
    status: string;
    result: string;
    agentStatus: any;
} | {
    task: string;
    status: string;
    result: string;
    agentStatus?: undefined;
}>;
declare function collectAgentResults(context: any): Promise<{
    task: string;
    status: string;
    result: string;
    agentCount: any;
    recentRuns: any;
} | {
    task: string;
    status: string;
    result: string;
    agentCount?: undefined;
    recentRuns?: undefined;
}>;
declare function evaluateFailures(context: any): Promise<{
    task: string;
    status: string;
    result: string;
    recoverable: number;
    unrecoverable: number;
}>;
declare function applyCompensation(context: any): Promise<{
    task: string;
    status: string;
    result: string;
}>;
declare function retryRecoverable(context: any): Promise<{
    task: string;
    status: string;
    result: string;
}>;
declare function escalateUnrecoverable(context: any): Promise<{
    task: string;
    status: string;
    result: string;
}>;
declare function persistResults(context: any): Promise<{
    task: string;
    status: string;
    result: string;
}>;
declare function updateConceptIndex(context: any): Promise<{
    task: string;
    status: string;
    result: string;
}>;
declare function computeReadinessScore(context: any): Promise<any>;
declare function sendCheckpointEmail(context: any): Promise<{
    task: string;
    status: string;
    result: string;
}>;
declare function logRunConfigHash(context: any): Promise<{
    task: string;
    status: string;
    result: string;
    hash: string;
}>;
/**
 * EOD Assertion Protocol — Statement-based daily check-in.
 * Uses assertions instead of questions to reduce cognitive load.
 * Ref: docs/research/self-discovery-optimization-framework.md
 */
declare function eodAssertionProtocol(context: any): Promise<{
    task: string;
    status: string;
    result: string;
    assertions: {
        directedEnergy: {
            id: string;
            statement: string;
            type: string;
        }[];
        systemHealth: {
            id: string;
            statement: string;
            type: string;
        }[];
        fundamentals: {
            id: string;
            statement: string;
            type: string;
        }[];
    };
    historyLength: number;
    pendingInput: boolean;
}>;
/**
 * Dynamic Focus Shift — Detects patterns and generates next-day directives.
 * Implements the "changing focus of the user if necessary" mechanism.
 * Ref: docs/research/self-discovery-optimization-framework.md
 */
declare function dynamicFocusShift(context: any): Promise<{
    task: string;
    status: string;
    result: string;
    directive: string;
    focusShift: {
        from: string;
        to: string;
        urgency: string;
    } | null;
    historyDepth: number;
}>;
/**
 * Random Optimizer Cycle — Weighted random task selection with priority decay.
 * Selects improvement tasks using roulette wheel selection.
 * Ref: docs/research/random-optimizer-adaptive-idle-learning.md
 */
declare function randomOptimizerCycle(context: any): Promise<{
    task: string;
    status: string;
    result: string;
    selected: {
        effectivePriority: number;
        name: string;
        basePriority: number;
        cost: number;
    };
    poolSize: number;
    decayState: {};
}>;
/**
 * Idle Power Learning — Boosts learning tasks when system is idle.
 * Monitors CPU load (via /proc/loadavg on Linux) and adjusts budget.
 * Ref: docs/research/random-optimizer-adaptive-idle-learning.md
 */
declare function idlePowerLearning(context: any): Promise<{
    ts: string;
    loadPercent: number;
    cpuCount: number;
    mode: string;
    budget: string;
    allowHeavyTasks: boolean;
    task: string;
    status: string;
    result: string;
}>;
/**
 * AUTO RESEARCH INGEST — watches docs/research/inbox/ and auto-archives
 * Classifies incoming .md files, adds disclaimers, moves to docs/research/
 */
declare function autoResearchIngest(context: any): Promise<{
    status: string;
    message: string;
    files?: undefined;
} | {
    status: string;
    message: string;
    files: {
        file: any;
        category: string;
    }[];
}>;
export {};
//# sourceMappingURL=pipeline-handlers.d.ts.map