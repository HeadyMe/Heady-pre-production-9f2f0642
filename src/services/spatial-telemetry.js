/**
 * 3D Spatial Telemetry — Replaces standard flat logging with
 * coordinate-aware observability that tracks agent drift,
 * trajectory anomalies, collision events, and spatial density.
 *
 * Integrates with OpenTelemetry for span attributes enrichment
 * and provides a spatial metrics collector for Prometheus.
 *
 * @module src/services/spatial-telemetry
 * @version 1.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 */

'use strict';

const { EventEmitter } = require('events');

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// ─── Spatial Metric Types ─────────────────────────────────────────

const METRIC = Object.freeze({
    DRIFT: 'heady.spatial.drift',
    VELOCITY: 'heady.spatial.velocity',
    COLLISION: 'heady.spatial.collision',
    DENSITY: 'heady.spatial.density',
    TRAJECTORY_ERR: 'heady.spatial.trajectory_error',
    ANCHOR_DIST: 'heady.spatial.anchor_distance',
    REGION_POP: 'heady.spatial.region_population',
    LATENCY: 'heady.spatial.operation_latency',
});

/**
 * SpatialTelemetry — 3D-aware observability service.
 */
class SpatialTelemetry {
    constructor(opts = {}) {
        this.events = new EventEmitter();
        this.collisionLog = [];
        this.maxCollisionLog = FIB[12]; // 144
        this.driftThreshold = opts.driftThreshold || PHI * 5; // ~8.09 units
        this.velocityWindow = opts.velocityWindow || FIB[6]; // 8 samples
        this.entities = new Map(); // id → { positions: [], metrics: {} }
        this.regions = new Map(); // regionKey → Set<entityId>
        this.regionSize = opts.regionSize || FIB[7]; // 13 units per region cell
        this.startTime = Date.now();

        // Optional OTel meter
        this.meter = opts.meter || null;
        this._initMetrics();
    }

    _initMetrics() {
        if (!this.meter) return;
        this._driftHistogram = this.meter.createHistogram(METRIC.DRIFT, {
            description: 'Agent drift from anchor position',
            unit: 'units',
        });
        this._velocityHistogram = this.meter.createHistogram(METRIC.VELOCITY, {
            description: 'Agent velocity in vector space',
            unit: 'units/s',
        });
        this._collisionCounter = this.meter.createCounter(METRIC.COLLISION, {
            description: 'Total spatial collision events',
        });
        this._densityGauge = this.meter.createObservableGauge(METRIC.DENSITY, {
            description: 'Spatial density per region',
        });
    }

    // ─── Position Tracking ──────────────────────────────────────────

    /**
     * Record entity position with full spatial telemetry.
     */
    recordPosition(entityId, x, y, z, meta = {}) {
        const now = Date.now();
        if (!this.entities.has(entityId)) {
            this.entities.set(entityId, {
                positions: [],
                anchor: { x, y, z },
                type: meta.type || 'agent',
                metrics: { maxDrift: 0, totalDistance: 0, collisions: 0 },
            });
        }

        const entity = this.entities.get(entityId);
        const prev = entity.positions[entity.positions.length - 1];

        // Calculate velocity
        let velocity = 0;
        if (prev) {
            const dx = x - prev.x, dy = y - prev.y, dz = z - prev.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const dt = (now - prev.t) / 1000; // seconds
            velocity = dt > 0 ? dist / dt : 0;
            entity.metrics.totalDistance += dist;
        }

        // Store position
        entity.positions.push({ x, y, z, t: now, velocity });
        if (entity.positions.length > this.velocityWindow * 4) {
            entity.positions = entity.positions.slice(-this.velocityWindow * 2);
        }

        // Calculate drift from anchor
        const drift = Math.sqrt(
            (x - entity.anchor.x) ** 2 +
            (y - entity.anchor.y) ** 2 +
            (z - entity.anchor.z) ** 2
        );
        entity.metrics.maxDrift = Math.max(entity.metrics.maxDrift, drift);

        // Update region tracking
        const regionKey = this._regionKey(x, y, z);
        for (const [key, members] of this.regions) {
            members.delete(entityId);
            if (members.size === 0) this.regions.delete(key);
        }
        if (!this.regions.has(regionKey)) this.regions.set(regionKey, new Set());
        this.regions.get(regionKey).add(entityId);

        // OTel metrics
        if (this._driftHistogram) {
            this._driftHistogram.record(drift, { entity_id: entityId, type: entity.type });
        }
        if (this._velocityHistogram && velocity > 0) {
            this._velocityHistogram.record(velocity, { entity_id: entityId });
        }

        // Drift alert
        if (drift > this.driftThreshold) {
            this.events.emit('drift_alert', {
                entityId, drift, threshold: this.driftThreshold,
                position: { x, y, z }, anchor: entity.anchor,
            });
        }

        // Trajectory anomaly detection (sudden velocity spike)
        if (prev && velocity > 0) {
            const avgVelocity = this._avgVelocity(entityId);
            if (velocity > avgVelocity * PHI * PHI) { // >φ² × average
                this.events.emit('trajectory_anomaly', {
                    entityId, velocity, avgVelocity,
                    ratio: velocity / avgVelocity,
                    position: { x, y, z },
                });
            }
        }

        return { drift, velocity, regionKey };
    }

    // ─── Collision Tracking ─────────────────────────────────────────

    recordCollision(entityA, entityB, distance) {
        const event = { entityA, entityB, distance, t: Date.now() };
        this.collisionLog.push(event);
        if (this.collisionLog.length > this.maxCollisionLog) {
            this.collisionLog.shift();
        }

        const eA = this.entities.get(entityA);
        const eB = this.entities.get(entityB);
        if (eA) eA.metrics.collisions++;
        if (eB) eB.metrics.collisions++;

        if (this._collisionCounter) {
            this._collisionCounter.add(1, { entityA, entityB });
        }

        this.events.emit('collision', event);
    }

    // ─── Queries ────────────────────────────────────────────────────

    /** Get spatial density for a region */
    getRegionDensity(x, y, z) {
        const key = this._regionKey(x, y, z);
        return this.regions.get(key)?.size || 0;
    }

    /** Get all region densities */
    getAllDensities() {
        const result = {};
        for (const [key, members] of this.regions) {
            result[key] = members.size;
        }
        return result;
    }

    /** Get entity trajectory summary */
    getTrajectory(entityId) {
        const entity = this.entities.get(entityId);
        if (!entity) return null;
        return {
            positions: entity.positions.slice(-50),
            metrics: entity.metrics,
            anchor: entity.anchor,
            currentDrift: entity.positions.length > 0
                ? this._computeDrift(entity.positions[entity.positions.length - 1], entity.anchor)
                : 0,
        };
    }

    /** Get global spatial health report */
    getHealthReport() {
        const entities = Array.from(this.entities.entries());
        const drifts = entities.map(([id, e]) => ({
            id,
            drift: e.positions.length > 0
                ? this._computeDrift(e.positions[e.positions.length - 1], e.anchor)
                : 0,
            collisions: e.metrics.collisions,
            totalDistance: e.metrics.totalDistance,
        }));

        const maxDriftEntity = drifts.reduce((max, d) => d.drift > max.drift ? d : max, { drift: 0 });
        const avgDrift = drifts.length > 0 ? drifts.reduce((s, d) => s + d.drift, 0) / drifts.length : 0;
        const totalCollisions = this.collisionLog.length;
        const hotRegions = Array.from(this.regions.entries())
            .filter(([, members]) => members.size > 3)
            .map(([key, members]) => ({ region: key, population: members.size }))
            .sort((a, b) => b.population - a.population);

        return {
            entityCount: entities.length,
            avgDrift: parseFloat(avgDrift.toFixed(3)),
            maxDrift: { entityId: maxDriftEntity.id, value: parseFloat(maxDriftEntity.drift.toFixed(3)) },
            totalCollisions,
            hotRegions: hotRegions.slice(0, 5),
            uptime: Date.now() - this.startTime,
        };
    }

    // ─── OTel Span Enrichment ──────────────────────────────────────

    /**
     * Enrich an OTel span with spatial context.
     * @param {Span} span — OpenTelemetry span
     * @param {string} entityId
     */
    enrichSpan(span, entityId) {
        const entity = this.entities.get(entityId);
        if (!entity || entity.positions.length === 0) return;
        const pos = entity.positions[entity.positions.length - 1];
        const drift = this._computeDrift(pos, entity.anchor);
        span.setAttributes({
            'heady.spatial.x': pos.x,
            'heady.spatial.y': pos.y,
            'heady.spatial.z': pos.z,
            'heady.spatial.drift': drift,
            'heady.spatial.velocity': pos.velocity || 0,
            'heady.spatial.region': this._regionKey(pos.x, pos.y, pos.z),
            'heady.spatial.collisions': entity.metrics.collisions,
        });
    }

    // ─── Internal ───────────────────────────────────────────────────

    _regionKey(x, y, z) {
        const rx = Math.floor(x / this.regionSize);
        const ry = Math.floor(y / this.regionSize);
        const rz = Math.floor(z / this.regionSize);
        return `${rx}:${ry}:${rz}`;
    }

    _computeDrift(pos, anchor) {
        return Math.sqrt(
            (pos.x - anchor.x) ** 2 + (pos.y - anchor.y) ** 2 + (pos.z - anchor.z) ** 2
        );
    }

    _avgVelocity(entityId) {
        const entity = this.entities.get(entityId);
        if (!entity) return 0;
        const recent = entity.positions.slice(-this.velocityWindow);
        const velocities = recent.filter(p => p.velocity > 0).map(p => p.velocity);
        return velocities.length > 0 ? velocities.reduce((s, v) => s + v, 0) / velocities.length : 0;
    }
}

module.exports = { SpatialTelemetry, METRIC };
