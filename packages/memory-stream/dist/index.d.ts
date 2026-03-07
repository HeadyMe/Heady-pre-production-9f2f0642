import { type Vector3 } from '@heady-ai/phi-math';
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
export declare class MemoryStream {
    private readonly accessController?;
    private readonly eventBus?;
    private readonly records;
    constructor(accessController?: MemoryAccessController | undefined, eventBus?: SpatialEventBus | undefined);
    write<T>(input: Omit<MemoryRecord<T>, 'memoryId' | 'createdAt'>): MemoryRecord<T>;
    retrieve<T = unknown>(options: RetrievalOptions): RetrievedMemory<T>[];
    reflect(agentId: string, maxItems?: number): ReflectionResult;
    all(): MemoryRecord[];
}
//# sourceMappingURL=index.d.ts.map