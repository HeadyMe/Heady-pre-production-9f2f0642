/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * BUDDY COMPUTER USE ENGINE — Autonomous Screen & App Control
 *
 * Inspired by:
 *   - OpenClaw: Shell/browser/app control with tool-use orchestration
 *   - NanoClaw: Isolated execution with audit trails
 *   - Claude Desktop: Computer Use API (screenshot → reason → action loop)
 *   - Lumo-Android: Android accessibility service agent
 *
 * Core Loop:
 *   1. OBSERVE  — Capture screen state (screenshot, UI tree, DOM)
 *   2. THINK    — LLM reasons about current state vs goal
 *   3. ACT      — Execute action (click, type, scroll, command)
 *   4. VERIFY   — Confirm action succeeded, loop or escalate
 */
"use strict";

const EventEmitter = require("events");
const crypto = require("crypto");

// ─── Action Types ───────────────────────────────────────────────────

const ACTION_TYPES = {
    // Mouse / Touch
    click: { id: "click", label: "Click/Tap", category: "input", params: ["x", "y", "selector?"] },
    doubleClick: { id: "doubleClick", label: "Double Click", category: "input", params: ["x", "y"] },
    rightClick: { id: "rightClick", label: "Right Click", category: "input", params: ["x", "y"] },
    longPress: { id: "longPress", label: "Long Press", category: "input", params: ["x", "y", "duration?"] },
    drag: { id: "drag", label: "Drag", category: "input", params: ["fromX", "fromY", "toX", "toY"] },
    swipe: { id: "swipe", label: "Swipe", category: "input", params: ["direction", "distance?"] },
    scroll: { id: "scroll", label: "Scroll", category: "input", params: ["direction", "amount?"] },
    pinch: { id: "pinch", label: "Pinch Zoom", category: "input", params: ["direction", "amount?"] },

    // Keyboard
    type: { id: "type", label: "Type Text", category: "keyboard", params: ["text"] },
    keyPress: { id: "keyPress", label: "Press Key", category: "keyboard", params: ["key", "modifiers?"] },
    hotkey: { id: "hotkey", label: "Hotkey Combo", category: "keyboard", params: ["keys"] },
    clear: { id: "clear", label: "Clear Input", category: "keyboard", params: ["selector?"] },

    // Navigation
    back: { id: "back", label: "Go Back", category: "nav", params: [] },
    home: { id: "home", label: "Go Home", category: "nav", params: [] },
    recents: { id: "recents", label: "Recent Apps", category: "nav", params: [] },
    openUrl: { id: "openUrl", label: "Open URL", category: "nav", params: ["url"] },
    openApp: { id: "openApp", label: "Open App", category: "nav", params: ["appId", "activity?"] },
    switchApp: { id: "switchApp", label: "Switch to App", category: "nav", params: ["appId"] },
    closeApp: { id: "closeApp", label: "Close App", category: "nav", params: ["appId?"] },

    // Shell / System
    shell: { id: "shell", label: "Run Command", category: "system", params: ["command", "cwd?", "timeout?"] },
    readFile: { id: "readFile", label: "Read File", category: "system", params: ["path"] },
    writeFile: { id: "writeFile", label: "Write File", category: "system", params: ["path", "content", "mode?"] },
    listDir: { id: "listDir", label: "List Directory", category: "system", params: ["path", "recursive?"] },
    moveFile: { id: "moveFile", label: "Move/Rename File", category: "system", params: ["from", "to"] },
    copyFile: { id: "copyFile", label: "Copy File", category: "system", params: ["from", "to"] },
    deleteFile: { id: "deleteFile", label: "Delete File", category: "system", params: ["path"], confirmRequired: true },

    // Screen
    screenshot: { id: "screenshot", label: "Take Screenshot", category: "observe", params: [] },
    getUITree: { id: "getUITree", label: "Get UI Tree", category: "observe", params: ["depth?"] },
    getDOM: { id: "getDOM", label: "Get Page DOM", category: "observe", params: ["selector?"] },
    getClipboard: { id: "getClipboard", label: "Get Clipboard", category: "observe", params: [] },
    setClipboard: { id: "setClipboard", label: "Set Clipboard", category: "observe", params: ["text"] },

    // Wait / Assert
    wait: { id: "wait", label: "Wait", category: "flow", params: ["ms"] },
    waitFor: { id: "waitFor", label: "Wait For Element", category: "flow", params: ["selector", "timeout?"] },
    assert: { id: "assert", label: "Assert Condition", category: "flow", params: ["condition", "message?"] },
};

// ─── Computer Use Engine ────────────────────────────────────────────

class ComputerUseEngine extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.maxSteps = opts.maxSteps || 100;
        this.stepTimeout = opts.stepTimeout || 15000;
        this.screenshotInterval = opts.screenshotInterval || 2000;
        this.confidenceThreshold = opts.confidenceThreshold || 0.7;
        this.sessions = new Map(); // sessionId → SessionRecord
        this.metrics = { sessions: 0, steps: 0, successes: 0, failures: 0, escalations: 0 };
    }

    /**
     * Start a computer-use session — the main OBSERVE→THINK→ACT→VERIFY loop.
     *
     * @param {{ goal, deviceId, userId, context?, maxSteps? }} params
     * @returns {{ sessionId, status }}
     */
    startSession(params) {
        const sessionId = `cuse_${crypto.randomBytes(6).toString("hex")}`;
        const session = {
            sessionId,
            goal: params.goal,
            deviceId: params.deviceId,
            userId: params.userId,
            context: params.context || {},
            maxSteps: params.maxSteps || this.maxSteps,
            status: "running",
            steps: [],
            observations: [],
            plan: null,
            startedAt: Date.now(),
            completedAt: null,
            result: null,
        };

        this.sessions.set(sessionId, session);
        this.metrics.sessions++;
        this.emit("session:started", { sessionId, goal: params.goal });
        return { sessionId, status: "running" };
    }

    /**
     * Execute one step of the OBSERVE→THINK→ACT→VERIFY loop.
     *
     * @param {string} sessionId
     * @param {{ observation, reasoning?, action?, verification? }} stepData
     */
    executeStep(sessionId, stepData) {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error("Unknown session");
        if (session.status !== "running") throw new Error("Session not running");
        if (session.steps.length >= session.maxSteps) {
            session.status = "max_steps_reached";
            this.metrics.escalations++;
            return { sessionId, status: "max_steps_reached", message: "Step limit reached — escalating to user" };
        }

        const step = {
            stepNumber: session.steps.length + 1,
            timestamp: Date.now(),
            phase: stepData.phase || "act",

            // OBSERVE: what the agent sees
            observation: stepData.observation || null,    // screenshot, UI tree, DOM snapshot
            observationType: stepData.observationType || null, // "screenshot", "ui_tree", "dom", "text"

            // THINK: LLM reasoning about what to do
            reasoning: stepData.reasoning || null,
            confidence: stepData.confidence || 1.0,
            plan: stepData.plan || null,

            // ACT: the action taken
            action: stepData.action || null, // { type, params }

            // VERIFY: did it work?
            verification: stepData.verification || null,
            success: stepData.success !== undefined ? stepData.success : null,
            error: stepData.error || null,
        };

        session.steps.push(step);
        this.metrics.steps++;

        // Check confidence threshold
        if (step.confidence < this.confidenceThreshold && step.action) {
            step.requiresConfirmation = true;
            this.emit("step:confirmation_required", { sessionId, step });
        }

        // Check for destructive actions
        if (step.action && ACTION_TYPES[step.action.type]?.confirmRequired) {
            step.requiresConfirmation = true;
            this.emit("step:confirmation_required", { sessionId, step });
        }

        this.emit("step:executed", { sessionId, stepNumber: step.stepNumber, action: step.action });
        return { sessionId, stepNumber: step.stepNumber, status: "running" };
    }

    /**
     * Complete a session — goal achieved or failed.
     */
    completeSession(sessionId, result) {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error("Unknown session");
        session.status = result.success ? "completed" : "failed";
        session.result = result.data || null;
        session.completedAt = Date.now();
        if (result.success) this.metrics.successes++;
        else this.metrics.failures++;
        this.emit("session:completed", { sessionId, status: session.status, steps: session.steps.length });
        return {
            sessionId,
            status: session.status,
            totalSteps: session.steps.length,
            duration: session.completedAt - session.startedAt,
            result: session.result,
        };
    }

    /**
     * Get session details with step history.
     */
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error("Unknown session");
        return {
            ...session,
            totalSteps: session.steps.length,
            duration: (session.completedAt || Date.now()) - session.startedAt,
        };
    }

    /**
     * Generate a task plan from a natural language goal.
     * Returns a sequence of planned actions.
     *
     * @param {string} goal - Natural language description of the task
     * @param {{ platform, capabilities, currentApp? }} context
     * @returns {{ plan: Array<{ action, description, estimated_time }> }}
     */
    planTask(goal, context = {}) {
        // This would normally call the LLM — here we provide the planning structure
        return {
            goal,
            platform: context.platform || "unknown",
            steps: [],
            estimatedTime: null,
            requiredCapabilities: [],
            riskLevel: "low", // low, medium, high
            confirmationRequired: false,
            planGeneratedAt: new Date().toISOString(),
        };
    }

    getAvailableActions() {
        return ACTION_TYPES;
    }

    getHealth() {
        const active = Array.from(this.sessions.values()).filter((s) => s.status === "running").length;
        return { status: "healthy", activeSessions: active, ...this.metrics, ts: new Date().toISOString() };
    }
}

module.exports = { ComputerUseEngine, ACTION_TYPES };
