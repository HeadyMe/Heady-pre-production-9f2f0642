import { EventEmitter } from 'node:events';
import { type Vector3 } from '@heady-ai/phi-math';
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
export declare class SpatialEventBus extends EventEmitter {
    private readonly replayLimit;
    private readonly subscriptions;
    private readonly replay;
    constructor(replayLimit?: number);
    subscribe<T>(subscription: SpatialSubscription<T>): () => void;
    publish<T>(event: SpatialEvent<T>): number;
    replayEvents<T>(type: string): SpatialEvent<T>[];
    snapshot(): {
        subscriptions: number;
        eventTypes: number;
        replayLimit: number;
    };
}
//# sourceMappingURL=index.d.ts.map