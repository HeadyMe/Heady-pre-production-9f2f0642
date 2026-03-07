'use strict';

/**
 * HeadyChain Memory System
 * Supports: buffer, summary, vector (via HeadyVector), entity, and working memory.
 * All memory types are serializable for checkpointing.
 */

const { httpPost, getPath } = require('./nodes');
const config = require('./config');

// ─── Message / Memory Item ────────────────────────────────────────────────────

function createMessage(role, content, metadata = {}) {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role,       // 'user' | 'assistant' | 'system' | 'tool'
    content,
    metadata,
    timestamp: Date.now(),
  };
}

// ─── Buffer Memory ────────────────────────────────────────────────────────────

/**
 * Short-term conversation buffer — keeps last N messages.
 */
class BufferMemory {
  constructor({ maxSize = config.MEMORY_BUFFER_SIZE, windowSize } = {}) {
    this.maxSize = maxSize;
    this.windowSize = windowSize; // if set, only return last windowSize messages
    this.messages = [];
  }

  add(role, content, metadata = {}) {
    const msg = createMessage(role, content, metadata);
    this.messages.push(msg);
    if (this.messages.length > this.maxSize) {
      this.messages.shift();
    }
    return msg;
  }

  addMessage(message) {
    this.messages.push({ ...message });
    if (this.messages.length > this.maxSize) {
      this.messages.shift();
    }
  }

  getMessages(limit) {
    const msgs = this.windowSize
      ? this.messages.slice(-this.windowSize)
      : this.messages;
    return limit ? msgs.slice(-limit) : [...msgs];
  }

  getLastMessage() {
    return this.messages[this.messages.length - 1] || null;
  }

  clear() {
    this.messages = [];
  }

  size() {
    return this.messages.length;
  }

  /**
   * Return token-budget-aware window of messages.
   * Estimates based on config.CHARS_PER_TOKEN.
   */
  getWithinTokenBudget(maxTokens) {
    const budget = maxTokens * config.CHARS_PER_TOKEN;
    let total = 0;
    const result = [];
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const len = String(this.messages[i].content).length;
      if (total + len > budget) break;
      result.unshift(this.messages[i]);
      total += len;
    }
    return result;
  }

  toJSON() {
    return { type: 'buffer', maxSize: this.maxSize, windowSize: this.windowSize, messages: this.messages };
  }

  static fromJSON(data) {
    const mem = new BufferMemory({ maxSize: data.maxSize, windowSize: data.windowSize });
    mem.messages = data.messages || [];
    return mem;
  }
}

// ─── Summary Memory ───────────────────────────────────────────────────────────

/**
 * Summarizing memory — keeps a running summary + recent buffer.
 * When buffer exceeds threshold, older messages are summarized via LLM.
 */
class SummaryMemory {
  constructor({ bufferSize = config.MEMORY_BUFFER_SIZE, threshold = config.MEMORY_SUMMARY_THRESHOLD, inferUrl } = {}) {
    this.bufferSize = bufferSize;
    this.threshold = threshold;
    this.inferUrl = inferUrl || config.HEADY_INFER_URL;
    this.summary = '';
    this.buffer = new BufferMemory({ maxSize: bufferSize });
    this.summaryCount = 0;
  }

  add(role, content, metadata = {}) {
    const msg = this.buffer.add(role, content, metadata);
    return msg;
  }

  /**
   * Trigger summarization if buffer is over threshold.
   * Calls HeadyInfer to produce a condensed summary.
   */
  async maybeSummarize() {
    if (this.buffer.size() < this.threshold) return false;

    const toSummarize = this.buffer.getMessages(Math.floor(this.threshold / 2));
    const summaryContext = toSummarize.map(m => `${m.role}: ${m.content}`).join('\n');

    const prompt = this.summary
      ? `Given the existing summary:\n${this.summary}\n\nAnd these new messages:\n${summaryContext}\n\nCreate an updated concise summary.`
      : `Summarize this conversation:\n${summaryContext}`;

    try {
      const result = await httpPost(
        `${this.inferUrl}/infer`,
        {
          model: config.HEADY_INFER_DEFAULT_MODEL,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
        },
        config.HEADY_INFER_TIMEOUT_MS
      );
      const newSummary = result.body?.choices?.[0]?.message?.content
        || result.body?.content?.[0]?.text
        || '';
      if (newSummary) {
        this.summary = newSummary;
        this.summaryCount++;
        // Remove summarized messages from buffer
        this.buffer.messages = this.buffer.messages.slice(toSummarize.length);
      }
    } catch {
      // If LLM unavailable, just drop oldest messages
      this.buffer.messages = this.buffer.messages.slice(Math.floor(this.threshold / 4));
    }

    return true;
  }

  getMessages(limit) {
    return this.buffer.getMessages(limit);
  }

  getSummary() {
    return this.summary;
  }

  getContextMessages() {
    const msgs = [];
    if (this.summary) {
      msgs.push(createMessage('system', `Conversation summary: ${this.summary}`));
    }
    msgs.push(...this.buffer.getMessages());
    return msgs;
  }

  clear() {
    this.summary = '';
    this.buffer.clear();
    this.summaryCount = 0;
  }

  toJSON() {
    return {
      type: 'summary',
      bufferSize: this.bufferSize,
      threshold: this.threshold,
      summary: this.summary,
      summaryCount: this.summaryCount,
      buffer: this.buffer.toJSON(),
    };
  }

  static fromJSON(data) {
    const mem = new SummaryMemory({ bufferSize: data.bufferSize, threshold: data.threshold });
    mem.summary = data.summary || '';
    mem.summaryCount = data.summaryCount || 0;
    mem.buffer = BufferMemory.fromJSON(data.buffer);
    return mem;
  }
}

// ─── Vector Memory ────────────────────────────────────────────────────────────

/**
 * Long-term memory backed by HeadyVector for semantic retrieval.
 */
class VectorMemory {
  constructor({ namespace = 'default', vectorUrl, topK = 5 } = {}) {
    this.namespace = namespace;
    this.vectorUrl = vectorUrl || config.HEADY_VECTOR_URL;
    this.topK = topK;
    this._localFallback = []; // in-memory fallback when HeadyVector unavailable
  }

  /**
   * Store a memory item in the vector store.
   */
  async store(content, metadata = {}) {
    const item = { content, metadata, timestamp: Date.now() };
    try {
      await httpPost(
        `${this.vectorUrl}/vectors/upsert`,
        { namespace: this.namespace, documents: [{ text: content, metadata }] },
        5000
      );
    } catch {
      // Fallback: keep in local array
      this._localFallback.push(item);
      if (this._localFallback.length > 1000) this._localFallback.shift();
    }
    return item;
  }

  /**
   * Retrieve semantically similar memories.
   */
  async retrieve(query, topK) {
    const k = topK || this.topK;
    try {
      const result = await httpPost(
        `${this.vectorUrl}/vectors/query`,
        { namespace: this.namespace, query, topK: k },
        5000
      );
      return result.body?.matches || result.body?.results || [];
    } catch {
      // Fallback: simple substring search over local array
      const lower = query.toLowerCase();
      return this._localFallback
        .filter(item => item.content.toLowerCase().includes(lower))
        .slice(-k)
        .map(item => ({ content: item.content, metadata: item.metadata, score: 1 }));
    }
  }

  /**
   * Clear all memories in namespace.
   */
  async clear() {
    this._localFallback = [];
    try {
      await httpPost(`${this.vectorUrl}/vectors/delete`, { namespace: this.namespace }, 5000);
    } catch { /* ignore */ }
  }

  toJSON() {
    return {
      type: 'vector',
      namespace: this.namespace,
      topK: this.topK,
      localFallbackCount: this._localFallback.length,
    };
  }
}

// ─── Entity Memory ────────────────────────────────────────────────────────────

/**
 * Entity memory — tracks named entities (people, places, concepts) across conversations.
 */
class EntityMemory {
  constructor({ maxEntities = config.ENTITY_MEMORY_MAX } = {}) {
    this.maxEntities = maxEntities;
    this.entities = new Map(); // entityName -> { name, type, facts: [], lastSeen, importance }
  }

  /**
   * Upsert an entity with new facts.
   */
  upsert(name, { type = 'unknown', facts = [], metadata = {} } = {}) {
    const key = name.toLowerCase().trim();
    if (this.entities.has(key)) {
      const entity = this.entities.get(key);
      entity.facts.push(...facts);
      entity.lastSeen = Date.now();
      entity.metadata = { ...entity.metadata, ...metadata };
      // Cap facts
      if (entity.facts.length > 50) entity.facts = entity.facts.slice(-50);
    } else {
      this.entities.set(key, {
        name,
        type,
        facts: [...facts],
        metadata,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        importance: 1,
      });
    }

    // Prune if over limit (remove least important/oldest)
    if (this.entities.size > this.maxEntities) {
      this._prune();
    }

    return this.entities.get(key);
  }

  get(name) {
    return this.entities.get(name.toLowerCase().trim()) || null;
  }

  getAll() {
    return [...this.entities.values()];
  }

  /**
   * Extract entity context string for prompt injection.
   */
  getEntityContext(names) {
    const result = [];
    for (const name of names) {
      const entity = this.get(name);
      if (entity) {
        result.push(`${entity.name} (${entity.type}): ${entity.facts.slice(-5).join('; ')}`);
      }
    }
    return result.join('\n');
  }

  /**
   * Simple entity extraction from text using regex patterns.
   * For production, replace with NER model call.
   */
  extractFromText(text) {
    const extracted = [];
    // Capitalized proper nouns
    const properNounRe = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
    let match;
    while ((match = properNounRe.exec(text)) !== null) {
      const word = match[1];
      if (!['The', 'A', 'An', 'In', 'On', 'At', 'By', 'For', 'With'].includes(word)) {
        extracted.push({ name: word, type: 'entity' });
      }
    }
    return extracted;
  }

  /**
   * Boost importance score for an entity.
   */
  boost(name, amount = 1) {
    const entity = this.get(name);
    if (entity) entity.importance += amount;
  }

  _prune() {
    // Sort by importance * recency score, keep top maxEntities
    const sorted = [...this.entities.entries()].sort(([, a], [, b]) => {
      const scoreA = a.importance * (1 / (1 + (Date.now() - a.lastSeen) / 86400000));
      const scoreB = b.importance * (1 / (1 + (Date.now() - b.lastSeen) / 86400000));
      return scoreB - scoreA;
    });
    this.entities = new Map(sorted.slice(0, this.maxEntities));
  }

  clear() {
    this.entities.clear();
  }

  toJSON() {
    return {
      type: 'entity',
      maxEntities: this.maxEntities,
      entities: [...this.entities.entries()],
    };
  }

  static fromJSON(data) {
    const mem = new EntityMemory({ maxEntities: data.maxEntities });
    mem.entities = new Map(data.entities || []);
    return mem;
  }
}

// ─── Working Memory ───────────────────────────────────────────────────────────

/**
 * Key-value scratchpad for the current workflow execution.
 * Supports TTL per key and importance scoring for pruning.
 */
class WorkingMemory {
  constructor({ ttlMs = config.WORKING_MEMORY_TTL_MS } = {}) {
    this.defaultTtlMs = ttlMs;
    this.store = new Map(); // key -> { value, expiresAt, importance, createdAt }
  }

  set(key, value, { ttlMs, importance = 1 } = {}) {
    const expiresAt = Date.now() + (ttlMs || this.defaultTtlMs);
    this.store.set(key, { value, expiresAt, importance, createdAt: Date.now() });
    return this;
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return item.value;
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  delete(key) {
    return this.store.delete(key);
  }

  /**
   * Get all non-expired entries as a plain object.
   */
  toObject() {
    const result = {};
    const now = Date.now();
    for (const [key, item] of this.store) {
      if (now <= item.expiresAt) {
        result[key] = item.value;
      }
    }
    return result;
  }

  /**
   * Prune expired entries.
   */
  prune() {
    const now = Date.now();
    for (const [key, item] of this.store) {
      if (now > item.expiresAt) this.store.delete(key);
    }
  }

  clear() {
    this.store.clear();
  }

  size() {
    this.prune();
    return this.store.size;
  }

  toJSON() {
    this.prune();
    return {
      type: 'working',
      ttlMs: this.defaultTtlMs,
      entries: [...this.store.entries()].map(([k, v]) => [k, v]),
    };
  }

  static fromJSON(data) {
    const mem = new WorkingMemory({ ttlMs: data.ttlMs });
    for (const [k, v] of data.entries || []) {
      mem.store.set(k, v);
    }
    return mem;
  }
}

// ─── Composite Memory Manager ─────────────────────────────────────────────────

/**
 * MemoryManager bundles all memory types for a workflow/agent.
 */
class MemoryManager {
  constructor(options = {}) {
    const {
      bufferMemory,
      summaryMemory,
      vectorMemory,
      entityMemory,
      workingMemory,
    } = options;

    this.buffer = bufferMemory || new BufferMemory();
    this.summary = summaryMemory || null;
    this.vector = vectorMemory || null;
    this.entity = entityMemory || new EntityMemory();
    this.working = workingMemory || new WorkingMemory();
  }

  /**
   * Add a message to buffer (and optionally all other memories).
   */
  async addMessage(role, content, metadata = {}) {
    this.buffer.add(role, content, metadata);
    if (this.summary) {
      this.summary.add(role, content, metadata);
      await this.summary.maybeSummarize().catch(() => {});
    }
    if (this.vector) {
      await this.vector.store(`${role}: ${content}`, metadata).catch(() => {});
    }
    // Extract entities
    if (this.entity) {
      const entities = this.entity.extractFromText(content);
      for (const ent of entities) {
        this.entity.upsert(ent.name, { type: ent.type, facts: [content.slice(0, 100)] });
      }
    }
  }

  /**
   * Get context messages for LLM prompt construction.
   */
  getContextMessages(maxTokens) {
    if (this.summary) {
      return this.summary.getContextMessages();
    }
    if (maxTokens) {
      return this.buffer.getWithinTokenBudget(maxTokens);
    }
    return this.buffer.getMessages();
  }

  /**
   * Retrieve relevant memories for a query (vector search + buffer).
   */
  async retrieve(query, topK = 5) {
    const results = { buffer: this.buffer.getMessages(10), vector: [] };
    if (this.vector) {
      results.vector = await this.vector.retrieve(query, topK).catch(() => []);
    }
    return results;
  }

  /**
   * Serialize all memory for checkpointing.
   */
  toJSON() {
    return {
      buffer: this.buffer.toJSON(),
      summary: this.summary ? this.summary.toJSON() : null,
      entity: this.entity ? this.entity.toJSON() : null,
      working: this.working.toJSON(),
      // Vector is not serialized (remote store)
    };
  }

  /**
   * Restore memory from checkpoint.
   */
  static fromJSON(data) {
    const manager = new MemoryManager({
      bufferMemory: BufferMemory.fromJSON(data.buffer || {}),
      summaryMemory: data.summary ? SummaryMemory.fromJSON(data.summary) : null,
      entityMemory: data.entity ? EntityMemory.fromJSON(data.entity) : null,
      workingMemory: WorkingMemory.fromJSON(data.working || {}),
    });
    return manager;
  }
}

module.exports = {
  BufferMemory,
  SummaryMemory,
  VectorMemory,
  EntityMemory,
  WorkingMemory,
  MemoryManager,
  createMessage,
};
