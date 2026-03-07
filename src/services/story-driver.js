/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */
'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPES = Object.freeze({
  ACTION_TAKEN:       'action_taken',
  DECISION_MADE:      'decision_made',
  ERROR_ENCOUNTERED:  'error_encountered',
  HEALING_PERFORMED:  'healing_performed',
  MILESTONE_REACHED:  'milestone_reached',
  LEARNING_CAPTURED:  'learning_captured',
  NODE_STARTED:       'node_started',
  NODE_STOPPED:       'node_stopped',
  PIPELINE_RUN:       'pipeline_run',
  TOOL_CALLED:        'tool_called',
  GOVERNANCE_CHECKED: 'governance_checked',
  BEE_SPAWNED:        'bee_spawned',
  DRIFT_DETECTED:     'drift_detected',
});

const EVENT_TEMPLATES = {
  action_taken:       (e) => `[Action] ${e.actor || 'System'} ${e.description || 'performed an action'}${e.target ? ` on ${e.target}` : ''}.`,
  decision_made:      (e) => `[Decision] ${e.actor || 'Conductor'} decided to ${e.description || 'proceed'}. Rationale: ${e.rationale || 'not specified'}.`,
  error_encountered:  (e) => `[Error] ${e.service || 'Unknown service'} encountered ${e.errorType || 'an error'}: ${e.description || e.message || 'no details'}.`,
  healing_performed:  (e) => `[Healing] Self-healing triggered on ${e.target || 'unknown component'}: ${e.description || 'recovery action performed'}.`,
  milestone_reached:  (e) => `[Milestone] ${e.description || 'A milestone was reached'}.${e.value ? ` Value: ${e.value}.` : ''}`,
  learning_captured:  (e) => `[Learning] New insight captured: ${e.description || 'knowledge updated'}.`,
  node_started:       (e) => `[Node] ${e.node || 'Unknown node'} came online at ${e.endpoint || 'unknown endpoint'}.`,
  node_stopped:       (e) => `[Node] ${e.node || 'Unknown node'} went offline. Reason: ${e.reason || 'not specified'}.`,
  pipeline_run:       (e) => `[Pipeline] HCFullPipeline executed with task: "${e.task || 'unspecified'}". Status: ${e.status || 'completed'}.`,
  tool_called:        (e) => `[Tool] MCP tool '${e.tool || 'unknown'}' called${e.actor ? ` by ${e.actor}` : ''}. Result: ${e.result || 'success'}.`,
  governance_checked: (e) => `[Governance] Action "${e.action || 'unspecified'}" validated. Decision: ${e.decision || 'approved'}.`,
  bee_spawned:        (e) => `[Bee] Agent bee spawned for domain '${e.domain || 'general'}' with ID ${e.beeId || 'unknown'}.`,
  drift_detected:     (e) => `[Drift] Semantic drift detected in component '${e.componentId || 'unknown'}'. Magnitude: ${e.magnitude || 'unknown'}.`,
};

// ─── StoryDriver ──────────────────────────────────────────────────────────────

/**
 * HeadyAutobiographer / Story Driver
 *
 * Records system events as structured narrative entries, supports filtered
 * retrieval, and generates human-readable story summaries from event streams.
 *
 * Events are stored in-memory with optional persistence hooks.
 */
class StoryDriver extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {number}  [opts.maxEntries=10000]  - Max in-memory events before rotation
   * @param {object}  [opts.logger]            - Pino/Winston-compatible logger
   * @param {Function} [opts.persistFn]        - async (entry) => void  — external persistence hook
   */
  constructor({ maxEntries = 10000, logger, persistFn } = {}) {
    super();
    this._entries = [];
    this._maxEntries = maxEntries;
    this._persistFn = persistFn || null;
    this._log = logger || this._defaultLogger();

    this._stats = {
      totalRecorded: 0,
      byType: {},
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  _defaultLogger() {
    return {
      info:  (...a) => {},  // Silent by default in story driver
      warn:  (...a) => console.error('[StoryDriver:WARN]',  ...a),
      error: (...a) => console.error('[StoryDriver:ERROR]', ...a),
    };
  }

  _generateId() {
    return `story_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  _rotateIfNeeded() {
    if (this._entries.length >= this._maxEntries) {
      // Remove oldest 10% to make room
      const removeCount = Math.floor(this._maxEntries * 0.1);
      this._entries.splice(0, removeCount);
      this._log.warn(`Story rotation: removed ${removeCount} oldest entries`);
    }
  }

  _generateNarrativeText(event, context) {
    const template = EVENT_TEMPLATES[event];
    if (template) {
      return template(context || {});
    }
    return `[Event] ${event}: ${JSON.stringify(context || {})}`;
  }

  _matchesFilters(entry, filters) {
    if (!filters) return true;

    if (filters.type && entry.event !== filters.type) return false;
    if (filters.actor && entry.context && entry.context.actor !== filters.actor) return false;
    if (filters.service && entry.context && entry.context.service !== filters.service) return false;
    if (filters.from && new Date(entry.timestamp) < new Date(filters.from)) return false;
    if (filters.to && new Date(entry.timestamp) > new Date(filters.to)) return false;
    if (filters.search) {
      const needle = filters.search.toLowerCase();
      const haystack = entry.narrative.toLowerCase() + JSON.stringify(entry.context || {}).toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    return true;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Record a system event as a narrative entry.
   *
   * @param {string} event      - Event type (see EVENT_TYPES)
   * @param {object} [context]  - Event context and metadata
   * @returns {Promise<object>} The created story entry
   */
  async record(event, context = {}) {
    if (!event) throw new Error('Event type is required');

    this._rotateIfNeeded();

    const entry = {
      id: this._generateId(),
      event,
      timestamp: new Date().toISOString(),
      context,
      narrative: this._generateNarrativeText(event, context),
    };

    this._entries.push(entry);

    // Update stats
    this._stats.totalRecorded++;
    this._stats.byType[event] = (this._stats.byType[event] || 0) + 1;

    // Persist if hook provided
    if (this._persistFn) {
      try {
        await this._persistFn(entry);
      } catch (err) {
        this._log.error('Story persistence error', { error: err.message, entryId: entry.id });
      }
    }

    // Emit for realtime consumers
    this.emit('entry', entry);
    this.emit(event, entry);

    return entry;
  }

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
  async getStory(filters = {}) {
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    const order = filters.order || 'desc';

    let matched = this._entries.filter((e) => this._matchesFilters(e, filters));

    // Sort
    matched.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return order === 'asc' ? ta - tb : tb - ta;
    });

    const total = matched.length;
    const page = matched.slice(offset, offset + limit);

    return { entries: page, total, offset, limit };
  }

  /**
   * Generate a human-readable narrative from a list of events.
   *
   * @param {object[]} events  - Array of event context objects with .event type
   * @returns {Promise<string>}
   */
  async generateNarrative(events) {
    if (!events || events.length === 0) {
      return 'No events to narrate.';
    }

    const lines = [];
    const timespan = events.length > 0
      ? `${new Date(events[0].timestamp || Date.now()).toLocaleString()} → ${new Date(events[events.length - 1].timestamp || Date.now()).toLocaleString()}`
      : 'unknown timespan';

    lines.push(`# Heady System Narrative`);
    lines.push(`**Period:** ${timespan}`);
    lines.push(`**Events:** ${events.length}`);
    lines.push('');

    // Group by event type for summary
    const byType = {};
    for (const e of events) {
      const type = e.event || 'unknown';
      byType[type] = (byType[type] || []);
      byType[type].push(e);
    }

    // Executive summary
    lines.push('## Summary');
    for (const [type, entries] of Object.entries(byType)) {
      lines.push(`- **${type}**: ${entries.length} occurrence(s)`);
    }
    lines.push('');

    // Chronological narrative
    lines.push('## Chronological Log');
    for (const e of events) {
      const ts = e.timestamp ? new Date(e.timestamp).toISOString() : new Date().toISOString();
      const narrative = e.narrative || this._generateNarrativeText(e.event, e.context);
      lines.push(`- \`${ts}\` ${narrative}`);
    }

    // Highlight errors if any
    const errors = events.filter((e) => e.event === EVENT_TYPES.ERROR_ENCOUNTERED);
    if (errors.length > 0) {
      lines.push('');
      lines.push('## Errors Encountered');
      for (const e of errors) {
        const ctx = e.context || {};
        lines.push(`- **${ctx.service || 'Unknown'}**: ${ctx.description || ctx.message || 'No details'}`);
      }
    }

    // Healing events
    const healings = events.filter((e) => e.event === EVENT_TYPES.HEALING_PERFORMED);
    if (healings.length > 0) {
      lines.push('');
      lines.push('## Self-Healing Actions');
      for (const h of healings) {
        const ctx = h.context || {};
        lines.push(`- ${ctx.description || 'Recovery performed'} on ${ctx.target || 'unknown component'}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get stats about recorded events.
   * @returns {object}
   */
  getStats() {
    return {
      ...this._stats,
      inMemory: this._entries.length,
      maxEntries: this._maxEntries,
    };
  }

  /**
   * Get all supported event types.
   * @returns {object}
   */
  static get EVENT_TYPES() {
    return EVENT_TYPES;
  }

  /**
   * Clear all in-memory entries (does not affect persisted data).
   */
  clear() {
    this._entries = [];
    this._log.warn('Story entries cleared from memory');
  }
}

module.exports = StoryDriver;
