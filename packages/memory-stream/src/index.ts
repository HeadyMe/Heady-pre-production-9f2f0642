import { randomUUID } from 'node:crypto';
import { cosineSimilarity, meanVector, phiWeights, type Vector3 } from '@heady-ai/phi-math';
import { weightedAverageScore } from '@heady-ai/csl-router';
import { SpatialEventBus } from '@heady-ai/spatial-events';

export type MemoryKind = 'observation' | 'reflection' | 'plan';
export type MemoryTier = 1 | 2 | 3 | 4;

export interface MemoryRecord<T = unknown> {
  memoryId: string;
  agentId: string;
  kind: MemoryKind;
  tier: MemoryTier;
  vector: number[];
  position: Vector3;
  payload: T;
  importance: number;
  createdAt: number;
  visibility: 'private' | 'shared';
}

export interface RetrievalOptions {
  requesterAgentId: string;
  queryVector: number[];
  limit?: number;
  includeKinds?: MemoryKind[];
  sinceMs?: number;
}

export interface RetrievedMemory<T = unknown> {
  record: MemoryRecord<T>;
  score: number;
  relevance: number;
  recency: number;
}

export interface MemoryAccessController {
  canRead(requesterAgentId: string, record: MemoryRecord): boolean;
}

export interface ReflectionResult {
  agentId: string;
  sourceIds: string[];
  centroid: number[];
  averageImportance: number;
  sourceKinds: MemoryKind[];
}

export class MemoryStream {
  private readonly records: MemoryRecord[] = [];

  constructor(
    private readonly accessController?: MemoryAccessController,
    private readonly eventBus?: SpatialEventBus,
  ) {}

  write<T>(input: Omit<MemoryRecord<T>, 'memoryId' | 'createdAt'>): MemoryRecord<T> {
    const record: MemoryRecord<T> = {
      ...input,
      memoryId: randomUUID(),
      createdAt: Date.now(),
    };
    this.records.push(record);
    if (this.eventBus) {
      this.eventBus.publish({
        id: record.memoryId,
        type: 'memory.written',
        origin: record.position,
        emittedBy: record.agentId,
        payload: { kind: record.kind, tier: record.tier },
        emittedAt: record.createdAt,
        trustScore: Math.max(0.236068, Math.min(1, record.importance)),
        topicVector: record.vector,
      });
    }
    return record;
  }

  retrieve<T = unknown>(options: RetrievalOptions): RetrievedMemory<T>[] {
    const weights = phiWeights(3);
    const now = Date.now();
    return this.records
      .filter((record) => (options.includeKinds ? options.includeKinds.includes(record.kind) : true))
      .filter((record) => (!options.sinceMs ? true : record.createdAt >= now - options.sinceMs))
      .filter((record) => this.accessController ? this.accessController.canRead(options.requesterAgentId, record) : true)
      .map((record) => {
        const ageMs = Math.max(1, now - record.createdAt);
        const recency = Math.exp(-ageMs / (89 * 1000));
        const relevance = Math.max(0, cosineSimilarity(options.queryVector, record.vector));
        const score = weightedAverageScore([
          { name: 'relevance', value: relevance, weight: weights[0] },
          { name: 'importance', value: record.importance, weight: weights[1] },
          { name: 'recency', value: recency, weight: weights[2] },
        ]).score;
        return { record: record as MemoryRecord<T>, score, relevance, recency };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, options.limit ?? 13);
  }

  reflect(agentId: string, maxItems = 8): ReflectionResult {
    const source = this.records
      .filter((record) => record.agentId === agentId)
      .slice(-maxItems);
    return {
      agentId,
      sourceIds: source.map((record) => record.memoryId),
      centroid: meanVector(source.map((record) => record.vector)),
      averageImportance: source.length === 0 ? 0 : source.reduce((sum, record) => sum + record.importance, 0) / source.length,
      sourceKinds: source.map((record) => record.kind),
    };
  }

  all(): MemoryRecord[] {
    return [...this.records];
  }
}
