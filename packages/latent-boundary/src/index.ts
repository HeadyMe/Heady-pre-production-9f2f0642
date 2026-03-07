import { randomUUID } from 'node:crypto';
import { weightedAverageScore, rankCandidates } from '@heady-ai/csl-router';
import type { Capability, WorkflowToken } from '@heady-ai/agent-identity';
import type { MemoryStream } from '@heady-ai/memory-stream';

export interface BoundarySessionRequest {
  subjectId: string;
  authStrength: number;
  trustInputs: Record<string, number>;
}

export interface BoundarySessionResult {
  sessionId: string;
  trustScore: number;
  accepted: boolean;
}

export interface IntentRequest {
  subjectId: string;
  intentType: string;
  payload: Record<string, unknown>;
  queryVector: number[];
  workflowToken?: WorkflowToken;
}

export interface IntentAcceptance {
  workflowId: string;
  status: 'accepted' | 'sandboxed' | 'rejected';
  trustScore: number;
}

export interface ToolSchema {
  name: string;
  requiredKeys: string[];
  description: string;
}

export interface ToolInvocation {
  toolName: string;
  input: Record<string, unknown>;
}

export interface RegisteredTool {
  schema: ToolSchema;
  invoke: (input: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>;
}

export interface ModelRequirements {
  latencyRequirement: number;
  taskComplexity: number;
  costSensitivity: number;
  contextWindowNeed: number;
  capabilityMatch: number;
}

export interface ModelProvider {
  providerId: string;
  invoke: (prompt: string) => Promise<string>;
  latencyScore: number;
  complexityScore: number;
  costScore: number;
  contextScore: number;
  capabilityScore: number;
}

export interface Connector {
  connectorId: string;
  requiredCapabilities: Capability[];
  init(): Promise<void>;
  connect(): Promise<void>;
  healthcheck(): Promise<{ ok: boolean }>;
  disconnect(): Promise<void>;
  invoke(input: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export class BoundaryGateway {
  createSession(request: BoundarySessionRequest): BoundarySessionResult {
    const trustScore = weightedAverageScore([
      { name: 'authStrength', value: request.authStrength },
      { name: 'behavioralTrust', value: request.trustInputs.behavioralTrust ?? 0.5 },
      { name: 'schemaConformance', value: request.trustInputs.schemaConformance ?? 0.5 },
      { name: 'ratePosture', value: request.trustInputs.ratePosture ?? 0.5 },
    ]).score;
    return {
      sessionId: `sess-${randomUUID()}`,
      trustScore,
      accepted: trustScore >= 0.381966,
    };
  }

  acceptIntent(request: IntentRequest): IntentAcceptance {
    const trustScore = weightedAverageScore([
      { name: 'intentShape', value: request.payload ? 0.9 : 0.1 },
      { name: 'vectorPresence', value: request.queryVector.length > 0 ? 0.9 : 0.1 },
      { name: 'workflowToken', value: request.workflowToken ? 0.9 : 0.4 },
    ]).score;
    if (trustScore < 0.236068) {
      return { workflowId: `wf-${randomUUID()}`, status: 'rejected', trustScore };
    }
    if (trustScore < 0.618034) {
      return { workflowId: `wf-${randomUUID()}`, status: 'sandboxed', trustScore };
    }
    return { workflowId: `wf-${randomUUID()}`, status: 'accepted', trustScore };
  }
}

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  register(tool: RegisteredTool): void {
    this.tools.set(tool.schema.name, tool);
  }

  list(): ToolSchema[] {
    return Array.from(this.tools.values()).map((tool) => tool.schema);
  }

  async invoke(request: ToolInvocation): Promise<Record<string, unknown>> {
    const tool = this.tools.get(request.toolName);
    if (!tool) throw new Error(`Unknown tool: ${request.toolName}`);
    for (const key of tool.schema.requiredKeys) {
      if (!(key in request.input)) throw new Error(`Missing required key: ${key}`);
    }
    return tool.invoke(request.input);
  }
}

export class ModelGateway {
  private readonly providers = new Map<string, ModelProvider>();

  register(provider: ModelProvider): void {
    this.providers.set(provider.providerId, provider);
  }

  route(requirements: ModelRequirements): ModelProvider {
    const ranked = rankCandidates(
      Array.from(this.providers.values()).map((provider) => ({
        candidate: provider,
        factors: [
          { name: 'latency', value: 1 - Math.abs(provider.latencyScore - requirements.latencyRequirement) },
          { name: 'complexity', value: 1 - Math.abs(provider.complexityScore - requirements.taskComplexity) },
          { name: 'cost', value: 1 - Math.abs(provider.costScore - requirements.costSensitivity) },
          { name: 'context', value: 1 - Math.abs(provider.contextScore - requirements.contextWindowNeed) },
          { name: 'capability', value: 1 - Math.abs(provider.capabilityScore - requirements.capabilityMatch) },
        ],
      })),
      'average',
    );
    const best = ranked[0]?.candidate;
    if (!best) throw new Error('No model providers registered');
    return best;
  }

  async execute(requirements: ModelRequirements, prompt: string): Promise<{ providerId: string; output: string }> {
    const primary = this.route(requirements);
    try {
      return { providerId: primary.providerId, output: await primary.invoke(prompt) };
    } catch (error) {
      const fallback = Array.from(this.providers.values()).find((provider) => provider.providerId !== primary.providerId);
      if (!fallback) throw error;
      return { providerId: fallback.providerId, output: await fallback.invoke(prompt) };
    }
  }
}

export class ConnectorRegistry {
  private readonly connectors = new Map<string, Connector>();

  register(connector: Connector): void {
    this.connectors.set(connector.connectorId, connector);
  }

  async health(connectorId: string): Promise<{ ok: boolean }> {
    const connector = this.connectors.get(connectorId);
    if (!connector) throw new Error(`Unknown connector: ${connectorId}`);
    return connector.healthcheck();
  }

  async invoke(connectorId: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const connector = this.connectors.get(connectorId);
    if (!connector) throw new Error(`Unknown connector: ${connectorId}`);
    return connector.invoke(input);
  }
}

export class McpBoundaryServer {
  constructor(private readonly registry: ToolRegistry) {}

  async handle(request: { jsonrpc: '2.0'; id: string | number; method: string; params?: Record<string, any> }) {
    if (request.method === 'tools/list') {
      return { jsonrpc: '2.0' as const, id: request.id, result: { tools: this.registry.list() } };
    }
    if (request.method === 'tools/call') {
      const result = await this.registry.invoke({ toolName: request.params?.name, input: request.params?.arguments ?? {} });
      return { jsonrpc: '2.0' as const, id: request.id, result };
    }
    return { jsonrpc: '2.0' as const, id: request.id, error: { code: -32601, message: 'Method not found' } };
  }
}

export interface BoundaryRuntime {
  gateway: BoundaryGateway;
  tools: ToolRegistry;
  models: ModelGateway;
  connectors: ConnectorRegistry;
  memory?: MemoryStream;
}
