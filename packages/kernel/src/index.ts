import { randomUUID } from 'node:crypto';
import { fib, type Vector3 } from '@heady-ai/phi-math';
import { IdentityAuthority, type AgentIdentity } from '@heady-ai/agent-identity';
import { MemoryStream } from '@heady-ai/memory-stream';
import { SpatialEventBus } from '@heady-ai/spatial-events';
import { ObservabilityKernel } from '@heady-ai/observability-kernel';
import { BoundaryGateway, ToolRegistry, ModelGateway, ConnectorRegistry, type IntentRequest } from '@heady-ai/latent-boundary';

export type AgentState = 'spawned' | 'active' | 'paused' | 'terminated';

export interface KernelLoopContext {
  workflowId: string;
  agent: AgentIdentity;
  input: Record<string, unknown>;
  retrievedMemory: ReturnType<MemoryStream['retrieve']>;
  reflection: ReturnType<MemoryStream['reflect']>;
  tools: ToolRegistry;
  models: ModelGateway;
  connectors: ConnectorRegistry;
}

export interface KernelLoopResult {
  output: Record<string, unknown>;
  outputVector: number[];
  events?: Array<{ type: string; payload: Record<string, unknown>; vector?: number[] }>;
}

export interface SpecializedNode {
  nodeType: string;
  run(context: KernelLoopContext): Promise<KernelLoopResult>;
}

export interface KernelAgentRuntime {
  identity: AgentIdentity;
  state: AgentState;
  nodeType: string;
  lastWorkflowId?: string;
}

export class LatentKernel {
  readonly identities = new IdentityAuthority('heady-kernel-authority');
  readonly events = new SpatialEventBus();
  readonly memory = new MemoryStream(undefined, this.events);
  readonly observability = new ObservabilityKernel();
  readonly boundary = new BoundaryGateway();
  readonly tools = new ToolRegistry();
  readonly models = new ModelGateway();
  readonly connectors = new ConnectorRegistry();

  private readonly nodes = new Map<string, SpecializedNode>();
  private readonly agents = new Map<string, KernelAgentRuntime>();

  registerNode(node: SpecializedNode): void {
    this.nodes.set(node.nodeType, node);
  }

  spawnAgent(input: { nodeType: string; role?: AgentIdentity['role']; seedText?: string }): KernelAgentRuntime {
    const identity = this.identities.createAgent({
      nodeType: input.nodeType,
      role: input.role,
      seedText: input.seedText,
    });
    const runtime: KernelAgentRuntime = {
      identity,
      state: 'spawned',
      nodeType: input.nodeType,
    };
    this.agents.set(identity.agentId, runtime);
    this.observability.appendAudit('agent.spawned', { agentId: identity.agentId, nodeType: input.nodeType });
    return runtime;
  }

  pauseAgent(agentId: string): void {
    const runtime = this.requireAgent(agentId);
    runtime.state = 'paused';
  }

  resumeAgent(agentId: string): void {
    const runtime = this.requireAgent(agentId);
    runtime.state = 'active';
  }

  terminateAgent(agentId: string): void {
    const runtime = this.requireAgent(agentId);
    runtime.state = 'terminated';
    this.observability.appendAudit('agent.terminated', { agentId });
  }

  async acceptExternalIntent(intent: IntentRequest): Promise<{ workflowId: string; status: string; trustScore: number }> {
    return this.boundary.acceptIntent(intent);
  }

  async runAgentLoop(agentId: string, input: Record<string, unknown>, queryVector: number[]): Promise<KernelLoopResult> {
    const runtime = this.requireAgent(agentId);
    if (runtime.state === 'terminated') throw new Error(`Agent ${agentId} is terminated`);
    if (runtime.state === 'paused') throw new Error(`Agent ${agentId} is paused`);
    runtime.state = 'active';

    const workflow = this.observability.createWorkflow('agent.loop', { agentId, nodeType: runtime.nodeType });
    runtime.lastWorkflowId = workflow.workflowId;

    const perceiveSpan = this.observability.startSpan(workflow.workflowId, 'perceive');
    this.memory.write({
      agentId,
      kind: 'observation',
      tier: 1,
      vector: queryVector,
      position: runtime.identity.position,
      payload: input,
      importance: 0.75,
      visibility: 'private',
    });
    this.observability.endSpan(perceiveSpan.spanId);

    const retrieveSpan = this.observability.startSpan(workflow.workflowId, 'retrieve');
    const retrievedMemory = this.memory.retrieve({ requesterAgentId: agentId, queryVector, limit: fib(5) });
    this.observability.endSpan(retrieveSpan.spanId, { retrieved: retrievedMemory.length });

    const reflectSpan = this.observability.startSpan(workflow.workflowId, 'reflect');
    const reflection = this.memory.reflect(agentId);
    this.observability.endSpan(reflectSpan.spanId, { sources: reflection.sourceIds.length });

    const planSpan = this.observability.startSpan(workflow.workflowId, 'plan');
    const node = this.nodes.get(runtime.nodeType);
    if (!node) throw new Error(`No specialized node registered for ${runtime.nodeType}`);
    const result = await node.run({
      workflowId: workflow.workflowId,
      agent: runtime.identity,
      input,
      retrievedMemory,
      reflection,
      tools: this.tools,
      models: this.models,
      connectors: this.connectors,
    });
    this.memory.write({
      agentId,
      kind: 'plan',
      tier: 2,
      vector: result.outputVector,
      position: runtime.identity.position,
      payload: result.output,
      importance: 0.82,
      visibility: 'private',
    });
    this.observability.endSpan(planSpan.spanId);

    const actSpan = this.observability.startSpan(workflow.workflowId, 'act');
    for (const event of result.events ?? []) {
      this.events.publish({
        id: randomUUID(),
        type: event.type,
        origin: runtime.identity.position,
        emittedBy: agentId,
        payload: event.payload,
        emittedAt: Date.now(),
        trustScore: runtime.identity.trustScore,
        topicVector: event.vector ?? result.outputVector,
      });
      this.observability.recordNeuralEvent(workflow.workflowId, event.type, event.payload, event.vector ?? result.outputVector);
    }
    this.observability.endSpan(actSpan.spanId);

    const observeSpan = this.observability.startSpan(workflow.workflowId, 'observe:store');
    this.memory.write({
      agentId,
      kind: 'observation',
      tier: 1,
      vector: result.outputVector,
      position: runtime.identity.position,
      payload: result.output,
      importance: 0.8,
      visibility: 'private',
    });
    this.observability.endSpan(observeSpan.spanId);

    this.observability.appendAudit('agent.loop.completed', { agentId, workflowId: workflow.workflowId });
    runtime.state = 'active';
    return result;
  }

  projectState() {
    return {
      agents: Array.from(this.agents.values()).map((runtime) => ({
        agentId: runtime.identity.agentId,
        nodeType: runtime.nodeType,
        state: runtime.state,
        position: runtime.identity.position,
        lastWorkflowId: runtime.lastWorkflowId,
      })),
      memoryCount: this.memory.all().length,
      eventBus: this.events.snapshot(),
      metrics: this.observability.metrics(),
    };
  }

  private requireAgent(agentId: string): KernelAgentRuntime {
    const runtime = this.agents.get(agentId);
    if (!runtime) throw new Error(`Unknown agent: ${agentId}`);
    return runtime;
  }
}
