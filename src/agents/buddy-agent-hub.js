/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * BUDDY AGENT HUB — Unified Cross-Device Agent Orchestrator
 *
 * This is the top-level integration module that wires together:
 *   - DeviceBridge:      Cross-device communication & task dispatch
 *   - ComputerUseEngine: Autonomous OBSERVE→THINK→ACT→VERIFY loop
 *   - BuddyAuthorization: Granular permission framework
 *   - ConnectorVault:     OAuth token management (from connectors system)
 *
 * Concepts integrated from:
 *   - NanoClaw:       Docker-isolated task execution, maximum security
 *   - OpenClaw:       Tool-use orchestration (shell, browser, email, calendar)
 *   - Claude Desktop: Computer Use API (screenshot→reason→act loop)
 *   - Lumo-Android:   Native Android agent with accessibility services
 *   - Island App:     Work profile isolation for root-level Android control
 */
"use strict";

const EventEmitter = require("events");
const { DeviceBridge, PLATFORMS } = require("./buddy-device-bridge");
const { ComputerUseEngine, ACTION_TYPES } = require("./buddy-computer-use");
const { BuddyAuthorization, RISK_TIERS, PERMISSION_CATEGORIES } = require("./buddy-authorization");

// ─── Capability Categories ──────────────────────────────────────────

const BUDDY_CAPABILITIES = {
    // ─ Core Intelligence ─
    conversation: {
        label: "Natural Language Understanding",
        desc: "Chat, answer questions, explain concepts, brainstorm",
        alwaysAvailable: true,
    },
    reasoning: {
        label: "Chain-of-Thought Reasoning",
        desc: "Multi-step analysis, planning, problem decomposition",
        alwaysAvailable: true,
    },
    memory: {
        label: "Persistent Memory",
        desc: "Remembers context across conversations and sessions",
        alwaysAvailable: true,
    },

    // ─ Device Control (requires device bridge) ─
    computerUse: {
        label: "Computer Use",
        desc: "See screen, click, type, navigate — control any device autonomously",
        requiresDevice: true,
    },
    fileManagement: {
        label: "File Management",
        desc: "Read, write, organize, search files across connected devices",
        requiresDevice: true,
    },
    appControl: {
        label: "App Control",
        desc: "Launch, interact with, and automate any application",
        requiresDevice: true,
    },
    shellAccess: {
        label: "Shell / Terminal",
        desc: "Execute commands, run scripts, manage processes",
        requiresDevice: true,
    },

    // ─ Communication (requires connectors) ─
    email: {
        label: "Email Management",
        desc: "Read, compose, send, organize emails across providers",
        requiresConnector: ["google", "microsoft"],
    },
    calendar: {
        label: "Calendar Management",
        desc: "View, create, modify calendar events and scheduling",
        requiresConnector: ["google", "microsoft"],
    },
    messaging: {
        label: "Messaging",
        desc: "Send and read messages via Slack, Discord, Teams, SMS",
        requiresConnector: ["slack", "discord", "microsoft"],
    },

    // ─ Productivity ─
    codeAssistant: {
        label: "Code Assistant",
        desc: "Write, debug, refactor code, manage repos, deploy",
        requiresConnector: ["github", "gitlab"],
    },
    documentCreation: {
        label: "Document Creation",
        desc: "Create docs, spreadsheets, presentations, reports",
        requiresConnector: ["google", "microsoft", "notion"],
    },
    taskManagement: {
        label: "Task Management",
        desc: "Create and track tasks in Jira, Asana, Trello, Linear",
        requiresConnector: ["jira", "asana", "trello"],
    },

    // ─ Data & Analysis ─
    webResearch: {
        label: "Web Research",
        desc: "Search the web, read pages, compile research",
        requiresDevice: true,
    },
    dataAnalysis: {
        label: "Data Analysis",
        desc: "Analyze datasets, create visualizations, generate insights",
        alwaysAvailable: true,
    },

    // ─ System Administration ─
    cloudManagement: {
        label: "Cloud Management",
        desc: "Manage GCP, AWS, Azure resources, deploy services",
        requiresConnector: ["google", "amazon", "microsoft"],
    },
    deviceManagement: {
        label: "Device Management",
        desc: "Monitor, configure, and manage connected devices",
        requiresDevice: true,
    },

    // ─ Automation ─
    workflows: {
        label: "Workflow Automation",
        desc: "Create multi-step automated workflows that run on schedule or trigger",
        alwaysAvailable: true,
    },
    monitoring: {
        label: "Monitoring & Alerts",
        desc: "Watch for conditions and alert or act automatically",
        alwaysAvailable: true,
    },
};

// ─── Buddy Agent Hub ────────────────────────────────────────────────

class BuddyAgentHub extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.bridge = new DeviceBridge(opts.bridge);
        this.computerUse = new ComputerUseEngine(opts.computerUse);
        this.auth = new BuddyAuthorization(opts.auth);
        this.version = "2.0.0";
        this.startedAt = Date.now();

        // Wire events for unified logging
        this.bridge.on("device:registered", (e) => this.emit("buddy:event", { type: "device_registered", ...e }));
        this.bridge.on("task:dispatched", (e) => this.emit("buddy:event", { type: "task_dispatched", ...e }));
        this.bridge.on("task:completed", (e) => this.emit("buddy:event", { type: "task_completed", ...e }));
        this.computerUse.on("session:started", (e) => this.emit("buddy:event", { type: "cuse_started", ...e }));
        this.computerUse.on("session:completed", (e) => this.emit("buddy:event", { type: "cuse_completed", ...e }));
        this.computerUse.on("step:confirmation_required", (e) => this.emit("buddy:confirm", e));
        this.auth.on("authorization", (e) => this.emit("buddy:event", { type: "authorization", ...e }));
    }

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
    async executeTask(userId, instruction, opts = {}) {
        const taskId = `buddy_${Date.now().toString(36)}`;

        // 1. Parse intent (simplified — production would use LLM)
        const intent = this._parseIntent(instruction);

        // 2. Check authorization for all required actions
        const authResults = intent.requiredActions.map((action) =>
            this.auth.authorize(userId, action, { deviceId: opts.preferredDevice })
        );

        const denied = authResults.filter((r) => !r.allowed);
        if (denied.length > 0) {
            return {
                taskId,
                status: "denied",
                reason: "Not authorized: " + denied.map((d) => d.reason).join(", "),
                deniedActions: denied,
            };
        }

        const confirmsNeeded = authResults.filter((r) => r.requiresConfirmation);
        if (confirmsNeeded.length > 0 && !opts.confirmed) {
            return {
                taskId,
                status: "confirmation_required",
                actionsToConfirm: confirmsNeeded,
                instruction,
                message: "The following actions require your approval before Buddy can proceed.",
            };
        }

        // 3. If device-required, dispatch to bridge
        if (intent.requiresDevice) {
            const devices = this.bridge.listDevices(userId);
            const targetDevice = opts.preferredDevice || (devices.length > 0 ? devices[0].deviceId : null);

            if (!targetDevice) {
                return {
                    taskId,
                    status: "no_device",
                    message: "No connected device found. Please connect a device first.",
                    setupInstructions: this._getDeviceSetupInstructions(),
                };
            }

            // For computer-use tasks, start a CU session
            if (intent.type === "computer_use") {
                const session = this.computerUse.startSession({
                    goal: instruction,
                    deviceId: targetDevice,
                    userId,
                    context: opts.context,
                });
                return { taskId, status: "running", type: "computer_use", session };
            }

            // Otherwise dispatch as a device task
            const task = this.bridge.dispatchTask(userId, {
                action: intent.primaryAction,
                params: intent.params,
                requiredCapabilities: intent.requiredActions,
                preferredDevice: targetDevice,
                priority: opts.priority || intent.priority,
            });
            return { taskId, status: "dispatched", type: "device_task", task };
        }

        // 4. Direct execution (cloud-based, no device needed)
        return {
            taskId,
            status: "processing",
            type: "direct",
            intent,
            message: "Task queued for processing by Heady swarm.",
        };
    }

    /**
     * Register a device for cross-device control.
     */
    registerDevice(userId, deviceInfo) {
        return this.bridge.registerDevice(userId, deviceInfo);
    }

    /**
     * Get all available platforms and control methods.
     */
    getPlatforms() {
        return PLATFORMS;
    }

    /**
     * Get all Buddy capabilities and their requirements.
     */
    getCapabilities() {
        return BUDDY_CAPABILITIES;
    }

    /**
     * Get permission matrix for a user.
     */
    getPermissions(userId) {
        return this.auth.getPermissionMatrix(userId);
    }

    /**
     * Update a permission override.
     */
    setPermission(userId, actionId, riskTier) {
        return this.auth.setOverride(userId, actionId, riskTier);
    }

    /**
     * Get device setup instructions for each platform.
     */
    _getDeviceSetupInstructions() {
        return {
            android: {
                title: "Android Setup (Island-Style Work Profile)",
                steps: [
                    "Install HeadyBuddy from Google Play Store",
                    "Grant Device Administrator permission when prompted",
                    "Enable Accessibility Service: Settings → Accessibility → HeadyBuddy",
                    "Optional: Create Work Profile for isolated root-level control",
                    "Sign in with your Heady account to pair the device",
                ],
                capabilities: "Full ADB-level control, accessibility automation, work profile isolation, notification management",
            },
            ios: {
                title: "iOS Setup (Shortcuts + PWA)",
                steps: [
                    "Open HeadyMe.com in Safari and tap 'Add to Home Screen'",
                    "Enable HeadyBuddy Shortcuts from the Shortcuts app",
                    "Grant notification permissions when prompted",
                    "Optional: Install MDM profile for enterprise management",
                ],
                capabilities: "Shortcuts automation, PWA features, notification control, file access",
            },
            desktop: {
                title: "Desktop Setup (Native Agent)",
                steps: [
                    "Download HeadyBuddy Desktop from HeadyMe.com/download",
                    "Install and run — the agent starts automatically",
                    "Grant screen capture and accessibility permissions",
                    "Optional: Enable Docker sandbox for isolated task execution",
                ],
                capabilities: "Full OS control, shell access, screen capture, file management, app automation",
            },
            web: {
                title: "HeadyWeb Browser Extension",
                steps: [
                    "Install the HeadyWeb extension from your browser's extension store",
                    "Sign in with your Heady account",
                    "The extension delivers the full Buddy UI in any browser",
                ],
                capabilities: "Tab management, page interaction, download control, notifications",
            },
        };
    }

    /**
     * Parse instruction to determine intent (simplified for MVP).
     * Production version would use LLM classification.
     */
    _parseIntent(instruction) {
        const lower = instruction.toLowerCase();
        const intent = {
            raw: instruction,
            type: "direct",
            primaryAction: null,
            requiredActions: [],
            params: {},
            requiresDevice: false,
            priority: "normal",
        };

        // File operations
        if (/\b(file|folder|directory|read|write|move|copy|delete|rename|organize)\b/.test(lower)) {
            intent.type = "device_task";
            intent.requiresDevice = true;
            if (/delete|remove/.test(lower)) intent.requiredActions.push("file_delete");
            else if (/write|create|save/.test(lower)) intent.requiredActions.push("file_write");
            else if (/move|rename/.test(lower)) intent.requiredActions.push("file_move");
            else intent.requiredActions.push("file_read");
            intent.primaryAction = intent.requiredActions[0];
        }

        // App control
        if (/\b(open|launch|start|close|switch|app)\b/.test(lower)) {
            intent.type = "device_task";
            intent.requiresDevice = true;
            intent.requiredActions.push("app_launch");
            intent.primaryAction = "app_launch";
        }

        // Shell commands
        if (/\b(run|execute|command|terminal|shell|script)\b/.test(lower)) {
            intent.type = "device_task";
            intent.requiresDevice = true;
            intent.requiredActions.push("shell_exec");
            intent.primaryAction = "shell_exec";
        }

        // Screen interaction
        if (/\b(click|tap|type|scroll|screenshot|screen)\b/.test(lower)) {
            intent.type = "computer_use";
            intent.requiresDevice = true;
            intent.requiredActions.push("screenshot", "click", "type_text");
            intent.primaryAction = "screenshot";
        }

        // Email
        if (/\b(email|mail|inbox|compose|send email)\b/.test(lower)) {
            if (/send|compose|write/.test(lower)) {
                intent.requiredActions.push("email_send");
                intent.primaryAction = "email_send";
            } else {
                intent.requiredActions.push("email_read");
                intent.primaryAction = "email_read";
            }
        }

        // Calendar
        if (/\b(calendar|event|meeting|schedule|appointment)\b/.test(lower)) {
            if (/create|add|schedule/.test(lower)) {
                intent.requiredActions.push("calendar_write");
                intent.primaryAction = "calendar_write";
            } else {
                intent.requiredActions.push("calendar_read");
                intent.primaryAction = "calendar_read";
            }
        }

        // Browser
        if (/\b(browse|search|website|url|navigate|web)\b/.test(lower)) {
            intent.type = "device_task";
            intent.requiresDevice = true;
            intent.requiredActions.push("browser_open");
            intent.primaryAction = "browser_open";
        }

        // If no specific actions detected, keep as direct
        if (intent.requiredActions.length === 0) {
            intent.type = "direct";
            intent.requiresDevice = false;
        }

        return intent;
    }

    /**
     * Get health of all subsystems.
     */
    getHealth() {
        return {
            status: "healthy",
            version: this.version,
            uptime: Date.now() - this.startedAt,
            subsystems: {
                deviceBridge: this.bridge.getHealth(),
                computerUse: this.computerUse.getHealth(),
                authorization: this.auth.getHealth(),
            },
            capabilities: Object.keys(BUDDY_CAPABILITIES).length,
            platforms: Object.keys(PLATFORMS).length,
            actionTypes: Object.keys(ACTION_TYPES).length,
            permissionCategories: Object.keys(PERMISSION_CATEGORIES).length,
            ts: new Date().toISOString(),
        };
    }
}

module.exports = { BuddyAgentHub, BUDDY_CAPABILITIES };
