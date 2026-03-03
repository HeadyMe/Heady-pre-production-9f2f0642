/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * ═══ MIDI Internal Event Bus ═══
 *
 * Ultra-low-latency internal event system using MIDI-styled byte protocol.
 * Sub-millisecond EventEmitter dispatch — zero HTTP overhead.
 *
 * Message Format: [status_byte, data1, data2]
 *   Channel 0-15 = service identifier
 *   Note On  0x90 = task/event started
 *   Note Off 0x80 = task/event completed
 *   CC       0xB0 = continuous metric (data1=metric_id, data2=value 0-127)
 *   Prog Chg 0xC0 = mode/regime shift
 *   SysEx    0xF0 = system-wide broadcast
 *
 * Pipeline Tasks: buddy-arch-004, buddy-dist-007
 */

const EventEmitter = require("events");
const fs = require("fs");
const path = require("path");

// ═══ Channel Assignments ═══
const CHANNELS = {
    PIPELINE: 0,
    FINOPS: 1,
    DISPATCHER: 2,
    HEALTH: 3,
    TRADING: 4,
    SECURITY: 5,
    SWARM: 6,
    TELEMETRY: 7,
};

// ═══ Status Bytes ═══
const MSG = {
    NOTE_ON: 0x90,
    NOTE_OFF: 0x80,
    CC: 0xb0,
    PROGRAM_CHANGE: 0xc0,
    SYSEX: 0xf0,
};

// ═══ CC Metric IDs ═══
const METRICS = {
    BUDGET_USAGE: 0,       // 0-127 maps to 0-100%
    CPU_LOAD: 1,
    MEMORY_PRESSURE: 2,
    TASK_QUEUE_DEPTH: 3,
    LATENCY_MS: 4,
    SUCCESS_RATE: 5,
    ACTIVE_AGENTS: 6,
    BREAKERS_OPEN: 7,
};

// ═══ Note Values (Task Lifecycle) ═══
const NOTES = {
    TASK_INGEST: 36,
    TASK_DECOMPOSE: 38,
    TASK_ROUTE: 40,
    TASK_VALIDATE: 42,
    TASK_PERSIST: 44,
    TASK_COMPLETE: 48,
    TASK_FAILED: 49,
    AGENT_SPAWN: 60,
    AGENT_KILL: 61,
    REGIME_SHIFT: 72,
};

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const MIDI_LOG = path.join(DATA_DIR, "midi-events.jsonl");

class MidiEventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(100); // Support many subscribers
        this._messageCount = 0;
        this._startTime = Date.now();
        this._channelStats = {};
        this._lastLatencies = [];

        // Ensure data directory exists
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    /**
     * Send a MIDI-styled message on the bus.
     * @param {number} statusByte - MSG.NOTE_ON, MSG.CC, etc
     * @param {number} channel - CHANNELS.PIPELINE, etc (0-15)
     * @param {number} data1 - Note number or CC ID (0-127)
     * @param {number} data2 - Velocity or CC value (0-127)
     * @param {object} [meta] - Optional metadata for audit
     */
    send(statusByte, channel, data1, data2 = 127, meta = {}) {
        const ts = Date.now();
        const msg = {
            bytes: [statusByte | (channel & 0x0f), data1 & 0x7f, data2 & 0x7f],
            channel,
            status: statusByte,
            data1,
            data2,
            ts,
            iso: new Date(ts).toISOString(),
            ...meta,
        };

        this._messageCount++;

        // Track channel stats
        if (!this._channelStats[channel]) {
            this._channelStats[channel] = { sent: 0, lastTs: 0 };
        }
        this._channelStats[channel].sent++;
        this._channelStats[channel].lastTs = ts;

        // Emit to subscribers — this is the sub-ms path
        const eventKey = `${statusByte}:${channel}`;
        this.emit(eventKey, msg);
        this.emit("*", msg); // Wildcard subscribers

        // Track latency
        const latency = Date.now() - ts;
        this._lastLatencies.push(latency);
        if (this._lastLatencies.length > 100) this._lastLatencies.shift();

        // Fire-and-forget audit log
        this._log(msg);

        return msg;
    }

    // ═══ Convenience Methods ═══

    noteOn(channel, note, velocity = 127, meta = {}) {
        return this.send(MSG.NOTE_ON, channel, note, velocity, meta);
    }

    noteOff(channel, note, meta = {}) {
        return this.send(MSG.NOTE_OFF, channel, note, 0, meta);
    }

    cc(channel, metricId, value, meta = {}) {
        return this.send(MSG.CC, channel, metricId, Math.min(127, Math.max(0, value)), meta);
    }

    programChange(channel, program, meta = {}) {
        return this.send(MSG.PROGRAM_CHANGE, channel, program, 0, meta);
    }

    sysex(data1, data2, meta = {}) {
        return this.send(MSG.SYSEX, 0, data1, data2, { ...meta, broadcast: true });
    }

    // ═══ Pipeline Lifecycle Events ═══

    taskStarted(taskName, channel = CHANNELS.PIPELINE) {
        return this.noteOn(channel, NOTES.TASK_INGEST, 127, { task: taskName });
    }

    taskCompleted(taskName, channel = CHANNELS.PIPELINE) {
        return this.noteOff(channel, NOTES.TASK_COMPLETE, { task: taskName });
    }

    taskFailed(taskName, error, channel = CHANNELS.PIPELINE) {
        return this.noteOn(channel, NOTES.TASK_FAILED, 127, { task: taskName, error });
    }

    routingDecision(tier, complexity, channel = CHANNELS.FINOPS) {
        return this.cc(channel, METRICS.BUDGET_USAGE, complexity * 12, { tier });
    }

    agentSpawned(agentName, channel = CHANNELS.DISPATCHER) {
        return this.noteOn(channel, NOTES.AGENT_SPAWN, 127, { agent: agentName });
    }

    agentKilled(agentName, channel = CHANNELS.DISPATCHER) {
        return this.noteOff(channel, NOTES.AGENT_KILL, { agent: agentName });
    }

    regimeShift(newRegime, channel = CHANNELS.PIPELINE) {
        return this.programChange(channel, 0, { regime: newRegime });
    }

    // ═══ Subscribe Helpers ═══

    onNoteOn(channel, callback) {
        this.on(`${MSG.NOTE_ON}:${channel}`, callback);
    }

    onNoteOff(channel, callback) {
        this.on(`${MSG.NOTE_OFF}:${channel}`, callback);
    }

    onCC(channel, callback) {
        this.on(`${MSG.CC}:${channel}`, callback);
    }

    onAll(callback) {
        this.on("*", callback);
    }

    // ═══ Metrics ═══

    getMetrics() {
        const uptime = (Date.now() - this._startTime) / 1000;
        const avgLatency = this._lastLatencies.length > 0
            ? this._lastLatencies.reduce((a, b) => a + b, 0) / this._lastLatencies.length
            : 0;

        return {
            totalMessages: this._messageCount,
            messagesPerSecond: uptime > 0 ? (this._messageCount / uptime).toFixed(2) : "0",
            avgLatencyMs: avgLatency.toFixed(3),
            uptimeSeconds: Math.floor(uptime),
            channels: Object.entries(this._channelStats).map(([ch, s]) => ({
                channel: parseInt(ch),
                name: Object.entries(CHANNELS).find(([, v]) => v === parseInt(ch))?.[0] || "UNKNOWN",
                messagesSent: s.sent,
                lastActivity: new Date(s.lastTs).toISOString(),
            })),
            listenerCount: this.listenerCount("*"),
        };
    }

    // ═══ Internal ═══

    _log(msg) {
        try {
            const entry = {
                bytes: msg.bytes,
                channel: msg.channel,
                ts: msg.iso,
                ...(msg.task ? { task: msg.task } : {}),
                ...(msg.tier ? { tier: msg.tier } : {}),
                ...(msg.agent ? { agent: msg.agent } : {}),
            };
            fs.appendFile(MIDI_LOG, JSON.stringify(entry) + "\n", () => { });
        } catch { /* never crash the bus */ }
    }
}

// ═══ Singleton ═══
const midiBus = new MidiEventBus();

module.exports = {
    midiBus,
    CHANNELS,
    MSG,
    METRICS,
    NOTES,
    MidiEventBus,
};
