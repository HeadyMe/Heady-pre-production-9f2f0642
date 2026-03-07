import { EventEmitter } from 'node:events';
import { attenuationFromDistance, cosineSimilarity, fib, spatialDistance, type Vector3 } from '@heady-ai/phi-math';
import { weightedAverageScore } from '@heady-ai/csl-router';

export interface SpatialEvent<T = unknown> {
  id: string;
  type: string;
  origin: Vector3;
  emittedBy: string;
  payload: T;
  emittedAt: number;
  trustScore: number;
  topicVector?: number[];
}

export interface SpatialDelivery<T = unknown> {
  event: SpatialEvent<T>;
  distance: number;
  attenuation: number;
  resonance: number;
  deliveryScore: number;
}

export interface SpatialSubscription<T = unknown> {
  id: string;
  position: Vector3;
  radius: number;
  type?: string;
  minDeliveryScore?: number;
  topicVector?: number[];
  handler: (delivery: SpatialDelivery<T>) => void;
}

export class SpatialEventBus extends EventEmitter {
  private readonly replayLimit: number;
  private readonly subscriptions = new Map<string, SpatialSubscription<any>>();
  private readonly replay = new Map<string, SpatialEvent<any>[]>();

  constructor(replayLimit = fib(13)) {
    super();
    this.replayLimit = replayLimit;
  }

  subscribe<T>(subscription: SpatialSubscription<T>): () => void {
    this.subscriptions.set(subscription.id, subscription);
    return () => {
      this.subscriptions.delete(subscription.id);
    };
  }

  publish<T>(event: SpatialEvent<T>): number {
    const replayBucket = this.replay.get(event.type) ?? [];
    replayBucket.push(event);
    if (replayBucket.length > this.replayLimit) replayBucket.shift();
    this.replay.set(event.type, replayBucket);

    let delivered = 0;
    for (const subscription of this.subscriptions.values()) {
      if (subscription.type && subscription.type !== event.type) continue;
      const distance = spatialDistance(subscription.position, event.origin);
      if (distance > subscription.radius) continue;
      const attenuation = attenuationFromDistance(distance);
      const resonance = event.topicVector && subscription.topicVector
        ? Math.max(0, cosineSimilarity(event.topicVector, subscription.topicVector))
        : 1;
      const deliveryScore = weightedAverageScore([
        { name: 'trust', value: event.trustScore },
        { name: 'attenuation', value: attenuation },
        { name: 'resonance', value: resonance },
      ]).score;
      if (deliveryScore < (subscription.minDeliveryScore ?? 0.236068)) continue;
      subscription.handler({ event, distance, attenuation, resonance, deliveryScore });
      delivered += 1;
      this.emit(event.type, event);
    }
    return delivered;
  }

  replayEvents<T>(type: string): SpatialEvent<T>[] {
    return (this.replay.get(type) ?? []) as SpatialEvent<T>[];
  }

  snapshot() {
    return {
      subscriptions: this.subscriptions.size,
      eventTypes: this.replay.size,
      replayLimit: this.replayLimit,
    };
  }
}
