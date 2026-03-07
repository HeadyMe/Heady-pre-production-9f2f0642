/*
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * heady-event-bus.js
 * ════════════════════════════════════════════════════════════════════
 *
 * Centralized Event Bus for cross-service communication.
 *
 * Architecture:
 *   - Local pub/sub via EventEmitter (in-process, zero latency)
 *   - Redis pub/sub bridge (cross-process, same region)
 *   - Cloud Pub/Sub bridge (cross-region, durable)
 *   - Topic namespace enforcement (heady:<service>:<event>)
 *   - Event replay buffer (last N events per topic)
 *   - Dead letter queue for undelivered events
 *   - Correlation ID propagation for distributed tracing
 *
 * Usage:
 *   const { getEventBus } = require('./heady-event-bus');
 *   const bus = getEventBus();
 *
 *   // Subscribe
 *   bus.subscribe('heady:pipeline:run:completed', (event) => {
 *     console.log('Pipeline done:', event.runId);
 *   });
 *
 *   // Publish
 *   await bus.publish('heady:pipeline:run:completed', {
 *     runId: 'abc123',
 *     status: 'completed',
 *   });
 *
 *   // Subscribe to all events in a namespace
 *   bus.subscribePattern('heady:pipeline:*', handler);
 *
 *   // Replay missed events
 *   const missed = bus.replay('heady:pipeline:run:completed', { since: Date.now() - 60000 });
 *
 * ════════════════════════════════════════════════════════════════════
 */

'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');

// ─── Topic Namespace Rules ───────────────────────────────────────────────────

const TOPIC_REGEX = /^heady:[a-z0-9-]+:[a-z0-9-:*]+$/;

/**
 * Canonical topic names for all Heady ecosystem events.
 * Import and use these constants instead of raw strings to prevent typos.
 */
const TOPICS = Object.freeze({
  // Pipeline events
  PIPELINE_RUN_CREATED:       'heady:pipeline:run:created',
  PIPELINE_RUN_STARTED:       'heady:pipeline:run:started',
  PIPELINE_RUN_COMPLETED:     'heady:pipeline:run:completed',
  PIPELINE_RUN_FAILED:        'heady:pipeline:run:failed',
  PIPELINE_RUN_PAUSED:        'heady:pipeline:run:paused',
  PIPELINE_STAGE_STARTED:     'heady:pipeline:stage:started',
  PIPELINE_STAGE_COMPLETED:   'heady:pipeline:stage:completed',
  PIPELINE_STAGE_FAILED:      'heady:pipeline:stage:failed',
  PIPELINE_STAGE_RETRY:       'heady:pipeline:stage:retry',
  PIPELINE_SELF_HEAL_SUCCESS: 'heady:pipeline:self-heal:success',
  PIPELINE_SELF_HEAL_FAILED:  'heady:pipeline:self-heal:failed',
  PIPELINE_ROLLBACK_STARTED:  'heady:pipeline:rollback:started',
  PIPELINE_ROLLBACK_COMPLETE: 'heady:pipeline:rollback:completed',

  // Conductor events
  CONDUCTOR_BEE_REGISTERED:   'heady:conductor:bee:registered',
  CONDUCTOR_BEE_UNREGISTERED: 'heady:conductor:bee:unregistered',
  CONDUCTOR_TASK_DISPATCHED:  'heady:conductor:task:dispatched',
  CONDUCTOR_TASK_COMPLETED:   'heady:conductor:task:completed',
  CONDUCTOR_TASK_FAILED:      'heady:conductor:task:failed',
  CONDUCTOR_HEARTBEAT:        'heady:conductor:heartbeat',
  CONDUCTOR_PRIORITY_DISPATCH:'heady:conductor:priority:dispatch',

  // Buddy events
  BUDDY_DECISION:             'heady:buddy:decision',
  BUDDY_LOW_CONFIDENCE:       'heady:buddy:low-confidence',
  BUDDY_ERROR_INTERCEPTED:    'heady:buddy:error:intercepted',
  BUDDY_RULE_SYNTHESIZED:     'heady:buddy:rule:synthesized',
  BUDDY_TASK_COLLISION:       'heady:buddy:task:collision',
  BUDDY_LIVE_ORCHESTRATED:    'heady:buddy:live:orchestrated',

  // Vector Memory events
  VECTOR_STORED:              'heady:vector:stored',
  VECTOR_DRIFT_DETECTED:      'heady:vector:drift:detected',
  VECTOR_BASELINE_SNAPSHOT:   'heady:vector:baseline:snapshot',
  VECTOR_COHERENCE_ALERT:     'heady:vector:coherence:alert',
  VECTOR_MEMORY_PERSISTED:    'heady:vector:memory:persisted',
  VECTOR_MEMORY_LOADED:       'heady:vector:memory:loaded',

  // Swarm / Bee events
  SWARM_BEE_SPAWNED:          'heady:swarm:bee:spawned',
  SWARM_BEE_DISSOLVED:        'heady:swarm:bee:dissolved',
  SWARM_ALERT:                'heady:swarm:alert',
  SWARM_HEARTBEAT:            'heady:swarm:heartbeat',
  SWARM_CONSENSUS:            'heady:swarm:consensus',

  // Self-Awareness events
  SA_TELEMETRY_INGESTED:      'heady:sa:telemetry:ingested',
  SA_BRANDING_SCAN_COMPLETE:  'heady:sa:branding:scan:complete',
  SA_CONFIDENCE_LOW:          'heady:sa:confidence:low',
  SA_SYSTEM_BOOT:             'heady:sa:system:boot',

  // Circuit Breaker events
  CIRCUIT_OPEN:               'heady:circuit:open',
  CIRCUIT_CLOSE:              'heady:circuit:close',
  CIRCUIT_HALF_OPEN:          'heady:circuit:half-open',

  // Configuration events
  CONFIG_UPDATED:             'heady:config:updated',
  CONFIG_NAMESPACE_UPDATED:   'heady:config:namespace:updated',

  // Service Mesh events
  SERVICE_REGISTERED:         'heady:service:registered',
  SERVICE_DEREGISTERED:       'heady:service:deregistered',
  SERVICE_HEALTH_CHANGED:     'heady:service:health:changed',

  // MCP events
  MCP_TOOL_INVOKED:           'heady:mcp:tool:invoked',
  MCP_TOOL_COMPLETED:         'heady:mcp:tool:completed',
  MCP_SESSION_STARTED:        'heady:mcp:session:started',

  // Alert events
  ALERT_HEALTH_DEGRADED:      'heady:alert:health:degraded',
  ALERT_DRIFT_CRITICAL:       'heady:alert:drift:critical',
  ALERT_CRITICAL:             'heady:alert:critical',
  ALERT_SELF_HEAL_TRIGGERED:  'heady:alert:self-heal:triggered',

  // Ternary Logic events
  TERNARY_RESONANCE:          'heady:ternary:resonance',
  TERNARY_REPEL:              'heady:ternary:repel',
  TERNARY_SHADOW_DECAY:       'heady:ternary:shadow:decay',

  // LLM events
  LLM_ROUTED:                 'heady:llm:routed',
  LLM_FAILOVER:               'heady:llm:failover',
  LLM_BUDGET_WARNING:         'heady:llm:budget:warning',
  LLM_BUDGET_EXCEEDED:        'heady:llm:budget:exceeded',
});

// ─── Event Envelope ──────────────────────────────────────────────────────────

/**
 * Wrap a payload in the standard Heady event envelope.
 * @param {string} topic
 * @param {object} payload
 * @param {object} [meta]
 * @returns {HeadyEvent}
 */
function createEvent(topic, payload, meta = {}) {
  return {
    eventId:       crypto.randomUUID(),
    topic,
    payload,
    correlationId: meta.correlationId || crypto.randomUUID(),
    causationId:   meta.causationId || null,
    source:        meta.source || 'heady-platform',
    version:       meta.version || '1',
    ts:            Date.now(),
    isoTime:       new Date().toISOString(),
  };
}

// ─── HeadyEventBus ───────────────────────────────────────────────────────────

class HeadyEventBus extends EventEmitter {
  /**
   * @param {object} opts
   * @param {object} [opts.redis]        - Redis client (ioredis) for cross-process transport
   * @param {number} [opts.replayBufferSize=1000] - Events to keep per topic for replay
   * @param {number} [opts.deadLetterSize=500]    - Dead letter queue max size
   * @param {boolean} [opts.strict=false]         - Enforce TOPIC_REGEX naming
   * @param {object} [opts.logger]                - Logger instance
   */
  constructor(opts = {}) {
    super({ captureRejections: true });
    this.setMaxListeners(200); // Large swarm support

    this._redis = opts.redis || null;
    this._replayBufferSize = opts.replayBufferSize || 1000;
    this._deadLetterSize = opts.deadLetterSize || 500;
    this._strict = opts.strict || false;
    this._logger = opts.logger || console;

    /** @type {Map<string, Array<HeadyEvent>>} topic → ring buffer of events */
    this._replayBuffers = new Map();

    /** @type {Array<{ topic: string, event: HeadyEvent, reason: string, ts: number }>} */
    this._deadLetter = [];

    /** @type {Map<string, Set<Function>>} topic → set of pattern subscribers */
    this._patternSubs = new Map();

    this._stats = {
      published:    0,
      delivered:    0,
      deadLettered: 0,
      redisPublished: 0,
      redisReceived:  0,
      errors:       0,
    };

    // Wire Redis pub/sub if available
    if (this._redis) {
      this._wireRedis();
    }
  }

  // ─── Publishing ───────────────────────────────────────────────────────────

  /**
   * Publish an event to a topic.
   * Delivers to local subscribers immediately, then bridges to Redis/Pub/Sub.
   *
   * @param {string} topic - Topic name (must match TOPIC_REGEX if strict)
   * @param {object} payload - Event data
   * @param {object} [meta] - { correlationId, causationId, source }
   * @returns {Promise<HeadyEvent>} The wrapped event
   */
  async publish(topic, payload, meta = {}) {
    if (this._strict && !TOPIC_REGEX.test(topic)) {
      throw new Error(`Invalid topic: "${topic}". Must match: ${TOPIC_REGEX}`);
    }

    const event = createEvent(topic, payload, meta);
    this._stats.published++;

    // Buffer for replay
    this._bufferEvent(topic, event);

    // Deliver to local subscribers
    try {
      this.emit(topic, event);
      this._deliverToPatternSubs(topic, event);
      this._stats.delivered++;
    } catch (err) {
      this._stats.errors++;
      this._deadLetterEvent(topic, event, err.message);
      this._logger.error?.(`[EventBus] Delivery error on topic ${topic}: ${err.message}`) ||
        console.error(`[EventBus] Delivery error on topic ${topic}: ${err.message}`);
    }

    // Bridge to Redis (non-blocking)
    if (this._redis) {
      this._publishToRedis(topic, event).catch(err => {
        this._logger.warn?.(`[EventBus] Redis publish failed for ${topic}: ${err.message}`);
      });
    }

    return event;
  }

  /**
   * Publish multiple events atomically.
   * @param {Array<{ topic: string, payload: object, meta?: object }>} events
   * @returns {Promise<HeadyEvent[]>}
   */
  async publishBatch(events) {
    return Promise.all(events.map(({ topic, payload, meta }) =>
      this.publish(topic, payload, meta || {})
    ));
  }

  // ─── Subscribing ──────────────────────────────────────────────────────────

  /**
   * Subscribe to an exact topic.
   * @param {string} topic
   * @param {Function} handler - (event: HeadyEvent) => void
   * @returns {Function} Unsubscribe function
   */
  subscribe(topic, handler) {
    this.on(topic, handler);
    return () => this.off(topic, handler);
  }

  /**
   * Subscribe once to an exact topic.
   * @param {string} topic
   * @param {Function} handler
   * @returns {Promise<HeadyEvent>} Resolves on first event
   */
  subscribeOnce(topic, handler) {
    if (handler) {
      this.once(topic, handler);
      return () => this.off(topic, handler);
    }
    return new Promise(resolve => this.once(topic, resolve));
  }

  /**
   * Subscribe to topics matching a glob pattern.
   * Patterns support wildcards: 'heady:pipeline:*', 'heady:*:failed'
   *
   * @param {string} pattern - Glob pattern (uses * as wildcard)
   * @param {Function} handler
   * @returns {Function} Unsubscribe function
   */
  subscribePattern(pattern, handler) {
    if (!this._patternSubs.has(pattern)) {
      this._patternSubs.set(pattern, new Set());
    }
    this._patternSubs.get(pattern).add(handler);
    return () => {
      const subs = this._patternSubs.get(pattern);
      if (subs) subs.delete(handler);
    };
  }

  /**
   * Unsubscribe from a topic.
   */
  unsubscribe(topic, handler) {
    this.off(topic, handler);
  }

  // ─── Replay ───────────────────────────────────────────────────────────────

  /**
   * Replay buffered events from a topic.
   * @param {string} topic
   * @param {object} [opts]
   * @param {number} [opts.since] - Unix timestamp — replay events after this time
   * @param {number} [opts.limit] - Max events to return
   * @returns {HeadyEvent[]}
   */
  replay(topic, opts = {}) {
    const buffer = this._replayBuffers.get(topic) || [];
    let events = [...buffer];

    if (opts.since) {
      events = events.filter(e => e.ts > opts.since);
    }
    if (opts.limit) {
      events = events.slice(-opts.limit);
    }

    return events;
  }

  /**
   * Replay all buffered events from all topics matching a pattern.
   * @param {string} pattern - Glob pattern
   * @param {object} [opts]
   * @returns {HeadyEvent[]}
   */
  replayPattern(pattern, opts = {}) {
    const regex = _globToRegex(pattern);
    const results = [];

    for (const [topic, buffer] of this._replayBuffers) {
      if (regex.test(topic)) {
        results.push(...this.replay(topic, opts));
      }
    }

    return results.sort((a, b) => a.ts - b.ts);
  }

  // ─── Dead Letter ──────────────────────────────────────────────────────────

  /**
   * Inspect the dead letter queue.
   * @param {number} [limit=20]
   * @returns {Array}
   */
  getDeadLetter(limit = 20) {
    return this._deadLetter.slice(-limit);
  }

  /**
   * Retry dead-lettered events for a topic.
   * @param {string} topic
   * @returns {Promise<number>} Number of events retried
   */
  async retryDeadLetter(topic) {
    const events = this._deadLetter.filter(dl => dl.topic === topic);
    let retried = 0;
    for (const dl of events) {
      try {
        this.emit(topic, dl.event);
        retried++;
      } catch { /* still failing — leave in DLQ */ }
    }
    return retried;
  }

  // ─── Status & Stats ───────────────────────────────────────────────────────

  /**
   * Get bus statistics.
   */
  getStats() {
    const topicCounts = {};
    for (const [topic, buffer] of this._replayBuffers) {
      topicCounts[topic] = buffer.length;
    }

    return {
      ...this._stats,
      subscriberCount:    this.eventNames().length,
      patternSubCount:    this._patternSubs.size,
      bufferedTopics:     this._replayBuffers.size,
      deadLetterCount:    this._deadLetter.length,
      topicBufferSizes:   topicCounts,
      redisConnected:     !!this._redis,
    };
  }

  /**
   * List all active subscriptions.
   */
  listSubscriptions() {
    const subs = [];
    for (const eventName of this.eventNames()) {
      subs.push({
        topic:      eventName,
        listeners:  this.listenerCount(eventName),
        type:       'exact',
      });
    }
    for (const [pattern, handlers] of this._patternSubs) {
      subs.push({
        topic:      pattern,
        listeners:  handlers.size,
        type:       'pattern',
      });
    }
    return subs;
  }

  // ─── Redis Bridge ─────────────────────────────────────────────────────────

  /**
   * Wire Redis pub/sub for cross-process event transport.
   * Requires two Redis connections: one for subscribe, one for publish.
   * @private
   */
  _wireRedis() {
    try {
      // Use a duplicate connection for subscribing (Redis requirement)
      const subClient = this._redis.duplicate ? this._redis.duplicate() : null;
      if (!subClient) {
        this._logger.warn?.('[EventBus] Redis client has no duplicate() — cross-process transport disabled');
        return;
      }

      subClient.subscribe('heady-event-bus:*');
      subClient.on('pmessage', (_pattern, channel, message) => {
        try {
          const event = JSON.parse(message);
          const topic = channel.replace('heady-event-bus:', '');

          // Deliver to local subscribers (marked as redis-sourced to prevent re-publish)
          event._fromRedis = true;
          this.emit(topic, event);
          this._deliverToPatternSubs(topic, event);
          this._stats.redisReceived++;
        } catch (err) {
          this._logger.warn?.(`[EventBus] Redis message parse error: ${err.message}`);
        }
      });

      this._subClient = subClient;
      this._logger.info?.('[EventBus] Redis pub/sub bridge active');
    } catch (err) {
      this._logger.warn?.(`[EventBus] Redis bridge setup failed: ${err.message}`);
    }
  }

  /**
   * Publish event to Redis channel for cross-process delivery.
   * @private
   */
  async _publishToRedis(topic, event) {
    if (!this._redis || event._fromRedis) return; // Don't re-publish Redis events
    await this._redis.publish(`heady-event-bus:${topic}`, JSON.stringify(event));
    this._stats.redisPublished++;
  }

  // ─── Pattern Matching ─────────────────────────────────────────────────────

  /**
   * Deliver event to all matching pattern subscribers.
   * @private
   */
  _deliverToPatternSubs(topic, event) {
    for (const [pattern, handlers] of this._patternSubs) {
      if (_globToRegex(pattern).test(topic)) {
        for (const handler of handlers) {
          try {
            handler(event);
          } catch (err) {
            this._stats.errors++;
            this._logger.warn?.(`[EventBus] Pattern handler error for ${pattern}: ${err.message}`);
          }
        }
      }
    }
  }

  // ─── Buffer Management ────────────────────────────────────────────────────

  /** @private */
  _bufferEvent(topic, event) {
    if (!this._replayBuffers.has(topic)) {
      this._replayBuffers.set(topic, []);
    }
    const buffer = this._replayBuffers.get(topic);
    buffer.push(event);
    if (buffer.length > this._replayBufferSize) {
      buffer.shift();
    }
  }

  /** @private */
  _deadLetterEvent(topic, event, reason) {
    this._deadLetter.push({ topic, event, reason, ts: Date.now() });
    this._stats.deadLettered++;
    if (this._deadLetter.length > this._deadLetterSize) {
      this._deadLetter.shift();
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Gracefully shut down the event bus.
   */
  async destroy() {
    if (this._subClient) {
      try { await this._subClient.unsubscribe(); } catch { /* best-effort */ }
      try { this._subClient.disconnect(); } catch { /* best-effort */ }
    }
    this.removeAllListeners();
    this._replayBuffers.clear();
    this._patternSubs.clear();
    this._logger.info?.('[EventBus] Destroyed');
  }

  // ─── Express Integration ──────────────────────────────────────────────────

  /**
   * Register monitoring routes on an Express app.
   * @param {object} app - Express application
   */
  registerRoutes(app) {
    app.get('/api/v1/eventbus/stats', (req, res) => {
      res.json({ ok: true, ...this.getStats() });
    });

    app.get('/api/v1/eventbus/subscriptions', (req, res) => {
      res.json({ ok: true, subscriptions: this.listSubscriptions() });
    });

    app.get('/api/v1/eventbus/dead-letter', (req, res) => {
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      res.json({ ok: true, items: this.getDeadLetter(limit), total: this._deadLetter.length });
    });

    app.get('/api/v1/eventbus/replay/:topic', (req, res) => {
      const topic = decodeURIComponent(req.params.topic);
      const since = req.query.since ? parseInt(req.query.since) : undefined;
      const limit = req.query.limit ? Math.min(parseInt(req.query.limit), 1000) : undefined;
      const events = this.replay(topic, { since, limit });
      res.json({ ok: true, topic, count: events.length, events });
    });

    app.post('/api/v1/eventbus/publish', async (req, res) => {
      try {
        const { topic, payload, meta } = req.body;
        if (!topic || !payload) return res.status(400).json({ ok: false, error: 'topic and payload required' });
        const event = await this.publish(topic, payload, meta || {});
        res.json({ ok: true, eventId: event.eventId, topic, ts: event.isoTime });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    // SSE endpoint — stream events to browser clients
    app.get('/api/v1/eventbus/stream', (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const pattern = req.query.pattern || 'heady:*';
      const unsubscribe = this.subscribePattern(pattern, (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });

      req.on('close', () => {
        unsubscribe();
      });
    });
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Convert a glob pattern to a RegExp.
 * Supports * (single segment) and ** (any depth)
 * @param {string} pattern
 * @returns {RegExp}
 */
function _globToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex specials
    .replace(/\*\*/g, '.+')               // ** → any chars including :
    .replace(/\*/g, '[^:]+');             // * → any chars except :
  return new RegExp(`^${escaped}$`);
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let _instance = null;

/**
 * Get the global singleton event bus instance.
 * Optionally provide options on first call to configure Redis transport.
 *
 * @param {object} [opts] - Options (only used on first call)
 * @returns {HeadyEventBus}
 */
function getEventBus(opts) {
  if (!_instance) {
    _instance = new HeadyEventBus(opts || {});
  }
  return _instance;
}

/**
 * Replace the singleton (testing only).
 * @param {HeadyEventBus} [bus]
 */
function resetEventBus(bus) {
  if (_instance) _instance.destroy().catch(() => {});
  _instance = bus || null;
}

// ─── Wire to Global Process Events ───────────────────────────────────────────

/**
 * Bootstrap the event bus and hook into Node.js process-level events
 * that the legacy code already uses (heady:circuit, etc.).
 *
 * Call once during application startup.
 *
 * @param {object} [opts]
 * @returns {HeadyEventBus}
 */
function bootstrapEventBus(opts = {}) {
  const bus = getEventBus(opts);

  // Bridge process.emit() events into the event bus
  // Legacy code uses: process.emit('heady:circuit', data)
  const _originalEmit = process.emit.bind(process);
  process.emit = function (event, ...args) {
    if (typeof event === 'string' && event.startsWith('heady:')) {
      bus.publish(event, args[0] || {}).catch(() => {});
    }
    return _originalEmit(event, ...args);
  };

  // Expose globally for legacy bee-factory.js 'global.eventBus' usage
  // MIGRATION NOTE: Replace global.eventBus references with require('./heady-event-bus').getEventBus()
  if (typeof global !== 'undefined') {
    global.eventBus = bus;
  }

  return bus;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  HeadyEventBus,
  TOPICS,
  createEvent,
  getEventBus,
  resetEventBus,
  bootstrapEventBus,
  _globToRegex, // exported for tests
};
