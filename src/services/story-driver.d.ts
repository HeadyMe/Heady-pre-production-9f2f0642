export = StoryDriver;
/**
 * HeadyAutobiographer / Story Driver
 *
 * Records system events as structured narrative entries, supports filtered
 * retrieval, and generates human-readable story summaries from event streams.
 *
 * Events are stored in-memory with optional persistence hooks.
 */
declare class StoryDriver extends EventEmitter<[never]> {
    /**
     * Get all supported event types.
     * @returns {object}
     */
    static get EVENT_TYPES(): object;
    /**
     * @param {object} [opts]
     * @param {number}  [opts.maxEntries=10000]  - Max in-memory events before rotation
     * @param {object}  [opts.logger]            - Pino/Winston-compatible logger
     * @param {Function} [opts.persistFn]        - async (entry) => void  — external persistence hook
     */
    constructor({ maxEntries, logger, persistFn }?: {
        maxEntries?: number | undefined;
        logger?: object | undefined;
        persistFn?: Function | undefined;
    });
    _entries: any[];
    _maxEntries: number;
    _persistFn: Function | null;
    _log: object;
    _stats: {
        totalRecorded: number;
        byType: {};
    };
    _defaultLogger(): {
        info: (...a: any[]) => void;
        warn: (...a: any[]) => void;
        error: (...a: any[]) => void;
    };
    _generateId(): string;
    _rotateIfNeeded(): void;
    _generateNarrativeText(event: any, context: any): any;
    _matchesFilters(entry: any, filters: any): boolean;
    /**
     * Record a system event as a narrative entry.
     *
     * @param {string} event      - Event type (see EVENT_TYPES)
     * @param {object} [context]  - Event context and metadata
     * @returns {Promise<object>} The created story entry
     */
    record(event: string, context?: object): Promise<object>;
    /**
     * Retrieve narrative history with optional filters.
     *
     * @param {object} [filters]
     * @param {string}  [filters.type]    - Filter by event type
     * @param {string}  [filters.actor]   - Filter by actor (in context)
     * @param {string}  [filters.service] - Filter by service
     * @param {string}  [filters.from]    - ISO timestamp start
     * @param {string}  [filters.to]      - ISO timestamp end
     * @param {string}  [filters.search]  - Full-text search in narrative+context
     * @param {number}  [filters.limit]   - Max entries to return (default 100)
     * @param {number}  [filters.offset]  - Offset for pagination (default 0)
     * @param {'asc'|'desc'} [filters.order] - Sort order (default 'desc')
     * @returns {Promise<{ entries: object[], total: number, offset: number, limit: number }>}
     */
    getStory(filters?: {
        type?: string | undefined;
        actor?: string | undefined;
        service?: string | undefined;
        from?: string | undefined;
        to?: string | undefined;
        search?: string | undefined;
        limit?: number | undefined;
        offset?: number | undefined;
        order?: "asc" | "desc" | undefined;
    }): Promise<{
        entries: object[];
        total: number;
        offset: number;
        limit: number;
    }>;
    /**
     * Generate a human-readable narrative from a list of events.
     *
     * @param {object[]} events  - Array of event context objects with .event type
     * @returns {Promise<string>}
     */
    generateNarrative(events: object[]): Promise<string>;
    /**
     * Get stats about recorded events.
     * @returns {object}
     */
    getStats(): object;
    /**
     * Clear all in-memory entries (does not affect persisted data).
     */
    clear(): void;
}
import EventEmitter = require("events");
//# sourceMappingURL=story-driver.d.ts.map