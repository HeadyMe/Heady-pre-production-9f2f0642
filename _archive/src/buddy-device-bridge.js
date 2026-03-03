/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * BUDDY DEVICE BRIDGE — Cross-Device Communication & Control
 *
 * Inspired by:
 *   - Island App: Android work profile isolation for root-level control without root
 *   - Lumo-Android: Native Android agent with accessibility service integration
 *   - NanoClaw: Docker-isolated execution environments per device
 *   - OpenClaw: Universal tool-use across shell, browser, apps
 *
 * Architecture:
 *   HeadyBuddy Cloud ←→ Device Bridge ←→ Device Agent (per device)
 *   Each device registers with the bridge, reports capabilities,
 *   and receives task directives through encrypted WebSocket channels.
 */
"use strict";

const crypto = require("crypto");
const EventEmitter = require("events");

// ─── Device Platform Definitions ────────────────────────────────────

const PLATFORMS = {
    android: {
        id: "android",
        name: "Android",
        icon: "📱",
        controlMethods: {
            workProfile: {
                label: "Work Profile (Island-style)",
                description: "Creates an isolated managed profile giving Buddy device-admin level control without root",
                capabilities: ["app_install", "app_launch", "app_data_access", "notification_control",
                    "wifi_config", "vpn_config", "clipboard", "file_access", "contact_access",
                    "calendar_access", "sms_read", "call_log", "location", "camera", "storage"],
                rootRequired: false,
            },
            accessibility: {
                label: "Accessibility Service",
                description: "Uses Android Accessibility API to observe and control any app UI",
                capabilities: ["screen_read", "tap", "swipe", "type_text", "scroll", "gesture",
                    "back", "home", "recents", "notifications_read", "ui_tree_dump"],
                rootRequired: false,
            },
            deviceAdmin: {
                label: "Device Administrator",
                description: "Full device management via Android Device Admin or Android Management API",
                capabilities: ["lock_device", "wipe_device", "password_policy", "disable_camera",
                    "encrypt_storage", "app_restrictions", "network_config"],
                rootRequired: false,
                businessOnly: true,
            },
            adb: {
                label: "ADB Bridge",
                description: "Direct ADB connection for developer-level device control",
                capabilities: ["shell_exec", "logcat", "screen_capture", "screen_record",
                    "input_inject", "package_manage", "file_push_pull", "port_forward"],
                rootRequired: false,
            },
        },
    },
    ios: {
        id: "ios",
        name: "iOS / iPadOS",
        icon: "📱",
        controlMethods: {
            shortcuts: {
                label: "Shortcuts Integration",
                description: "Uses iOS Shortcuts API for task automation",
                capabilities: ["app_launch", "shortcut_run", "reminder_create", "calendar_create",
                    "message_send", "clipboard", "file_access", "location", "focus_mode"],
                rootRequired: false,
            },
            mdm: {
                label: "MDM Profile",
                description: "Mobile Device Management for enterprise-level control",
                capabilities: ["app_install", "app_config", "vpn_config", "wifi_config",
                    "password_policy", "remote_wipe", "app_restrictions"],
                rootRequired: false,
                businessOnly: true,
            },
            webClip: {
                label: "HeadyWeb PWA",
                description: "Progressive Web App with full Buddy capabilities",
                capabilities: ["notifications", "camera", "microphone", "geolocation",
                    "clipboard", "file_access", "share_target", "background_sync"],
                rootRequired: false,
            },
        },
    },
    desktop: {
        id: "desktop",
        name: "Desktop (Windows/Mac/Linux)",
        icon: "💻",
        controlMethods: {
            nativeAgent: {
                label: "Heady Desktop Agent",
                description: "Native agent with full OS-level control (inspired by Claude Desktop/NanoClaw)",
                capabilities: ["shell_exec", "file_system", "process_manage", "screen_capture",
                    "screen_control", "keyboard_input", "mouse_control", "clipboard",
                    "system_info", "network_config", "app_launch", "app_control",
                    "registry_access", "service_manage", "cron_schedule"],
                rootRequired: false,
            },
            browserExtension: {
                label: "HeadyWeb Extension",
                description: "Browser extension with page interaction, tab management, and download control",
                capabilities: ["tab_manage", "page_read", "page_modify", "download_manage",
                    "bookmark_manage", "history_read", "cookie_manage", "storage_local",
                    "notifications", "context_menu", "side_panel", "devtools"],
                rootRequired: false,
            },
            dockerIsolated: {
                label: "Docker Sandbox (NanoClaw-style)",
                description: "Isolated Docker container for high-risk task execution",
                capabilities: ["shell_exec", "file_system", "network_isolated", "gpu_access",
                    "port_expose", "volume_mount", "resource_limit"],
                rootRequired: false,
            },
        },
    },
    web: {
        id: "web",
        name: "HeadyWeb (Browser)",
        icon: "🌐",
        controlMethods: {
            pwa: {
                label: "Progressive Web App",
                description: "Full Buddy experience in any modern browser",
                capabilities: ["notifications", "camera", "microphone", "geolocation",
                    "clipboard", "file_system_access", "share_target", "background_sync",
                    "service_worker", "indexeddb", "web_workers", "webgpu"],
                rootRequired: false,
            },
        },
    },
};

// ─── Device Registration ────────────────────────────────────────────

class DeviceBridge extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.devices = new Map(); // deviceId → DeviceRecord
        this.sessions = new Map(); // sessionId → { deviceId, userId, established }
        this.taskQueue = new Map(); // taskId → TaskRecord
        this.encryptionKey = opts.encryptionKey || crypto.randomBytes(32);
        this.maxDevicesPerUser = opts.maxDevicesPerUser || 20;
        this.heartbeatInterval = opts.heartbeatInterval || 30000; // 30s
        this.metrics = { registered: 0, tasks_dispatched: 0, tasks_completed: 0, tasks_failed: 0 };
    }

    /**
     * Register a new device with the bridge.
     * @param {string} userId
     * @param {{ platform, deviceName, os, model, enabledMethods, fingerprint }} deviceInfo
     * @returns {{ deviceId, sessionToken, capabilities }}
     */
    registerDevice(userId, deviceInfo) {
        const deviceId = `dev_${crypto.randomBytes(8).toString("hex")}`;
        const sessionToken = crypto.randomBytes(32).toString("hex");
        const platform = PLATFORMS[deviceInfo.platform];
        if (!platform) throw new Error("Unknown platform: " + deviceInfo.platform);

        // Aggregate capabilities from enabled control methods
        const capabilities = new Set();
        const enabledMethods = deviceInfo.enabledMethods || Object.keys(platform.controlMethods);
        enabledMethods.forEach((m) => {
            const method = platform.controlMethods[m];
            if (method) method.capabilities.forEach((c) => capabilities.add(c));
        });

        const record = {
            deviceId,
            userId,
            platform: deviceInfo.platform,
            deviceName: deviceInfo.deviceName || `${platform.name} Device`,
            os: deviceInfo.os || "unknown",
            model: deviceInfo.model || "unknown",
            enabledMethods,
            capabilities: Array.from(capabilities),
            fingerprint: deviceInfo.fingerprint || null,
            registeredAt: Date.now(),
            lastHeartbeat: Date.now(),
            status: "online",
            taskHistory: [],
        };

        this.devices.set(deviceId, record);
        this.sessions.set(sessionToken, { deviceId, userId, established: Date.now() });
        this.metrics.registered++;
        this.emit("device:registered", { deviceId, userId, platform: deviceInfo.platform });

        return {
            deviceId,
            sessionToken,
            capabilities: record.capabilities,
            platform: platform.name,
            controlMethods: enabledMethods,
        };
    }

    /**
     * Heartbeat from a connected device.
     */
    heartbeat(deviceId, status = {}) {
        const device = this.devices.get(deviceId);
        if (!device) throw new Error("Unknown device");
        device.lastHeartbeat = Date.now();
        device.status = "online";
        if (status.battery) device.battery = status.battery;
        if (status.network) device.network = status.network;
        if (status.activeApp) device.activeApp = status.activeApp;
        return { ok: true, pendingTasks: this._getPendingTasks(deviceId) };
    }

    /**
     * Dispatch a task to a specific device or auto-select best device.
     * @param {string} userId
     * @param {{ action, params, requiredCapabilities, preferredDevice, priority, timeout }} task
     */
    dispatchTask(userId, task) {
        const taskId = `task_${crypto.randomBytes(6).toString("hex")}`;
        let targetDevice;

        if (task.preferredDevice) {
            targetDevice = this.devices.get(task.preferredDevice);
        } else {
            // Auto-select: find online device with required capabilities
            targetDevice = this._findBestDevice(userId, task.requiredCapabilities || []);
        }

        if (!targetDevice) throw new Error("No suitable device found for this task");

        const taskRecord = {
            taskId,
            userId,
            deviceId: targetDevice.deviceId,
            action: task.action,
            params: task.params || {},
            requiredCapabilities: task.requiredCapabilities || [],
            priority: task.priority || "normal", // low, normal, high, critical
            timeout: task.timeout || 60000,
            status: "pending",
            createdAt: Date.now(),
            startedAt: null,
            completedAt: null,
            result: null,
            error: null,
            retries: 0,
            maxRetries: task.maxRetries || 3,
        };

        this.taskQueue.set(taskId, taskRecord);
        targetDevice.taskHistory.push(taskId);
        this.metrics.tasks_dispatched++;
        this.emit("task:dispatched", { taskId, deviceId: targetDevice.deviceId, action: task.action });

        return { taskId, deviceId: targetDevice.deviceId, status: "pending" };
    }

    /**
     * Report task completion from a device.
     */
    completeTask(taskId, result) {
        const task = this.taskQueue.get(taskId);
        if (!task) throw new Error("Unknown task");
        task.status = result.success ? "completed" : "failed";
        task.result = result.data || null;
        task.error = result.error || null;
        task.completedAt = Date.now();
        if (result.success) this.metrics.tasks_completed++;
        else this.metrics.tasks_failed++;
        this.emit("task:completed", { taskId, status: task.status });
        return { ok: true, taskId, status: task.status };
    }

    /**
     * List all devices for a user.
     */
    listDevices(userId) {
        const now = Date.now();
        return Array.from(this.devices.values())
            .filter((d) => d.userId === userId)
            .map((d) => ({
                deviceId: d.deviceId,
                deviceName: d.deviceName,
                platform: d.platform,
                model: d.model,
                os: d.os,
                status: now - d.lastHeartbeat > this.heartbeatInterval * 3 ? "offline" : d.status,
                capabilities: d.capabilities,
                enabledMethods: d.enabledMethods,
                battery: d.battery,
                lastSeen: new Date(d.lastHeartbeat).toISOString(),
                taskCount: d.taskHistory.length,
            }));
    }

    /**
     * Remove a device.
     */
    removeDevice(deviceId) {
        const device = this.devices.get(deviceId);
        if (!device) throw new Error("Unknown device");
        this.devices.delete(deviceId);
        // Clean up sessions
        for (const [token, session] of this.sessions) {
            if (session.deviceId === deviceId) this.sessions.delete(token);
        }
        this.emit("device:removed", { deviceId });
        return { ok: true, deviceId };
    }

    // ─── Supported Actions (what Buddy can do on devices) ───────────

    getAvailableActions() {
        return {
            // Screen & UI
            screen_capture: { label: "Capture Screen", category: "screen", desc: "Take a screenshot of the current screen" },
            screen_record: { label: "Record Screen", category: "screen", desc: "Record screen activity" },
            tap: { label: "Tap", category: "input", desc: "Tap at coordinates or on a UI element" },
            swipe: { label: "Swipe", category: "input", desc: "Swipe gesture" },
            type_text: { label: "Type Text", category: "input", desc: "Type text into focused field" },
            scroll: { label: "Scroll", category: "input", desc: "Scroll up/down/left/right" },

            // App control
            app_launch: { label: "Launch App", category: "apps", desc: "Open an application" },
            app_install: { label: "Install App", category: "apps", desc: "Install an application" },
            app_control: { label: "Control App", category: "apps", desc: "Interact with app UI" },

            // File operations
            file_read: { label: "Read File", category: "files", desc: "Read file contents" },
            file_write: { label: "Write File", category: "files", desc: "Create or modify a file" },
            file_list: { label: "List Files", category: "files", desc: "List directory contents" },
            file_move: { label: "Move/Rename", category: "files", desc: "Move or rename files" },
            file_delete: { label: "Delete File", category: "files", desc: "Delete a file (with confirmation)" },

            // System
            shell_exec: { label: "Run Command", category: "system", desc: "Execute a shell command" },
            notification_send: { label: "Send Notification", category: "system", desc: "Push a notification to the device" },
            clipboard_get: { label: "Get Clipboard", category: "system", desc: "Read clipboard contents" },
            clipboard_set: { label: "Set Clipboard", category: "system", desc: "Write to clipboard" },
            system_info: { label: "System Info", category: "system", desc: "Get device system information" },

            // Communication
            email_send: { label: "Send Email", category: "comms", desc: "Compose and send an email" },
            email_read: { label: "Read Email", category: "comms", desc: "Read and organize emails" },
            calendar_create: { label: "Create Event", category: "comms", desc: "Create a calendar event" },
            message_send: { label: "Send Message", category: "comms", desc: "Send SMS/chat message" },

            // Browser
            browser_open: { label: "Open URL", category: "browser", desc: "Navigate to a URL" },
            browser_search: { label: "Web Search", category: "browser", desc: "Search the web" },
            browser_read: { label: "Read Page", category: "browser", desc: "Extract page content" },
            browser_fill: { label: "Fill Form", category: "browser", desc: "Fill in form fields" },
            browser_click: { label: "Click Element", category: "browser", desc: "Click a page element" },
        };
    }

    // ─── Internal ───────────────────────────────────────────────────

    _findBestDevice(userId, requiredCaps) {
        const candidates = Array.from(this.devices.values())
            .filter((d) => d.userId === userId && d.status === "online")
            .filter((d) => requiredCaps.every((c) => d.capabilities.includes(c)));

        if (candidates.length === 0) return null;
        // Prefer device with fewest pending tasks
        return candidates.sort((a, b) => {
            const aPending = this._getPendingTasks(a.deviceId).length;
            const bPending = this._getPendingTasks(b.deviceId).length;
            return aPending - bPending;
        })[0];
    }

    _getPendingTasks(deviceId) {
        return Array.from(this.taskQueue.values()).filter(
            (t) => t.deviceId === deviceId && t.status === "pending"
        );
    }

    getHealth() {
        const now = Date.now();
        let online = 0, offline = 0;
        for (const d of this.devices.values()) {
            if (now - d.lastHeartbeat > this.heartbeatInterval * 3) offline++;
            else online++;
        }
        return { status: "healthy", devices: { total: this.devices.size, online, offline }, ...this.metrics, ts: new Date().toISOString() };
    }
}

module.exports = { DeviceBridge, PLATFORMS };
