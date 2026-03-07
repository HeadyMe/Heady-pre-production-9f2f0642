export class DawMcpBridge extends EventEmitter<[never]> {
    constructor(opts?: {});
    config: {
        remoteHost: string;
        remotePort: number;
        udpPort: number;
        mcpPort: number;
        reconnectIntervalMs: number;
        maxReconnectAttempts: number;
        heartbeatIntervalMs: number;
        smoothingResolution: number;
        smoothingIntervalMs: number;
    };
    _tcpClient: net.Socket | null;
    _udpSocket: dgram.Socket | null;
    _mcpServer: net.Server | null;
    _connected: boolean;
    _reconnectTimer: any;
    _heartbeatTimer: NodeJS.Timeout | null;
    _reconnectAttempts: number;
    _sessionState: {
        tempo: number;
        playing: boolean;
        recording: boolean;
        tracks: never[];
        scenes: never[];
        selectedTrack: null;
        selectedScene: null;
        masterVolume: number;
        playheadPosition: number;
        timeSignature: number[];
        lastUpdated: null;
    };
    _pendingCommands: Map<any, any>;
    _commandIdCounter: number;
    _activeSmooths: Map<any, any>;
    _metrics: {
        commandsSent: number;
        commandsReceived: number;
        eventsReceived: number;
        smoothOps: number;
        midiNotesSent: number;
        reconnections: number;
        avgLatencyMs: number;
        latencies: never[];
    };
    init(): Promise<this>;
    _connectToRemoteScript(): Promise<any>;
    _scheduleReconnect(): void;
    _startHeartbeat(): void;
    _stopHeartbeat(): void;
    _initUdpSocket(): void;
    _handleUdpMidiData(buf: any, rinfo: any): void;
    _initMcpServer(): void;
    _handleMcpRequest(request: any, socket: any): Promise<void>;
    _processSemanticIntent(intent: any, params?: {}): Promise<{
        intent: any;
        processed: boolean;
        actions: any[];
    }>;
    _smoothParameter(trackIndex: any, deviceIndex: any, paramName: any, targetValue: any, durationMs?: number): Promise<any>;
    _injectMidi(notes: any, channel?: number): {
        sent: number;
    };
    _sendCommand(command: any, params?: {}): Promise<any>;
    _sendRaw(obj: any): boolean;
    _handleRemoteMessage(msg: any): void;
    _handleDawEvent(event: any, data: any): void;
    _updateSessionState(state: any): void;
    _updateDeviceParam(data: any): void;
    _getCurrentParamValue(trackIndex: any, deviceIndex: any, paramName: any): any;
    _findTrackByContext(text: any): never;
    _isDistortionDevice(name: any): boolean;
    _isFilterDevice(name: any): boolean;
    getSessionState(): {
        tempo: number;
        playing: boolean;
        recording: boolean;
        tracks: never[];
        scenes: never[];
        selectedTrack: null;
        selectedScene: null;
        masterVolume: number;
        playheadPosition: number;
        timeSignature: number[];
        lastUpdated: null;
    };
    isConnected(): boolean;
    getMetrics(): {
        activeSmooths: number;
        pendingCommands: number;
        sessionTracks: number;
        commandsSent: number;
        commandsReceived: number;
        eventsReceived: number;
        smoothOps: number;
        midiNotesSent: number;
        reconnections: number;
        avgLatencyMs: number;
        latencies: never[];
        connected: boolean;
    };
    sendLomCommand(command: any, params?: {}): Promise<any>;
    processIntent(intent: any, params?: {}): Promise<{
        intent: any;
        processed: boolean;
        actions: any[];
    }>;
    injectNotes(notes: any, channel?: number): {
        sent: number;
    };
    shutdown(): Promise<void>;
    registerRoutes(app: any): void;
}
export function getInstance(opts: any): any;
export namespace LOM_COMMANDS {
    let PLAY: string;
    let STOP: string;
    let RECORD: string;
    let SET_TEMPO: string;
    let GET_TEMPO: string;
    let CREATE_MIDI_TRACK: string;
    let CREATE_AUDIO_TRACK: string;
    let DELETE_TRACK: string;
    let SET_TRACK_VOLUME: string;
    let SET_TRACK_PAN: string;
    let SET_TRACK_MUTE: string;
    let SET_TRACK_SOLO: string;
    let SET_TRACK_ARM: string;
    let SET_TRACK_NAME: string;
    let GET_TRACK_STATE: string;
    let ADD_DEVICE: string;
    let SET_DEVICE_PARAM: string;
    let GET_DEVICE_PARAMS: string;
    let SET_MACRO: string;
    let CREATE_CLIP: string;
    let DELETE_CLIP: string;
    let SET_CLIP_NOTES: string;
    let FIRE_CLIP: string;
    let STOP_CLIP: string;
    let FIRE_SCENE: string;
    let GET_SESSION_STATE: string;
    let GET_ALL_TRACKS: string;
    let GET_ROUTING: string;
}
export namespace DAW_EVENTS {
    let NOTE_PLAYED: string;
    let NOTE_RELEASED: string;
    let KNOB_TURNED: string;
    let TRANSPORT_CHANGED: string;
    let TRACK_ADDED: string;
    let TRACK_REMOVED: string;
    let DEVICE_PARAM_CHANGED: string;
    let CLIP_ADDED: string;
    let CLIP_REMOVED: string;
    let CLIP_TRIGGERED: string;
    let TEMPO_CHANGED: string;
    let SCENE_FIRED: string;
    let SESSION_STATE_UPDATED: string;
}
export namespace CONFIG {
    let remoteHost: string;
    let remotePort: number;
    let udpPort: number;
    let mcpPort: number;
    let reconnectIntervalMs: number;
    let maxReconnectAttempts: number;
    let heartbeatIntervalMs: number;
    let smoothingResolution: number;
    let smoothingIntervalMs: number;
}
import EventEmitter = require("events");
import net = require("net");
import dgram = require("dgram");
//# sourceMappingURL=daw-mcp-bridge.d.ts.map