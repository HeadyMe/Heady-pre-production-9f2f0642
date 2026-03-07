/**
 * Step 1: INGEST — Accept and validate a task manifest.
 */
export function ingest(rawManifest: any): {
    ok: boolean;
    step: string;
    errors: string[];
    manifest_id?: undefined;
    task_count?: undefined;
} | {
    ok: boolean;
    step: string;
    manifest_id: any;
    task_count: any;
    errors?: undefined;
};
/**
 * Step 2: DECOMPOSE — Assign execution order and expected outcomes.
 */
export function decompose(manifestId: any): {
    ok: boolean;
    step: string;
    error: string;
    manifest_id?: undefined;
    tasks?: undefined;
} | {
    ok: boolean;
    step: string;
    manifest_id: any;
    tasks: any;
    error?: undefined;
};
/**
 * Step 3: ROUTE — Execute tasks via brain chat.
 * This calls the internal brain endpoint for each task.
 */
export function route(manifestId: any, brainFn: any): Promise<{
    ok: boolean;
    step: string;
    error: string;
    manifest_id?: undefined;
    results?: undefined;
    budget?: undefined;
} | {
    ok: boolean;
    step: string;
    manifest_id: any;
    results: any[];
    budget: {
        remainingUSD: number;
        usagePercent: string;
        transactionCount: number;
        maxDailyCostUSD: number;
        currentDayCost: number;
        dayStart: string;
        transactions: never[];
    };
    error?: undefined;
}>;
/**
 * Step 4: VALIDATE — Check task outcomes.
 */
export function validate(manifestId: any): {
    ok: boolean;
    step: string;
    error: string;
    manifest_id?: undefined;
    score?: undefined;
    completed?: undefined;
    failed?: undefined;
    total?: undefined;
    status?: undefined;
} | {
    ok: boolean;
    step: string;
    manifest_id: any;
    score: number;
    completed: any;
    failed: any;
    total: any;
    status: any;
    error?: undefined;
};
/**
 * Step 5: PERSIST — Finalize, log, and embed into vector store.
 * All persistent storage targets vector embedding for instant knowledge retrieval.
 */
export function persist(manifestId: any): {
    ok: boolean;
    step: string;
    error: string;
    manifest_id?: undefined;
    summary?: undefined;
} | {
    ok: boolean;
    step: string;
    manifest_id: any;
    summary: {
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
    error?: undefined;
};
/**
 * Run the full 5-step pipeline on a manifest.
 */
export function runFull(rawManifest: any, brainFn: any): Promise<{
    ok: boolean;
    step: string;
    errors: string[];
    manifest_id?: undefined;
    task_count?: undefined;
} | {
    ok: boolean;
    step: string;
    manifest_id: any;
    task_count: any;
    errors?: undefined;
} | {
    summary: {
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
    ok: boolean;
    step: string;
    error: string;
    manifest_id: any;
    score?: undefined;
    completed?: undefined;
    failed?: undefined;
    total?: undefined;
    status?: undefined;
} | {
    summary: {
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
    ok: boolean;
    step: string;
    manifest_id: any;
    score: number;
    completed: any;
    failed: any;
    total: any;
    status: any;
    error?: undefined;
}>;
/**
 * Get manifest by ID.
 */
export function getManifest(id: any): any;
/**
 * List all manifests (summaries only).
 */
export function listManifests(): {
    id: any;
    phase: any;
    priority: any;
    total_tasks: any;
    completed: any;
    failed: any;
    pending: number;
    progress_pct: number;
    status: any;
}[];
//# sourceMappingURL=pipeline-runner.d.ts.map