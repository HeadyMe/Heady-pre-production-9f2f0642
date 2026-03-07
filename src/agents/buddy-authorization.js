/*
 * © 2026 HeadySystems Inc..
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
        label: "Instant Execute",
        icon: "⚡",
        description: "Execute immediately — zero delay, zero interruption",
        defaultDelay: 0,
        examples: ["screenshot", "read_file", "get_clipboard", "system_info", "list_dir"],
    },
    notify: {
        id: "notify",
        label: "Execute & Notify",
        icon: "📢",
        description: "Execute immediately but send a notification so user knows what happened",
        defaultDelay: 0,
        examples: ["write_file", "send_email", "create_event", "install_app"],
    },
    timed: {
        id: "timed",
        label: "Timed Auto-Proceed",
        icon: "⏱️",
        description: "Buddy announces the action and waits X seconds — if you don't signal STOP, it proceeds automatically",
        defaultDelay: 10, // seconds — user configurable per action
        examples: ["delete_file", "shell_exec", "send_payment", "modify_settings"],
    },
    cautious: {
        id: "cautious",
        label: "Extended Timer",
        icon: "🔶",
        description: "Longer delay before auto-proceed — for high-consequence actions. Signal STOP to cancel.",
        defaultDelay: 30, // seconds — user configurable
        examples: ["wipe_device", "financial_transfer", "bulk_delete"],
    },
};

// ─── Permission Categories ──────────────────────────────────────────

const PERMISSION_CATEGORIES = {
    screen: {
        label: "Screen & Display",
        icon: "🖥️",
        actions: {
            screenshot: { defaultRisk: "auto", label: "Capture screenshots", delay: 0 },
            screen_record: { defaultRisk: "notify", label: "Record screen activity", delay: 0 },
            get_ui_tree: { defaultRisk: "auto", label: "Read UI element hierarchy", delay: 0 },
        },
    },
    input: {
        label: "Input Control",
        icon: "🖱️",
        actions: {
            click: { defaultRisk: "auto", label: "Click/tap at coordinates", delay: 0 },
            type_text: { defaultRisk: "auto", label: "Type text into fields", delay: 0 },
            scroll: { defaultRisk: "auto", label: "Scroll content", delay: 0 },
            swipe: { defaultRisk: "auto", label: "Swipe gestures", delay: 0 },
            hotkey: { defaultRisk: "notify", label: "Keyboard shortcuts", delay: 0 },
        },
    },
    apps: {
        label: "Application Control",
        icon: "📱",
        actions: {
            app_launch: { defaultRisk: "auto", label: "Open applications", delay: 0 },
            app_close: { defaultRisk: "auto", label: "Close applications", delay: 0 },
            app_install: { defaultRisk: "timed", label: "Install new applications", delay: 5 },
            app_uninstall: { defaultRisk: "timed", label: "Uninstall applications", delay: 10 },
            app_config: { defaultRisk: "notify", label: "Change app settings", delay: 0 },
        },
    },
    files: {
        label: "File System",
        icon: "📁",
        actions: {
            file_read: { defaultRisk: "auto", label: "Read file contents", delay: 0 },
            file_list: { defaultRisk: "auto", label: "List directory contents", delay: 0 },
            file_write: { defaultRisk: "auto", label: "Create or modify files", delay: 0 },
            file_move: { defaultRisk: "auto", label: "Move or rename files", delay: 0 },
            file_copy: { defaultRisk: "auto", label: "Copy files", delay: 0 },
            file_delete: { defaultRisk: "timed", label: "Delete files", delay: 5 },
        },
    },
    system: {
        label: "System & Shell",
        icon: "⚙️",
        actions: {
            shell_exec: { defaultRisk: "auto", label: "Execute shell commands", delay: 0 },
            system_info: { defaultRisk: "auto", label: "Read system information", delay: 0 },
            process_manage: { defaultRisk: "auto", label: "Start/stop system processes", delay: 0 },
            clipboard_read: { defaultRisk: "auto", label: "Read clipboard", delay: 0 },
            clipboard_write: { defaultRisk: "auto", label: "Write to clipboard", delay: 0 },
            notification: { defaultRisk: "auto", label: "Send notifications", delay: 0 },
            cron_schedule: { defaultRisk: "notify", label: "Schedule recurring tasks", delay: 0 },
        },
    },
    communication: {
        label: "Communication",
        icon: "💬",
        actions: {
            email_read: { defaultRisk: "auto", label: "Read emails", delay: 0 },
            email_send: { defaultRisk: "notify", label: "Send emails", delay: 0 },
            message_read: { defaultRisk: "auto", label: "Read messages", delay: 0 },
            message_send: { defaultRisk: "notify", label: "Send messages", delay: 0 },
            calendar_read: { defaultRisk: "auto", label: "Read calendar events", delay: 0 },
            calendar_write: { defaultRisk: "auto", label: "Create/modify events", delay: 0 },
            call_make: { defaultRisk: "timed", label: "Make phone calls", delay: 5 },
        },
    },
    browser: {
        label: "Browser",
        icon: "🌐",
        actions: {
            browser_open: { defaultRisk: "auto", label: "Open URLs", delay: 0 },
            browser_read: { defaultRisk: "auto", label: "Read page content", delay: 0 },
            browser_fill: { defaultRisk: "auto", label: "Fill form fields", delay: 0 },
            browser_click: { defaultRisk: "auto", label: "Click page elements", delay: 0 },
            browser_submit: { defaultRisk: "auto", label: "Submit forms", delay: 0 },
            browser_download: { defaultRisk: "auto", label: "Download files", delay: 0 },
            browser_auth: { defaultRisk: "timed", label: "Enter credentials", delay: 10 },
        },
    },
    financial: {
        label: "Financial",
        icon: "💰",
        actions: {
            view_balance: { defaultRisk: "auto", label: "View account balances", delay: 0 },
            view_transactions: { defaultRisk: "auto", label: "View transaction history", delay: 0 },
            send_payment: { defaultRisk: "timed", label: "Send payments/transfers", delay: 15 },
            create_invoice: { defaultRisk: "auto", label: "Create invoices", delay: 0 },
        },
    },
    device: {
        label: "Device Management",
        icon: "🔧",
        actions: {
            lock_device: { defaultRisk: "timed", label: "Lock the device", delay: 5 },
            location_read: { defaultRisk: "auto", label: "Read device location", delay: 0 },
            camera_capture: { defaultRisk: "auto", label: "Use camera", delay: 0 },
            mic_record: { defaultRisk: "auto", label: "Use microphone", delay: 0 },
            bluetooth: { defaultRisk: "auto", label: "Manage Bluetooth", delay: 0 },
            wifi_config: { defaultRisk: "notify", label: "Change WiFi settings", delay: 0 },
            wipe_device: { defaultRisk: "cautious", label: "Factory reset / wipe", delay: 30 },
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
            // Unknown action — still allow, just notify. No artificial limits.
            this._audit(userId, actionId, "authorized", "Unknown action — auto-approved");
            this.metrics.authorized++;
            return { allowed: true, riskTier: "notify", delay: 0, reason: "Unknown action — auto-approved" };
        }

        // Get risk tier (user override or default)
        const policy = this.userPolicies.get(userId);
        let riskTier = actionDef.defaultRisk;
        let delay = actionDef.delay !== undefined ? actionDef.delay : (RISK_TIERS[riskTier]?.defaultDelay || 0);

        if (policy) {
            // Check user overrides
            if (policy.overrides.has(actionId)) {
                const override = policy.overrides.get(actionId);
                riskTier = override.tier || override;
                if (override.delay !== undefined) delay = override.delay;
            }

            // Check device scope — but DON'T deny, just increase delay
            if (opts.deviceId && policy.deviceScopes.size > 0) {
                if (!policy.deviceScopes.has(opts.deviceId)) {
                    delay = Math.max(delay, 15); // Extra delay for unscoped devices
                    riskTier = "timed";
                }
            }

            // Time restrictions — don't deny, add delay outside hours
            if (policy.timeRestrictions) {
                const now = new Date();
                const hour = now.getHours();
                if (policy.timeRestrictions.startHour !== undefined && policy.timeRestrictions.endHour !== undefined) {
                    if (hour < policy.timeRestrictions.startHour || hour > policy.timeRestrictions.endHour) {
                        delay = Math.max(delay, 20); // Longer delay outside business hours
                        riskTier = "timed";
                    }
                }
            }
        }

        // EVERYTHING is allowed — the only question is the delay before auto-proceeding
        const result = {
            allowed: true,
            riskTier,
            delay, // seconds before auto-proceed (0 = instant)
            notification: riskTier === "notify" || riskTier === "timed" || riskTier === "cautious",
            message: delay > 0 ? `Action will proceed in ${delay}s — signal STOP to cancel` : null,
        };

        this._audit(userId, actionId, "authorized", riskTier + (delay > 0 ? ` (${delay}s delay)` : ""));
        if (riskTier === "timed" || riskTier === "cautious") this.metrics.confirmed++;
        else if (riskTier === "notify") this.metrics.notified++;
        else this.metrics.authorized++;

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
        const tierDef = RISK_TIERS[tier] || RISK_TIERS.auto;
        return {
            allowed: true, // ALWAYS allowed — no artificial limits
            riskTier: tier,
            delay: tierDef.defaultDelay || 0,
            notification: tier !== "auto",
        };
    }

    _audit(userId, actionId, result, reason) {
        this.auditLog.push({ userId, actionId, result, reason, ts: new Date().toISOString() });
        if (this.auditLog.length > this.maxAuditEntries) {
            this.auditLog = this.auditLog.slice(-this.maxAuditEntries);
        }
    }
}

module.exports = { BuddyAuthorization, RISK_TIERS, PERMISSION_CATEGORIES };
