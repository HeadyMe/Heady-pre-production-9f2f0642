/**
 * @headysystems/types
 * Shared TypeScript types across all services
 */

// ========== Service Types ==========
export interface ServiceMetadata {
  name: string;
  version: string;
  category: ServiceCategory;
  domain: string;
  status: ServiceStatus;
  healthEndpoint?: string;
}

export type ServiceCategory =
  | 'cognitive-core'
  | 'user-facing'
  | 'software-factory'
  | 'security-quality'
  | 'infrastructure'
  | 'external-ai'
  | 'mcp';

export type ServiceStatus = 'healthy' | 'degraded' | 'unavailable' | 'maintenance';

// ========== Task Types ==========
export interface Task {
  id: string;
  type: string;
  priority: number; // 0.0 to 1.0 (semantic gate output)
  status: TaskStatus;
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

export type TaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskAssignment {
  taskId: string;
  agentId: string;
  assignedAt: Date;
  latency: number; // milliseconds
}

// ========== MCP Types ==========
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: string; // Service endpoint
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

export interface MCPRequest {
  tool: string;
  parameters: Record<string, any>;
  requestId: string;
  timestamp: Date;
}

export interface MCPResponse {
  requestId: string;
  result?: any;
  error?: {
    code: string;
    message: string;
  };
  metadata?: {
    latency: number;
    service: string;
  };
}

// ========== Agent Types ==========
export interface Agent {
  id: string;
  type: AgentType;
  status: AgentStatus;
  capabilities: string[];
  currentLoad: number; // 0.0 to 1.0
  maxConcurrentTasks: number;
}

export type AgentType = 'heady-brain' | 'heady-buddy' | 'heady-coder' | 'heady-lens' | 'custom';
export type AgentStatus = 'idle' | 'busy' | 'overloaded' | 'offline';

// ========== Decision Types ==========
export interface Decision {
  id: string;
  input: Record<string, any>;
  output: any;
  confidence: number; // 0.0 to 1.0
  reasoning: string;
  gateTrace?: GateEvaluation[];
  timestamp: Date;
}

export interface GateEvaluation {
  gateType: string;
  label: string;
  inputs: { value: number; label: string }[];
  output: number;
  tnorm: string;
}

// ========== Orchestration Types ==========
export interface OrchestrationEvent {
  type: 'task_created' | 'task_assigned' | 'task_completed' | 'task_failed' | 'agent_registered';
  payload: any;
  timestamp: Date;
  source: string;
}

export interface HealthCheck {
  service: string;
  status: ServiceStatus;
  uptime: number; // seconds
  lastCheck: Date;
  metrics?: {
    cpu: number;
    memory: number;
    activeConnections: number;
  };
}
