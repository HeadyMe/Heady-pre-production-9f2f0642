import { HeadyError, validateUserId } from '@heady/core';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
  embedding: number[];
  metadata: Record<string, any>;
  timestamp: number;
}

export class VectorMemoryStore {
  private memories: Map<string, Vector3D[]> = new Map();

  store(userId: string, memory: Vector3D): void {
    if (!validateUserId(userId)) {
      throw new HeadyError('Invalid userId', 'INVALID_USER');
    }
    if (!this.memories.has(userId)) {
      this.memories.set(userId, []);
    }
    this.memories.get(userId)!.push(memory);
  }

  query(userId: string, embedding: number[], limit = 10): Vector3D[] {
    const userMemories = this.memories.get(userId) || [];
    return userMemories
      .map(m => ({ memory: m, similarity: this.cosineSimilarity(embedding, m.embedding) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(r => r.memory);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dot / (magA * magB);
  }

  getStats(userId: string): { count: number; octants: number } {
    const userMemories = this.memories.get(userId) || [];
    return { count: userMemories.length, octants: Math.ceil(userMemories.length / 8) };
  }
}
