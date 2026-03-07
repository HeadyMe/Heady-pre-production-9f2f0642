export class CrossDeviceSyncHub extends EventEmitter<[never]> {
    constructor(opts?: {});
    devices: Map<any, any>;
    sessions: Map<any, any>;
    sharedContext: Map<any, any>;
    heartbeatInterval: any;
    maxMessageBytes: any;
    maxMessagesPerMinute: any;
    requireAuthToken: any;
    sharedToken: any;
    _heartbeatTimer: NodeJS.Timeout | null;
    _messageCount: number;
    _rejectedMessageCount: number;
    _rateWindows: Map<any, any>;
    storePath: any;
    vectorMemory: any;
    _persistTimer: any;
    _persistentState: {
        users: {};
        workspaces: {};
        lastUpdatedAt: null;
    };
    /**
     * Attach to an HTTP server to upgrade WebSocket connections.
     * Uses the ws module if available, otherwise falls back to raw upgrade.
     */
    attachToServer(server: any): void;
    wss: any;
    _loadPersistentState(): void;
    _schedulePersist(): void;
    _ingestSyncEvent(eventType: any, payload?: {}): void;
    _getDeviceUserId(req: any, deviceId: any): string;
    _registerDevice(deviceId: any, ws: any, meta: any): void;
    _isAuthorized(req: any): boolean;
    _isMessageRejected(deviceId: any, raw: any): boolean;
    _unregisterDevice(deviceId: any): void;
    _handleMessage(fromDeviceId: any, msg: any): void;
    _handoffSession(fromDeviceId: any, targetDeviceId: any, sessionData: any): void;
    _broadcast(excludeDeviceId: any, message: any): void;
    _send(ws: any, message: any): void;
    _getDeviceList(): {
        id: any;
        name: any;
        platform: any;
        userId: any;
        connectedAt: any;
        lastSeen: any;
    }[];
    _checkHeartbeats(): void;
    /**
     * Get current sync hub status.
     */
    getStatus(): {
        ok: boolean;
        connectedDevices: number;
        activeSessions: number;
        sharedContextKeys: number;
        totalMessages: number;
        rejectedMessages: number;
        persistentUsers: number;
        devices: {
            id: any;
            name: any;
            platform: any;
            userId: any;
            connectedAt: any;
            lastSeen: any;
        }[];
    };
    /**
     * Register HTTP routes for sync hub management.
     */
    registerRoutes(app: any): void;
    /**
     * Clean shutdown.
     */
    shutdown(): void;
}
import EventEmitter = require("events");
//# sourceMappingURL=cross-device-sync.d.ts.map