/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * ═══ 3D Spatial Context Engine ═══
 *
 * Extends vector-memory 3D with musical spatial mapping for DAW context.
 *
 * Coordinate System:
 *   X-Axis = Temporal/Sequential flow (playhead, arrangement position)
 *   Y-Axis = Frequency/Spectral range (hi-hat→bass spectrum)
 *   Z-Axis = Depth/Hierarchical complexity (master=0, nested racks=deep +Z)
 *
 * Euler Angles (Pitch/Yaw/Roll) = AI's current attentional trajectory
 *
 * Features:
 *   - Real-time state vector generation from DAW events
 *   - Geometric nearest-neighbor querying
 *   - Contextual clustering via spatial proximity
 *   - Negative-weight correction learning (user reverts → negative embedding)
 *
 * Pipeline Tasks: spatial-001 through spatial-004
 */

const EventEmitter = require("events");
const { midiBus, CHANNELS } = require("./midi-event-bus");

const PHI = 1.6180339887;

// ═══ Frequency Band Mapping (Y-axis normalization) ═══
const FREQ_BANDS = {
    sub:      { min: 20,   max: 60,   y: 0.05 },
    bass:     { min: 60,   max: 250,  y: 0.15 },
    lowMid:   { min: 250,  max: 500,  y: 0.30 },
    mid:      { min: 500,  max: 2000, y: 0.50 },
    highMid:  { min: 2000, max: 6000, y: 0.70 },
    presence: { min: 6000, max: 12000,y: 0.85 },
    air:      { min: 12000,max: 20000,y: 0.95 },
};

// ═══ Depth Mapping (Z-axis normalization) ═══
const DEPTH_LEVELS = {
    master:      0.0,
    groupBus:    0.15,
    trackMixer:  0.25,
    deviceChain: 0.40,
    deviceParam: 0.55,
    rackChain:   0.70,
    nestedParam: 0.85,
    deepNested:  1.0,
};

class SpatialContextEngine extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.setMaxListeners(50);

        // Spatial memory store — each entry is a 3D point with metadata
        this._spatialMemory = [];
        this._maxMemory = opts.maxMemory || 10000;

        // Current attention state (Euler angles)
        this._attention = { pitch: 0, yaw: 0, roll: 0 };

        // Current "now" vector
        this._currentState = { x: 0, y: 0.5, z: 0 };

        // Negative-weight correction log
        this._corrections = [];
        this._correctionDecayRate = opts.correctionDecayRate || 0.95;

        // Cluster cache
        this._clusters = new Map();
        this._clusterDirty = true;

        // Metrics
        this._metrics = {
            ingested: 0, queries: 0, corrections: 0,
            avgQueryTimeUs: 0, queryTimes: [],
            clusterCount: 0,
        };
    }

    // ═══ State Vector Generation ═══
    // Converts a DAW event into a 3D spatial coordinate

    generateStateVector(event) {
        const x = this._mapTemporal(event);
        const y = this._mapFrequency(event);
        const z = this._mapDepth(event);

        this._currentState = { x, y, z };
        this._updateAttention(x, y, z);

        return { x, y, z, pitch: this._attention.pitch, yaw: this._attention.yaw, roll: this._attention.roll };
    }

    _mapTemporal(event) {
        // Normalize playhead position / beat to 0-1 range
        if (event.playheadBeats !== undefined && event.totalBeats) {
            return event.playheadBeats / event.totalBeats;
        }
        if (event.barPosition !== undefined && event.totalBars) {
            return event.barPosition / event.totalBars;
        }
        // Use timestamp relative to session start
        if (event.timestamp && event.sessionStart) {
            const elapsed = (event.timestamp - event.sessionStart) / 1000;
            return Math.min(1, elapsed / 3600); // Normalize to 1 hour
        }
        return this._currentState.x; // Keep current
    }

    _mapFrequency(event) {
        // Direct frequency mapping
        if (event.frequency) {
            for (const [, band] of Object.entries(FREQ_BANDS)) {
                if (event.frequency >= band.min && event.frequency < band.max) return band.y;
            }
        }
        // MIDI note → frequency approximation
        if (event.note !== undefined) {
            return Math.max(0, Math.min(1, event.note / 127));
        }
        // Track type heuristic
        if (event.trackName) {
            const name = event.trackName.toLowerCase();
            if (name.includes("sub") || name.includes("bass") || name.includes("808")) return FREQ_BANDS.bass.y;
            if (name.includes("kick")) return FREQ_BANDS.sub.y;
            if (name.includes("snare") || name.includes("clap")) return FREQ_BANDS.mid.y;
            if (name.includes("hat") || name.includes("cymbal") || name.includes("shaker")) return FREQ_BANDS.air.y;
            if (name.includes("vocal") || name.includes("vox")) return FREQ_BANDS.mid.y;
            if (name.includes("lead") || name.includes("synth")) return FREQ_BANDS.highMid.y;
            if (name.includes("pad") || name.includes("ambient")) return FREQ_BANDS.lowMid.y;
        }
        return 0.5; // Center
    }

    _mapDepth(event) {
        if (event.depth !== undefined) return Math.max(0, Math.min(1, event.depth));
        if (event.level) return DEPTH_LEVELS[event.level] || 0.5;
        // Infer from event type
        if (event.isMaster) return DEPTH_LEVELS.master;
        if (event.isGroup) return DEPTH_LEVELS.groupBus;
        if (event.isDevice) return DEPTH_LEVELS.deviceParam;
        if (event.isNested || event.rackDepth > 1) return DEPTH_LEVELS.nestedParam;
        return DEPTH_LEVELS.trackMixer;
    }

    _updateAttention(x, y, z) {
        // Smoothly rotate attention toward new coordinates
        const dx = x - this._currentState.x;
        const dy = y - this._currentState.y;
        const dz = z - this._currentState.z;

        // Pitch = vertical rotation (frequency axis)
        this._attention.pitch = this._attention.pitch * 0.7 + Math.atan2(dy, Math.sqrt(dx * dx + dz * dz)) * 0.3;
        // Yaw = horizontal rotation (temporal axis)
        this._attention.yaw = this._attention.yaw * 0.7 + Math.atan2(dx, dz) * 0.3;
        // Roll = tilt (depth axis engagement)
        this._attention.roll = this._attention.roll * 0.7 + Math.atan2(dz, Math.sqrt(dx * dx + dy * dy)) * 0.3;
    }

    // ═══ Spatial Ingestion ═══

    ingest(event, metadata = {}, embedding = null) {
        const vector = this.generateStateVector(event);
        const entry = {
            id: `sp-${Date.now()}-${this._metrics.ingested}`,
            x: vector.x, y: vector.y, z: vector.z,
            pitch: vector.pitch, yaw: vector.yaw, roll: vector.roll,
            weight: metadata.weight || 1.0,
            timestamp: Date.now(),
            event: event.type || "unknown",
            metadata,
            embedding, // Optional high-dim embedding for hybrid queries
        };

        this._spatialMemory.push(entry);
        this._metrics.ingested++;
        this._clusterDirty = true;

        // Prune if over capacity
        if (this._spatialMemory.length > this._maxMemory) {
            // Remove lowest-weight entries, preserving corrections
            this._spatialMemory.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
            this._spatialMemory = this._spatialMemory.slice(0, this._maxMemory);
        }

        midiBus.cc(CHANNELS.TELEMETRY, 3, Math.min(127, Math.floor(this._spatialMemory.length / (this._maxMemory / 127))), { source: "spatial" });

        return entry;
    }

    // ═══ Negative-Weight Correction ═══

    recordCorrection(event, strength = -2.0) {
        const vector = this.generateStateVector(event);
        const correctionEntry = {
            id: `corr-${Date.now()}-${this._metrics.corrections}`,
            x: vector.x, y: vector.y, z: vector.z,
            pitch: vector.pitch, yaw: vector.yaw, roll: vector.roll,
            weight: strength, // Negative!
            timestamp: Date.now(),
            event: event.type || "correction",
            metadata: { correction: true, originalEvent: event },
        };

        this._spatialMemory.push(correctionEntry);
        this._corrections.push(correctionEntry);
        this._metrics.corrections++;
        this._clusterDirty = true;

        this.emit("correction_recorded", correctionEntry);
        return correctionEntry;
    }

    // ═══ Geometric Nearest-Neighbor Query ═══

    query(stateOrEvent, topK = 5, opts = {}) {
        const startTime = process.hrtime.bigint();
        this._metrics.queries++;

        // Generate query vector from event or use raw coordinates
        let qx, qy, qz;
        if (stateOrEvent.x !== undefined) {
            qx = stateOrEvent.x; qy = stateOrEvent.y; qz = stateOrEvent.z;
        } else {
            const v = this.generateStateVector(stateOrEvent);
            qx = v.x; qy = v.y; qz = v.z;
        }

        // Compute weighted Euclidean distance for all entries
        const candidates = this._spatialMemory
            .map(entry => {
                const dist = Math.sqrt(
                    Math.pow(entry.x - qx, 2) +
                    Math.pow(entry.y - qy, 2) +
                    Math.pow(entry.z - qz, 2)
                );
                const weightedDist = dist / Math.max(0.01, Math.abs(entry.weight));
                return { entry, dist, weightedDist, effectiveScore: entry.weight > 0 ? 1 / (1 + dist) : -(1 / (1 + dist)) };
            })
            .filter(c => {
                // If excluding corrections, filter negatives
                if (opts.excludeCorrections && c.entry.weight < 0) return false;
                // Time decay filter
                if (opts.maxAgeMs) {
                    const age = Date.now() - c.entry.timestamp;
                    if (age > opts.maxAgeMs) return false;
                }
                return true;
            })
            .sort((a, b) => a.dist - b.dist)
            .slice(0, topK);

        // Track query time
        const elapsed = Number(process.hrtime.bigint() - startTime) / 1000;
        this._metrics.queryTimes.push(elapsed);
        if (this._metrics.queryTimes.length > 100) this._metrics.queryTimes.shift();
        this._metrics.avgQueryTimeUs = this._metrics.queryTimes.reduce((a, b) => a + b, 0) / this._metrics.queryTimes.length;

        return {
            query: { x: qx, y: qy, z: qz },
            attention: { ...this._attention },
            results: candidates.map(c => ({
                id: c.entry.id,
                x: c.entry.x, y: c.entry.y, z: c.entry.z,
                distance: c.dist,
                weight: c.entry.weight,
                score: c.effectiveScore,
                event: c.entry.event,
                metadata: c.entry.metadata,
                age: Date.now() - c.entry.timestamp,
            })),
            queryTimeUs: elapsed,
        };
    }

    // ═══ Contextual Clustering ═══

    getClusters(resolution = 0.2) {
        if (!this._clusterDirty && this._clusters.size > 0) return Array.from(this._clusters.values());

        this._clusters.clear();
        const assigned = new Set();

        for (let i = 0; i < this._spatialMemory.length; i++) {
            if (assigned.has(i)) continue;
            const seed = this._spatialMemory[i];
            const cluster = { centroid: { x: seed.x, y: seed.y, z: seed.z }, members: [seed], avgWeight: seed.weight };
            assigned.add(i);

            for (let j = i + 1; j < this._spatialMemory.length; j++) {
                if (assigned.has(j)) continue;
                const other = this._spatialMemory[j];
                const dist = Math.sqrt(Math.pow(other.x - seed.x, 2) + Math.pow(other.y - seed.y, 2) + Math.pow(other.z - seed.z, 2));
                if (dist <= resolution) {
                    cluster.members.push(other);
                    assigned.add(j);
                }
            }

            // Recalculate centroid
            cluster.centroid.x = cluster.members.reduce((s, m) => s + m.x, 0) / cluster.members.length;
            cluster.centroid.y = cluster.members.reduce((s, m) => s + m.y, 0) / cluster.members.length;
            cluster.centroid.z = cluster.members.reduce((s, m) => s + m.z, 0) / cluster.members.length;
            cluster.avgWeight = cluster.members.reduce((s, m) => s + m.weight, 0) / cluster.members.length;
            cluster.id = `cluster-${this._clusters.size}`;
            cluster.size = cluster.members.length;

            this._clusters.set(cluster.id, cluster);
        }

        this._clusterDirty = false;
        this._metrics.clusterCount = this._clusters.size;
        return Array.from(this._clusters.values()).map(c => ({
            id: c.id, centroid: c.centroid, size: c.size, avgWeight: c.avgWeight,
        }));
    }

    // ═══ Public API ═══

    getCurrentState() { return { ...this._currentState, attention: { ...this._attention } }; }
    getMemorySize() { return this._spatialMemory.length; }
    getMetrics() { return { ...this._metrics, memorySize: this._spatialMemory.length, correctionCount: this._corrections.length }; }

    // Decay corrections over time (call periodically)
    decayCorrections() {
        for (const entry of this._spatialMemory) {
            if (entry.weight < 0) {
                entry.weight *= this._correctionDecayRate;
                if (Math.abs(entry.weight) < 0.01) entry.weight = 0;
            }
        }
    }

    // ═══ Express Routes ═══
    registerRoutes(app) {
        app.get("/api/spatial/status", (req, res) => res.json({ ok: true, state: this.getCurrentState(), metrics: this.getMetrics() }));
        app.get("/api/spatial/clusters", (req, res) => res.json({ ok: true, clusters: this.getClusters(parseFloat(req.query.resolution) || 0.2) }));
        app.post("/api/spatial/ingest", (req, res) => {
            const entry = this.ingest(req.body.event || req.body, req.body.metadata);
            res.json({ ok: true, entry: { id: entry.id, x: entry.x, y: entry.y, z: entry.z, weight: entry.weight } });
        });
        app.post("/api/spatial/query", (req, res) => {
            const result = this.query(req.body.state || req.body.event || req.body, parseInt(req.body.topK) || 5, req.body.opts);
            res.json({ ok: true, result });
        });
        app.post("/api/spatial/correction", (req, res) => {
            const entry = this.recordCorrection(req.body.event || req.body, parseFloat(req.body.strength) || -2.0);
            res.json({ ok: true, entry: { id: entry.id, x: entry.x, y: entry.y, z: entry.z, weight: entry.weight } });
        });
    }
}

let _instance = null;
function getInstance(opts) { if (!_instance) _instance = new SpatialContextEngine(opts); return _instance; }

module.exports = { SpatialContextEngine, getInstance, FREQ_BANDS, DEPTH_LEVELS };
