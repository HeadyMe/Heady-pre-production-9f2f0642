/**
 * @file index.ts
 * @description @heady-ai/sdk — Official JavaScript/TypeScript SDK for HeadyOS & HeadyMe AI
 *
 * HeadySystems Inc. | https://headyme.com | sdk@headyme.com
 *
 * Features:
 * - AI brain inference (chat, analyze)
 * - Agent management (create, list, get, delete)
 * - Vector memory (store, search)
 * - MCP tool execution
 * - Conductor orchestration (submit, status)
 * - Real-time events via WebSocket
 * - φ-exponential retry backoff
 * - Auto token refresh
 * - Full TypeScript type safety (Zod runtime validation)
 */

import { HeadyHttpClient } from './client';
import { HeadyWebSocketClient } from './websocket';
import {
  PHI,
  fibonacci,
  HeadyConfigSchema,
  type HeadyConfig,
  type Message,
  type ChatOptions,
  type ChatResponse,
  type AnalyzeOptions,
  type AnalyzeResponse,
  type Agent,
  type AgentConfig,
  type AgentListFilters,
  type PaginatedResponse,
  type MemoryEntry,
  type MemoryStoreOptions,
  type MemorySearchOptions,
  type MemorySearchResponse,
  type MCPTool,
  type MCPExecuteOptions,
  type MCPExecuteResponse,
  type ConductorTask,
  type ConductorTaskStatus,
  type EventChannel,
  type EventCallback,
  type Subscription,
} from './types';

export * from './types';
export * from './errors';

// ---------------------------------------------------------------------------
// Default Configuration Values (φ-derived)
// ---------------------------------------------------------------------------

const DEFAULTS = {
  BASE_URL: 'https://api.headyme.com/v1',
  WS_URL: 'wss://ws.headyme.com',
  // Timeout: 1000ms × φ^5 ≈ 11090ms
  TIMEOUT_MS: Math.round(1000 * Math.pow(PHI, 5)),
  // Max retries: fib(5)=5
  MAX_RETRIES: fibonacci(5),
  // Memory page size: fib(5)=5
  MEMORY_TOP_K: fibonacci(5),
  // Min memory score: 1/PHI^2 ≈ 0.382 (MODERATE CSL threshold)
  MEMORY_MIN_SCORE: 1 / (PHI * PHI),
  // Default temperature: 1/PHI ≈ 0.618 (HIGH CSL threshold)
  TEMPERATURE: 1 / PHI,
  // Default agent max iterations: fib(7)=13
  AGENT_MAX_ITERATIONS: fibonacci(7),
  // Default memory TTL: fib(13)=233 days
  MEMORY_TTL_DAYS: fibonacci(13),
  // Default conductor max steps: fib(8)=21
  CONDUCTOR_MAX_STEPS: fibonacci(8),
  // Agent list page size: fib(7)=13
  AGENT_PAGE_SIZE: fibonacci(7),
};

// ---------------------------------------------------------------------------
// Brain API Namespace
// ---------------------------------------------------------------------------

class BrainAPI {
  constructor(private readonly http: HeadyHttpClient) {}

  /**
   * Chat with a HeadyOS AI brain (GPT-4o, Claude, Llama, etc.)
   * with optional MCP tool access and vector memory context.
   *
   * @example
   * const response = await client.brain.chat([
   *   { role: 'user', content: 'What are the latest trends in multi-agent AI?' }
   * ]);
   */
  async chat(messages: Message[], options: ChatOptions = {}): Promise<ChatResponse> {
    return this.http.post<ChatResponse>('/brain/chat', {
      messages,
      model: options.model,
      temperature: options.temperature ?? DEFAULTS.TEMPERATURE,
      maxTokens: options.maxTokens,
      stream: options.stream ?? false,
      systemPrompt: options.systemPrompt,
      tools: options.tools,
      agentId: options.agentId,
      memoryNamespace: options.memoryNamespace,
      tenantId: options.tenantId,
    });
  }

  /**
   * Analyze input text with HeadyOS AI inference.
   * Supports sentiment analysis, summarization, classification, and more.
   *
   * @example
   * const result = await client.brain.analyze('This product is amazing!', {
   *   analysisType: 'sentiment',
   *   outputFormat: 'json',
   *   confidence: true,
   * });
   */
  async analyze(input: string, options: AnalyzeOptions = {}): Promise<AnalyzeResponse> {
    return this.http.post<AnalyzeResponse>('/brain/analyze', {
      input,
      analysisType: options.analysisType ?? 'reasoning',
      outputFormat: options.outputFormat ?? 'json',
      confidence: options.confidence ?? true,
      model: options.model,
    });
  }
}

// ---------------------------------------------------------------------------
// Agents API Namespace
// ---------------------------------------------------------------------------

class AgentsAPI {
  constructor(private readonly http: HeadyHttpClient) {}

  /**
   * Create a new AI agent on HeadyOS.
   *
   * @example
   * const agent = await client.agents.create({
   *   name: 'research-agent',
   *   systemPrompt: 'You are a specialized research agent...',
   *   capabilities: ['mcp_tools', 'memory_read', 'memory_write'],
   *   tools: ['web_search', 'code_interpreter'],
   * });
   */
  async create(config: AgentConfig): Promise<Agent> {
    const payload = {
      ...config,
      maxIterations: config.maxIterations ?? DEFAULTS.AGENT_MAX_ITERATIONS,
      temperature: config.temperature ?? DEFAULTS.TEMPERATURE,
    };
    return this.http.post<Agent>('/agents', payload);
  }

  /**
   * List agents with optional filters.
   */
  async list(filters: AgentListFilters = {}): Promise<PaginatedResponse<Agent>> {
    return this.http.get<PaginatedResponse<Agent>>('/agents', {
      ...filters,
      pageSize: filters.pageSize ?? DEFAULTS.AGENT_PAGE_SIZE,
    });
  }

  /**
   * Get a specific agent by ID.
   */
  async get(id: string): Promise<Agent> {
    return this.http.get<Agent>(`/agents/${id}`);
  }

  /**
   * Update an agent's configuration.
   */
  async update(id: string, updates: Partial<AgentConfig>): Promise<Agent> {
    return this.http.patch<Agent>(`/agents/${id}`, updates);
  }

  /**
   * Delete an agent permanently.
   */
  async delete(id: string): Promise<{ success: boolean; deletedId: string }> {
    return this.http.delete<{ success: boolean; deletedId: string }>(`/agents/${id}`);
  }
}

// ---------------------------------------------------------------------------
// Memory API Namespace
// ---------------------------------------------------------------------------

class MemoryAPI {
  constructor(private readonly http: HeadyHttpClient) {}

  /**
   * Store a key-value pair in HeadyOS vector memory.
   * Optionally provide a pre-computed vector embedding.
   *
   * @example
   * await client.memory.store('user-preference', 'Prefers concise, technical responses', {
   *   namespace: 'user-123',
   *   metadata: { source: 'feedback', confidence: 0.854 },
   * });
   */
  async store(key: string, value: string, options: MemoryStoreOptions = {}): Promise<MemoryEntry> {
    return this.http.post<MemoryEntry>('/memory', {
      key,
      value,
      namespace: options.namespace,
      metadata: options.metadata,
      ttlDays: options.ttlDays ?? DEFAULTS.MEMORY_TTL_DAYS,
      deduplicate: options.deduplicate ?? true,
    });
  }

  /**
   * Semantic search across vector memory.
   *
   * @example
   * const results = await client.memory.search('user communication preferences', {
   *   namespace: 'user-123',
   *   topK: 5,
   *   minScore: 0.618, // HIGH CSL threshold
   * });
   */
  async search(query: string, options: MemorySearchOptions = {}): Promise<MemorySearchResponse> {
    return this.http.post<MemorySearchResponse>('/memory/search', {
      query,
      namespace: options.namespace,
      topK: options.topK ?? DEFAULTS.MEMORY_TOP_K,
      minScore: options.minScore ?? DEFAULTS.MEMORY_MIN_SCORE,
      filter: options.filter,
      includeMetadata: options.includeMetadata ?? true,
    });
  }

  /**
   * Get a specific memory entry by key.
   */
  async get(key: string, namespace?: string): Promise<MemoryEntry | null> {
    return this.http.get<MemoryEntry | null>('/memory/get', { key, namespace });
  }

  /**
   * Delete a memory entry.
   */
  async delete(key: string, namespace?: string): Promise<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`/memory/${encodeURIComponent(key)}${namespace ? `?namespace=${namespace}` : ''}`);
  }

  /**
   * List memory entries in a namespace.
   */
  async list(namespace: string, page = 1, pageSize = fibonacci(7)): Promise<PaginatedResponse<MemoryEntry>> {
    return this.http.get<PaginatedResponse<MemoryEntry>>('/memory', { namespace, page, pageSize });
  }
}

// ---------------------------------------------------------------------------
// MCP API Namespace
// ---------------------------------------------------------------------------

class MCPAPI {
  constructor(private readonly http: HeadyHttpClient) {}

  /**
   * List all available MCP tools registered in HeadyOS.
   */
  async listTools(): Promise<MCPTool[]> {
    return this.http.get<MCPTool[]>('/mcp/tools');
  }

  /**
   * Execute an MCP tool with provided arguments.
   *
   * @example
   * const result = await client.mcp.executeTool('web_search', {
   *   query: 'latest developments in multi-agent AI systems',
   *   maxResults: 5,
   * });
   */
  async executeTool(name: string, args: Record<string, unknown>, options: MCPExecuteOptions = {}): Promise<MCPExecuteResponse> {
    return this.http.post<MCPExecuteResponse>('/mcp/tools/execute', {
      name,
      arguments: args,
      timeout: options.timeout ?? Math.round(1000 * Math.pow(PHI, 4)), // fib φ^4 ≈ 6854ms
      retries: options.retries ?? fibonacci(4), // fib(4)=3
      context: options.context,
    });
  }

  /**
   * Get details of a specific MCP tool.
   */
  async getTool(name: string): Promise<MCPTool> {
    return this.http.get<MCPTool>(`/mcp/tools/${encodeURIComponent(name)}`);
  }
}

// ---------------------------------------------------------------------------
// Conductor API Namespace
// ---------------------------------------------------------------------------

class ConductorAPI {
  constructor(private readonly http: HeadyHttpClient) {}

  /**
   * Submit an orchestration task to the Heady Conductor.
   * The Conductor manages multi-agent, multi-step workflows.
   *
   * @example
   * const task = await client.conductor.submitTask({
   *   type: 'research_report',
   *   title: 'Q1 2026 AI Market Analysis',
   *   input: {
   *     topic: 'Enterprise AI adoption trends',
   *     depth: 'comprehensive',
   *   },
   *   agentId: 'research-agent-id',
   *   priority: 'high',
   * });
   */
  async submitTask(task: ConductorTask): Promise<ConductorTaskStatus> {
    const payload = {
      ...task,
      maxSteps: task.maxSteps ?? DEFAULTS.CONDUCTOR_MAX_STEPS,
      timeout: task.timeout ?? Math.round(1000 * Math.pow(PHI, 8)), // φ^8 ≈ 46370ms
    };
    return this.http.post<ConductorTaskStatus>('/conductor/tasks', payload);
  }

  /**
   * Get the current status and result of a Conductor task.
   */
  async getStatus(taskId: string): Promise<ConductorTaskStatus> {
    return this.http.get<ConductorTaskStatus>(`/conductor/tasks/${taskId}`);
  }

  /**
   * Cancel a running Conductor task.
   */
  async cancelTask(taskId: string): Promise<ConductorTaskStatus> {
    return this.http.post<ConductorTaskStatus>(`/conductor/tasks/${taskId}/cancel`, {});
  }

  /**
   * List Conductor tasks.
   */
  async listTasks(filters?: {
    status?: string;
    agentId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResponse<ConductorTaskStatus>> {
    return this.http.get<PaginatedResponse<ConductorTaskStatus>>('/conductor/tasks', {
      ...filters,
      pageSize: filters?.pageSize ?? DEFAULTS.AGENT_PAGE_SIZE,
    });
  }

  /**
   * Wait for a task to complete (polls with φ-backoff).
   */
  async waitForCompletion(taskId: string, maxWaitMs = Math.round(1000 * Math.pow(PHI, 10))): Promise<ConductorTaskStatus> {
    const deadline = Date.now() + maxWaitMs;
    let attempt = 0;

    while (Date.now() < deadline) {
      const status = await this.getStatus(taskId);
      if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
        return status;
      }
      const delay = Math.min(
        Math.round(1000 * Math.pow(PHI, attempt++)),
        Math.round(1000 * Math.pow(PHI, 8))
      );
      await new Promise(r => setTimeout(r, delay));
    }

    throw new Error(`Task ${taskId} did not complete within ${maxWaitMs}ms`);
  }
}

// ---------------------------------------------------------------------------
// Events API Namespace
// ---------------------------------------------------------------------------

class EventsAPI {
  private ws: HeadyWebSocketClient | null = null;
  private connected = false;

  constructor(private readonly config: HeadyConfig) {}

  private async ensureConnected(): Promise<HeadyWebSocketClient> {
    if (!this.ws) {
      this.ws = new HeadyWebSocketClient(this.config);
    }
    if (!this.connected) {
      await this.ws.connect();
      this.connected = true;
    }
    return this.ws;
  }

  /**
   * Subscribe to a real-time event channel.
   *
   * @example
   * const sub = await client.events.subscribe('task:my-task-id', (event) => {
   *   console.log('Task update:', event.data);
   * });
   * // Later:
   * sub.unsubscribe();
   */
  async subscribe<T = unknown>(channel: EventChannel, callback: EventCallback<T>): Promise<Subscription> {
    const ws = await this.ensureConnected();
    return ws.subscribe<T>(channel, callback);
  }

  /**
   * Wait for a single event on a channel.
   */
  async once<T = unknown>(channel: EventChannel): Promise<{ data: T; channel: EventChannel }> {
    const ws = await this.ensureConnected();
    const event = await ws.once<T>(channel);
    return { data: event.data as T, channel };
  }

  /** Disconnect WebSocket */
  disconnect(): void {
    this.ws?.disconnect();
    this.ws = null;
    this.connected = false;
  }
}

// ---------------------------------------------------------------------------
// Main HeadyClient
// ---------------------------------------------------------------------------

/**
 * HeadyClient — The main entry point for the @heady-ai/sdk.
 *
 * @example
 * ```typescript
 * import { HeadyClient } from '@heady-ai/sdk';
 *
 * const heady = new HeadyClient({
 *   apiKey: process.env.HEADY_API_KEY!,
 *   tenantId: 'my-org',
 * });
 *
 * // Chat with AI
 * const response = await heady.brain.chat([
 *   { role: 'user', content: 'Hello, HeadyOS!' }
 * ]);
 *
 * // Create an agent
 * const agent = await heady.agents.create({
 *   name: 'my-agent',
 *   systemPrompt: 'You are a helpful AI assistant...',
 *   capabilities: ['mcp_tools', 'memory_read'],
 * });
 *
 * // Store to vector memory
 * await heady.memory.store('user-context', 'User prefers detailed explanations');
 *
 * // Search memory
 * const results = await heady.memory.search('user preferences');
 *
 * // Subscribe to real-time events
 * const sub = await heady.events.subscribe(`task:${task.taskId}`, (event) => {
 *   console.log('Task update:', event.data);
 * });
 * ```
 */
export class HeadyClient {
  readonly brain: BrainAPI;
  readonly agents: AgentsAPI;
  readonly memory: MemoryAPI;
  readonly mcp: MCPAPI;
  readonly conductor: ConductorAPI;
  readonly events: EventsAPI;

  private readonly http: HeadyHttpClient;
  readonly config: HeadyConfig;

  // φ constant exposed for users
  static readonly PHI = PHI;
  static readonly fibonacci = fibonacci;

  constructor(config: HeadyConfig) {
    // Validate config at runtime
    const validated = HeadyConfigSchema.parse(config);
    this.config = validated as HeadyConfig;

    this.http = new HeadyHttpClient(this.config);

    this.brain     = new BrainAPI(this.http);
    this.agents    = new AgentsAPI(this.http);
    this.memory    = new MemoryAPI(this.http);
    this.mcp       = new MCPAPI(this.http);
    this.conductor = new ConductorAPI(this.http);
    this.events    = new EventsAPI(this.config);
  }

  /**
   * Add a custom request interceptor (runs before each HTTP request).
   */
  addRequestInterceptor(fn: (config: object) => object | Promise<object>): this {
    this.http.addRequestInterceptor(fn as Parameters<HeadyHttpClient['addRequestInterceptor']>[0]);
    return this;
  }

  /**
   * Add a custom response interceptor (runs after each HTTP response).
   */
  addResponseInterceptor(fn: (response: object) => object | Promise<object>): this {
    this.http.addResponseInterceptor(fn as Parameters<HeadyHttpClient['addResponseInterceptor']>[0]);
    return this;
  }

  /**
   * Health check — verify API connectivity and authentication.
   */
  async healthCheck(): Promise<{ status: string; version: string; latencyMs: number }> {
    const start = Date.now();
    const result = await this.http.get<{ status: string; version: string }>('/health');
    return { ...result, latencyMs: Date.now() - start };
  }

  /**
   * Disconnect WebSocket connections and clean up.
   */
  destroy(): void {
    this.events.disconnect();
  }
}

export default HeadyClient;
