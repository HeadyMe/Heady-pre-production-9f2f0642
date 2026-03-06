/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * ═══ HCFP Task Manifest Schema ═══
 *
 * Formal JSON schema for task manifests ingested by the HCFP Auto-Flow-Success Pipeline.
 * Every strategic objective must be wrapped in this schema for deterministic execution.
 *
 * Heady AI Nodes: CONDUCTOR, MAESTRO
 */

/**
 * Validate a task manifest against the HCFP schema.
 *
 * @param {object} manifest - The task manifest to validate
 * @returns {{ ok: boolean, errors: string[] }}
 */
function validate(manifest) {
    const errors = [];

    if (!manifest || typeof manifest !== "object") {
        return { ok: false, errors: ["Manifest must be a non-null object"] };
    }
    // Phase field is optional — phases are retired, replaced by parallel execution
    // If provided, it's treated as a label, not a sequential gate
    if (manifest.phase && typeof manifest.phase !== "string") {
        errors.push("Invalid 'phase' (must be string if provided)");
    }
    if (!manifest.priority || !["low", "normal", "high", "critical"].includes(manifest.priority)) {
        errors.push("Missing or invalid 'priority' (low|normal|high|critical)");
    }
    if (!Array.isArray(manifest.tasks) || manifest.tasks.length === 0) {
        errors.push("Missing or empty 'tasks' array");
    } else {
        manifest.tasks.forEach((task, i) => {
            if (!task.name) errors.push(`tasks[${i}]: missing 'name'`);
            if (!task.action) errors.push(`tasks[${i}]: missing 'action'`);
        });
    }

    return { ok: errors.length === 0, errors };
}

/**
 * Create a new task manifest with defaults.
 *
 * @param {object} opts
 * @returns {object} A complete, validated task manifest
 */
function create(opts = {}) {
    return {
        id: `hcfp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        phase: opts.phase || "execution",
        priority: opts.priority || "normal",
        source: opts.source || "manual",
        created_at: new Date().toISOString(),
        status: "pending",
        tasks: (opts.tasks || []).map((t, i) => ({
            id: `task-${Date.now()}-${i}`,
            name: t.name || `task-${i}`,
            action: t.action || "execute",
            service_group: t.service_group || "brain",
            inputs: t.inputs || {},
            expected_outcome: t.expected_outcome || null,
            status: "pending",
            result: null,
            started_at: null,
            completed_at: null,
        })),
        pipeline_log: [],
        completed_at: null,
    };
}

/**
 * Get a summary of manifest status.
 */
function summarize(manifest) {
    const total = manifest.tasks?.length || 0;
    const done = manifest.tasks?.filter(t => t.status === "completed").length || 0;
    const failed = manifest.tasks?.filter(t => t.status === "failed").length || 0;
    const pending = total - done - failed;

    return {
        id: manifest.id,
        phase: manifest.phase,
        priority: manifest.priority,
        total_tasks: total,
        completed: done,
        failed,
        pending,
        progress_pct: total > 0 ? Math.round((done / total) * 100) : 0,
        status: manifest.status,
    };
}

module.exports = { validate, create, summarize };
