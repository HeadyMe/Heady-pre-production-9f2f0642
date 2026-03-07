export class ComputerUseEngine extends EventEmitter<[never]> {
    constructor(opts?: {});
    maxSteps: any;
    stepTimeout: any;
    screenshotInterval: any;
    confidenceThreshold: any;
    sessions: Map<any, any>;
    metrics: {
        sessions: number;
        steps: number;
        successes: number;
        failures: number;
        escalations: number;
    };
    /**
     * Start a computer-use session — the main OBSERVE→THINK→ACT→VERIFY loop.
     *
     * @param {{ goal, deviceId, userId, context?, maxSteps? }} params
     * @returns {{ sessionId, status }}
     */
    startSession(params: {
        goal: any;
        deviceId: any;
        userId: any;
        context?: any;
        maxSteps?: any;
    }): {
        sessionId: any;
        status: any;
    };
    /**
     * Execute one step of the OBSERVE→THINK→ACT→VERIFY loop.
     *
     * @param {string} sessionId
     * @param {{ observation, reasoning?, action?, verification? }} stepData
     */
    executeStep(sessionId: string, stepData: {
        observation: any;
        reasoning?: any;
        action?: any;
        verification?: any;
    }): {
        sessionId: string;
        status: string;
        message: string;
        stepNumber?: undefined;
    } | {
        sessionId: string;
        stepNumber: any;
        status: string;
        message?: undefined;
    };
    /**
     * Complete a session — goal achieved or failed.
     */
    completeSession(sessionId: any, result: any): {
        sessionId: any;
        status: any;
        totalSteps: any;
        duration: number;
        result: any;
    };
    /**
     * Get session details with step history.
     */
    getSession(sessionId: any): any;
    /**
     * Generate a task plan from a natural language goal.
     * Returns a sequence of planned actions.
     *
     * @param {string} goal - Natural language description of the task
     * @param {{ platform, capabilities, currentApp? }} context
     * @returns {{ plan: Array<{ action, description, estimated_time }> }}
     */
    planTask(goal: string, context?: {
        platform: any;
        capabilities: any;
        currentApp?: any;
    }): {
        plan: Array<{
            action: any;
            description: any;
            estimated_time: any;
        }>;
    };
    getAvailableActions(): {
        click: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        doubleClick: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        rightClick: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        longPress: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        drag: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        swipe: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        scroll: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        pinch: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        type: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        keyPress: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        hotkey: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        clear: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        back: {
            id: string;
            label: string;
            category: string;
            params: never[];
        };
        home: {
            id: string;
            label: string;
            category: string;
            params: never[];
        };
        recents: {
            id: string;
            label: string;
            category: string;
            params: never[];
        };
        openUrl: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        openApp: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        switchApp: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        closeApp: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        shell: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        readFile: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        writeFile: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        listDir: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        moveFile: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        copyFile: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        deleteFile: {
            id: string;
            label: string;
            category: string;
            params: string[];
            confirmRequired: boolean;
        };
        screenshot: {
            id: string;
            label: string;
            category: string;
            params: never[];
        };
        getUITree: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        getDOM: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        getClipboard: {
            id: string;
            label: string;
            category: string;
            params: never[];
        };
        setClipboard: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        wait: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        waitFor: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
        assert: {
            id: string;
            label: string;
            category: string;
            params: string[];
        };
    };
    getHealth(): {
        ts: string;
        sessions: number;
        steps: number;
        successes: number;
        failures: number;
        escalations: number;
        status: string;
        activeSessions: number;
    };
}
export namespace ACTION_TYPES {
    namespace click {
        let id: string;
        let label: string;
        let category: string;
        let params: string[];
    }
    namespace doubleClick {
        let id_1: string;
        export { id_1 as id };
        let label_1: string;
        export { label_1 as label };
        let category_1: string;
        export { category_1 as category };
        let params_1: string[];
        export { params_1 as params };
    }
    namespace rightClick {
        let id_2: string;
        export { id_2 as id };
        let label_2: string;
        export { label_2 as label };
        let category_2: string;
        export { category_2 as category };
        let params_2: string[];
        export { params_2 as params };
    }
    namespace longPress {
        let id_3: string;
        export { id_3 as id };
        let label_3: string;
        export { label_3 as label };
        let category_3: string;
        export { category_3 as category };
        let params_3: string[];
        export { params_3 as params };
    }
    namespace drag {
        let id_4: string;
        export { id_4 as id };
        let label_4: string;
        export { label_4 as label };
        let category_4: string;
        export { category_4 as category };
        let params_4: string[];
        export { params_4 as params };
    }
    namespace swipe {
        let id_5: string;
        export { id_5 as id };
        let label_5: string;
        export { label_5 as label };
        let category_5: string;
        export { category_5 as category };
        let params_5: string[];
        export { params_5 as params };
    }
    namespace scroll {
        let id_6: string;
        export { id_6 as id };
        let label_6: string;
        export { label_6 as label };
        let category_6: string;
        export { category_6 as category };
        let params_6: string[];
        export { params_6 as params };
    }
    namespace pinch {
        let id_7: string;
        export { id_7 as id };
        let label_7: string;
        export { label_7 as label };
        let category_7: string;
        export { category_7 as category };
        let params_7: string[];
        export { params_7 as params };
    }
    namespace type {
        let id_8: string;
        export { id_8 as id };
        let label_8: string;
        export { label_8 as label };
        let category_8: string;
        export { category_8 as category };
        let params_8: string[];
        export { params_8 as params };
    }
    namespace keyPress {
        let id_9: string;
        export { id_9 as id };
        let label_9: string;
        export { label_9 as label };
        let category_9: string;
        export { category_9 as category };
        let params_9: string[];
        export { params_9 as params };
    }
    namespace hotkey {
        let id_10: string;
        export { id_10 as id };
        let label_10: string;
        export { label_10 as label };
        let category_10: string;
        export { category_10 as category };
        let params_10: string[];
        export { params_10 as params };
    }
    namespace clear {
        let id_11: string;
        export { id_11 as id };
        let label_11: string;
        export { label_11 as label };
        let category_11: string;
        export { category_11 as category };
        let params_11: string[];
        export { params_11 as params };
    }
    namespace back {
        let id_12: string;
        export { id_12 as id };
        let label_12: string;
        export { label_12 as label };
        let category_12: string;
        export { category_12 as category };
        let params_12: never[];
        export { params_12 as params };
    }
    namespace home {
        let id_13: string;
        export { id_13 as id };
        let label_13: string;
        export { label_13 as label };
        let category_13: string;
        export { category_13 as category };
        let params_13: never[];
        export { params_13 as params };
    }
    namespace recents {
        let id_14: string;
        export { id_14 as id };
        let label_14: string;
        export { label_14 as label };
        let category_14: string;
        export { category_14 as category };
        let params_14: never[];
        export { params_14 as params };
    }
    namespace openUrl {
        let id_15: string;
        export { id_15 as id };
        let label_15: string;
        export { label_15 as label };
        let category_15: string;
        export { category_15 as category };
        let params_15: string[];
        export { params_15 as params };
    }
    namespace openApp {
        let id_16: string;
        export { id_16 as id };
        let label_16: string;
        export { label_16 as label };
        let category_16: string;
        export { category_16 as category };
        let params_16: string[];
        export { params_16 as params };
    }
    namespace switchApp {
        let id_17: string;
        export { id_17 as id };
        let label_17: string;
        export { label_17 as label };
        let category_17: string;
        export { category_17 as category };
        let params_17: string[];
        export { params_17 as params };
    }
    namespace closeApp {
        let id_18: string;
        export { id_18 as id };
        let label_18: string;
        export { label_18 as label };
        let category_18: string;
        export { category_18 as category };
        let params_18: string[];
        export { params_18 as params };
    }
    namespace shell {
        let id_19: string;
        export { id_19 as id };
        let label_19: string;
        export { label_19 as label };
        let category_19: string;
        export { category_19 as category };
        let params_19: string[];
        export { params_19 as params };
    }
    namespace readFile {
        let id_20: string;
        export { id_20 as id };
        let label_20: string;
        export { label_20 as label };
        let category_20: string;
        export { category_20 as category };
        let params_20: string[];
        export { params_20 as params };
    }
    namespace writeFile {
        let id_21: string;
        export { id_21 as id };
        let label_21: string;
        export { label_21 as label };
        let category_21: string;
        export { category_21 as category };
        let params_21: string[];
        export { params_21 as params };
    }
    namespace listDir {
        let id_22: string;
        export { id_22 as id };
        let label_22: string;
        export { label_22 as label };
        let category_22: string;
        export { category_22 as category };
        let params_22: string[];
        export { params_22 as params };
    }
    namespace moveFile {
        let id_23: string;
        export { id_23 as id };
        let label_23: string;
        export { label_23 as label };
        let category_23: string;
        export { category_23 as category };
        let params_23: string[];
        export { params_23 as params };
    }
    namespace copyFile {
        let id_24: string;
        export { id_24 as id };
        let label_24: string;
        export { label_24 as label };
        let category_24: string;
        export { category_24 as category };
        let params_24: string[];
        export { params_24 as params };
    }
    namespace deleteFile {
        let id_25: string;
        export { id_25 as id };
        let label_25: string;
        export { label_25 as label };
        let category_25: string;
        export { category_25 as category };
        let params_25: string[];
        export { params_25 as params };
        export let confirmRequired: boolean;
    }
    namespace screenshot {
        let id_26: string;
        export { id_26 as id };
        let label_26: string;
        export { label_26 as label };
        let category_26: string;
        export { category_26 as category };
        let params_26: never[];
        export { params_26 as params };
    }
    namespace getUITree {
        let id_27: string;
        export { id_27 as id };
        let label_27: string;
        export { label_27 as label };
        let category_27: string;
        export { category_27 as category };
        let params_27: string[];
        export { params_27 as params };
    }
    namespace getDOM {
        let id_28: string;
        export { id_28 as id };
        let label_28: string;
        export { label_28 as label };
        let category_28: string;
        export { category_28 as category };
        let params_28: string[];
        export { params_28 as params };
    }
    namespace getClipboard {
        let id_29: string;
        export { id_29 as id };
        let label_29: string;
        export { label_29 as label };
        let category_29: string;
        export { category_29 as category };
        let params_29: never[];
        export { params_29 as params };
    }
    namespace setClipboard {
        let id_30: string;
        export { id_30 as id };
        let label_30: string;
        export { label_30 as label };
        let category_30: string;
        export { category_30 as category };
        let params_30: string[];
        export { params_30 as params };
    }
    namespace wait {
        let id_31: string;
        export { id_31 as id };
        let label_31: string;
        export { label_31 as label };
        let category_31: string;
        export { category_31 as category };
        let params_31: string[];
        export { params_31 as params };
    }
    namespace waitFor {
        let id_32: string;
        export { id_32 as id };
        let label_32: string;
        export { label_32 as label };
        let category_32: string;
        export { category_32 as category };
        let params_32: string[];
        export { params_32 as params };
    }
    namespace assert {
        let id_33: string;
        export { id_33 as id };
        let label_33: string;
        export { label_33 as label };
        let category_33: string;
        export { category_33 as category };
        let params_33: string[];
        export { params_33 as params };
    }
}
import EventEmitter = require("events");
//# sourceMappingURL=buddy-computer-use.d.ts.map