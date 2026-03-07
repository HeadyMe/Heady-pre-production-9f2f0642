export class UmpUdpTransport extends EventEmitter<[never]> {
    constructor(opts?: {});
    config: {
        listenPort: number;
        sendPort: number;
        sendHost: any;
        ringBufferSize: any;
        batchSize: any;
        flushIntervalMs: any;
        rcvBufSize: any;
        sndBufSize: any;
    };
    _rxSocket: dgram.Socket | null;
    _txSocket: dgram.Socket | null;
    _rxBuffer: RingBuffer;
    _txBuffer: RingBuffer;
    _flushTimer: NodeJS.Timeout | null;
    _metrics: {
        rxPackets: number;
        txPackets: number;
        rxBytes: number;
        txBytes: number;
        rxDropped: number;
        txDropped: number;
        flushCycles: number;
        avgLatencyUs: number;
        latencies: never[];
    };
    init(): Promise<this>;
    _onReceive(buf: any, rinfo: any): void;
    send(umpBuffer: any): void;
    sendNoteOn(group: any, channel: any, note: any, velocity16: any): void;
    sendNoteOff(group: any, channel: any, note: any): void;
    sendCC(group: any, channel: any, cc: any, value32: any): void;
    sendPitchBend(group: any, channel: any, value32: any): void;
    _flushTx(): void;
    sendBatch(packets: any): void;
    drainRxBuffer(count?: number): any[];
    getMetrics(): {
        rxBufferSize: number;
        txBufferSize: number;
        rxBufferCapacity: number;
        txBufferCapacity: number;
        rxPackets: number;
        txPackets: number;
        rxBytes: number;
        txBytes: number;
        rxDropped: number;
        txDropped: number;
        flushCycles: number;
        avgLatencyUs: number;
        latencies: never[];
    };
    shutdown(): void;
    registerRoutes(app: any): void;
}
export namespace UMPCodec {
    function encodeNoteOn(group: any, channel: any, noteNumber: any, velocity16: any, attrType?: number, attrData?: number): Buffer<ArrayBuffer>;
    function encodeNoteOff(group: any, channel: any, noteNumber: any, velocity16?: number): Buffer<ArrayBuffer>;
    function encodeCC(group: any, channel: any, ccIndex: any, value32: any): Buffer<ArrayBuffer>;
    function encodePitchBend(group: any, channel: any, value32: any): Buffer<ArrayBuffer>;
    function encodeMidi1(group: any, status: any, data1: any, data2?: number): Buffer<ArrayBuffer>;
    function decode(buf: any): {
        messageType: number;
        group: number;
        status: number;
        channel: number;
        raw: any;
    } | null;
}
export class RingBuffer {
    constructor(capacity?: number);
    capacity: number;
    buffer: any[];
    head: number;
    tail: number;
    size: number;
    push(item: any): void;
    pop(): any;
    peek(): any;
    drain(count: any): any[];
    clear(): void;
    isFull(): boolean;
    isEmpty(): boolean;
}
export namespace UMP_TYPE {
    let UTILITY: number;
    let SYSTEM: number;
    let MIDI1_CV: number;
    let DATA_64: number;
    let MIDI2_CV: number;
    let DATA_128: number;
}
export namespace MIDI2_STATUS {
    let NOTE_OFF: number;
    let NOTE_ON: number;
    let POLY_PRESSURE: number;
    let CONTROL_CHANGE: number;
    let PROGRAM_CHANGE: number;
    let CHAN_PRESSURE: number;
    let PITCH_BEND: number;
    let PER_NOTE_MGMT: number;
}
export function getInstance(opts: any): any;
import EventEmitter = require("events");
import dgram = require("dgram");
//# sourceMappingURL=ump-udp-transport.d.ts.map