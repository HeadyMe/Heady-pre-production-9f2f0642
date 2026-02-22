/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  src/services/heady-autonomy.js                                  ║
 * ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
 * ║  Autonomous Knowledge Gathering & Resource Migration Service     ║
 * ║  UPDATED: 20260221-052400                                        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * DEFAULT BEHAVIOR:
 *   idle → 100% resources to knowledge gathering
 *   user acts → instant 100% pivot to user task
 *   user goes quiet → gradual ramp back to autonomous
 */

const EventEmitter = require("events");
const fs = require("fs");
const path = require("path");

const MODES = {
    AUTONOMOUS: "autonomous_learning",
    USER_PRIORITY: "user_priority",
    TRANSITIONING: "transitioning",
};

class HeadyAutonomy extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.mode = MODES.AUTONOMOUS;
        this.lastUserActivity = 0;
        this.idleThresholdMs = opts.idleThresholdMs || 30000; // 30s
        this.pivotLatencyTarget = 50; // ms
        this.started = false;

        // Resource allocation state
        this.allocation = {
            knowledge_gathering: 45,
            code_improvement: 30,
            experience_building: 15,
            health_monitoring: 10,
            user_task: 0,
        };

        // Knowledge stats
        this.stats = {
            memoriesGathered: 0,
            codeImprovements: 0,
            patternsDetected: 0,
            pivotCount: 0,
            avgPivotLatencyMs: 0,
            totalLearningTimeMs: 0,
            totalUserTimeMs: 0,
            lastPivotAt: null,
        };

        // Storage references (injected)
        this.memoryWrapper = opts.memoryWrapper || null;
        this.patternEngine = opts.patternEngine || null;
        this.resourceManager = opts.resourceManager || null;

        // Timers
        this._idleCheckInterval = null;
        this._knowledgeGatherInterval = null;
        this._rampTimer = null;

        // Knowledge gathering tasks
        this._activeTasks = new Set();
    }

    /**
     * Start the autonomy service
     */
    start() {
        if (this.started) return;
        this.started = true;
        this.lastUserActivity = Date.now();

        // Check for user idle every second
        this._idleCheckInterval = setInterval(() => this._checkIdleState(), 1000);

        // Knowledge gathering cycle every 10 seconds when autonomous
        this._knowledgeGatherInterval = setInterval(() => {
            if (this.mode === MODES.AUTONOMOUS) {
                this._gatherKnowledge();
            }
        }, 10000);

        console.log("∞ HeadyAutonomy: STARTED (mode: autonomous_learning)");
        console.log("  → Idle → 100% knowledge gathering");
        console.log("  → User acts → instant 100% pivot");
        this.emit("started", { mode: this.mode });
    }

    /**
     * Stop the autonomy service
     */
    stop() {
        this.started = false;
        clearInterval(this._idleCheckInterval);
        clearInterval(this._knowledgeGatherInterval);
        clearTimeout(this._rampTimer);
        this._activeTasks.clear();
        console.log("∞ HeadyAutonomy: STOPPED");
        this.emit("stopped");
    }

    // ═══════════════════════════════════════════
    // USER ACTIVITY DETECTION
    // ═══════════════════════════════════════════

    /**
     * Call this on ANY user input — API request, chat message, keystroke
     * Instantly pivots 100% resources to user task
     */
    onUserActivity(context = {}) {
        const pivotStart = Date.now();
        this.lastUserActivity = pivotStart;

        if (this.mode !== MODES.USER_PRIORITY) {
            // INSTANT PIVOT — hard cut, no graceful shutdown
            const previousMode = this.mode;
            this.mode = MODES.USER_PRIORITY;

            // Save learning state before pivot
            this._saveLearnState();

            // Kill all background tasks
            this._activeTasks.clear();
            clearTimeout(this._rampTimer);

            // Reallocate 100% to user
            this.allocation = {
                knowledge_gathering: 0,
                code_improvement: 0,
                experience_building: 0,
                health_monitoring: 0,
                user_task: 100,
            };

            const pivotLatency = Date.now() - pivotStart;
            this.stats.pivotCount++;
            this.stats.avgPivotLatencyMs =
                (this.stats.avgPivotLatencyMs * (this.stats.pivotCount - 1) + pivotLatency) /
                this.stats.pivotCount;
            this.stats.lastPivotAt = new Date().toISOString();

            console.log(`⚡ PIVOT: ${previousMode} → user_priority (${pivotLatency}ms)`);

            this.emit("pivot", {
                from: previousMode,
                to: MODES.USER_PRIORITY,
                latencyMs: pivotLatency,
                context,
            });
        }
    }

    /**
     * Check if user has gone idle → ramp back to autonomous
     */
    _checkIdleState() {
        const idleMs = Date.now() - this.lastUserActivity;

        if (this.mode === MODES.USER_PRIORITY && idleMs >= this.idleThresholdMs) {
            this._beginReturnToAutonomous();
        }
    }

    /**
     * Gradual return to autonomous mode
     * 30s: 50/50 → 60s: 80/20 → 120s: 100/0
     */
    _beginReturnToAutonomous() {
        if (this.mode === MODES.TRANSITIONING) return;
        this.mode = MODES.TRANSITIONING;

        console.log("🔄 User idle — transitioning back to autonomous learning");

        // Stage 1: 50/50 split (immediate)
        this.allocation.user_task = 50;
        this.allocation.knowledge_gathering = 25;
        this.allocation.code_improvement = 15;
        this.allocation.experience_building = 5;
        this.allocation.health_monitoring = 5;
        this.emit("allocation_changed", { ...this.allocation, stage: 1 });

        // Stage 2: 80/20 after 30 more seconds
        this._rampTimer = setTimeout(() => {
            if (this.mode !== MODES.TRANSITIONING) return; // user came back
            this.allocation.user_task = 20;
            this.allocation.knowledge_gathering = 35;
            this.allocation.code_improvement = 25;
            this.allocation.experience_building = 12;
            this.allocation.health_monitoring = 8;
            this.emit("allocation_changed", { ...this.allocation, stage: 2 });

            // Stage 3: 100% autonomous after 60 more seconds
            this._rampTimer = setTimeout(() => {
                if (this.mode !== MODES.TRANSITIONING) return;
                this.mode = MODES.AUTONOMOUS;
                this.allocation = {
                    knowledge_gathering: 45,
                    code_improvement: 30,
                    experience_building: 15,
                    health_monitoring: 10,
                    user_task: 0,
                };
                console.log("✅ Back to autonomous_learning mode (100% knowledge gathering)");
                this._restoreLearnState();
                this.emit("mode_changed", { mode: MODES.AUTONOMOUS });
            }, 60000);
        }, 30000);
    }

    // ═══════════════════════════════════════════
    // KNOWLEDGE GATHERING
    // ═══════════════════════════════════════════

    async _gatherKnowledge() {
        const taskId = `gather_${Date.now()}`;
        this._activeTasks.add(taskId);

        try {
            const startTime = Date.now();

            // 1. Scan codebase for patterns
            await this._scanCodebase();

            // 2. Index documentation
            await this._indexDocumentation();

            // 3. Build experience from recent activity
            await this._buildExperience();

            // 4. Check storage health
            await this._checkStorageHealth();

            const elapsed = Date.now() - startTime;
            this.stats.totalLearningTimeMs += elapsed;

            this.emit("knowledge_gathered", {
                taskId,
                elapsedMs: elapsed,
                stats: { ...this.stats },
            });
        } catch (err) {
            console.warn("⚠ Knowledge gathering error:", err.message);
        } finally {
            this._activeTasks.delete(taskId);
        }
    }

    async _scanCodebase() {
        if (!this.memoryWrapper) return;
        try {
            // Scan configs directory for changes
            const configDir = path.join(__dirname, "..", "..", "configs");
            if (fs.existsSync(configDir)) {
                const files = fs.readdirSync(configDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".json"));
                for (const file of files.slice(0, 5)) {
                    // Process 5 configs per cycle max
                    const content = fs.readFileSync(path.join(configDir, file), "utf8");
                    const hash = require("crypto").createHash("md5").update(content).digest("hex");
                    const cacheKey = `config:${file}:${hash}`;

                    if (!this.memoryWrapper.cache.has(cacheKey)) {
                        await this.memoryWrapper.ingestMemory({
                            content: `Config file analysis: ${file}\n${content.substring(0, 500)}`,
                            metadata: { type: "config_scan", file, hash },
                        });
                        this.memoryWrapper.cache.set(cacheKey, true);
                        this.stats.memoriesGathered++;
                    }
                }
            }
        } catch (err) {
            // Non-critical — continue
        }
    }

    async _indexDocumentation() {
        if (!this.memoryWrapper) return;
        try {
            const docsDir = path.join(__dirname, "..", "..", "docs");
            if (fs.existsSync(docsDir)) {
                const walk = (dir) => {
                    const results = [];
                    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                        const full = path.join(dir, entry.name);
                        if (entry.isDirectory()) results.push(...walk(full));
                        else if (entry.name.endsWith(".md")) results.push(full);
                    }
                    return results;
                };
                const docs = walk(docsDir).slice(0, 3); // 3 docs per cycle
                for (const doc of docs) {
                    const content = fs.readFileSync(doc, "utf8");
                    const hash = require("crypto").createHash("md5").update(content).digest("hex");
                    const cacheKey = `doc:${path.basename(doc)}:${hash}`;

                    if (!this.memoryWrapper.cache.has(cacheKey)) {
                        await this.memoryWrapper.ingestMemory({
                            content: `Documentation: ${path.basename(doc)}\n${content.substring(0, 1000)}`,
                            metadata: { type: "doc_index", file: path.basename(doc), hash },
                        });
                        this.memoryWrapper.cache.set(cacheKey, true);
                        this.stats.memoriesGathered++;
                    }
                }
            }
        } catch (err) {
            // Non-critical
        }
    }

    async _buildExperience() {
        if (!this.patternEngine) return;
        try {
            // Extract learned patterns and store as experience
            if (typeof this.patternEngine.getConvergedPatterns === "function") {
                const patterns = this.patternEngine.getConvergedPatterns();
                if (patterns && patterns.length > 0) {
                    this.stats.patternsDetected += patterns.length;
                }
            }
        } catch (err) {
            // Non-critical
        }
    }

    async _checkStorageHealth() {
        try {
            // Check persistent store
            const storeFile = path.join(__dirname, "..", "data", "memory-store.json");
            if (fs.existsSync(storeFile)) {
                const stats = fs.statSync(storeFile);
                const sizeMb = stats.size / (1024 * 1024);
                if (sizeMb > 400) {
                    console.warn(`⚠ Memory store is ${sizeMb.toFixed(1)}MB — consider compaction`);
                    this.emit("storage_warning", { type: "size", sizeMb });
                }
            }

            // Check vector DB health
            if (this.memoryWrapper && this.memoryWrapper.initialized) {
                const health = await this.memoryWrapper.vectorService.healthCheck();
                if (health && !health.ok) {
                    console.warn("⚠ Vector DB health check failed — using fallback storage");
                }
            }
        } catch (err) {
            // Non-critical
        }
    }

    // ═══════════════════════════════════════════
    // STATE PERSISTENCE
    // ═══════════════════════════════════════════

    _saveLearnState() {
        try {
            const state = {
                stats: this.stats,
                savedAt: new Date().toISOString(),
                cacheSize: this.memoryWrapper ? this.memoryWrapper.cache.size : 0,
            };
            const stateFile = path.join(__dirname, "..", "data", "autonomy-state.json");
            const dir = path.dirname(stateFile);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
        } catch (err) {
            // Non-critical
        }
    }

    _restoreLearnState() {
        try {
            const stateFile = path.join(__dirname, "..", "data", "autonomy-state.json");
            if (fs.existsSync(stateFile)) {
                const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
                this.stats = { ...this.stats, ...state.stats };
                console.log(`🔄 Restored learning state (${state.stats.memoriesGathered} memories gathered)`);
            }
        } catch (err) {
            // Non-critical
        }
    }

    // ═══════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════

    getStatus() {
        return {
            mode: this.mode,
            allocation: this.allocation,
            stats: this.stats,
            idleSinceMs: Date.now() - this.lastUserActivity,
            activeTasks: this._activeTasks.size,
            started: this.started,
            ts: new Date().toISOString(),
        };
    }

    getResourceAllocation() {
        return { ...this.allocation };
    }
}

/**
 * Express route registration
 */
function registerAutonomyRoutes(app, autonomy) {
    // GET /api/autonomy/status — current mode + allocation
    app.get("/api/autonomy/status", (req, res) => {
        res.json({ ok: true, ...autonomy.getStatus() });
    });

    // POST /api/autonomy/activity — register user activity (triggers pivot)
    app.post("/api/autonomy/activity", (req, res) => {
        autonomy.onUserActivity(req.body || {});
        res.json({ ok: true, mode: autonomy.mode, allocation: autonomy.getResourceAllocation() });
    });

    // GET /api/autonomy/allocation — current resource split
    app.get("/api/autonomy/allocation", (req, res) => {
        res.json({ ok: true, ...autonomy.getResourceAllocation() });
    });
}

module.exports = { HeadyAutonomy, registerAutonomyRoutes, MODES };
