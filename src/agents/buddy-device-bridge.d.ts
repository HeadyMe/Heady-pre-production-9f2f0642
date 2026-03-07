export class DeviceBridge extends EventEmitter<[never]> {
    constructor(opts?: {});
    devices: Map<any, any>;
    sessions: Map<any, any>;
    taskQueue: Map<any, any>;
    encryptionKey: any;
    maxDevicesPerUser: any;
    heartbeatInterval: any;
    metrics: {
        registered: number;
        tasks_dispatched: number;
        tasks_completed: number;
        tasks_failed: number;
    };
    /**
     * Register a new device with the bridge.
     * @param {string} userId
     * @param {{ platform, deviceName, os, model, enabledMethods, fingerprint }} deviceInfo
     * @returns {{ deviceId, sessionToken, capabilities }}
     */
    registerDevice(userId: string, deviceInfo: {
        platform: any;
        deviceName: any;
        os: any;
        model: any;
        enabledMethods: any;
        fingerprint: any;
    }): {
        deviceId: any;
        sessionToken: any;
        capabilities: any;
    };
    /**
     * Heartbeat from a connected device.
     */
    heartbeat(deviceId: any, status?: {}): {
        ok: boolean;
        pendingTasks: any[];
    };
    /**
     * Dispatch a task to a specific device or auto-select best device.
     * @param {string} userId
     * @param {{ action, params, requiredCapabilities, preferredDevice, priority, timeout }} task
     */
    dispatchTask(userId: string, task: {
        action: any;
        params: any;
        requiredCapabilities: any;
        preferredDevice: any;
        priority: any;
        timeout: any;
    }): {
        taskId: string;
        deviceId: any;
        status: string;
    };
    /**
     * Report task completion from a device.
     */
    completeTask(taskId: any, result: any): {
        ok: boolean;
        taskId: any;
        status: any;
    };
    /**
     * List all devices for a user.
     */
    listDevices(userId: any): {
        deviceId: any;
        deviceName: any;
        platform: any;
        model: any;
        os: any;
        status: any;
        capabilities: any;
        enabledMethods: any;
        battery: any;
        lastSeen: string;
        taskCount: any;
    }[];
    /**
     * Remove a device.
     */
    removeDevice(deviceId: any): {
        ok: boolean;
        deviceId: any;
    };
    getAvailableActions(): {
        screen_capture: {
            label: string;
            category: string;
            desc: string;
        };
        screen_record: {
            label: string;
            category: string;
            desc: string;
        };
        tap: {
            label: string;
            category: string;
            desc: string;
        };
        swipe: {
            label: string;
            category: string;
            desc: string;
        };
        type_text: {
            label: string;
            category: string;
            desc: string;
        };
        scroll: {
            label: string;
            category: string;
            desc: string;
        };
        app_launch: {
            label: string;
            category: string;
            desc: string;
        };
        app_install: {
            label: string;
            category: string;
            desc: string;
        };
        app_control: {
            label: string;
            category: string;
            desc: string;
        };
        file_read: {
            label: string;
            category: string;
            desc: string;
        };
        file_write: {
            label: string;
            category: string;
            desc: string;
        };
        file_list: {
            label: string;
            category: string;
            desc: string;
        };
        file_move: {
            label: string;
            category: string;
            desc: string;
        };
        file_delete: {
            label: string;
            category: string;
            desc: string;
        };
        shell_exec: {
            label: string;
            category: string;
            desc: string;
        };
        notification_send: {
            label: string;
            category: string;
            desc: string;
        };
        clipboard_get: {
            label: string;
            category: string;
            desc: string;
        };
        clipboard_set: {
            label: string;
            category: string;
            desc: string;
        };
        system_info: {
            label: string;
            category: string;
            desc: string;
        };
        email_send: {
            label: string;
            category: string;
            desc: string;
        };
        email_read: {
            label: string;
            category: string;
            desc: string;
        };
        calendar_create: {
            label: string;
            category: string;
            desc: string;
        };
        message_send: {
            label: string;
            category: string;
            desc: string;
        };
        browser_open: {
            label: string;
            category: string;
            desc: string;
        };
        browser_search: {
            label: string;
            category: string;
            desc: string;
        };
        browser_read: {
            label: string;
            category: string;
            desc: string;
        };
        browser_fill: {
            label: string;
            category: string;
            desc: string;
        };
        browser_click: {
            label: string;
            category: string;
            desc: string;
        };
    };
    _findBestDevice(userId: any, requiredCaps: any): any;
    _getPendingTasks(deviceId: any): any[];
    getHealth(): {
        ts: string;
        registered: number;
        tasks_dispatched: number;
        tasks_completed: number;
        tasks_failed: number;
        status: string;
        devices: {
            total: number;
            online: number;
            offline: number;
        };
    };
}
export namespace PLATFORMS {
    namespace android {
        let id: string;
        let name: string;
        let icon: string;
        namespace controlMethods {
            namespace workProfile {
                let label: string;
                let description: string;
                let capabilities: string[];
                let rootRequired: boolean;
            }
            namespace accessibility {
                let label_1: string;
                export { label_1 as label };
                let description_1: string;
                export { description_1 as description };
                let capabilities_1: string[];
                export { capabilities_1 as capabilities };
                let rootRequired_1: boolean;
                export { rootRequired_1 as rootRequired };
            }
            namespace deviceAdmin {
                let label_2: string;
                export { label_2 as label };
                let description_2: string;
                export { description_2 as description };
                let capabilities_2: string[];
                export { capabilities_2 as capabilities };
                let rootRequired_2: boolean;
                export { rootRequired_2 as rootRequired };
                export let businessOnly: boolean;
            }
            namespace adb {
                let label_3: string;
                export { label_3 as label };
                let description_3: string;
                export { description_3 as description };
                let capabilities_3: string[];
                export { capabilities_3 as capabilities };
                let rootRequired_3: boolean;
                export { rootRequired_3 as rootRequired };
            }
        }
    }
    namespace ios {
        let id_1: string;
        export { id_1 as id };
        let name_1: string;
        export { name_1 as name };
        let icon_1: string;
        export { icon_1 as icon };
        export namespace controlMethods_1 {
            namespace shortcuts {
                let label_4: string;
                export { label_4 as label };
                let description_4: string;
                export { description_4 as description };
                let capabilities_4: string[];
                export { capabilities_4 as capabilities };
                let rootRequired_4: boolean;
                export { rootRequired_4 as rootRequired };
            }
            namespace mdm {
                let label_5: string;
                export { label_5 as label };
                let description_5: string;
                export { description_5 as description };
                let capabilities_5: string[];
                export { capabilities_5 as capabilities };
                let rootRequired_5: boolean;
                export { rootRequired_5 as rootRequired };
                let businessOnly_1: boolean;
                export { businessOnly_1 as businessOnly };
            }
            namespace webClip {
                let label_6: string;
                export { label_6 as label };
                let description_6: string;
                export { description_6 as description };
                let capabilities_6: string[];
                export { capabilities_6 as capabilities };
                let rootRequired_6: boolean;
                export { rootRequired_6 as rootRequired };
            }
        }
        export { controlMethods_1 as controlMethods };
    }
    namespace desktop {
        let id_2: string;
        export { id_2 as id };
        let name_2: string;
        export { name_2 as name };
        let icon_2: string;
        export { icon_2 as icon };
        export namespace controlMethods_2 {
            namespace nativeAgent {
                let label_7: string;
                export { label_7 as label };
                let description_7: string;
                export { description_7 as description };
                let capabilities_7: string[];
                export { capabilities_7 as capabilities };
                let rootRequired_7: boolean;
                export { rootRequired_7 as rootRequired };
            }
            namespace browserExtension {
                let label_8: string;
                export { label_8 as label };
                let description_8: string;
                export { description_8 as description };
                let capabilities_8: string[];
                export { capabilities_8 as capabilities };
                let rootRequired_8: boolean;
                export { rootRequired_8 as rootRequired };
            }
            namespace dockerIsolated {
                let label_9: string;
                export { label_9 as label };
                let description_9: string;
                export { description_9 as description };
                let capabilities_9: string[];
                export { capabilities_9 as capabilities };
                let rootRequired_9: boolean;
                export { rootRequired_9 as rootRequired };
            }
        }
        export { controlMethods_2 as controlMethods };
    }
    namespace web {
        let id_3: string;
        export { id_3 as id };
        let name_3: string;
        export { name_3 as name };
        let icon_3: string;
        export { icon_3 as icon };
        export namespace controlMethods_3 {
            namespace pwa {
                let label_10: string;
                export { label_10 as label };
                let description_10: string;
                export { description_10 as description };
                let capabilities_10: string[];
                export { capabilities_10 as capabilities };
                let rootRequired_10: boolean;
                export { rootRequired_10 as rootRequired };
            }
        }
        export { controlMethods_3 as controlMethods };
    }
}
import EventEmitter = require("events");
//# sourceMappingURL=buddy-device-bridge.d.ts.map