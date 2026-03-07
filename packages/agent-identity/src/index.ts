import { createHash, createHmac, generateKeyPairSync, randomUUID, sign, verify } from 'node:crypto';
import { hashToVector3, type Vector3 } from '@heady-ai/phi-math';
import { weightedAverageScore } from '@heady-ai/csl-router';

export type AgentRole = 'admin' | 'developer' | 'user' | 'agent';
export type Capability =
  | 'memory:read'
  | 'memory:write'
  | 'events:publish'
  | 'events:subscribe'
  | 'tools:invoke'
  | 'connectors:invoke'
  | 'models:route';

export interface AgentTrustInputs {
  identityProof: number;
  sandboxPosture: number;
  policyAlignment: number;
  priorReliability: number;
}

export interface AgentIdentity {
  agentId: string;
  nodeType: string;
  role: AgentRole;
  capabilities: Capability[];
  position: Vector3;
  trustScore: number;
  publicKeyPem: string;
  privateKeyPem: string;
  createdAt: number;
}

export interface SignedEnvelope<T> {
  payload: T;
  issuedAt: number;
  issuedBy: string;
  signature: string;
}

export interface WorkflowToken {
  token: string;
  workflowId: string;
  agentId: string;
  expiresAt: number;
  capabilities: Capability[];
}

const ROLE_CAPABILITIES: Record<AgentRole, Capability[]> = {
  admin: ['memory:read', 'memory:write', 'events:publish', 'events:subscribe', 'tools:invoke', 'connectors:invoke', 'models:route'],
  developer: ['memory:read', 'memory:write', 'events:publish', 'events:subscribe', 'tools:invoke', 'models:route'],
  user: ['memory:read', 'events:subscribe'],
  agent: ['memory:read', 'memory:write', 'events:publish', 'events:subscribe', 'tools:invoke'],
};

export class IdentityAuthority {
  private readonly signingSecret: string;
  private readonly agents = new Map<string, AgentIdentity>();

  constructor(signingSecret = 'heady-latent-authority') {
    this.signingSecret = signingSecret;
  }

  createAgent(input: {
    agentId?: string;
    nodeType: string;
    role?: AgentRole;
    capabilities?: Capability[];
    seedText?: string;
    trustInputs?: Partial<AgentTrustInputs>;
  }): AgentIdentity {
    const keyPair = generateKeyPairSync('ed25519');
    const agentId = input.agentId ?? randomUUID();
    const role = input.role ?? 'agent';
    const capabilities = input.capabilities ?? ROLE_CAPABILITIES[role];
    const trustScore = this.computeTrust({
      identityProof: input.trustInputs?.identityProof ?? 0.89,
      sandboxPosture: input.trustInputs?.sandboxPosture ?? 0.89,
      policyAlignment: input.trustInputs?.policyAlignment ?? 0.89,
      priorReliability: input.trustInputs?.priorReliability ?? 0.89,
    });
    const identity: AgentIdentity = {
      agentId,
      nodeType: input.nodeType,
      role,
      capabilities,
      position: hashToVector3(input.seedText ?? `${agentId}:${input.nodeType}`),
      trustScore,
      publicKeyPem: keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      privateKeyPem: keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      createdAt: Date.now(),
    };
    this.agents.set(agentId, identity);
    return identity;
  }

  getAgent(agentId: string): AgentIdentity | undefined {
    return this.agents.get(agentId);
  }

  computeTrust(inputs: AgentTrustInputs): number {
    return weightedAverageScore([
      { name: 'identityProof', value: inputs.identityProof },
      { name: 'sandboxPosture', value: inputs.sandboxPosture },
      { name: 'policyAlignment', value: inputs.policyAlignment },
      { name: 'priorReliability', value: inputs.priorReliability },
    ]).score;
  }

  signPayload<T>(agentId: string, payload: T): SignedEnvelope<T> {
    const identity = this.agents.get(agentId);
    if (!identity) throw new Error(`Unknown agent: ${agentId}`);
    const issuedAt = Date.now();
    const serialized = JSON.stringify({ payload, issuedAt, issuedBy: identity.agentId });
    const signature = sign(null, Buffer.from(serialized), identity.privateKeyPem).toString('base64');
    return { payload, issuedAt, issuedBy: identity.agentId, signature };
  }

  verifyEnvelope<T>(envelope: SignedEnvelope<T>): boolean {
    const identity = this.agents.get(envelope.issuedBy);
    if (!identity) return false;
    const serialized = JSON.stringify({ payload: envelope.payload, issuedAt: envelope.issuedAt, issuedBy: envelope.issuedBy });
    return verify(null, Buffer.from(serialized), identity.publicKeyPem, Buffer.from(envelope.signature, 'base64'));
  }

  createWorkflowToken(agentId: string, workflowId: string, ttlMs: number, capabilities?: Capability[]): WorkflowToken {
    const identity = this.agents.get(agentId);
    if (!identity) throw new Error(`Unknown agent: ${agentId}`);
    const expiresAt = Date.now() + ttlMs;
    const tokenCapabilities = capabilities ?? identity.capabilities;
    const body = JSON.stringify({ agentId, workflowId, expiresAt, capabilities: tokenCapabilities });
    const token = createHmac('sha256', this.signingSecret).update(body).digest('base64url');
    return { token, workflowId, agentId, expiresAt, capabilities: tokenCapabilities };
  }

  validateWorkflowToken(token: WorkflowToken): boolean {
    const body = JSON.stringify({
      agentId: token.agentId,
      workflowId: token.workflowId,
      expiresAt: token.expiresAt,
      capabilities: token.capabilities,
    });
    const expected = createHmac('sha256', this.signingSecret).update(body).digest('base64url');
    return token.expiresAt > Date.now() && expected === token.token;
  }

  fingerprint(agentId: string): string {
    const identity = this.agents.get(agentId);
    if (!identity) throw new Error(`Unknown agent: ${agentId}`);
    return createHash('sha256').update(identity.publicKeyPem).digest('hex');
  }
}
