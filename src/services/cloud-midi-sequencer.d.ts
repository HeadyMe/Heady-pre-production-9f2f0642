/**
 * Master clock state — absolute time reference
 */
export class MasterClock {
    constructor(options?: {});
    bpm: any;
    ppq: any;
    swingAmount: any;
    running: boolean;
    startTime: number;
    tickCount: number;
    subscribers: Set<any>;
    _interval: NodeJS.Timeout | null;
    _hrtime: () => number;
    /**
     * Microseconds per tick at current BPM
     */
    get usPerTick(): number;
    /**
     * Current position in musical time
     */
    get position(): {
        bar: number;
        beat: number;
        tick: number;
        totalTicks: number;
        timeMs?: undefined;
    } | {
        bar: number;
        beat: number;
        tick: number;
        totalTicks: number;
        timeMs: number;
    };
    /**
     * Start the master clock
     */
    start(): void;
    /**
     * Stop the master clock
     */
    stop(): void;
    /**
     * Set BPM (tempo change, live)
     */
    setTempo(bpm: any): void;
    /**
     * Enable φ-swing: subdivisions offset by golden ratio
     * swing=0 → straight, swing=0.618 → golden swing
     */
    setSwing(amount: any): void;
    /**
     * Subscribe to clock events
     */
    subscribe(callback: any): () => boolean;
    _scheduleTick(): void;
    _emit(event: any, data: any): void;
}
/**
 * Pattern — a sequence of MIDI events with tick positions
 */
export class Pattern {
    constructor(options?: {});
    id: any;
    name: any;
    lengthBars: any;
    channel: any;
    events: any[];
    muted: boolean;
    volume: number;
    /**
     * Add a note event
     * @param {number} tick - position in pattern (0 = start)
     * @param {number} note - MIDI note number (0-127)
     * @param {number} velocity - 0-127
     * @param {number} durationTicks - note length in ticks
     */
    addNote(tick: number, note: number, velocity: number, durationTicks: number): this;
    /**
     * Add a CC (control change) event
     */
    addCC(tick: any, controller: any, value: any): this;
    /**
     * Quantize all events to nearest base-13 subdivision
     */
    quantize(ppq?: number): this;
    /**
     * Get events within a tick range
     */
    getEventsInRange(startTick: any, endTick: any): any[];
    /**
     * Get total ticks in pattern
     */
    get totalTicks(): number;
}
/**
 * Cloud-native sequencer combining master clock + patterns
 * Designed for WebSocket broadcast to distributed DAW clients
 */
export class CloudSequencer {
    constructor(options?: {});
    clock: MasterClock;
    patterns: Map<any, any>;
    activePatterns: Set<any>;
    clients: Map<any, any>;
    eventBuffer: any[];
    bufferWindowMs: any;
    /**
     * Add a pattern to the sequencer
     */
    addPattern(pattern: any): this;
    /**
     * Remove a pattern
     */
    removePattern(id: any): this;
    /**
     * Register a remote client with measured latency
     * @param {string} clientId
     * @param {number} latencyMs - one-way network latency
     */
    registerClient(clientId: string, latencyMs?: number): void;
    /**
     * Start playback
     */
    play(): void;
    /**
     * Stop playback
     */
    stop(): void;
    /**
     * Set tempo
     */
    setTempo(bpm: any): void;
    /**
     * Get time-stamped MIDI event bundle for a specific client
     * Includes latency-compensated scheduling timestamps
     */
    getClientBundle(clientId: any): {
        events: never[];
        position: {
            bar: number;
            beat: number;
            tick: number;
            totalTicks: number;
            timeMs?: undefined;
        } | {
            bar: number;
            beat: number;
            tick: number;
            totalTicks: number;
            timeMs: number;
        };
        serverTime?: undefined;
        clientLatency?: undefined;
        compensation?: undefined;
    } | {
        events: any[];
        position: {
            bar: number;
            beat: number;
            tick: number;
            totalTicks: number;
            timeMs?: undefined;
        } | {
            bar: number;
            beat: number;
            tick: number;
            totalTicks: number;
            timeMs: number;
        };
        serverTime: number;
        clientLatency: any;
        compensation: any;
    };
    /**
     * Get sequencer state for WebSocket broadcast
     */
    getState(): {
        playing: boolean;
        bpm: any;
        position: {
            bar: number;
            beat: number;
            tick: number;
            totalTicks: number;
            timeMs?: undefined;
        } | {
            bar: number;
            beat: number;
            tick: number;
            totalTicks: number;
            timeMs: number;
        };
        patterns: {
            id: any;
            name: any;
            muted: any;
            events: any;
            bars: any;
        }[];
        clients: number;
        serverTime: number;
    };
    _onTick(data: any): void;
    _onBeat(data: any): void;
}
/**
 * WebSocket server adapter for distributing sequencer events
 * Integrates with heady-manager.js Express/WS infrastructure
 */
export class SequencerTransport {
    constructor(sequencer: any, wss: any);
    sequencer: any;
    wss: any;
    _broadcastInterval: NodeJS.Timeout | null;
    /**
     * Start broadcasting sequencer state to all connected clients
     */
    startBroadcast(intervalMs: any): void;
    /**
     * Stop broadcasting
     */
    stopBroadcast(): void;
    /**
     * Handle incoming client messages (latency measurement, pattern requests)
     */
    handleMessage(clientId: any, message: any): string | null;
}
/**
 * Register sequencer API routes with Express
 */
export function registerRoutes(app: any, sequencer: any): void;
export namespace MIDI {
    let NOTE_ON: number;
    let NOTE_OFF: number;
    let CC: number;
    let PROGRAM_CHANGE: number;
    let PITCH_BEND: number;
    let CLOCK: number;
    let START: number;
    let STOP: number;
}
//# sourceMappingURL=cloud-midi-sequencer.d.ts.map