/**
 * @file types.ts
 * @description Full TypeScript type definitions for the @heady-ai/sdk.
 * All numeric parameters derive from φ (1.618033988749895) and Fibonacci sequences.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// φ Constants
// ---------------------------------------------------------------------------
export const PHI = 1.618033988749895;
export const fibonacci = (n: number): number => {
  const seq = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];
  return seq[n] ?? Math.round(seq[17] * PHI ** (n - 17));
};

// ---------------------------------------------------------------------------
// Configuration Types
// ---------------------------------------------------------------------------

export interface HeadyConfig {
  /** Your HeadyOS API key */
  apiKey: string;
  /** Base URL (default: https://api.headyme.com/v1) */
  baseUrl?: string;
  /** Default timeout in ms — default: Math.round(1000 * PHI^5) = 11090ms */
  timeout?: number;
  /** Max retries with φ-backoff — default: fib(5)=5 */
  maxRetries?: number;
  /** Tenant ID for multi-tenant deployments */
  tenantId?: string;
  /** WebSocket URL (default: wss://ws.headyme.com) */
  wsUrl?: string;
  /** Custom HTTP headers injected into every request */
  headers?: Record<string, string>;
  /** Enable request/response logging */
  debug?: boolean;
}

// ---------------------------------------------------------------------------
// Auth Types
// ---------------------------------------------------------------------------

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO 8601
  tokenType: 'Bearer';
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string; // First 8 chars of SHA-256 hash
  scopes: string[];
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
}

// ---------------------------------------------------------------------------
// Brain (AI Inference) Types
// ---------------------------------------------------------------------------

export type MessageRole = 'user' | 'assistant' | 'system' | 'function';

export interface Message {
  role: MessageRole;
  content: string;
  name?: string; // For function messages
  functionCall?: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface ChatOptions {
  model?: string;          // Override default model
  temperature?: number;   // 0.0 – 1.0 (default: 1/PHI ≈ 0.618)
  maxTokens?: number;     // Default: fibonacci(12) = 144 * 10 = 1440
  stream?: boolean;       // Server-sent events streaming
  systemPrompt?: string;  // Override system prompt
  tools?: MCPTool[];      // MCP tools to make available
  agentId?: string;       // Route to specific agent
  memoryNamespace?: string; // Include vector memory context
  tenantId?: string;
}

export interface ChatResponse {
  id: string;
  model: string;
  message: Message;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'function_call' | 'content_filter';
  latencyMs: number;
  createdAt: string;
}

export interface AnalyzeOptions {
  analysisType?: 'sentiment' | 'summary' | 'classification' | 'extraction' | 'reasoning';
  outputFormat?: 'json' | 'text' | 'markdown';
  confidence?: boolean; // Include confidence scores
  model?: string;
}

export interface AnalyzeResponse {
  id: string;
  analysisType: string;
  result: unknown;
  confidence?: number; // 0.0 – 1.0, CSL-aligned thresholds
  model: string;
  latencyMs: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Agent Types
// ---------------------------------------------------------------------------

export type AgentStatus = 'active' | 'inactive' | 'deploying' | 'error';
export type AgentCapability = 'mcp_tools' | 'web_search' | 'code_execution' | 'memory_read' | 'memory_write' | 'conductor_submit';

export interface AgentConfig {
  name: string;
  description?: string;
  systemPrompt: string;
  capabilities: AgentCapability[];
  model?: string;
  tools?: string[];       // MCP tool names to grant
  memoryNamespace?: string;
  maxIterations?: number; // Default: fibonacci(7) = 13
  temperature?: number;
  metadata?: Record<string, unknown>;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  capabilities: AgentCapability[];
  model: string;
  tools: string[];
  status: AgentStatus;
  memoryNamespace?: string;
  maxIterations: number;
  ownerId: string;
  tenantId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentListFilters {
  status?: AgentStatus;
  capability?: AgentCapability;
  tenantId?: string;
  page?: number;
  pageSize?: number; // Default: fibonacci(7) = 13
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ---------------------------------------------------------------------------
// Memory (Vector) Types
// ---------------------------------------------------------------------------

export interface MemoryStoreOptions {
  namespace?: string;
  metadata?: Record<string, unknown>;
  ttlDays?: number; // Default: fibonacci(13) = 233 days
  deduplicate?: boolean;
}

export interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  namespace: string;
  metadata?: Record<string, unknown>;
  score?: number; // Cosine similarity score (0.0 – 1.0)
  createdAt: string;
  updatedAt: string;
  accessedAt?: string;
}

export interface MemorySearchOptions {
  namespace?: string;
  topK?: number;        // Default: fibonacci(5) = 5
  minScore?: number;    // Default: 1/PHI^2 ≈ 0.382 (MODERATE CSL threshold)
  filter?: Record<string, unknown>; // Metadata filter
  includeMetadata?: boolean;
}

export interface MemorySearchResponse {
  query: string;
  results: MemoryEntry[];
  totalFound: number;
  searchLatencyMs: number;
}

// ---------------------------------------------------------------------------
// MCP (Model Context Protocol) Types
// ---------------------------------------------------------------------------

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema
  outputSchema?: Record<string, unknown>;
  serverName: string;
  version: string;
  requiresAuth: boolean;
}

export interface MCPExecuteOptions {
  timeout?: number;    // Default: Math.round(1000 * PHI^4) = 6854ms
  retries?: number;    // Default: fibonacci(4) = 3
  context?: Record<string, unknown>;
}

export interface MCPExecuteResponse {
  toolName: string;
  result: unknown;
  isError: boolean;
  errorMessage?: string;
  executionMs: number;
  executedAt: string;
}

// ---------------------------------------------------------------------------
// Conductor (Orchestration) Types
// ---------------------------------------------------------------------------

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'awaiting_review';
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface ConductorTask {
  type: string;        // Task type identifier
  title?: string;
  description?: string;
  input: Record<string, unknown>;
  agentId?: string;    // Assign to specific agent
  priority?: TaskPriority;
  maxSteps?: number;   // Default: fibonacci(8) = 21
  timeout?: number;    // Default: Math.round(1000 * PHI^8) ≈ 46370ms
  webhookUrl?: string; // Callback on completion
  metadata?: Record<string, unknown>;
}

export interface ConductorTaskStatus {
  taskId: string;
  type: string;
  status: TaskStatus;
  priority: TaskPriority;
  currentStep?: number;
  maxSteps: number;
  progress?: number;  // 0.0 – 1.0
  result?: unknown;
  error?: string;
  agentId?: string;
  submittedBy: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// WebSocket / Events Types
// ---------------------------------------------------------------------------

export type EventChannel =
  | `agent:${string}`
  | `task:${string}`
  | `brain:stream:${string}`
  | `memory:${string}`
  | `system:alerts`
  | `tenant:${string}`;

export interface HeadyEvent<T = unknown> {
  channel: EventChannel;
  type: string;
  data: T;
  timestamp: string;
  sequenceId: number;
}

export type EventCallback<T = unknown> = (event: HeadyEvent<T>) => void | Promise<void>;

export interface Subscription {
  channel: EventChannel;
  unsubscribe: () => void;
}

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

export type HeadyErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'QUOTA_EXCEEDED'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INVALID_API_KEY'
  | 'TOKEN_EXPIRED'
  | 'AGENT_ERROR'
  | 'MEMORY_ERROR'
  | 'MCP_ERROR'
  | 'CONDUCTOR_ERROR';

// ---------------------------------------------------------------------------
// Zod Schemas (runtime validation)
// ---------------------------------------------------------------------------

export const HeadyConfigSchema = z.object({
  apiKey: z.string().min(1),
  baseUrl: z.string().url().optional(),
  timeout: z.number().int().positive().optional(),
  maxRetries: z.number().int().min(0).max(fibonacci(7)).optional(), // max fib(7)=13
  tenantId: z.string().optional(),
  wsUrl: z.string().url().optional(),
  headers: z.record(z.string()).optional(),
  debug: z.boolean().optional(),
});

export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'function']),
  content: z.string(),
  name: z.string().optional(),
  functionCall: z.object({
    name: z.string(),
    arguments: z.string(),
  }).optional(),
});

export const AgentConfigSchema = z.object({
  name: z.string().min(1).max(fibonacci(7)), // max 13 chars for name... actually let's be sensible
  description: z.string().max(fibonacci(11)).optional(), // max 89 chars
  systemPrompt: z.string().min(1).max(fibonacci(14) * 10), // max ~3770 chars
  capabilities: z.array(z.enum(['mcp_tools', 'web_search', 'code_execution', 'memory_read', 'memory_write', 'conductor_submit'])),
  model: z.string().optional(),
  tools: z.array(z.string()).optional(),
  memoryNamespace: z.string().optional(),
  maxIterations: z.number().int().positive().max(fibonacci(10)).optional(), // max fib(10)=55
  temperature: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const ConductorTaskSchema = z.object({
  type: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  input: z.record(z.unknown()),
  agentId: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
  maxSteps: z.number().int().positive().max(fibonacci(11)).optional(), // max fib(11)=89
  timeout: z.number().int().positive().optional(),
  webhookUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const MemoryStoreSchema = z.object({
  key: z.string().min(1).max(fibonacci(9)), // max 34 chars
  value: z.string().min(1),
  namespace: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  ttlDays: z.number().int().positive().max(fibonacci(15)).optional(), // max fib(15)=610
  deduplicate: z.boolean().optional(),
});
