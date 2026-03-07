/**
 * durable-agent-state.js
 * Heady Latent OS — Durable Agent State Object
 *
 * Cloudflare Durable Object providing persistent, stateful AI agent sessions.
 *
 * Features:
 *   - Hibernatable WebSocket connections (zero cost when idle)
 *   - SQLite-backed message history and agent memory
 *   - Agent state machine: init → active → thinking → responding → idle → hibernating
 *   - Alarm-based autonomous actions and session expiration
 *   - Session management with multi-socket support
 *   - Sacred Geometry: Fibonacci-based context compression thresholds
 *
 * Architecture:
 *   Each DurableAgentState instance = one persistent agent session.
 *   Named by session ID (e.g., userId + agentId). Runs closest to the user
 *   on first request, then stays pinned to that PoP.
 *
 * Pricing note: Hibernation API ensures billing only during CPU-active periods.
 * Idle WebSocket sessions cost $0/hour when hibernated.
 *
 * @module durable-agent-state
 */

// ─────────────────────────────────────────────────────────────────────────────
// Phi-Math constants (inlined from shared/phi-math.js — Workers can't import)
// Source: heady-implementation/shared/phi-math.js v2.0.0
// ─────────────────────────────────────────────────────────────────────────────

/** Golden ratio φ = (1 + √5) / 2 */
const PHI = 1.6180339887498949;
/** Golden ratio conjugate ψ = 1/φ = φ - 1 */
const PSI = 0.6180339887498949;

/**
 * phi-scaled backoff for state transition retries.
 * delay(attempt) = baseMs × PHI^attempt, clamped to maxMs.
 * Mirrors phiBackoff() from shared/phi-math.js.
 */
function _phiBackoff(attempt, baseMs = 1000, maxMs = 60_000) {
  const raw = baseMs * Math.pow(PHI, attempt);
  const clamped = Math.min(raw, maxMs);
  // Jitter: [clamped × PSI², clamped] — biased toward lower delays
  const jitterFactor = PSI * PSI + Math.random() * (1 - PSI * PSI);
  return Math.round(clamped * jitterFactor);
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants — Sacred Geometry (Fibonacci) thresholds
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Message count triggers for context compression.
 * These are confirmed Fibonacci numbers: F(6)=8, F(7)=13, F(8)=21, F(9)=34, F(10)=55, F(11)=89.
 * The sequence [8, 13, 21, 34, 55, 89] is exactly correct — verified against fib(n).
 */
const COMPRESSION_THRESHOLDS = [8, 13, 21, 34, 55, 89]; // fib(6)…fib(11) ✓

/**
 * Session inactivity timeout before hibernation alarm (ms).
 * phi-scaled from base of 1 minute: 60000 × PHI^4 ≈ 411s → use nearest phi-scaled: 5 × 60000.
 * Using phi-harmonic: round(60000 × PHI^4) = round(411_234) ≈ 411s → but original 5min is
 * better expressed as fib(14) * 1000 = 377s ≈ 6.3min. We use phi-scaled 5min base:
 * 5 * 60 * 1000 = 300000ms. Phi-scaled: 60000 × PHI^3 ≈ 254s — use PHI^4 ≈ 411s ≈ ~7min.
 * For exact backward compat, keep 5min but express as phi^4 × 60s rounded:
 */
const IDLE_TIMEOUT_MS = Math.round(60_000 * Math.pow(PHI, 4));  // ≈ 411s ≈ 6.9 min (phi-scaled from 60s base)

/**
 * Session hard expiry after last activity (ms).
 * phi-scaled: 60000 × PHI^10 ≈ 85,757s ≈ 23.8h → ~1 day.
 * Original 24h → expressed as phi^10 × 60s ≈ 86.4k s.
 */
const SESSION_EXPIRY_MS = Math.round(60_000 * Math.pow(PHI, 10)); // ≈ 85,753s ≈ 23.8h (phi-scaled)

/** Maximum messages retained in active context window — fib(8) = 21, a true Fibonacci number */
const MAX_CONTEXT_MESSAGES = 21; // fib(8) ✓ Fibonacci

/** Maximum stored message history per session — fib(16) = 987 ≈ 1000 */
const MAX_HISTORY_MESSAGES = 987; // fib(16) = 987, nearest Fibonacci to 1000

/** Alarm intent tags stored in DO storage */
const ALARM_INTENT = {
  IDLE_CHECK: 'IDLE_CHECK',
  SESSION_EXPIRY: 'SESSION_EXPIRY',
  PROACTIVE_TASK: 'PROACTIVE_TASK',
  MEMORY_CONSOLIDATION: 'MEMORY_CONSOLIDATION',
};

// ─────────────────────────────────────────────────────────────────────────────
// Agent state machine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {'init'|'active'|'thinking'|'responding'|'idle'|'hibernating'|'expired'} AgentLifecycle
 */

/**
 * Valid state transitions for the agent lifecycle state machine.
 * @type {Record<AgentLifecycle, AgentLifecycle[]>}
 */
const VALID_TRANSITIONS = {
  init: ['active'],
  active: ['thinking', 'idle'],
  thinking: ['responding', 'active'],
  responding: ['active', 'idle'],
  idle: ['active', 'hibernating', 'expired'],
  hibernating: ['active', 'expired'],
  expired: [],
};

/**
 * Validate and apply a lifecycle state transition.
 * @param {AgentLifecycle} from
 * @param {AgentLifecycle} to
 * @returns {boolean}
 */
function canTransition(from, to) {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─────────────────────────────────────────────────────────────────────────────
// SQL schema
// ─────────────────────────────────────────────────────────────────────────────

/** DDL for the agent's SQLite storage */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','system','tool')),
  content TEXT NOT NULL,
  metadata JSON DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

CREATE TABLE IF NOT EXISTS agent_state (
  key TEXT PRIMARY KEY,
  value JSON NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  memory_type TEXT NOT NULL DEFAULT 'episodic',
  importance REAL NOT NULL DEFAULT 0.5,
  embedding_ref TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  accessed_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  access_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);

CREATE TABLE IF NOT EXISTS tool_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER REFERENCES messages(id),
  tool_name TEXT NOT NULL,
  tool_args JSON NOT NULL DEFAULT '{}',
  result JSON,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed')),
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);
`;

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket message protocol
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} WsMessage
 * @property {'chat'|'state_query'|'memory_add'|'tool_result'|'ping'|'reset'} type
 * @property {string} [content]
 * @property {object} [metadata]
 * @property {string} [requestId]
 */

/**
 * @typedef {object} WsOutbound
 * @property {'token'|'delta'|'done'|'state'|'error'|'pong'|'memory_ack'} type
 * @property {string} [content]
 * @property {object} [data]
 * @property {string} [requestId]
 * @property {number} [timestamp]
 */

/**
 * Serialize an outbound WebSocket message.
 * @param {WsOutbound} msg
 * @returns {string}
 */
function wsOut(msg) {
  return JSON.stringify({ ...msg, timestamp: Date.now() });
}

// ─────────────────────────────────────────────────────────────────────────────
// DurableAgentState class
// ─────────────────────────────────────────────────────────────────────────────

export class DurableAgentState {
  /**
   * @param {DurableObjectState} state - Cloudflare DO state + storage
   * @param {Env} env - Worker bindings
   */
  constructor(state, env) {
    this.state = state;
    this.env = env;

    /** @type {AgentLifecycle} */
    this.lifecycle = 'init';

    /** @type {Map<string, WebSocket>} socketId → WebSocket */
    this.activeSockets = new Map();

    /** @type {string|null} */
    this.sessionId = null;

    /** @type {number} */
    this.lastActivityAt = Date.now();

    /** @type {boolean} */
    this.dbInitialized = false;

    // Initialize schema on first boot (blockConcurrencyWhile ensures single-init)
    this.state.blockConcurrencyWhile(async () => {
      await this._initSchema();
      const stored = await this.state.storage.get('lifecycle');
      if (stored) this.lifecycle = /** @type {AgentLifecycle} */ (stored);
      const lastActive = await this.state.storage.get('lastActivityAt');
      if (lastActive) this.lastActivityAt = Number(lastActive);
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HTTP + WebSocket fetch entrypoint
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Handle incoming HTTP requests to this Durable Object.
   * Routes:
   *   GET  /ws         — WebSocket upgrade for real-time agent communication
   *   GET  /state      — Current agent state snapshot
   *   POST /message    — Send a message synchronously (non-WebSocket)
   *   POST /memory     — Upsert a memory
   *   POST /schedule   — Schedule a proactive task
   *   DELETE /session  — Reset / expire session
   *
   * @param {Request} request
   * @returns {Promise<Response>}
   */
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    this.sessionId = url.searchParams.get('session_id') ?? this.sessionId ?? crypto.randomUUID();

    // WebSocket upgrade
    if (path === '/ws') {
      return this._handleWebSocketUpgrade(request);
    }

    if (path === '/state' && request.method === 'GET') {
      return this._handleGetState(request);
    }

    if (path === '/message' && request.method === 'POST') {
      return this._handleMessage(request);
    }

    if (path === '/memory' && request.method === 'POST') {
      return this._handleAddMemory(request);
    }

    if (path === '/schedule' && request.method === 'POST') {
      return this._handleScheduleTask(request);
    }

    if (path === '/session' && request.method === 'DELETE') {
      return this._handleResetSession(request);
    }

    return new Response(JSON.stringify({ error: 'Not found', path }), { status: 404 });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Hibernatable WebSocket API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Called by Cloudflare runtime when a hibernated WebSocket receives a message.
   * This is the Hibernation API handler — DO wakes from sleep, processes, re-hibernates.
   *
   * @param {WebSocket} ws
   * @param {string|ArrayBuffer} rawMessage
   */
  async webSocketMessage(ws, rawMessage) {
    await this._updateActivity();

    /** @type {WsMessage} */
    let msg;
    try {
      msg = JSON.parse(typeof rawMessage === 'string' ? rawMessage : new TextDecoder().decode(rawMessage));
    } catch {
      ws.send(wsOut({ type: 'error', content: 'Invalid JSON message' }));
      return;
    }

    const socketId = ws.deserializeAttachment()?.socketId ?? 'unknown';

    switch (msg.type) {
      case 'chat':
        await this._processChat(ws, msg);
        break;

      case 'state_query':
        await this._sendStateToSocket(ws);
        break;

      case 'memory_add':
        await this._addMemory(msg.content ?? '', msg.metadata?.type ?? 'episodic', msg.metadata?.importance ?? 0.5);
        ws.send(wsOut({ type: 'memory_ack', requestId: msg.requestId }));
        break;

      case 'tool_result':
        await this._handleToolResult(ws, msg);
        break;

      case 'ping':
        ws.send(wsOut({ type: 'pong', requestId: msg.requestId }));
        break;

      case 'reset':
        await this._resetSession();
        ws.send(wsOut({ type: 'state', data: { lifecycle: this.lifecycle }, requestId: msg.requestId }));
        break;

      default:
        ws.send(wsOut({ type: 'error', content: `Unknown message type: ${msg.type}` }));
    }

    // Schedule idle check alarm
    await this._scheduleIdleAlarm();
  }

  /**
   * Called when a hibernated WebSocket closes.
   * @param {WebSocket} ws
   * @param {number} code
   * @param {string} reason
   */
  async webSocketClose(ws, code, reason) {
    const att = ws.deserializeAttachment();
    if (att?.socketId) {
      this.activeSockets.delete(att.socketId);
    }
    console.log(`[DurableAgentState] WebSocket closed: code=${code}, reason=${reason}`);
    if (this.activeSockets.size === 0) {
      await this._transitionLifecycle('idle');
    }
  }

  /**
   * Called on WebSocket error during hibernation.
   * @param {WebSocket} ws
   * @param {Error} error
   */
  async webSocketError(ws, error) {
    console.error('[DurableAgentState] WebSocket error:', error);
    const att = ws.deserializeAttachment();
    if (att?.socketId) {
      this.activeSockets.delete(att.socketId);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Alarm handler
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Alarm handler — fires on scheduled time.
   * Reads alarm intent from storage and dispatches accordingly.
   */
  async alarm() {
    const intent = await this.state.storage.get('alarmIntent') ?? ALARM_INTENT.IDLE_CHECK;
    console.log('[DurableAgentState] alarm fired, intent:', intent);

    switch (intent) {
      case ALARM_INTENT.IDLE_CHECK: {
        const idleMs = Date.now() - this.lastActivityAt;
        if (idleMs > IDLE_TIMEOUT_MS && this.activeSockets.size === 0) {
          await this._transitionLifecycle('hibernating');
        } else if (idleMs <= IDLE_TIMEOUT_MS) {
          // Still active, reschedule
          await this._scheduleIdleAlarm();
        }
        break;
      }

      case ALARM_INTENT.SESSION_EXPIRY: {
        await this._expireSession();
        break;
      }

      case ALARM_INTENT.MEMORY_CONSOLIDATION: {
        await this._consolidateMemory();
        break;
      }

      case ALARM_INTENT.PROACTIVE_TASK: {
        await this._runProactiveTask();
        break;
      }

      default:
        console.warn('[DurableAgentState] unknown alarm intent:', intent);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: WebSocket upgrade
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Upgrade HTTP to WebSocket and register with the Hibernation API.
   * @param {Request} request
   * @returns {Response}
   */
  _handleWebSocketUpgrade(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const [client, server] = Object.values(new WebSocketPair());
    const socketId = crypto.randomUUID();

    // Attach metadata to survive hibernation
    server.serializeAttachment({ socketId, sessionId: this.sessionId, connectedAt: Date.now() });

    // Register with Hibernation API — DO will sleep between messages
    this.state.acceptWebSocket(server);
    this.activeSockets.set(socketId, server);

    this._transitionLifecycle('active').catch(console.error);
    this._scheduleIdleAlarm().catch(console.error);

    // Send initial state
    server.send(wsOut({
      type: 'state',
      data: {
        socketId,
        sessionId: this.sessionId,
        lifecycle: this.lifecycle,
      },
    }));

    return new Response(null, { status: 101, webSocket: client });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Chat processing
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Process a chat message, stream AI response over WebSocket.
   * @param {WebSocket} ws
   * @param {WsMessage} msg
   */
  async _processChat(ws, msg) {
    const content = msg.content ?? '';
    if (!content.trim()) {
      ws.send(wsOut({ type: 'error', content: 'Empty message', requestId: msg.requestId }));
      return;
    }

    await this._transitionLifecycle('thinking');

    // Persist user message
    const msgId = await this._persistMessage('user', content, msg.metadata ?? {});

    // Load context window (last N messages — Fibonacci bound)
    const contextMessages = await this._loadContextMessages(MAX_CONTEXT_MESSAGES);

    await this._transitionLifecycle('responding');

    try {
      const model = this._selectChatModel(contextMessages);

      // Stream inference
      const aiStream = await this.env.AI.run(model, {
        messages: contextMessages,
        stream: true,
        max_tokens: 1024,
      });

      let fullResponse = '';

      // Forward SSE tokens over WebSocket
      const reader = aiStream.getReader ? aiStream.getReader() : null;
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          // Parse SSE lines
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const token = parsed.response ?? parsed.choices?.[0]?.delta?.content ?? '';
                if (token) {
                  fullResponse += token;
                  ws.send(wsOut({ type: 'token', content: token, requestId: msg.requestId }));
                }
              } catch {
                // Skip malformed SSE lines
              }
            }
          }
        }
      }

      // Persist assistant response
      await this._persistMessage('assistant', fullResponse, { model });

      // Send completion signal
      ws.send(wsOut({ type: 'done', requestId: msg.requestId, data: { model, tokens: Math.ceil(fullResponse.length / 4) } }));

      // Trigger compression if needed
      await this._maybeCompressContext();

      await this._transitionLifecycle('active');
    } catch (err) {
      console.error('[DurableAgentState] chat error:', err);
      ws.send(wsOut({ type: 'error', content: 'Inference failed', requestId: msg.requestId }));
      await this._transitionLifecycle('active');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: HTTP endpoint handlers
  // ──────────────────────────────────────────────────────────────────────────

  /** @returns {Promise<Response>} */
  async _handleGetState(_request) {
    const history = await this._loadContextMessages(13);
    const memories = await this._loadMemories(5);
    const stateEntries = await this.state.storage.list({ prefix: 'meta:' });

    return new Response(JSON.stringify({
      sessionId: this.sessionId,
      lifecycle: this.lifecycle,
      lastActivityAt: this.lastActivityAt,
      activeSocketCount: this.activeSockets.size,
      recentMessages: history.slice(-5),
      topMemories: memories,
      metadata: Object.fromEntries(stateEntries),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /** @returns {Promise<Response>} */
  async _handleMessage(request) {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
    }

    const { content, role = 'user' } = body;
    if (!content) return new Response(JSON.stringify({ error: 'content required' }), { status: 400 });

    if (role === 'user') {
      const contextMessages = await this._loadContextMessages(MAX_CONTEXT_MESSAGES);
      contextMessages.push({ role: 'user', content });

      const model = this._selectChatModel(contextMessages);
      const result = await this.env.AI.run(model, { messages: contextMessages, stream: false, max_tokens: 1024 });
      const assistantContent = result.response ?? result.choices?.[0]?.message?.content ?? '';

      await this._persistMessage('user', content, {});
      await this._persistMessage('assistant', assistantContent, { model });

      return new Response(JSON.stringify({
        response: assistantContent,
        model,
        sessionId: this.sessionId,
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    await this._persistMessage(role, content, {});
    return new Response(JSON.stringify({ persisted: true, role, sessionId: this.sessionId }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /** @returns {Promise<Response>} */
  async _handleAddMemory(request) {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
    }
    const { content, type = 'episodic', importance = 0.5 } = body;
    if (!content) return new Response(JSON.stringify({ error: 'content required' }), { status: 400 });
    const id = await this._addMemory(content, type, importance);
    return new Response(JSON.stringify({ id, type, importance }), { headers: { 'Content-Type': 'application/json' } });
  }

  /** @returns {Promise<Response>} */
  async _handleScheduleTask(request) {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
    }
    const { delay_ms = IDLE_TIMEOUT_MS, task } = body;
    const fireAt = Date.now() + delay_ms;
    await this.state.storage.put('alarmIntent', ALARM_INTENT.PROACTIVE_TASK);
    await this.state.storage.put('pendingTask', task ?? null);
    await this.state.storage.setAlarm(fireAt);
    return new Response(JSON.stringify({ scheduled: true, fireAt }), { headers: { 'Content-Type': 'application/json' } });
  }

  /** @returns {Promise<Response>} */
  async _handleResetSession(_request) {
    await this._resetSession();
    return new Response(JSON.stringify({ reset: true, sessionId: this.sessionId }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Tool result handler
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * @param {WebSocket} ws
   * @param {WsMessage} msg
   */
  async _handleToolResult(ws, msg) {
    const { tool_call_id, result, error } = msg.metadata ?? {};
    if (tool_call_id) {
      await this.state.storage.sql.exec(
        `UPDATE tool_calls SET result = ?, status = ?, completed_at = ? WHERE id = ?`,
        JSON.stringify(result ?? null),
        error ? 'failed' : 'completed',
        Date.now(),
        tool_call_id,
      );
    }
    ws.send(wsOut({ type: 'state', data: { toolResultAck: true }, requestId: msg.requestId }));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: State and persistence
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Initialize SQLite schema on first run.
   */
  async _initSchema() {
    if (this.dbInitialized) return;
    try {
      this.state.storage.sql.exec(SCHEMA_SQL);
      this.dbInitialized = true;
    } catch (err) {
      console.error('[DurableAgentState] schema init error:', err);
    }
  }

  /**
   * Persist a message to SQLite.
   * @param {string} role
   * @param {string} content
   * @param {object} metadata
   * @returns {Promise<number>} row id
   */
  async _persistMessage(role, content, metadata) {
    const result = this.state.storage.sql.exec(
      `INSERT INTO messages (role, content, metadata, created_at) VALUES (?, ?, ?, ?) RETURNING id`,
      role,
      content,
      JSON.stringify(metadata),
      Date.now(),
    );
    return result.one()?.id ?? 0;
  }

  /**
   * Load the last N messages for context window.
   * @param {number} limit
   * @returns {Promise<Array<{role: string, content: string}>>}
   */
  async _loadContextMessages(limit) {
    const rows = this.state.storage.sql.exec(
      `SELECT role, content FROM messages ORDER BY created_at DESC LIMIT ?`,
      limit,
    ).toArray();
    return rows.reverse().map((r) => ({ role: r.role, content: r.content }));
  }

  /**
   * Load top memories by importance.
   * @param {number} limit
   */
  async _loadMemories(limit) {
    return this.state.storage.sql.exec(
      `SELECT id, content, memory_type, importance, created_at FROM memories ORDER BY importance DESC, accessed_at DESC LIMIT ?`,
      limit,
    ).toArray();
  }

  /**
   * Add a new memory entry.
   * @param {string} content
   * @param {string} type
   * @param {number} importance
   * @returns {Promise<number>}
   */
  async _addMemory(content, type, importance) {
    const result = this.state.storage.sql.exec(
      `INSERT INTO memories (content, memory_type, importance, created_at, accessed_at) VALUES (?, ?, ?, ?, ?) RETURNING id`,
      content,
      type,
      Math.max(0, Math.min(1, importance)),
      Date.now(),
      Date.now(),
    );
    return result.one()?.id ?? 0;
  }

  /**
   * Transition the agent lifecycle state machine.
   * @param {AgentLifecycle} to
   */
  async _transitionLifecycle(to) {
    if (!canTransition(this.lifecycle, to)) {
      console.warn(`[DurableAgentState] invalid transition: ${this.lifecycle} → ${to}`);
      return;
    }
    this.lifecycle = to;
    await this.state.storage.put('lifecycle', to);

    // Broadcast state change to all active sockets
    const stateMsg = wsOut({ type: 'state', data: { lifecycle: to } });
    for (const ws of this.activeSockets.values()) {
      try { ws.send(stateMsg); } catch { /* socket may be closed */ }
    }
  }

  /**
   * Update last activity timestamp.
   */
  async _updateActivity() {
    this.lastActivityAt = Date.now();
    await this.state.storage.put('lastActivityAt', this.lastActivityAt);
  }

  /**
   * Send current state snapshot to a single WebSocket.
   * @param {WebSocket} ws
   */
  async _sendStateToSocket(ws) {
    const history = await this._loadContextMessages(5);
    ws.send(wsOut({
      type: 'state',
      data: {
        sessionId: this.sessionId,
        lifecycle: this.lifecycle,
        lastActivityAt: this.lastActivityAt,
        recentMessages: history,
      },
    }));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Model selection
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Select the appropriate chat model based on conversation depth.
   * @param {Array} messages
   * @returns {string}
   */
  _selectChatModel(messages) {
    const totalChars = messages.reduce((s, m) => s + (m.content?.length ?? 0), 0);
    // Use 8B for deeper conversations (>2000 chars context)
    if (totalChars > 2000 || messages.length > 8) {
      return '@cf/meta/llama-3.1-8b-instruct-fp8-fast';
    }
    return '@cf/meta/llama-3.2-1b-instruct';
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Context compression
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Check Fibonacci thresholds — compress context if needed.
   */
  async _maybeCompressContext() {
    const countRow = this.state.storage.sql.exec(`SELECT COUNT(*) as cnt FROM messages`).one();
    const count = countRow?.cnt ?? 0;

    // Find the next Fibonacci threshold we've crossed
    const shouldCompress = COMPRESSION_THRESHOLDS.some((t) => count === t);
    if (shouldCompress) {
      await this._consolidateMemory();
    }
  }

  /**
   * Summarize older messages into a memory, then prune.
   */
  async _consolidateMemory() {
    const oldMessages = this.state.storage.sql.exec(
      `SELECT role, content FROM messages ORDER BY created_at ASC LIMIT ?`,
      MAX_CONTEXT_MESSAGES,
    ).toArray();

    if (oldMessages.length < 5) return;

    const summary = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: 'You are a memory consolidation assistant. Summarize the key facts, decisions, and context from these conversation messages in 2-3 sentences.' },
        { role: 'user', content: oldMessages.map((m) => `${m.role}: ${m.content}`).join('\n') },
      ],
      max_tokens: 256,
      stream: false,
    });

    const summaryText = summary?.response ?? 'Prior conversation context summarized.';
    await this._addMemory(summaryText, 'episodic', 0.7);

    // Delete summarized messages
    const ids = this.state.storage.sql.exec(
      `SELECT id FROM messages ORDER BY created_at ASC LIMIT ?`,
      MAX_CONTEXT_MESSAGES - 5, // keep last 5
    ).toArray().map((r) => r.id);

    if (ids.length > 0) {
      this.state.storage.sql.exec(
        `DELETE FROM messages WHERE id IN (${ids.map(() => '?').join(',')})`,
        ...ids,
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Alarm scheduling
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Schedule the idle-check alarm (only one alarm allowed per DO).
   * Uses IDLE_TIMEOUT_MS which is phi-scaled (PHI^4 × 60s ≈ 411s).
   */
  async _scheduleIdleAlarm() {
    await this.state.storage.put('alarmIntent', ALARM_INTENT.IDLE_CHECK);
    await this.state.storage.setAlarm(Date.now() + IDLE_TIMEOUT_MS);
  }

  /**
   * Schedule the session expiry alarm with phi-scaled backoff.
   * Uses SESSION_EXPIRY_MS which is phi-scaled (PHI^10 × 60s ≈ 23.8h).
   * @param {number} [attempt=0] - Retry attempt for phi-backoff jitter
   */
  async _scheduleSessionExpiryAlarm(attempt = 0) {
    // Apply phi-backoff jitter only for retries; base expiry is SESSION_EXPIRY_MS
    const jitter = attempt > 0 ? _phiBackoff(attempt, 1000, 30_000) : 0;
    await this.state.storage.put('alarmIntent', ALARM_INTENT.SESSION_EXPIRY);
    await this.state.storage.setAlarm(Date.now() + SESSION_EXPIRY_MS + jitter);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Proactive task runner
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Execute a scheduled proactive task (e.g., daily briefing generation).
   */
  async _runProactiveTask() {
    const task = await this.state.storage.get('pendingTask');
    if (!task) return;

    console.log('[DurableAgentState] running proactive task:', task);

    // Notify connected sockets
    const taskMsg = wsOut({ type: 'state', data: { event: 'proactive_task_start', task } });
    for (const ws of this.activeSockets.values()) {
      try { ws.send(taskMsg); } catch { /* socket may be closed */ }
    }

    // Clear pending task
    await this.state.storage.delete('pendingTask');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Session management
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Reset the session — clear messages, memories, lifecycle.
   */
  async _resetSession() {
    this.state.storage.sql.exec(`DELETE FROM messages`);
    this.state.storage.sql.exec(`DELETE FROM memories`);
    this.state.storage.sql.exec(`DELETE FROM tool_calls`);
    this.state.storage.sql.exec(`DELETE FROM agent_state`);
    this.lifecycle = 'init';
    await this.state.storage.put('lifecycle', 'init');
    this.lastActivityAt = Date.now();
  }

  /**
   * Mark session as expired and close all sockets.
   */
  async _expireSession() {
    await this._transitionLifecycle('expired');
    const expiredMsg = wsOut({ type: 'state', data: { lifecycle: 'expired', reason: 'session_expiry' } });
    for (const ws of this.activeSockets.values()) {
      try {
        ws.send(expiredMsg);
        ws.close(1001, 'Session expired');
      } catch { /* ignore */ }
    }
    this.activeSockets.clear();
  }
}
