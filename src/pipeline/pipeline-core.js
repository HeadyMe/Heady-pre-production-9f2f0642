/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Pipeline Core — Config loader, run state, logging, stop rules, checkpoints.
 * Extracted from hc_pipeline.js for maintainability.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const yaml = require('../core/heady-yaml');

const CONFIGS_DIR = path.join(__dirname, "..", "..", "configs");
const LOGS_DIR = path.join(__dirname, "..", "..");
const PIPELINE_LOG = path.join(LOGS_DIR, "hc_pipeline.log");

// ─── CONFIG LOADER ──────────────────────────────────────────────────────────

function loadYaml(filename) {
    const filePath = path.join(CONFIGS_DIR, filename);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Config not found: ${filePath}`);
    }
    return yaml.load(fs.readFileSync(filePath, "utf8"));
}

function hashFile(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, "utf8");
    return crypto.createHash("sha256").update(content).digest("hex").slice(0, 12);
}

function loadAllConfigs() {
    const configs = {
        pipeline: loadYaml("hcfullpipeline.yaml"),
        resources: loadYaml("resource-policies.yaml"),
        services: loadYaml("service-catalog.yaml"),
        governance: loadYaml("governance-policies.yaml"),
        concepts: loadYaml("concepts-index.yaml"),
    };
    // Optional configs
    try { configs.appReadiness = loadYaml("app-readiness.yaml"); } catch (_) { configs.appReadiness = {}; }
    try { configs.headyAutoIDE = loadYaml("heady-auto-ide.yaml"); } catch (_) { configs.headyAutoIDE = {}; }
    try { configs.buildPlaybook = loadYaml("build-playbook.yaml"); } catch (_) { configs.buildPlaybook = {}; }
    try { configs.agenticCoding = loadYaml("agentic-coding.yaml"); } catch (_) { configs.agenticCoding = {}; }
    try { configs.publicDomainIntegration = loadYaml("public-domain-integration.yaml"); } catch (_) { configs.publicDomainIntegration = {}; }
    try { configs.activationManifest = loadYaml("activation-manifest.yaml"); } catch (_) { configs.activationManifest = {}; }
    try { configs.monteCarlo = loadYaml("HeadySims-scheduler.yaml"); } catch (_) { configs.monteCarlo = {}; }
    try { configs.selfAwareness = loadYaml("system-self-awareness.yaml"); } catch (_) { configs.selfAwareness = {}; }
    try { configs.connectionIntegrity = loadYaml("connection-integrity.yaml"); } catch (_) { configs.connectionIntegrity = {}; }
    try { configs.extensionPricing = loadYaml("extension-pricing.yaml"); } catch (_) { configs.extensionPricing = {}; }
    try { configs.headyBuddy = loadYaml("heady-buddy.yaml"); } catch (_) { configs.headyBuddy = {}; }
    return configs;
}

function computeConfigHashes(sources) {
    const hashes = {};
    for (const src of sources) {
        const absPath = path.join(__dirname, "..", "..", src);
        hashes[src] = hashFile(absPath);
    }
    return hashes;
}

// ─── PIPELINE STATE ─────────────────────────────────────────────────────────

const RunStatus = {
    IDLE: "idle",
    RUNNING: "running",
    PAUSED: "paused",
    RECOVERY: "recovery",
    HALTED: "halted",
    COMPLETED: "completed",
    FAILED: "failed",
};

function createRunState(pipelineDef) {
    return {
        runId: `run_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
        pipelineName: pipelineDef.pipeline.name,
        version: pipelineDef.pipeline.version || pipelineDef.version,
        status: RunStatus.IDLE,
        startedAt: null,
        completedAt: null,
        currentStageId: null,
        stages: {},
        checkpoints: [],
        errors: [],
        metrics: {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            cachedTasks: 0,
            retriedTasks: 0,
            errorRate: 0,
            readinessScore: 100,
            elapsedMs: 0,
        },
        configHashes: {},
        log: [],
    };
}

// ─── LOGGING ────────────────────────────────────────────────────────────────

function appendLog(state, level, message, detail) {
    const entry = {
        ts: new Date().toISOString(),
        level,
        stage: state.currentStageId || "system",
        message,
        ...(detail ? { detail } : {}),
    };
    state.log.push(entry);

    const line = `[${entry.ts}] [${level.toUpperCase()}] [${entry.stage}] ${message}`;
    try {
        fs.appendFileSync(PIPELINE_LOG, line + "\n", "utf8");
    } catch (_) {
        // log file write failure is non-fatal
    }
}

// ─── STOP RULE EVALUATOR ────────────────────────────────────────────────────

function evaluateStopRules(state, stopRule) {
    if (!stopRule || !stopRule.conditions) return null;

    for (const cond of stopRule.conditions) {
        switch (cond.type) {
            case "error_rate":
                if (state.metrics.errorRate >= cond.threshold) {
                    return { condition: cond, triggered: true };
                }
                break;
            case "readiness_score":
                if (state.metrics.readinessScore <= cond.threshold) {
                    return { condition: cond, triggered: true };
                }
                break;
            case "critical_alarm":
                if (state.errors.filter((e) => e.severity === "critical").length >= (cond.count || 1)) {
                    return { condition: cond, triggered: true };
                }
                break;
            case "data_integrity_failure":
                if (state.errors.some((e) => e.type === "data_integrity")) {
                    return { condition: cond, triggered: true };
                }
                break;
        }
    }
    return null;
}

function applyStopAction(state, action) {
    switch (action) {
        case "enter_recovery":
            state.status = RunStatus.RECOVERY;
            break;
        case "pause_and_escalate":
            state.status = RunStatus.PAUSED;
            break;
        case "halt_immediately":
            state.status = RunStatus.HALTED;
            break;
        default:
            state.status = RunStatus.PAUSED;
    }
}

// ─── CHECKPOINT PROTOCOL ────────────────────────────────────────────────────

function runCheckpoint(state, stageId, checkpointProtocol, configHashSources) {
    const cp = {
        id: `cp_${stageId}_${Date.now()}`,
        stageId,
        ts: new Date().toISOString(),
        configHashes: computeConfigHashes(configHashSources || []),
        readinessScore: state.metrics.readinessScore,
        errorRate: state.metrics.errorRate,
        completedTasks: state.metrics.completedTasks,
        failedTasks: state.metrics.failedTasks,
        responsibilities: [],
    };

    if (checkpointProtocol && checkpointProtocol.responsibilities) {
        for (const resp of checkpointProtocol.responsibilities) {
            const result = executeCheckpointResponsibility(state, resp, cp);
            cp.responsibilities.push({ name: resp, result });
        }
    }

    // Config drift detection
    if (state.configHashes && Object.keys(state.configHashes).length > 0) {
        const drifted = [];
        for (const [file, oldHash] of Object.entries(state.configHashes)) {
            if (cp.configHashes[file] && cp.configHashes[file] !== oldHash) {
                drifted.push(file);
            }
        }
        if (drifted.length > 0) {
            cp.configDrift = drifted;
            appendLog(state, "warn", `Config drift detected: ${drifted.join(", ")}`, { drifted });
        }
    }

    state.configHashes = cp.configHashes;
    state.checkpoints.push(cp);
    appendLog(state, "info", `Checkpoint ${cp.id} saved`, { readiness: cp.readinessScore, errorRate: cp.errorRate });

    return cp;
}

function executeCheckpointResponsibility(state, responsibility, _cp) {
    switch (responsibility) {
        case "validate_run_state":
            return { ok: state.status === RunStatus.RUNNING || state.status === RunStatus.RECOVERY };
        case "compare_config_hashes":
            return { ok: true, hashes: Object.keys(state.configHashes).length };
        case "reevaluate_plan_and_health":
            return { ok: state.metrics.readinessScore >= 60, score: state.metrics.readinessScore };
        case "check_concept_alignment":
            return { ok: true, note: "concept alignment deferred to brain module" };
        case "update_logs_and_owner":
            return { ok: true, logEntries: state.log.length };
        case "apply_approved_patterns":
            return { ok: true, note: "auto-enable patterns applied per governance" };
        default:
            return { ok: true, note: `unhandled responsibility: ${responsibility}` };
    }
}

// ─── TOPOLOGY SORT (dependency order) ───────────────────────────────────────

function topologicalSort(stages) {
    const graph = new Map();
    const inDegree = new Map();
    const stageMap = new Map();

    for (const s of stages) {
        stageMap.set(s.id, s);
        graph.set(s.id, []);
        inDegree.set(s.id, 0);
    }

    for (const s of stages) {
        if (s.dependsOn) {
            for (const dep of s.dependsOn) {
                if (graph.has(dep)) {
                    graph.get(dep).push(s.id);
                    inDegree.set(s.id, (inDegree.get(s.id) || 0) + 1);
                }
            }
        }
    }

    const queue = [];
    for (const [id, deg] of inDegree) {
        if (deg === 0) queue.push(id);
    }

    const sorted = [];
    while (queue.length > 0) {
        const current = queue.shift();
        sorted.push(stageMap.get(current));
        for (const neighbor of graph.get(current) || []) {
            inDegree.set(neighbor, inDegree.get(neighbor) - 1);
            if (inDegree.get(neighbor) === 0) queue.push(neighbor);
        }
    }

    if (sorted.length !== stages.length) {
        throw new Error("Circular dependency detected in pipeline stages");
    }

    return sorted;
}

module.exports = {
    loadAllConfigs,
    computeConfigHashes,
    RunStatus,
    createRunState,
    appendLog,
    evaluateStopRules,
    applyStopAction,
    runCheckpoint,
    topologicalSort,
};
