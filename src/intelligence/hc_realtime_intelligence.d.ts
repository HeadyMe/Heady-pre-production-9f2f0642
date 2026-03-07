export class RealtimeIntelligenceEngine extends EventEmitter<[never]> {
    constructor(opts?: {});
    cfg: {
        flushIntervalMs: number;
        maxQueueDepth: number;
        apiEndpoint: string | null;
        httpsEndpoint: string | null;
        tcpHost: string | null;
        tcpPort: number;
        mcpEndpoint: string | null;
    };
    queue: any[];
    metrics: {
        queued: number;
        dropped: number;
        persisted: number;
        delivered: number;
        failed: number;
        flushes: number;
        externalIngested: number;
    };
    _timer: NodeJS.Timeout | null;
    _vectorMemory: any;
    abletonSession: {
        id: string;
        startedAt: string;
        bpm: any;
        quantize: any;
        midiEvents: number;
        tracks: any;
        latencyMs: number;
    } | null;
    _resolveVectorIngest(): any;
    start(): void;
    stop(): void;
    getStatus(): {
        running: boolean;
        queueDepth: number;
        metrics: {
            queued: number;
            dropped: number;
            persisted: number;
            delivered: number;
            failed: number;
            flushes: number;
            externalIngested: number;
        };
        config: {
            flushIntervalMs: number;
            mode: string;
            maxQueueDepth: number;
        };
        transports: {
            vectorMemory: boolean;
            api: boolean;
            https: boolean;
            tcp: boolean;
            mcp: boolean;
        };
        abletonSession: {
            active: boolean;
            startedAt: string;
            midiEvents: number;
        } | null;
    };
    ingest(event: any): boolean;
    ingestExternalEvent({ type, source, priority, ...rest }?: {
        type?: string | undefined;
        source?: string | undefined;
        priority?: string | undefined;
    }): {
        ok: boolean;
        error: string;
        queueDepth: number;
        queued?: undefined;
        priority?: undefined;
        immediateFlush?: undefined;
    } | {
        ok: boolean;
        queued: boolean;
        priority: string;
        immediateFlush: boolean;
        queueDepth: number;
        error?: undefined;
    };
    startAbletonSession(config?: {}): {
        id: string;
        startedAt: string;
        bpm: any;
        quantize: any;
        midiEvents: number;
        tracks: any;
        latencyMs: number;
    };
    stopAbletonSession(): {
        endedAt: string;
        id: string;
        startedAt: string;
        bpm: any;
        quantize: any;
        midiEvents: number;
        tracks: any;
        latencyMs: number;
    } | null;
    routeAbletonMidi(event: any): {
        ok: boolean;
        error: string;
        sessionMidiCount?: undefined;
        latencyMs?: undefined;
    } | {
        ok: boolean;
        sessionMidiCount: number;
        latencyMs: number;
        error?: undefined;
    };
    getFeed(limit?: number): any[];
    updateConfig(patch?: {}): {
        flushIntervalMs: number;
        maxQueueDepth: number;
        apiEndpoint: string | null;
        httpsEndpoint: string | null;
        tcpHost: string | null;
        tcpPort: number;
        mcpEndpoint: string | null;
    };
    _flush(): Promise<void>;
    _sendApi(batch: any): Promise<void>;
    _sendHttps(batch: any): Promise<any>;
    _sendTcp(batch: any): Promise<any>;
    _sendMcp(batch: any): Promise<void>;
}
import EventEmitter = require("events");
//# sourceMappingURL=hc_realtime_intelligence.d.ts.map