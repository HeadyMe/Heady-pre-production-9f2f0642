"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpatialEventBus = void 0;
const node_events_1 = require("node:events");
const phi_math_1 = require("@heady-ai/phi-math");
const csl_router_1 = require("@heady-ai/csl-router");
class SpatialEventBus extends node_events_1.EventEmitter {
    replayLimit;
    subscriptions = new Map();
    replay = new Map();
    constructor(replayLimit = (0, phi_math_1.fib)(13)) {
        super();
        this.replayLimit = replayLimit;
    }
    subscribe(subscription) {
        this.subscriptions.set(subscription.id, subscription);
        return () => {
            this.subscriptions.delete(subscription.id);
        };
    }
    publish(event) {
        const replayBucket = this.replay.get(event.type) ?? [];
        replayBucket.push(event);
        if (replayBucket.length > this.replayLimit)
            replayBucket.shift();
        this.replay.set(event.type, replayBucket);
        let delivered = 0;
        for (const subscription of this.subscriptions.values()) {
            if (subscription.type && subscription.type !== event.type)
                continue;
            const distance = (0, phi_math_1.spatialDistance)(subscription.position, event.origin);
            if (distance > subscription.radius)
                continue;
            const attenuation = (0, phi_math_1.attenuationFromDistance)(distance);
            const resonance = event.topicVector && subscription.topicVector
                ? Math.max(0, (0, phi_math_1.cosineSimilarity)(event.topicVector, subscription.topicVector))
                : 1;
            const deliveryScore = (0, csl_router_1.weightedAverageScore)([
                { name: 'trust', value: event.trustScore },
                { name: 'attenuation', value: attenuation },
                { name: 'resonance', value: resonance },
            ]).score;
            if (deliveryScore < (subscription.minDeliveryScore ?? 0.236068))
                continue;
            subscription.handler({ event, distance, attenuation, resonance, deliveryScore });
            delivered += 1;
            this.emit(event.type, event);
        }
        return delivered;
    }
    replayEvents(type) {
        return (this.replay.get(type) ?? []);
    }
    snapshot() {
        return {
            subscriptions: this.subscriptions.size,
            eventTypes: this.replay.size,
            replayLimit: this.replayLimit,
        };
    }
}
exports.SpatialEventBus = SpatialEventBus;
//# sourceMappingURL=index.js.map