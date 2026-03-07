export class BuddyAgentHub extends EventEmitter<[never]> {
    constructor(opts?: {});
    bridge: DeviceBridge;
    computerUse: ComputerUseEngine;
    auth: BuddyAuthorization;
    version: string;
    startedAt: number;
    /**
     * Execute a natural language task — the main Buddy entry point.
     *
     * Flow:
     *   1. Parse intent from natural language
     *   2. Determine required capabilities and target device
     *   3. Check authorization
     *   4. Dispatch to appropriate engine (device bridge, computer use, or direct)
     *   5. Return result
     *
     * @param {string} userId
     * @param {string} instruction - Natural language task description
     * @param {{ preferredDevice?, priority?, context? }} opts
     */
    executeTask(userId: string, instruction: string, opts?: {
        preferredDevice?: any;
        priority?: any;
        context?: any;
    }): Promise<{
        taskId: string;
        status: string;
        reason: string;
        deniedActions: {
            allowed: boolean;
            riskTier: string;
            requiresConfirmation: boolean;
            reason?: string;
        }[];
        actionsToConfirm?: undefined;
        instruction?: undefined;
        message?: undefined;
        setupInstructions?: undefined;
        type?: undefined;
        session?: undefined;
        task?: undefined;
        intent?: undefined;
    } | {
        taskId: string;
        status: string;
        actionsToConfirm: {
            allowed: boolean;
            riskTier: string;
            requiresConfirmation: boolean;
            reason?: string;
        }[];
        instruction: string;
        message: string;
        reason?: undefined;
        deniedActions?: undefined;
        setupInstructions?: undefined;
        type?: undefined;
        session?: undefined;
        task?: undefined;
        intent?: undefined;
    } | {
        taskId: string;
        status: string;
        message: string;
        setupInstructions: {
            android: {
                title: string;
                steps: string[];
                capabilities: string;
            };
            ios: {
                title: string;
                steps: string[];
                capabilities: string;
            };
            desktop: {
                title: string;
                steps: string[];
                capabilities: string;
            };
            web: {
                title: string;
                steps: string[];
                capabilities: string;
            };
        };
        reason?: undefined;
        deniedActions?: undefined;
        actionsToConfirm?: undefined;
        instruction?: undefined;
        type?: undefined;
        session?: undefined;
        task?: undefined;
        intent?: undefined;
    } | {
        taskId: string;
        status: string;
        type: string;
        session: {
            sessionId: any;
            status: any;
        };
        reason?: undefined;
        deniedActions?: undefined;
        actionsToConfirm?: undefined;
        instruction?: undefined;
        message?: undefined;
        setupInstructions?: undefined;
        task?: undefined;
        intent?: undefined;
    } | {
        taskId: string;
        status: string;
        type: string;
        task: {
            taskId: string;
            deviceId: any;
            status: string;
        };
        reason?: undefined;
        deniedActions?: undefined;
        actionsToConfirm?: undefined;
        instruction?: undefined;
        message?: undefined;
        setupInstructions?: undefined;
        session?: undefined;
        intent?: undefined;
    } | {
        taskId: string;
        status: string;
        type: string;
        intent: {
            raw: any;
            type: string;
            primaryAction: null;
            requiredActions: never[];
            params: {};
            requiresDevice: boolean;
            priority: string;
        };
        message: string;
        reason?: undefined;
        deniedActions?: undefined;
        actionsToConfirm?: undefined;
        instruction?: undefined;
        setupInstructions?: undefined;
        session?: undefined;
        task?: undefined;
    }>;
    /**
     * Register a device for cross-device control.
     */
    registerDevice(userId: any, deviceInfo: any): {
        deviceId: any;
        sessionToken: any;
        capabilities: any;
    };
    /**
     * Get all available platforms and control methods.
     */
    getPlatforms(): {
        android: {
            id: string;
            name: string;
            icon: string;
            controlMethods: {
                workProfile: {
                    label: string;
                    description: string;
                    capabilities: string[];
                    rootRequired: boolean;
                };
                accessibility: {
                    label: string;
                    description: string;
                    capabilities: string[];
                    rootRequired: boolean;
                };
                deviceAdmin: {
                    label: string;
                    description: string;
                    capabilities: string[];
                    rootRequired: boolean;
                    businessOnly: boolean;
                };
                adb: {
                    label: string;
                    description: string;
                    capabilities: string[];
                    rootRequired: boolean;
                };
            };
        };
        ios: {
            id: string;
            name: string;
            icon: string;
            controlMethods: {
                shortcuts: {
                    label: string;
                    description: string;
                    capabilities: string[];
                    rootRequired: boolean;
                };
                mdm: {
                    label: string;
                    description: string;
                    capabilities: string[];
                    rootRequired: boolean;
                    businessOnly: boolean;
                };
                webClip: {
                    label: string;
                    description: string;
                    capabilities: string[];
                    rootRequired: boolean;
                };
            };
        };
        desktop: {
            id: string;
            name: string;
            icon: string;
            controlMethods: {
                nativeAgent: {
                    label: string;
                    description: string;
                    capabilities: string[];
                    rootRequired: boolean;
                };
                browserExtension: {
                    label: string;
                    description: string;
                    capabilities: string[];
                    rootRequired: boolean;
                };
                dockerIsolated: {
                    label: string;
                    description: string;
                    capabilities: string[];
                    rootRequired: boolean;
                };
            };
        };
        web: {
            id: string;
            name: string;
            icon: string;
            controlMethods: {
                pwa: {
                    label: string;
                    description: string;
                    capabilities: string[];
                    rootRequired: boolean;
                };
            };
        };
    };
    /**
     * Get all Buddy capabilities and their requirements.
     */
    getCapabilities(): {
        conversation: {
            label: string;
            desc: string;
            alwaysAvailable: boolean;
        };
        reasoning: {
            label: string;
            desc: string;
            alwaysAvailable: boolean;
        };
        memory: {
            label: string;
            desc: string;
            alwaysAvailable: boolean;
        };
        computerUse: {
            label: string;
            desc: string;
            requiresDevice: boolean;
        };
        fileManagement: {
            label: string;
            desc: string;
            requiresDevice: boolean;
        };
        appControl: {
            label: string;
            desc: string;
            requiresDevice: boolean;
        };
        shellAccess: {
            label: string;
            desc: string;
            requiresDevice: boolean;
        };
        email: {
            label: string;
            desc: string;
            requiresConnector: string[];
        };
        calendar: {
            label: string;
            desc: string;
            requiresConnector: string[];
        };
        messaging: {
            label: string;
            desc: string;
            requiresConnector: string[];
        };
        codeAssistant: {
            label: string;
            desc: string;
            requiresConnector: string[];
        };
        documentCreation: {
            label: string;
            desc: string;
            requiresConnector: string[];
        };
        taskManagement: {
            label: string;
            desc: string;
            requiresConnector: string[];
        };
        webResearch: {
            label: string;
            desc: string;
            requiresDevice: boolean;
        };
        dataAnalysis: {
            label: string;
            desc: string;
            alwaysAvailable: boolean;
        };
        cloudManagement: {
            label: string;
            desc: string;
            requiresConnector: string[];
        };
        deviceManagement: {
            label: string;
            desc: string;
            requiresDevice: boolean;
        };
        workflows: {
            label: string;
            desc: string;
            alwaysAvailable: boolean;
        };
        monitoring: {
            label: string;
            desc: string;
            alwaysAvailable: boolean;
        };
    };
    /**
     * Get permission matrix for a user.
     */
    getPermissions(userId: any): {};
    /**
     * Update a permission override.
     */
    setPermission(userId: any, actionId: any, riskTier: any): {
        ok: boolean;
        userId: string;
        actionId: string;
        riskTier: string;
    };
    /**
     * Get device setup instructions for each platform.
     */
    _getDeviceSetupInstructions(): {
        android: {
            title: string;
            steps: string[];
            capabilities: string;
        };
        ios: {
            title: string;
            steps: string[];
            capabilities: string;
        };
        desktop: {
            title: string;
            steps: string[];
            capabilities: string;
        };
        web: {
            title: string;
            steps: string[];
            capabilities: string;
        };
    };
    /**
     * Parse instruction to determine intent (simplified for MVP).
     * Production version would use LLM classification.
     */
    _parseIntent(instruction: any): {
        raw: any;
        type: string;
        primaryAction: null;
        requiredActions: never[];
        params: {};
        requiresDevice: boolean;
        priority: string;
    };
    /**
     * Get health of all subsystems.
     */
    getHealth(): {
        status: string;
        version: string;
        uptime: number;
        subsystems: {
            deviceBridge: {
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
            computerUse: {
                ts: string;
                sessions: number;
                steps: number;
                successes: number;
                failures: number;
                escalations: number;
                status: string;
                activeSessions: number;
            };
            authorization: {
                ts: string;
                authorized: number;
                denied: number;
                confirmed: number;
                notified: number;
                status: string;
                policies: number;
                auditEntries: number;
            };
        };
        capabilities: number;
        platforms: number;
        actionTypes: number;
        permissionCategories: number;
        ts: string;
    };
}
export namespace BUDDY_CAPABILITIES {
    namespace conversation {
        let label: string;
        let desc: string;
        let alwaysAvailable: boolean;
    }
    namespace reasoning {
        let label_1: string;
        export { label_1 as label };
        let desc_1: string;
        export { desc_1 as desc };
        let alwaysAvailable_1: boolean;
        export { alwaysAvailable_1 as alwaysAvailable };
    }
    namespace memory {
        let label_2: string;
        export { label_2 as label };
        let desc_2: string;
        export { desc_2 as desc };
        let alwaysAvailable_2: boolean;
        export { alwaysAvailable_2 as alwaysAvailable };
    }
    namespace computerUse {
        let label_3: string;
        export { label_3 as label };
        let desc_3: string;
        export { desc_3 as desc };
        export let requiresDevice: boolean;
    }
    namespace fileManagement {
        let label_4: string;
        export { label_4 as label };
        let desc_4: string;
        export { desc_4 as desc };
        let requiresDevice_1: boolean;
        export { requiresDevice_1 as requiresDevice };
    }
    namespace appControl {
        let label_5: string;
        export { label_5 as label };
        let desc_5: string;
        export { desc_5 as desc };
        let requiresDevice_2: boolean;
        export { requiresDevice_2 as requiresDevice };
    }
    namespace shellAccess {
        let label_6: string;
        export { label_6 as label };
        let desc_6: string;
        export { desc_6 as desc };
        let requiresDevice_3: boolean;
        export { requiresDevice_3 as requiresDevice };
    }
    namespace email {
        let label_7: string;
        export { label_7 as label };
        let desc_7: string;
        export { desc_7 as desc };
        export let requiresConnector: string[];
    }
    namespace calendar {
        let label_8: string;
        export { label_8 as label };
        let desc_8: string;
        export { desc_8 as desc };
        let requiresConnector_1: string[];
        export { requiresConnector_1 as requiresConnector };
    }
    namespace messaging {
        let label_9: string;
        export { label_9 as label };
        let desc_9: string;
        export { desc_9 as desc };
        let requiresConnector_2: string[];
        export { requiresConnector_2 as requiresConnector };
    }
    namespace codeAssistant {
        let label_10: string;
        export { label_10 as label };
        let desc_10: string;
        export { desc_10 as desc };
        let requiresConnector_3: string[];
        export { requiresConnector_3 as requiresConnector };
    }
    namespace documentCreation {
        let label_11: string;
        export { label_11 as label };
        let desc_11: string;
        export { desc_11 as desc };
        let requiresConnector_4: string[];
        export { requiresConnector_4 as requiresConnector };
    }
    namespace taskManagement {
        let label_12: string;
        export { label_12 as label };
        let desc_12: string;
        export { desc_12 as desc };
        let requiresConnector_5: string[];
        export { requiresConnector_5 as requiresConnector };
    }
    namespace webResearch {
        let label_13: string;
        export { label_13 as label };
        let desc_13: string;
        export { desc_13 as desc };
        let requiresDevice_4: boolean;
        export { requiresDevice_4 as requiresDevice };
    }
    namespace dataAnalysis {
        let label_14: string;
        export { label_14 as label };
        let desc_14: string;
        export { desc_14 as desc };
        let alwaysAvailable_3: boolean;
        export { alwaysAvailable_3 as alwaysAvailable };
    }
    namespace cloudManagement {
        let label_15: string;
        export { label_15 as label };
        let desc_15: string;
        export { desc_15 as desc };
        let requiresConnector_6: string[];
        export { requiresConnector_6 as requiresConnector };
    }
    namespace deviceManagement {
        let label_16: string;
        export { label_16 as label };
        let desc_16: string;
        export { desc_16 as desc };
        let requiresDevice_5: boolean;
        export { requiresDevice_5 as requiresDevice };
    }
    namespace workflows {
        let label_17: string;
        export { label_17 as label };
        let desc_17: string;
        export { desc_17 as desc };
        let alwaysAvailable_4: boolean;
        export { alwaysAvailable_4 as alwaysAvailable };
    }
    namespace monitoring {
        let label_18: string;
        export { label_18 as label };
        let desc_18: string;
        export { desc_18 as desc };
        let alwaysAvailable_5: boolean;
        export { alwaysAvailable_5 as alwaysAvailable };
    }
}
import EventEmitter = require("events");
import { DeviceBridge } from "./buddy-device-bridge";
import { ComputerUseEngine } from "./buddy-computer-use";
import { BuddyAuthorization } from "./buddy-authorization";
//# sourceMappingURL=buddy-agent-hub.d.ts.map