export class TelemetryCollector {
    /**
     * @param {object} opts
     * @param {boolean} [opts.collectBuiltIns=true]  - Start collecting built-in metrics
     * @param {number}  [opts.builtInIntervalMs=5000] - Collection interval for built-ins
     * @param {number}  [opts.maxSeriesPerMetric=10000]
     */
    constructor(opts?: {
        collectBuiltIns?: boolean | undefined;
        builtInIntervalMs?: number | undefined;
        maxSeriesPerMetric?: number | undefined;
    });
    _collectBuiltIns: boolean;
    _builtInIntervalMs: number;
    _maxSeries: number;
    /** @type {Map<string, MetricFamily>} name → MetricFamily */
    _families: Map<string, MetricFamily>;
    _builtInTimer: NodeJS.Timeout | null;
    /**
     * Record a metric observation.
     * @param {object} metric
     * @param {string}  metric.name    - Metric name (snake_case)
     * @param {string}  metric.type    - 'counter'|'gauge'|'histogram'|'summary'
     * @param {number}  metric.value   - Numeric value
     * @param {object}  [metric.labels]  - Key/value label set
     * @param {string}  [metric.help]    - Description (used on first registration)
     * @param {number}  [metric.timestamp] - Unix ms (defaults to now)
     */
    record(metric: {
        name: string;
        type: string;
        value: number;
        labels?: object | undefined;
        help?: string | undefined;
        timestamp?: number | undefined;
    }): void;
    /**
     * Increment a counter by 1 (or custom amount).
     */
    inc(name: any, labels?: {}, amount?: number): void;
    /**
     * Set a gauge value.
     */
    set(name: any, value: any, labels?: {}): void;
    /**
     * Observe a histogram value (e.g., latency in seconds).
     */
    observe(name: any, value: any, labels?: {}): void;
    /**
     * Query metrics with optional filter.
     * @param {object} filter
     * @param {string}  [filter.name]     - Exact name match
     * @param {string}  [filter.type]     - Filter by type
     * @param {object}  [filter.labels]   - Label subset match
     * @param {number}  [filter.since]    - Only observations after this Unix ms
     * @returns {object[]}
     */
    getMetrics(filter?: {
        name?: string | undefined;
        type?: string | undefined;
        labels?: object | undefined;
        since?: number | undefined;
    }): object[];
    /**
     * Prometheus text-format exposition.
     * @returns {string}
     */
    toPrometheusText(): string;
    /**
     * Stop background collection.
     */
    stop(): void;
    _initBuiltIns(): void;
    _startBuiltInCollection(): void;
    _collectMemory(): void;
    _collectEventLoopLag(): void;
    _getOrCreate(name: any, type: any, help: any): any;
    _getOrCreateSeries(family: any, labelKey: any, labels: any, extraDefaults?: {}): any;
    _recordCounter(family: any, labelKey: any, labels: any, value: any, _ts: any): void;
    _recordGauge(family: any, labelKey: any, labels: any, value: any, _ts: any): void;
    _recordHistogram(family: any, labelKey: any, labels: any, value: any, _ts: any): void;
    _recordSummary(family: any, labelKey: any, labels: any, value: any, _ts: any): void;
    _snapshotSeries(family: any, series: any, since: any): {
        value: any;
        updatedAt: any;
    };
}
export const METRIC_TYPES: Readonly<{
    COUNTER: "counter";
    GAUGE: "gauge";
    HISTOGRAM: "histogram";
    SUMMARY: "summary";
}>;
export namespace BUILT_IN {
    let REQUEST_TOTAL: string;
    let REQUEST_DURATION: string;
    let ERROR_TOTAL: string;
    let MEMORY_BYTES: string;
    let HEAP_BYTES: string;
    let ACTIVE_CONNECTIONS: string;
    let EVENT_LOOP_LAG: string;
}
export const DEFAULT_BUCKETS: number[];
//# sourceMappingURL=telemetry-collector.d.ts.map