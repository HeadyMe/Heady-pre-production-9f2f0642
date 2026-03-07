export const midiBus: MidiEventBus;
export namespace CHANNELS {
    let PIPELINE: number;
    let FINOPS: number;
    let DISPATCHER: number;
    let HEALTH: number;
    let TRADING: number;
    let SECURITY: number;
    let SWARM: number;
    let TELEMETRY: number;
}
export namespace MSG {
    let NOTE_ON: number;
    let NOTE_OFF: number;
    let CC: number;
    let PROGRAM_CHANGE: number;
    let SYSEX: number;
}
export namespace METRICS {
    let BUDGET_USAGE: number;
    let CPU_LOAD: number;
    let MEMORY_PRESSURE: number;
    let TASK_QUEUE_DEPTH: number;
    let LATENCY_MS: number;
    let SUCCESS_RATE: number;
    let ACTIVE_AGENTS: number;
    let BREAKERS_OPEN: number;
}
export namespace NOTES {
    let TASK_INGEST: number;
    let TASK_DECOMPOSE: number;
    let TASK_ROUTE: number;
    let TASK_VALIDATE: number;
    let TASK_PERSIST: number;
    let TASK_COMPLETE: number;
    let TASK_FAILED: number;
    let AGENT_SPAWN: number;
    let AGENT_KILL: number;
    let REGIME_SHIFT: number;
}
export class MidiEventBus extends EventEmitter<[never]> {
    constructor();
    _messageCount: number;
    _startTime: number;
    _channelStats: {};
    _lastLatencies: any[];
    /**
     * Send a MIDI-styled message on the bus.
     * @param {number} statusByte - MSG.NOTE_ON, MSG.CC, etc
     * @param {number} channel - CHANNELS.PIPELINE, etc (0-15)
     * @param {number} data1 - Note number or CC ID (0-127)
     * @param {number} data2 - Velocity or CC value (0-127)
     * @param {object} [meta] - Optional metadata for audit
     */
    send(statusByte: number, channel: number, data1: number, data2?: number, meta?: object): {
        bytes: number[];
        channel: number;
        status: number;
        data1: number;
        data2: number;
        ts: number;
        iso: string;
    };
    noteOn(channel: any, note: any, velocity?: number, meta?: {}): {
        bytes: number[];
        channel: number;
        status: number;
        data1: number;
        data2: number;
        ts: number;
        iso: string;
    };
    noteOff(channel: any, note: any, meta?: {}): {
        bytes: number[];
        channel: number;
        status: number;
        data1: number;
        data2: number;
        ts: number;
        iso: string;
    };
    cc(channel: any, metricId: any, value: any, meta?: {}): {
        bytes: number[];
        channel: number;
        status: number;
        data1: number;
        data2: number;
        ts: number;
        iso: string;
    };
    programChange(channel: any, program: any, meta?: {}): {
        bytes: number[];
        channel: number;
        status: number;
        data1: number;
        data2: number;
        ts: number;
        iso: string;
    };
    sysex(data1: any, data2: any, meta?: {}): {
        bytes: number[];
        channel: number;
        status: number;
        data1: number;
        data2: number;
        ts: number;
        iso: string;
    };
    taskStarted(taskName: any, channel?: number): {
        bytes: number[];
        channel: number;
        status: number;
        data1: number;
        data2: number;
        ts: number;
        iso: string;
    };
    taskCompleted(taskName: any, channel?: number): {
        bytes: number[];
        channel: number;
        status: number;
        data1: number;
        data2: number;
        ts: number;
        iso: string;
    };
    taskFailed(taskName: any, error: any, channel?: number): {
        bytes: number[];
        channel: number;
        status: number;
        data1: number;
        data2: number;
        ts: number;
        iso: string;
    };
    routingDecision(tier: any, complexity: any, channel?: number): {
        bytes: number[];
        channel: number;
        status: number;
        data1: number;
        data2: number;
        ts: number;
        iso: string;
    };
    agentSpawned(agentName: any, channel?: number): {
        bytes: number[];
        channel: number;
        status: number;
        data1: number;
        data2: number;
        ts: number;
        iso: string;
    };
    agentKilled(agentName: any, channel?: number): {
        bytes: number[];
        channel: number;
        status: number;
        data1: number;
        data2: number;
        ts: number;
        iso: string;
    };
    regimeShift(newRegime: any, channel?: number): {
        bytes: number[];
        channel: number;
        status: number;
        data1: number;
        data2: number;
        ts: number;
        iso: string;
    };
    onNoteOn(channel: any, callback: any): void;
    onNoteOff(channel: any, callback: any): void;
    onCC(channel: any, callback: any): void;
    onAll(callback: any): void;
    getMetrics(): {
        totalMessages: number;
        messagesPerSecond: string;
        avgLatencyMs: string;
        uptimeSeconds: number;
        channels: {
            channel: number;
            name: string;
            messagesSent: any;
            lastActivity: string;
        }[];
        listenerCount: number;
    };
    _log(msg: any): void;
}
import EventEmitter = require("events");
//# sourceMappingURL=midi-event-bus.d.ts.map