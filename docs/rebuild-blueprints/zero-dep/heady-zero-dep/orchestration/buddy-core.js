/**
 * @file buddy-core.js
 * @description HeadyBuddy — Conversational Assistant Core.
 *
 * Features:
 * - Conversational interface with multi-turn context management
 * - Context window management (PHI-scaled token budget)
 * - Tool calling orchestration (register, invoke, validate)
 * - Personality / tone management (configurable persona)
 * - Session persistence (in-memory + optional file WAL)
 *
 * Sacred Geometry: PHI-scaled context windows, Fibonacci message retention.
 * Zero external dependencies — Node.js built-ins only.
 *
 * @module Orchestration/BuddyCore
 */

import { EventEmitter } from 'events';
import { randomUUID, createHash } from 'crypto';
import fs from 'fs';

// ─── Sacred Geometry ──────────────────────────────────────────────────────────

const PHI = 1.6180339887498948482;
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

// ─── Message Types ────────────────────────────────────────────────────────────

/**
 * @enum {string}
 */
export const MessageRole = Object.freeze({
  SYSTEM:    'system',
  USER:      'user',
  ASSISTANT: 'assistant',
  TOOL:      'tool',
});

// ─── Message Schema ───────────────────────────────────────────────────────────

/**
 * @typedef {object} Message
 * @property {string} id
 * @property {MessageRole} role
 * @property {string} content
 * @property {number} ts
 * @property {number} tokens - estimated token count
 * @property {string} [toolName] - for TOOL messages
 * @property {string} [toolCallId] - for tool result messages
 * @property {object} [metadata]
 */

/**
 * Estimate token count for a string (rough: 1 token ≈ 4 chars)
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  return Math.ceil((text ?? '').length / 4);
}

/**
 * Create a message object
 * @param {MessageRole} role
 * @param {string} content
 * @param {object} [options]
 * @returns {Message}
 */
export function createMessage(role, content, options = {}) {
  return {
    id: options.id ?? randomUUID(),
    role,
    content: content ?? '',
    ts: Date.now(),
    tokens: options.tokens ?? estimateTokens(content),
    toolName: options.toolName ?? null,
    toolCallId: options.toolCallId ?? null,
    metadata: options.metadata ?? {},
  };
}

// ─── Persona ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} Persona
 * @property {string} name
 * @property {string} systemPrompt
 * @property {string} tone - 'friendly'|'professional'|'technical'|'creative'
 * @property {string[]} traits - personality adjectives
 * @property {number} temperature - LLM temperature hint (0.0–2.0)
 * @property {string} [fallbackResponse] - when no LLM is available
 */

/**
 * Default HeadyBuddy persona
 * @type {Persona}
 */
export const DEFAULT_PERSONA = Object.freeze({
  name: 'HeadyBuddy',
  systemPrompt: `You are HeadyBuddy, the intelligent assistant embedded in the Heady system.
You have deep knowledge of the Heady architecture: the 3-node Colab cluster (BRAIN, CONDUCTOR, SENTINEL),
the Sacred Geometry PHI-based resource pools (Hot 34%, Warm 21%, Cold 13%), and the Liquid dynamic system.
You help users understand system state, debug issues, plan tasks, and orchestrate workflows.
Be concise, accurate, and use Sacred Geometry metaphors where they illuminate concepts.`,
  tone: 'friendly',
  traits: ['curious', 'precise', 'helpful', 'phi-aware'],
  temperature: 1 / PHI, // ≈ 0.618
  fallbackResponse: "I'm HeadyBuddy. The LLM backend isn't connected yet — I can still help with system introspection and routing.",
});

// ─── Tool Definition ──────────────────────────────────────────────────────────

/**
 * @typedef {object} BuddyTool
 * @property {string} name
 * @property {string} description
 * @property {object} inputSchema - JSON Schema for the tool's input
 * @property {function(*): Promise<*>} handler
 * @property {boolean} [confirmRequired] - ask user before invoking
 */

// ─── Context Window Manager ───────────────────────────────────────────────────

/**
 * Manages the conversation context window with PHI-scaled token budget.
 * Evicts oldest non-system messages when budget is exceeded.
 */
export class ContextWindow {
  /**
   * @param {object} [options]
   * @param {number} [options.maxTokens=8192] - total context token budget
   * @param {number} [options.systemTokenReserve] - tokens reserved for system prompt (default 1/PHI of max)
   * @param {number} [options.maxMessages=FIBONACCI[11]] - max stored messages (144)
   */
  constructor(options = {}) {
    this._maxTokens      = options.maxTokens ?? 8192;
    this._systemReserve  = options.systemTokenReserve ?? Math.floor(this._maxTokens / PHI / PHI);
    this._maxMessages    = options.maxMessages ?? FIBONACCI[11]; // 144
    /** @type {Message[]} */
    this._messages = [];
    this._totalTokens = 0;
  }

  /**
   * Add a message to the context window, evicting old messages if needed.
   * System messages are never evicted.
   * @param {Message} message
   * @returns {Message}
   */
  add(message) {
    this._messages.push(message);
    this._totalTokens += message.tokens;

    // Enforce token budget
    this._evictIfNeeded();

    // Enforce max messages
    if (this._messages.length > this._maxMessages) {
      // Remove oldest non-system messages
      let removed = 0;
      this._messages = this._messages.filter((m) => {
        if (m.role === MessageRole.SYSTEM) return true;
        if (removed < this._messages.length - this._maxMessages) {
          removed++;
          this._totalTokens -= m.tokens;
          return false;
        }
        return true;
      });
    }

    return message;
  }

  /**
   * Evict oldest user/assistant/tool messages until within token budget.
   * @private
   */
  _evictIfNeeded() {
    const userBudget = this._maxTokens - this._systemReserve;
    let userTokens = this._messages
      .filter((m) => m.role !== MessageRole.SYSTEM)
      .reduce((s, m) => s + m.tokens, 0);

    if (userTokens <= userBudget) return;

    // Build eviction list (oldest non-system first)
    const evictable = this._messages
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.role !== MessageRole.SYSTEM)
      .slice(0, -FIBONACCI[3]); // keep at least 3 most recent

    for (const { m } of evictable) {
      if (userTokens <= userBudget) break;
      userTokens -= m.tokens;
      this._totalTokens -= m.tokens;
      const idx = this._messages.indexOf(m);
      if (idx !== -1) this._messages.splice(idx, 1);
    }
  }

  /**
   * Get all messages in the context window
   * @returns {Message[]}
   */
  getMessages() { return [...this._messages]; }

  /**
   * Get the last N messages
   * @param {number} n
   * @returns {Message[]}
   */
  getRecent(n = FIBONACCI[4]) { // default: last 5
    return this._messages.slice(-n);
  }

  /**
   * Get only the system message(s)
   * @returns {Message[]}
   */
  getSystemMessages() {
    return this._messages.filter((m) => m.role === MessageRole.SYSTEM);
  }

  /**
   * Clear non-system messages (start fresh)
   */
  clear() {
    this._messages = this._messages.filter((m) => m.role === MessageRole.SYSTEM);
    this._totalTokens = this._messages.reduce((s, m) => s + m.tokens, 0);
  }

  /** @returns {number} total estimated tokens in window */
  get tokenCount() { return this._totalTokens; }

  /** @returns {number} */
  get messageCount() { return this._messages.length; }

  /** @returns {number} remaining budget for user content */
  get remainingTokens() {
    return this._maxTokens - this._totalTokens;
  }

  /** @returns {number} PHI load: how full the context window is */
  get phiLoad() {
    return this._totalTokens / this._maxTokens;
  }
}

// ─── Session ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} SessionOptions
 * @property {string} [sessionId]
 * @property {Persona} [persona]
 * @property {number} [maxTokens]
 * @property {object} [metadata]
 */

/**
 * A HeadyBuddy conversation session.
 * Contains a ContextWindow, tool registry, and session metadata.
 */
export class BuddySession {
  /**
   * @param {SessionOptions} [options]
   */
  constructor(options = {}) {
    this.id        = options.sessionId ?? randomUUID();
    this.persona   = options.persona ?? DEFAULT_PERSONA;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.metadata  = options.metadata ?? {};
    this.turnCount = 0;

    /** @type {ContextWindow} */
    this.context = new ContextWindow({ maxTokens: options.maxTokens ?? 8192 });

    // Inject system prompt
    this.context.add(createMessage(MessageRole.SYSTEM, this.persona.systemPrompt));

    /** @type {Map<string, BuddyTool>} */
    this._tools = new Map();
  }

  /**
   * Register a tool for this session
   * @param {BuddyTool} tool
   */
  registerTool(tool) {
    this._tools.set(tool.name, tool);
  }

  /**
   * Get available tool definitions (for LLM function-calling)
   * @returns {object[]} array of JSON Schema tool descriptors
   */
  getToolSchemas() {
    return [...this._tools.values()].map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));
  }

  /**
   * Invoke a tool by name
   * @param {string} name
   * @param {object} args
   * @returns {Promise<*>}
   */
  async invokeTool(name, args) {
    const tool = this._tools.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    return tool.handler(args);
  }

  /**
   * Add a user message to the context
   * @param {string} content
   * @param {object} [options]
   * @returns {Message}
   */
  addUserMessage(content, options = {}) {
    this.updatedAt = Date.now();
    this.turnCount++;
    return this.context.add(createMessage(MessageRole.USER, content, options));
  }

  /**
   * Add an assistant message to the context
   * @param {string} content
   * @param {object} [options]
   * @returns {Message}
   */
  addAssistantMessage(content, options = {}) {
    this.updatedAt = Date.now();
    return this.context.add(createMessage(MessageRole.ASSISTANT, content, options));
  }

  /**
   * Add a tool result message to the context
   * @param {string} toolName
   * @param {string} toolCallId
   * @param {*} result
   * @returns {Message}
   */
  addToolResult(toolName, toolCallId, result) {
    const content = typeof result === 'string' ? result : JSON.stringify(result);
    return this.context.add(createMessage(MessageRole.TOOL, content, {
      toolName, toolCallId,
    }));
  }

  /**
   * Get a snapshot suitable for serialization / persistence
   * @returns {object}
   */
  toJSON() {
    return {
      id:        this.id,
      persona:   this.persona.name,
      turnCount: this.turnCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      metadata:  this.metadata,
      messages:  this.context.getMessages(),
      tokenCount: this.context.tokenCount,
    };
  }
}

// ─── Session Store ────────────────────────────────────────────────────────────

/**
 * In-memory session store with optional file-based WAL persistence.
 */
export class SessionStore {
  /**
   * @param {object} [options]
   * @param {string} [options.walPath] - file path for session WAL
   * @param {number} [options.maxSessions=FIBONACCI[8]] - max active sessions (34)
   * @param {number} [options.sessionTtl=3600000] - session TTL ms (1 hour)
   */
  constructor(options = {}) {
    this._walPath     = options.walPath ?? null;
    this._maxSessions = options.maxSessions ?? FIBONACCI[8]; // 34
    this._sessionTtl  = options.sessionTtl ?? 3600000; // 1h
    /** @type {Map<string, BuddySession>} */
    this._sessions    = new Map();
    this._gcTimer     = null;
  }

  /**
   * Create or retrieve a session
   * @param {string} [sessionId]
   * @param {SessionOptions} [options]
   * @returns {BuddySession}
   */
  getOrCreate(sessionId, options = {}) {
    if (sessionId && this._sessions.has(sessionId)) {
      return this._sessions.get(sessionId);
    }
    if (this._sessions.size >= this._maxSessions) {
      // Evict oldest session
      let oldest = null, oldestTs = Infinity;
      for (const [id, s] of this._sessions) {
        if (s.updatedAt < oldestTs) { oldest = id; oldestTs = s.updatedAt; }
      }
      if (oldest) this._sessions.delete(oldest);
    }
    const session = new BuddySession({ sessionId, ...options });
    this._sessions.set(session.id, session);
    this._walWrite({ op: 'create', sessionId: session.id, ts: session.createdAt });
    return session;
  }

  /**
   * Get an existing session
   * @param {string} sessionId
   * @returns {BuddySession|undefined}
   */
  get(sessionId) { return this._sessions.get(sessionId); }

  /**
   * Delete a session
   * @param {string} sessionId
   * @returns {boolean}
   */
  delete(sessionId) {
    const existed = this._sessions.delete(sessionId);
    if (existed) this._walWrite({ op: 'delete', sessionId, ts: Date.now() });
    return existed;
  }

  /**
   * Start the GC timer (evicts expired sessions)
   */
  startGC() {
    this._gcTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, session] of this._sessions) {
        if (now - session.updatedAt > this._sessionTtl) {
          this._sessions.delete(id);
        }
      }
    }, FIBONACCI[8] * 1000); // every 34s
    if (this._gcTimer.unref) this._gcTimer.unref();
  }

  /** @returns {number} */
  get size() { return this._sessions.size; }

  /** @private */
  _walWrite(record) {
    if (!this._walPath) return;
    try {
      fs.appendFileSync(this._walPath, JSON.stringify(record) + '\n', 'utf8');
    } catch (_) {}
  }
}

// ─── HeadyBuddy ───────────────────────────────────────────────────────────────

/**
 * HeadyBuddy — the conversational assistant core.
 *
 * Routes conversations to LLM backends (via registered handler), manages
 * sessions, tool invocations, and personality.
 *
 * @extends EventEmitter
 *
 * @example
 * const buddy = new HeadyBuddy();
 *
 * // Register a tool
 * buddy.registerGlobalTool({
 *   name: 'cluster_status',
 *   description: 'Get the current cluster health status',
 *   inputSchema: { type: 'object', properties: {} },
 *   handler: async () => conductor.status,
 * });
 *
 * // Set LLM handler (plug in any LLM)
 * buddy.setLLMHandler(async (messages, tools, persona) => {
 *   // Call your LLM here...
 *   return { role: 'assistant', content: 'Hello!' };
 * });
 *
 * const response = await buddy.chat('session-abc', 'What is the cluster health?');
 */
export class HeadyBuddy extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {Persona} [options.persona=DEFAULT_PERSONA]
   * @param {number} [options.maxTokens=8192]
   * @param {string} [options.sessionWalPath]
   * @param {number} [options.maxSessions=FIBONACCI[8]]
   * @param {boolean} [options.autoGC=true]
   */
  constructor(options = {}) {
    super();
    this._persona     = options.persona ?? DEFAULT_PERSONA;
    this._maxTokens   = options.maxTokens ?? 8192;

    /** @type {SessionStore} */
    this._sessions = new SessionStore({
      walPath:     options.sessionWalPath,
      maxSessions: options.maxSessions ?? FIBONACCI[8],
    });

    /** @type {Map<string, BuddyTool>} global tools available in all sessions */
    this._globalTools = new Map();

    /**
     * LLM handler: async (messages, tools, persona) => { role, content, toolCalls? }
     * @type {Function|null}
     */
    this._llmHandler = null;

    /**
     * Stream handler: async (messages, tools, persona, onChunk) => void
     * @type {Function|null}
     */
    this._streamHandler = null;

    if (options.autoGC !== false) this._sessions.startGC();

    this._started = true;
  }

  // ─── LLM Backend ──────────────────────────────────────────────────────────

  /**
   * Register the LLM handler function.
   * This is the bridge to the actual language model (Gemini, Claude, etc.).
   * @param {function(Message[], object[], Persona): Promise<{ role: string, content: string, toolCalls?: object[] }>} fn
   */
  setLLMHandler(fn) { this._llmHandler = fn; }

  /**
   * Register a streaming LLM handler.
   * @param {function(Message[], object[], Persona, function(string): void): Promise<void>} fn
   */
  setStreamHandler(fn) { this._streamHandler = fn; }

  // ─── Global Tools ─────────────────────────────────────────────────────────

  /**
   * Register a tool available in all sessions
   * @param {BuddyTool} tool
   */
  registerGlobalTool(tool) {
    this._globalTools.set(tool.name, tool);
    this.emit('tool.registered', { name: tool.name });
  }

  /**
   * Remove a global tool
   * @param {string} name
   */
  removeGlobalTool(name) { this._globalTools.delete(name); }

  // ─── Session Management ───────────────────────────────────────────────────

  /**
   * Get or create a session
   * @param {string} [sessionId]
   * @param {SessionOptions} [options]
   * @returns {BuddySession}
   */
  session(sessionId, options = {}) {
    const session = this._sessions.getOrCreate(sessionId, {
      persona: this._persona,
      maxTokens: this._maxTokens,
      ...options,
    });
    // Inject global tools
    for (const [, tool] of this._globalTools) {
      if (!session._tools.has(tool.name)) {
        session.registerTool(tool);
      }
    }
    return session;
  }

  /**
   * Delete a session
   * @param {string} sessionId
   */
  closeSession(sessionId) {
    this._sessions.delete(sessionId);
    this.emit('session.closed', { sessionId });
  }

  // ─── Chat ─────────────────────────────────────────────────────────────────

  /**
   * Send a user message and get a response.
   * Handles tool calling loops automatically.
   *
   * @param {string} sessionId - session ID (created if not exists)
   * @param {string} userMessage
   * @param {object} [options]
   * @param {number} [options.maxToolRounds=FIBONACCI[3]] - max tool call rounds (3)
   * @param {object} [options.sessionOptions] - passed to session() if new
   * @returns {Promise<{ content: string, session: BuddySession, toolCalls: number }>}
   */
  async chat(sessionId, userMessage, options = {}) {
    const session = this.session(sessionId, options.sessionOptions);
    const maxRounds = options.maxToolRounds ?? FIBONACCI[3]; // 3

    // Add user message
    session.addUserMessage(userMessage);
    this.emit('user.message', { sessionId: session.id, content: userMessage });

    // Get tool schemas
    const toolSchemas = session.getToolSchemas();

    let rounds = 0;
    let finalContent = '';
    let totalToolCalls = 0;

    while (rounds <= maxRounds) {
      rounds++;
      const messages = session.context.getMessages();

      // Call LLM (or fallback)
      let response;
      if (this._llmHandler) {
        try {
          response = await this._llmHandler(messages, toolSchemas, this._persona);
        } catch (err) {
          this.emit('llm.error', { error: err, sessionId: session.id });
          response = { role: 'assistant', content: this._persona.fallbackResponse };
        }
      } else {
        response = { role: 'assistant', content: this._persona.fallbackResponse };
      }

      // Handle tool calls
      if (response.toolCalls && response.toolCalls.length > 0 && rounds <= maxRounds) {
        // Add assistant message with tool call request
        session.addAssistantMessage(response.content ?? '', {
          metadata: { toolCalls: response.toolCalls },
        });

        // Execute each tool call
        for (const toolCall of response.toolCalls) {
          totalToolCalls++;
          const callId = toolCall.id ?? randomUUID();
          try {
            const args = typeof toolCall.function?.arguments === 'string'
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function?.arguments ?? {};
            const result = await session.invokeTool(toolCall.function?.name, args);
            session.addToolResult(toolCall.function?.name, callId, result);
            this.emit('tool.invoked', {
              sessionId: session.id,
              tool: toolCall.function?.name,
              success: true,
              callId,
            });
          } catch (err) {
            session.addToolResult(
              toolCall.function?.name, callId,
              `Error: ${err.message}`
            );
            this.emit('tool.invoked', {
              sessionId: session.id,
              tool: toolCall.function?.name,
              success: false,
              error: err.message,
              callId,
            });
          }
        }
        continue; // loop back to get LLM response after tool results
      }

      // Final text response
      finalContent = response.content ?? '';
      session.addAssistantMessage(finalContent);
      this.emit('assistant.message', { sessionId: session.id, content: finalContent });
      break;
    }

    return {
      content: finalContent,
      session,
      toolCalls: totalToolCalls,
    };
  }

  /**
   * Stream a response (if streamHandler is set; falls back to chat())
   * @param {string} sessionId
   * @param {string} userMessage
   * @param {function(string): void} onChunk - called with each text chunk
   * @param {object} [options]
   * @returns {Promise<{ content: string, session: BuddySession }>}
   */
  async stream(sessionId, userMessage, onChunk, options = {}) {
    if (!this._streamHandler) {
      // Fall back to non-streaming
      const result = await this.chat(sessionId, userMessage, options);
      onChunk(result.content);
      return result;
    }

    const session = this.session(sessionId, options.sessionOptions);
    session.addUserMessage(userMessage);
    const messages = session.context.getMessages();
    const toolSchemas = session.getToolSchemas();

    let fullContent = '';
    await this._streamHandler(messages, toolSchemas, this._persona, (chunk) => {
      fullContent += chunk;
      onChunk(chunk);
    });

    session.addAssistantMessage(fullContent);
    this.emit('assistant.message', { sessionId: session.id, content: fullContent });
    return { content: fullContent, session };
  }

  // ─── Persona Management ───────────────────────────────────────────────────

  /**
   * Change the active persona
   * @param {Partial<Persona>} update
   */
  updatePersona(update) {
    this._persona = { ...this._persona, ...update };
    this.emit('persona.updated', { persona: this._persona });
  }

  /**
   * Get the current persona
   * @returns {Persona}
   */
  get persona() { return this._persona; }

  // ─── Status ───────────────────────────────────────────────────────────────

  /** @returns {object} buddy status snapshot */
  get status() {
    return {
      persona:       this._persona.name,
      tone:          this._persona.tone,
      sessions:      this._sessions.size,
      globalTools:   this._globalTools.size,
      hasLLM:        !!this._llmHandler,
      hasStreamLLM:  !!this._streamHandler,
      maxTokens:     this._maxTokens,
      phi:           PHI,
    };
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /** @returns {boolean} */
  get started() { return this._started; }

  /** Graceful shutdown */
  async shutdown() {
    this._started = false;
    this.emit('buddy.stopped');
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/** @type {HeadyBuddy|null} */
let _globalBuddy = null;

/**
 * Get (or create) the global HeadyBuddy singleton
 * @param {object} [options]
 * @returns {HeadyBuddy}
 */
export function getGlobalBuddy(options = {}) {
  if (!_globalBuddy) {
    _globalBuddy = new HeadyBuddy(options);
  }
  return _globalBuddy;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { PHI, FIBONACCI };

export default {
  HeadyBuddy,
  BuddySession,
  ContextWindow,
  SessionStore,
  MessageRole,
  DEFAULT_PERSONA,
  createMessage,
  estimateTokens,
  getGlobalBuddy,
  PHI,
  FIBONACCI,
};
