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
export function validate(manifest: object): {
    ok: boolean;
    errors: string[];
};
/**
 * Create a new task manifest with defaults.
 *
 * @param {object} opts
 * @returns {object} A complete, validated task manifest
 */
export function create(opts?: object): object;
/**
 * Get a summary of manifest status.
 */
export function summarize(manifest: any): {
    id: any;
    phase: any;
    priority: any;
    total_tasks: any;
    completed: any;
    failed: any;
    pending: number;
    progress_pct: number;
    status: any;
};
//# sourceMappingURL=task-manifest-schema.d.ts.map