export function startSelfAwareness(): void;
export function startBrandingMonitor(): void;
/**
 * METACOGNITIVE ASSESSMENT — The First-Person Awareness Query
 *
 * Before a high-stakes decision, query the system's own recent
 * operational state. Returns a confidence modifier and context string
 * that can be injected into an LLM prompt.
 *
 * This implements the "Internal Monologue Loop" from the blueprint:
 * - Third-person: recent error rates, pattern frequencies
 * - First-person: synthesized self-assessment for LLM injection
 *
 * @param {string} [context] - Optional context about the upcoming decision
 * @returns {Object} { confidence, contextString, recentErrors, recommendations }
 */
export function assessSystemState(context?: string): Object;
/**
 * Ingest a telemetry event into the self-awareness loop.
 * This is the third-person empirical data stream.
 *
 * @param {Object} event - { type, summary, data, severity }
 * @param {string} event.type - Event category (e.g., 'pipeline_failure', 'api_error', 'self_heal')
 * @param {string} event.summary - Human-readable one-line summary
 * @param {Object} event.data - Structured event data
 * @param {string} event.severity - 'info'|'warn'|'error'|'critical'
 */
export function ingestTelemetry(event: {
    type: string;
    summary: string;
    data: Object;
    severity: string;
}): Promise<void>;
export function getBrandingReport(): {
    domains: string[];
    checks: {
        requiredMeta: string[];
        requiredHeaders: string[];
        forbiddenStrings: string[];
        requiredBranding: string[];
    };
    lastScan: null;
    results: {};
    alerts: never[];
    scanCount: number;
    healthy: number;
    degraded: number;
    node: string;
};
export function runBrandingScan(): Promise<void>;
/**
 * Full system introspection — combines all self-awareness streams.
 */
export function getSystemIntrospection(): {
    node: string;
    ts: string;
    uptime: number;
    process: {
        heapUsed: number;
        heapTotal: number;
        rss: number;
        heapUsagePercent: number;
    };
    vectorMemory: any;
    telemetry: {
        totalEvents: number;
        errors: number;
        successes: number;
        warnings: number;
        errorRate1m: number;
        errorRate5m: number;
        ringSize: number;
        categories: {};
        lastEvent: null;
    };
    branding: {
        lastScan: null;
        healthy: number;
        degraded: number;
        scanCount: number;
    };
    services: {
        responseFilter: string;
        modelAbstraction: string;
        providerScrubbing: string;
        contentSafety: string;
    };
};
//# sourceMappingURL=self-awareness.d.ts.map