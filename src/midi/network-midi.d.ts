declare const _exports: NetworkMidiTransport;
export = _exports;
declare class NetworkMidiTransport {
    constructor(port?: number);
    port: number;
    socket: dgram.Socket;
    activeSessions: Map<any, any>;
    start(): void;
    _bindEvents(): void;
    _processUMP(packetBuffer: any, rinfo: any): void;
    sendUMP(destinationIp: any, destinationPort: any, umpBuffer: any): void;
}
import dgram = require("dgram");
//# sourceMappingURL=network-midi.d.ts.map