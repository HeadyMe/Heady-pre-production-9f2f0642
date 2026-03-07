export class BuddyAuthorization extends EventEmitter<[never]> {
    constructor(opts?: {});
    userPolicies: Map<any, any>;
    auditLog: any[];
    maxAuditEntries: any;
    metrics: {
        authorized: number;
        denied: number;
        confirmed: number;
        notified: number;
    };
    /**
     * Check if an action is authorized for a user on a specific device.
     *
     * @param {string} userId
     * @param {string} actionId - The action to check (e.g., "file_delete")
     * @param {{ deviceId?, context?, metadata? }} opts
     * @returns {{ allowed: boolean, riskTier: string, requiresConfirmation: boolean, reason?: string }}
     */
    authorize(userId: string, actionId: string, opts?: {
        deviceId?: any;
        context?: any;
        metadata?: any;
    }): {
        allowed: boolean;
        riskTier: string;
        requiresConfirmation: boolean;
        reason?: string;
    };
    /**
     * Set a user's permission override for an action.
     * @param {string} userId
     * @param {string} actionId
     * @param {string} riskTier - "auto", "notify", "confirm", "deny"
     */
    setOverride(userId: string, actionId: string, riskTier: string): {
        ok: boolean;
        userId: string;
        actionId: string;
        riskTier: string;
    };
    /**
     * Restrict actions to specific devices.
     */
    setDeviceScope(userId: any, deviceId: any, allowedCategories: any): {
        ok: boolean;
        userId: any;
        deviceId: any;
        categories: any;
    };
    /**
     * Set time-based restrictions.
     */
    setTimeRestrictions(userId: any, { startHour, endHour, timezone }: {
        startHour: any;
        endHour: any;
        timezone: any;
    }): {
        ok: boolean;
        userId: any;
        startHour: any;
        endHour: any;
        timezone: any;
    };
    /**
     * Get the full permission matrix for a user.
     */
    getPermissionMatrix(userId: any): {};
    /**
     * Get available risk tiers.
     */
    getRiskTiers(): {
        auto: {
            id: string;
            label: string;
            icon: string;
            description: string;
            defaultDelay: number;
            examples: string[];
        };
        notify: {
            id: string;
            label: string;
            icon: string;
            description: string;
            defaultDelay: number;
            examples: string[];
        };
        timed: {
            id: string;
            label: string;
            icon: string;
            description: string;
            defaultDelay: number;
            examples: string[];
        };
        cautious: {
            id: string;
            label: string;
            icon: string;
            description: string;
            defaultDelay: number;
            examples: string[];
        };
    };
    /**
     * Get available permission categories and actions.
     */
    getPermissionCategories(): {
        screen: {
            label: string;
            icon: string;
            actions: {
                screenshot: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                screen_record: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                get_ui_tree: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
            };
        };
        input: {
            label: string;
            icon: string;
            actions: {
                click: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                type_text: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                scroll: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                swipe: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                hotkey: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
            };
        };
        apps: {
            label: string;
            icon: string;
            actions: {
                app_launch: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                app_close: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                app_install: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                app_uninstall: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                app_config: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
            };
        };
        files: {
            label: string;
            icon: string;
            actions: {
                file_read: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                file_list: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                file_write: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                file_move: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                file_copy: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                file_delete: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
            };
        };
        system: {
            label: string;
            icon: string;
            actions: {
                shell_exec: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                system_info: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                process_manage: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                clipboard_read: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                clipboard_write: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                notification: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                cron_schedule: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
            };
        };
        communication: {
            label: string;
            icon: string;
            actions: {
                email_read: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                email_send: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                message_read: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                message_send: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                calendar_read: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                calendar_write: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                call_make: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
            };
        };
        browser: {
            label: string;
            icon: string;
            actions: {
                browser_open: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                browser_read: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                browser_fill: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                browser_click: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                browser_submit: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                browser_download: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                browser_auth: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
            };
        };
        financial: {
            label: string;
            icon: string;
            actions: {
                view_balance: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                view_transactions: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                send_payment: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                create_invoice: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
            };
        };
        device: {
            label: string;
            icon: string;
            actions: {
                lock_device: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                location_read: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                camera_capture: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                mic_record: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                bluetooth: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                wifi_config: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
                wipe_device: {
                    defaultRisk: string;
                    label: string;
                    delay: number;
                };
            };
        };
    };
    /**
     * Get recent audit log entries.
     */
    getAuditLog(userId: any, limit?: number): any[];
    getHealth(): {
        ts: string;
        authorized: number;
        denied: number;
        confirmed: number;
        notified: number;
        status: string;
        policies: number;
        auditEntries: number;
    };
    _findAction(actionId: any): any;
    _applyRiskTier(tier: any, actionId: any): {
        allowed: boolean;
        riskTier: any;
        delay: any;
        notification: boolean;
    };
    _audit(userId: any, actionId: any, result: any, reason: any): void;
}
export namespace RISK_TIERS {
    namespace auto {
        let id: string;
        let label: string;
        let icon: string;
        let description: string;
        let defaultDelay: number;
        let examples: string[];
    }
    namespace notify {
        let id_1: string;
        export { id_1 as id };
        let label_1: string;
        export { label_1 as label };
        let icon_1: string;
        export { icon_1 as icon };
        let description_1: string;
        export { description_1 as description };
        let defaultDelay_1: number;
        export { defaultDelay_1 as defaultDelay };
        let examples_1: string[];
        export { examples_1 as examples };
    }
    namespace timed {
        let id_2: string;
        export { id_2 as id };
        let label_2: string;
        export { label_2 as label };
        let icon_2: string;
        export { icon_2 as icon };
        let description_2: string;
        export { description_2 as description };
        let defaultDelay_2: number;
        export { defaultDelay_2 as defaultDelay };
        let examples_2: string[];
        export { examples_2 as examples };
    }
    namespace cautious {
        let id_3: string;
        export { id_3 as id };
        let label_3: string;
        export { label_3 as label };
        let icon_3: string;
        export { icon_3 as icon };
        let description_3: string;
        export { description_3 as description };
        let defaultDelay_3: number;
        export { defaultDelay_3 as defaultDelay };
        let examples_3: string[];
        export { examples_3 as examples };
    }
}
export namespace PERMISSION_CATEGORIES {
    namespace screen {
        let label_4: string;
        export { label_4 as label };
        let icon_4: string;
        export { icon_4 as icon };
        export namespace actions {
            namespace screenshot {
                export let defaultRisk: string;
                let label_5: string;
                export { label_5 as label };
                export let delay: number;
            }
            namespace screen_record {
                let defaultRisk_1: string;
                export { defaultRisk_1 as defaultRisk };
                let label_6: string;
                export { label_6 as label };
                let delay_1: number;
                export { delay_1 as delay };
            }
            namespace get_ui_tree {
                let defaultRisk_2: string;
                export { defaultRisk_2 as defaultRisk };
                let label_7: string;
                export { label_7 as label };
                let delay_2: number;
                export { delay_2 as delay };
            }
        }
    }
    namespace input {
        let label_8: string;
        export { label_8 as label };
        let icon_5: string;
        export { icon_5 as icon };
        export namespace actions_1 {
            namespace click {
                let defaultRisk_3: string;
                export { defaultRisk_3 as defaultRisk };
                let label_9: string;
                export { label_9 as label };
                let delay_3: number;
                export { delay_3 as delay };
            }
            namespace type_text {
                let defaultRisk_4: string;
                export { defaultRisk_4 as defaultRisk };
                let label_10: string;
                export { label_10 as label };
                let delay_4: number;
                export { delay_4 as delay };
            }
            namespace scroll {
                let defaultRisk_5: string;
                export { defaultRisk_5 as defaultRisk };
                let label_11: string;
                export { label_11 as label };
                let delay_5: number;
                export { delay_5 as delay };
            }
            namespace swipe {
                let defaultRisk_6: string;
                export { defaultRisk_6 as defaultRisk };
                let label_12: string;
                export { label_12 as label };
                let delay_6: number;
                export { delay_6 as delay };
            }
            namespace hotkey {
                let defaultRisk_7: string;
                export { defaultRisk_7 as defaultRisk };
                let label_13: string;
                export { label_13 as label };
                let delay_7: number;
                export { delay_7 as delay };
            }
        }
        export { actions_1 as actions };
    }
    namespace apps {
        let label_14: string;
        export { label_14 as label };
        let icon_6: string;
        export { icon_6 as icon };
        export namespace actions_2 {
            namespace app_launch {
                let defaultRisk_8: string;
                export { defaultRisk_8 as defaultRisk };
                let label_15: string;
                export { label_15 as label };
                let delay_8: number;
                export { delay_8 as delay };
            }
            namespace app_close {
                let defaultRisk_9: string;
                export { defaultRisk_9 as defaultRisk };
                let label_16: string;
                export { label_16 as label };
                let delay_9: number;
                export { delay_9 as delay };
            }
            namespace app_install {
                let defaultRisk_10: string;
                export { defaultRisk_10 as defaultRisk };
                let label_17: string;
                export { label_17 as label };
                let delay_10: number;
                export { delay_10 as delay };
            }
            namespace app_uninstall {
                let defaultRisk_11: string;
                export { defaultRisk_11 as defaultRisk };
                let label_18: string;
                export { label_18 as label };
                let delay_11: number;
                export { delay_11 as delay };
            }
            namespace app_config {
                let defaultRisk_12: string;
                export { defaultRisk_12 as defaultRisk };
                let label_19: string;
                export { label_19 as label };
                let delay_12: number;
                export { delay_12 as delay };
            }
        }
        export { actions_2 as actions };
    }
    namespace files {
        let label_20: string;
        export { label_20 as label };
        let icon_7: string;
        export { icon_7 as icon };
        export namespace actions_3 {
            namespace file_read {
                let defaultRisk_13: string;
                export { defaultRisk_13 as defaultRisk };
                let label_21: string;
                export { label_21 as label };
                let delay_13: number;
                export { delay_13 as delay };
            }
            namespace file_list {
                let defaultRisk_14: string;
                export { defaultRisk_14 as defaultRisk };
                let label_22: string;
                export { label_22 as label };
                let delay_14: number;
                export { delay_14 as delay };
            }
            namespace file_write {
                let defaultRisk_15: string;
                export { defaultRisk_15 as defaultRisk };
                let label_23: string;
                export { label_23 as label };
                let delay_15: number;
                export { delay_15 as delay };
            }
            namespace file_move {
                let defaultRisk_16: string;
                export { defaultRisk_16 as defaultRisk };
                let label_24: string;
                export { label_24 as label };
                let delay_16: number;
                export { delay_16 as delay };
            }
            namespace file_copy {
                let defaultRisk_17: string;
                export { defaultRisk_17 as defaultRisk };
                let label_25: string;
                export { label_25 as label };
                let delay_17: number;
                export { delay_17 as delay };
            }
            namespace file_delete {
                let defaultRisk_18: string;
                export { defaultRisk_18 as defaultRisk };
                let label_26: string;
                export { label_26 as label };
                let delay_18: number;
                export { delay_18 as delay };
            }
        }
        export { actions_3 as actions };
    }
    namespace system {
        let label_27: string;
        export { label_27 as label };
        let icon_8: string;
        export { icon_8 as icon };
        export namespace actions_4 {
            namespace shell_exec {
                let defaultRisk_19: string;
                export { defaultRisk_19 as defaultRisk };
                let label_28: string;
                export { label_28 as label };
                let delay_19: number;
                export { delay_19 as delay };
            }
            namespace system_info {
                let defaultRisk_20: string;
                export { defaultRisk_20 as defaultRisk };
                let label_29: string;
                export { label_29 as label };
                let delay_20: number;
                export { delay_20 as delay };
            }
            namespace process_manage {
                let defaultRisk_21: string;
                export { defaultRisk_21 as defaultRisk };
                let label_30: string;
                export { label_30 as label };
                let delay_21: number;
                export { delay_21 as delay };
            }
            namespace clipboard_read {
                let defaultRisk_22: string;
                export { defaultRisk_22 as defaultRisk };
                let label_31: string;
                export { label_31 as label };
                let delay_22: number;
                export { delay_22 as delay };
            }
            namespace clipboard_write {
                let defaultRisk_23: string;
                export { defaultRisk_23 as defaultRisk };
                let label_32: string;
                export { label_32 as label };
                let delay_23: number;
                export { delay_23 as delay };
            }
            namespace notification {
                let defaultRisk_24: string;
                export { defaultRisk_24 as defaultRisk };
                let label_33: string;
                export { label_33 as label };
                let delay_24: number;
                export { delay_24 as delay };
            }
            namespace cron_schedule {
                let defaultRisk_25: string;
                export { defaultRisk_25 as defaultRisk };
                let label_34: string;
                export { label_34 as label };
                let delay_25: number;
                export { delay_25 as delay };
            }
        }
        export { actions_4 as actions };
    }
    namespace communication {
        let label_35: string;
        export { label_35 as label };
        let icon_9: string;
        export { icon_9 as icon };
        export namespace actions_5 {
            namespace email_read {
                let defaultRisk_26: string;
                export { defaultRisk_26 as defaultRisk };
                let label_36: string;
                export { label_36 as label };
                let delay_26: number;
                export { delay_26 as delay };
            }
            namespace email_send {
                let defaultRisk_27: string;
                export { defaultRisk_27 as defaultRisk };
                let label_37: string;
                export { label_37 as label };
                let delay_27: number;
                export { delay_27 as delay };
            }
            namespace message_read {
                let defaultRisk_28: string;
                export { defaultRisk_28 as defaultRisk };
                let label_38: string;
                export { label_38 as label };
                let delay_28: number;
                export { delay_28 as delay };
            }
            namespace message_send {
                let defaultRisk_29: string;
                export { defaultRisk_29 as defaultRisk };
                let label_39: string;
                export { label_39 as label };
                let delay_29: number;
                export { delay_29 as delay };
            }
            namespace calendar_read {
                let defaultRisk_30: string;
                export { defaultRisk_30 as defaultRisk };
                let label_40: string;
                export { label_40 as label };
                let delay_30: number;
                export { delay_30 as delay };
            }
            namespace calendar_write {
                let defaultRisk_31: string;
                export { defaultRisk_31 as defaultRisk };
                let label_41: string;
                export { label_41 as label };
                let delay_31: number;
                export { delay_31 as delay };
            }
            namespace call_make {
                let defaultRisk_32: string;
                export { defaultRisk_32 as defaultRisk };
                let label_42: string;
                export { label_42 as label };
                let delay_32: number;
                export { delay_32 as delay };
            }
        }
        export { actions_5 as actions };
    }
    namespace browser {
        let label_43: string;
        export { label_43 as label };
        let icon_10: string;
        export { icon_10 as icon };
        export namespace actions_6 {
            namespace browser_open {
                let defaultRisk_33: string;
                export { defaultRisk_33 as defaultRisk };
                let label_44: string;
                export { label_44 as label };
                let delay_33: number;
                export { delay_33 as delay };
            }
            namespace browser_read {
                let defaultRisk_34: string;
                export { defaultRisk_34 as defaultRisk };
                let label_45: string;
                export { label_45 as label };
                let delay_34: number;
                export { delay_34 as delay };
            }
            namespace browser_fill {
                let defaultRisk_35: string;
                export { defaultRisk_35 as defaultRisk };
                let label_46: string;
                export { label_46 as label };
                let delay_35: number;
                export { delay_35 as delay };
            }
            namespace browser_click {
                let defaultRisk_36: string;
                export { defaultRisk_36 as defaultRisk };
                let label_47: string;
                export { label_47 as label };
                let delay_36: number;
                export { delay_36 as delay };
            }
            namespace browser_submit {
                let defaultRisk_37: string;
                export { defaultRisk_37 as defaultRisk };
                let label_48: string;
                export { label_48 as label };
                let delay_37: number;
                export { delay_37 as delay };
            }
            namespace browser_download {
                let defaultRisk_38: string;
                export { defaultRisk_38 as defaultRisk };
                let label_49: string;
                export { label_49 as label };
                let delay_38: number;
                export { delay_38 as delay };
            }
            namespace browser_auth {
                let defaultRisk_39: string;
                export { defaultRisk_39 as defaultRisk };
                let label_50: string;
                export { label_50 as label };
                let delay_39: number;
                export { delay_39 as delay };
            }
        }
        export { actions_6 as actions };
    }
    namespace financial {
        let label_51: string;
        export { label_51 as label };
        let icon_11: string;
        export { icon_11 as icon };
        export namespace actions_7 {
            namespace view_balance {
                let defaultRisk_40: string;
                export { defaultRisk_40 as defaultRisk };
                let label_52: string;
                export { label_52 as label };
                let delay_40: number;
                export { delay_40 as delay };
            }
            namespace view_transactions {
                let defaultRisk_41: string;
                export { defaultRisk_41 as defaultRisk };
                let label_53: string;
                export { label_53 as label };
                let delay_41: number;
                export { delay_41 as delay };
            }
            namespace send_payment {
                let defaultRisk_42: string;
                export { defaultRisk_42 as defaultRisk };
                let label_54: string;
                export { label_54 as label };
                let delay_42: number;
                export { delay_42 as delay };
            }
            namespace create_invoice {
                let defaultRisk_43: string;
                export { defaultRisk_43 as defaultRisk };
                let label_55: string;
                export { label_55 as label };
                let delay_43: number;
                export { delay_43 as delay };
            }
        }
        export { actions_7 as actions };
    }
    namespace device {
        let label_56: string;
        export { label_56 as label };
        let icon_12: string;
        export { icon_12 as icon };
        export namespace actions_8 {
            namespace lock_device {
                let defaultRisk_44: string;
                export { defaultRisk_44 as defaultRisk };
                let label_57: string;
                export { label_57 as label };
                let delay_44: number;
                export { delay_44 as delay };
            }
            namespace location_read {
                let defaultRisk_45: string;
                export { defaultRisk_45 as defaultRisk };
                let label_58: string;
                export { label_58 as label };
                let delay_45: number;
                export { delay_45 as delay };
            }
            namespace camera_capture {
                let defaultRisk_46: string;
                export { defaultRisk_46 as defaultRisk };
                let label_59: string;
                export { label_59 as label };
                let delay_46: number;
                export { delay_46 as delay };
            }
            namespace mic_record {
                let defaultRisk_47: string;
                export { defaultRisk_47 as defaultRisk };
                let label_60: string;
                export { label_60 as label };
                let delay_47: number;
                export { delay_47 as delay };
            }
            namespace bluetooth {
                let defaultRisk_48: string;
                export { defaultRisk_48 as defaultRisk };
                let label_61: string;
                export { label_61 as label };
                let delay_48: number;
                export { delay_48 as delay };
            }
            namespace wifi_config {
                let defaultRisk_49: string;
                export { defaultRisk_49 as defaultRisk };
                let label_62: string;
                export { label_62 as label };
                let delay_49: number;
                export { delay_49 as delay };
            }
            namespace wipe_device {
                let defaultRisk_50: string;
                export { defaultRisk_50 as defaultRisk };
                let label_63: string;
                export { label_63 as label };
                let delay_50: number;
                export { delay_50 as delay };
            }
        }
        export { actions_8 as actions };
    }
}
import EventEmitter = require("events");
//# sourceMappingURL=buddy-authorization.d.ts.map