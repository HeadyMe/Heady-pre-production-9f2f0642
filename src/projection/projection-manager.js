/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */
'use strict';

const { EventEmitter } = require('events');
const logger = require('../utils/logger').child('projection-manager');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PHI = 1.6180339887;

/** Priority levels for projection types (lower number = higher priority). */
const PRIORITY = {
  CRITICAL: 0,
  HIGH:     1,
  MEDIUM:   2,
  LOW:      3,
};

/** Default configurations per projection type. */
const DEFAULT_PROJECTION_CONFIGS = {
  'health':        { priority: PRIORITY.CRITICAL, intervalMs: PHI * 3000,  debounceMs: PHI * 500  },
  'config':        { priority: PRIORITY.CRITICAL, intervalMs: PHI * 5000,  debounceMs: PHI * 500  },
  'vector-memory': { priority: PRIORITY.HIGH,     intervalMs: PHI * 8000,  debounceMs: PHI * 1000 },
  'agent-state':   { priority: PRIORITY.HIGH,     intervalMs: PHI * 8000,  debounceMs: PHI * 1000 },
  'task-queue':    { priority: PRIORITY.MEDIUM,   intervalMs: PHI * 10000, debounceMs: PHI * 1000 },
  'telemetry':     { priority: PRIORITY.MEDIUM,   intervalMs: PHI * 5000,  debounceMs: PHI * 1000 },
  'topology':      { priority: PRIORITY.LOW,      intervalMs: PHI * 10000, debounceMs: PHI * 2000 },
};

/** Global.eventBus event names that trigger projection updates. */
const TRIGGER_MAP = {
  'vector:updated':          'vector-memory',
  'agent:state-changed':     'agent-state',
  'swarm:topology-changed':  'topology',
  'task:queued':             'task-queue',
  'task:completed':          'task-queue',
  'telemetry:ingested':      'telemetry',
  'config:changed':          'config',
  'health:checked':          'health',
};

// ---------------------------------------------------------------------------
// ProjectionEntry  (internal data structure)
// ---------------------------------------------------------------------------
class ProjectionEntry {
  constructor(type, config = {}) {
    this.type       = type;
    this.priority   = config.priority   ?? PRIORITY.MEDIUM;
    this.intervalMs = config.intervalMs ?? PHI * 10000;
    this.debounceMs = config.debounceMs ?? PHI * 1000;

    // Runtime state
    this.state      = null;
    this.version    = 0;
    this.updatedAt  = null;
    this.updateCount = 0;
    this.paused     = false;

    // Debounce / interval handles
    this._debounceTimer   = null;
    this._intervalHandle  = null;
    this._pendingData     = [];
  }
}

// ---------------------------------------------------------------------------
// PriorityQueue  (min-heap on priority then insertion order)
// ---------------------------------------------------------------------------
class PriorityQueue {
  constructor() {
    this._heap = [];
    this._seq  = 0;
  }

  enqueue(type, priority) {
    const seq  = this._seq++;
    this._heap.push({ type, priority, seq });
    this._bubbleUp(this._heap.length - 1);
  }

  dequeue() {
    if (this._heap.length === 0) return null;
    this._swap(0, this._heap.length - 1);
    const item = this._heap.pop();
    this._siftDown(0);
    return item.type;
  }

  get size() { return this._heap.length; }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this._lt(i, parent)) { this._swap(i, parent); i = parent; } else break;
    }
  }

  _siftDown(i) {
    const n = this._heap.length;
    while (true) {
      let min = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this._lt(l, min)) min = l;
      if (r < n && this._lt(r, min)) min = r;
      if (min === i) break;
      this._swap(i, min);
      i = min;
    }
  }

  _lt(a, b) {
    const ha = this._heap[a], hb = this._heap[b];
    return ha.priority < hb.priority || (ha.priority === hb.priority && ha.seq < hb.seq);
  }

  _swap(a, b) {
    [this._heap[a], this._heap[b]] = [this._heap[b], this._heap[a]];
  }
}

// ---------------------------------------------------------------------------
// ProjectionManager
// ---------------------------------------------------------------------------
class ProjectionManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.setMaxListeners(50);

    this._options        = options;
    this._projections    = new Map();   // type -> ProjectionEntry
    this._queue          = new PriorityQueue();
    this._processing     = false;
    this._running        = false;
    this._paused         = false;
    this._updateCount    = 0;
    this._startedAt      = null;
    this._shutdownHooks  = [];          // LIFO array of { name, fn }

    // Bind global.eventBus listeners so we can remove them on stop
    this._busListeners = {};

    // Register default projection types
    for (const [type, cfg] of Object.entries(DEFAULT_PROJECTION_CONFIGS)) {
      this._registerProjectionInternal(type, cfg);
    }

    logger.info('ProjectionManager constructed', {
      defaultTypes: [...this._projections.keys()],
      phiBase: PHI,
    });
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Start the projection manager: attach event-bus listeners, start intervals.
   */
  start() {
    if (this._running) {
      logger.warn('ProjectionManager.start() called while already running');
      return this;
    }

    this._running   = true;
    this._paused    = false;
    this._startedAt = Date.now();

    this._attachEventBusListeners();
    this._startIntervals();

    this._onShutdown('projection-manager-intervals', () => this._stopIntervals());
    this._onShutdown('projection-manager-bus',       () => this._detachEventBusListeners());

    logger.info('ProjectionManager started', { startedAt: new Date(this._startedAt).toISOString() });
    this.emit('manager:started', { startedAt: this._startedAt });

    return this;
  }

  /** Stop the projection manager gracefully (LIFO shutdown hooks). */
  async stop() {
    if (!this._running) return;
    this._running = false;

    logger.info('ProjectionManager stopping, running LIFO shutdown hooks…');

    // Execute hooks in LIFO order
    for (let i = this._shutdownHooks.length - 1; i >= 0; i--) {
      const { name, fn } = this._shutdownHooks[i];
      try {
        await Promise.resolve(fn());
        logger.debug('Shutdown hook completed', { name });
      } catch (err) {
        logger.error('Shutdown hook error', { name, err: err.message });
      }
    }

    this._clearAllDebounces();
    this.emit('manager:stopped', { stoppedAt: Date.now() });
    logger.info('ProjectionManager stopped');
  }

  /** Pause all updates (intervals keep ticking but no state changes). */
  pause() {
    this._paused = true;
    for (const entry of this._projections.values()) entry.paused = true;
    logger.info('ProjectionManager paused');
    this.emit('manager:paused');
    return this;
  }

  /** Resume all updates. */
  resume() {
    this._paused = false;
    for (const entry of this._projections.values()) entry.paused = false;
    logger.info('ProjectionManager resumed');
    this.emit('manager:resumed');
    return this;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Register a new projection type (or overwrite existing config).
   * @param {string} type
   * @param {object} config  { priority, intervalMs, debounceMs }
   */
  registerProjection(type, config = {}) {
    if (!type || typeof type !== 'string') throw new TypeError('projection type must be a non-empty string');
    this._registerProjectionInternal(type, config);

    if (this._running) {
      const entry = this._projections.get(type);
      this._startInterval(type, entry);
    }

    logger.info('Projection registered', { type, config });
    return this;
  }

  /**
   * Trigger an immediate (debounced) update for a projection type.
   * @param {string} type
   * @param {*}      data   Arbitrary payload passed to listeners
   */
  triggerUpdate(type, data) {
    const entry = this._projections.get(type);
    if (!entry) {
      logger.warn('triggerUpdate called for unknown projection type', { type });
      return this;
    }
    if (entry.paused || this._paused) return this;

    entry._pendingData.push({ data, ts: Date.now() });

    // Debounce: reset timer on each call within the window
    if (entry._debounceTimer) clearTimeout(entry._debounceTimer);
    entry._debounceTimer = setTimeout(() => {
      const batched = entry._pendingData.splice(0);
      this._executeUpdate(type, batched);
    }, entry.debounceMs);

    return this;
  }

  /**
   * Return the current projection state for a given type.
   * @param {string} type
   * @returns {{ type, state, version, updatedAt } | null}
   */
  getProjection(type) {
    const entry = this._projections.get(type);
    if (!entry) return null;
    return this._serializeEntry(entry);
  }

  /**
   * Return all current projection states.
   * @returns {object[]}
   */
  getAllProjections() {
    const result = {};
    for (const [type, entry] of this._projections) {
      result[type] = this._serializeEntry(entry);
    }
    return result;
  }

  /**
   * Export a full snapshot of all projection states.
   * @returns {{ snapshotAt: number, projections: object }}
   */
  snapshot() {
    return {
      snapshotAt:  Date.now(),
      projections: this.getAllProjections(),
    };
  }

  /**
   * Compute delta between two snapshots produced by snapshot().
   * Returns only projection types whose version changed.
   * @param {object} before
   * @param {object} after
   * @returns {object}
   */
  diff(before, after) {
    const delta = { from: before.snapshotAt, to: after.snapshotAt, changed: {} };
    const allTypes = new Set([
      ...Object.keys(before.projections || {}),
      ...Object.keys(after.projections  || {}),
    ]);

    for (const type of allTypes) {
      const b = (before.projections || {})[type];
      const a = (after.projections  || {})[type];

      if (!b && a)       { delta.changed[type] = { op: 'added',   after: a };           continue; }
      if (b && !a)       { delta.changed[type] = { op: 'removed', before: b };          continue; }
      if (b.version !== a.version) {
        delta.changed[type] = { op: 'updated', versionBefore: b.version, versionAfter: a.version, after: a };
      }
    }

    return delta;
  }

  /**
   * Health and operational status.
   */
  getStatus() {
    const projectionSummary = {};
    for (const [type, entry] of this._projections) {
      projectionSummary[type] = {
        priority:    entry.priority,
        version:     entry.version,
        updatedAt:   entry.updatedAt,
        updateCount: entry.updateCount,
        paused:      entry.paused,
        queueDepth:  entry._pendingData.length,
      };
    }

    return {
      running:          this._running,
      paused:           this._paused,
      startedAt:        this._startedAt,
      uptimeMs:         this._startedAt ? Date.now() - this._startedAt : 0,
      totalUpdateCount: this._updateCount,
      queueDepth:       this._queue.size,
      projectionCount:  this._projections.size,
      projections:      projectionSummary,
    };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  _registerProjectionInternal(type, config) {
    const existing = this._projections.get(type);
    if (existing) {
      // Merge new config over existing
      Object.assign(existing, {
        priority:   config.priority   ?? existing.priority,
        intervalMs: config.intervalMs ?? existing.intervalMs,
        debounceMs: config.debounceMs ?? existing.debounceMs,
      });
    } else {
      this._projections.set(type, new ProjectionEntry(type, config));
    }
  }

  _attachEventBusListeners() {
    if (!global.eventBus) {
      logger.warn('global.eventBus not found — skipping event-bus integration');
      return;
    }

    for (const [event, projectionType] of Object.entries(TRIGGER_MAP)) {
      const listener = (data) => {
        logger.debug('eventBus event received', { event, projectionType });
        this.triggerUpdate(projectionType, data);
      };
      this._busListeners[event] = listener;
      global.eventBus.on(event, listener);
    }

    logger.debug('Event-bus listeners attached', { events: Object.keys(TRIGGER_MAP) });
  }

  _detachEventBusListeners() {
    if (!global.eventBus) return;
    for (const [event, listener] of Object.entries(this._busListeners)) {
      global.eventBus.off(event, listener);
    }
    this._busListeners = {};
    logger.debug('Event-bus listeners detached');
  }

  _startIntervals() {
    for (const [type, entry] of this._projections) {
      this._startInterval(type, entry);
    }
  }

  _startInterval(type, entry) {
    if (entry._intervalHandle) clearInterval(entry._intervalHandle);
    entry._intervalHandle = setInterval(() => {
      if (!this._paused && !entry.paused) {
        this.triggerUpdate(type, { source: 'interval', ts: Date.now() });
      }
    }, entry.intervalMs);
  }

  _stopIntervals() {
    for (const entry of this._projections.values()) {
      if (entry._intervalHandle) {
        clearInterval(entry._intervalHandle);
        entry._intervalHandle = null;
      }
    }
  }

  _clearAllDebounces() {
    for (const entry of this._projections.values()) {
      if (entry._debounceTimer) {
        clearTimeout(entry._debounceTimer);
        entry._debounceTimer = null;
      }
    }
  }

  _executeUpdate(type, batchedEvents) {
    const entry = this._projections.get(type);
    if (!entry) return;

    const prevVersion = entry.version;
    entry.version++;
    entry.updatedAt  = Date.now();
    entry.updateCount++;
    this._updateCount++;

    // Merge incoming payloads into state
    const mergedData = batchedEvents.reduce((acc, { data }) => {
      if (data && typeof data === 'object') return { ...acc, ...data };
      return acc;
    }, entry.state || {});

    entry.state = {
      ...mergedData,
      _type:      type,
      _version:   entry.version,
      _updatedAt: entry.updatedAt,
    };

    const projection = this._serializeEntry(entry);

    logger.debug('Projection updated', {
      type,
      version: entry.version,
      prevVersion,
      batchSize: batchedEvents.length,
    });

    // Emit on this manager (SSE endpoint subscribes here)
    this.emit('projection:updated', { type, projection });

    // Also broadcast on global.eventBus for cross-component consumption
    if (global.eventBus) {
      global.eventBus.emit('projection:updated', { type, projection });
      global.eventBus.emit(`projection:${type}`, projection);
    }
  }

  _serializeEntry(entry) {
    return {
      type:        entry.type,
      state:       entry.state,
      version:     entry.version,
      updatedAt:   entry.updatedAt,
      updateCount: entry.updateCount,
      priority:    entry.priority,
    };
  }

  /** Register a LIFO shutdown hook. */
  _onShutdown(name, fn) {
    this._shutdownHooks.push({ name, fn });
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------
let _instance = null;

/**
 * Get or create the singleton ProjectionManager instance.
 * @param {object} [options]
 * @returns {ProjectionManager}
 */
function getProjectionManager(options = {}) {
  if (!_instance) {
    _instance = new ProjectionManager(options);
  }
  return _instance;
}

module.exports = { ProjectionManager, getProjectionManager, PHI, PRIORITY };
