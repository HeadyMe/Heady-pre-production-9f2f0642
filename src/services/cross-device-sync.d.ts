export class CrossDeviceSync {
    registry: DeviceRegistry;
    stateManager: SyncStateManager;
    eventHandlers: Map<any, any>;
    syncInterval: any;
    registerDevice(deviceId: any, metadata: any): {
        device: any;
        state: {
            version: string;
            lastSync: null;
            syncId: null;
            auth: {
                rootAuthorized: boolean;
                authCode: null;
                scope: string;
                expiresAt: null;
            };
            mods: {};
            preferences: {
                theme: string;
                chatHistorySync: boolean;
                notificationsEnabled: boolean;
                autoConnect: boolean;
            };
            chatHistory: never[];
            fsBookmarks: never[];
            deviceProfiles: {};
        };
    };
    receiveUpdate(sourceDeviceId: any, patch: any): {
        version: string;
        lastSync: null;
        syncId: null;
        auth: {
            rootAuthorized: boolean;
            authCode: null;
            scope: string;
            expiresAt: null;
        };
        mods: {};
        preferences: {
            theme: string;
            chatHistorySync: boolean;
            notificationsEnabled: boolean;
            autoConnect: boolean;
        };
        chatHistory: never[];
        fsBookmarks: never[];
        deviceProfiles: {};
    };
    syncAuth(sourceDeviceId: any, authData: any): {
        rootAuthorized: boolean;
        authCode: null;
        scope: string;
        expiresAt: null;
    };
    syncMod(sourceDeviceId: any, modId: any, installed: any): {};
    syncChat(sourceDeviceId: any, message: any): void;
    getStatus(): {
        version: string;
        syncInterval: number;
        activeDevices: number;
        devices: {
            id: any;
            type: any;
            lastSeen: any;
            syncState: any;
        }[];
        lastSync: null;
        syncId: null;
        chatMessages: number;
        modsTracked: number;
        fsBookmarks: number;
    };
    on(event: any, handler: any): void;
    emit(event: any, data: any): void;
    broadcastExcept(excludeDeviceId: any, event: any, data: any): void;
}
export class DeviceRegistry {
    devices: Map<any, any>;
    register(deviceId: any, metadata: any): any;
    heartbeat(deviceId: any): void;
    listActive(thresholdMs?: number): any[];
    getDevice(deviceId: any): any;
}
export class SyncStateManager {
    state: {
        version: string;
        lastSync: null;
        syncId: null;
        auth: {
            rootAuthorized: boolean;
            authCode: null;
            scope: string;
            expiresAt: null;
        };
        mods: {};
        preferences: {
            theme: string;
            chatHistorySync: boolean;
            notificationsEnabled: boolean;
            autoConnect: boolean;
        };
        chatHistory: never[];
        fsBookmarks: never[];
        deviceProfiles: {};
    };
    generateSyncId(): string;
    applyUpdate(deviceId: any, patch: any): {
        version: string;
        lastSync: null;
        syncId: null;
        auth: {
            rootAuthorized: boolean;
            authCode: null;
            scope: string;
            expiresAt: null;
        };
        mods: {};
        preferences: {
            theme: string;
            chatHistorySync: boolean;
            notificationsEnabled: boolean;
            autoConnect: boolean;
        };
        chatHistory: never[];
        fsBookmarks: never[];
        deviceProfiles: {};
    };
    getFullState(): {
        version: string;
        lastSync: null;
        syncId: null;
        auth: {
            rootAuthorized: boolean;
            authCode: null;
            scope: string;
            expiresAt: null;
        };
        mods: {};
        preferences: {
            theme: string;
            chatHistorySync: boolean;
            notificationsEnabled: boolean;
            autoConnect: boolean;
        };
        chatHistory: never[];
        fsBookmarks: never[];
        deviceProfiles: {};
    };
    getDelta(sinceSyncId: any): {
        full: boolean;
        state: {
            version: string;
            lastSync: null;
            syncId: null;
            auth: {
                rootAuthorized: boolean;
                authCode: null;
                scope: string;
                expiresAt: null;
            };
            mods: {};
            preferences: {
                theme: string;
                chatHistorySync: boolean;
                notificationsEnabled: boolean;
                autoConnect: boolean;
            };
            chatHistory: never[];
            fsBookmarks: never[];
            deviceProfiles: {};
        };
        since: any;
    };
    syncAuth(authData: any): {
        rootAuthorized: boolean;
        authCode: null;
        scope: string;
        expiresAt: null;
    };
    syncMod(modId: any, installed: any): {};
    syncChatMessage(message: any): void;
    syncFsBookmark(bookmark: any): void;
}
export const syncInstance: CrossDeviceSync;
export const SYNC_VERSION: "v3457890";
export const SYNC_INTERVAL_MS: number;
//# sourceMappingURL=cross-device-sync.d.ts.map