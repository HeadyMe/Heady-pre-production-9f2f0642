/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * BUDDY AUTHORIZATION — Granular Permission Framework for Cross-Device Agent
 *
 * Controls what HeadyBuddy can do, on which devices, in which contexts.
 * Every action goes through this authorization layer before execution.
 *
 * Permission Model:
 *   - Category-level grants (e.g., "allow all file operations")
 *   - Action-level grants (e.g., "allow file_read but not file_delete")
 *   - Device-level scoping (e.g., "only on my work laptop")
 *   - Time-based access (e.g., "only during business hours")
 *   - Confirmation levels (e.g., "always ask before deleting")
 *   - Risk tiers: auto-approve (low), notify (medium), confirm (high), deny (critical)
 */
"use strict";

const EventEmitter = require("events");

// ─── Risk Tiers ─────────────────────────────────────────────────────

const RISK_TIERS = {
    auto: {
        id: "auto",
        label: "Auto-Approve",
        icon: "✅",
        description: "Low-risk actions executed immediately without asking",
        examples: ["screenshot", "read_file", "get_clipboard", "system_info", "list_dir"],
    },
    notify: {
        id: "notify",
        label: "Notify & Execute",
        icon: "📢",
        description: "Medium-risk actions executed with notification to user",
        examples: ["write_file", "send_email", "create_event", "install_app"],
    },
    confirm: {
        id: "confirm",
        label: "Require Confirmation",
        icon: "⚠️",
        description: "High-risk actions require explicit user approval before execution",
        examples: ["delete_file", "shell_exec", "send_payment", "modify_settings"],
    },
    deny: {
        id: "deny",
        label: "Always Deny",
        icon: "🚫",
        description: "Critical actions never executed by Buddy — user must perform manually",
        examples: ["wipe_device", "change_password", "root_access", "financial_transfer"],
    },
};

// ─── Permission Categories ──────────────────────────────────────────

const PERMISSION_CATEGORIES = {
    screen: {
        label: "Screen & Display",
        icon: "🖥️",
        actions: {
            screenshot: { defaultRisk: "auto", label: "Capture screenshots" },
            screen_record: { defaultRisk: "notify", label: "Record screen activity" },
            get_ui_tree: { defaultRisk: "auto", label: "Read UI element hierarchy" },
        },
    },
    input: {
        label: "Input Control",
        icon: "🖱️",
        actions: {
            click: { defaultRisk: "auto", label: "Click/tap at coordinates" },
            type_text: { defaultRisk: "auto", label: "Type text into fields" },
            scroll: { defaultRisk: "auto", label: "Scroll content" },
            swipe: { defaultRisk: "auto", label: "Swipe gestures" },
            hotkey: { defaultRisk: "notify", label: "Keyboard shortcuts" },
        },
    },
    apps: {
        label: "Application Control",
        icon: "📱",
        actions: {
            app_launch: { defaultRisk: "auto", label: "Open applications" },
            app_close: { defaultRisk: "notify", label: "Close applications" },
            app_install: { defaultRisk: "confirm", label: "Install new applications" },
            app_uninstall: { defaultRisk: "confirm", label: "Uninstall applications" },
            app_config: { defaultRisk: "confirm", label: "Change app settings" },
        },
    },
    files: {
        label: "File System",
        icon: "📁",
        actions: {
            file_read: { defaultRisk: "auto", label: "Read file contents" },
            file_list: { defaultRisk: "auto", label: "List directory contents" },
            file_write: { defaultRisk: "notify", label: "Create or modify files" },
            file_move: { defaultRisk: "notify", label: "Move or rename files" },
            file_copy: { defaultRisk: "auto", label: "Copy files" },
            file_delete: { defaultRisk: "confirm", label: "Delete files" },
        },
    },
    system: {
        label: "System & Shell",
        icon: "⚙️",
        actions: {
            shell_exec: { defaultRisk: "confirm", label: "Execute shell commands" },
            system_info: { defaultRisk: "auto", label: "Read system information" },
            process_manage: { defaultRisk: "confirm", label: "Start/stop system processes" },
            clipboard_read: { defaultRisk: "auto", label: "Read clipboard" },
            clipboard_write: { defaultRisk: "notify", label: "Write to clipboard" },
            notification: { defaultRisk: "auto", label: "Send notifications" },
            cron_schedule: { defaultRisk: "confirm", label: "Schedule recurring tasks" },
        },
    },
    communication: {
        label: "Communication",
        icon: "💬",
        actions: {
            email_read: { defaultRisk: "auto", label: "Read emails" },
            email_send: { defaultRisk: "confirm", label: "Send emails" },
            message_read: { defaultRisk: "notify", label: "Read messages" },
            message_send: { defaultRisk: "confirm", label: "Send messages" },
            calendar_read: { defaultRisk: "auto", label: "Read calendar events" },
            calendar_write: { defaultRisk: "notify", label: "Create/modify events" },
            call_make: { defaultRisk: "confirm", label: "Make phone calls" },
        },
    },
    browser: {
        label: "Browser",
        icon: "🌐",
        actions: {
            browser_open: { defaultRisk: "auto", label: "Open URLs" },
            browser_read: { defaultRisk: "auto", label: "Read page content" },
            browser_fill: { defaultRisk: "notify", label: "Fill form fields" },
            browser_click: { defaultRisk: "auto", label: "Click page elements" },
            browser_submit: { defaultRisk: "confirm", label: "Submit forms" },
            browser_download: { defaultRisk: "notify", label: "Download files" },
            browser_auth: { defaultRisk: "deny", label: "Enter credentials" },
        },
    },
    financial: {
        label: "Financial",
        icon: "💰",
        actions: {
            view_balance: { defaultRisk: "notify", label: "View account balances" },
            view_transactions: { defaultRisk: "notify", label: "View transaction history" },
            send_payment: { defaultRisk: "deny", label: "Send payments/transfers" },
            create_invoice: { defaultRisk: "confirm", label: "Create invoices" },
        },
    },
    device: {
        label: "Device Management",
        icon: "🔧",
        actions: {
            lock_device: { defaultRisk: "confirm", label: "Lock the device" },
            location_read: { defaultRisk: "notify", label: "Read device location" },
            camera_capture: { defaultRisk: "confirm", label: "Use camera" },
            mic_record: { defaultRisk: "confirm", label: "Use microphone" },
            bluetooth: { defaultRisk: "notify", label: "Manage Bluetooth" },
            wifi_config: { defaultRisk: "confirm", label: "Change WiFi settings" },
            wipe_device: { defaultRisk: "deny", label: "Factory reset / wipe" },
        },
    },
};

// ─── Authorization Engine ───────────────────────────────────────────

class BuddyAuthorization extends EventEmitter {
    constructor(opts = {}) {
        super();
        // userId → { overrides: Map<actionId, riskTier>, deviceScopes: Map<deviceId, Set<category>>, timeRestrictions }
        this.userPolicies = new Map();
        this.auditLog = [];
        this.maxAuditEntries = opts.maxAuditEntries || 10000;
        this.metrics = { authorized: 0, denied: 0, confirmed: 0, notified: 0 };
    }

    /**
     * Check if an action is authorized for a user on a specific device.
     *
     * @param {string} userId
     * @param {string} actionId - The action to check (e.g., "file_delete")
     * @param {{ deviceId?, context?, metadata? }} opts
     * @returns {{ allowed: boolean, riskTier: string, requiresConfirmation: boolean, reason?: string }}
     */
    authorize(userId, actionId, opts = {}) {
        // Find the action definition
        const actionDef = this._findAction(actionId);
        if (!actionDef) {
            this._audit(userId, actionId, "denied", "Unknown action");
            this.metrics.denied++;
            return { allowed: false, riskTier: "deny", requiresConfirmation: false, reason: "Unknown action: " + actionId };
        }

        // Get risk tier (user override or default)
        const policy = this.userPolicies.get(userId);
        let riskTier = actionDef.defaultRisk;

        if (policy) {
            // Check user overrides
            if (policy.overrides.has(actionId)) {
                riskTier = policy.overrides.get(actionId);
            }

            // Check device scope restrictions
            if (opts.deviceId && policy.deviceScopes.size > 0) {
                const allowedDevices = policy.deviceScopes;
                if (!allowedDevices.has(opts.deviceId)) {
                    this._audit(userId, actionId, "denied", "Device not in scope");
                    this.metrics.denied++;
                    return { allowed: false, riskTier: "deny", requiresConfirmation: false, reason: "Action not allowed on this device" };
                }
            }

            // Check time restrictions
            if (policy.timeRestrictions) {
                const now = new Date();
                const hour = now.getHours();
                if (policy.timeRestrictions.startHour !== undefined && policy.timeRestrictions.endHour !== undefined) {
                    if (hour < policy.timeRestrictions.startHour || hour > policy.timeRestrictions.endHour) {
                        this._audit(userId, actionId, "denied", "Outside allowed timeframe");
                        this.metrics.denied++;
                        return { allowed: false, riskTier: "deny", requiresConfirmation: false, reason: "Action not allowed outside business hours" };
                    }
                }
            }
        }

        // Apply risk tier
        const result = this._applyRiskTier(riskTier, actionId);
        this._audit(userId, actionId, result.allowed ? "authorized" : "denied", riskTier);

        if (result.allowed) {
            if (riskTier === "confirm") this.metrics.confirmed++;
            else if (riskTier === "notify") this.metrics.notified++;
            else this.metrics.authorized++;
        } else {
            this.metrics.denied++;
        }

        this.emit("authorization", { userId, actionId, ...result });
        return result;
    }

    /**
     * Set a user's permission override for an action.
     * @param {string} userId
     * @param {string} actionId
     * @param {string} riskTier - "auto", "notify", "confirm", "deny"
     */
    setOverride(userId, actionId, riskTier) {
        if (!RISK_TIERS[riskTier]) throw new Error("Invalid risk tier: " + riskTier);
        if (!this.userPolicies.has(userId)) {
            this.userPolicies.set(userId, { overrides: new Map(), deviceScopes: new Map(), timeRestrictions: null });
        }
        this.userPolicies.get(userId).overrides.set(actionId, riskTier);
        return { ok: true, userId, actionId, riskTier };
    }

    /**
     * Restrict actions to specific devices.
     */
    setDeviceScope(userId, deviceId, allowedCategories) {
        if (!this.userPolicies.has(userId)) {
            this.userPolicies.set(userId, { overrides: new Map(), deviceScopes: new Map(), timeRestrictions: null });
        }
        this.userPolicies.get(userId).deviceScopes.set(deviceId, new Set(allowedCategories));
        return { ok: true, userId, deviceId, categories: allowedCategories };
    }

    /**
     * Set time-based restrictions.
     */
    setTimeRestrictions(userId, { startHour, endHour, timezone }) {
        if (!this.userPolicies.has(userId)) {
            this.userPolicies.set(userId, { overrides: new Map(), deviceScopes: new Map(), timeRestrictions: null });
        }
        this.userPolicies.get(userId).timeRestrictions = { startHour, endHour, timezone };
        return { ok: true, userId, startHour, endHour, timezone };
    }

    /**
     * Get the full permission matrix for a user.
     */
    getPermissionMatrix(userId) {
        const policy = this.userPolicies.get(userId);
        const matrix = {};

        for (const [catId, cat] of Object.entries(PERMISSION_CATEGORIES)) {
            matrix[catId] = {
                label: cat.label,
                icon: cat.icon,
                actions: {},
            };
            for (const [actId, act] of Object.entries(cat.actions)) {
                const override = policy?.overrides.get(actId);
                matrix[catId].actions[actId] = {
                    label: act.label,
                    riskTier: override || act.defaultRisk,
                    isOverridden: !!override,
                    defaultRisk: act.defaultRisk,
                };
            }
        }
        return matrix;
    }

    /**
     * Get available risk tiers.
     */
    getRiskTiers() {
        return RISK_TIERS;
    }

    /**
     * Get available permission categories and actions.
     */
    getPermissionCategories() {
        return PERMISSION_CATEGORIES;
    }

    /**
     * Get recent audit log entries.
     */
    getAuditLog(userId, limit = 50) {
        return this.auditLog
            .filter((e) => !userId || e.userId === userId)
            .slice(-limit);
    }

    getHealth() {
        return { status: "healthy", policies: this.userPolicies.size, auditEntries: this.auditLog.length, ...this.metrics, ts: new Date().toISOString() };
    }

    // ─── Internal ───────────────────────────────────────────────────

    _findAction(actionId) {
        for (const cat of Object.values(PERMISSION_CATEGORIES)) {
            if (cat.actions[actionId]) return cat.actions[actionId];
        }
        return null;
    }

    _applyRiskTier(tier, actionId) {
        switch (tier) {
            case "auto":
                return { allowed: true, riskTier: tier, requiresConfirmation: false };
            case "notify":
                return { allowed: true, riskTier: tier, requiresConfirmation: false, notification: true };
            case "confirm":
                return { allowed: true, riskTier: tier, requiresConfirmation: true };
            case "deny":
                return { allowed: false, riskTier: tier, requiresConfirmation: false, reason: "Action permanently denied" };
            default:
                return { allowed: false, riskTier: "deny", requiresConfirmation: false, reason: "Unknown tier" };
        }
    }

    _audit(userId, actionId, result, reason) {
        this.auditLog.push({ userId, actionId, result, reason, ts: new Date().toISOString() });
        if (this.auditLog.length > this.maxAuditEntries) {
            this.auditLog = this.auditLog.slice(-this.maxAuditEntries);
        }
    }
}

module.exports = { BuddyAuthorization, RISK_TIERS, PERMISSION_CATEGORIES };
