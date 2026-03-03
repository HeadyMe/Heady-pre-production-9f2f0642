/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Realtime Intelligence Service — thin wrapper around RealtimeIntelligenceEngine.
 * Manages lifecycle (start/stop) and emits metrics for the ServiceManager.
 */

const EventEmitter = require("events");
const { RealtimeIntelligenceEngine } = require("../hc_realtime_intelligence");

let _instance = null;

class RealtimeIntelligenceService extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.engine = new RealtimeIntelligenceEngine(opts);
        this.engine.on("flushed", (data) => this.emit("metrics_updated", data.metrics));
        this.engine.on("ableton:session:started", (s) => this.emit("ableton:session:started", s));
        this.engine.on("ableton:session:stopped", (s) => this.emit("ableton:session:stopped", s));
    }

    start() {
        this.engine.start();
        this.emit("started");
    }

    stop() {
        this.engine.stop();
        this.emit("stopped");
    }

    getStatus() {
        return this.engine.getStatus();
    }
}

function getRealtimeIntelligenceService(opts = {}) {
    if (!_instance) {
        _instance = new RealtimeIntelligenceService(opts);
    }
    return _instance;
}

module.exports = { RealtimeIntelligenceService, getRealtimeIntelligenceService };
