/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 * Pipeline Pools — Task pool map, priority sorting, breaker mapping, metrics.
 * Extracted from hc_pipeline.js for maintainability.
 */

// ─── NODE POOL PRIORITY ─────────────────────────────────────────────────────

const TASK_POOL_MAP = {
    // Hot pool: user-facing, core pipeline tasks (critical latency)
    resolve_channel_and_identity: "hot",
    route_to_pipeline_branch: "hot",
    route_to_agents: "hot",
    monitor_agent_execution: "hot",
    collect_agent_results: "hot",
    compute_readiness_score: "hot",
    mc_plan_selection: "hot",
    mc_replan_failed_tasks: "hot",
    // Warm pool: important background tasks
    sync_cross_device_context: "warm",
    determine_launch_mode: "warm",
    generate_task_graph: "warm",
    assign_priorities: "warm",
    validate_governance: "warm",
    evaluate_failures: "warm",
    apply_compensation: "warm",
    persist_results: "warm",
    log_run_config_hash: "warm",
    record_run_critique: "warm",
    diagnose_bottlenecks: "warm",
    check_all_connection_health: "warm",
    identify_improvement_candidates: "warm",
    run_meta_analysis: "warm",
    apply_pattern_improvements: "warm",
    adjust_mc_strategy_weights: "warm",
    adjust_worker_pool_concurrency: "warm",
    update_channel_optimizations: "warm",
    record_pipeline_improvements: "warm",
    feed_stage_timing_to_mc: "warm",
    feed_task_timing_to_patterns: "warm",
    publish_metrics_to_channels: "warm",
    check_cross_channel_seamlessness: "warm",
    propose_micro_upgrades: "warm",
    archive_run_to_history: "warm",
    sync_registry_and_docs: "warm",
    validate_notebook_integrity: "warm",
    check_doc_owner_freshness: "warm",
    // Cold pool: async ingestion, analytics, mining
    ingest_news_feeds: "cold",
    ingest_external_apis: "cold",
    ingest_repo_changes: "cold",
    ingest_health_metrics: "cold",
    ingest_channel_events: "cold",
    ingest_connection_health: "cold",
    ingest_public_domain_patterns: "cold",
    estimate_costs: "cold",
    check_public_domain_inspiration: "cold",
    retry_recoverable: "cold",
    escalate_unrecoverable: "cold",
    update_concept_index: "cold",
    send_checkpoint_email: "cold",
    mine_public_domain_best_practices: "cold",
    invalidate_stale_caches: "cold",
};

const POOL_PRIORITY = { hot: 0, warm: 1, cold: 2 };

function sortTasksByPool(tasks) {
    return [...tasks].sort((a, b) => {
        const pa = POOL_PRIORITY[TASK_POOL_MAP[a] || "cold"] || 2;
        const pb = POOL_PRIORITY[TASK_POOL_MAP[b] || "cold"] || 2;
        return pa - pb;
    });
}

// Map task names to circuit breaker endpoints
function findBreakerForTask(taskName, circuitBreakers) {
    const TASK_BREAKER_MAP = {
        ingest_news_feeds: "external-news-api",
        ingest_external_apis: "external-news-api",
        ingest_public_domain_patterns: "external-news-api",
        generate_task_graph: "llm-provider",
        assign_priorities: "llm-provider",
        estimate_costs: "llm-provider",
        validate_governance: "llm-provider",
        route_to_agents: "llm-provider",
        monitor_agent_execution: "llm-provider",
        collect_agent_results: "llm-provider",
        evaluate_failures: "llm-provider",
        compute_readiness_score: "llm-provider",
        log_run_config_hash: "llm-provider",
        mc_plan_selection: "llm-provider",
        mc_replan_failed_tasks: "llm-provider",
        check_public_domain_inspiration: "external-news-api",
        mine_public_domain_best_practices: "external-news-api",
        diagnose_bottlenecks: "llm-provider",
        run_meta_analysis: "llm-provider",
    };
    const endpoint = TASK_BREAKER_MAP[taskName];
    return endpoint ? circuitBreakers.get(endpoint) || null : null;
}

function recalcMetrics(state) {
    const total = state.metrics.totalTasks || 1;
    state.metrics.errorRate = state.metrics.failedTasks / total;
    state.metrics.readinessScore = Math.max(0, Math.round(100 - state.metrics.errorRate * 200));
}

module.exports = {
    TASK_POOL_MAP,
    POOL_PRIORITY,
    sortTasksByPool,
    findBreakerForTask,
    recalcMetrics,
};
